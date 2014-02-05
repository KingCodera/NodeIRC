'use strict';

var client = require('../index').createClient(
	'Pinger Module',
	'pinger',
	{time: 100, hashKey: 'asdf', persistent: true, channels: ['#doki-development']}
);

var handler = function(message) {
    this.sendText(message.to, 'pong');
};

client.on('ping', handler);
client.on('!ping', handler);

client.connect(20000, '192.168.2.4');
