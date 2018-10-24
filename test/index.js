"use strict";

// load everything in process so we have a global view of code coverage
require('..');

process.on('unhandledRejection', (up) => { throw up; });
process.env.TEST_MODE = '1';

async function seq(array) {
    for (let fn of array) {
        console.log(`Running ${fn}`);
        await require(fn)();
    }
}

seq([
    ('./test_unit'),
    ('./test_api'),
    ('./test_http_client'),
    ('./test_builtin'),
    ('./test_v2_device'),
    ('./test_generic_rest'),
    ('./test_rss_device'),
]);
