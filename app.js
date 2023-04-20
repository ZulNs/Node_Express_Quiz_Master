const SIO_PATH = '/socket.io';

const INIT_DATA_EVENT = 'init_data';
const TEAM_CONNECTED_EVENT = 'team_connected';
const TEAM_DISCONNECTED_EVENT = 'team_disconnected';
const STAGE_CHANGE_EVENT = 'stage_change';
const BUTTON_EVENT = 'button';
const SELECT_TEAM_EVENT = 'select_team';
const MARK_ANSWER_EVENT = 'mark_answer';
const UPDATE_SCORE_EVENT = 'update_score';

const MASTER_CLIENT_TYPE = 'master';
const TEAM_CLIENT_TYPE = 'team';
const DISPLAY_CLIENT_TYPE = 'display';

const DISPLAY_ROOM = 'display';
const TEAM_ROOM = 'team';

var master_client = null;
var raced_team = -1;
var selected_team = false;

var cdata = {
  stage: 0,
  available_team: [false, false, false, false],
  selected_team: [false, false, false, false],
  highlighted_team: [false, false, false, false],
  answer_mark: [null, null, null, null],
  total_score: [0, 0, 0, 0]
};


var ipAddr = 'localhost';
const interfaces = require('os').networkInterfaces()['Wi-Fi'];
if (interfaces != undefined) {
  for (var idx in interfaces) {
    if (interfaces[idx].family == 'IPv4') {
      ipAddr = interfaces[idx].address;
      break;
    }
  }
}

console.log();
console.log('========================================================');
console.log(' Selamat datang di aplikasi Quiz-Master oleh ZulNs');
console.log('========================================================');
console.log(` Alamat untuk tampilan: "http://${ipAddr}/"`);
console.log();
console.log(` Alamat untuk juri:     "http://${ipAddr}/juri"`);
console.log();
console.log(` Alamat untuk Regu A:   "http://${ipAddr}/regu/a"`);
console.log(` Alamat untuk Regu B:   "http://${ipAddr}/regu/b"`);
console.log(` Alamat untuk Regu C:   "http://${ipAddr}/regu/c"`);
console.log(` Alamat untuk Regu D:   "http://${ipAddr}/regu/d"`);
console.log('========================================================');
console.log();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var http = require('http');
var socketio = require('socket.io');

//var displayRouter = require('./routes/display');
//var masterRouter = require('./routes/master');
//var teamRouter = require('./routes/team')

var app = express();

// create the http server
const server = http.createServer(app);

// create the Socket IO server on the top of http server
const io = socketio(server);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/',        displayRouter);
app.get('/display', displayRouter);

app.get('/master', masterRouter);
app.get('/juri',   masterRouter);

app.get('/team/:team*', teamRouter);
app.get('/regu/:team*', teamRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error', { title: 'ERROR' });
});

