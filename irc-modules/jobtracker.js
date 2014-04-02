'use strict';

var fs = require('fs');
var irc = require('../index');
var _ = require('lodash');

var _MS_PER_DAY = 1000 * 60 * 60 * 24;
var _MS_PER_HOUR = 1000 * 60 * 60;
var _MS_PER_MIN = 1000 * 60;
var _MS_PER_SEC = 1000;

var client = irc.createClient(
    'Job Tracker Module',
    'JTM',
    {time: 100, persistent: true, channels: ['#doki-durama']}
);

var db;
var file = './conf/jobs.json';
var progressTimer;

var readdb = function() {
    db = JSON.parse(fs.readFileSync(file, 'utf8'));    
}

var writedb = function() {
    fs.writeFileSync(file, JSON.stringify(db, null, 4), 'utf8');
}

readdb();
writedb();

var checkTimer = function(timer) {
    return ((new Date() - timer) < _MS_PER_MIN);
};

var newEpisode = function(ID, name) {    
    var obj = {};
    obj.ID = ID;    
    obj.Name = name;
    obj.tasks = [];
    db.episodes.push(obj);
};

var formatTask = function(task, done) {
    var string;
    if (done) {
        string = '\x0303' + task + '\x0F';
    } else {
        string = '[\x0304' + task + '\x0F]';
    }
    return string;
};

var checkTaskDone = function(ID, type) {    
    return _.find(_.find(db.episodes, {'ID': ID}).tasks, {'type': type}).status;
};

var formatNickTask = function(task, ID) {
    var string;
    if (!checkTaskDone(ID, task)) {
        string = '[\x0304' + task + '\x0F]';
    }
    return string;
};

var formatEpisode = function(episode) {
    var string = '[\x0307' + episode.ID + '\x0F] ';
    string += episode.Name + ': ';
    for (var i in episode.tasks) {        
        string += formatTask(episode.tasks[i].type, episode.tasks[i].status) + ' ';
    }
    return string;
};

var checkNewArgs = function(arg1, arg2) {
    var IDs = _.pluck(db.episodes, 'ID');
    if (arg1.length != 4) { return 1; }
    if (arg2.length > 20) { return 2; }
    if (_.contains(IDs, arg1)) { return 3; }
    return 0;
};

var checkTaskArgs = function(arg1, arg2) {
    var IDs = _.pluck(db.episodes, 'ID');    
    if (!_.contains(IDs, arg1)) { return 3; }
    if (!_.contains(_.pluck(_.find(db.episodes, {'ID': arg1}).tasks, 'type'), arg2)) { return 4; }
    return 0;
};

var taskHandler = function(message) {
    readdb();
    switch (message.parameters[0]) {
        case 'help': break;
        case 'add': break;
        case 'del': break;
        default: break;
    }
    writedb();
};

var jobNew = function(message) {
    // Create a new episode.
    var ID = message.parameters[1];
    var name = message.parameters.slice(2, message.parameters.length).join(' ');
    var error = checkNewArgs(ID, name);
    switch (error) {            
        case 1:
            // ID length not correct.            
            client.sendNotice(message.nick, 'ID length incorrect (Must be 4 in length)');
            return;
        case 2:
            // Name length too long.
            client.sendNotice(message.nick, 'Episode name must be less than 21.');
            return;
        case 3:
            // ID already exists.
            client.sendNotice(message.nick, 'ID already exists, please select a new one.');
            return;
        default:
            newEpisode(ID, name);
            client.sendNotice(message.nick, 'New episode created!');                
    }
};

var jobHelp = function(message) {
    // Display help to user.
    client.sendNotice(message.nick, '!job new <ID> <Name> - Creates a new episode. (ID must be 4 characters long)');
    client.sendNotice(message.nick, '!job done <ID> <Task> - Sets a task as completed. (Task names are the same as in !progress).');
    client.sendNotice(message.nick, '!job undone <ID> <Task> - Sets a task as not completed. (Task names are the same as in !progress).');
    client.sendNotice(message.nick, '!job <ID> <Task> [nick] - Assigns a task to nick, if no nick is specified, it will be assigned to you.');
    client.sendNotice(message.nick, '!job - Attempts to find uncompleted tasks assigned to your nick.');
};

