# tagpro-bot

A library to create a bot for tagpro.

``` javascript
var tagbot = require('../index');
var uri = 'http://tagpro-pi.koalabeast.com/groups/lkasjdli';

tagbot.getSession(uri, function(err, session) {
  tagbot.connect(uri, function(err, socket) {
    socket.on('connect', function() {
      socket.emit('chat', 'Hello groups!');
    });
  });
});

```

This library also has a Bot constructor, useful for creating
a tagpro bot which can join groups, games, and the joiner.

## Install

`npm intall tagpro-bot`

## Usage

### .connect(uri, session, callback)

Open a new socket.io connection at the given uri.

  * `uri`: location to open the socket.io sessei
  * 'session`: tagpro session id to send with socket connection
  * `callback`: called after opening the socket connection with `callback(err, socket)`

### .getSession(uri, callback)

Retrieve a session token, necessary to open a socket connection.

  * `uri`: location to open the socket.io sessei
  * `callback`: called when the session is ready with `callback(err, session)`

## .Bot(options)

Create a new Bot instance, which has useful functions to connect to games, groups, or the joiner.

``` javascript
// options
{


}
```

# Credit

Thanks goes out to [plane](/jj56) for creating [SpectaBot]() and for
creating a socket.io-client with cookie option.
