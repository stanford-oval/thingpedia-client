// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const lang = require('lang');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const url = require('url');

const THINGPEDIA_URL = 'https://thingpedia.herokuapp.com';

function getModule(parsed) {
    if (parsed.protocol === 'https:')
        return https;
    else
        return http;
}

module.exports = new lang.Class({
    Name: 'ThingPediaClientHttp',

    getModuleLocation: function(id) {
        var to = THINGPEDIA_URL + '/download/devices/' + id + '.zip';
        if (this.developerKey)
            to += '?developer_key=' + this.developerKey;

        var parsed = url.parse(to);
        return Q.Promise(function(callback, errback) {
            getModule(parsed).get(parsed, function(res) {
                if (res.statusCode != 301) {
                    return errback(new Error('Unexpected HTTP status ' +
                                             res.statusCode +
                                             ' downloading channel ' + id));
                }

                callback(res.headers['location']);
            }).on('error', function(error) {
                errback(error);
            });
        });
    },

    getDeviceCode: function(id) {
        var to = THINGPEDIA_URL + '/api/code/devices/' + id;
        if (this.developerKey)
            to += '?developer_key=' + this.developerKey;

        var parsed = url.parse(to);
        return Q.Promise(function(callback, errback) {
            getModule(parsed).get(parsed, function(res) {
                if (res.statusCode != 200)
                    return errback(new Error('Unexpected HTTP error ' + res.statusCode));

                callback(res);
            }).on('error', function(error) {
                errback(error);
            });
        });
    },

    getSchemas: function(kinds) {
        var to = THINGPEDIA_URL + '/api/schema/' + kinds.join(',');
        if (this.developerKey)
            to += '?developer_key=' + this.developerKey;

        var parsed = url.parse(to);
        return Q.Promise(function(callback, errback) {
            getModule(parsed).get(parsed, function(res) {
                if (res.statusCode != 200)
                    return errback(new Error('Unexpected HTTP error ' + res.statusCode));

                var data = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    data += chunk;
                });
                res.on('end', function() {
                    try {
                        callback(JSON.parse(data));
                    } catch(e) {
                        errback(e);
                    }
                });
            }).on('error', function(error) {
                errback(error);
            });
        });
    },

    getKindByDiscovery: function(publicData) {
        var to = THINGPEDIA_URL + '/api/discovery';
        if (this.developerKey)
            to += '?developer_key=' + this.developerKey;

        var parsed = url.parse(to);
        parsed.method = 'POST';
        parsed.headers = {};
        parsed.headers['Content-Type'] = 'application/json';

        return Q.Promise(function(callback, errback) {
            var req = getModule(parsed).request(parsed, function(res) {
                if (res.statusCode == 404)
                    return errback(new Error('No such device'));
                if (res.statusCode != 200)
                    return errback(new Error('Unexpected HTTP error ' + res.statusCode));

                var data = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    data += chunk;
                });
                res.on('end', function() {
                    callback(data);
                });
            });
            req.on('error', errback);
            req.end(JSON.stringify(blob));
        });
    }
});
