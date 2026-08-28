const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const SCENES = require('./questions');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: false },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();
const pendingDisconnects = new Map();
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 12;
const MIN_PLAYERS = 3;
const DISCONNECT_GRACE_MS = 30000;

function makeCode() {
  for (let tries = 0; tries < 100; tries++) {
    let code = '';
    for (let i = 0; i < 5; i++) code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function safeName(name) {
  return String(name || '').trim().slice(0, 18) || 'プレイヤー';
}

function safeCaption(text) {
  return String(text || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function publicPlayers(room) {
  return [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, score: p.score, isHost: p.id === room.hostId }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ja'));
}

function lobbyState(room) {
  return {
    code: room.code,
    status: room.status,
    phase: room.phase,
    rounds: room.rounds,
    writingSeconds: room.writingSeconds,
    players: publicPlayers(room)
  };
}

function emitLobby(room) {
  io.to(room.code).emit('lobby-state', lobbyState(room));
}

function clearTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.phaseEndsAt = 0;
}

function setPhaseTimer(room, seconds, fn) {
  clearTimer(room);
  room.phaseEndsAt = Date.now() + seconds * 1000;
  room.timer = setTimeout(fn, seconds * 1000);
}

function secondsLeft(room, fallback = 1) {
  if (!room.phaseEndsAt) return fallback;
  return Math.max(1, Math.ceil((room.phaseEndsAt - Date.now()) / 1000));
}

function roundProgress(room) {
  return { round: room.roundIndex + 1, total: room.playScenes.length };
}

function currentScene(room) {
  return room.playScenes[room.roundIndex] || { art: '？', detail: '' };
}

function eligibleVoters(room) {
  return [...room.players.keys()].filter(playerId =>
    room.entries.some(entry => entry.authorId !== playerId)
  );
}

function abortToLobby(room, message) {
  clearTimer(room);
  room.status = 'lobby';
  room.phase = 'lobby';
  room.playScenes = [];
  room.roundIndex = 0;
  room.submissions = new Map();
  room.entries = [];
  room.votes = new Map();
  room.lastResult = null;
  io.to(room.code).emit('game-aborted', message);
  emitLobby(room);
}

function finishGame(room) {
  clearTimer(room);
  room.status = 'finished';
  room.phase = 'finished';
  io.to(room.code).emit('game-finished', { players: publicPlayers(room) });
  emitLobby(room);
}

function startRound(room) {
  if (!rooms.has(room.code) || room.status !== 'playing') return;
  if (room.players.size < MIN_PLAYERS) {
    return abortToLobby(room, '3人未満になったためゲームを中断しました。');
  }

  room.phase = 'writing';
  room.submissions = new Map();
  room.entries = [];
  room.votes = new Map();
  room.lastResult = null;

  io.to(room.code).emit('round-start', {
    ...roundProgress(room),
    scene: currentScene(room),
    seconds: room.writingSeconds
  });
  io.to(room.code).emit('answer-progress', { done: 0, total: room.players.size });

  setPhaseTimer(room, room.writingSeconds, () => beginVoting(room));
}

function beginVoting(room) {
  if (!rooms.has(room.code) || room.status !== 'playing' || room.phase !== 'writing') return;
  clearTimer(room);

  const entries = [];
  for (const [authorId, text] of room.submissions.entries()) {
    if (!room.players.has(authorId) || !text) continue;
    entries.push({
      id: Math.random().toString(36).slice(2, 11),
      authorId,
      text
    });
  }
  room.entries = shuffle(entries);
  room.votes = new Map();

  if (room.entries.length < 2) {
    room.phase = 'result';
    const result = {
      ...roundProgress(room),
      scene: currentScene(room),
      entries: room.entries.map(entry => ({
        id: entry.id,
        text: entry.text,
        authorName: room.players.get(entry.authorId)?.name || '退出した人',
        votes: 0,
        winner: false
      })),
      players: publicPlayers(room),
      message: '回答が2つ未満だったので、このラウンドはノーコンテスト。'
    };
    room.lastResult = result;
    io.to(room.code).emit('round-result', result);
    return scheduleNextRound(room, 4000);
  }

  room.phase = 'voting';
  for (const player of room.players.values()) {
    io.to(player.id).emit('voting-start', {
      ...roundProgress(room),
      scene: currentScene(room),
      submissions: room.entries.map(entry => ({
        id: entry.id,
        text: entry.text,
        mine: entry.authorId === player.id
      })),
      seconds: 20
    });
  }

  const eligible = eligibleVoters(room);
  io.to(room.code).emit('vote-progress', { voted: 0, total: eligible.length });

  if (eligible.length === 0) {
    room.phase = 'result';
    return revealRound(room);
  }

  setPhaseTimer(room, 20, () => revealRound(room));
}

function revealRound(room) {
  if (!rooms.has(room.code) || room.status !== 'playing') return;
  if (!['voting', 'result'].includes(room.phase)) return;
  clearTimer(room);
  room.phase = 'result';

  const voteCounts = new Map(room.entries.map(entry => [entry.id, 0]));
  for (const submissionId of room.votes.values()) {
    if (voteCounts.has(submissionId)) {
      voteCounts.set(submissionId, voteCounts.get(submissionId) + 1);
    }
  }

  const maxVotes = Math.max(0, ...voteCounts.values());
  const winnerIds = maxVotes > 0
    ? [...voteCounts.entries()].filter(([, count]) => count === maxVotes).map(([id]) => id)
    : [];

  for (const entry of room.entries) {
    const author = room.players.get(entry.authorId);
    if (!author) continue;
    const votes = voteCounts.get(entry.id) || 0;
    author.score += votes * 200;
    if (winnerIds.includes(entry.id)) author.score += 500;
  }

  const entries = room.entries
    .map(entry => ({
      id: entry.id,
      text: entry.text,
      authorName: room.players.get(entry.authorId)?.name || '退出した人',
      votes: voteCounts.get(entry.id) || 0,
      winner: winnerIds.includes(entry.id)
    }))
    .sort((a, b) => b.votes - a.votes || a.authorName.localeCompare(b.authorName, 'ja'));

  const result = {
    ...roundProgress(room),
    scene: currentScene(room),
    entries,
    players: publicPlayers(room),
    message: winnerIds.length > 1
      ? '同票優勝！1票200pt＋優勝ボーナス500pt'
      : winnerIds.length === 1
        ? '最多得票が今ラウンドの優勝！1票200pt＋優勝ボーナス500pt'
        : '今回は投票なし。次のお題へ！'
  };

  room.lastResult = result;
  io.to(room.code).emit('round-result', result);
  scheduleNextRound(room, 6500);
}

function scheduleNextRound(room, delay) {
  clearTimer(room);
  room.phaseEndsAt = Date.now() + delay;
  room.timer = setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'playing' || room.phase !== 'result') return;
    room.roundIndex += 1;
    if (room.roundIndex >= room.playScenes.length) finishGame(room);
    else startRound(room);
  }, delay);
}

