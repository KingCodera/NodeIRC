'use strict';

var client = require('./lib/client');
var server = require('./lib/server');

exports.createClient = function(name, code, channels, options) {
    return new client(name, code, channels, options || {});
};

exports.createServer = function(options) {
    return new server(options);
};
