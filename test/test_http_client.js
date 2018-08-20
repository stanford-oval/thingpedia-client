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

const assert = require('assert');

const HttpClient = require('../lib/http_client');

const _mockPlatform = {
    getDeveloperKey() {
        return null;
    },

    get locale() {
        return 'en-US';
    }
};
const _mockDeveloperPlatform = {
    getDeveloperKey() {
        if (!process.env.THINGENGINE_DEVELOPER_KEY)
            throw new Error('Invalid test setup: missing THINGENGINE_DEVELOPER_KEY');
        return process.env.THINGENGINE_DEVELOPER_KEY;
    },

    get locale() {
        return 'en-US';
    }
};
const THINGPEDIA_URL = process.env.THINGPEDIA_URL || 'https://thingpedia.stanford.edu/thingpedia';

const _httpClient = new HttpClient(_mockPlatform, THINGPEDIA_URL);
const _developerHttpClient = new HttpClient(_mockDeveloperPlatform, THINGPEDIA_URL);

function checkValidManifest(manifest, moduleType) {
    assert.strictEqual(manifest.module_type, moduleType);

    assert.ok(manifest.category);
    assert.ok(manifest.subcategory);
    assert(Array.isArray(manifest.types));
    assert(Array.isArray(manifest.child_types));
    assert(typeof manifest.auth === 'object');
    assert(typeof manifest.queries === 'object');
    assert(typeof manifest.actions === 'object');
    assert(manifest.name === undefined ||
           (typeof manifest.name === 'string' &&
            manifest.name !== ''));
    assert(manifest.description === undefined ||
           (typeof manifest.description === 'string' &&
            manifest.description !== ''));
    assert(typeof manifest.version === 'number');
}

async function testGetDeviceCode() {
    const nytimes = await _httpClient.getDeviceCode('com.nytimes');
    checkValidManifest(nytimes, 'org.thingpedia.rss');

    const bing = await _httpClient.getDeviceCode('com.bing');
    checkValidManifest(bing, 'org.thingpedia.v2');

    const test = await _httpClient.getDeviceCode('org.thingpedia.builtin.test');
    checkValidManifest(test, 'org.thingpedia.builtin');

    await assert.rejects(async () => {
        await _httpClient.getDeviceCode('org.thingpedia.builtin.test.invisible');
    });
    const invisibleTest = await _developerHttpClient.getDeviceCode('org.thingpedia.builtin.test.invisible');
    checkValidManifest(invisibleTest, 'org.thingpedia.builtin');

    await assert.rejects(async () => {
        await _httpClient.getDeviceCode('org.thingpedia.builtin.test.nonexistent');
    });
}

async function testGetModuleLocation() {
    const test = await _httpClient.getModuleLocation('org.thingpedia.builtin.test');
    assert(/^.*\/org\.thingpedia\.builtin\.test-v[0-9]+\.zip$/.test(test),
          'Invalid response, got ' + test);

    const test2 = await _developerHttpClient.getModuleLocation('org.thingpedia.builtin.test');
    assert(/^.*\/org\.thingpedia\.builtin\.test-v[0-9]+\.zip$/.test(test2),
          'Invalid response, got ' + test2);

    await assert.rejects(async () => {
        await _httpClient.getModuleLocation('org.thingpedia.builtin.test.invisible');
    });
    await _developerHttpClient.getModuleLocation('org.thingpedia.builtin.test.invisible');

    await assert.rejects(async () => {
        await _httpClient.getModuleLocation('org.thingpedia.builtin.test.nonexistent');
    });
}