var jobStatus = function(message, status) {
    // Check a task as done.
    var ID = message.parameters[1];
    var task = message.parameters[2];
    var error = checkTaskArgs(ID, task);
    switch (error) {            
        case 3:
            // ID does not exist.
            client.sendNotice(message.nick, 'ID does not exist.');
            return;
        case 4:
            // Task does not exist.
            client.sendNotice(message.nick, 'Task does not exist.');
            return;            
        default:
            // Attempt to update task.
            var episode = _.find(db.episodes, {'ID': ID});                
            var epitask = _.find(episode.tasks, {'type': task});                
            if (epitask.status == status) {
                // Task is already completed!
                var string = status ? 'Task was already completed.' : 'Task is not marked as completed.'
                client.sendNotice(message.nick, string);
                return;
            }
            epitask.status = status;
            client.sendNotice(message.nick, 'Task updated!');
            client.sendText(message.to, formatEpisode(episode));                                
    }
};

var jobAssign = function(message) {
    var ID = message.parameters[0];
    var task = message.parameters[1];
    var nick = message.parameters[2] || message.nick;
    var error = checkTaskArgs(ID, task);
    switch (error) {            
        case 3:
            // ID does not exist.
            client.sendNotice(message.nick, 'ID does not exist.');
            return;
        case 4:
            // Task does not exist.
            client.sendNotice(message.nick, 'Task does not exist.');
            return;            
        default:
            // Attempt to assign task.            
            var episode = _.find(db.episodes, {'ID': ID});                
            var epitask = _.find(episode.tasks, {'type': task});
            var staffnick = _.find(db.staff, {'Name': nick});
            var nickTaskID = _.find(staffnick, {'ID': ID, 'type': task});
            var oldstaffnick = _.find(db.staff, {'Name': epitask.staff});
            var oldNickTaskID = _.find(oldstaffnick, {'ID': ID, 'type': task});

            if (epitask.staff == nick) {
                // Task is already assigned to nick.                
                client.sendNotice(message.nick, 'Task already assigned to specified person.');
                return;
            }

            // Remove old nick from task and update.            
            epitask.staff = nick;

            if (oldstaffnick !== undefined) {
                // Nick is in the list, remove task from nickname.
                oldstaffnick.tasks.pop(oldNickTaskID);
            }            
            
            
            if (staffnick === undefined) {
                // Nick does not exist yet, create new object and push.
                var objstaff = {};
                objstaff.Name = nick;
                objstaff.tasks = [];
                db.staff.push(objstaff);
                staffnick = objstaff;
            }

            // Check if task is already assigned.
            if (nickTaskID === undefined) {                
                var objtask = {};
                objtask.ID = ID;
                objtask.type = task;
                staffnick.tasks.push(objtask);
            }

            client.sendNotice(message.nick, 'Task ' + task + ' assigned to ' + nick + ' on job ID: ' + ID + '.');
    }
};

var jobDefault = function(message) {
    var nick = message.parameters[0] || message.nick;
    var nickstaff = _.find(db.staff, {"Name": nick});
    
    if (nickstaff === undefined) {
        client.sendNotice(message.nick, 'Nickname has no assigned tasks.');
        return;
    }

    var tasks = nickstaff.tasks;
    var allDone = true;
    var jobs = _.groupBy(tasks, 'ID');

    for (var key in jobs) {
        var string = '';
        var IDTasks = jobs[key];
        
        for (var i in IDTasks) {            
            var format = formatNickTask(IDTasks[i].type, key);
            if (!format) { continue; }
            string += format + ' ';
            allDone = false;
        }
        client.sendNotice(message.nick, key + ': ' + string);
    }    
    if (allDone) { client.sendNotice(message.nick, 'Well done, all your tasks have been completed!') };
};

var jobHandler = function(message) {    
    readdb();
    switch (message.parameters[0]) {
        case 'new': jobNew(message); break;
        case 'help': jobHelp(message); break;
        case 'done': jobStatus(message, true); break;
        case 'undone': jobStatus(message, false); break;        
        case undefined: jobDefault(message); break;
        default: jobAssign(message); break;
    }    
    writedb();
};

var progressHandler = function(message) {
    readdb();
    progressTimer = progressTimer || (new Date() - _MS_PER_MIN);
    if (checkTimer(progressTimer)) { 
        client.sendNotice(message.nick, 'Trigger on cooldown (1 minute).');
        return;
    }
    progressTimer = new Date();    

    for (var i in db.episodes) {
        var episode = db.episodes[i];
        client.sendText(message.to, formatEpisode(episode));
    }
    writedb();
};

client.on('!progress', progressHandler);
client.on('!job', jobHandler);
client.on('!task', taskHandler);

client.connect(20000, 'localhost');