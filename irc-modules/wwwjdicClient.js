var net = require('net');
var colors = require('colors');
var http = require('http');
var lodash = require('lodash');
var irc = require('irc');
var IRCMessageBase = require('./messages/IRCMessage.json');
var Command = require('commander');

var httpOptions = {
    host: "www.csse.monash.edu.au"    
}

var path = "/~jwb/cgi-bin/wwwjdic.cgi?";
var timer = 0;
var util = require('./util/util.js');
var module = require('./messages/module.json');
var logger;

var dicts = {
    "1": "Japenese - English",
    "2": "Japanese names"
}

Command
    .version('0.0.1')
    .usage('[options] <file ...>')
    .option('-h, --help', 'Displays help')
    .option('-s, --sound', 'display kanji readings')
    .option('-r, --romaji', 'searches as romaji')
    .option('-d, --dict <value>', 'dictionary to use')
    .option('-c, --common', 'only common words')
    .option('-e, --example [value]', 'show example sentences')
    .option('-k, --kanji', 'Search for each kanji individually')
    .option('-E, --exact', 'Search for exactly this word')
    .option('-l, --limit [value]', 'Specify result limit');

Command.on('help', function() {
    Command.help = true;    
});

Command.on('error', function() {
    logger.error("Random error");
});

Command.help = false;
Command.dict = 1;
Command.limit = 1;

sendToClient = function sendToClient(to, text) {
    if (text.charAt(0) == " ") {
        return;
    }
    timer += 100;
    var IRCMessage = lodash.defaults({
        to: to,
        text: text
    } ,IRCMessageBase);    
    setTimeout(function() { 
        client.write(JSON.stringify(IRCMessage));
        timer -= 100;
    }, timer);
}

requestWWWJDICJPWord = function(message, dict, options, arg) {
    var type = "U";
    var key = options.common ? "P" : "J";
    var exPath = path + options.dict + "Z" + type + key + arg;
    httpOptions.path = exPath;

    logger.info(httpOptions.path);

    var callback = function(response) {
        var data = "";
        response.on('data', function(chunk) {
            data = data + chunk;
        });
        response.on('end', function() {            
            var string = data.toString();
            string = string.replace(/<([^>]*)>/g, '');
            string = string.split(/\n/);

            var lines = [];

            for (var i in string) {
                var str = string[i];            
                if (str.length > 0 && !/WWWJDIC:[A-z\s]*/.test(str)) {
                    lines.push(str);
                }        
            }

            var end = lines.length > options.limit ? options.limit : lines.length;
            var to = options.limit > 3 ? message.nick : message.to;

            for (var i = 0; i < end; i++) {
                var text = formatWord(lines[i]);
				var textend = text.length > 4 ? 4 : text.length
				for (var j = 0; j < textend; j++) {
					sendToClient(to, text[j]);
				}
				if (text.length > 4) {
					sendToClient(to, "Displaying 3/" + text.length + " results");
				}
            }
        });
    }   

    http.get(httpOptions, callback).on('error', function(e) {
        logger.warning("Get error: " + e.message);
    });
}

