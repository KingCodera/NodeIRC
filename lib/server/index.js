'use strict';

// System requires.
var irc = require('irc');
var colors = require('colors');

// Local requires.
var util = require('../util/util.js');
var Agent = require('./agent');

module.exports = Controller;

// config files.
Controller.botsConfig = util.config.read('bots');
var srvConfig = util.config.read('server');

// variables.
Controller.bots = [];
//var server = new srv(srvConfig, util, botConnector);

var srvPrefix = '[Server]'.yellow;

Controller.logger = new util.Logger(srvPrefix, srvConfig.logLevel);
Controller.logger.info('Logger connected');

function Controller() {
    var botsConfig = Controller.botsConfig;
    if (botsConfig !== undefined) {
        Controller.logger.info('Loading bots...');
        for (var i in botsConfig) {
            var botConfig = botsConfig[i];
            Controller.logger.info('Starting bot: ' + botConfig.nick.blue);
            var bot = new Agent(botConfig, Controller.botCloseFunc, Controller.botConfigFunc, srvConfig.logLevel);            
            Controller.bots.push(bot);
        }
        Controller.logger.info('Done loading bots!');
    }
}

Controller.botConnector = function(nick, moduleName, channels, commands) {
    var bot = Controller.findBot(nick);
    if (bot != undefined) {

    } else {
        logger.warning('Bot: ' + nick.cyan + ' not found!');
    }
};

Controller.findBot = function(nick) {
    for (var i in Controller.bots) {                
        if (Controller.bots[i].config.nick == nick) {
            return Controller.bots[i];
        }
    }
};

Controller.botCloseFunc = function(agent, restart) {
    var bot = Controller.bots.splice(Controller.bots.indexOf(agent), 1);
    var config = agent.config;
       
    //delete bot;
    //delete agent;

    if (restart) {
        var newBot = new Agent(config, Controller.botCloseFunc, Controller.botConfigFunc, srvConfig.logLevel);
        Controller.bots.push(newBot);
        Controller.logger.info('Restarted: ' + config.nick.blue);
    } else {
        Controller.logger.info('Shut down: ' + config.nick.blue);
    }

    if (Controller.bots.length == 0) {
        process.exit(0);
    }
};

Controller.botConfigFunc = function(bot) {
    for (var i in Controller.botsConfig) {
        if (Controller.botsConfig[i].nick === bot.config.nick) {
            Controller.botsConfig[i] = bot.config;
            util.config.write('bots', Controller.botsConfig);
            return;
        }
    }

    Controller.logger.warning('Bot: ' + bot.nick.cyan + ' not found!');
};

var controller = new Controller();

process.on('exit', function() {
    Controller.logger.info('Shutting down...');    
});
