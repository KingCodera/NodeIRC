NodeIRC
=======

NodeIRC is a modular based irc bot client. It can handle multiple bots and multiple triggers from multiple modules. Each trigger module connects to the server where the server handles all the bots.

Server
------

There are multiple ways to run the server.

#### Command line

If you just wanna run a default server and don't need to do anything fancy, you can simply run the included server.js script:

```bash
./script/server.js <server_config.json> <bot1.json> [<bot2.json> ...]
```

The `server_config.json` configures the actual server (an example file can be found inside `/conf/server.json.example`).

Every parameter after that contains info about the actual bot the server should maintain or handle. You can find an example bot file in `/conf/bots.json.example`.


#### Require

You can also install NodeIRC as a package and require it. Afterwards you can run your server like so:

```javascript
var nodeIrc = require('NodeIRC');

var myBot = { /* add bot settings here */ }

var server = nodeIrc.createServer();
server.connectAgent(myBot);
```

### The Bot

Each bot is running a listener that it can accept modules to connect to.

Client Module
-------------

As explained before, NodeIRC is modular based. Every trigger or action are actually network-based modules that remotely connect to the server. Creating a trigger is very easy. Here is an example based from `/irc-modules/pinger.js`:

```javascript
//Load the NodeIRC
var nodeIrc = require('NodeIRC');

//Create our client
var client = nodeIrc.createClient('Pinger Module', 'pinger');

//Create a command trigger on !ping.
//If any channel on the bot gets the message "!ping", this will be called.
client.on('!ping', function(message) {
    //Send the responce "pong" to the channel.
    this.sendText(message.to, 'pong');
});

//Connect to the bot
client.connect(20000);
```

License
-------

WTFPL - http://sam.zoy.org/wtfpl/COPYING
