"use strict";

// load everything in process so we have a global view of code coverage
require('..');

process.on('unhandledRejection', (up) => { throw up; });
process.env.TEST_MODE = '1';

async function seq(array) {
    for (let el of array)
        await el();
}

seq([
    require('./test_v2_device'),
    require('./test_http_client')
]);