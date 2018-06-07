// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

module.exports = class ThingpediaClientBase {
    constructor(platform) {
        this.platform = platform;
    }

    get developerKey() {
        return this.platform.getDeveloperKey();
    }

    get locale() {
        return this.platform.locale;
    }

    /* istanbul ignore next */
    getModuleLocation(id) {
        throw new Error('not implemented');
    }

    getDeviceCode(id) {
        throw new Error('not implemented');
    }

    getSchemas(kinds) {
        throw new Error('not implemented');
    }

    getMetas(kinds) {
        throw new Error('not implemented');
    }

    getDeviceList(klass, page, page_size) {
        throw new Error('not implemented');
    }

    getDeviceFactories(klass) {
        throw new Error('not implemented');
    }

    getDeviceSetup2(kinds) {
        throw new Error('not implemented');
    }

    getDeviceSetup(kinds) {
        throw new Error('not implemented');
    }

    getKindByDiscovery(publicData) {
        throw new Error('not implemented');
    }

    getExamplesByKey(key) {
        throw new Error('not implemented');
    }

    getExamplesByKinds(kinds) {
        throw new Error('not implemented');
    }

    clickExample(exampleId) {
        throw new Error('not implemented');
    }
};
