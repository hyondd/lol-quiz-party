const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: false }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 40;

const DEFAULT_QUESTIONS = [
  {
    text: '소환사의 협곡에서 한 팀의 기본 인원은 몇 명일까?',
    options: ['3명', '4명', '5명', '6명'],
    answer: 2
  },
  {
    text: '일반적인 소환사의 협곡 게임에서 최종적으로 파괴해야 승리하는 건?',
    options: ['억제기', '넥서스', '내셔 남작', '포탑 1개'],
    answer: 1
  },
  {
    text: '챔피언의 일반적인 최대 레벨은?',
    options: ['16', '18', '20', '25'],
    answer: 1
  },
  {
    text: '정글의 강력한 에픽 몬스터인 Baron Nashor의 한국어 명칭은?',
    options: ['장로 드래곤', '공허 유충', '내셔 남작', '협곡의 전령'],
    answer: 2
  },
  {
    text: '라인에서 미니언을 처치해 직접 얻는 대표적인 자원은?',
    options: ['골드', 'RP', '주황 정수', '신화 정수'],
    answer: 0
  },
  {
    text: '상대 챔피언을 처치했을 때 일반적으로 얻을 수 있는 것은?',
    options: ['경험치와 골드', 'RP만', '스킨 조각', '계정 레벨 초기화'],
    answer: 0
  },
  {
    text: '소환사의 협곡에서 바텀 라인에 가장 흔한 조합은?',
    options: ['원딜 + 서포터', '탑 + 정글', '미드 + 탑', '정글 + 정글'],
    answer: 0
  },
  {
    text: '와드의 핵심 용도는?',
    options: ['시야 확보', '체력 영구 증가', '스킬 쿨타임 삭제', '아이템 무료 구매'],
    answer: 0
  },
  {
    text: '포탑은 보통 어떤 역할을 할까?',
    options: ['아군 지역 방어와 진격선 형성', '룬 변경', '챔피언 교체', '핑 삭제'],
    answer: 0
  },
  {
    text: '‘CS’는 보통 무엇을 세는 데 쓰는 표현일까?',
    options: ['미니언 등 처치 수', '스킨 개수', '친구 수', '핑 횟수'],
    answer: 0
  }
];

function makeCode() {
  for (let tries = 0; tries < 100; tries++) {
    let code = '';
    for (let i = 0; i < 5; i++) code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function safeName(name) {
  return String(name || '').trim().slice(0, 18) || '플레이어';
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
  const cleaned = raw.slice(0, 50).map(q => {
    const text = String(q?.text || '').trim().slice(0, 220);
    const options = Array.isArray(q?.options)
      ? q.options.slice(0, 4).map(x => String(x || '').trim().slice(0, 100))
      : [];
    const answer = Number(q?.answer);
    if (!text || options.length !== 4 || options.some(x => !x) || !Number.isInteger(answer) || answer < 0 || answer > 3) {
      return null;
    }
    return { text, options, answer };
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
  room.questionStartedAt = Date.now();
  const q = room.questions[room.questionIndex];
  io.to(room.code).emit('question', {
    index: room.questionIndex,
    total: room.questions.length,
    text: q.text,
    options: q.options,
    seconds: room.secondsPerQuestion
  });

  room.answerTimer = setTimeout(() => revealAnswer(room), room.secondsPerQuestion * 1000);
}

function revealAnswer(room) {
  if (!rooms.has(room.code) || room.status !== 'playing') return;
  clearTimeout(room.answerTimer);
  room.answerTimer = null;
  const q = room.questions[room.questionIndex];
  io.to(room.code).emit('answer-reveal', {
    correctIndex: q.answer,
    players: publicPlayers(room)
  });

  room.nextTimer = setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'playing') return;
    room.questionIndex += 1;
    if (room.questionIndex >= room.questions.length) {
      finishGame(room);
    } else {
      sendQuestion(room);
    }
  }, 3500);
}

function finishGame(room) {
  clearRoomTimers(room);
  room.status = 'finished';
  io.to(room.code).emit('game-finished', { players: publicPlayers(room) });
  emitLobby(room);
}

io.on('connection', socket => {
  socket.on('create-room', ({ name, title }) => {
    const code = makeCode();
    const room = {
      code,
      title: String(title || '롤 퀴즈 파티').trim().slice(0, 40) || '롤 퀴즈 파티',
      hostId: socket.id,
      status: 'lobby',
      players: new Map(),
      questions: DEFAULT_QUESTIONS.map(q => ({ ...q, options: [...q.options] })),
      secondsPerQuestion: 15,
      questionIndex: 0,
      answered: new Set(),
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
    if (!room) return socket.emit('join-error', '존재하지 않는 방이야. 방 코드를 다시 확인해줘.');
    if (room.status !== 'lobby') return socket.emit('join-error', '이미 게임이 시작된 방이야. 다음 판을 기다려줘!');
    if (room.players.size >= MAX_PLAYERS) return socket.emit('join-error', '이 방은 인원이 가득 찼어.');

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
    if (!normalized) return socket.emit('quiz-error', '문제 형식을 확인해줘. 모든 문제는 보기 4개와 정답 1개가 필요해.');
    room.questions = normalized;
    room.title = String(title || room.title).trim().slice(0, 40) || '롤 퀴즈 파티';
    const s = Number(secondsPerQuestion);
    room.secondsPerQuestion = Number.isFinite(s) ? Math.min(60, Math.max(5, Math.round(s))) : 15;
    socket.emit('quiz-saved');
    emitLobby(room);
  });

  socket.on('start-game', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    if (room.questions.length < 1) return;
    room.status = 'playing';
    room.questionIndex = 0;
    for (const p of room.players.values()) p.score = 0;
    emitLobby(room);
    io.to(room.code).emit('game-started');
    setTimeout(() => {
      if (rooms.has(room.code) && room.status === 'playing') sendQuestion(room);
    }, 900);
  });

  socket.on('submit-answer', ({ code, answerIndex }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || !room.players.has(socket.id)) return;
    if (room.answered.has(socket.id)) return;
    const idx = Number(answerIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;

    room.answered.add(socket.id);
    const q = room.questions[room.questionIndex];
    const elapsed = Date.now() - room.questionStartedAt;
    const totalMs = room.secondsPerQuestion * 1000;
    const correct = idx === q.answer;
    let gained = 0;
    if (correct) {
      const remainingRatio = Math.max(0, 1 - elapsed / totalMs);
      gained = Math.round(500 + 500 * remainingRatio);
      room.players.get(socket.id).score += gained;
    }
    socket.emit('answer-locked', { correct, gained });
    io.to(room.code).emit('answer-progress', { answered: room.answered.size, total: room.players.size });

    if (room.answered.size >= room.players.size) {
      setTimeout(() => revealAnswer(room), 500);
    }
  });

  socket.on('restart-lobby', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'finished') return;
    room.status = 'lobby';
    room.questionIndex = 0;
    room.answered.clear();
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
      io.to(code).emit('room-closed', '방장이 나가서 방이 종료됐어.');
      rooms.delete(code);
      return;
    }

    room.players.delete(socket.id);
    room.answered.delete(socket.id);
    if (room.players.size === 0) {
      clearRoomTimers(room);
      rooms.delete(code);
    } else {
      emitLobby(room);
      if (room.status === 'playing' && room.answered.size >= room.players.size) revealAnswer(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`LoL Quiz Party running on port ${PORT}`));
