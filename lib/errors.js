// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2018 Google LLC
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See LICENSE for details
"use strict";

class ImplementationError extends Error {
    constructor(msg) {
        super(`Implementation Error: ${msg}`);
    }
}

class UnsupportedError extends Error {
    constructor() {
        super(`This command is not available in this version of Almond`);
        this.code = 'ENOSYS';
    }
}

module.exports = { ImplementationError, UnsupportedError };