async function testGetSchemas() {
    const single = await _httpClient.getSchemas(['com.bing']);

    assert.deepStrictEqual(typeof single['com.bing'], 'object');
    assert.deepStrictEqual(typeof single['com.bing'].queries, 'object');
    assert.deepStrictEqual(typeof single['com.bing'].actions, 'object');
    assert.deepStrictEqual(typeof single['com.bing'].queries['web_search'], 'object');
    assert.deepStrictEqual(typeof single['com.bing'].queries['image_search'], 'object');

    const multiple = await _httpClient.getSchemas(['com.bing', 'com.twitter']);

    assert.deepStrictEqual(typeof multiple['com.bing'], 'object');
    assert.deepStrictEqual(typeof multiple['com.twitter'], 'object');
    assert.deepStrictEqual(typeof multiple['com.twitter'].queries, 'object');
    assert.deepStrictEqual(typeof multiple['com.twitter'].actions, 'object');
    assert.deepStrictEqual(single['com.bing'], multiple['com.bing']);

    const invisible = await _httpClient.getSchemas(['org.thingpedia.builtin.test.invisible']);
    assert.deepStrictEqual(invisible, {
        'org.thingpedia.builtin.test.invisible': {
            kind_type: 'primary',
            triggers: {},
            queries: {},
            actions: {}
        }
    });
    const invisible2 = await _developerHttpClient.getSchemas(['org.thingpedia.builtin.test.invisible']);
    assert.deepStrictEqual(typeof invisible2['org.thingpedia.builtin.test.invisible'], 'object');
    assert.deepStrictEqual(typeof invisible2['org.thingpedia.builtin.test.invisible'].queries, 'object');
    assert.deepStrictEqual(typeof invisible2['org.thingpedia.builtin.test.invisible'].actions, 'object');
    assert.deepStrictEqual(typeof invisible2['org.thingpedia.builtin.test.invisible'].actions['eat_data'], 'object');

    const nonexistent = await _httpClient.getSchemas(['org.thingpedia.builtin.test.nonexistent']);
    assert.deepStrictEqual(nonexistent, {});

    const mixed = await _httpClient.getSchemas(['com.bing', 'org.thingpedia.builtin.test.invisible', 'org.thingpedia.builtin.test.nonexistent']);
    assert.deepStrictEqual(mixed, {
        'org.thingpedia.builtin.test.invisible': {
            kind_type: 'primary',
            triggers: {},
            queries: {},
            actions: {}
        },
        'com.bing': single['com.bing']
    });
}

function assertNonEmptyString(what) {
    assert(typeof what === 'string' && what, 'Expected a non-empty string, got ' + what);
}

function checkMetadata(what) {
    for (let name in what) {
        assertNonEmptyString(what[name].confirmation);
        assertNonEmptyString(what[name].canonical);
        assert.deepStrictEqual(typeof what[name].confirmation_remote, 'string');
        assert.deepStrictEqual(typeof what[name].is_list, 'boolean');
        assert.deepStrictEqual(typeof what[name].is_monitorable, 'boolean');
        assert(Array.isArray(what[name].args));
        assert(Array.isArray(what[name].schema));
        assert(Array.isArray(what[name].required));
        assert(Array.isArray(what[name].is_input));
        assert(Array.isArray(what[name].questions));
    }
}

async function testGetMetas() {
    const single = await _httpClient.getMetas(['com.bing']);

    assert.deepStrictEqual(typeof single['com.bing'], 'object');
    assert.deepStrictEqual(typeof single['com.bing'].queries, 'object');
    assert.deepStrictEqual(typeof single['com.bing'].actions, 'object');
    assert.deepStrictEqual(typeof single['com.bing'].queries['web_search'], 'object');
    assert.deepStrictEqual(typeof single['com.bing'].queries['image_search'], 'object');
    checkMetadata(single['com.bing'].queries);
    checkMetadata(single['com.bing'].actions);

    const multiple = await _httpClient.getMetas(['com.bing', 'com.twitter']);

    assert.deepStrictEqual(typeof multiple['com.bing'], 'object');
    assert.deepStrictEqual(typeof multiple['com.twitter'], 'object');
    assert.deepStrictEqual(typeof multiple['com.twitter'].queries, 'object');
    assert.deepStrictEqual(typeof multiple['com.twitter'].actions, 'object');
    assert.deepStrictEqual(single['com.bing'], multiple['com.bing']);

    const invisible = await _httpClient.getMetas(['org.thingpedia.builtin.test.invisible']);
    assert.deepStrictEqual(invisible, {
        'org.thingpedia.builtin.test.invisible': {
            kind_type: 'primary',
            triggers: {},
            queries: {},
            actions: {}
        }
    });
    const invisible2 = await _developerHttpClient.getMetas(['org.thingpedia.builtin.test.invisible']);
    assert.deepStrictEqual(typeof invisible2['org.thingpedia.builtin.test.invisible'], 'object');
    assert.deepStrictEqual(typeof invisible2['org.thingpedia.builtin.test.invisible'].queries, 'object');
    assert.deepStrictEqual(typeof invisible2['org.thingpedia.builtin.test.invisible'].actions, 'object');
    assert.deepStrictEqual(typeof invisible2['org.thingpedia.builtin.test.invisible'].actions['eat_data'], 'object');

    const nonexistent = await _httpClient.getMetas(['org.thingpedia.builtin.test.nonexistent']);
    assert.deepStrictEqual(nonexistent, {});

    const mixed = await _httpClient.getMetas(['com.bing', 'org.thingpedia.builtin.test.invisible', 'org.thingpedia.builtin.test.nonexistent']);
    assert.deepStrictEqual(mixed, {
        'org.thingpedia.builtin.test.invisible': {
            kind_type: 'primary',
            triggers: {},
            queries: {},
            actions: {}
        },
        'com.bing': single['com.bing']
    });
}

