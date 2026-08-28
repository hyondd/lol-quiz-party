const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const WORD_PAIRS = require('./questions');

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
const MAX_PLAYERS = 20;
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

function emitLobby(room) {
  io.to(room.code).emit('lobby-state', {
    code: room.code,
    status: room.status,
    phase: room.phase,
    rounds: room.rounds,
    discussionSeconds: room.discussionSeconds,
    players: publicPlayers(room)
  });
}

function clearTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
}

function roundProgress(room) {
  return { round: room.roundIndex + 1, total: room.playPairs.length };
}

function abortToLobby(room, message) {
  clearTimer(room);
  room.status = 'lobby';
  room.phase = 'lobby';
  room.roundIndex = 0;
  room.playPairs = [];
  room.wolfId = null;
  room.votes.clear();
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
  if (room.players.size < 3) return abortToLobby(room, '3人未満になったためゲームを中断しました。');

  clearTimer(room);
  room.votes = new Map();
  room.phase = 'discussion';

  const pair = room.playPairs[room.roundIndex];
  const playerIds = [...room.players.keys()];
  room.wolfId = playerIds[Math.floor(Math.random() * playerIds.length)];

  const swap = Math.random() < 0.5;
  room.majorityWord = swap ? pair.b : pair.a;
  room.minorityWord = swap ? pair.a : pair.b;

  io.to(room.code).emit('round-start', {
    ...roundProgress(room),
    seconds: room.discussionSeconds,
    players: publicPlayers(room)
  });

  for (const player of room.players.values()) {
    io.to(player.id).emit('secret-word', {
      word: player.id === room.wolfId ? room.minorityWord : room.majorityWord
    });
  }

  room.timer = setTimeout(() => beginVoting(room), room.discussionSeconds * 1000);
}

function beginVoting(room) {
  if (!rooms.has(room.code) || room.status !== 'playing' || room.phase !== 'discussion') return;
  clearTimer(room);
  room.phase = 'voting';
  room.votes = new Map();

  io.to(room.code).emit('voting-start', {
    ...roundProgress(room),
    seconds: 25,
    players: publicPlayers(room).map(p => ({ id: p.id, name: p.name }))
  });
  io.to(room.code).emit('vote-progress', { voted: 0, total: room.players.size });

  room.timer = setTimeout(() => revealRound(room), 25000);
}

function revealRound(room) {
  if (!rooms.has(room.code) || room.status !== 'playing' || room.phase !== 'voting') return;
  clearTimer(room);
  room.phase = 'result';

  const voteCounts = new Map([...room.players.keys()].map(id => [id, 0]));
  const votersByTarget = new Map([...room.players.keys()].map(id => [id, []]));

  for (const [voterId, targetId] of room.votes.entries()) {
    if (!room.players.has(voterId) || !room.players.has(targetId)) continue;
    voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
    votersByTarget.get(targetId)?.push(room.players.get(voterId)?.name || '不明');
  }

  const maxVotes = Math.max(0, ...voteCounts.values());
  const topIds = maxVotes > 0
    ? [...voteCounts.entries()].filter(([, count]) => count === maxVotes).map(([id]) => id)
    : [];
  const caught = topIds.length === 1 && topIds[0] === room.wolfId;

  if (caught) {
    for (const [voterId, targetId] of room.votes.entries()) {
      if (targetId === room.wolfId && room.players.has(voterId)) {
        room.players.get(voterId).score += 400;
      }
    }
  } else if (room.players.has(room.wolfId)) {
    room.players.get(room.wolfId).score += 700;
  }

  const voteResults = [...room.players.values()]
    .map(p => ({
      id: p.id,
      name: p.name,
      votes: voteCounts.get(p.id) || 0,
      voters: votersByTarget.get(p.id) || [],
      isMinority: p.id === room.wolfId
    }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'ja'));

  io.to(room.code).emit('round-result', {
    ...roundProgress(room),
    caught,
    minorityId: room.wolfId,
    minorityName: room.players.get(room.wolfId)?.name || '退出した人',
    majorityWord: room.majorityWord,
    minorityWord: room.minorityWord,
    voteResults,
    players: publicPlayers(room),
    message: caught
      ? '多数派の勝ち！少数派を見破った人は +400pt'
      : topIds.length > 1
        ? '同票で決着つかず！少数派が逃げ切って +700pt'
        : '少数派の勝ち！正体を隠し切って +700pt'
  });

  room.timer = setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'playing' || room.phase !== 'result') return;
    room.roundIndex += 1;
    if (room.roundIndex >= room.playPairs.length) finishGame(room);
    else startRound(room);
  }, 8000);
}

