var Logger = require('./Logger.js');
var AgentLogger = require('./AgentLogger.js');
var config = require('./config.js');

config.setLog(new Logger(undefined, "info"));

exports.Logger = Logger;
exports.AgentLogger = AgentLogger;
exports.config = config;
exports.arrayToLowerCase = arrayToLowerCase;
exports.arrayToString = arrayToString;

function arrayToLowerCase(array) {
    return array.forEach(function(item) { 
        return item.toLowerCase(); 
    });

    /*
    var tmp = [];
    for (var i in array) {
        tmp.push(array[i].toLowerCase());
    }
    return tmp;
    */
}

function arrayToString(array, color, type) {
    var string = "";
        
    for (var i in array) {
        string += array[i];

        switch (type) {
            case "console": string = string.color; break;
            case "irc": string = irc.colors.wrap(color, string); break;
            default: break;
        }

        if (i != array.length - 1) {            
            string += ", ";
        }                
    } 
       
    return string;
}

function getTime() {
    var date = new Date();
    var hour = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    var year = date.getFullYear();
    var month = date.getMonth();
    var day = date.getDay();       

    var string = year + "/" + month + "/" + day + " " + hour + ":" + min + ":" + sec;

    return string;
}