// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2018 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See LICENSE for details
"use strict";

const assert = require('assert');

const Tp = require('thingpedia');

const ModuleDownloader = require('../lib/downloader');

const { mockClient, mockPlatform } = require('./mock');

const Builtins = {
    'org.thingpedia.builtin.foo': {
        class: `class @org.thingpedia.builtin.foo {
            import loader from @org.thingpedia.builtin();
            import config from @org.thingpedia.config.none();

            query get(out something : String);
        }`,
        module: class FooBuiltin extends Tp.BaseDevice {
            constructor(engine, state) {
                super(engine, state);
                this.name = "Foo";
                this.description = "Foo description";
                this.uniqueId = 'org.thingpedia.builtin.foo';
            }

            async get_get() {
                return [{ something: 'lol' }];
            }
        }
    }
};

async function testBasic() {
    const downloader = new ModuleDownloader(mockPlatform, mockClient, Builtins);
    const module = await downloader.getModule('org.thingpedia.builtin.foo');

    assert.strictEqual(module.id, 'org.thingpedia.builtin.foo');
    assert.strictEqual(module.version, 0); // regardless of what the class code says
    assert.strictEqual(await module.getDeviceFactory(), Builtins['org.thingpedia.builtin.foo'].module);
}

async function main() {
    await testBasic();
}
module.exports = main;
if (!module.parent)
    main();
