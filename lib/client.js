// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');

module.exports = class ThingPediaClientBase {
    constructor(developerKey) {
        this.developerKey = developerKey;
    }

    getModuleLocation() {
        throw new TypeError('Abstract method');
    }

    getDeviceCode() {
        throw new TypeError('Abstract method');
    }

    getSchemas() {
        throw new TypeError('Abstract method');
    }

    getKindByDiscovery() {
        throw new TypeError('Abstract method');
    }
}
