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
    this.selfcheck = true;
    this.selfCheckString = options.commandChar + 'selfping';
    this.logger = new util.Logger(this.options.nick.blue, this.options.logLevel || 'info');
    this.whoBusy = false;
    this.whoData = [];
    this.awaiting = [];
    this.util = util;
    this.operatorChannels = _.chain(this.options.channels).filter({mode: 'operator'}).map(function(channel) { return channel.name; }).value();

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
        this.logger.info('Not registered. Restarting...');        
        this.server.restartAgent(this);
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

    var selfCheckInterval = setInterval(function() {
        this.selfCheckBeat.bind(this);
        if (this.connected) { 
            this.client.say(this.options.nick, this.selfCheckString);
            return;
        }
        this.logger.error('Connection failure');
        this.client.conn.end();
    }.bind(this), 60000);

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
    }.bind(this));

    this.client.conn.addListener('error', function() {
        this.logger.error('Disconnected (Error)');        
        this.server.restartAgent(this);        
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
            //this.logger.info('Incomming ' + 'CTCP '.red + type.red + ' command! Message: ' + text.yellow);
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

Agent.prototype.selfCheckBeat = function() {
    if (this.selfcheck) {
        this.selfcheck = false;
    } else {
        this.connected = false;
    }
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
        else if (this.awaiting.indexOf(message.nick) >= 0) {
            this.awaiting.splice(this.awaiting.indexOf(message.nick), 1)
            message.command = message.rawCommand = 'PRIVMSG';
            console.log(message);
            this.client.emit('message', message.nick, message.args[0], message.args[1], message);
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
            // Message send to self to check if bot is still online.
            case 'selfping':
                this.selfcheck = true;                
                break;
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
            case 'analyse':
                this.commandAnalyse(to, textArray[1], nick);
                break;
            case 'why':
                this.commandWhy(to, textArray[1], nick);
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

Agent.prototype.commandLog = function(to, requester, argument) {
    if (_.find(this.options.channels, {name: to}).mode !== 'operator') { return; }
    if (!this.isOperator(requester)) { return; }
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

Agent.prototype.isOperator = function(requester) {
    return _.contains(this.allOps(), requester);
};

Agent.prototype.isSuperOperator = function (requester) {
    return _.contains(this.options.pOperators, requester);

}

Agent.prototype.commandAnalyse = function(channel, argument, requester) {
    if (!this.isOperator(requester)) { return; }
    if (this.whoBusy) { return; };    
    this.whoBusy = true;    
    var target = channel;    
    if (argument === undefined) {
        target = channel;
    } else {
        target = argument;
    }    
    this.whoData = {
        "origin": channel,
        "target": target,
        "data": [
        ]
    };
    this.client.send('WHO', target);
    this.client.once('raw', this.processWho.bind(this));
};

Agent.prototype.processWho = function(message) {
    switch (message.rawCommand) {
        case '315':
            this.logger.info('End of list received, building report.');
            this.reportWho();
            break;
        case '352':
            var obj = {
                "username": message.args[2],
                "mask": message.args[3],                
                "nickname": message.args[5],
                "flags": message.args[6],
                "info": message.args[7]
            }
            this.whoData.data.push(obj);
            this.client.once('raw', this.processWho.bind(this));            
            break;
        case '324':
            // Channel modes
            this.client.once('raw', this.processWho.bind(this));
            break;
        case '329':
            // Channel creation time
            this.client.once('raw', this.processWho.bind(this));
            break;
        default:             
            this.client.once('raw', this.processWho.bind(this));
            break;
    }
};

Agent.prototype.reportWho = function() {
    var to = this.whoData.origin;    
    this.client.say(to, 'Channel report for \x0313' + this.whoData.target + '\x0F:');
    var data = this.whoData.data;
    var totalUsers = data.length;
    var hereUsers = 0;
    var awayUsers = 0;
    var opUsers = 0;
    var hopUsers = 0;
    var sopUsers = 0;
    var vopUsers = 0;
    var ircOpUsers = 0;
    var founders = 0;
    var registeredUsers = 0;
    var unregisteredUsers = 0;
    var identdUsers = 0;
    var normalUsers = 0;
    var females = 0;

    var flags = _.pluck(data, 'flags');
    var usernames = _.pluck(data, 'username');
    var nicknames = _.pluck(data, 'nickname');

    for (var i in flags) {
        var element = flags[i];        
        switch (true) {
            case /H/.test(element): hereUsers += 1; break;
            case /G/.test(element): awayUsers += 1; break;
            default: break;
        }
        switch (true) {
            case /r/.test(element): registeredUsers += 1; break;
            default: unregisteredUsers += 1; break;
        }
        switch (true) {
            case /\+/.test(element): vopUsers += 1; break;
            case /&/.test(element): sopUsers += 1; break;
            case /@/.test(element): opUsers += 1; break;
            case /~/.test(element): founders += 1; break;
            case /%/.test(element): hopUsers += 1; break;
            default: normalUsers += 1; break;
        }
        switch (true) {            
            case /\*/.test(element): ircOpUsers += 1; break;            
            default: break;            
        }
    }

    for (var i in usernames) {        
        if (!(usernames[i].charAt(0) === '~')) { identdUsers += 1; }
    }

    for (var i in nicknames) {
        switch (nicknames[i]) {
            case 'Mariko-sama': females += 1; break;
            case 'Manabi': females += 1; break;
            case 'MickeyK': females += 1; break;
            case 'A_Certain_Psi_AnnTific_Railgun': females += 1; break;
            case 'sakurahime': females += 1; break;
            case 'Stayfit': females += 1; break;
            default: if (Math.random() < 0.01) { females += 1; } break;
        }
    }

    this.client.say(to, 'Total users: \x02' + totalUsers + '\x0F of which \x02' + awayUsers + '\x0F are away.');
    this.client.say(to, 'Founders: ' +  founders + ' \x0303::\x0F Admins: ' + sopUsers + ' \x0303::\x0F Operators: ' + opUsers + ' \x0303::\x0F Halfops: ' + hopUsers + ' \x0303::\x0F Voiced: ' + vopUsers + ' \x0303::\x0F Normal: ' + normalUsers);
    var string = '';
    if (ircOpUsers > 0) {
        string += (to, 'IRC Operators: ' + ircOpUsers + ' \x0303::\x0F ');
    }
    string += 'Registered users: ' + registeredUsers + ' \x0303::\x0F Unregistered users: ' + unregisteredUsers + ' \x0303::\x0F Users using IdentD: ' + identdUsers;
    this.client.say(to, string);
    this.client.say(to, 'Males: ' + (totalUsers - females) + ' \x0303::\x0F Females: ' + females);

    this.whoBusy = false;
};

Agent.prototype.commandWhy = function(channel, whyNick, requester) {
    if (!this.isOperator(requester)) { return; }
    if (whyNick === '') { return; }
    this.client.say('ChanServ', 'why ' + channel + ' ' + whyNick);   

    var callback = function(nick, to, text, message) {
        if (nick === 'ChanServ' && to === this.options.nick) {
            var regex = /\cB has \cB| access to |. Reason: |. Main nick: |\.|\cB/;
            var arugment = text.split(regex).filter(function(v) { return v !== ''});
            switch(arugment.length) {                
                case 4:
                    // User is not identified.
                    this.client.say(channel, whyNick + ' has not identified.');
                    break;
                case 5:
                    // User is identified.
                    this.client.say(channel, whyNick + ' main nick: ' + arugment[4] + '.');
                    break;
                default:
                    // Unknown return.
                    this.client.say(channel, 'ChanServ returned unknown reply.');
                    break;
            }            
        }
    }

    this.client.once('notice', callback.bind(this));
};

Agent.prototype.commandChangeOperator = function(to, requester, command, nicks) {
    if (!this.isOperator(requester)) { return; }

    if (!command) {
        return this.client.say(to, 'No argument specified, use either add, del or list');
    }
    command = command.toLowerCase();

    if (!_.contains(['add', 'list', 'del'], command)) {
        return this.client.say(to, 'Invalid argument specified, use either add, del or list');
    }

    if (command === 'list') {
        return this.client.say(to, 'Agent operators are: [\x0311' + this.allOps().join('\x0F, \x0311') + '\x0F]');
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

Agent.prototype.commandDisconnect = function(to, requester) {
    if (this.isSuperOperator(requester)) {
        this.logger.info('Disconnecting...');
        this.client.disconnect('Disconnect request by Operator');
        this.server.closeAgent(this);
    }
};

Agent.prototype.commandChannels = function(to) {    
    if (!_.contains(this.operatorChannels, to)) { return; }
    this.client.say(to, 'Currently on: [\x0313' +  _.pluck(this.options.channels, 'name').join('\x0F, \x0313') + '\x0F]');
};

Agent.prototype.commandRestart = function(to, requester) {
    if (!this.isOperator(requester)) { return; }
    this.client.say(to, 'Attempting to restart...');
    this.server.restartAgent(this);
};

Agent.prototype.disconnect = function() {
    this.moduleController.disconnect();
    this.client.disconnect();
}