io.on('connection', (socket) => {
  var client_type = socket.handshake.query.client_type;
  var team = null;
  if (client_type == MASTER_CLIENT_TYPE) {
    master_client = socket;
    socket.emit(INIT_DATA_EVENT, cdata);
  }
  else if (client_type == TEAM_CLIENT_TYPE) {
    team = socket.handshake.query.team;
    cdata.available_team[team] = true;
    socket.join(TEAM_ROOM);
    if (master_client) {
      master_client.emit(TEAM_CONNECTED_EVENT, team);
    }
    if (socket.adapter.rooms.get(DISPLAY_ROOM) != undefined) {
      io.in(DISPLAY_ROOM).emit(TEAM_CONNECTED_EVENT, team);
    }
    socket.emit(STAGE_CHANGE_EVENT, cdata.stage)
  }
  else if (client_type == DISPLAY_CLIENT_TYPE) {
    socket.join(DISPLAY_ROOM);
    socket.emit(INIT_DATA_EVENT, cdata);
  }

  socket.on('disconnect', () => {
    if (client_type == MASTER_CLIENT_TYPE) {
      master_client = null;
    }
    else if (client_type == TEAM_CLIENT_TYPE) {
      cdata.available_team[team] = false;
      if (raced_team == team) {
        raced_team == -1;
      }
      if (master_client) {
        master_client.emit(TEAM_DISCONNECTED_EVENT, team);
      }
      if (socket.adapter.rooms.get(DISPLAY_ROOM) != undefined) {
        io.in(DISPLAY_ROOM).emit(TEAM_DISCONNECTED_EVENT, team);
      }
    }
  });

  socket.on(STAGE_CHANGE_EVENT, (stage) => {
    cdata.stage = stage;
    cdata.selected_team = [false, false, false, false];
    cdata.highlighted_team = [false, false, false, false];
    selected_team = false;
    raced_team = -1;
    if (stage == 0) {
      cdata.total_score = [0, 0, 0, 0];
    }
    if (socket.adapter.rooms.get(DISPLAY_ROOM) != undefined) {
      io.in(DISPLAY_ROOM).emit(STAGE_CHANGE_EVENT, stage);
    }
    if (socket.adapter.rooms.get(TEAM_ROOM) != undefined) {
      io.in(TEAM_ROOM).emit(STAGE_CHANGE_EVENT, stage);
    }
  });

  socket.on(BUTTON_EVENT, (pressed) => {
    var dlvr = { team: team, button: pressed };
    if (cdata.stage == 0) {
      cdata.highlighted_team[team] = pressed;
    }
    else if (raced_team == team && !pressed) {
      // do nothing
    }
    else if (cdata.stage == 2 && selected_team && !cdata.selected_team[team] && pressed && raced_team == -1) {
      raced_team = team;
      cdata.highlighted_team[team] = true;
    }
    else if (cdata.stage == 3 && !selected_team && pressed && raced_team == -1) {
      raced_team = team;
      cdata.highlighted_team[team] = true;
    }
    else {
      return;
    }
    if (master_client) {
      master_client.emit(BUTTON_EVENT, dlvr);
    }
    if (socket.adapter.rooms.get(DISPLAY_ROOM) != undefined) {
      io.in(DISPLAY_ROOM).emit(BUTTON_EVENT, dlvr);
    }
  });

  socket.on(SELECT_TEAM_EVENT, (data) => {
    cdata.selected_team[data.team] = data.value;
    cdata.highlighted_team[data.team] = false;
    selected_team = cdata.selected_team[0] || cdata.selected_team[1] || cdata.selected_team[2] || cdata.selected_team[3];
    if (data.value) {
      cdata.answer_mark[data.team] = null;
    }
    else if (!data.value && data.team == raced_team) {
      raced_team = -1;
    }
    if (socket.adapter.rooms.get(DISPLAY_ROOM) != undefined) {
      io.in(DISPLAY_ROOM).emit(SELECT_TEAM_EVENT, data);
    }
  });
  
  socket.on(MARK_ANSWER_EVENT, (data) => {
    cdata.answer_mark[data.team] = data.value;
    if (socket.adapter.rooms.get(DISPLAY_ROOM) != undefined) {
      io.in(DISPLAY_ROOM).emit(MARK_ANSWER_EVENT, data);
    }
  });
  
  socket.on(UPDATE_SCORE_EVENT, (data) => {
    cdata.total_score[data.team] += data.value;
    if (socket.adapter.rooms.get(DISPLAY_ROOM) != undefined) {
      io.in(DISPLAY_ROOM).emit(UPDATE_SCORE_EVENT, data);
    }
  });
});

function displayRouter(req, res, next) {
  res.render('display', { title: 'DISPLAY' });
}

function masterRouter(req, res, next) {
  if (master_client) {
    res.render('custom_error', { title: 'ERROR', message: 'The Master has already logged in before!' });
  }
  else {
    res.render('master', { title: 'MASTER' });
  }
}

function teamRouter(req, res, next) {
  var team = req.params.team;
  team = team.toUpperCase();
  if (team.length == 1) {
    var idx = team.charCodeAt(0) - 65;
    if (0 <= idx && idx <= 3) {
      if (!cdata.available_team[idx]) {
        res.render('team', { title: `TEAM ${team}`, team: team });
      }
      else {
        res.render('custom_error', { title: 'ERROR', message: `Team "${team}" has already logged in before!` });
      }
      return;
    }
  }
  res.render('custom_error', { title: 'ERROR', message: `Team "${team}" is not a valid contestant!` });
}

module.exports = { app: app, server: server };
