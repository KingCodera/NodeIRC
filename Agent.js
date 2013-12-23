var irc = require('irc');
var colors = require('colors');

module.exports = Agent;

// Object variables.
Agent.prototype.client;
Agent.prototype.logger;
Agent.prototype.config;
Agent.prototype.agentLogger;
Agent.prototype.closeFunc;
Agent.prototype.configFunc;
Agent.prototype.channels = [];
Agent.prototype.currentChannels = [];
Agent.prototype.operatorChannels = [];
Agent.prototype.persistentChannels = [];
Agent.prototype.activeChannels = [];

grabChannels = function(agent, channels) {
    for (var i in channels) {
        var channel = channels[i];        
        agent.channels.push(channel.name);

        switch (channel.mode) {
            case "operator": agent.operatorChannels.push(channel.name); break;
            case "persistent": agent.persistentChannels.push(channel.name); break;
            case "active": agent.activeChannels.push(channel.name); break;
            default: break;
        }
    }
}

Agent.isOperatorChannel = function(channel) {
    return channel.mode == "operator" ? true : false;
}

Agent.isPersistentChannel = function(channel) {
    return channel.mode == "persistent" ? true : false;
}

Agent.isActiveChannel = function(channel) {
    return channel.mode == "active" ? true : false;
}

Agent.findChannel = function(channelName, channels) {
    for (var i in channels) {
        if (channels[i].name == channelName) {
            return channels[i];
        }
    }
}

Agent.joinChannels = function(agent) {
    for (var i in agent.channels) {
        var channel = agent.channels[i];
        agent.logger.info(channel);
        agent.client.join(channel, function() {
            agent.logger.info("Join channel: " + channel.magenta);
        });
        agent.currentChannels.push(channel);
    }
}

function Agent(config, closeFunc, configFunc, util) {    
    // Fucking pointer to self.
    var agent = this;
    util = util;
    this.config = config;    
    this.closeFunc = closeFunc;
    this.configFunc = configFunc;    

    this.logger = new util.Logger(config.nick.blue, config.logLevel);    
    this.agentLogger = new util.AgentLogger(this);

    // Fold all channels into a single one.    
    grabChannels(agent, config.channels);       

    client = new irc.Client(config.server, config.nick, {
        port: config.port,
        userName: config.name,
        autoConnect: false
    });
    
    this.client = client;
    client.connected = false;   

    client.connect(5);    
    client.logger = this.logger;
    client.agentLogger = this.agentLogger;

    client.addListener("registered", function(message) {        
        client.say("nickserv", "IDENTIFY " + agent.config.pass);
        client.logger.info("NICKSERV identified");
        client.connected = true;
        Agent.joinChannels(agent);
        client.currentChannels = agent.currentChannels;
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
            agent.logger.info("connected to: " + agent.config.server.yellow);            
        }
    }

    function connectionFailed(agent) {
        agent.logger.error("Unable to connect to server: " + agent.config.server.yellow);
        clearInterval(agent.intervalID);
        clearTimeout(agent.timerID);        
        closeFunc(agent.client, false);
    }

    var heartBeatID = setTimeout(heartBeat, 250000);;

    client.addListener("ping", function(origin) {
        logger.info("Replied to " + "CTCP PING".red + " command from: " + origin.red);
        agentLogger.info("Replied to " + irc.colors.wrap("light_red","CTCP PING") + " command from: " + irc.colors.wrap("light_cyan", origin));

        // If no response after 250 seconds, restart.
        clearTimeout(heartBeatID);
        heartBeatID = setTimeout(heartBeat, 250000);
    });

    function heartBeat() {
        logger.error("Lost connection to server: " + config.server.grey);
        client.closeFunc(client, true);
    }
    
    client.addListener("message", function(nick, origin, text, message) {
        var commandChar = agent.config.commandChar;
        var to = origin.toLowerCase();
        // Check if a command is sent        
        if (text[0] == commandChar) {
            var textArray = text.toLowerCase().split(" ");
            // Strip command char from actual command.
            var command = textArray[0].substr(1);
            switch (command) {
                case "log": Agent.commandLog(agent, to, nick, textArray[1]); break;
                case "disconnect": Agent.commandDisconnect(agent, to, nick); break;
                case "channels": Agent.commandChannels(agent, to); break;
                case "operator": Agent.commandChangeOperator(agent, to, nick, textArray[1], textArray.slice(2,textArray.length)); break;
                case "restart": Agent.commandRestart(agent, to, nick); break;
                default: break;
            }
        }
    });

    client.addListener("ctcp-version", function(nick, to, message) {       
    });    

    client.addListener("ctcp", function(nick, to, text, type, message) {        
        switch (text) {
            case "TIME":         
                client.logger.info("Replied to " + "CTCP TIME".red + " command from: " + nick.cyan);
                client.agentLogger.info("Replied to " + irc.colors.wrap("light_red","CTCP TIME") + " command from: " + irc.colors.wrap("light_cyan", nick));
                client.ctcp(nick, "TIME", "TIME " + util.getTime());
                break;
            case "VERSION": 
                client.logger.info("Replied to " + "CTCP VERSION".red + " command from: " + nick.cyan);
                client.agentLogger.info("Replied to " + irc.colors.wrap("light_red","CTCP VERSION") + " command from: " + irc.colors.wrap("light_cyan", nick));
                client.ctcp(nick, "VERSION", "VERSION Custom node.js IRC Client v0.1.1");        
                break;
            default:
                client.logger.info("Incomming " + "CTCP ".red + type.red + " command! Message: " + text.yellow);
                break;        
        }
    });

    client.addListener("error", function(message) {
        client.logger.error("IRC Error!");
        client.agentLogger.error("Server error command: " + message.command);
    });   
}

