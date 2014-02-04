'use strict';

var irc = require('irc');
var colors = require('colors');
var util = require('../util/util.js');
var ModuleController = require('./ModuleController.js');

module.exports = Agent;

Agent.prototype.channels = [];
Agent.prototype.currentChannels = [];
Agent.prototype.operatorChannels = [];
Agent.prototype.persistentChannels = [];
Agent.prototype.activeChannels = [];
Agent.prototype.util = util;

Agent.isOperatorChannel = function(channel) {
    return channel.mode === 'operator' ? true : false;
};

Agent.isPersistentChannel = function(channel) {
    return channel.mode === 'persistent' ? true : false;
};

Agent.isActiveChannel = function(channel) {
    return channel.mode === 'active' ? true : false;
};

Agent.findChannel = function(channelName, channels) {
    for (var i in channels) {
        if (channels[i].name === channelName) {
            return channels[i];
        }
    }
};

Agent.prototype.checkChannel = function(channel) {
    var unique = true;
    for (var i in this.config.channels) {
        if (this.config.channels[i].name === channel) {
            // Bot already knows it's in this channel.            
            unique = false;
            break;
        }
    }

    if (unique) {
        var configChannel = {};
        configChannel.name = channel;
        configChannel.mode = 'persistent';
        configChannel.modules = [];
        this.config.channels.push(configChannel);
        this.configFunc(this);
        this.currentChannels.push(channel);
    }
};

Agent.joinChannels = function(agent) {
    for (var i in agent.config.channels) {
        if (agent.config.channels.hasOwnProperty(i)) {
            var channel = agent.config.channels[i];
            agent.client.join(channel.name);
            agent.logger.info('[' + i + ']' + 'Join channel: ' + channel.name.magenta);

            agent.currentChannels.push(channel.name);

            switch (channel.mode) {
                case 'operator':
                    agent.operatorChannels.push(channel.name);
                    break;
                case 'persistent':
                    agent.persistentChannels.push(channel.name);
                    break;
                case 'active':
                    agent.activeChannels.push(channel.name);
                    break;
                default:
                    break;
            }
        }
    }
};

