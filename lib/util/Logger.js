var colors = require('colors');

module.exports = Logger;

function Logger(pPrefix, pLogLevel) {    
    if (pPrefix == undefined) {        
        this.prefix = "";
    } else {
        this.prefix = pPrefix + ": ";
    }
    this.logLevel = pLogLevel;
}

Logger.prototype.isInfoLevel = function() {
    switch (this.logLevel) {
        case "info": return true;
        default: return false;
    }
}

Logger.prototype.isWarningLevel = function() {
    switch (this.logLevel) {
        case "info": return true;
        case "warning": return true;
        default: return false;
    }
}

Logger.prototype.isErrorLevel = function() {
    switch (this.logLevel) {
        case "info": return true;
        case "warning": return true;
        case "error": return true;
        default: return false;
    }
}

Logger.prototype.info = function(message) {
    if (this.isInfoLevel()) {
        var string = "[" + "INFO".green + "] ";
        console.log(string + this.prefix + message);
    }
}

Logger.prototype.warning = function(message) {
    if (this.isWarningLevel()) {
        var string = "[" + "WARN".yellow + "] ";
        console.log(string + this.prefix + message);
    }
}

Logger.prototype.error = function(message) {
    if (this.isErrorLevel()) {
        var string = "[" + "FAIL".red + "] ";
        console.log(string + this.prefix + message);
    }
}