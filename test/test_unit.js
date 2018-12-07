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

const TT = require('thingtalk');
const assert = require('assert');

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

const PARSE_GENERIC_RESPONSE_TEST_CASES = [
    [{
        json_key: 'articles',
        args: [
            {
                name: 'title',
                type: 'String',
            },
            {
                name: 'link',
                type: 'Entity(tt:url)',
            },
            {
                name: 'picture_url',
                type: 'Entity(tt:picture)',
                json_key: 'thumbnail'
            },
        ]
    }, {
        articles: [
            {
                title: 'Some title',
                link: 'https://example.com/1',
                thumbnail: 'https://example.com/1.png',
            },
            {
                title: 'Some other title',
                link: 'https://example.com/2',
                thumbnail: 'https://example.com/2.png',
            }
        ]
    }, [
        {
            title: 'Some title',
            link: new TT.Builtin.Entity('https://example.com/1', null),
            picture_url: new TT.Builtin.Entity('https://example.com/1.png', null),
        },
        {
            title: 'Some other title',
            link: new TT.Builtin.Entity('https://example.com/2', null),
            picture_url: new TT.Builtin.Entity('https://example.com/2.png', null),
        }
    ]],

    [{
        json_key: 'response.value',
        args: [
            {
                name: 'key',
                type: 'String',
            },
            {
                name: 'object',
                type: 'Entity(foo:object)',
            },
            {
                name: 'measure1',
                type: 'Measure(ms)',
            },
            {
                name: 'measure2',
                type: 'Measure(C)',
            },
            {
                name: 'number1',
                type: 'Number',
            },
            {
                name: 'number2',
                type: 'Number',
            },
            {
                name: 'currency1',
                type: 'Currency',
            },
            {
                name: 'currency2',
                type: 'Currency',
            },
            {
                name: 'currency3',
                type: 'Currency',
            },
            {
                name: 'date1',
                type: 'Date',
            },
            {
                name: 'date2',
                type: 'Date',
            },
            {
                name: 'date3',
                type: 'Date',
            },
        ]
    }, {
        response: {
            value: {
                key: 'some_key',
                object: {
                    value: '111111',
                    display: 'Some object'
                },
                ignored: 'ignored',
                measure1: 7,
                measure2: '8',
                number1: 9,
                number2: '10.5',
                currency1: 1000,
                currency2: '1001',
                currency3: { value: 1002, unit: 'eur' },

                date1: '2018-01-01T00:00:00Z',
                date2: '1 Jan 2018',
                date3: 1544211576140,
            }
        }
    }, [
        {
            key: 'some_key',
            object: new TT.Builtin.Entity('111111', 'Some object'),
            measure1: 7,
            measure2: 8,
            number1: 9,
            number2: 10.5,
            currency1: new TT.Builtin.Currency(1000, 'usd'),
            currency2: new TT.Builtin.Currency(1001, 'usd'),
            currency3: new TT.Builtin.Currency(1002, 'eur'),
            date1: new Date(Date.UTC(2018, 0, 1, 0, 0, 0)),
            date2: new Date(2018, 0, 1, 0, 0, 0),
            date3: new Date(1544211576140)
        },
    ]],

        [{
        json_key: 'response.values.0',
        args: [
            {
                name: 'key',
                type: 'String',
            },
            {
                name: 'hashtags',
                type: 'Array(Entity(tt:hashtag))',
            },
            {
                name: 'actors',
                type: 'Array(String)',
            },
            {
                name: 'objects',
                type: 'Array(Entity(foo:object))',
            }
        ]
    }, {
        response: {
            values: [
                {
                    key: 'some_key',
                    hashtags: 'foo,bar',
                    actors: 'Leonardo DiCaprio, Kate Winslet, Billy Zane, Kathy Bates',
                    objects: [
                        {
                            value: '111111',
                            display: 'Some object'
                        },
                        {
                            value: '111112',
                            display: 'Some other object'
                        },
                    ]
                }
            ]
        }
    }, [
        {
            key: 'some_key',
            objects: [new TT.Builtin.Entity('111111', 'Some object'),
                      new TT.Builtin.Entity('111112', 'Some other object')],
            hashtags: [new TT.Builtin.Entity('foo', null), new TT.Builtin.Entity('bar', null)],
            actors: ['Leonardo DiCaprio', 'Kate Winslet', 'Billy Zane', 'Kathy Bates'],
        },
    ]]
];

function testParseGenericResponse() {
    PARSE_GENERIC_RESPONSE_TEST_CASES.forEach(([block, response, expected], i) => {
        console.log('Test Case #' + (i+1));
        const generated = Utils.parseGenericResponse(response, block);
        assert.deepStrictEqual(generated, expected);
    });
}

async function main() {
    console.log('testFormatString');
    testFormatString();
    console.log('testParseGenericResponse');
    testParseGenericResponse();
}
module.exports = main;
if (!module.parent)
    main();
