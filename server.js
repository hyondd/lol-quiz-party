const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const DEFAULT_QUESTIONS = require('./questions');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: false } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 40;
const MAX_QUESTIONS = 100;
const DEFAULT_TITLE = '原神 クイズパーティー';

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

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hasTripleStreak(slots) {
  for (let i = 2; i < slots.length; i++) {
    if (slots[i] === slots[i - 1] && slots[i] === slots[i - 2]) return true;
  }
  return false;
}

function makeBalancedAnswerSlots(count) {
  const base = [];
  for (let i = 0; i < count; i++) base.push(i % 4);
  let slots = shuffleArray(base);
  for (let tries = 0; tries < 200 && hasTripleStreak(slots); tries++) slots = shuffleArray(base);
  return slots;
}

function buildPlayQuestions(sourceQuestions) {
  const questions = shuffleArray(sourceQuestions.map(q => ({
    text: q.text,
    ko: q.ko || '',
    options: [...q.options],
    optionsKo: Array.isArray(q.optionsKo) ? [...q.optionsKo] : ['', '', '', ''],
    answer: q.answer
  })));

  const answerSlots = makeBalancedAnswerSlots(questions.length);

  return questions.map((q, index) => {
    const choices = q.options.map((text, i) => ({ text, ko: q.optionsKo[i] || '' }));
    const correctChoice = choices[q.answer];
    const wrongChoices = shuffleArray(choices.filter((_, i) => i !== q.answer));
    const target = answerSlots[index];
    const arranged = new Array(4);
    arranged[target] = correctChoice;
    let wi = 0;
    for (let i = 0; i < 4; i++) if (i !== target) arranged[i] = wrongChoices[wi++];

    return {
      text: q.text,
      ko: q.ko,
      options: arranged.map(x => x.text),
      optionsKo: arranged.map(x => x.ko),
      answer: target
    };
  });
}

function publicPlayers(room) {
  return [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, score: p.score, isHost: p.id === room.hostId }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function lobbyState(room) {
  return {
    code: room.code,
    title: room.title,
    status: room.status,
    players: publicPlayers(room),
    questionCount: room.questions.length,
    secondsPerQuestion: room.secondsPerQuestion
  };
}

function emitLobby(room) {
  io.to(room.code).emit('lobby-state', lobbyState(room));
}

function normalizeQuestions(raw) {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw.slice(0, MAX_QUESTIONS).map(q => {
    const text = String(q?.text || '').trim().slice(0, 260);
    const ko = String(q?.ko || '').trim().slice(0, 260);
    const options = Array.isArray(q?.options)
      ? q.options.slice(0, 4).map(x => String(x || '').trim().slice(0, 120))
      : [];
    const optionsKo = Array.isArray(q?.optionsKo)
      ? q.optionsKo.slice(0, 4).map(x => String(x || '').trim().slice(0, 120))
      : ['', '', '', ''];
    while (optionsKo.length < 4) optionsKo.push('');
    const answer = Number(q?.answer);
    if (!text || options.length !== 4 || options.some(x => !x) || !Number.isInteger(answer) || answer < 0 || answer > 3) return null;
    return { text, ko, options, optionsKo, answer };
  }).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

function clearRoomTimers(room) {
  if (room.answerTimer) clearTimeout(room.answerTimer);
  if (room.nextTimer) clearTimeout(room.nextTimer);
  room.answerTimer = null;
  room.nextTimer = null;
}

function sendQuestion(room) {
  clearRoomTimers(room);
  room.answered.clear();
  room.answers.clear();
  room.questionResolved = false;
  room.questionStartedAt = Date.now();

  const q = room.playQuestions[room.questionIndex];
  io.to(room.code).emit('question', {
    index: room.questionIndex,
    total: room.playQuestions.length,
    text: q.text,
    ko: q.ko,
    options: q.options,
    optionsKo: q.optionsKo,
    seconds: room.secondsPerQuestion
  });

  room.answerTimer = setTimeout(() => revealAnswer(room), room.secondsPerQuestion * 1000);
}

function revealAnswer(room) {
  if (!rooms.has(room.code) || room.status !== 'playing' || room.questionResolved) return;
  room.questionResolved = true;
  clearTimeout(room.answerTimer);
  room.answerTimer = null;

  const q = room.playQuestions[room.questionIndex];
  const wrongPlayers = [];
  const unansweredPlayers = [];

  for (const p of room.players.values()) {
    if (!room.answers.has(p.id)) {
      unansweredPlayers.push({ id: p.id, name: p.name });
      continue;
    }
    const picked = room.answers.get(p.id);
    if (picked !== q.answer) wrongPlayers.push({ id: p.id, name: p.name, answerIndex: picked });
  }

  io.to(room.code).emit('answer-reveal', {
    correctIndex: q.answer,
    players: publicPlayers(room),
    wrongPlayers,
    unansweredPlayers
  });

  room.nextTimer = setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'playing') return;
    room.questionIndex += 1;
    if (room.questionIndex >= room.playQuestions.length) finishGame(room);
    else sendQuestion(room);
  }, 5200);
}

