'use strict';

var _MS_PER_DAY = 1000 * 60 * 60 * 24;
var _MS_PER_HOUR = 1000 * 60 * 60;
var _MS_PER_MIN = 1000 * 60;
var _MS_PER_SEC = 1000;

var fs = require('fs');
var irc = require('../index');

var client = irc.createClient(
    'Joint Module',
    'JNT',
    {time: 100, persistent: true}
);

var db = JSON.parse(fs.readFileSync('./conf/joint.json', 'utf8'));

var writedb = function() {
    fs.writeFileSync('./conf/joint.json', JSON.stringify(db, null, 4), 'utf8');
}

var newChannel = function(channel, nickname) {
    var obj = {        
        "current": nickname,
        "time": new Date()
    }
    db[channel] = obj;
    writedb();
}

var formatTime = function(begin, end) {
    var diff = end - begin;
    var days = Math.floor(diff / _MS_PER_DAY);
    var hours = Math.floor(diff / _MS_PER_HOUR) % 24;
    var minutes = Math.floor(diff / _MS_PER_MIN) % 60;
    var seconds = Math.floor(diff / _MS_PER_SEC) % 60;

    var string = '';
    switch (true) {
        case (days > 0): string += ' ' + days + ' days';
        case (hours > 0): string += ' ' + hours + ' hours';
        case (minutes > 0): string += ' ' + minutes + ' minutes';
        case (seconds > 0): string += ' ' + seconds + ' seconds';
    }
    return string;
}

var handler = function(message) {
    var channeldb = db[message.to];
    if (channeldb !== undefined) {
        var current = channeldb.current;
        if (current === message.nick) { return; }
        var currentTime = new Date();
        var string = formatTime(channeldb.time, currentTime);
        client.sendText(message.to, '\x0303' + channeldb.current + '\x0F has been smoking for' + string + ' and now hands it over to \x0303' + message.nick);
        channeldb.current = message.nick;
        channeldb.time = currentTime;
        db[message.to] = channeldb;
        writedb();
    } else {
        newChannel(message.to, message.nick);
        client.sendText(message.to, '\x0303' + message.nick + '\x0F rolls the first one!');
    }
}

client.on('!joint', handler);

client.connect(20000, 'localhost');