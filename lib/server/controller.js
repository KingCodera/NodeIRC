var irc = require('irc');
var net = require('net');
var colors = require('colors');
var util = require('lodash');
var IRCMessageBase = require('../messages/IRCMessage.json');

module.exports = ModuleController;

ModuleController.prototype.agent;
ModuleController.prototype.modules = [];
ModuleController.prototype.server;
ModuleController.prototype.logger;
ModuleController.prototype.agentLogger;
ModuleController.prototype.clients = [];

function ModuleController(agent) {
    this.agent = agent;
    this.logger = agent.logger;
    this.agentLogger = agent.agentLogger;

    this.server = net.createServer(this.handler);
    this.server.mc = this;
    var mc = this;   

    this.server.listen(agent.config.modulePort, function() {
        mc.logger.info("ModuleController bound on port: " + mc.agent.config.modulePort.toString().cyan);
    });
}

ModuleController.prototype.handler = function(c) {
    var mc = this.mc;    
    c.on('connect', function(c) {                
        mc.clients.push(c);        
    });

    c.on('end', function() {
        mc.clientEnd(c);
        mc.clients.splice(mc.clients.indexOf(c), 1);        
    });

    c.on('data', function(data) {
         mc.clientData(c, data);                
    });           
}

ModuleController.prototype.clientEnd = function(c) {
    for (var i in c.channels) {
        var channel = c.channels[i];        
        // @TODO: Insert code to remove modules from channel list.
        // Also part channel when 0 modules are left.
        //this.agent.client.say(channel, "["+ irc.colors.wrap("dark_green","INFO") + "] Module: [" + c.moduleCode + "] " + c.module + " [" + irc.colors.wrap("light_red","UNLOADED") + "]");        
    }
    
    for (var i in c.listeners) {
        var eventName = c.listeners[i].eventName;
        var callback = c.listeners[i].callback;
        this.agent.client.removeListener(eventName, callback);
    }
            
    this.logger.info("Module closed: " + c.moduleCode);
}

ModuleController.prototype.clientData = function(c, data) {
    try {        
        var message = JSON.parse(data.toString());
        this.logger.info(message);              
        switch (message.type) {
            case "module": this.parseModule(c, message); this.logger.info("Connecting module: " + message.moduleCode); break;
            case "message": this.parseMessage(message); break;
            default: this.logger.warning("Unrecognised type"); break;
        }
    } catch(e) {
        this.logger.info(e);
        this.logger.warning("Received a non JSON string");
    }
}

ModuleController.prototype.parseModule = function(c, data) {
    var mc = this;

    c.channels = data.channels;    
    c.module = data.moduleName;
    c.moduleCode = data.moduleCode;
    c.commands = data.commands;
    c.listeners = [];

    if (this.checkServiceType(data.serviceType, "query")) {
        var callback = function(nick, text, message) {
            var IRCMessage = util._extend({}, IRCMessageBase);
            IRCMessage.IRCType = "pm";
            IRCMessage.nick = nick;
            IRCMessage.text = text;
            IRCMessage.message = message;
            c.write(IRCMessage);
        };       
        this.agent.client.addListener("pm", callback);
        var listener = {};
        listener.eventName = "pm";
        listener.callback = callback;
        c.listeners.push(listener);
    }
        
    c.channels.forEach(listenToChannel.bind(this));
 
    function listenToChannel(channel) {
        // @TODO: Insert code for channel module update.
        this.agent.client.join(channel);        
        //this.agent.client.say(channel, "["+ irc.colors.wrap("dark_green","INFO") + "] Module: [" + c.moduleCode + "] " + c.module + " [" + irc.colors.wrap("dark_green","LOADED") + "]");
        var channelMessage = "message" + channel;
        if (this.checkServiceType(data.serviceType, "channel")) {
            var callback = function(nick, text, message) {
                var textArray = text.split(" ");
                if (c.commands.indexOf(textArray[0]) != -1) {
                    var IRCMessage = util.defaults({
                        IRCType: "message",
                        nick: nick,
                        to: channel,
                        text: text,
                        message: message}, IRCMessageBase);
                    c.write(JSON.stringify(IRCMessage));
                }
            };
            this.agent.client.addListener(channelMessage, callback);            
            c.listeners.push({
                eventName: channelMessage,
                callback: callback
            });
        }        
       
    }  
}

ModuleController.prototype.parseMessage = function(message) {
    this.agent.logger.info("Target: " + message.to);
    this.agent.client.say(message.to, message.text);
}

ModuleController.prototype.checkServiceType = function(type, checkType) {    
    for (var i in type) {
        if (type[i] == checkType) {
            return true;
        }
    }
    return false;
}

ModuleController.prototype.add = function(module) {
    var unique = true;
    for (var i in this.modules) {
        if (this.modules[i].moduleCode == module.moduleCode) {
            unique = false;
        }
    }

    if (unique) {
        this.modules.push(module);
        module.deleteFunc = this.delete;
        agent.addModule(module);
    } else {
        this.agent.logger.warning("Module with same name already loaded");
    }
}

ModuleController.prototype.delete = function(module) {
    var deleteModule = modules.splice(modules.indexOf(module), 1);  
    agent.deleteModule(module);  
}