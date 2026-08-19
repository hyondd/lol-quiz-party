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
  { text: 'サモナーズリフトで、1チームの基本人数は何人？', options: ['3人', '4人', '5人', '6人'], answer: 2 },
  { text: 'サモナーズリフトで、最終的に破壊すると勝利になる建造物は？', options: ['インヒビター', 'ネクサス', 'タワー', 'バロンピット'], answer: 1 },
  { text: '通常のサモナーズリフトで、チャンピオンの最大レベルは？', options: ['16', '18', '20', '25'], answer: 1 },
  { text: 'トップ・ミッド・ボットの3本の道を一般に何と呼ぶ？', options: ['レーン', 'ゾーン', 'ルート', 'ゲート'], answer: 0 },
  { text: '視界を確保するために設置するものは？', options: ['ワード', 'ルーン', 'エモート', 'バフ'], answer: 0 },
  { text: 'ミニオンなどを倒して得た数を表す「CS」の意味に最も近いものは？', options: ['クリープスコア', 'キャリースコア', 'クリティカルスコア', 'コンボスコア'], answer: 0 },
  { text: 'ボットレーンで最も一般的な2人組は？', options: ['ADC＋サポート', 'トップ＋ジャングル', 'ミッド＋トップ', 'ジャングル＋ジャングル'], answer: 0 },
  { text: 'ジャングラーが主に担当する場所は？', options: ['レーン間のジャングル', 'ネクサスの中', 'ショップ前だけ', '川だけ'], answer: 0 },
  { text: 'タワーの主な役割は？', options: ['防衛と進行の拠点', 'スキン変更', 'ルーン変更', 'チャット強化'], answer: 0 },
  { text: '相手チャンピオンを倒したとき、一般的に得られるものは？', options: ['ゴールドと経験値', 'RP', 'スキン', 'エターナル'], answer: 0 },
  { text: 'フラッシュの主な効果は？', options: ['短距離を瞬間移動する', '体力を全回復する', '無敵になる', 'アイテムを無料で買う'], answer: 0 },
  { text: 'テレポートは主に何のために使われる？', options: ['離れた場所へ素早く移動する', '敵をスタンする', 'ゴールドを増やす', 'レベルを上げる'], answer: 0 },
  { text: '「CC」は一般的に何を指す？', options: ['行動妨害', 'クリティカル率', 'クールダウン', 'チャンピオンコスト'], answer: 0 },
  { text: '「ADC」という呼び方で一般に想像される役割は？', options: ['通常攻撃中心の遠距離火力役', 'タンク専用役', 'ジャングル専用役', 'ショップ担当'], answer: 0 },
  { text: '「AP」は一般に何の略として使われる？', options: ['Ability Power', 'Attack Position', 'Armor Point', 'Action Phase'], answer: 0 },
  { text: '「AD」は一般に何の略として使われる？', options: ['Attack Damage', 'Ability Defense', 'Active Dash', 'Armor Drain'], answer: 0 },
  { text: '「Gank」とは一般にどんな行動？', options: ['別レーンなどに奇襲を仕掛ける', 'ショップで買い物する', 'ワードを壊すだけ', '降参投票をする'], answer: 0 },
  { text: '「Roam」とは一般にどんな動き？', options: ['自分のレーンを離れて他の場所へ影響を出す', 'ずっとベースにいる', '同じ場所でCSだけ取る', 'チャットをミュートする'], answer: 0 },
  { text: '「Poke」とは一般にどんな攻撃？', options: ['遠距離から少しずつ削る攻撃', '一撃で必ず倒す攻撃', '味方を回復する行為', 'タワーを修理する行為'], answer: 0 },
  { text: '「Kite」とは一般にどんな操作？', options: ['距離を取りながら攻撃する', 'その場で停止する', '敵に一直線で突っ込む', 'ショップを開き続ける'], answer: 0 },
  { text: '「Peel」とは主に何をすること？', options: ['味方キャリーを敵から守る', '敵のジャングルを全部取る', 'レーンを放棄する', 'スキンを選ぶ'], answer: 0 },
  { text: '「Burst Damage」とは？', options: ['短時間に集中して出す大ダメージ', '長時間かけた回復', '移動速度だけを上げる効果', '視界だけを取る行動'], answer: 0 },
  { text: '「DPS」は何を表す言葉？', options: ['1秒あたりのダメージ', '1分あたりのデス', '1試合のCS', '1回のスキル数'], answer: 0 },
  { text: '「Ult」と略されることが多いものは？', options: ['アルティメットスキル', '通常攻撃', 'サモナースペル', 'ワード'], answer: 0 },
  { text: '通常、チャンピオンのアルティメットはどのキーに割り当てられている？', options: ['R', 'Q', 'W', 'E'], answer: 0 },
  { text: '通常、チャンピオンの基本スキルに使われるキーの組み合わせは？', options: ['Q・W・E', 'A・S・D', 'Z・X・C', 'F1・F2・F3'], answer: 0 },
  { text: 'サモナースペルの基本キーは？', options: ['DとF', 'QとR', 'WとE', 'AとS'], answer: 0 },
  { text: '「Recall」を使うとどうなる？', options: ['一定時間後に自陣の泉へ戻る', '敵陣へ瞬間移動する', 'レベルが1上がる', 'その場で無敵になる'], answer: 0 },
  { text: 'ベースのショップで主に行うことは？', options: ['アイテムを購入する', 'チャンピオンを変更する', '敵の視界を見る', '試合時間を止める'], answer: 0 },
  { text: 'ゴールドの主な使い道は？', options: ['アイテム購入', 'ランクポイント購入', 'チャンピオンレベル購入', '試合時間延長'], answer: 0 }
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
  return String(name || '').trim().slice(0, 18) || 'プレイヤー';
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
    if (!text || options.length !== 4 || options.some(x => !x) || !Number.isInteger(answer) || answer < 0 || answer > 3) return null;
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
    if (room.questionIndex >= room.questions.length) finishGame(room);
    else sendQuestion(room);
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
      title: String(title || 'LoL クイズパーティー').trim().slice(0, 40) || 'LoL クイズパーティー',
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
    room.title = String(title || room.title).trim().slice(0, 40) || 'LoL クイズパーティー';
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
    if (room.answered.size >= room.players.size) setTimeout(() => revealAnswer(room), 500);
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
      io.to(code).emit('room-closed', 'ホストが退出したため、ルームが終了しました。');
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
