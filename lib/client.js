// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const lang = require('lang');

module.exports = new lang.Class({
    Name: 'ThingPediaClientBase',
    Abstract: true,

    _init: function(developerKey) {
        this.developerKey = developerKey;
    },

    getModuleLocation: function() {
        throw new TypeError('Abstract method');
    },

    getDeviceCode: function() {
        throw new TypeError('Abstract method');
    },

    getSchemas: function() {
        throw new TypeError('Abstract method');
    },

    getKindByDiscovery: function() {
        throw new TypeError('Abstract method');
    }
});