function Agent(config, closeFunc, configFunc, consoleLogLevel) {
    this.config = config;
    this.logger = new util.Logger(config.nick.blue, consoleLogLevel);
    this.agentLogger = new util.AgentLogger(this);

    this.moduleController = new ModuleController(this);
    this.closeFunc = closeFunc;
    this.configFunc = configFunc;

    // Fucking pointer to self.
    var agent = this;
    var client = null;

    try {
        if (config.BNC === undefined) {
            config.BNC = false;
        }
        client = new irc.Client(config.server, config.nick, {
            port: config.port,
            nick: config.nick,
            userName: config.name,
            password: config.pass,
            sasl: config.BNC,
            floodProtection: true,
            floodProtectionDelay: 500
        });
    } catch (err) {
        agent.logger.error('Error while connecting: ' + err);
        return;
    }
    
    this.client = client;
    client.connected = false;
    client.passwordOk = true;

    client.addListener('registered', function() {
        client.connected = true;
    });
        
    agent.closeError = false;

    client.conn.addListener('close', function() {
        agent.logger.error('Disconnected (Close)');
        agent.closeError = true;
        agent.client.conn.end();
    });

    client.conn.addListener('end', function() {
        if (!agent.closeError) {
            agent.logger.error('Disconnected (End)');
        }
        agent.client.disconnect();
        agent.closeFunc(agent, true);
    });

    client.addListener('raw', function(message) {
        if (message.rawCommand === 'MODE' && message.args[0] === agent.config.nick && message.args[1] === '+r') {
            agent.logger.info('Identified to NICKSERV');
            agent.client.identified = true;
        }

        if (message.args[1] === 'Password incorrect.') {
            agent.client.passwordOk = false;
        }
        
        if (message.rawCommand === '324') {
            agent.checkChannel(message.args[1]);
        }
    });

    this.intervalID = setInterval(function() {
        checkConnected(agent);
    }, 100);

    this.timerID = setTimeout(function() {
        connectionFailed(agent);
    }, 5000);

    function checkConnected(agent) {
        if (client.connected) {
            clearInterval(agent.intervalID);
            clearTimeout(agent.timerID);
            agent.logger.info('connected to: ' + agent.config.server.yellow);
            Agent.joinChannels(agent);
        }
    }

    function connectionFailed(agent) {
        agent.logger.error('Unable to connect to server: ' + agent.config.server.yellow);
        clearInterval(agent.intervalID);
        clearTimeout(agent.timerID);
        closeFunc(agent, false);
    }

    this.pingerID = setInterval(pingBeat, 5000);

    function pingBeat() {
        agent.client.send('PING', agent.config.server);
    }

    this.heartBeatID = setTimeout(heartBeat, 300000);

    client.addListener('ping', function(origin) {
        agent.logger.info('Replied to ' + 'CTCP PING'.red + ' command from: ' + origin.yellow);
        agent.agentLogger.info('Replied to ' + irc.colors.wrap('light_red','CTCP PING') + ' command from: ' + irc.colors.wrap('yellow', origin));

        // If no response after 300 seconds, restart.
        clearTimeout(agent.heartBeatID);
        agent.heartBeatID = setTimeout(heartBeat, 300000);
    });

    function heartBeat() {
        agent.logger.warning('No PING request from: ' + agent.config.server.yellow);
        //No need to notify again if ping request failed.
        //agent.heartBeatID = setTimeout(heartBeat, 300000);
    }
    
    client.addListener('message', function(nick, origin, text) {
        var commandChar = agent.config.commandChar;
        var to = origin.toLowerCase();
        // Check if a command is sent        
        if (text[0] === commandChar) {
            var textArray = text.split(' ');
            // Strip command char from actual command.
            var command = textArray[0].substr(1).toLowerCase();
            switch (command) {
                case 'log':
                    Agent.commandLog(agent, to, nick, textArray[1]);
                    break;
                case 'disconnect':
                    Agent.commandDisconnect(agent, to, nick);
                    break;
                case 'channels':
                    Agent.commandChannels(agent, to);
                    break;
                case 'operator':
                    Agent.commandChangeOperator(agent, to, nick, textArray[1], textArray.slice(2,textArray.length));
                    break;
                case 'restart':
                    Agent.commandRestart(agent, to, nick);
                    break;
                case 'modules':
                    Agent.listModules(agent, to, nick);
                    break;
                default:
                    break;
            }
        }
    });

    client.addListener('ctcp', function(nick, to, text, type) {
        switch (text) {
            case 'TIME':
                agent.logger.info('Replied to ' + 'CTCP TIME'.red + ' command from: ' + nick.cyan);
                agent.agentLogger.info('Replied to ' + irc.colors.wrap('light_red','CTCP TIME') + ' command from: ' + irc.colors.wrap('light_cyan', nick));
                client.ctcp(nick, 'TIME', 'TIME ' + agent.util.getTime());
                break;
            case 'VERSION':
                agent.logger.info('Replied to ' + 'CTCP VERSION'.red + ' command from: ' + nick.cyan);
                agent.agentLogger.info('Replied to ' + irc.colors.wrap('light_red','CTCP VERSION') + ' command from: ' + irc.colors.wrap('light_cyan', nick));
                client.ctcp(nick, 'VERSION', 'VERSION Custom node.js IRC Client v0.1.1');
                break;
            default:
                agent.logger.info('Incomming ' + 'CTCP '.red + type.red + ' command! Message: ' + text.yellow);
                break;
        }
    });

    client.addListener('error', function(message) {
        agent.logger.error('IRC Error: ' + message.command);
        agent.agentLogger.error('Server error command: ' + message.command);
    });
}

Agent.listModules = function(agent, to) {
    var modules = agent.moduleController.modules;
    var moduleNames = [];

    for (var i in modules) {
        if (modules.hasOwnProperty(i)) {
            moduleNames.push(modules[i].name);
        }
    }
    if (moduleNames.length === 0) {
        agent.client.say(to, 'No modules available.');
    } else {
        agent.client.say(to, 'Available modules: [' + agent.util.arrayToString(moduleNames, 'light_blue', 'irc') + ']');
    }
};

