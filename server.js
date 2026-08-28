const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { valuePrompts, oneLinerPrompts } = require('./questions');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: false } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 40;

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

function safeText(text) {
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

function modeTitle(mode) {
  return mode === 'oneLiner' ? 'お題で一言' : '価値観一致ゲーム';
}

function lobbyState(room) {
  return {
    code: room.code,
    status: room.status,
    mode: room.mode,
    modeTitle: modeTitle(room.mode),
    rounds: room.rounds,
    players: publicPlayers(room)
  };
}

function emitLobby(room) {
  io.to(room.code).emit('lobby-state', lobbyState(room));
}

function clearTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
}

function roundProgress(room) {
  return { round: room.roundIndex + 1, total: room.playPrompts.length };
}

function nextRound(room, delay = 5200) {
  clearTimer(room);
  room.timer = setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'playing') return;
    room.roundIndex += 1;
    if (room.roundIndex >= room.playPrompts.length) finishGame(room);
    else startRound(room);
  }, delay);
}

function finishGame(room) {
  clearTimer(room);
  room.status = 'finished';
  room.phase = 'finished';
  io.to(room.code).emit('game-finished', { players: publicPlayers(room) });
  emitLobby(room);
}

function startRound(room) {
  clearTimer(room);
  room.responses = new Map();
  room.votes = new Map();
  room.submissions = [];
  const prompt = room.playPrompts[room.roundIndex];

  if (room.mode === 'values') {
    room.phase = 'value-answering';
    io.to(room.code).emit('value-round', {
      ...roundProgress(room),
      text: prompt.text,
      options: prompt.options,
      seconds: 20
    });
    room.timer = setTimeout(() => revealValues(room), 20000);
  } else {
    room.phase = 'one-writing';
    io.to(room.code).emit('one-liner-round', {
      ...roundProgress(room),
      text: prompt,
      seconds: 35
    });
    room.timer = setTimeout(() => beginVoting(room), 35000);
  }
}

function revealValues(room) {
  if (!rooms.has(room.code) || room.status !== 'playing' || room.phase !== 'value-answering') return;
  clearTimer(room);
  room.phase = 'value-result';
  const prompt = room.playPrompts[room.roundIndex];
  const counts = [0, 0, 0, 0];
  const voters = [[], [], [], []];

  for (const p of room.players.values()) {
    const picked = room.responses.get(p.id);
    if (Number.isInteger(picked) && picked >= 0 && picked < 4) {
      counts[picked] += 1;
      voters[picked].push(p.name);
    }
  }

  const max = Math.max(...counts);
  const winners = max > 0 ? counts.map((n, i) => n === max ? i : -1).filter(i => i >= 0) : [];
  for (const p of room.players.values()) {
    if (winners.includes(room.responses.get(p.id))) p.score += 500;
  }

  io.to(room.code).emit('value-result', {
    ...roundProgress(room),
    text: prompt.text,
    options: prompt.options,
    counts,
    voters,
    winners,
    players: publicPlayers(room)
  });
  nextRound(room, 6000);
}

function beginVoting(room) {
  if (!rooms.has(room.code) || room.status !== 'playing' || room.phase !== 'one-writing') return;
  clearTimer(room);

  const entries = [];
  for (const [authorId, text] of room.responses.entries()) {
    if (text) entries.push({
      id: Math.random().toString(36).slice(2, 10),
      authorId,
      text
    });
  }
  room.submissions = shuffle(entries);
  room.votes = new Map();

  if (!room.submissions.length) {
    room.phase = 'one-result';
    io.to(room.code).emit('one-liner-result', {
      ...roundProgress(room),
      entries: [],
      players: publicPlayers(room),
      message: '今回は回答がありませんでした。'
    });
    return nextRound(room, 3500);
  }

  room.phase = 'one-voting';
  for (const p of room.players.values()) {
    io.to(p.id).emit('one-liner-vote', {
      ...roundProgress(room),
      submissions: room.submissions.map(s => ({ id: s.id, text: s.text, mine: s.authorId === p.id })),
      seconds: 20
    });
  }
  io.to(room.code).emit('vote-progress', { voted: 0, total: eligibleVoters(room).length });
  room.timer = setTimeout(() => revealOneLiner(room), 20000);

  if (eligibleVoters(room).length === 0) {
    clearTimer(room);
    room.timer = setTimeout(() => revealOneLiner(room), 1200);
  }
}

function eligibleVoters(room) {
  return [...room.players.keys()].filter(pid => room.submissions.some(s => s.authorId !== pid));
}