Agent.commandLog = function(agent, to, nick, argument) {
    if (this.config.channels.operator.indexOf(to) == -1) { return; }
    if (!checkOperator(nick)) { return; }
    switch (argument) {
        case "info":
            agentLogger.logChange("Logging " + irc.colors.wrap("dark_green","INFO"));
            config.logLevel = "info";            
            configFunc(this);
            logger.info("Log level of: changed to: " + "INFO".green);
            break;
        case "warning":
            agentLogger.logChange("Logging " + irc.colors.wrap("orange","WARNING"));
            config.logLevel = "warning";
            configFunc(this);
            logger.info("Log level of: changed to: " + "WARNING".yellow);
            break;
        case "error":
            agentLogger.logChange("Logging " + irc.colors.wrap("light_red","ERROR"));
            config.logLevel = "error";
            configFunc(this);
            logger.info("Log level changed to: " + "ERROR".red);
            break;
        case "off":
            agentLogger.logChange("Logging " + "OFF");
            config.logLevel = "off";
            configFunc(this);
            logger.info("Log level changed to: OFF");
            break;
        default:
            agentLogger.warning("Unknown log level");            
            break;
    }
    agentLogger.updateLog(client.config.logLevel);
}

Agent.checkOperator = function(agent, nick) {
    var operators = util.arrayToLowerCase(agent.config.pOperators.concat(agent.config.operators));
    if (operators.indexOf(nick.toLowerCase()) >= 0) { return true; };
    return false;
}

Agent.checkProtectedOperator = function(agent, nick) {
    var pOperators = util.arrayToLowerCase(agent.config.pOperators);
    if (pOperators.indexOf(nick.toLowerCase()) >= 0) { return true; };
    return false;
}

