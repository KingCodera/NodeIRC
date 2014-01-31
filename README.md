Components:

Controller - Run via "node Controller.js"
- This program handles all module connections and the connection to the IRC server, either direct or BNC.

testClient - Run via "node testClient.js"
- Obviously needs a rename! At the moment this client handles all translation requests using the wwwjdic API.

Messages folder hosts template files for creating messages between Controller and Modules.
- IRCMessage.json is a data structure that is used to transfer IRC message data.
- info.json is a data structure that holds information about the module. (Launches empty module with no purpose)
- module.json is a data structure that holds information about the wwwjdic module.
- parrot.json is a data structure that holds information about a very simple module.

Conf folder hosts config files for the modules and controller (should probably be split up)
- bots.json holds info of the bot to log in to the IRC server.
- server.json holds info of the Controller, port and pass are used by modules to connect to the Controller.
- Other files are obsolete.
