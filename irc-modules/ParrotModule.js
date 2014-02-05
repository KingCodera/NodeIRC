var net = require('net');
var colors = require('colors');

var util = require('./util/util.js');

var module = require('./messages/parrot.json');
var logger;

var client = net.connect(20000, function() {
    logger = new util.Logger(module.moduleCode, "info");
    logger.info("Module loaded");
    client.write(JSON.stringify(module));
});

info = function(to, text) {    
    logger.info("Received !t command");
    var IRCMessage = require('./messages/IRCMessage.json');
    IRCMessage.to = to;
    IRCMessage.text = "Parrot: " + text.join(" ");
    client.write(JSON.stringify(IRCMessage));
}

unload = function(message) {    
    for (var i in message) {
        if (message[i].toLowerCase() == module.moduleCode.toLowerCase()) {
            logger.info("Unload command received");
            client.end();
            return;
        }
    }    
}

client.on('data', function(data) {    
    try { 
        var message = JSON.parse(data.toString());        
        var to = message.to;
        var textArray = message.text.split(" ");
        var command = textArray[0];
        switch (command) {
            case "!parrot": info(to, textArray.slice(1,textArray.length)); break;
            case "!unload": unload(textArray.slice(1,textArray.length)); break;
            default: logger.warning("Unrecognised command");
        }
    } catch(e) {
        logger.error(e);
        logger.warning("Received a non JSON string");
    }    
});

client.on('end', function() {
    logger.warning("Client shutting down...");
});