Agent.commandChangeOperator = function(agent, to, requester, command, nicks) {       
    // @TODO: Check if nickname is registered.    
    if (Agent.checkOperator(agent, requester)) {
        switch (command) {
            case "add": Agent.commandAddOperator(agent, to, requester, nicks); break;
            case "del": Agent.commandDelOperator(agent, to, requester, nicks); break;
            default: break;
        } 
    } else {
        client.agentLogger.warning("Unauthorized attempt to change operator by: " + irc.colors.wrap("light_cyan", requester));
        client.logger.warning("Unauthorized attempt to change operator by: " + requester.cyan);
    }
}

Agent.commandAddOperator = function(agent, to, requester, nicks) {
    var addedOperators = [];
    var bChanged = false;
    for (var i in nicks) {
        var nick = nicks[i];
        // Check if nick is already operator.
        if (Agent.checkOperator(agent, nick)) { continue; }

        agent.config.operators.push(nick);
        addedOperators.push(nick);

        bChanged = true;
    }

    if (addedOperators.length > 0) {
        var string = util.arrayToLowerCase(addedOperators);
        agent.logger.info("Added: [" + string.cyan + "] to Operators list by: " + requester.cyan);
        agent.client.say(to, "Added: [" + irc.colors.wrap("light_cyan",string) + "] to Operators list");
    }

    if (bChanged) { agent.configFunc(agent); }
}

Agent.commandDelOperator = function(agent, to, requester, nicks) {
    var removedOperators = [];
    var protectedOperators = [];
    var bChanged = false;

    for (var i in nicks) {
        var nick = nicks[i];
        if (!Agent.checkProtectedOperator(agent, nick)) {
            agent.config.operators.splice(agent.config.operators.indexOf(nick), 1);
            removedOperators.push(nick);
            bChanged = true;
        } else {
            agent.protectedOperators.push(nick);
        }
    }

    if (removedOperators.length > 0) {
        var string = util.arrayToLowerCase(removedOperators);
        agent.logger.info("Removed: [" + util.arrayToString(string, cyan, "console") + "] from Operators list by: " + requester.cyan);
        agent.client.say(to, "Removed: [" + util.arrayToString(string, "light_cyan", "irc") + "] from Operators list");
    }

    if (protectedOperators.length > 0) {
        var string = util.arrayToLowerCase(protectedOperators);        
        agent.logger.warning("Attempt to remove protected operators by: " + requester.cyan);
        agent.client.say(to, "These Operators are protected: [" + util.arrayToString(string, "light_cyan", "irc") + "] and cannot be removed");
    }

    if (bChanged) { agent.configFunc(agent); }
}

Agent.commandDisconnect = function(agent, to, nick) {        
    if (Agent.checkProtectedOperator(agent, nick)) { 
        agent.agentLogger.logChange("Disconnecting...");
        agent.logger.info("Disconnecting...");
        agent.client.disconnect("Disconnect request by Operator: " + nick);
        agent.client.closeFunc(client, false);        
    } else {
        agent.client.say(to, irc.colors.wrap("light_cyan", nick) + " you are not a bot Super Operator");
        agent.logger.warning("Disconnect attempt by unauthorized person: " + nick.cyan);
    }
}

Agent.commandChannels = function(agent, to) {            
    var channels = agent.config.channels;
    for (var i in channels) {
        var channel = channels[i];
        if (agent.isOperatorChannel(channel) && channel.name == to) {            
            var string = util.arrayToString(agent.currentChannels, "light_magent", "irc");
            agent.client.say(to, "Currently on: [" + string + "]");
        }      
    }
}

Agent.commandRestart = function(agent, to, nick) {
    if (Agent.checkProtectedOperator(agent, nick)) { 
        agent.agentLogger.logChange("Restarting...");        
        agent.client.disconnect("Restart request by Operator: " + nick.cyan);
        setTimeout(function() { closeFunc(agent, true); }, 2000 );
    } else {
        agent.client.say(to, irc.colors.wrap("light_cyan", nick) + " you are not a bot Super Operator");
        agent.logger.warning("Restart attempt by unauthorized person: " + nick.cyan);
    }
}