var irc = require('irc');
var colors = require('colors');
var util = require('./util/util.js');

module.exports = Agent;

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
    for (var i in agent.config.channels) {
        var channel = agent.config.channels[i];
        agent.client.join(channel.name, function() {
            agent.logger.info("[" + i + "]" + "Join channel: " + channel.name.magenta);
        });

        agent.currentChannels.push(channel.name);

        switch (channel.mode) {
            case "operator": agent.operatorChannels.push(channel.name); break;
            case "persistent": agent.persistentChannels.push(channel.name); break;
            case "active": agent.activeChannels.push(channel.name); break;
            default: break;
        }
    }
}

function Agent(config, closeFunc, configFunc, consoleLogLevel) {        
    this.channels = [];
    this.currentChannels = [];
    this.operatorChannels = [];
    this.persistentChannels = [];
    this.activeChannels = [];
    this.util = util;
    this.config = config;    
    this.closeFunc = closeFunc;
    this.configFunc = configFunc;    

    this.logger = new util.Logger(config.nick.blue, consoleLogLevel);        
    this.agentLogger = new util.AgentLogger(this);   

    // Fucking pointer to self.
    var agent = this;  

    try {
        client = new irc.Client(config.server, config.nick, {
            port: config.port,
            userName: config.name
        });        
    } catch (err) {
        agent.logger.error("Error while connecting: " + err);
    }
    
    this.client = client;
    client.connected = false;
    client.passwordOk = true;

    client.addListener("registered", function(message) {        
        client.connected = true;
    });

    this.IIID = setInterval(function() {
        checkIdentified(agent);
    }, 2000);

    function checkIdentified(agent) {
        if (agent.client.identified) {
            clearInterval(agent.IIID);
            agent.logger.info("Joining channels");
            Agent.joinChannels(agent);
        } else if (!agent.client.passwordOk) {
            agent.logger.warning("Password incorrect");
            clearInterval(agent.IIID);
            if (agent.config.allowUnidentified) {
                Agent.joinChannels(agent);
            } else {
                agent.logger.error("Configuration does not allow unidentified nicks");
                agent.client.disconnect();
                agent.closeFunc(agent, false);
            }
        } else {
            agent.logger.info("Attempting to identify");
            try {
                agent.client.say("nickserv", "IDENTIFY " + agent.config.pass);
            } catch (err) {
                clearInterval(agent.IIID);
                agent.logger.error("Error while identifying");
                agent.client.disconnect();
                agent.closeFunc(agent, false);                
            }
        }
    }

    client.addListener("raw", function(message) {
        if (message.rawCommand == "MODE" && message.args[0] == agent.config.nick && message.args[1] == "+r") {
            agent.logger.info("Identified to NICKSERV");
            agent.client.identified = true;                        
        }

        if (message.args[1] == "Password incorrect.") {
            agent.client.passwordOk = false;
        }
        
        /*
        if (message.nick == "NickServ" && message.rawCommand == "NOTICE") {
            agent.logger.info("prefix: " + message.prefix);            
            for (var i in message.args) {
                agent.logger.info("args: " + message.args[i]);
            }        
        } 
        */       
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
        closeFunc(agent, false);
    }

    this.heartBeatID = setTimeout(heartBeat, 250000);;

    client.addListener("ping", function(origin) {
        agent.logger.info("Replied to " + "CTCP PING".red + " command from: " + origin.red);
        agent.agentLogger.info("Replied to " + irc.colors.wrap("light_red","CTCP PING") + " command from: " + irc.colors.wrap("light_cyan", origin));

        // If no response after 250 seconds, restart.
        clearTimeout(agent.heartBeatID);
        heartBeatID = setTimeout(heartBeat, 250000);
    });

    function heartBeat() {
        agent.logger.error("Lost connection to server: " + agent.config.server.grey);
        agent.closeFunc(agent, true);
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

    client.addListener("ctcp", function(nick, to, text, type, message) {   
        switch (text) {
            case "TIME":         
                agent.logger.info("Replied to " + "CTCP TIME".red + " command from: " + nick.cyan);
                agent.agentLogger.info("Replied to " + irc.colors.wrap("light_red","CTCP TIME") + " command from: " + irc.colors.wrap("light_cyan", nick));
                client.ctcp(nick, "TIME", "TIME " + agent.util.getTime());
                break;
            case "VERSION": 
                agent.logger.info("Replied to " + "CTCP VERSION".red + " command from: " + nick.cyan);
                agent.agentLogger.info("Replied to " + irc.colors.wrap("light_red","CTCP VERSION") + " command from: " + irc.colors.wrap("light_cyan", nick));
                client.ctcp(nick, "VERSION", "VERSION Custom node.js IRC Client v0.1.1");        
                break;
            default:
                agent.logger.info("Incomming " + "CTCP ".red + type.red + " command! Message: " + text.yellow);
                break;        
        }
    });

    client.addListener("error", function(message) {
        agent.logger.error("IRC Error: " + message.command);
        agent.agentLogger.error("Server error command: " + message.command);
    });
    
    delete agent;   
}

Agent.commandLog = function(agent, to, nick, argument) {
    if (agent.operatorChannels.indexOf(to) == -1) { return; }
    if (!Agent.checkOperator(agent, nick)) { return; }
    switch (argument) {
        case "info":            
            agent.config.logLevel = "info";            
            agent.configFunc(agent);
            agent.logger.info("Log level of: changed to: " + "INFO".green);
            agent.agentLogger.updateLog(agent.config.logLevel);
            agent.agentLogger.logChange("Log level changed to: " + agent.agentLogger.currentLogLevel());
            break;
        case "warning":            
            agent.config.logLevel = "warning";
            agent.configFunc(agent);
            agent.logger.info("Log level of: changed to: " + "WARNING".yellow);
            agent.agentLogger.updateLog(agent.config.logLevel);
            agent.agentLogger.logChange("Log level changed to: " + agent.agentLogger.currentLogLevel());
            break;
        case "error":            
            agent.config.logLevel = "error";
            agent.configFunc(agent);
            agent.logger.info("Log level changed to: " + "ERROR".red);
            agent.agentLogger.updateLog(agent.config.logLevel);
            agent.agentLogger.logChange("Log level changed to: " + agent.agentLogger.currentLogLevel());
            break;
        case "off":            
            agent.config.logLevel = "off";
            agent.configFunc(agent);
            agent.logger.info("Log level changed to: OFF");
            agent.agentLogger.updateLog(agent.config.logLevel);
            agent.agentLogger.logChange("Log level changed to: " + agent.agentLogger.currentLogLevel());
            break;
        default:  
            agent.client.say(to, "Current log level: " + agent.agentLogger.currentLogLevel());          
            break;
    }        
}

Agent.checkOperator = function(agent, nick) {
    var operators = agent.util.arrayToLowerCase(agent.config.pOperators.concat(agent.config.operators));
    if (operators.indexOf(nick.toLowerCase()) >= 0) { return true; };
    return false;
}

Agent.checkProtectedOperator = function(agent, nick) {
    var pOperators = agent.util.arrayToLowerCase(agent.config.pOperators);
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
        var string = agent.util.arrayToLowerCase(addedOperators);
        agent.logger.info("Added: [" + agent.util.arrayToString(addedOperators, "cyan", "console") + "] to Operators list by: " + requester.cyan);
        agent.client.say(to, "Added: [" + agent.util.arrayToString(addedOperators, "light_cyan", "irc") + "] to Operators list");
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
        agent.logger.info("Removed: [" + agent.util.arrayToString(removedOperators, "cyan", "console") + "] from Operators list by: " + requester.cyan);
        agent.client.say(to, "Removed: [" + agent.util.arrayToString(removedOperators, "light_cyan", "irc") + "] from Operators list");
    }

    if (protectedOperators.length > 0) {
        var string = util.arrayToLowerCase(protectedOperators);        
        agent.logger.warning("Attempt to remove protected operators by: " + requester.cyan);
        agent.client.say(to, "These Operators are protected: [" + agent.util.arrayToString(string, "light_cyan", "irc") + "] and cannot be removed");
    }

    if (bChanged) { agent.configFunc(agent); }
}

Agent.commandDisconnect = function(agent, to, nick) {        
    if (Agent.checkProtectedOperator(agent, nick)) { 
        agent.agentLogger.logChange("Disconnecting...");
        agent.logger.info("Disconnecting...");
        agent.client.disconnect("Disconnect request by Operator");
        agent.closeFunc(agent, false);
    } else {
        agent.client.say(to, irc.colors.wrap("light_cyan", nick) + " you are not a bot Super Operator");
        agent.logger.warning("Disconnect attempt by unauthorized person: " + nick.cyan);
    }
    agent.logger.warning("Removing listeners");
    var emitter = agent.client.removeAllListeners();
    agent.logger.info(emitter);
}

Agent.commandChannels = function(agent, to) {            
    var channels = agent.config.channels;
    for (var i in channels) {
        var channel = channels[i];
        if (Agent.isOperatorChannel(channel) && channel.name == to) {            
            var string = agent.util.arrayToString(agent.currentChannels, "light_magenta", "irc");
            agent.client.say(to, "Currently on: [" + string + "]");
        }      
    }
}

Agent.commandRestart = function(agent, to, nick) {
    clearInterval(agent.intervalID);
    clearTimeout(agent.timerID);
    clearTimeout(agent.heartBeatID);
    agent.client.removeAllListeners(['ctcp']);

    if (Agent.checkProtectedOperator(agent, nick)) { 
        agent.agentLogger.logChange("Restarting...");        
        agent.client.disconnect("Restart request by Operator: " + nick.cyan, function() {
            setTimeout(function() { agent.closeFunc(agent, true); }, 2000 );
        });        
    } else {
        agent.client.say(to, agent.util.arrayToString([nick], "light_cyan", "irc") + " you are not a bot Super Operator");
        agent.logger.warning("Restart attempt by unauthorized person: " + nick.cyan);
    }

    
}