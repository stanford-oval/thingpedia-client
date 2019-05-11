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
        const kind = this._id;

        const config = this._manifest.config;

        const isNoneFactory = config.module === 'org.thingpedia.config.none';
        const isNoneAuth = config.module === 'org.thingpedia.config.form';

        let params = [];
        if (config.module === 'org.thingpedia.config.form')
            params = Utils.findMixinArg(config, 'params');
        else if (config.module === 'org.thingpedia.config.oauth2')
            params = Utils.findMixinArg(config, 'profile') || [];

        const name = this._manifest.metadata.name;
        const description = this._manifest.metadata.description;

        this._loaded = class GenericDevice extends Tp.BaseDevice {
            constructor(engine, state) {
                super(engine, state);

                if (isNoneFactory)
                    this.uniqueId = kind;
                else if (isNoneAuth)
                    this.uniqueId = kind + '-' + params.map((k) => (k + '-' + state[k])).join('-');
                else
                    this.uniqueId = undefined; // let DeviceDatabase pick something

                this.params = params.map((k) => state[k]);
                if (name !== undefined)
                    this.name = Utils.formatString(name, this.state);
                if (description !== undefined)
                    this.description = Utils.formatString(description, this.state);
            }

            checkAvailable() {
                return Tp.BaseDevice.Availability.AVAILABLE;
            }
        };
        if (config.module === 'org.thingpedia.config.oauth2')
            Utils.makeGenericOAuth(kind, config, this._loaded);

        this._loaded.metadata = Utils.makeBaseDeviceMetadata(this._manifest);
    }

    get id() {
        return this._id;
    }
    get manifest() {
        return this._manifest;
    }
    get version() {
        return this._manifest.annotations.version.toJS();
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