function checkVotingComplete(room) {
  if (room.status === 'playing' && room.phase === 'voting' && room.votes.size >= room.players.size) {
    setTimeout(() => revealRound(room), 350);
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

  const wasMinority = room.wolfId === playerId;
  room.players.delete(playerId);
  room.votes.delete(playerId);
  for (const [voterId, targetId] of [...room.votes.entries()]) {
    if (targetId === playerId) room.votes.delete(voterId);
  }

  if (room.status === 'playing' && room.players.size < 3) {
    abortToLobby(room, '3人未満になったためゲームを中断しました。');
    return;
  }

  if (room.status === 'playing' && wasMinority && ['discussion', 'voting'].includes(room.phase)) {
    clearTimer(room);
    io.to(room.code).emit('round-cancelled', '少数派のプレイヤーが退出したため、このラウンドをやり直します。');
    room.phase = 'restarting';
    setTimeout(() => {
      if (rooms.has(room.code) && room.status === 'playing') startRound(room);
    }, 1500);
  } else {
    emitLobby(room);
    checkVotingComplete(room);
  }
}

io.on('connection', socket => {
  if (socket.recovered) {
    const pending = pendingDisconnects.get(socket.id);
    if (pending) {
      clearTimeout(pending);
      pendingDisconnects.delete(socket.id);
    }
    const recoveredRoom = rooms.get(socket.data.roomCode);
    if (recoveredRoom) emitLobby(recoveredRoom);
  }

  socket.on('create-room', ({ name }) => {
    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      status: 'lobby',
      phase: 'lobby',
      rounds: 5,
      discussionSeconds: 60,
      players: new Map(),
      playPairs: [],
      roundIndex: 0,
      wolfId: null,
      majorityWord: '',
      minorityWord: '',
      votes: new Map(),
      timer: null
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

  socket.on('update-settings', ({ code, rounds, discussionSeconds }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    const r = Number(rounds);
    const s = Number(discussionSeconds);
    room.rounds = [3, 5, 8, 10].includes(r) ? r : 5;
    room.discussionSeconds = [30, 45, 60, 90].includes(s) ? s : 60;
    emitLobby(room);
  });

  socket.on('start-game', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    if (room.players.size < 3) return socket.emit('input-error', '正体隠匿ゲームは3人以上で遊んでね！');

    room.playPairs = shuffle(WORD_PAIRS).slice(0, Math.min(room.rounds, WORD_PAIRS.length));
    room.roundIndex = 0;
    room.status = 'playing';
    room.phase = 'starting';
    room.votes.clear();
    for (const p of room.players.values()) p.score = 0;

    emitLobby(room);
    io.to(room.code).emit('game-started', { total: room.playPairs.length });
    setTimeout(() => {
      if (rooms.has(room.code) && room.status === 'playing') startRound(room);
    }, 900);
  });

  socket.on('force-vote', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'playing' || room.phase !== 'discussion') return;
    beginVoting(room);
  });

  socket.on('submit-vote', ({ code, targetId }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.phase !== 'voting' || room.votes.has(socket.id)) return;
    targetId = String(targetId || '');
    if (!room.players.has(socket.id) || !room.players.has(targetId)) return;
    if (targetId === socket.id) return socket.emit('input-error', '自分には投票できません。');

    room.votes.set(socket.id, targetId);
    socket.emit('vote-locked');
    io.to(room.code).emit('vote-progress', { voted: room.votes.size, total: room.players.size });
    checkVotingComplete(room);
  });

  socket.on('restart-lobby', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'finished') return;
    clearTimer(room);
    room.status = 'lobby';
    room.phase = 'lobby';
    room.playPairs = [];
    room.roundIndex = 0;
    room.wolfId = null;
    room.votes.clear();
    for (const p of room.players.values()) p.score = 0;
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
server.listen(PORT, () => console.log(`Word Wolf Party running on port ${PORT}`));
