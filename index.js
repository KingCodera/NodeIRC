'use strict';

var client = require('./lib/client');

exports.createClient = function(name, code, channels, options) {
    return new client.moduleClient(name, code, channels, options || {});
};
