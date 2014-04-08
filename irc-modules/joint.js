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
    {time: 100, persistent: true, channels: ['#doki', '#project-precure', '#Severin', '#doki-development']}
);

var db;

var readdb = function() {
    db = JSON.parse(fs.readFileSync('./conf/joint.json', 'utf8'));    
}

readdb();

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
        "precords": {},
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

var createPRecord = function() {
    var currentTime = new Date();
    var obj = {};
    obj.timer = currentTime;
    obj.diff = 0;
    obj.record = ' 0 seconds';
    obj.denials = 0;
    return obj;
}

var recordCooldown = _MS_PER_MIN;
var nickCooldown = _MS_PER_HOUR;

var handler = function(message) {
    readdb();
    var channeldb = db[message.to];
    if (channeldb.precords[message.nick] === undefined) {        
        channeldb.precords[message.nick] = createPRecord();
    }    

    var currentTime = new Date();
    if (channeldb === undefined) {
        newChannel(message.to, message.nick);
        client.sendText(message.to, '\x0303' + message.nick + '\x0F rolls the first one!');
        db[message.to] = channeldb;
        writedb();
        return;
    }

    if (message.parameters[0] === 'record') {            
        var record = channeldb.record;
        var recordTimer = new Date(record.timer);
        if (currentTime - recordTimer < recordCooldown) { return; }
        client.sendText(message.to, 'Current record on \x0313' + message.to + ' \x0Fis' + record.time + ' by \x0303' + record.nick);
        channeldb.record.timer = currentTime;                    
    } else if (message.parameters[0] === 'precord') {
        var recordTimer = new Date(channeldb.precords[message.nick].timer);
        if (currentTime - recordTimer > recordCooldown) {
            client.sendText(message.to, 'Current record of: \x0303' + message.nick + '\x0F is' + channeldb.precords[message.nick].record + ' and he/she has been denied \x0304' + channeldb.precords[message.nick].denials + '\x0F times!');
            channeldb.precords[message.nick].timer = currentTime;
        }
    } else if (message.parameters[0] === 'help') {
        client.sendNotice(message.nick, 'Type !joint to have it passed to you. (1 hour cooldown)');
        client.sendNotice(message.nick, 'Type !joint record to see channel record.');
        client.sendNotice(message.nick, 'Type !joint precord to see your personal record.');
        client.sendNotice(message.nick, 'Rehab phone number: 1-800-359-7412');
    } else {
        var current = channeldb.current;
        if (current === message.nick) { 
            client.sendNotice(message.nick, 'You already have it!');
            return;
        }
        var nickTimer = new Date(channeldb.timers[message.nick]);
        if (channeldb.timers[message.nick] === undefined || currentTime - nickTimer > nickCooldown) {                
            if (current === '~') {
                client.sendText(message.to, '\x0303' + message.nick + '\x0F rolls a new one!');                
            } else {
                var oldTime = new Date(channeldb.time);
                var diff = currentTime - oldTime;
                var string = formatTime(diff);
                if (string !== '') {
                    client.sendText(message.to, '\x0303' + channeldb.current + '\x0F has been smoking for' + string + ' and now hands it over to \x0303' + message.nick);
                    if (channeldb.precords[channeldb.current] === undefined) {        
                        channeldb.precords[channeldb.current] = createPRecord();
                    }   
                    if (channeldb.precords[channeldb.current].diff < diff) {
                        client.sendText(message.to, '\x0304New personal record\x0F by: \x0303' + channeldb.current + '\x0F!');
                        channeldb.precords[channeldb.current].diff = diff;
                        channeldb.precords[channeldb.current].record = string;
                    }
                } else {
                    client.sendText(message.to, '\x0303' + channeldb.current + '\x0F\'s joint has been snatched by \x0303' + message.nick +'\x0F before he/she could enjoy it! \x0307--\x0304DENIED\x0307--');
                    channeldb.precords[channeldb.current].denials += 1;
                }

                if (diff > channeldb.record.diff) {
                    channeldb.record.nick = channeldb.current;
                    channeldb.record.diff = diff;
                    channeldb.record.time = string;
                    client.sendText(message.to, '\x0304New record! \x0F\x0303' + channeldb.current);
                }                                
            } 

            channeldb.current = message.nick;
            channeldb.time = currentTime;
            channeldb.timers[message.nick] = currentTime;              
        } else {
            // User is on cooldown            
            client.sendNotice(message.nick, 'You have had quite enough dear sir/madam.');
        }         
    }
    db[message.to] = channeldb;
    writedb();    
}

var confiscateHandler = function(message) {
    readdb();
    if (message.nick !== 'Police') {
        client.sendNotice(message.nick, 'You have no authority here!');
        return;
    }

    var channeldb = db[message.to];
    if (channeldb === undefined || channeldb.current === '~') {
        client.sendNotice(message.nick, 'All clean here sir!');
        return;
    }

    var currentTime = new Date();
    // Create special nick, ~ is illegal character! I'm so smart.
    var nick = message.nick + '~Special';
    var nickTimer = new Date(channeldb.timers[nick]);

    if (channeldb.timers[nick] === undefined || currentTime - nickTimer > _MS_PER_MIN * 30) {        
        client.sendText(message.to, '\x0303' + channeldb.current + '\x0F\'s joint has been confiscated by \x0302Pol\x0304ice\x0F! \x0307--\x0304DENIED\x0307--');
        channeldb.precords[channeldb.current].denials += 1;
        channeldb.current = '~';
        channeldb.timers[nick] = currentTime;
    } else {
        client.sendNotice(message.nick, 'No one likes police brutality!');
    }

    db[message.to] = channeldb;
    writedb();    
}

client.on('!joint', handler);
client.on('!confiscate', confiscateHandler);

client.connect(20000, 'localhost');