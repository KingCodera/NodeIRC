'use strict';

var _ = require('lodash');
var IRCMessageBase = require('../messages/IRCMessage.json');

module.exports = clientModule;

function clientModule(controller, client, info) {
    /*jshint validthis:true */

    this.controller = controller;
    this.client = client;
    this.options = info;
    this.channels = this.options.channels || [];
    client.module = this;
    this.connected = true;

    //Add this module to the listener.
    this.controller.agent.client.addListener('message', this.newServerMessage.bind(this));
    this.controller.agent.client.addListener('sendraw', this.newServerRaw.bind(this));
}

clientModule.prototype.newServerMessage = function(nick, to, text, message) {
    if (!this.connected) { return; }

    if (this.options.nickserv) {
        
    }

    //Create the message to send to module.
    var message = _.defaults({
        IRCType: 'message',
        nick: nick,
        to: to,
        text: text,
        message: message
    }, IRCMessageBase);

    //In case the 'to' is the same as our nick, we're dealing
    //with a private message
    if (to === this.controller.agent.options.nick) {
        //Make sure our module is actually servicing private
        //messages (it should have 'query' in its serviceType)
        if (!_.contains(this.options.serviceType, 'query')) { return; }

        //Update the type to private message
        message.IRCType = 'pm';
    }
    //Otherwise, check if the module is actually servicing normal
    //channel messages.
    else if (!_.contains(this.options.serviceType, 'channel')) { return; }

    //Check if this specific module only wants to service to specific channels
    if (this.channels.length && !_.contains(this.channels, to)) { return; }

    //Send the message.
    this.client.write(JSON.stringify(message));
};

clientModule.prototype.newServerRaw = function(message) {
    if (!this.connected) { return; }

    message.IRCType = 'raw';

    //Send the message.
    console.log('SENDING', message);
    this.client.write(JSON.stringify(message));
};

clientModule.prototype.disconnect = function(reason) {
    this.connected = false;

    //Notify the module he's about to be disconnected.
    this.client.end(JSON.stringify({IRCType: 'error', message: reason}));

    //Remove the listener for this module.
    this.controller.agent.client.removeListener('message', this.newServerMessage.bind(this));
};
