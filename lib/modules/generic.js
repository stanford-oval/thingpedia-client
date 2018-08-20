// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See LICENSE for details
"use strict";

const ThingTalk = require('thingtalk');
const Tp = require('thingpedia');

const Utils = require('./utils');
const Base = require('./base_generic');

function get(obj, propchain) {
    for (let prop of propchain.split('.'))
        obj = obj[prop];
    return obj;
}

module.exports = class GenericRestModule extends Base {
    constructor(kind, ast) {
        super(kind, ast);

        const authfn = Utils.makeAuth(ast);
        for (let action in ast.actions) {
            const block = ast.actions[action];

            this._loaded.prototype['do_' + action] = function(params) {
                const url = Utils.formatString(block.url, this.state, params);
                const defaultobj = block['default'] || {};
                const method = block.method || 'POST';

                const obj = {};
                Object.assign(obj, defaultobj);
                Object.assign(obj, params);
                return Tp.Helpers.Http.request(url, method, JSON.stringify(obj),
                                    { auth: authfn(this),
                                      useOAuth2: this,
                                      dataContentType: 'application/json' });
            };
        }

        for (let query in ast.queries) {
            const block = ast.queries[query];
            let pollInterval = ast.queries[query].poll_interval;
            if (!pollInterval)
                pollInterval = ast.queries[query]['poll-interval'];

            this._loaded.prototype['get_' + query] = function(params, filter, count) {
                // ignore count and filter

                const url = Utils.formatString(block.url, this.state, params);
                const method = block.method || 'GET';
                let data = null;
                if (method !== "GET") {
                    const defaultobj = block['default'] || {};

                    const obj = {};
                    Object.assign(obj, defaultobj);
                    Object.assign(obj, params);
                    data = JSON.stringify(obj);
                }

                return Tp.Helpers.Http.request(url, method, data, {
                    dataContentType: (method === 'GET' ? null : 'application/json'),
                    auth: authfn(this),
                    useOAuth2: this,
                    accept: 'application/json' }).then((response) => {
                    let parsed = JSON.parse(response);

                    function extractOne(result) {
                        let extracted = {};
                        for (let arg of block.args) {
                            if (arg.is_input)
                                continue;
                            if (arg.json_key)
                                extracted[arg.name] = get(result, arg.json_key);
                            else
                                extracted[arg.name] = result[arg.name];
                            if (arg.type === 'Date')
                                extracted[arg.name] = new Date(extracted[arg.name]);
                            else if (arg.type === 'Currency' && typeof extracted[arg.name] === 'number')
                                extracted[arg.name] = new ThingTalk.Builtin.Currency(extracted[arg.name], 'usd');
                            else if (arg.type === 'Currency' && typeof extracted[arg.name] === 'string')
                                extracted[arg.name] = new ThingTalk.Builtin.Currency(parseFloat(extracted[arg.name]), 'usd');
                        }
                        return extracted;
                    }

                    if (block.json_key)
                        parsed = get(parsed, block.json_key);

                    if (Array.isArray(parsed))
                        return parsed.map(extractOne);
                    else
                        return [extractOne(parsed)];
                });
            };

            this._loaded.prototype['subscribe_' + query] = function(params, state, filter) {
                return new Tp.Helpers.PollingStream(state, pollInterval, () => this['get_' + query](params));
            };
            this._loaded.prototype['history_' + query] = function(params, base, delta, filters) {
                return null; // no history
            };
            this._loaded.prototype['sequence_' + query] = function(params, base, limit, filters) {
                return null; // no sequence history
            };
        }
    }
};