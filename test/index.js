"use strict";

// load everything in process so we have a global view of code coverage
require('..');

process.on('unhandledRejection', (up) => { throw up; });
process.env.TEST_MODE = '1';

async function seq(array) {
    for (let fn of array)
        await fn();
}

seq([
    require('./test_api'),
    require('./test_http_client'),
    require('./test_v2_device'),
    require('./test_generic_rest'),
    require('./test_rss_device'),
]);