function checkWritingComplete(room) {
  if (room.status === 'playing' && room.phase === 'writing' && room.submissions.size >= room.players.size) {
    setTimeout(() => beginVoting(room), 400);
  }
}

function checkVotingComplete(room) {
  if (room.status !== 'playing' || room.phase !== 'voting') return;
  const eligible = eligibleVoters(room);
  const voted = eligible.filter(id => room.votes.has(id)).length;
  io.to(room.code).emit('vote-progress', { voted, total: eligible.length });
  if (voted >= eligible.length) setTimeout(() => revealRound(room), 400);
}

function emitPrivateSync(room, socket) {
  if (!room.players.has(socket.id)) return;

  if (room.phase === 'writing') {
    socket.emit('round-start', {
      ...roundProgress(room),
      scene: currentScene(room),
      seconds: secondsLeft(room, room.writingSeconds),
      submitted: room.submissions.has(socket.id)
    });
    socket.emit('answer-progress', { done: room.submissions.size, total: room.players.size });
  } else if (room.phase === 'voting') {
    socket.emit('voting-start', {
      ...roundProgress(room),
      scene: currentScene(room),
      submissions: room.entries.map(entry => ({
        id: entry.id,
        text: entry.text,
        mine: entry.authorId === socket.id
      })),
      seconds: secondsLeft(room, 20),
      voted: room.votes.has(socket.id)
    });
    const eligible = eligibleVoters(room);
    socket.emit('vote-progress', {
      voted: eligible.filter(id => room.votes.has(id)).length,
      total: eligible.length
    });
  } else if (room.phase === 'result' && room.lastResult) {
    socket.emit('round-result', room.lastResult);
  }
}

function cleanupDisconnectedPlayer(code, playerId) {
  const room = rooms.get(code);
  if (!room || !room.players.has(playerId)) return;

  if (room.hostId === playerId) {
    clearTimer(room);
    io.to(code).emit('room-closed', 'ホストが退出したため、ルームが終了しました。');
    rooms.delete(code);
    return;
  }

  room.players.delete(playerId);
  room.submissions.delete(playerId);
  room.votes.delete(playerId);

  const removedEntryIds = room.entries
    .filter(entry => entry.authorId === playerId)
    .map(entry => entry.id);
  room.entries = room.entries.filter(entry => entry.authorId !== playerId);
  for (const [voterId, submissionId] of [...room.votes.entries()]) {
    if (removedEntryIds.includes(submissionId)) room.votes.delete(voterId);
  }

  if (room.status === 'playing' && room.players.size < MIN_PLAYERS) {
    abortToLobby(room, '3人未満になったためゲームを中断しました。');
    return;
  }

  emitLobby(room);
  if (room.phase === 'writing') checkWritingComplete(room);
  if (room.phase === 'voting') {
    if (room.entries.length < 2) {
      room.phase = 'result';
      revealRound(room);
    } else {
      checkVotingComplete(room);
    }
  }
}

