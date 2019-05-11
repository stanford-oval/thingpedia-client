// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See LICENSE for details
"use strict";

const Tp = require('thingpedia');
const ThingTalk = require('thingtalk');
const Units = ThingTalk.Units;

function measureToString(value, precision, unit) {
    var baseUnit = Units.UnitsToBaseUnit[unit];
    if (!baseUnit)
        throw new Error('Invalid unit ' + unit);

    var coeff = Units.UnitsTransformToBaseUnit[unit];
    if (typeof coeff === 'function')
        return Units.UnitsInverseTransformFromBaseUnit[unit](value).toFixed(precision);
    else
        return ((1/coeff)*value).toFixed(precision);
}

function get(obj, propchain) {
    for (let prop of propchain.split('.'))
        obj = obj[prop];
    return obj;
}

function cast(value, type) {
    if (type.isArray && typeof value === 'string')
        return value.split(/,\s*/g).map((v) => cast(v, type.elem));
    if (type.isArray)
        return value.map((v) => cast(v, type.elem));
    if (type.isDate)
        return new Date(value);
    if ((type.isNumber || type.isMeasure) && typeof value === 'string')
        return parseFloat(value);
    if (type.isCurrency && typeof value === 'number')
        return new ThingTalk.Builtin.Currency(value, 'usd');
    if (type.isCurrency && typeof value === 'string')
        return new ThingTalk.Builtin.Currency(parseFloat(value), 'usd');
    if (type.isCurrency)
        return new ThingTalk.Builtin.Currency(value.value, value.unit);
    if (type.isEntity && typeof value === 'string')
        return new ThingTalk.Builtin.Entity(value, null);
    if (type.isEntity)
        return new ThingTalk.Builtin.Entity(value.value, value.display);
    if (type.isLocation) {
        if (value.hasOwnProperty('x') && value.hasOwnProperty('y'))
            return new ThingTalk.Builtin.Location(value.y, value.x, value.display);
        else if (value.hasOwnProperty('latitude') && value.hasOwnProperty('longitude'))
            return new ThingTalk.Builtin.Location(value.latitude, value.longitude, value.display);
        else
            return new ThingTalk.Builtin.Location(value.lat, value.lon, value.display);
    }

    return value;
}

function getMixinArgs(mixin) {
    const args = {};
    for (let in_param of mixin.in_params)
        args[in_param.name] = in_param.value.toJS();
    return args;
}

function findMixinArg(mixin, arg) {
    for (let in_param of mixin.in_params) {
        if (in_param.name === arg)
            return in_param.value.toJS();
    }
    return undefined;
}

function getParams(classDef) {
    let params = {};
    const config = classDef.config;
    switch (config.module) {
    case 'org.thingpedia.config.form':
    case 'org.thingpedia.config.basic_auth':
        if (config.in_params.length === 1) {
            let argMap = config.in_params[0].value;
            Object.entries(argMap.value).forEach(([name, type]) => {
                // the value does not matter, only the fact that the parameter is present matters
                params[name] = null;
            });
        }
    }
    return params;
}

function getAuth(classDef) {
    let auth = {};
    let extraTypes = [];

    const config = classDef.config;
    config.in_params.forEach((param) => {
        if (param.value.isArgMap)
            return;
        switch (param.name) {
        case 'device_class':
            extraTypes.push('bluetooth-class-' + param.value.toJS());
            break;
        case 'uuids':
            for (let uuid of param.value.toJS())
                extraTypes.push('bluetooth-uuid-' + uuid.toLowerCase());
            break;
        case 'search_target':
            for (let st of param.value.toJS())
                extraTypes.push('upnp-' + st.toLowerCase().replace(/^urn:/, '').replace(/:/g, '-'));
            break;

        default:
            auth[param.name] = param.value.toJS();
        }
    });
    switch (config.module) {
    case 'org.thingpedia.config.oauth2':
        auth.type = 'oauth2';
        break;
    case 'org.thingpedia.config.custom_oauth':
        auth.type = 'custom_oauth';
        break;
    case 'org.thingpedia.config.basic_auth':
        auth.type = 'basic';
        break;
    case 'org.thingpedia.config.discovery.bluetooth':
        auth.type = 'discovery';
        auth.discoveryType = 'bluetooth';
        break;
    case 'org.thingpedia.config.discovery.upnp':
        auth.type = 'discovery';
        auth.discoveryType = 'upnp';
        break;
    case 'org.thingpedia.config.interactive':
        auth.type = 'interactive';
        break;
    case 'org.thingpedia.config.builtin':
        auth.type = 'builtin';
        break;
    default:
        auth.type = 'none';
    }
    return [auth, extraTypes];
}

