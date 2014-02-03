module.exports = IRCModule;

IRCModule.prototype.listeners = [];
IRCModule.prototype.agent;

function IRCModule() {
    
}

IRCModule.prototype.setAgent = function(agent) {
    this.agent = agent;
}

IRCModule.prototype.killListeners = function() {
    for (var i in listeners) {
        this.agent.client.removeListener(listeners[i].event, listeners[i].callback);
    }    
}

IRCModule.prototype.send = function(container) {
}