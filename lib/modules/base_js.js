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

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const stream = require('stream');

const Module = require('module');

const Tp = require('thingpedia');

const { makeGenericOAuth } = require('./utils');
const { ImplementationError } = require('./errors');

// shared code between all modules with custom JS

function resolve(mainModule) {
    if (!mainModule.startsWith('/'))
        throw new Error('Invalid relative module path');
    if (require.resolve)
        return require.resolve(mainModule);
    else
        return Module._resolveFilename(mainModule, module, false);
}

function clearRequireCache(mainModule) {
    try {
        var fileName = resolve(mainModule);
        console.log(mainModule + ' was cached as ' + fileName);

        delete require.cache[fileName];

        var prefix = path.dirname(fileName) + '/';
        for (var key in require.cache) {
            if (key.startsWith(prefix))
                delete require.cache[key];
        }
    } catch(e) {
        // do nothing
    }
}

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


module.exports = class BaseJavascriptModule {
    constructor(id, manifest, loader) {
        assert(id);
        assert(manifest);
        assert(loader);
        assert(typeof manifest.version === 'number');

        this._loader = loader;
        this._client = loader.client;
        this._platform = loader.platform;
        this._cacheDir = loader.platform.getCacheDir() + '/device-classes';
        this._id = id;
        this._manifest = manifest;

        this._loading = null;
        this._modulePath = null;
    }

    get id() {
        return this._id;
    }
    get manifest() {
        return this._manifest;
    }
    get version() {
        return this._manifest.version;
    }
    get package_version() {
        return this._manifest.package_version;
    }

    clearCache() {
        this._loading = null;

        if (this._modulePath)
            clearRequireCache(this._modulePath);
    }

    _createSubmodule(id, manifest, deviceClass) {
        const submodule = new (this.constructor[Symbol.species])(id, manifest, this._loader);
        submodule._loading = deviceClass;
        submodule._completeLoading(deviceClass);

        return submodule;
    }

    _completeLoading(deviceClass) {
        deviceClass.metadata = this._manifest;

        if (this._manifest.auth.type === 'oauth2' && !deviceClass.runOAuth2)
            makeGenericOAuth(this._id, this._manifest, deviceClass);
        else if (deviceClass.runOAuth2 && deviceClass.runOAuth2.install)
            deviceClass.runOAuth2.install(deviceClass.prototype);

        for (let action in this.manifest.actions) {
            if (typeof module.prototype['do_' + action] !== 'function')
                throw new ImplementationError(`Implementation for action ${action} missing`);
            deviceClass.prototype['do_' + action] = safeWrapAction(module.prototype['do_' + action]);
        }
        for (let query in this.manifest.queries) {
            const pollInterval = this.manifest.queries[query].poll_interval;
            if (pollInterval === 0 && typeof module.prototype['subscribe_' + query] !== 'function')
                throw new ImplementationError(`Poll interval === 0 but no subscribe function was found`);
            if (typeof deviceClass.prototype['get_' + query] !== 'function')
                throw new ImplementationError(`Implementation for query ${query} missing`);

            deviceClass.prototype['get_' + query] = safeWrapQuery(module.prototype['get_' + query], query);
            if (!deviceClass.prototype['subscribe_' + query]) {
                if (pollInterval > 0) {
                    deviceClass.prototype['subscribe_' + query] = function(params, state, filter) {
                        return new Tp.Helpers.PollingStream(state, pollInterval, () => this['get_' + query](params));
                    };
                } else if (pollInterval < 0) {
                    deviceClass.prototype['subscribe_' + query] = function(params, state, filter) {
                        throw new Error('This query is non-deterministic and cannot be monitored');
                    };
                }
            } else {
                deviceClass.prototype['subscribe_' + query] = safeWrapSubscribe(module.prototype['subscribe_' + query], query);
            }
            if (!deviceClass.prototype['history_' + query]) {
                deviceClass.prototype['history_' + query] = function(params, base, delta, filters) {
                    return null; // no history
                };
            }
            if (!deviceClass.prototype['sequence_' + query]) {
                deviceClass.prototype['sequence_' + query] = function(params, base, limit, filters) {
                    return null; // no sequence history
                };
            }
        }
    }

    _loadJsModule(id) {
        var modulePath = this._modulePath;
        var version = JSON.parse(fs.readFileSync(modulePath + '/package.json').toString('utf8'))['thingpedia-version'];
        if (version !== this._manifest.package_version) {
            console.log(`Cached module ${this.id} is out of date (found ${version}, want ${this._manifest.package_version})`);
            return null;
        }

        var deviceClass = require(modulePath);
        deviceClass.require = function(subpath) {
            return require(path.resolve(modulePath, subpath));
        };
        try {
            this._completeLoading(deviceClass);
        } catch(e) {
            return Promise.reject(e);
        }

        const subdevices = deviceClass.subdevices || {};
        return Promise.all((this.manifest.child_types || []).map((childId) => {
            if (!(childId in subdevices)) {
                console.error(`Child device ${childId} is not declared in ${deviceClass.name}.subdevices, this will cause unexpected behavior`);
                return Promise.resolve();
            }

            return this._loader.loadManifest(childId, true).then((childManifest) => {
                const submodule = this._createSubmodule(childId, childManifest, subdevices[childId]);
                this._loader.injectModule(childId, submodule);
            });
        })).then(() => {
            this._loading = deviceClass;
            return deviceClass;
        });
    }

    getDeviceFactory() {
        if (this._loading)
            return Promise.resolve(this._loading);

        this._modulePath = path.resolve(process.cwd(), this._cacheDir + '/' + this._id);

        if (fs.existsSync(this._modulePath)) {
            var cached = this._loadJsModule();
            if (cached)
                return Promise.resolve(this._loading = cached);
        }

        return this._loading = Promise.resolve(this._client.getModuleLocation(this._id, this._manifest.version))
        .then((redirect) => Tp.Helpers.Http.getStream(redirect))
        .then((response) => new Promise((resolve, reject) => {
                tmp.file({ mode: 0o600,
                           keep: true,
                           dir: this._platform.getTmpDir(),
                           prefix: 'thingengine-' + this._id + '-',
                           postfix: '.zip' }, (err, path, fd, cleanup) => {
                    if (err)
                        reject(err);
                    else
                        resolve([path, fd, cleanup]);
                });
            }).then(([path, fd]) => {
                var stream = fs.createWriteStream('', { fd, flags: 'w' });

                return new Promise((callback, errback) => {
                    response.pipe(stream);
                    stream.on('finish', () => {
                        callback(path);
                    });
                    stream.on('error', errback);
                });
            })
        ).then((zipPath) => {
            try {
                fs.mkdirSync(this._modulePath);
            } catch(e) {
                if (e.code !== 'EEXIST')
                    throw e;
            }

            var unzip = this._platform.getCapability('code-download');
            return unzip.unzip(zipPath, this._modulePath).then(() => {
                fs.unlinkSync(zipPath);
            });
        }).then(() => this._loadJsModule()).catch((e) => {
            this._loading = null;
            throw e;
        });
    }
};
