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

const stream = require('stream');
const Tp = require('thingpedia');

const BaseJavascriptModule = require('./base_js');
const { ImplementationError } = require('./errors');

function isIterable(result) {
    return typeof result === 'object' && result !== null &&
        typeof result[Symbol.iterator] === 'function';
}

// wrap implementation functions in async functions
// the goal is two fold:
// - the calling code can expect a promise, rather than a raw JS result
// - synchronous errors (eg JS errors TypeErrors) get converted
//   into rejected promise, even if the error occurs before the
//   callee has a chance to set up Promise.resolve().then(() => ...)
// - type checking of the return value ensures understandable
//   error messages, rather than failing deep in a compiled ThingTalk
//   function with no stack
function safeWrapQuery(query, queryName) {
    return async function () {
        const result = await query.apply(this, arguments);
        if (!isIterable(result))
            throw new ImplementationError(`The query ${queryName} must return an iterable object (eg. Array), got ${result}`);
        return result;
    };
}
function safeWrapAction(action) {
    return async function () {
        return action.apply(this, arguments);
    };
}

// same thing, but for subscribe_, which must *synchronously*
// return a stream
function safeWrapSubscribe(subscribe, queryName) {
    return function () {
        const result = subscribe.apply(this, arguments);
        if (!(result instanceof stream.Readable))
            throw new ImplementationError(`The subscribe function for ${queryName} must return an instance of stream.Readable, got ${result}`);
        return result;
    };
}

module.exports = class ThingpediaModuleV2 extends BaseJavascriptModule {
    static get [Symbol.species]() {
        return ThingpediaModuleV2;
    }

    _completeLoading(module) {
        super._completeLoading(module);

        for (let action in this.manifest.actions) {
            if (typeof module.prototype['do_' + action] !== 'function')
                throw new ImplementationError(`Implementation for action ${action} missing`);
            module.prototype['do_' + action] = safeWrapAction(module.prototype['do_' + action]);
        }
        for (let query in this.manifest.queries) {
            const pollInterval = this.manifest.queries[query].poll_interval;
            if (pollInterval === 0 && typeof module.prototype['subscribe_' + query] !== 'function')
                throw new ImplementationError(`Poll interval === 0 but no subscribe function was found`);
            if (typeof module.prototype['get_' + query] !== 'function')
                throw new ImplementationError(`Implementation for query ${query} missing`);

            module.prototype['get_' + query] = safeWrapQuery(module.prototype['get_' + query], query);
            if (!module.prototype['subscribe_' + query]) {
                if (pollInterval > 0) {
                    module.prototype['subscribe_' + query] = function(params, state, filter) {
                        return new Tp.Helpers.PollingStream(state, pollInterval, () => this['get_' + query](params));
                    };
                } else if (pollInterval < 0) {
                    module.prototype['subscribe_' + query] = function(params, state, filter) {
                        throw new Error('This query is non-deterministic and cannot be monitored');
                    };
                }
            } else {
                module.prototype['subscribe_' + query] = safeWrapSubscribe(module.prototype['subscribe_' + query], query);
            }
            if (!module.prototype['history_' + query]) {
                module.prototype['history_' + query] = function(params, base, delta, filters) {
                    return null; // no history
                };
            }
            if (!module.prototype['sequence_' + query]) {
                module.prototype['sequence_' + query] = function(params, base, limit, filters) {
                    return null; // no sequence history
                };
            }
        }
    }
};