io.on('connection', socket => {
  if (socket.recovered) {
    const pending = pendingDisconnects.get(socket.id);
    if (pending) {
      clearTimeout(pending);
      pendingDisconnects.delete(socket.id);
    }
    const room = rooms.get(socket.data.roomCode);
    if (room) {
      emitLobby(room);
      if (room.status === 'playing') emitPrivateSync(room, socket);
    }
  }

  socket.on('create-room', ({ name }) => {
    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      status: 'lobby',
      phase: 'lobby',
      rounds: 8,
      writingSeconds: 35,
      players: new Map(),
      playScenes: [],
      roundIndex: 0,
      submissions: new Map(),
      entries: [],
      votes: new Map(),
      timer: null,
      phaseEndsAt: 0,
      lastResult: null
    };

    room.players.set(socket.id, { id: socket.id, name: safeName(name), score: 0 });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-created', { code, isHost: true });
    emitLobby(room);
  });

  socket.on('join-room', ({ code, name }) => {
    code = String(code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('join-error', 'そのルームは見つかりません。');
    if (room.status !== 'lobby') return socket.emit('join-error', 'このルームはすでにゲーム中です。');
    if (room.players.size >= MAX_PLAYERS) return socket.emit('join-error', 'このルームは満員です。');

    room.players.set(socket.id, { id: socket.id, name: safeName(name), score: 0 });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-joined', { code, isHost: false });
    emitLobby(room);
  });

  socket.on('update-settings', ({ code, rounds, writingSeconds }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    const r = Number(rounds);
    const s = Number(writingSeconds);
    room.rounds = [5, 8, 10, 12].includes(r) ? r : 8;
    room.writingSeconds = [20, 30, 35, 45, 60].includes(s) ? s : 35;
    emitLobby(room);
  });

  socket.on('start-game', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    if (room.players.size < MIN_PLAYERS) return socket.emit('input-error', '3人以上そろったら開始できます！');

    room.playScenes = shuffle(SCENES).slice(0, Math.min(room.rounds, SCENES.length));
    room.roundIndex = 0;
    room.status = 'playing';
    room.phase = 'starting';
    room.submissions = new Map();
    room.entries = [];
    room.votes = new Map();
    room.lastResult = null;
    for (const player of room.players.values()) player.score = 0;

    emitLobby(room);
    io.to(room.code).emit('game-started', { total: room.playScenes.length });
    setTimeout(() => {
      if (rooms.has(room.code) && room.status === 'playing') startRound(room);
    }, 700);
  });

  socket.on('submit-caption', ({ code, text }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.phase !== 'writing') return;
    if (!room.players.has(socket.id) || room.submissions.has(socket.id)) return;

    const cleaned = safeCaption(text);
    if (!cleaned) return socket.emit('input-error', 'タイトルを入力してね！');

    room.submissions.set(socket.id, cleaned);
    socket.emit('submission-locked');
    io.to(room.code).emit('answer-progress', { done: room.submissions.size, total: room.players.size });
    checkWritingComplete(room);
  });

  socket.on('submit-vote', ({ code, submissionId }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.phase !== 'voting') return;
    if (!room.players.has(socket.id) || room.votes.has(socket.id)) return;

    const target = room.entries.find(entry => entry.id === String(submissionId || ''));
    if (!target) return;
    if (target.authorId === socket.id) return socket.emit('input-error', '自分のタイトルには投票できません。');

    room.votes.set(socket.id, target.id);
    socket.emit('vote-locked');
    checkVotingComplete(room);
  });

  socket.on('restart-lobby', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'finished') return;

    clearTimer(room);
    room.status = 'lobby';
    room.phase = 'lobby';
    room.playScenes = [];
    room.roundIndex = 0;
    room.submissions = new Map();
    room.entries = [];
    room.votes = new Map();
    room.lastResult = null;
    for (const player of room.players.values()) player.score = 0;

    io.to(room.code).emit('back-to-lobby');
    emitLobby(room);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) return;

    const old = pendingDisconnects.get(socket.id);
    if (old) clearTimeout(old);
    const timeout = setTimeout(() => {
      pendingDisconnects.delete(socket.id);
      cleanupDisconnectedPlayer(code, socket.id);
    }, DISCONNECT_GRACE_MS);
    pendingDisconnects.set(socket.id, timeout);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Title Academy running on port ${PORT}`));