async function testGetDeviceList(klass) {
    const publicDevices = new Set;

    const { devices: page0 } = await _httpClient.getDeviceList(klass);

    // weird values for page are the same as ignored
    const { devices: pageMinusOne } = await _httpClient.getDeviceList(klass, -1);
    assert.deepStrictEqual(pageMinusOne, page0);
    const { devices: pageInvalid } = await _httpClient.getDeviceList(klass, 'invalid');
    assert.deepStrictEqual(pageInvalid, page0);

    for (let i = 0; ; i++) {
        const { devices: page } = await _httpClient.getDeviceList(klass, i, 10);
        if (i === 0)
            assert.deepStrictEqual(page, page0);
        for (let j = 0; j < Math.min(page.length, 10); j++) {
            const device = page[j];
            assertNonEmptyString(device.name);
            assertNonEmptyString(device.description);
            assertNonEmptyString(device.primary_kind);
            assertNonEmptyString(device.module_type);
            assertNonEmptyString(device.category);
            assertNonEmptyString(device.subcategory);
            if (klass)
                assert.deepStrictEqual(device.category, klass);

            assert.deepStrictEqual(typeof device.approved_version, 'number');
            assert.deepStrictEqual(typeof device.developer_version, 'number');

            // no duplicates
            assert(!publicDevices.has(device.primary_kind));
            publicDevices.add(device.primary_kind);
        }
        if (page.length <= 10)
            break;
    }

    const developerDevices = new Set;

    for (let i = 0; ; i++) {
        const { devices: page } = await _developerHttpClient.getDeviceList(klass, i, 10);
        for (let j = 0; j < Math.min(page.length, 10); j++) {
            const device = page[j];
            assert(!developerDevices.has(device.primary_kind));
            developerDevices.add(device.primary_kind);

            // every developer device should be a public device if
            // the approved version is not null
            // this is a quick and dirty way to catch pagination errors
            if (device.approved_version !== null) {
                assert(publicDevices.has(device.primary_kind),
                       'Lost device ' + device.primary_kind);
            }
        }
        if (page.length <= 10)
            break;
    }

    // every public device should be a developer device
    // this is a quick and dirty way to catch pagination errors
    for (let pubDevice of publicDevices) {
        assert(developerDevices.has(pubDevice),
               'Lost device ' + pubDevice);
    }
}

async function testGetDeviceListErrorCases() {
    await assert.rejects(() => _httpClient.getDeviceList('foo'));
}

async function testGetDeviceFactories(klass) {
    const devices = await _httpClient.getDeviceFactories(klass);

    for (let device of devices) {
        const factory = device.factory;
        assertNonEmptyString(factory.kind);
        assertNonEmptyString(factory.text);
        assert(['none', 'discovery', 'interactive', 'form', 'oauth2'].indexOf(factory.type) >= 0, 'Invalid factory type ' + factory.type + ' for ' + factory.kind);
    }
}

async function testGetDeviceFactoriesErrorCases() {
    await assert.rejects(() => _httpClient.getDeviceFactories('foo'));
}

async function testGetDeviceSetup() {
    const single = await _httpClient.getDeviceSetup(['com.bing']);

    assert.deepStrictEqual(single, {
        'com.bing': {
            kind: 'com.bing',
            category: 'data',
            type: 'none',
            text: "Bing Search"
        }
    });

    const single2 = await _httpClient.getDeviceSetup2(['com.bing']);
    assert.deepStrictEqual(single, single2);

    // note: the difference between getDeviceSetup and getDeviceSetup2
    // occurs only in edge cases that cannot trigger with the current
    // Thingpedia

    const multiple = await _httpClient.getDeviceSetup(['com.bing', 'com.twitter']);
    assert.deepStrictEqual(multiple, {
        'com.bing': {
            kind: 'com.bing',
            category: 'data',
            type: 'none',
            text: "Bing Search"
        },
        'com.twitter': {
            kind: 'com.twitter',
            category: 'online',
            type: 'oauth2',
            text: "Twitter Account"
        }
    });

    const nosetup = await _httpClient.getDeviceSetup(['com.bing', 'org.thingpedia.builtin.test']);
    assert.deepStrictEqual(nosetup, {
        'com.bing': {
            kind: 'com.bing',
            category: 'data',
            type: 'none',
            text: "Bing Search"
        },
        'org.thingpedia.builtin.test': {
            type: 'multiple',
            choices: []
        }
    });

    const nonexistent = await _httpClient.getDeviceSetup(['org.thingpedia.builtin.test.nonexistent']);
    assert.deepStrictEqual(nonexistent, {
        'org.thingpedia.builtin.test.nonexistent': {
            type: 'multiple',
            choices: []
        }
    });
}

