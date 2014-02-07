'use strict';

require('colors');
var _ = require('lodash');
var irc = require('irc');
var util = require('../util/util.js');
var ModuleController = require('./controller');

module.exports = Agent;

var allowedOptions = [
    'userName',
    'realName',
    'password',
    'port',
    'debug',
    'showErrors',
    'autoRejoin',
    'autoConnect',
    'secure',
    'selfSigned',
    'certExpired',
    'floodProtection',
    'floodProtectionDelay',
    'sasl',
    'stripColors',
    'channelPrefixes',
    'messageSplit'
];

function Agent(options, server) {
    /*jshint validthis:true */

    this.server = server;
    this.options = options;
    this.connected = false;
    this.logger = new util.Logger(this.options.nick.blue, this.options.logLevel || 'info');

    if (!options.channels || !options.channels.length) {
        throw new Error('Agent requires atleast one channel.');
    }
    this.moduleController = new ModuleController(this);

    options = _.defaults(options, {
        sasl: options.BNC,
        floodProtection: true,
        floodProtectionDelay: 500
    });

    this.client = new irc.Client(options.server, options.nick, _.pick(options, allowedOptions));

    var timeout = setTimeout(function() {
        if (this.connected) { return; }
        this.logger.info('Not registered. Disconnecting...');
        this.client.disconnect();
        this.server.closeAgent(this);
    }.bind(this), 5000);

    var interval = setInterval(function() {
        if (!this.connected) { return; }
        clearInterval(interval);
        clearTimeout(timeout);
        this.options.channels.forEach(function(channel) {
            this.joinChannel(channel);
        }.bind(this));
    }.bind(this), 100);

    if (!this.options.BNC) {
        this.heartBeatID = setTimeout(this.heartBeat.bind(this), 300000);
        this.client.addListener('ping', this.ping.bind(this));
    }

    this.client.addListener('registered', function() { this.connected = true; }.bind(this));
    this.client.addListener('raw', this.newRawMessage.bind(this));
    this.client.addListener('message', this.newMessage.bind(this));
    this.client.addListener('ctcp', this.ctcp.bind(this));
    this.client.conn.addListener('close', function() {
        this.logger.error('Disconnected (Close)');
        this.closeError = true;
        this.client.conn.end();
    }.bind(this));
    this.client.conn.addListener('end', function() {
        if (!this.closeError) {
            this.logger.error('Disconnected (End)');
        }
        this.client.disconnect();
        this.server.closeAgent(this);
    }.bind(this));

    this.client.addListener('error', function(message) {
        this.logger.error('IRC Error: ' + message.command);
    }.bind(this));
}

Agent.prototype.ctcp = function(nick, to, text, type) {
    switch (text) {
        case 'TIME':
            this.logger.info('Replied to ' + 'CTCP TIME'.red + ' command from: ' + nick.cyan);
            this.client.ctcp(nick, 'TIME', 'TIME ' + this.util.getTime());
            break;
        case 'VERSION':
            this.logger.info('Replied to ' + 'CTCP VERSION'.red + ' command from: ' + nick.cyan);
            this.client.ctcp(nick, 'VERSION', 'VERSION Custom node.js IRC Client v0.1.1');
            break;
        default:
            this.logger.info('Incomming ' + 'CTCP '.red + type.red + ' command! Message: ' + text.yellow);
            break;
    }
};

Agent.prototype.ping = function() {
    clearTimeout(this.heartBeatID);
    this.heartBeatID = setTimeout(this.heartBeat.bind(this), 300000);
};

Agent.prototype.heartBeat = function() {
    this.logger.warning('No PING request from: ' + this.options.server.yellow);
    this.heartBeatID = setTimeout(this.heartBeat.bind(this), 300000);
};

Agent.prototype.newRawMessage = function(message) {
    if (message.rawCommand === 'MODE' && message.args[0] === this.options.nick && message.args[1] === '+r') {
        this.logger.info('Identified to NICKSERV');
        this.identified = true;
    }
    
    if (message.rawCommand === '324') {
        if (_.find(this.options.channels, {name: message.args[1]})) { return; }
        this.options.channels.push({
            name: message.args[1],
            mode: 'persistent',
        });
    }

    if (message.rawCommand === 'NOTICE') {
        //Check if we have a message from memoserv
        if (message.nick === 'MemoServ') {
            //Display it if its not instructions on how to read the message.
            if (message.args[1].indexOf('msg MemoServ ') === -1) {
                return this.logger.info('[MemoServ]'.yellow + ': ' + message.args[1]);
            }
            //Send the instruction on how to read the message to MemoServ
            var temp = message.args[1];
            this.client.say('MemoServ', temp.slice(temp.indexOf('msg MemoServ ') + 13, temp.indexOf('\u0002', 8)));
        }
        //If we got a notice and it's not a private message, display it.
        //Could be a warning about AUTH (authentication).
        else if (message.args[0] !== this.options.nick) {
            this.logger.info(('[' + message.args[0] + ']').yellow + ': ' + message.args[1]);
        }
    }
};

