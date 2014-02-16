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
        "time": new Date(),
        "record": {
            "nick": nickname,
            "diff": 0,
            "time": "0 seconds",
            "timer": "2014-02-15T16:17:56.778Z"
        },
        "timers": {}
    }
    db[channel] = obj;
    writedb();
}

var formatTime = function(diff) {    
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

var recordCooldown = _MS_PER_MIN;
var nickCooldown = _MS_PER_HOUR;

var handler = function(message) {
    var channeldb = db[message.to];
    if (channeldb !== undefined) {
        if (message.parameters[0] === 'record') {
            var currentTime = new Date();
            var record = channeldb.record;
            var recordTimer = new Date(record.timer);            
            if (currentTime - recordTimer < recordCooldown) { return; }
            client.sendText(message.to, 'Current record on \x0313' + message.to + ' \x0Fis' + record.time + ' by \x0303' + record.nick);
            channeldb.record.timer = currentTime;
            db[message.to] = channeldb;
            writedb();
            return;
        } else {
            var current = channeldb.current;
            var currentTime = new Date();
            if (current === message.nick) { return; }
            var nickTimer = new Date(channeldb.timers[message.nick]);
            if (channeldb.timers[message.nick] === undefined || currentTime - nickTimer > nickCooldown) {                
                var oldTime = new Date(channeldb.time);
                var diff = currentTime - oldTime;
                var string = formatTime(diff);
                if (string !== '') {
                    client.sendText(message.to, '\x0303' + channeldb.current + '\x0F has been smoking for' + string + ' and now hands it over to \x0303' + message.nick);
                } else {
                    client.logger.error('Time: ' + currentTime);
                    client.logger.error('OldTime: ' + oldTime);
                    client.logger.error('Diff: ' + diff);
                }
                if (diff > channeldb.record.diff) {
                    channeldb.record.nick = channeldb.current;
                    channeldb.record.diff = diff;
                    channeldb.record.time = string;
                    client.sendText(message.to, '\x0304New record! \x0F\x0303' + channeldb.current);
                }
                channeldb.current = message.nick;
                channeldb.time = currentTime;
                channeldb.timers[message.nick] = currentTime;
                db[message.to] = channeldb;
                writedb();
            } else {
                // Send notice to user?
            }         
        }
    } else {
        newChannel(message.to, message.nick);
        client.sendText(message.to, '\x0303' + message.nick + '\x0F rolls the first one!');
    }
}

client.on('!joint', handler);

client.connect(20000, 'localhost');