function revealOneLiner(room) {
  if (!rooms.has(room.code) || room.status !== 'playing' || room.phase !== 'one-voting') return;
  clearTimer(room);
  room.phase = 'one-result';

  const voteCounts = new Map(room.submissions.map(s => [s.id, 0]));
  for (const submissionId of room.votes.values()) {
    if (voteCounts.has(submissionId)) voteCounts.set(submissionId, voteCounts.get(submissionId) + 1);
  }

  const maxVotes = Math.max(0, ...voteCounts.values());
  const winnerIds = maxVotes > 0
    ? [...voteCounts.entries()].filter(([, n]) => n === maxVotes).map(([id]) => id)
    : [];

  for (const s of room.submissions) {
    const author = room.players.get(s.authorId);
    if (!author) continue;
    author.score += (voteCounts.get(s.id) || 0) * 200;
    if (winnerIds.includes(s.id)) author.score += 500;
  }

  const entries = room.submissions.map(s => ({
    id: s.id,
    text: s.text,
    authorName: room.players.get(s.authorId)?.name || '退出した人',
    votes: voteCounts.get(s.id) || 0,
    winner: winnerIds.includes(s.id)
  })).sort((a, b) => b.votes - a.votes);

  io.to(room.code).emit('one-liner-result', {
    ...roundProgress(room),
    entries,
    players: publicPlayers(room)
  });
  nextRound(room, 7000);
}

io.on('connection', socket => {
  socket.on('create-room', ({ name, mode }) => {
    const code = makeCode();
    const selectedMode = mode === 'oneLiner' ? 'oneLiner' : 'values';
    const room = {
      code,
      hostId: socket.id,
      status: 'lobby',
      phase: 'lobby',
      mode: selectedMode,
      rounds: 8,
      players: new Map(),
      playPrompts: [],
      roundIndex: 0,
      responses: new Map(),
      votes: new Map(),
      submissions: [],
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

  socket.on('update-settings', ({ code, mode, rounds }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    room.mode = mode === 'oneLiner' ? 'oneLiner' : 'values';
    const r = Number(rounds);
    room.rounds = [5, 8, 10, 12].includes(r) ? r : 8;
    emitLobby(room);
  });

  socket.on('start-game', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    const source = room.mode === 'oneLiner' ? oneLinerPrompts : valuePrompts;
    room.playPrompts = shuffle(source).slice(0, Math.min(room.rounds, source.length));
    room.roundIndex = 0;
    room.status = 'playing';
    room.phase = 'starting';
    for (const p of room.players.values()) p.score = 0;
    emitLobby(room);
    io.to(room.code).emit('game-started', { mode: room.mode, modeTitle: modeTitle(room.mode) });
    setTimeout(() => {
      if (rooms.has(room.code) && room.status === 'playing') startRound(room);
    }, 900);
  });

  socket.on('submit-value', ({ code, choice }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.phase !== 'value-answering' || room.responses.has(socket.id)) return;
    const idx = Number(choice);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;
    room.responses.set(socket.id, idx);
    socket.emit('submission-locked', '選択しました！');
    io.to(room.code).emit('answer-progress', { done: room.responses.size, total: room.players.size });
    if (room.responses.size >= room.players.size) setTimeout(() => revealValues(room), 450);
  });

  socket.on('submit-one-liner', ({ code, text }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.phase !== 'one-writing' || room.responses.has(socket.id)) return;
    const cleaned = safeText(text);
    if (!cleaned) return socket.emit('input-error', '一言を入力してね！');
    room.responses.set(socket.id, cleaned);
    socket.emit('submission-locked', '回答を送信しました！');
    io.to(room.code).emit('answer-progress', { done: room.responses.size, total: room.players.size });
    if (room.responses.size >= room.players.size) setTimeout(() => beginVoting(room), 450);
  });

  socket.on('submit-vote', ({ code, submissionId }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.phase !== 'one-voting' || room.votes.has(socket.id)) return;
    const target = room.submissions.find(s => s.id === String(submissionId));
    if (!target || target.authorId === socket.id) return socket.emit('input-error', '自分の回答には投票できません。');
    room.votes.set(socket.id, target.id);
    socket.emit('vote-locked');
    const eligible = eligibleVoters(room);
    const voted = eligible.filter(id => room.votes.has(id)).length;
    io.to(room.code).emit('vote-progress', { voted, total: eligible.length });
    if (voted >= eligible.length) setTimeout(() => revealOneLiner(room), 450);
  });

  socket.on('restart-lobby', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'finished') return;
    clearTimer(room);
    room.status = 'lobby';
    room.phase = 'lobby';
    room.playPrompts = [];
    room.roundIndex = 0;
    room.responses.clear();
    room.votes.clear();
    room.submissions = [];
    for (const p of room.players.values()) p.score = 0;
    io.to(room.code).emit('back-to-lobby');
    emitLobby(room);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostId === socket.id) {
      clearTimer(room);
      io.to(code).emit('room-closed', 'ホストが退出したため、ルームが終了しました。');
      rooms.delete(code);
      return;
    }
    room.players.delete(socket.id);
    room.responses.delete(socket.id);
    room.votes.delete(socket.id);
    emitLobby(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Party Mix running on port ${PORT}`));
