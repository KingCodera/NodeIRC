'use strict';

var fs = require('fs');
var irc = require('../index');
var _ = require('lodash');

// Regex definitions.
var timeRegex = new RegExp(/@[0-9]*/);
var arrayRegex = new RegExp(/\[[0-9]*-[0-9]*\]/);
var topRegex = new RegExp(/#[0-9]/);

var enabled = false;
var voted = [];
var options;
var length;
var channel;
var results = [];
var arrayVote = false;
var topLimit = 5;

var time;
var defaultTime = 10*1000;
var maxTime = 5*60*1000; // Maximum of 5 minutes.

var client = irc.createClient(
    'Vote Module',
    'VOT',
    {time: 100, persistent: true, channels: ['#doki-development', '#doki', '#project-precure', '#Severin']}
);

var reset = function() {
    enabled = false;
    options = [];
    voted = [];
    results = [];
    topLimit = 5;    
    arrayVote = false;
}

var endVoting = function() {
    client.sendText(channel, 'Voting ended, showing results:');
    var output;
    if (arrayVote) {
        output = results.numbers.sort(function(a, b) {return b.votes - a.votes});
    } else {
        output = results.sort(function(a, b) {return b.votes - a.votes});
    }    
    var counter = 1;
    for (var i in output) {        
        if (counter > topLimit) {
            reset();
            return;
        }
        counter++;        
        var string = 'votes.';
        if (output[i].votes == 1) {
            string = 'vote.';
        }
        if (output[i].votes != 0) {
            if (arrayVote) {
                client.sendText(channel, '[' + output[i].name + '] ' + output[i].votes + ' ' + string);
            } else {
                client.sendText(channel, '[' + output[i].number + '] ' + output[i].name + ': ' + output[i].votes + ' ' + string);
            }            
        }        
    }    
    reset();
};

var handler = function(message) {
    if (message.parameters[0] === 'new') {
        // Check if no vote is running.
        if (!enabled) {            
            var index = 1;            
            if (timeRegex.test(message.parameters[1])) {
                time = parseInt(message.parameters[1].substr(1)) * 1000;
                // Check for TheThing abuse.
                if (isNaN(time)) {
                    client.sendNotice(message.nick, 'Time input is incorrect. Example: @10');
                    return;
                }
                // Timer cannot be too long.
                if (time > maxTime) {
                    client.sendNotice(message.nick, "Time input exceeded maximum value, reverting to 5 minutes. (300 seconds)")
                    time = maxTime;
                }
                index = 2;                                
            } else {
                time = defaultTime;
            }           

            var indexArray = _.findIndex(message.parameters, function(element) { return arrayRegex.test(element); });
            var indexTop = _.findIndex(message.parameters, function(element) { return topRegex.test(element); });            

            if (indexArray > -1) {
                var range = message.parameters[indexArray].split('-');
                var first = range[0].substr(1);
                var last = range[1].substr(0, range[1].length - 1);
                if (first >= last) {
                    client.sendNotice('Incorrect array order, make sure start is lower than finish');
                    return;
                }                
                results.first = first;
                results.last = last;
                results.numbers = [];
                for (var i = first; i <= last; i++) {
                    var obj = {};
                    obj.name = i;
                    obj.votes = 0;
                    results.numbers.push(obj);
                }
                length = results.numbers.length;
                arrayVote = true;                
            } else {
                options = _.rest(message.parameters, index).join(' ').split(', ');
                length = options.length;
                if (length > 5) {
                    client.sendNotice(message.nick, 'Too many options, the maximum is 5.');
                    reset();
                    return;
                }
            }

            if (indexTop > -1) {                
                topLimit = parseInt(message.parameters[indexTop].substr(1));
                if (topLimit > 5) {
                    client.sendNotice(message.nick, 'Defaulting to maximum result display of 5.');
                    topLimit = 5;
                }                
            }

            client.sendText(message.to, 'Vote started, running for ' + time / 1000 + ' seconds!');
            
            if (arrayVote) {
                client.sendText(message.to, 'Please vote a number from ' + first + ' to ' + last + '.');
            } else {
                for(var i in options) {
                    var number = parseInt(i) + 1;
                    client.sendText(message.to, '[' + number + '] ' + options[i]);
                }
            }

            for (var i in options) {
                var obj = {};                
                obj.name = options[i];
                obj.votes = 0;
                obj.number = parseInt(i) + 1;
                results.push(obj);
            }

            enabled = true;
            channel = message.to;
            setTimeout(endVoting, time);
        } else {
            client.sendNotice(message.nick, 'A vote is already running.');
        }
    } else if (message.parameters[0] === 'help') {
        client.sendNotice(message.nick, '!vote usage:');
        client.sendNotice(message.nick, '!vote new A, B, ... starts a new vote with A and B as options. [Maximum of 5 options]');
        client.sendNotice(message.nick, '!vote new arguments: @10, sets voting time to 10 seconds. [Maximum is 5 minutes (300 seconds)]');
        client.sendNotice(message.nick, '!vote new arguments: [4-9], allows uses to vote on the number 4 to 9.');
        client.sendNotice(message.nick, '!vote new arguments: #3, shows maximum of 3 results at the end of the voting period. [Maximum is 5]');
        client.sendNotice(message.nick, '!vote <number> can be used to vote on a number when a new vote has been started.');
        
    } else if (enabled) {
        if (_.contains(voted, message.nick)) {
            client.sendNotice(message.nick, 'You already voted.');
        } else {
            if (message.parameters[0] === 'undefined') {
                client.sendNotice(message.nick, 'Please enter a number.');
                return;
            }

            var number = parseInt(message.parameters[0]);
            if (arrayVote) {
                if (!isNaN(number) && number >= results.first && number <= results.last) {
                    client.sendNotice(message.nick, 'Vote registered.');
                    results.numbers[_.findIndex(results.numbers, function(element) { return element.name == number; })].votes += 1;
                    voted.push(message.nick);
                } else {
                    client.sendNotice(message.nick, 'Incorrect input, please enter a number in range [' + results.first + ' - ' + results.last +']');
                }
            } else {                            
                if (!isNaN(number) && number <= length) {
                    client.sendNotice(message.nick, 'Vote registered.');
                    results[number - 1].votes += 1;
                    voted.push(message.nick);
                } else {
                    client.sendNotice(message.nick, 'Incorrect input, please enter a number in range [1 - ' + length +']');
                }
            }
        }
    } else {
        client.sendNotice(message.nick, 'No vote has been started yet.');
    }
};

client.on('!vote', handler);

client.connect(20000, 'localhost');