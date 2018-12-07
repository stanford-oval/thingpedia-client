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

module.exports = {
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