formatWord = function(word) {
	word = word.replace(/\/\(P\)/g, " (P)");	
	var array = word.split(/(?=[^A-z])\/(?=[^A-z]|$)/);	
	var definitions = [];
	definitions.push(array[0]);
	array.splice(0,1);
	
	for (var i in array) {		
		var common = false;
		switch(true) {
			case (array[i].indexOf("(P)") > -1): common = true;
			default: 
				var def = array[i];				
				if (def == "") break;
				def = def.replace(/\([A-z0-9-,]*\)/g, '').trim();
				def = def.replace(/\//g, ", " );
				var index = parseInt(i) + 1;				
				if (common) {
					index = irc.colors.wrap("light_green", "#" + index);
				} else {
					index = "#" + index;
				}
				
				definitions.push("[" + index + "] " + def);
				break;
		}
	}
	
	return definitions;
}

requestWWWJDICKanji = function(to, dict, options, arg) {
    var type = "M";
    var key = "J";
    var exPath = path + dict + "Z" + type + key + arg;
    httpOptions.path = exPath;

    var callback = function(response) {
        response.on('data', function(chunk) {            
            var string = chunk.toString();
            string = string.replace(/<([^>]*)>/g, '');
            string = string.split(/[ ](?=[^\}]*?(?:\{|$))|\n/);

            var onyomi = [];
            var kunyomi = [];
            var names = [];
            var meanings = [];
            var namesList = false;
            var level = 9000;

            for (var i in string) {
                var str = string[i];            
                switch(true) {
                    case /F[0-9]+/.test(str): 
                        if (str.charAt(0) == "F") {
                            console.log(str); 
                            level = str.substring(1, str.length);     
                            console.log(level);                        
                        }
                        break;
                    case /[\u30a0-\u30ff]+/.test(str): onyomi.push(str); break;
                    case /[\u3040-\u309f]+/.test(str): 
                        namesList ? names.push(str) : kunyomi.push(str); break;
                    case str == "T1": namesList = true; break;
                    case /\{[A-z\s]*\}/.test(str): 
                        str = str.replace("}", "");
                        str = str.replace("{", "");
                        meanings.push(str);
                        break;
                    default: break;
                }
            } 
            var kanjiText = arg;

            if (level > 2500) {
                kanjiText = irc.colors.wrap("light_red", kanjiText);
            } else {
                kanjiText = irc.colors.wrap("light_green", kanjiText);
            }

            if (meanings.length == 0) {
                options.sound = true;
            }

            var yomiText = "[" + kanjiText + "] ";
            var send = false;

            if (onyomi.length > 0 && options.sound) {
                yomiText += "On: [" + util.arrayToString(onyomi, "light_cyan", "irc") + "] ";
                var send = true;                                
            }
            if (kunyomi.length > 0 && options.sound) {
                yomiText += "Kun: [" + util.arrayToString(kunyomi, "light_magenta", "irc") + "] ";                
                var send = true;                                
            }
            if (names.length > 0 && options.sound) {                
                yomiText += "Names: [" + util.arrayToString(names, "orange", "irc") + "] ";                
                var send = true;                                                
            }

            if (send) {
                sendToClient(to, yomiText);
            }

            if (meanings.length > 0 && options.kanji) {                
                var text = "[" + kanjiText + "] Meanings: " + meanings.join(", ");
                sendToClient(to, text);     
            }
        });
    }   

    http.get(httpOptions, callback).on('error', function(e) {
        logger.warning("Get error: " + e.message);
    });        
}

var client = net.connect(20000, function() {
    logger = new util.Logger(module.moduleCode, "info");
    logger.info("Module loaded");
    client.write(JSON.stringify(module));
});

dict = function(nick, args) {
    for (var key in dicts) {
        var IRCMessage = require('./messages/IRCMessage.json');
        IRCMessage.to = nick;
        IRCMessage.text = key + ": " + dicts[key];
        client.write(JSON.stringify(IRCMessage));
    }
}

translate = function(message, args) {
    logger.info("origin: " + message.to);
    
    // Replace Japanese space with normal space!    
    args = args.join(" ").replace(/　/g, " ").split(" ");

    var parseArgs = ['',''].concat(args);

    Command.parse(parseArgs);    

    var options = {
        sound: Command.sound,
        romaji: Command.romaji,
        dict: Command.dict,
        common: Command.common,
        example: Command.example,
        kanji: Command.kanji,
        exact: Command.exact,
        help: Command.help,
        limit: Command.limit,
        args: Command.args
    }   

    logger.info("Help: " + options.help);

    Command.sound = false;
    Command.romaji = false;
    Command.dict = 1;
    Command.common = false;
    Command.example = false;
    Command.kanji = false;
    Command.exact = false;
    Command.help = false;
    Command.limit = 1;
    Command.args = [];    

    options.limit = parseInt(options.limit) || 1;
    options.dict = parseInt(options.dict) || 1;

    if (options.dict > 2 || options.dict < 1) {
        sendToClient(message.to, "Invalid dictionary, defaulting to dict 1");
        options.dict = 1;
    }
    
    selectQuery(message, options);       
}

sendHelp = function(nick) {
    sendToClient(nick, "Usage: !t [options] searchterm");
    sendToClient(nick, "[options]");
    sendToClient(nick, "-h, --help, Displays this help");
    sendToClient(nick, "-s, --sound, Show readings for word/kanji");
    //sendToClient(nick, "-r, --romaji, Displays this help");
    sendToClient(nick, "-d, --dict <value>, Seach in specified dictionary");
    sendToClient(nick, "-c, --common, Search common words only");
    //sendToClient(nick, "-e, --example [value], Show [value] example sentences");
    sendToClient(nick, "-k, --kanji, Search each kanji individually");
    sendToClient(nick, "-l, --limit [value], Show [value] results");
    //sendToClient(nick, "-E, --exact, Match results exactly");
}

selectQuery = function(message, options) {
    var args = options.args;     
    if (options.help) {        
        sendHelp(message.nick);
    } else if (options.args.length == 1 && options.args[0].trim() == "") {
        sendToClient(message.to, "Please specify a search term \"bro\"");
    } else if (options.kanji || options.sound) {
        args = args.join();
        var kanjiArgs = [];

        for (var i = 0; i < args.length; i++) {
            if (isKanji(args.charAt(i))) {
                kanjiArgs.push(args.charAt(i));
            }
        }

        if (kanjiArgs.length > 4) {
            sendToClient(message.to, "Too many kanji specified");
            return;
        }

        function callback(arg) {            
            requestWWWJDICKanji(message.to, 1, options, arg);
        }

        kanjiArgs.forEach(callback);        
    } else {
        requestWWWJDICJPWord(message, 1, options, args[0]);
    }
}

isKanji = function(arg) {
    switch(true) {
        case /[\u4e00-\u9faf]/.test(arg): return true;
        case /[\u3400-\u4dbf]/.test(arg): return true;
        default: return false;
    }    
}

unload = function(message) {    
    for (var i in message) {
        if (message[i].toLowerCase() == module.moduleCode.toLowerCase()) {
            logger.info("Unload command received");
            client.end();
            return;
        }
    }    
}

client.on('data', function(data) {    
    try { 
        var message = JSON.parse(data.toString());        
        var to = message.to;
        var nick = message.nick;
        var textArray = message.text.split(" ");        
        var command = textArray[0];
        var args = textArray.slice(1,textArray.length);
        switch (command) {
            case "!t": translate(message, args); break;
            case "!dict": dict(nick, args); break;
            //case "!unload": unload(args); break;
            default: logger.warning("Unrecognised command");
        }
    } catch(e) {
        logger.error(e);        
    }    
});

client.on('end', function() {
    logger.warning("Client shutting down...");
});