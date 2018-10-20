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

const Utils = require('../lib/modules/utils');

const FORMAT_STRING_TEST_CASES = [
    ['foo ${string}', { string: 'one' }, {}, `foo one`],
    ['foo ${string}', { string: 'one' }, undefined, `foo one`],
    ['foo ${string}', {}, {}, `foo `],
    ['foo ${string}', {}, undefined, `foo `],

    ['foo $string', { string: 'one' }, {}, `foo one`],
    ['foo $string.', { string: 'one' }, {}, `foo one.`],
    ['foo ${string}', {}, { string: 'one' }, `foo one`],
    ['${string}foo', { string: 'one' }, {}, `onefoo`],

    // U+200C: zero width non-joiner
    ['$string\u200cfoo', { string: 'one' }, {}, 'one\u200cfoo'],
    ['foo ${number}', { number: 42 }, {}, `foo 42`],
    ['foo ${number:%}', { number: 0.42 }, {}, `foo 42`],
    ['foo ${number:C}', { number: 20 }, {}, `foo 20.0`],
    ['foo ${number:F}', { number: 20 }, {}, `foo 68.0`],
    ['foo ${number:m}', { number: 20 }, {}, `foo 20.0`],
    ['foo ${number:mm}', { number: 20 }, {}, `foo 20000.0`],

    ['$$$$', {}, {}, '$$'],
    ['$$foo', {}, {}, '$foo'],

    ['foo${date}', { date: new Date('2018-01-01T10:00:00Z') }, {}, `foo2018-01-01T10:00:00.000Z`],

    ['foo ${string:url}', { string: '~!@#$%^&*()_-`:"[],><' }, {}, `foo ${encodeURIComponent('~!@#$%^&*()_-`:"[],><')}`],
];

function testFormatString() {
    FORMAT_STRING_TEST_CASES.forEach(([toFormat, deviceParams, functionParams, expected], i) => {
        console.log('Test Case #' + (i+1));
        const generated = Utils.formatString(toFormat, deviceParams, functionParams);
        if (generated !== expected) {
            console.error('Test Case #' + (i+1) + ': does not match what expected');
            console.error('Expected: ' + expected);
            console.error('Generated: ' + generated);
            if (process.env.TEST_MODE)
                throw new Error(`testFormatString ${i+1} FAILED`);
        }
    });
}

async function main() {
    testFormatString();
}
module.exports = main;
if (!module.parent)
    main();