Agent.prototype.addModule = function(module) {
    var channels = module.channels;

    for (var i in channels) {
        if (channels.hasOwnProperty(i)) {
            var channel = channels[i];
            var confChannel;
            if (this.currentChannels.indexOf(channel) === -1) {
                this.client.join(channel);
                this.logger.info('Joined channel: ' + channel.magenta);
                this.currentChannels.push(channel);
                            
                confChannel.name = channel;
                confChannel.mode = 'active';
                confChannel.modules = [module.name];

                this.channels.push(confChannel);
                this.configFunc(this);
                this.logger.info('Added new channel and module.');
                continue;
            }
            for (var j in this.channels) {
                if (this.channels[j].name === channel && this.channels[j].modules.indexOf(module.name) === -1) {
                    this.channels[j].modules.push(module.name);
                    this.configFunc(this);
                    this.logger.info('Added new module to channel: ' + channel.magenta);
                }
            }
        }
    }
};

Agent.prototype.deleteModule = function(module) {
    module.killListeners();
};

Agent.commandLog = function(agent, to, nick, argument) {
    if (agent.operatorChannels.indexOf(to) === -1) { return; }
    if (!Agent.checkOperator(agent, nick)) { return; }
    switch (argument) {
        case 'info':
            agent.config.logLevel = 'info';
            agent.configFunc(agent);
            agent.logger.info('Log level of: changed to: ' + 'INFO'.green);
            agent.agentLogger.updateLog(agent.config.logLevel);
            agent.agentLogger.logChange('Log level changed to: ' + agent.agentLogger.currentLogLevel());
            break;
        case 'warning':
            agent.config.logLevel = 'warning';
            agent.configFunc(agent);
            agent.logger.info('Log level of: changed to: ' + 'WARNING'.yellow);
            agent.agentLogger.updateLog(agent.config.logLevel);
            agent.agentLogger.logChange('Log level changed to: ' + agent.agentLogger.currentLogLevel());
            break;
        case 'error':
            agent.config.logLevel = 'error';
            agent.configFunc(agent);
            agent.logger.info('Log level changed to: ' + 'ERROR'.red);
            agent.agentLogger.updateLog(agent.config.logLevel);
            agent.agentLogger.logChange('Log level changed to: ' + agent.agentLogger.currentLogLevel());
            break;
        case 'off':
            agent.config.logLevel = 'off';
            agent.configFunc(agent);
            agent.logger.info('Log level changed to: OFF');
            agent.agentLogger.updateLog(agent.config.logLevel);
            agent.agentLogger.logChange('Log level changed to: ' + agent.agentLogger.currentLogLevel());
            break;
        default:
            agent.client.say(to, 'Current log level: ' + agent.agentLogger.currentLogLevel());
            break;
    }
};

Agent.checkOperator = function(agent, nick) {
    var operators = agent.util.arrayToLowerCase(agent.config.pOperators.concat(agent.config.operators));
    if (operators.indexOf(nick.toLowerCase()) >= 0) { return true; }
    return false;
};

Agent.checkProtectedOperator = function(agent, nick) {
    var pOperators = agent.util.arrayToLowerCase(agent.config.pOperators);
    if (pOperators.indexOf(nick.toLowerCase()) >= 0) { return true; }
    return false;
};

Agent.commandChangeOperator = function(agent, to, requester, command, nicks) {
    if (command !== undefined) {
        command = command.toLowerCase();
    } else {
        agent.client.say(to, 'No argument specified, use either add, del or list');
        return;
    }

    if ((command === 'add' || command === 'del') && nicks.length === 0) {
        agent.client.say('Specify at least one nickname');
        return;
    }

    // @TODO: Check if nickname is registered.    
    if (Agent.checkOperator(agent, requester)) {
        switch (command) {
            case 'add':
                Agent.commandAddOperator(agent, to, requester, nicks);
                break;
            case 'del':
                Agent.commandDelOperator(agent, to, requester, nicks);
                break;
            case 'list':
                Agent.commandListOperator(agent, to, requester);
                break;
            default:
                agent.client.say('Unknown command.');
                break;
        }
    } else {
        agent.agentLogger.warning('Unauthorized attempt to change operator by: ' + irc.colors.wrap('light_cyan', requester));
        agent.logger.warning('Unauthorized attempt to change operator by: ' + requester.cyan);
    }
};

