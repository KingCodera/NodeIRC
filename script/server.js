#!/usr/bin/env node
'use strict';

var main = require('../index');
var fs = require('fs');

if (process.argv.length === 2) {
    return console.log('Please specify both the server json config and any agent json configs.');
}
if (process.argv.length === 3) {
    return console.log('Please specify at least one or more agent json configs.');
}

var args = process.argv.slice(2);
var configs = [];
var sett = {};

try {
    sett = JSON.parse(fs.readFileSync(args[0], 'utf8'));
}
catch (error) {
    console.log('Error while opening and parsing server config', args[0]);
    console.log(error);
    return;
}

for (var i = 1; i < args.length; i++) {
    try {
        var contents = fs.readFileSync(args[i], {encoding: 'utf8'});
        configs.push(JSON.parse(contents));
    }
    catch (error) {
        console.log('Error while opening and parsing', args[i]);
        console.log(error);
        return;
    }
}

var server = main.createServer(sett);
configs.forEach(function(item) {
    server.connectAgent(item);
});
