'use strict';

var _ = require('lodash');
var net = require('net');
var clientModule = require('./module');

module.exports = controller;

function controller(agent) {
    /*jshint validthis:true */

    this.agent = agent;
    this.logger = agent.logger;
    this.modules = [];

    this.listener = net.createServer(this.handler.bind(this));

    this.listener.listen(agent.options.modulePort, function() {
        this.logger.info('controller bound on port: ' + this.agent.options.modulePort.toString().cyan);
    }.bind(this));
}

controller.prototype.handler = function(client) {
    client.on('connect', function(client) {
        this.clients.push(client);
    }.bind(this));

    client.controller = this;
    client.connected = true;

    client.on('end', this.clientEnd.bind(client));
    client.on('error', this.clientEnd.bind(client));

    client.on('data', function(data) {
        this.clientData(client, data);
    }.bind(this));
};

controller.prototype.clientEnd = function() {
    var client = this;
    if (client.module && client.connected) {
        client.connected = false;
        try {
            client.module.disconnect();
        }
        catch (error) { }
        _.remove(client.controller.modules, client.module);
        client.controller.logger.info('Module closed: ' + client.module.options.moduleCode);
        client.module = null;
    }
    _.remove(client.controller.clients, client);
};

controller.prototype.clientData = function(c, data) {
    var message = null;
    try {
        message = JSON.parse(data.toString());
    } catch(e) {
        this.logger.info(e.message);
        this.logger.warning('Received a non JSON string');
        return;
    }

    //Check if the incoming message is a registration of the module.
    if (message.type === 'module') {
        //Make sure the registration is valid.
        if (this.getError(message)) {
            this.logger.warning('Invalid module registration: ' + this.getError(message));
            return c.end(JSON.stringify({IRCType: 'error', message: 'Module registration was not valid.'}));
        }
        //Make sure it hasn't already been registered.
        if (_.find(this.modules, {options: {moduleCode: message.moduleCode}})) {
            this.logger.warning('Received an attempt to register "' + message.moduleCode + '" again.');
            return c.end(JSON.stringify({IRCType: 'error', message: 'Module with that name already exists.'}));
        }

        //Register and create the module.
        var newModule = new clientModule(this, c, message);
        this.modules.push(newModule);
        this.logger.info('New module connected: ' + newModule.options.moduleCode + ' (' + newModule.options.serviceType.join(', ') + ')');
        newModule.client.write(JSON.stringify({IRCType: 'success', nick: this.agent.options.nick}));
        return this.agent.moduleAdded(newModule);
    }

    //Make sure the message is valid and has everything we need.
    if (message.type !== 'message' || !message.to || !message.text) {
        return this.logger.warning('Invalid message: ' + data.toString());
    }

    //Make sure the client has actually registered before sending messages.
    if (!_.find(this.modules, {client: c})) {
        return c.end(JSON.stringify({IRCType: 'error', message: 'Must register before sending messages'}));
    }

    //Send the message!
    //this.logger.info('Target: ' + message.to);
    this.agent.client.say(message.to, message.text);
};

controller.prototype.getError = function(message) {
    //Make sure it has a service type.
    if (!message.serviceType || message.serviceType.length === 0) {
        return 'Service type invalid or empty.';
    }

    //Make sure the hash key matches (the password).
    if (this.agent.options.hashKey && message.hashKey !== this.agent.options.hashKey) {
        return 'Hashkey mismatch! Received "' + message.hashKey + '".';
    }

    //Make sure it has all the required properties.
    return _.difference(['type', 'moduleName', 'moduleCode', 'serviceType'], Object.keys(message)).join(', ');
};