async function testGetKindByDiscovery() {
    // malformed requests
    await assert.rejects(() => _httpClient.getKindByDiscovery({}));
    await assert.rejects(() => _httpClient.getKindByDiscovery({
        kind: 'invalid'
    }));
    await assert.rejects(() => _httpClient.getKindByDiscovery({
        kind: 'bluetooth',
        uuids: null,
        class: null
    }));

    const bluetoothSpeaker = await _httpClient.getKindByDiscovery({
        kind: 'bluetooth',
        uuids: ['0000110b-0000-1000-8000-00805f9b34fb'],
        class: 0
    });
    assert.deepStrictEqual(bluetoothSpeaker, 'org.thingpedia.bluetooth.speaker.a2dp');

    const genericBluetooth = await _httpClient.getKindByDiscovery({
        kind: 'bluetooth',
        uuids: [],
        class: 0
    });
    assert.deepStrictEqual(genericBluetooth, 'org.thingpedia.builtin.bluetooth.generic');

    const lgTv = await _httpClient.getKindByDiscovery({
        kind: 'upnp',
        name: '',
        deviceType: '',
        modelUrl: null,
        st: ['urn:lge:com:service:webos:second-screen-1'],
        class: 0
    });
    assert.deepStrictEqual(lgTv, 'com.lg.tv.webos2');

    assert.rejects(() => _httpClient.getKindByDiscovery({
        kind: 'upnp',
        name: '',
        deviceType: '',
        modelUrl: null,
        st: ['urn:thingpedia.com:invalid'],
        class: 0
    }));
}

async function testGetExamples() {
    function checkKinds(program, kinds) {
        let regexp = /@(?:[a-zA-Z_-]+\.)+[a-zA-Z_-]/g;

        let match = regexp.exec(program);
        while (match !== null) {
            let kind = match[0].substring(1, match[0].lastIndexOf('.'));
            assert(kinds.indexOf(kind) >= 0, 'Unexpected kind ' + kind);

            match = regexp.exec(program);
        }
    }

    const byKey = await _httpClient.getExamplesByKey('twitter');

    for (let ex of byKey) {
        assert.deepStrictEqual(typeof ex.id, 'number');
        assert.deepStrictEqual(ex.language, 'en');
        assertNonEmptyString(ex.utterance);
        assertNonEmptyString(ex.preprocessed);
        assertNonEmptyString(ex.target_code);
    }

    const byKindsSingle = await _httpClient.getExamplesByKinds(['com.twitter']);
    for (let ex of byKindsSingle) {
        assert.deepStrictEqual(typeof ex.id, 'number');
        assert.deepStrictEqual(ex.language, 'en');
        assertNonEmptyString(ex.utterance);
        assertNonEmptyString(ex.preprocessed);
        assertNonEmptyString(ex.target_code);
        checkKinds(ex.target_code, ['com.twitter']);
    }

    const byKindsMultiple = await _httpClient.getExamplesByKinds(['com.twitter', 'com.bing']);
    for (let ex of byKindsMultiple) {
        assert.deepStrictEqual(typeof ex.id, 'number');
        assert.deepStrictEqual(ex.language, 'en');
        assertNonEmptyString(ex.utterance);
        assertNonEmptyString(ex.preprocessed);
        assertNonEmptyString(ex.target_code);
        checkKinds(ex.target_code, ['com.twitter', 'com.bing']);
    }
}

async function main() {
    await testGetDeviceCode();
    await testGetModuleLocation();
    await testGetSchemas();
    await testGetMetas();

    await testGetDeviceList();
    await testGetDeviceList('online');
    await testGetDeviceList('physical');
    await testGetDeviceList('data');
    await testGetDeviceList('system');
    await testGetDeviceListErrorCases();

    await testGetDeviceFactories();
    await testGetDeviceFactories('online');
    await testGetDeviceFactories('physical');
    await testGetDeviceFactories('data');
    await testGetDeviceFactories('system');
    await testGetDeviceFactoriesErrorCases();

    await testGetDeviceSetup();
    await testGetKindByDiscovery();
    await testGetExamples();
}

module.exports = main;
if (!module.parent)
    main();