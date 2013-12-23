var irc = require('irc');

var infoString = "[" + irc.colors.wrap("dark_green","INFO") + "] ";
var warningString = "[" + irc.colors.wrap("orange","WARN") + "] ";
var errorString = "[" + irc.colors.wrap("light_red","FAIL") + "] ";

module.exports = AgentLogger;
AgentLogger.prototype.agent;
AgentLogger.prototype.log;
AgentLogger.prototype.logLevel;

function AgentLogger(agent) {
    this.agent = agent;
    this.logger = agent.logger;
    this.logLevel = agent.config.logLevel.toLowerCase();
}

AgentLogger.prototype.updateLog = function(logLevel) {
    this.logLevel = logLevel;
}

AgentLogger.prototype.logChange = function(message) {
    for (var i in this.agent.operatorChannels) {
        this.agent.client.say(this.agent.operatorChannels[i], infoString + message);
    }
}

AgentLogger.prototype.info = function(message) {    
    if (this.isInfoLevel()) {
        for (var i in this.agent.operatorChannels) {
            this.agent.client.say(this.agent.operatorChannels[i], infoString + message);
        }
    }
}

AgentLogger.prototype.warning = function(message) {    
    if (this.isWarningLevel()) {
        for (var i in this.agent.operatorChannels) {
            this.agent.client.say(this.agent.operatorChannels[i], warningString + message);
        }
    }
}

AgentLogger.prototype.error = function(message) {    
    if (this.isErrorLevel()) {
        for (var i in this.agent.operatorChannels) {
            this.agent.client.say(this.agent.operatorChannels[i], errorString + message);
        }
    }
}

AgentLogger.prototype.isInfoLevel = function() {
    switch (this.logLevel) {
        case "info": return true;
        default: return false;
    }
}

AgentLogger.prototype.isWarningLevel = function() {
    switch (this.logLevel) {
        case "info": return true;
        case "warning": return true;
        default: return false;
    }
}

AgentLogger.prototype.isErrorLevel = function() {
    switch (this.logLevel) {
        case "info": return true;
        case "warning": return true;
        case "error": return true;
        default: return false;
    }
}