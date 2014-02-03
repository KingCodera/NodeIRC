'use strict';

var client = require('../ModuleClient').createClient(
    'Pinger Module',
    'pinger',
    ['#doki-development', '#project-precure']
);

client.on('!ping', function(message) {
    this.sendText(message.to, 'pong');
});

client.connect(20000);
