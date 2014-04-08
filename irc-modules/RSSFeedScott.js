'use strict';

var net = require('net');
var http = require('http');
var _ = require('lodash');

var irc = require('../index')
var client = irc.createClient(
    'RSS Scott Manley',
    'RSM',
    {time: 100, persistent: true}
);

var rss = require('feedsub');
var url = 'http://gdata.youtube.com/feeds/base/users/szyzyg/uploads?alt=rss';

var reader = new rss(url, {
    interval: 1,
    forceInterval: true,
    emitOnStart: true}
);

var logger;

var channel = '#Severin';
var block = true;

var postHandler = function(item) {
    if (block) { return; }
    var string = '[\x0307RSS\x0F] \x0311' + item.title + ' \x0314' + item.link.replace('&feature=youtube_gdata', '');
    if (!_.contains(item.title, 'Interstellar')) { return; }
    client.sendText(channel, string);
    client.sendText('#doki-development', string);
}

var errorHandler = function(err) {
    client.logger.error('Received error: ' + err);
}

reader.on('item', postHandler);
reader.on('error', errorHandler);
reader.start();

setTimeout(function() {
    block = false;
}, 2000);

client.connect(20000, 'localhost');