Agent.commandListOperator = function(agent, to) {
    var operators = agent.config.pOperators.concat(agent.config.operators);
    agent.client.say(to, 'Bot operators are: [' + agent.util.arrayToString(operators, 'light_cyan', 'irc') + ']');
};

Agent.commandAddOperator = function(agent, to, requester, nicks) {
    var addedOperators = [];
    var bChanged = false;
    for (var i in nicks) {
        if (nicks.hasOwnProperty(i)) {
            var nick = nicks[i];
            // Check if nick is already operator.
            if (Agent.checkOperator(agent, nick)) { continue; }

            agent.config.operators.push(nick);
            addedOperators.push(nick);

            bChanged = true;
        }
    }

    if (addedOperators.length > 0) {
        agent.logger.info('Added: [' + agent.util.arrayToString(addedOperators, colors.cyan, 'console') + '] to Operators list by: ' + requester.cyan);
        agent.client.say(to, 'Added: [' + agent.util.arrayToString(addedOperators, 'light_cyan', 'irc') + '] to Operators list');
    }

    if (bChanged) { agent.configFunc(agent); }
};

Agent.commandDelOperator = function(agent, to, requester, nicks) {
    var removedOperators = [];
    var protectedOperators = [];
    var bChanged = false;

    for (var i in nicks) {
        if (nicks.hasOwnProperty(i)) {
            var nick = nicks[i];
            if (!Agent.checkProtectedOperator(agent, nick)) {
                agent.config.operators.splice(agent.config.operators.indexOf(nick), 1);
                removedOperators.push(nick);
                bChanged = true;
            } else {
                protectedOperators.push(nick);
            }
        }
    }

    if (removedOperators.length > 0) {
        agent.logger.info('Removed: [' + agent.util.arrayToString(removedOperators, colors.cyan, 'console') + '] from Operators list by: ' + requester.cyan);
        agent.client.say(to, 'Removed: [' + agent.util.arrayToString(removedOperators, 'light_cyan', 'irc') + '] from Operators list');
    }

    if (protectedOperators.length > 0) {
        agent.logger.warning('Attempt to remove protected operators by: ' + requester.cyan);
        agent.client.say(to, 'These Operators are protected: [' + agent.util.arrayToString(protectedOperators, 'light_cyan', 'irc') + '] and cannot be removed');
    }

    if (bChanged) { agent.configFunc(agent); }
};

Agent.commandDisconnect = function(agent, to, nick) {
    if (Agent.checkProtectedOperator(agent, nick)) {
        agent.agentLogger.logChange('Disconnecting...');
        agent.logger.info('Disconnecting...');
        agent.client.disconnect('Disconnect request by Operator');
        agent.closeFunc(agent, false);
    } else {
        agent.client.say(to, irc.colors.wrap('light_cyan', nick) + ' you are not a bot Super Operator');
        agent.logger.warning('Disconnect attempt by unauthorized person: ' + nick.cyan);
    }
    agent.logger.warning('Removing listeners');
    agent.client.removeAllListeners();
};

Agent.commandChannels = function(agent, to) {
    var channels = agent.config.channels;
    for (var i in channels) {
        if (Agent.isOperatorChannel(channels[i]) && channels[i].name === to) {
            var string = agent.util.arrayToString(agent.currentChannels, 'light_magenta', 'irc');
            agent.client.say(to, 'Currently on: [' + string + ']');
        }
    }
};

Agent.commandRestart = function(agent, to, nick) {
    clearInterval(agent.intervalID);
    clearTimeout(agent.timerID);
    clearTimeout(agent.heartBeatID);

    if (Agent.checkProtectedOperator(agent, nick)) {
        agent.agentLogger.logChange('Restarting...');
        agent.client.disconnect('Restart request by Operator: ' + nick, function() {
            setTimeout(function() { agent.closeFunc(agent, true); }, 2000 );
        });
    } else {
        agent.client.say(to, agent.util.arrayToString([nick], 'light_cyan', 'irc') + ' you are not a bot Super Operator');
        agent.logger.warning('Restart attempt by unauthorized person: ' + nick.cyan);
    }
};
