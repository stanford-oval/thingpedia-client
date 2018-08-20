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
const path = require('path');
const child_process = require('child_process');
const os = require('os');

const Modules = require('../lib/modules');
const ModuleDownloader = require('../lib/downloader');

const MyDevice = require('./device-classes/org.thingpedia.test.mydevice');

const _unzipApi = {
    unzip(zipPath, dir) {
        var args = ['-uo', zipPath, '-d', dir];
        return new Promise((resolve, reject) => {
            child_process.execFile('/usr/bin/unzip', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err)
                    reject(err);
                else
                    resolve([stdout, stderr]);
            });
        }).then(([stdout, stderr]) => {
            console.log('stdout', stdout);
            console.log('stderr', stderr);
        });
    }
};

const mockPlatform = {
    getCacheDir() {
        return path.dirname(module.filename);
    },
    getTmpDir() {
        return os.tmpdir();
    },
    hasCapability(cap) {
        switch (cap) {
        case 'code-download':
            return true;
        default:
            return false;
        }
    },
    getCapability(cap) {
        switch (cap) {
        case 'code-download':
            return _unzipApi;
        default:
            return null;
        }
    }
};

const mockClient = {
    async getModuleLocation(id) {
        if (id === 'com.xkcd')
            return 'https://d1ge76rambtuys.cloudfront.net/devices/com.xkcd-v91.zip';
        else
            throw new Error('invalid id');
    },

    async getDeviceCode(kind) {
        switch (kind) {
        case 'org.thingpedia.test.mydevice':
        case 'org.thingpedia.test.collection':
        case 'org.thingpedia.test.subdevice':
        case 'com.xkcd':
            return require('./device-classes/' + kind + '.manifest.json');
        default:
            assert.fail('Invalid device ' + kind);
            // quiet eslint
            return null;
        }
    }
};

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

    const engine = {};
    const d = new factory(engine, { kind: 'org.thingpedia.test.mydevice' });
    assert.strictEqual(typeof d.get_something, 'function');
    assert.strictEqual(typeof d.get_something_poll, 'function');
    assert.strictEqual(typeof d.subscribe_something, 'function');
    assert.strictEqual(typeof d.subscribe_something_poll, 'function');
    assert.strictEqual(typeof d.history_something, 'function');
    assert.strictEqual(typeof d.history_something_poll, 'function');
    assert.strictEqual(typeof d.sequence_something, 'function');
    assert.strictEqual(typeof d.sequence_something_poll, 'function');
    assert.strictEqual(typeof d.do_something_else, 'function');

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