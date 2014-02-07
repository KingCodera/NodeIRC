var http = require('http');

var httpOptions = {
    host: "www.csse.monash.edu.au"    
}

var path = "/~jwb/cgi-bin/wwwjdic.cgi?1ZUJなにこれ可愛い";

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

        var end = lines.length > 5 ? 5 : lines.length;
        console.log(end);

        for (var i = 0; i < end; i++) {
            var text = "[" + "WORD" + "] : " + lines[i];
            console.log(text);            
        }
    });        
}   

httpOptions.path = path;

http.get(httpOptions, callback).on('error', function(e) {
    logger.warning("Get error: " + e.message);
});