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
const Utils = require('./utils');

module.exports = class BaseGenericModule {
    constructor(kind, ast) {
        this._id = kind;
        this._manifest = ast;
        this._loaded = null;
    }

    _loadModule() {
        const ast = this._manifest;
        const kind = this._id;

        const isNoneFactory = ast.auth.type === 'none' && Object.keys(ast.params).length === 0;
        const isNoneAuth = ast.auth.type === 'none';
        this._loaded = class GenericDevice extends Tp.BaseDevice {
            constructor(engine, state) {
                super(engine, state);

                let params = Object.keys(ast.params);
                if (isNoneFactory)
                    this.uniqueId = kind;
                else if (isNoneAuth)
                    this.uniqueId = kind + '-' + params.map((k) => (k + '-' + state[k])).join('-');
                else
                    this.uniqueId = undefined; // let DeviceDatabase pick something

                if (ast.auth.type === 'oauth2' && Array.isArray(ast.auth.profile))
                    params = params.concat(ast.auth.profile);

                this.params = params.map((k) => state[k]);
                if (ast.name !== undefined)
                    this.name = Utils.formatString(ast.name, this.state);
                if (ast.description !== undefined)
                    this.description = Utils.formatString(ast.description, this.state);
            }

            checkAvailable() {
                return Tp.BaseDevice.Availability.AVAILABLE;
            }
        };
        if (ast.auth.type === 'oauth2')
            Utils.makeGenericOAuth(kind, ast, this._loaded);

        this._loaded.metadata = ast;
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

    clearCache() {
        // nothing to do here
    }

    getDeviceFactory() {
        if (this._loaded === null) {
            try {
                this._loadModule();
            } catch(e) {
                this._loaded = null;
                return Promise.reject(e);
            }
        }
        return Promise.resolve(this._loaded);
    }
};
