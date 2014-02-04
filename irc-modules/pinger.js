'use strict';

var client = require('../ModuleClient').createClient(
    'Pinger Module',
    'pinger',
    ['#doki-development', '#project-precure', '#doki-precure']
);

var handler = function(message) {
    this.sendText(message.to, 'pong');
};

client.on('ping', handler);
client.on('!ping', handler);

client.connect(20000);