Agent.prototype.newMessage = function(nick, to, text) {
    // Check if a command is sent        
    if (text[0] === this.options.commandChar) {
        var textArray = text.split(' ');
        // Strip command char from actual command.
        var command = textArray[0].substr(1).toLowerCase();
        switch (command) {
            case 'log':
                this.commandLog(to, nick, textArray[1]);
                break;
            case 'disconnect':
                this.commandDisconnect(to, nick);
                break;
            case 'channels':
                this.commandChannels(to);
                break;
            case 'operator':
                this.commandChangeOperator(to, nick, textArray[1], textArray.slice(2,textArray.length));
                break;
            case 'restart':
                this.commandRestart(to, nick);
                break;
            default:
                break;
        }
    }
};

Agent.prototype.joinChannel = function(channel) {
    if (typeof(channel) === 'string') {
        channel = {
            name: channel,
            mode: 'active'
        };
    }
    this.client.join(channel.name);
    this.logger.info('Join channel: ' + channel.name.magenta);
    return channel;
};

Agent.prototype.moduleAdded = function(newModule) {
    if (newModule.channels.length === 0) { return; }

    for (var i = 0; i < newModule.channels.length; i++) {
        if (_.find(this.options.channels, {name: newModule.channels[i]})) { return; }
        this.options.channels.push(this.joinChannel(newModule.channels[i]));
    }
};

Agent.prototype.deleteModule = function(mod) {
    mod.killListeners();
};

Agent.prototype.commandLog = function(to, nick, argument) {
    if (_.find(this.options.channels, {name: to}).mode !== 'operator') { return; }
    if (!_.contains(this.allOps(), nick)) { return; }
    switch (argument) {
        case 'info':
            this.options.logLevel = 'info';
            this.logger.info('Log level of: changed to: ' + 'INFO'.green);
            break;
        case 'warning':
            this.options.logLevel = 'warning';
            this.logger.info('Log level of: changed to: ' + 'WARNING'.yellow);
            break;
        case 'error':
            this.options.logLevel = 'error';
            this.logger.info('Log level changed to: ' + 'ERROR'.red);
            break;
        case 'off':
            this.options.logLevel = 'off';
            this.logger.info('Log level changed to: OFF');
            break;
        default:
            this.client.say(to, 'Current log level: ' + this.logger.logLevel);
            break;
    }
};

Agent.prototype.allOps = function() {
    return this.options.pOperators.concat(this.options.operators);
};

Agent.prototype.commandChangeOperator = function(to, requester, command, nicks) {
    if (!_.contains(this.allOps(), requester)) { return; }

    if (!command) {
        return this.client.say(to, 'No argument specified, use either add, del or list');
    }
    command = command.toLowerCase();

    if (!_.contains(['add', 'list', 'del'], command)) {
        return this.client.say(to, 'Invalid argument specified, use either add, del or list');
    }

    if (command === 'list') {
        return this.client.say(to, 'Agent operators are: [' + irc.colors.wrap('light_cyan', this.allOps().join(', ')) + ']');
    }
    else if (nicks.length === 0) {
        return this.client.say('Specify at least one nickname');
    }

    if (command === 'add') {
        this.logger.info('Adding: [' + _.difference(nicks, this.allOps()).join(', ').cyan + '] to operators list by: ' + requester.cyan);
        _.difference(nicks, this.allOps()).forEach(function(nick) {
            this.options.operators.push(nick);
        }.bind(this));
    }
    else if (command === 'del') {
        this.logger.info('Removing: [' + _.intersection(nicks, this.options.operators).join(', ').cyan + '] to operators list by: ' + requester.cyan);
        this.options.operators = _.difference(this.operators, nicks);
    }
};

Agent.prototype.commandDisconnect = function(to, nick) {
    if (_.contains(this.options.pOperators, nick)) {
        this.logger.info('Disconnecting...');
        this.client.disconnect('Disconnect request by Operator');
        this.server.closeAgent(this);
    }
};

Agent.prototype.commandChannels = function(to) {
    if (_.find(this.options.channels, {name: to}).mode !== 'operator') { return; }
    this.client.say(to, 'Currently on: [' +  irc.colors.wrap('light_magenta', _.pluck(this.options.channels, 'name').join(', ')) + ']');
};

Agent.prototype.commandRestart = function(to, nick) {
    /* todo: implement :b */
    this.client.say(to, 'Currently unsupported :( sorry ' + nick);
};
