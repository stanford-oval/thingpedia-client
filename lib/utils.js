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

module.exports = {
    getMixinArgs,
    findMixinArg,

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

    getPollInterval(fndef) {
        if (fndef.annotations.poll_interval)
            return fndef.annotations.poll_interval.toJS();
        else
            return -1;
    },
};
