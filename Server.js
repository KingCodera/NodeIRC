// system requires.
var net = require('net');
var colors = require('colors');

var serverPass;

module.exports = server;

// Variables.
server.prototype.clients = [];
server.prototype.log;
server.prototype.config;
server.prototype.util;

function server(pConfig, pUtil, pBotConnector) {
    util = pUtil;
    log = pUtil.log;
    config = pConfig;
    serverPass = pConfig.pass;
    log.info("Starting module server");

    var server = net.createServer(this.handler);

    server.listen(config.port, function() {
        log.info("Server bound on port: " + config.port.toString().cyan);
    });
}

server.prototype.handler = function(c) {
    c.on('connect', function(c) {
        log.info("Client connected");
        c.identified = false;
        clients.push(c);        
    });

    c.on('end', function() {
        clientEnd(c);
        clients.splice(clients.indexOf(c), 1);        
    });

    c.on('data', function(data) {
         clientData(c, data);                
    });  
      
    c.pipe(c);  
}

parseModule = function(c, data) {    
    c.channels = data.channels;    
    c.module = data.moduleName;
    for (var i in c.channels) {
        var channel = c.channels[i];
        log.info(channel);
        // @TODO: Insert code for channel module update.
        bouncer.bot.join(channel);  
        setTimeout(function() { 
            bouncer.bot.say(channel, "["+ irc.colors.wrap("dark_green","INFO") + "] Module: " + c.module + " [" + irc.colors.wrap("dark_green","LOADED") + "]");
        }, 1000);
        var channelMessage = "message" + channel;
        bouncer.bot.addListener(channelMessage, function(nick, to, text, message) {
            log.info("Message from: " + nick.cyan);              
        });
    }        
}

parseMessage = function(data) {
}

clientData = function(c, data) {
    try {
        var string = JSON.parse(data.toString());
        switch (string.type) {
            case "module": parseModule(c, string); log.info("Connecting module..."); break;
            case "message": parseMessage(string); break;
            default: log.warning("Unrecognised type"); break;
        }
    } catch(e) {
        log.warning("Received a non JSON string");
    }
}

clientEnd = function(c) {
    for (var i in c.channels) {
        var channel = c.channels[i];
        log.info(channel);
        // @TODO: Insert code to remove modules from channel list.
        // Also part channel when 0 modules are left.
        bouncer.bot.say(channel, "["+ irc.colors.wrap("dark_green","INFO") + "] Module: " + c.module + " [" + irc.colors.wrap("light_red","DISCONNECTED") + "]");
        bouncer.bot.part(channel);
    }    
    log.info("Closed socket");
}
