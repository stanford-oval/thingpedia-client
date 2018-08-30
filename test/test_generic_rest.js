// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2018 The Board of Trustees of the Leland Stanford Junior University
//                Google LLC
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See LICENSE for details
"use strict";

const assert = require('assert');
const Tp = require('thingpedia');

const { mockClient, mockPlatform, mockEngine, State } = require('./mock');
const { ImplementationError } = require('../lib/modules/errors');

const Modules = require('../lib/modules');
const ModuleDownloader = require('../lib/downloader');

async function testPoll(instance, fn) {
    await new Promise((resolve, reject) => {
        let finished = false;
        setTimeout(() => {
            if (finished)
                resolve();
            else
                reject(new assert.AssertionError('Timed out'));
        }, 20000);

        const stream = instance['subscribe_' + fn]({}, new State);
        let count = 0;
        stream.on('data', (data) => {
            try {
                if (finished)
                    assert.fail('too many results');
                delete data.__timestamp;
                assert.deepStrictEqual(data, {
                    url: 'https://httpbin.org/get',
                    user_agent: "Thingpedia/1.0.0 nodejs/" + process.version
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
}

async function testBasic() {
    const metadata = await mockClient.getDeviceCode('org.httpbin');

    const downloader = new ModuleDownloader(mockPlatform, mockClient);
    const module = new (Modules['org.thingpedia.generic_rest.v1'])('org.httpbin', metadata, downloader);

    assert.strictEqual(module.id, 'org.httpbin');
    assert.strictEqual(module.version, 1);

    const factory = await module.getDeviceFactory();

    assert(factory.prototype instanceof Tp.BaseDevice);
    assert.strictEqual(typeof factory.prototype.get_get, 'function');
    assert.strictEqual(typeof factory.prototype.subscribe_get, 'function');

    const instance = new factory(mockEngine, {});
    assert.deepStrictEqual(await instance.get_get({}), [{
        url: 'https://httpbin.org/get',
        user_agent: "Thingpedia/1.0.0 nodejs/" + process.version
    }]);
    await testPoll(instance, 'get');

    assert.deepStrictEqual(await instance.get_get_nomonitor({}), [{
        url: 'https://httpbin.org/get',
        user_agent: "Thingpedia/1.0.0 nodejs/" + process.version
    }]);
    assert.strictEqual(typeof factory.prototype.subscribe_get_nomonitor, 'function');
    assert.throws(() => instance.subscribe_get_nomonitor({}, new State));

    assert.deepStrictEqual(await instance.get_get_poll_compat({}), [{
        url: 'https://httpbin.org/get',
        user_agent: "Thingpedia/1.0.0 nodejs/" + process.version
    }]);
    await testPoll(instance, 'get_poll_compat');

    assert.deepStrictEqual(await instance.get_get_args({ input: 'foo' }), [{
        output: 'foo'
    }]);
    assert.deepStrictEqual(await instance.get_get_args({ input: 'bar' }), [{
        output: 'bar'
    }]);

    assert.deepStrictEqual(await instance.get_post_query({ input: 'foo' }), [{
        url: 'https://httpbin.org/post',
        output: 'foo'
    }]);
    assert.deepStrictEqual(await instance.get_post_query({ input: 'bar' }), [{
        url: 'https://httpbin.org/post',
        output: 'bar'
    }]);

    await instance.do_post_action({ input: 'foo' });
    await instance.do_put_action({ input: 'foo' });
}

function assertIsGetter(object, prop, { configurable, enumerable }) {
    const descriptor = Object.getOwnPropertyDescriptor(object, prop);
    assert.strictEqual(typeof descriptor.value, 'undefined');
    assert.strictEqual(typeof descriptor.get, 'function');
    assert.strictEqual(descriptor.configurable, configurable);
    assert.strictEqual(descriptor.enumerable, enumerable);
}

async function testOAuth() {
    const metadata = await mockClient.getDeviceCode('org.httpbin.oauth');

    const downloader = new ModuleDownloader(mockPlatform, mockClient);
    const module = new (Modules['org.thingpedia.generic_rest.v1'])('org.httpbin.oauth', metadata, downloader);

    assert.strictEqual(module.id, 'org.httpbin.oauth');
    assert.strictEqual(module.version, 1);

    const factory = await module.getDeviceFactory();

    assertIsGetter(factory.prototype, 'accessToken', {
        configurable: false,
        enumerable: true
    });
    assertIsGetter(factory.prototype, 'refreshToken', {
        configurable: false,
        enumerable: true
    });

    const instance = new factory(mockEngine, { accessToken: 'my-example-token' });
    assert.deepStrictEqual(await instance.get_get({}), [{
        authenticated: true,
        token: 'my-example-token',
    }]);
}

async function testBasicAuth() {
    const metadata = await mockClient.getDeviceCode('org.httpbin.basicauth');

    const downloader = new ModuleDownloader(mockPlatform, mockClient);
    const module = new (Modules['org.thingpedia.generic_rest.v1'])('org.httpbin.basicauth', metadata, downloader);

    assert.strictEqual(module.id, 'org.httpbin.basicauth');
    assert.strictEqual(module.version, 1);

    const factory = await module.getDeviceFactory();

    const instance1 = new factory(mockEngine, { username: 'fake-user', password: 'fake-password1' });
    assert.deepStrictEqual(await instance1.get_get({ input: 'fake-password1' }), [{
        authenticated: true,
        user: 'fake-user',
    }]);

    const instance2 = new factory(mockEngine, { username: 'fake-user', password: 'fake-password2' });
    assert.deepStrictEqual(await instance2.get_get({ input: 'fake-password2' }), [{
        authenticated: true,
        user: 'fake-user',
    }]);
}

async function testBroken() {
    // test that devices with developer errors report sensible, localized and easy to
    // understand errors

    const downloader = new ModuleDownloader(mockPlatform, mockClient);

    const metadata = await mockClient.getDeviceCode('org.httpbin.broken');
    const module = new (Modules['org.thingpedia.generic_rest.v1'])('org.httpbin.broken', metadata, downloader);

    // assert that we cannot actually load this device
    await assert.rejects(() => module.getDeviceFactory(), ImplementationError);
}

async function main() {
    await testBasic();
    await testOAuth();
    await testBasicAuth();
    await testBroken();
}

module.exports = main;
if (!module.parent)
    main();
