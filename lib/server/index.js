'use strict';

require('colors');
var _ = require('lodash');

// Local requires.
var util = require('../util/util.js');
var serverAgent = require('./agent');

module.exports = moduleServer;

function moduleServer(options) {
    /*jshint validthis:true */

    this.options = options;
    this.agents = [];
    this.logger = new util.Logger(
        (this.options.prefix || '[Server]').yellow,
        this.options.logLevel || 'info'
    );
    this.logger.info('Logger connected');

    this.disconnect = function() {
        this.logger.info('Shutting down...');
        for (var i = 0; i < this.agents.length; i++) {
            this.closeAgent(this.agents, true);
        }
    };

    this.connectAgent = function(options) {
        this.logger.info('Connecting agent: ' + options.nick.blue);
        var agent = null;
        try {
            agent = new serverAgent(options, this);
        } catch (error) {
            this.logger.error('Error connecting agent ' + options.nick.blue + ': ' + error.message);
            this.logger.error('Agent ' + options.nick.blue + ' was not loaded');
            return;
        }
        this.agents.push(agent);
        return agent;
    };

    this.restartAgent = function(agent) {        
        if (typeof(agent) === 'string') {
            agent = _.find(this.agents, {nick: agent});
        }
        if (!agent) { return; }
        
        this.logger.warning('Attempting to restart agent: ' + agent.options.nick);

        // Disconnect old agent
        agent.disconnect();
        this.logger.warning('Disconnected old agent');

        // Remove agent from list
        _.remove(this.agents, {nick: agent.options.nick});
        this.logger.warning('Removed old agent from list');
        // Reconnect agent with same options
        this.connectAgent(agent.options);
        this.logger.warning('Reconnected new agent');
    }

    this.closeAgent = function(agent, closing) {
        if (typeof(agent) === 'string') {
            agent = _.find(this.agents, {nick: agent});
        }
        if (!agent) { return; }

        agent.disconnect();        

        _.remove(this.agents, {nick: agent.nick});
        if (!this.agents.length && !closing) {
            this.logger.error('No agents are connected. Shutting down server.');
            process.exit(0);
        }
        return agent;
    };

    process.on('exit', this.disconnect.bind(this));
}
