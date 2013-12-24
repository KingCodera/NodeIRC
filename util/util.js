var Logger = require('./Logger.js');
var AgentLogger = require('./AgentLogger.js');
var irc = require('irc');
var config = require('./config.js');
var colors = require('colors');

config.setLog(new Logger(undefined, "info"));

exports.getTime = getTime;
exports.Logger = Logger;
exports.AgentLogger = AgentLogger;
exports.config = config;
exports.arrayToLowerCase = arrayToLowerCase;
exports.arrayToString = arrayToString;

function arrayToLowerCase(array) {    
    var tmp = [];
    for (var i in array) {
        tmp.push(array[i].toLowerCase());
    }
    return tmp;    
}

function arrayToString(array, color, type) {
    var string = "";
        
    for (var i in array) {
        tmpString = array[i];

        switch (type) {
            case "console": tmpString = tmpString.color; break;
            case "irc": tmpString = irc.colors.wrap(color, tmpString); break;
            default: break;
        }

        string += tmpString;

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