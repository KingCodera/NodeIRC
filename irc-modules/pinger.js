'use strict';

var client = require('../index').createClient('Pinger Module', 'pinger');

var handler = function(message) {
    this.sendText(message.to, 'pong');
};

client.on('ping', handler);
client.on('!ping', handler);

client.connect(20000);