function finishGame(room) {
  clearRoomTimers(room);
  room.status = 'finished';
  io.to(room.code).emit('game-finished', { players: publicPlayers(room) });
  emitLobby(room);
}

io.on('connection', socket => {
  socket.on('create-room', ({ name }) => {
    const code = makeCode();
    const room = {
      code,
      title: DEFAULT_TITLE,
      hostId: socket.id,
      status: 'lobby',
      players: new Map(),
      questions: DEFAULT_QUESTIONS.map(q => ({ ...q, options: [...q.options], optionsKo: [...q.optionsKo] })),
      playQuestions: [],
      secondsPerQuestion: 15,
      questionIndex: 0,
      answered: new Set(),
      answers: new Map(),
      questionResolved: false,
      questionStartedAt: 0,
      answerTimer: null,
      nextTimer: null
    };

    room.players.set(socket.id, { id: socket.id, name: safeName(name), score: 0 });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-created', { code, isHost: true });
    socket.emit('quiz-data', { questions: room.questions, secondsPerQuestion: room.secondsPerQuestion, title: room.title });
    emitLobby(room);
  });

  socket.on('join-room', ({ code, name }) => {
    code = String(code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('join-error', 'そのルームは見つかりません。ルームコードを確認してね。');
    if (room.status !== 'lobby') return socket.emit('join-error', 'このルームはすでにゲーム中です。次のゲームを待ってね！');
    if (room.players.size >= MAX_PLAYERS) return socket.emit('join-error', 'このルームは満員です。');

    room.players.set(socket.id, { id: socket.id, name: safeName(name), score: 0 });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-joined', { code, isHost: false });
    emitLobby(room);
  });

  socket.on('update-quiz', ({ code, title, questions, secondsPerQuestion }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    const normalized = normalizeQuestions(questions);
    if (!normalized) return socket.emit('quiz-error', '問題形式を確認してね。各問題には4つの選択肢と1つの正解が必要です。');

    room.questions = normalized;
    room.title = String(title || room.title).trim().slice(0, 40) || DEFAULT_TITLE;
    const s = Number(secondsPerQuestion);
    room.secondsPerQuestion = Number.isFinite(s) ? Math.min(60, Math.max(5, Math.round(s))) : 15;
    socket.emit('quiz-saved');
    emitLobby(room);
  });

  socket.on('start-game', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby' || room.questions.length < 1) return;

    room.status = 'playing';
    room.questionIndex = 0;
    room.playQuestions = buildPlayQuestions(room.questions);
    room.answers.clear();
    room.answered.clear();
    for (const p of room.players.values()) p.score = 0;

    emitLobby(room);
    io.to(room.code).emit('game-started');
    setTimeout(() => {
      if (rooms.has(room.code) && room.status === 'playing') sendQuestion(room);
    }, 900);
  });

  socket.on('submit-answer', ({ code, answerIndex }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.questionResolved || !room.players.has(socket.id) || room.answered.has(socket.id)) return;

    const idx = Number(answerIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;

    room.answered.add(socket.id);
    room.answers.set(socket.id, idx);

    const q = room.playQuestions[room.questionIndex];
    const elapsed = Date.now() - room.questionStartedAt;
    const totalMs = room.secondsPerQuestion * 1000;
    if (idx === q.answer) {
      const remainingRatio = Math.max(0, 1 - elapsed / totalMs);
      const gained = Math.round(500 + 500 * remainingRatio);
      room.players.get(socket.id).score += gained;
    }

    socket.emit('answer-locked', { submitted: true });
    io.to(room.code).emit('answer-progress', { answered: room.answered.size, total: room.players.size });
    if (room.answered.size >= room.players.size) setTimeout(() => revealAnswer(room), 500);
  });

  socket.on('restart-lobby', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'finished') return;

    room.status = 'lobby';
    room.questionIndex = 0;
    room.playQuestions = [];
    room.answered.clear();
    room.answers.clear();
    room.questionResolved = false;
    for (const p of room.players.values()) p.score = 0;

    io.to(room.code).emit('back-to-lobby');
    socket.emit('quiz-data', { questions: room.questions, secondsPerQuestion: room.secondsPerQuestion, title: room.title });
    emitLobby(room);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    if (room.hostId === socket.id) {
      clearRoomTimers(room);
      io.to(code).emit('room-closed', 'ホストが退出したため、ルームが終了しました。');
      rooms.delete(code);
      return;
    }

    room.players.delete(socket.id);
    room.answered.delete(socket.id);
    room.answers.delete(socket.id);

    if (room.players.size === 0) {
      clearRoomTimers(room);
      rooms.delete(code);
    } else {
      emitLobby(room);
      if (room.status === 'playing' && !room.questionResolved && room.answered.size >= room.players.size) revealAnswer(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Genshin Quiz Party running on port ${PORT}`));
