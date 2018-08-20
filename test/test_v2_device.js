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
const child_process = require('child_process');

const Modules = require('../lib/modules');
const ModuleDownloader = require('../lib/downloader');

const MyDevice = require('./device-classes/org.thingpedia.test.mydevice');
const { mockClient, mockPlatform, mockEngine, State } = require('./mock');

async function testDownloader() {
    const metadata = await mockClient.getDeviceCode('org.thingpedia.test.mydevice');

    const downloader = new ModuleDownloader(mockPlatform, mockClient);
    const module = await downloader.getModule('org.thingpedia.test.mydevice');

    assert.strictEqual(module.id, 'org.thingpedia.test.mydevice');
    assert.strictEqual(module.version, 1);
    assert.deepStrictEqual(module.manifest, metadata);
}

async function testPreloaded() {
    const metadata = await mockClient.getDeviceCode('org.thingpedia.test.mydevice');

    const downloader = new ModuleDownloader(mockPlatform, mockClient);
    const module = new (Modules['org.thingpedia.v2'])('org.thingpedia.test.mydevice', metadata, downloader);

    assert.strictEqual(module.id, 'org.thingpedia.test.mydevice');
    assert.strictEqual(module.version, 1);
    assert.strictEqual(module.manifest, metadata);

    const factory = await module.getDeviceFactory();

    assert.strictEqual(factory, MyDevice);
    assert.strictEqual(factory.metadata, metadata);
    assert.deepStrictEqual(factory.require('package.json'), {"name":"org.thingpedia.test.mydevice",
        "main": "index.js",
        "thingpedia-version":1
    });

    const d = new factory(mockEngine, { kind: 'org.thingpedia.test.mydevice' });
    assert.strictEqual(typeof d.get_something, 'function');
    assert.strictEqual(typeof d.get_something_poll, 'function');
    assert.strictEqual(typeof d.subscribe_something, 'function');
    assert.strictEqual(typeof d.subscribe_something_poll, 'function');
    assert.strictEqual(typeof d.history_something, 'function');
    assert.strictEqual(typeof d.history_something_poll, 'function');
    assert.strictEqual(typeof d.sequence_something, 'function');
    assert.strictEqual(typeof d.sequence_something_poll, 'function');
    assert.strictEqual(typeof d.do_something_else, 'function');

    assert.deepStrictEqual(d.get_something(), [
        {v1: 'foo', v2: 42}
    ]);
    await new Promise((resolve, reject) => {
        let finished = false;
        setTimeout(() => {
            if (finished)
                resolve();
            else
                reject(new assert.AssertionError('Timed out'));
        }, 5000);

        const stream = d.subscribe_something({}, new State);
        let expect = 42;
        stream.on('data', (data) => {
            try {
                if (finished)
                    assert.fail('too many results');
                delete data.__timestamp;
                assert.deepStrictEqual(data, {
                    v1: 'foo',
                    v2: expect
                });
                expect ++;
                if (expect === 44) {
                    stream.destroy();
                    finished = true;
                }
            } catch(e) { reject(e); }
        });
        stream.on('end', () => {
            reject(new assert.AssertionError('Stream ended unexpected'));
        });
    });
    await new Promise((resolve, reject) => {
        let finished = false;
        setTimeout(() => {
            if (finished)
                resolve();
            else
                reject(new assert.AssertionError('Timed out'));
        }, 5000);

        const stream = d.subscribe_something_poll({}, new State);
        let count = 0;
        stream.on('data', (data) => {
            try {
                if (finished)
                    assert.fail('too many results');
                delete data.__timestamp;
                assert.deepStrictEqual(data, {
                    v1: 'foo',
                    v2: 42
                });
                count++;
                if (count === 2) {
                    stream.destroy();
                    finished = true;
                }
            } catch(e) { reject(e); }
        });
        stream.on('end', () => {
            reject(new assert.AssertionError('Stream ended unexpected'));
        });
    });
    assert.throws(() => {
        d.subscribe_something_nomonitor();
    });

    await module.clearCache();

    const factory2 = await module.getDeviceFactory();
    assert(factory2 !== MyDevice);
}

async function testSubdevice() {
    const collectionMetadata = await mockClient.getDeviceCode('org.thingpedia.test.collection');
    const subMetadata = await mockClient.getDeviceCode('org.thingpedia.test.subdevice');

    const downloader = new ModuleDownloader(mockPlatform, mockClient);

    const collectionModule = new (Modules['org.thingpedia.v2'])('org.thingpedia.test.collection',
                                                                collectionMetadata,
                                                                downloader);
    assert.strictEqual(collectionModule.id, 'org.thingpedia.test.collection');

    // this will also load the subdevices
    const collectionFactory = await collectionModule.getDeviceFactory();

    assert.strictEqual(typeof collectionFactory.prototype.get_get_data, 'undefined');
    assert.strictEqual(typeof collectionFactory.prototype.do_eat_data, 'undefined');

    const subFactory = collectionFactory.subdevices['org.thingpedia.test.subdevice'];

    // cannot use strictEqual here because the module is instantiated by the downloader,
    // not by us, so it will be a different object
    assert.deepStrictEqual(subFactory.metadata, subMetadata);

    assert.strictEqual(typeof subFactory.prototype.get_get_data, 'function');
    assert.strictEqual(typeof subFactory.prototype.do_eat_data, 'function');
}

async function testThingpedia() {
    child_process.spawnSync('rm', ['-rf', mockPlatform.getCacheDir() + '/device-classes/com.xkcd']);

    const metadata = await mockClient.getDeviceCode('com.xkcd');
    const downloader = new ModuleDownloader(mockPlatform, mockClient);

    const module = new (Modules['org.thingpedia.v2'])('com.xkcd', metadata, downloader);

    assert.strictEqual(module.id, 'com.xkcd');
    assert(module.version >= 91);
    assert.strictEqual(module.manifest, metadata);

    const factory = await module.getDeviceFactory();

    assert.strictEqual(factory.metadata, metadata);
    assert.strictEqual(typeof factory.prototype.get_get_comic, 'function');
    assert.strictEqual(typeof factory.prototype.subscribe_get_comic, 'function');
    assert.strictEqual(typeof factory.prototype.get_random_comic, 'function');
    assert.strictEqual(typeof factory.prototype.subscribe_random_comic, 'function');
}

async function main() {
    await testPreloaded();
    await testSubdevice();
    await testThingpedia();
    await testDownloader();
}
module.exports = main;
if (!module.parent)
    main();