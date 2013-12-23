var fs = require('fs');
var color = require('colors');
var logger;

exports.setLog = setLog;
/**
 * Reads data from specified config file.
 */
exports.read = read;
/**
 * Writes data to specified config file.
 */
exports.write = write;

var botsFile = './conf/bots.json';
var channelsFile = './conf/channels.json';
var serverFile = './conf/server.json';

function setLog(pLogger) {
    logger = pLogger;    
}

function write(conf, data) {
    switch(conf) {
        case "channels": writeToFile(channelsFile, data); break;
        case "bots": writeToFile(botsFile, data); break;
        case "server": writeToFile(serverFile, data); break;
        default: logger.warning("Unknown config file"); break;
    }
}


function writeToFile(file, data) {
    var json = JSON.stringify(data, null, 4);
    fs.writeFile(file, json, function(err) {
        if (err) {
            logger.error("Error writing configuration: " + file.green);
            logger.error(err);
        } else {
            logger.info("Configuration written to: " + file.green);
        }
    });
}


function read(conf) {    
    switch(conf) {
        case "channels": return readFromFile(channelsFile); break;
        case "bots": return readFromFile(botsFile); break;
        case "server": return readFromFile(serverFile); break;
        default: logger.error("Can't read: Unknown config file"); break;
    }
}

function readFromFile(file) {
    try {
        // Hack to make require work >_>
        var hackfile = "./." + file;
        var json = require(hackfile);
        logger.info("Configuration loaded from: " + file.green);
        return json;    
    } catch (err) {
        logger.error("Error loading configuration: " + file.green);
        logger.error(err);
    }    
}