'use strict';

var net = require('net');
var events = require('events');
var lodash = require('lodash');
var util = require('../util/util.js');
var IRCMessageBase = require('../messages/IRCMessage.json');

exports.moduleClient = moduleClient;

function moduleClient(name, code, channels, options) {
    /*jshint validthis:true */

    this.name = name;
    this.code = code;
    this.channels = channels;
    this.commands = [];
    this.client = null;
    this.connected = false;
    this.inQueue = 0;
    this.time = options.time || 100;
    this.emitter = new events.EventEmitter();

    this.on = function(command, callback) {
        if (this.connected) {
            throw new Error('Cannot register commands after connecting.');
        }
        if (this.commands.indexOf(command) !== -1) {
            throw new Error('Attempting to double register a command "' + command + '".');
        }
        this.commands.push(command);
        this.emitter.addListener(command, callback.bind(this));
    };

    this.connect = function(port) {
        this.client = net.connect(port, function() {
            this.connected = true;

            //Create a logger for our module.
            this.logger = new util.Logger(this.name, 'info');
            this.logger.info('Module loaded');

            //Register this module to the server
            this.registerModule();
        }.bind(this));

        this.client.on('data', this.readMessage.bind(this));
        this.client.on('end', this.disconnected.bind(this));
    };

    this.registerModule = function() {
        this.client.write(JSON.stringify({
            'type': 'module',
            'moduleName': this.name,
            'moduleCode': this.code,
            'botName': 'thingy-kun',
            'hashKey': 'test',
            'serviceType': [
                'channel'
            ],
            'channels': this.channels,
            'commands': this.commands
        }));
    };

    this.readMessage = function(data) {
        try {
            var message = JSON.parse(data.toString());
            var textArray = message.text.split(' ');
            var command = textArray[0];
            message.command = command;
            message.parameters = textArray.slice(1,textArray.length);

            this.emitter.emit(command, message);
        } catch(e) {
            this.logger.error(e);
        }
    };

    this.sendText = function(to, text) {
        return this.send(
            lodash.defaults({
                to: to,
                text: text
            },
            IRCMessageBase)
        );
    };

    this.send = function(message) {
        this.inQueue++;
        setTimeout(function() {
            this.client.write(JSON.stringify(message));
            this.inQueue--;
        }.bind(this), this.inQueue * this.time);
    };

    this.disconnected = function() {
        this.logger.warning('Client shutting down...');
    };
}
