'use strict';

var irc = require('../index')
var client = irc.createClient(
	'Pinger Module',
	'pinger',
	{time: 100, persistent: true}
);

var handler = function(message) {
    this.sendText(message.to, 'pong');
};

client.on('ping', handler);
client.on('!ping', handler);

client.connect(20000, '192.168.2.4');
