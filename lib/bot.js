var url = require('url');
var http = require('http');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var cookie = require('cookie');
var sio = require('./socket');

module.exports = Bot;
function Bot(opts) {

  if(!this instanceof Bot)
    return new Bot(opts);

  this.hostname   = opts.hostname || null;
  this.session    = opts.session || null;
  this.gameuri    = this.hostname + ":%s";
  this.groupuri   = this.hostname + ":81/groups/%s";
  this.joineruri  = this.hostname + ':81/games/find';

  this.game = {
    self:           null,     // bot's game identity
    port:           null,     // game's port number
    socket:         null,     // socket connection
    players:        null,     // all players in game
    time:           0,        // current time show on clock
    state:          4,        // state of the game
    map:            null,     // the map as it is known
  };

  this.group = {
    self:           null,                     // bot's group identity
    room:           opts.room || null,        // group id
    socket:         null,                     // socket connection
    members:        {},                       // all members in the group
    players:        {},                       // all players in the group
    spectators:     {},                       // all spectators in the group
    waiting:        {},                       // all members waiting
    heartbeat:       null,                    // hearbeat interval identifier
    location:       opts.location || 'page',  // bot's location
    private:        false,                    // is this a private group?
    maxPlayers:     12,                       // maxmimum players allowed
    maxSpectators:  6,                        // maximum spectators allowed
    selfAssignment: true,                     // can members self-assign?
    settings:       {}                        // map, time, speed, etc..
  }

  this.joiner = {
    socket: null
  }

  // create a connect function for games
  this.game.connect = createConnect({
    bot: this,
    uri: util.format(this.gameuri, this.game.port),
    event: 'game socket',
    listeners: gameListeners
  });

  // create a connect function for groups
  this.group.connect = createConnect({
    bot: this,
    uri: util.format(this.groupuri, this.group.room),
    event: 'group socket',
    listeners: groupListeners
  });

  // create a connect function for the joiner
  this.joiner.connect = createConnect({
    bot: this,
    uri: this.joineruri,
    event: 'joiner socket',
    listeners: joinerListeners
  });

  EventEmitter.call(this);
};

util.inherits(Bot, EventEmitter);

// PRIVATE
// Create a socket connection to a
// game and add listeners to help.
function createConnect(options) {
  return function(uri, callback) {
    if(typeof uri !== 'string') {
      callback = uri;
      uri = null;
    }
    options.uri = uri || options.uri;
    connect.call(this, options, callback);
  }
};

// PRIVATE
// A private function used to create
// a connection for games, groups, or the joiner
// `this` will be bound to game, group, or joiner namespaces
function connect(options, callback) {
  var self = this;
  var bot = options.bot;

  // It is an error to connect when already connected
  if(this.socket != null && this.socket.connected) {
    var err = new Error("Socket already connected");
    bot.emit('error', err);
    return callback && callback(err);
  }


  if(bot.session)
    return sio.connect(options.uri, bot.session, handleSocket);

  // We do not have the session yet
  sio.getSession('http://'+bot.hostname, function(err, session) {
    if(err) {
      bot.emit('error', err);
      return callback && callback(err);
    }


    bot.session = session;
    bot.emit('session', session);
    sio.connect(options.uri, session, handleSocket);
  });

  // When the socket comes let
  // everyone know, and register listeners
  function handleSocket(err, socket) {
    if(err) {
      bot.emit('error', err);
      return callback(err);
    }

    self.socket = socket;
    bot.emit(options.event, socket);
    options.listeners(bot);

    callback && callback(null, socket);
  }
}

// Register events to aid
// in keep track of the game state
// E.G. map data, player data, score, etc..
function gameListeners(bot) {
  var game = bot.game;
  var socket = game.socket;
  var players = game.players;

  // Save identity
  socket.on('id', function(id) {
    game.self = id;
  });

  // Update the players
  socket.on('p', function(data) {
    if(!data)
      return;

    data.forEach(function(update) {
      var player = players[update.id];
      if(!player) player = players[update.id] = {};

      var attrs = Object.keys(update);
      attrs.forEach(function(attr) {
        if(attr == 'id')
          return;
        player[attr] = update[attr];
      });
    });
  });

  // Keep track of time and game state
  socket.on('time', function(data) {
    game.time = data.time;
    game.state = data.state;
  });

  socket.on('score', function(data) {
    game.score = {};
    game.score.red = data.r;
    game.score.blue = data.b;
  });

}

// Add listeners to aid in keeping
// track of the group
function groupListeners(bot) {
  var group = bot.group;
  var socket = group.socket;
  var members = group.members;

  // Save identity
  socket.on('you', function(id) {
    group.self = id;
  });

  // Update member status
  socket.on('member', function(data) {
    var id = data.id;
    var member = members[id] = data;
  });

  socket.on('removed', function(member) {
    delete members[member.id];
  });

  // create a heartbeat to stay
  // connected to the group
  socket.on('connect', function() {

    // Create a heartbeat
    group.heartbeat = setInterval(function() {
      socket.emit('touch', group.location);
    }, 30e3);
    socket.emit('touch', group.location);

  });

  socket.on('private', function(data) {
    group.private  = data.isPrivate;
    group.maxSpectators = data.maxSpectators;
    group.maxPlayers= data.maxPlayers;
    group.selfAssignment = data.selfAssignment;
  })

  // Gracefully leave the group
  socket.on('disconnect', function(reason) {
    socket.socket.disconnect();
    clearInterval(group.heartbeat);
    http.get({
      hostname: bot.hostname,
      path: '/groups/leave/',
      headers: { Cookie: cookie.serialize('tagpro', bot.session)}
    });
  });
};

function joinerListeners() {

};