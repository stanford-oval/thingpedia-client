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

const Tp = require('thingpedia');

const Base = require('./base_generic');
const Utils = require('./utils');
const { ImplementationError } = require('./errors');

function invokeQuery(device, auth, url) {
    return Tp.Helpers.Rss.get(url, { auth: auth, useOAuth2: device });
}

module.exports = class RSSModule extends Base {
    _loadModule() {
        super._loadModule();
        const ast = this._manifest;

        const authfn = Utils.makeAuth(ast);
        for (let query in ast.queries) {
            const block = ast.queries[query];
            let pollInterval = ast.queries[query].poll_interval;
            if (pollInterval === undefined)
                pollInterval = ast.queries[query]['poll-interval'];

            this._loaded.prototype['get_' + query] = function(params, count, filter) {
                // ignore count and filter

                let url = Utils.formatString(block.url, this.state, params);
                return invokeQuery(this, authfn(this), url);
            };

            if (pollInterval === 0)
                throw new ImplementationError(`Poll interval cannot be 0 for RSS query ${query}`);
            if (pollInterval > 0) {
                this._loaded.prototype['subscribe_' + query] = function(params, state, filter) {
                    return new Tp.Helpers.PollingStream(state, pollInterval, () => this['get_' + query](params));
                };
            } else {
                this._loaded.prototype['subscribe_' + query] = function(params, state, filter) {
                    throw new Error('This query is non-deterministic and cannot be monitored');
                };
            }
            this._loaded.prototype['history_' + query] = function(params, base, delta, filters) {
                return null; // no history
            };
            this._loaded.prototype['sequence_' + query] = function(params, base, limit, filters) {
                return null; // no sequence history
            };
        }
        for (let action in ast.actions)
            throw new ImplementationError(`Invalid action ${action}: RSS devices cannot have actions`);
    }
};
