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

module.exports = {
    parseGenericResponse(json, block) {
        function extractOne(result) {
            let extracted = {};

            for (let arg of block.args) {
                const type = ThingTalk.Type.fromString(arg.type);
                if (arg.is_input)
                    continue;
                if (arg.json_key)
                    extracted[arg.name] = cast(get(result, arg.json_key), type);
                else
                    extracted[arg.name] = cast(result[arg.name], type);
            }
            return extracted;
        }

        if (block.json_key)
            json = get(json, block.json_key);

        if (Array.isArray(json))
            return json.map(extractOne);
        else
            return [extractOne(json)];
    },

    makeGenericOAuth(kind, ast, devclass) {
        function OAuthCallback(engine, accessToken, refreshToken, extraData) {
            var obj = { kind: kind,
                        accessToken: accessToken,
                        refreshToken: refreshToken };
            for (let name in extraData) {
                if (name === 'access_token' || name === 'refresh_token' || name === 'expires_in')
                    continue;
                obj[name] = extraData[name];
            }

            if (ast.auth.get_profile) {
                var auth = 'Bearer ' + accessToken;
                return Tp.Helpers.Http.get(ast.auth.get_profile, { auth: auth,
                                                                   accept: 'application/json' })
                    .then((response) => {
                        var profile = JSON.parse(response);

                        if (ast.auth.profile) {
                            ast.auth.profile.forEach((p) => {
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

        var runOAuth2 = Tp.Helpers.OAuth2({ kind: kind,
                                         client_id: ast.auth.client_id,
                                         client_secret: ast.auth.client_secret,
                                         authorize: ast.auth.authorize,
                                         get_access_token: ast.auth.get_access_token,
                                         set_state: !!ast.auth.set_state,
                                         callback: OAuthCallback });
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

    makeAuth(ast) {
        if (ast.auth.type === 'none') {
            return () => undefined;
        } else if (ast.auth.type === 'oauth2') {
            return () => undefined;
        } else if (ast.auth.type === 'basic') {
            return (device) => ('Basic ' + (new Buffer(device.state.username + ':' +
                                              device.state.password)).toString('base64'));
        } else {
            return () => undefined;
        }
    }
};


