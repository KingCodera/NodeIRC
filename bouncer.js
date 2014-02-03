var irc = require('irc');
var fs = require('fs');

var reg = require('./util/register.js');
var conf = require('./conf/entity.json');
var channels = require('./conf/channels.json');
var log = require('./util/log.js');

var logging = conf.logging;
var commandChar = conf.commandChar;

var bot = new irc.Client(conf.server, conf.botName, {
    userName: conf.userName,
    channels: channels.development
});

reg.config(conf, bot);
writeConf = function() {
    fs.writeFile('./conf/entity.json', JSON.stringify(conf, null, 4), function(err) {
        if(err) {
            log.error(err);
        } else {
            log.info("New settings saved.");
        }
    });
}

bot.addListener("registered", reg.identify);

bot.addListener("ping", function(server) {
    log.info("Replied to " + "PING".red + " command from: " + server.cyan);
    if (logging) {
        bot.say(channels.development[0], "Replied to " + irc.colors.wrap("light_red","PING") + " command from: " + irc.colors.wrap("cyan", server));
    }
});

bot.addListener("ctcp-version", function(nick, to, message) {
    log.info("Replied to " + "CTCP VERSION".red + " command from: " + nick.cyan);
    bot.ctcp(nick, "VERSION", "VERSION Custom node.js IRC Client v0.1.1");
    if (logging) {
        bot.say(channels.development[0], "Replied to " + irc.colors.wrap("light_red","CTCP VERSION") + " command from: " + irc.colors.wrap("cyan", nick));
    }    
});

bot.addListener("message", function(nick, to, text, message) {
    // Check if a command is sent
    if (text[0] == commandChar) {
        var textArray = text.toLowerCase().split(" ");
        if (textArray[0] == "!log") {
            if (textArray[1] == "on") {
                logging = true;
                bot.say(channels.development[0], "Logging " + irc.colors.wrap("dark_green","ENABLED"));
                conf.logging = true;
                writeConf();
            } else if (textArray[1] == "off") {
                logging = false;
                bot.say(channels.development[0], "Logging " + irc.colors.wrap("light_red","DISABLED"));
                conf.logging = false;
                writeConf();                
            } else {
                log.warning("Unknown command received: " + textArray[1].yellow);
            }
        }
    }
});

bot.addListener("ctcp", function(nick, to, text, type, message) {
    log.info("Incomming " + "CTCP ".red + type.red + " command! Message: " + text.yellow);
    if (text == "TIME") {
        var date = new Date();
        var hour = date.getHours();
        var min = date.getMinutes();
        var sec = date.getSeconds();
        var year = date.getFullYear();
        var month = date.getMonth();
        var day = date.getDay();       

        var string = year + "/" + month + "/" + day + " " + hour + ":" + min + ":" + sec;

        log.info("Replied to " + "CTCP TIME".red + " command from: " + nick.cyan);
        if (logging) {
            bot.say(channels.development[0], "Replied to " + irc.colors.wrap("light_red","CTCP TIME") + " command from: " + irc.colors.wrap("cyan", nick));
        }
        bot.ctcp(nick, text, "TIME " + string);
    }
});

bot.addListener("error", function(message) {
    log.error("Server error command: " + message.command);
});

exports.bot = bot;
exports.writeConf = writeConf;