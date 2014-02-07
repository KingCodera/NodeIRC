'use strict';

var irc = require('../index');
var http = require('http');
var _ = require('lodash');

var client = irc.createClient(
	'WWWJDIC Translator',
	'WJD',
	{time: 100, persistent: true}
);

var Command = require('commander');

var httpOptions = {
    host: "www.csse.monash.edu.au"    
}

var path = "/~jwb/cgi-bin/wwwjdic.cgi?";

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
    this.logger.error("Random error");
});

Command.help = false;
Command.dict = 1;
Command.limit = 1;

function requestWWWJDICJPWord(message, dict, options, arg) {
    var type = "U";
    var key = options.common ? "P" : "J";
    var exPath = path + options.dict + "Z" + type + key + arg;
    httpOptions.path = exPath;
    
    var callback = function(response) {
        var httpdata = "";
        response.on('data', function(chunk) {
            httpdata = httpdata + chunk;
        });
        response.on('end', function() {            
            var string = httpdata.toString();
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
            var data = [];

            for (var i = 0; i < end; i++) {
                var text = formatWord(lines[i]);
				var textend = text.length > 4 ? 4 : text.length
				for (var j = 0; j < textend; j++) {
					client.sendText(message.to, text[j]);
				}
				if (text.length > 4) {
					client.sendText(message.to, "Displaying 3/" + text.length + " results");
				}
            }
        });
    }   

    http.get(httpOptions, callback).on('error', function(e) {
        this.logger.warning("Get error: " + e.message);
    });
}

function formatWord(word) {
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
					index = '\x0309#' + index + '\x0F';
				} else {
					index = "#" + index;
				}
				
				definitions.push("[" + index + "] " + def);
				break;
		}
	}
	
	return definitions;
}

function requestWWWJDICKanji(to, dict, options, arg) {
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
                            level = str.substring(1, str.length);                                                     
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
                kanjiText = '\x0304' + kanjiText + '\x0F';
            } else {
                kanjiText = '\x0309' + kanjiText + '\x0F';
            }

            if (meanings.length == 0) {
                options.sound = true;
            }

            var yomiText = "[" + kanjiText + "] ";
            var send = false;
            var data = [];

            if (onyomi.length > 0 && options.sound) {
                yomiText += "On: [\x0311" + onyomi.join(', ') + "\x0F] ";
                var send = true;                                
            }
            if (kunyomi.length > 0 && options.sound) {
                yomiText += "Kun: [\x0313" + kunyomi.join(', ') + "\x0F] ";                
                var send = true;                                
            }
            if (names.length > 0 && options.sound) {                
                yomiText += "Names: [\x0307" + names.join(', ') + "\x0F] ";                
                var send = true;                                                
            }

            if (send) {
                client.sendText(to, yomiText);
            }

            if (meanings.length > 0 && options.kanji) {                
                var text = "[" + kanjiText + "] Meanings: " + meanings.join(", ");
                client.sendText(to, text);
            }            
        });
    }   

    http.get(httpOptions, callback).on('error', function(e) {
        this.logger.warning("Get error: " + e.message);
    });        
}

function dict(message) {                
    for (var key in dicts) {        
        var text = key + ": " + dicts[key];
        client.sendText(message.nick, text);
    }
}

function translate(message) {
    var textArray = message.text.split(" ");   
    var args = textArray.slice(1,textArray.length);
    
    this.logger.info("origin: " + message.to);    
    
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

    this.logger.info("Help: " + options.help);

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
        this.sendText(message.to, "Invalid dictionary, defaulting to dict 1");
        options.dict = 1;
    }
    
    var data = selectQuery(message, options);       

    for (var i in data) {
        this.sendText(message.to, data[i]);
    }
}

function sendHelp(nick) {
    client.sendText(nick, "Usage: !t [options] searchterm");
    client.sendText(nick, "[options]");
    client.sendText(nick, "-h, --help, Displays this help");
    client.sendText(nick, "-s, --sound, Show readings for word/kanji");
    //client.sendText(nick, "-r, --romaji, Displays this help");
    client.sendText(nick, "-d, --dict <value>, Seach in specified dictionary");
    client.sendText(nick, "-c, --common, Search common words only");
    //this.sendText(nick, "-e, --example [value], Show [value] example sentences");
    client.sendText(nick, "-k, --kanji, Search each kanji individually");
    client.sendText(nick, "-l, --limit <value>, Show <value> results");
    //this.sendText(nick, "-E, --exact, Match results exactly");
}

function selectQuery(message, options) {
    var args = options.args;     
    if (options.help) {        
        sendHelp(message.nick);
    } else if (options.args.length == 1 && options.args[0].trim() == "") {
        client.sendText(message.to, "Please specify a search term \"bro\"");
    } else if (options.kanji || options.sound) {
        args = args.join();
        var kanjiArgs = [];

        for (var i = 0; i < args.length; i++) {
            if (isKanji(args.charAt(i))) {
                kanjiArgs.push(args.charAt(i));
            }
        }
        
        if (kanjiArgs.length > 4) {
            client.sendText(message.to, "Too many kanji specified");
            return;
        }        

        var kanjiCallback = function(arg) {            
            requestWWWJDICKanji(message.to, 1, options, arg);
        }        
        kanjiArgs.forEach(kanjiCallback);        
    } else {
        return requestWWWJDICJPWord(message, 1, options, args[0]);
    }
}



function isKanji(arg) {
    switch(true) {
        case /[\u4e00-\u9faf]/.test(arg): return true;
        case /[\u3400-\u4dbf]/.test(arg): return true;
        default: return false;
    }    
}

function unload(message) {    
    for (var i in message) {
        if (message[i].toLowerCase() == module.moduleCode.toLowerCase()) {
            this.logger.info("Unload command received");
            client.end();
            return;
        }
    }    
}

client.on('!t', translate);
client.on('!dict', dict);

client.connect(20000);