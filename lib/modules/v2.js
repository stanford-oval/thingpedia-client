// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2017-2018 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See LICENSE for details
"use strict";

const BaseJavascriptModule = require('./base_js');

module.exports = class ThingpediaModuleV2 extends BaseJavascriptModule {
    static get [Symbol.species]() {
        return ThingpediaModuleV2;
    }
};
