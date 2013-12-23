// System requires.
var irc = require('irc');
var colors = require('colors');

// Local requires.
var util = require('./util/util.js');
var Agent = require('./Agent.js');
var Server = require('./Server.js');

// config files.
var botsConfig = util.config.read("bots");
var srvConfig = util.config.read("server");

// variables.
var bots = [];
//var server = new srv(srvConfig, util, botConnector);

var srvPrefix = "[Server]".yellow;
var logger = new util.Logger(srvPrefix, srvConfig.logLevel);
logger.info("Logger connected");

if (botsConfig !== undefined) {
    logger.info("Loading bots...");      
    for (var i in botsConfig) { 
        var botConfig = botsConfig[i];
        logger.info("Starting bot: " + botConfig.nick.blue);
        var bot = new Agent(botConfig, botCloseFunc, botConfigFunc, util);
        bots.push(bot);
    }    
    logger.info("Done loading bots!");
}

function botConnector(nick, moduleName, channels, commands) {
    var bot = findBot(nick);
    if (bot != undefined) {

    } else {
        logger.warning("Bot: " + nick.cyan + " not found!");
    }
}

function findBot(nick) {
    for (var i in bots) {                
        if (bots[i].config.nick == nick) {
            return bots[i];
        }
    }    
}

function botCloseFunc(bot, restart) {
    bots.splice(bots.indexOf(bot), 1);
    if (restart) {        
        var bot = new bot(bot.config, botCloseFunc, botConfigFunc, util);
        bots.push(bot);
        logger.info(bot.logName + "Restarted");
    } else {
        logger.info(bot.logName + "Shut down");    
    }    
    if (bots.length == 0) {
        process.exit(0);
    }
}

function botConfigFunc(bot) {    
    for (var i in botsConfig) {                
        if (botsConfig[i].nick == bot.config.nick) {
            botsConfig[i] = bot.config;
            util.config.write("bots", botsConfig);
            return;
        }
    }    
    logger.warning("Bot: " + bot.nick.cyan + " not found!");
}

process.on('exit', function() {
    logger.info("Shutting down...");    
});