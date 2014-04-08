'use strict';

var net = require('net');
var events = require('events');
var lodash = require('lodash');
var util = require('../util/util.js');
var IRCMessageBase = require('../messages/IRCMessage.json');

module.exports = moduleClient;

function moduleClient(name, code, options) {
    /*jshint validthis:true */
    this.options = options || {};
    this.persistent = options.persistent || [];
    this.port = null;
    this.name = name;
    this.code = code;
    this.channels = options.channels || [];
    this.commands = [];
    this.client = null;
    this.connected = false;
    this.inQueue = 0;
    this.time = options.time || 100;
    this.emitter = new events.EventEmitter();

    //Create a logger for our module.
    this.logger = new util.Logger(this.name, 'info');

    this.on = function(command, callback) {
        //We can only register commands before we connect.
        if (this.connected) {
            throw new Error('Cannot register commands after connecting.');
        }

        //Make sure the command registering is unique.
        if (this.commands.indexOf(command) !== -1) {
            throw new Error('Attempting to double register a command "' + command + '".');
        }

        //Add our command!
        this.commands.push(command);
        this.emitter.addListener(command, callback.bind(this));
    };

    this.disconnect = function() {
        this.connected = false;
        this.client.end();
    };

    this.connect = function(port, host, cb) {
        this.port = port;
        this.host = host;
        this.cb = cb;

        this.client = net.connect({port: port, host: host}, function() {
            this.logger.info('Connection established...');
            this.connected = true;

            this.timeOut = setTimeout(function() {
                this.disconnect();
                this.logger.error('Did not recieve registration success in time.');
                if (this.cb) { this.cb(new Error('Timeout getting registration success')); }
            }.bind(this), 10000);

            //Register this module to the server
            this.registerModule();
        }.bind(this));

        this.client.on('error', this.disconnected.bind(this));
        this.client.on('data', this.readMessage.bind(this));
        this.client.on('end', this.disconnected.bind(this));
    };

    this.registerModule = function() {
        this.client.write(JSON.stringify({
            'type': 'module',
            'moduleName': this.name,
            'moduleCode': this.code,
            'hashKey': options.hashKey || null,
            'serviceType': this.options.serviceType || ['channel'],
            'channels': this.channels,
            'commands': this.commands,
            'nickserv': this.options.nickserv || false
        }));
    };

    this.readMessage = function(data) {
        var message = null;
        try {
            //Attempt to de-code the message.
            message = JSON.parse(data.toString());
        } catch(e) {
            return this.logger.error(e);
        }

        //If we received an error from server, we immediately disconnect.
        if (message.type === 'error') {
            this.logger.error('Received error from server: ' + message.message);
            return this.client.end();
        }
        //Otherwise if we received a success, our module successfully
        //registered to the server.
        else if (message.type === 'success') {
            this.logger.info('Module loaded successfully');
            this.attempts = null;
            this.success = true;
            this.nick = message.nick;
            clearTimeout(this.timeOut);
            if (this.cb) { this.cb(null, this); }
            return;
        }

        var textArray = message.text.split(' ');
        var command = textArray[0];
        message.command = command;
        message.parameters = textArray.slice(1,textArray.length);
        this.emitter.emit(command, message);

        if (message.IRCType === 'pm') {
            this.emitter.emit('pm', message);
            this.emitter.emit([message.nick, 'response'].join(':'), message);
        }
    };

    this.sendNotice = function(to, text) {
        return this.send(
            lodash.defaults({
                IRCType: "notice",
                to: to,
                text: text
            },
            IRCMessageBase)
        );
    };

    this.sendRaw = function(message) {
        return this.send(
            lodash.defaults({
                IRCType: 'raw',
                message: message
            },
            IRCMessageBase)
        );
    }

    this.sendAction = function(to, text) {
        return this.send(
            lodash.defaults({
                IRCType: "action",
                to: to,
                text: text
            },
            IRCMessageBase)
        );
    }

    this.sendCtcp = function(to, type, text) {
        return this.send(
            lodash.defaults({
                IRCType: "ctcp",
                to: to,
                ctcptype: type,
                text: text
            },
            IRCMessageBase)
        );
    }

    this.sendText = function(to, text) {
        return this.send(
            lodash.defaults({
                IRCType: "say",
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

    this.sendAwait = function(to, text, cb) {
        this.emitter.once([to, 'response'].join(':'), cb.bind(this));
        return this.send(
            lodash.defaults({
                IRCType: "await",
                to: to,
                text: text
            },
            IRCMessageBase)
        );
    }

    this.disconnected = function(err) {
        //If we have an error message, then we failed to connect.
        if (err) {
            this.logger.error(err.message);
        }
        //Otherwise, if we have connected, then we lost it.
        else if (this.connected) {
            this.logger.error('Lost connection to server.');
        }

        //Check if we shouldn't stay persistent or if we never
        //managed to connect to the server at all.
        if (!this.persistent || !this.success) {
            //In case we never managed to connect at all, no point in
            //printing 'shutting down'.
            if (!this.connected) { return; }

            return this.logger.warning('Client shutting down...');
        }

        //Reset the connected property.
        this.connected = false;

        //Make sure we don't try indefinately to re-connect.
        /*
        if (this.attempts >= 99) {
            return this.logger.warning('Too many failed attempts, shutting down...');
        }
        */

        //Make an attempt to re-connect.
        this.logger.warning('Attempting reconnecting in ' + 5 + ' seconds...');

        setTimeout(function() {
            //Increase the attempt counter.
            this.attempts = (this.attempts || 1) + 1;

            //Attempt to connect.
            this.connect(this.port, this.host);
        }.bind(this), 5000);
    };
}
