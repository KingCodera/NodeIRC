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
    {time: 100, persistent: true, channels: ['#doki-durama', '#Severin']}
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

var isInvalidID = function(ID) {
    var IDs = _.pluck(db.episodes, 'ID');
    if (ID.length != 4) { return 1; }
    if (!_.contains(IDs, ID)) { return 3; }
    return 0;
};

var isValidTask = function(ID, task) {    
    if (isInvalidID(ID)) { return false; }    
    if (!_.contains(_.pluck(_.find(db.episodes, {'ID': ID}).tasks, 'type'), task)) { return false; }
    return true;
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
    var bInvalidID = isInvalidID(arg1);
    if (!bInvalidID) { return bInvalidID; }
    if (arg2.length > 20) { return 2; }
    return 0;
};

var checkTaskArgs = function(arg1, arg2) {
    var bInvalidID = isInvalidID(arg1);
    if (bInvalidID) { return bInvalidID; }
    if (isValidTask(arg1, arg2)) {
        return 0;
    } else {
        return 4;
    }    
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
            client.sendNotice(message.nick, 'Episode name must be less than 21 in length.');
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
    client.sendNotice(message.nick, '!job [nick]- Attempts to find uncompleted tasks assigned to specified nick, if no nick is specified it will search for your nick.');
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
            if (epitask !== undefined && epitask.status == status) {
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
            var oldNickTaskID;
            if (!(oldstaffnick === undefined)) { oldNickTaskID = _.find(oldstaffnick.tasks, {'ID': ID, 'type': task}); }

            if (epitask.staff == nick) {
                // Task is already assigned to nick.                
                client.sendNotice(message.nick, 'Task already assigned to specified person.');
                return;
            }

            // Remove old nick from task and update.            
            epitask.staff = nick;

            if (oldNickTaskID !== undefined) {
                // Nick is in the list, remove task from nickname.
                _.pull(oldstaffnick.tasks, oldNickTaskID);
                if (oldstaffnick.tasks.length == 0) {
                    _.pull(db.staff, oldstaffnick);
                }
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

            client.sendNotice(message.nick, 'Task ' + task + ' assigned to ' + nick + ' on job with ID: ' + ID + '.');
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
        if (!(string === '')) { client.sendNotice(message.nick, key + ': ' + string); }
    }    
    if (allDone) { client.sendNotice(message.nick, 'Well done, all tasks have been completed!') };
};

var jobHandler = function(message) {
    readdb();
    switch (message.parameters[0]) {
        case 'new': jobNew(message); break;
        case 'help': jobHelp(message); break;
        case 'done': jobStatus(message, true); break;
        case 'undone': jobStatus(message, false); break;        
        case undefined: jobDefault(message); break;
        default: 
            if (!isInvalidID(message.parameters[0])) {
                jobAssign(message);
            } else {
                jobDefault(message);
            }
            break;
    }    
    writedb();
};

var progressID = function(channel, ID) { 
    client.sendText(channel, formatEpisode(_.find(db.episodes, {'ID': ID})));
};

var progressHandler = function(message) {
    readdb();    
    switch (message.parameters[0]) {
        case undefined: 
            progressTimer = progressTimer || (new Date() - _MS_PER_MIN);
            if (checkTimer(progressTimer)) { 
                // Check if trigger is on cooldown.
                client.sendNotice(message.nick, 'Trigger on cooldown (1 minute).');
                return;
            } else {
                progressTimer = new Date();
                for (var i in db.episodes) {
                    var episode = db.episodes[i];
                    client.sendText(message.to, formatEpisode(episode));
                }
            }
            break;
        default: 
            if (!isInvalidID(message.parameters[0])) {
                progressID(message.to, message.parameters[0]);
            } else {
                client.sendNotice(message.nick, 'Job with ID: ' + message.parameters[0] + ' does not exist.');
            }
            break;
    }
    writedb();
};

var taskHelp = function(message) {
    // Display help to user.
    client.sendNotice(message.nick, '!task <ID> add <Task1> <Task2> ... - Adds tasks to job with ID.');
    client.sendNotice(message.nick, '!task <ID> del <Task1> <Task2> ... - Deletes tasks from job with ID.');
    client.sendNotice(message.nick, '!task <ID> add <Task1> del <Task2> ... - Adds and deletes tasks from job with ID.');
};

var newTask = function(type) {
    var obj = {};
    obj.type = type;
    obj.staff = "~Unknown";
    obj.status = false;
    return obj;
}

var taskModify = function(ID, task, add) {
    var episode = _.find(db.episodes, {'ID': ID});    

    if (add) {
        // Task with same name already exists.
        if (isValidTask(ID, task)) { return -1; }
        // Task does not exist yet.
        var taskObj = newTask(task);        
        episode.tasks.push(taskObj);
    } else {
        // Task does not exist in job.
        if (!isValidTask(ID, task)) { return -2; }
        // Task does exist.        
        var taskObj = _.find(episode.tasks, {'type': task});
        var oldstaffnick = _.find(db.staff, {'Name': taskObj.staff});                
        var oldNickTaskID;
        
        if (!(oldstaffnick === undefined)) { oldNickTaskID = _.find(oldstaffnick.tasks, {'ID': ID, 'type': task}); }       
        if (oldstaffnick !== undefined) {
            // Nick is in the list, remove task from nickname.
            _.pull(oldstaffnick.tasks, oldNickTaskID);
        }
        _.pull(episode.tasks, taskObj);
    }

    return 0;
};

var taskIterator = function(ID, args, add, nick) {
    if (args.length == 0) { return; }    
    switch (args[0]) {
        case 'add': taskIterator(ID, args.splice(1, args.length), true, nick); break;
        case 'del': taskIterator(ID, args.splice(1, args.length), false, nick); break;
        default:
            if (add === undefined) {
                client.sendNotice(nick, 'First argument after ID must be either add or del.');
                return;
            }
            var error = taskModify(ID, args[0], add);            
            // lol this is so stupid.
            switch (error) {
                case -1: client.sendNotice(nick, 'Task [\x0311' + args[0] + '\x0F] already exists in job with ID: ' + ID); break;
                case -2: client.sendNotice(nick, 'Task [\x0311' + args[0] + '\x0F] does not exist in job with ID: ' + ID); break;
                default: 
                    // Task successfully added or deleted.
                    if (add) {
                        client.sendNotice(nick, 'Task [\x0311' + args[0] + '\x0F] added to job with ID: ' + ID);
                    } else {
                        client.sendNotice(nick, 'Task [\x0311' + args[0] + '\x0F] deleted from job with ID: ' + ID);
                    }
                    break;
            }
            taskIterator(ID, args.splice(1, args.length), add, nick);
            break;
    }
}

var taskHandler = function(message) {
    readdb();
    switch (message.parameters[0]) {
        case 'help': taskHelp(message); break;        
        default:             
            if (!isInvalidID(message.parameters[0])) {
                var ID = message.parameters[0];
                var arg = message.parameters[1];
                var args = message.parameters.splice(1, message.parameters.length);                
                taskIterator(ID, args, undefined, message.nick);
            }
            break;
    }
    writedb();
};


client.on('!progress', progressHandler);
client.on('!job', jobHandler);
client.on('!task', taskHandler);

client.connect(20000, 'localhost');