function getCategory(classDef) {
    if (classDef.annotations.system && this.annotations.system.toJS())
        return 'system';
    const config = classDef.config;
    if (!config)
        return 'data';

    switch (config.module) {
    case 'org.thingpedia.config.builtin':
    case 'org.thingpedia.config.none':
        return 'data';
    case 'org.thingpedia.config.discovery.bluetooth':
    case 'org.thingpedia.config.discovery.upnp':
        return 'physical';
    default:
        return 'online';
    }
}

function makeBaseDeviceMetadata(classDef) {
    const [auth, extraTypes] = getAuth(classDef);
    return {
        kind: classDef.kind,
        name: classDef.metadata.name,
        description: classDef.metadata.description,
        types: (classDef.extends || []).concat(extraTypes),
        category: getCategory(classDef),
        auth: auth,
        params: getParams(classDef)
    };
}

module.exports = {
    getMixinArgs,
    findMixinArg,
    makeBaseDeviceMetadata,

    parseGenericResponse(json, fndef) {
        function extractOne(result) {
            let extracted = {};

            for (let argname of fndef.args) {
                const arg = fndef.getArgument(argname);
                if (arg.is_input)
                    continue;
                if (arg.annotations.json_key)
                    extracted[arg.name] = cast(get(result, arg.annotations.json_key.toJS()), arg.type);
                else
                    extracted[arg.name] = cast(result[arg.name], arg.type);
            }
            return extracted;
        }

        if (fndef.annotations.json_key)
            json = get(json, fndef.annotations.json_key.toJS());

        if (Array.isArray(json))
            return json.map(extractOne);
        else
            return [extractOne(json)];
    },

    makeGenericOAuth(kind, mixin, devclass) {
        const info = getMixinArgs(mixin);

        function OAuthCallback(engine, accessToken, refreshToken, extraData) {
            var obj = { kind: kind,
                        accessToken: accessToken,
                        refreshToken: refreshToken };
            for (let name in extraData) {
                if (name === 'access_token' || name === 'refresh_token' || name === 'expires_in')
                    continue;
                obj[name] = extraData[name];
            }

            if (info.get_profile) {
                var auth = 'Bearer ' + accessToken;
                return Tp.Helpers.Http.get(info.get_profile, { auth: auth,
                                                                   accept: 'application/json' })
                    .then((response) => {
                        var profile = JSON.parse(response);

                        if (info.profile) {
                            info.profile.forEach((p) => {
                                obj[p] = profile[p];
                            });
                        } else {
                            obj.profile = profile;
                        }

                        return engine.devices.loadOneDevice(obj, true);
                    });
            } else {
                return engine.devices.loadOneDevice(obj, true);
            }
        }

        var runOAuth2 = Tp.Helpers.OAuth2({
            kind: kind,
            client_id: info.client_id,
            client_secret: info.client_secret,
            authorize: info.authorize,
            get_access_token: info.get_access_token,
            scope: info.scope,
            set_state: !!info.set_state,
            callback: OAuthCallback
        });
        runOAuth2.install(devclass.prototype);
        devclass.runOAuth2 = runOAuth2;
    },

    formatString(url, deviceParams, functionParams) {
        return url.replace(/\$(?:\$|([a-zA-Z0-9_]+(?![a-zA-Z0-9_]))|{([a-zA-Z0-9_]+)(?::(%|[a-zA-Z-]+))?})/g, (match, param1, param2, opt) => {
            if (match === '$$')
                return '$';
            const param = param1 || param2;
            let value;
            if (functionParams)
                value = functionParams[param] || deviceParams[param] || '';
            else
                value = deviceParams[param] || '';

            if (value instanceof Date)
                value = value.toISOString();
            if (typeof value === 'number') {
                if (opt === '%') {
                    value = value*100;
                    opt = '';
                }
                if (opt)
                    return measureToString(value, 1, opt);
                else
                    return (Math.floor(value) === value ? value.toFixed(0) : value.toFixed(2));
            }
            if (opt === 'url')
                return encodeURIComponent(value);
            else
                return value;
        });
    },

    makeAuth(classDef) {
        const config = classDef.config;
        if (config.module === 'org.thingpedia.config.basic_auth') {
            return (device) => {
                const base64 = new Buffer(device.state.username + ':' +
                                          device.state.password).toString('base64');
                return 'Basic ' + base64;
            };
        } else {
            return () => undefined;
        }
    },

    getPollInterval(fndef) {
        if (fndef.annotations.poll_interval)
            return fndef.annotations.poll_interval.toJS();
        else
            return -1;
    },
};
