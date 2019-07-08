// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2018 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const BaseClient = require('./lib/base_client');
const HttpClient = require('./lib/http_client');
const DeviceFactory = require('./lib/factory');
const ModuleDownloader = require('./lib/downloader');
const Modules = require('./lib/loaders');
const { ImplementationError, UnsupportedError } = require('./lib/errors');

module.exports = {
    BaseClient,
    HttpClient,
    DeviceFactory,

    // low-level semi-private API, exposed primarily for testing
    ModuleDownloader,
    Modules,

    // expose errors
    ImplementationError,
    UnsupportedError,
};
