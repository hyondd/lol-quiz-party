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
const MAX_QUESTIONS = 100;

const DEFAULT_QUESTIONS = [
  { text: 'ヤスオの「風殺の壁（W）」を通過するものはどれ？', options: ['エズリアルのQ', 'セナのQ', 'アーリのE', 'ナミのR'], answer: 1 },
  { text: 'ポッピーの「ステッドファスト（W）」で止められない移動はどれ？', options: ['ルシアンのE', 'リヴェンのE', 'トリスターナのW', 'エズリアルのE'], answer: 3 },
  { text: 'フィオラの「リポスト（W）」が敵チャンピオンをスタンさせる条件として正しいものは？', options: ['スロウを受け流す', '移動不能系CCを受け流したうえで敵チャンピオンにWを当てる', '通常攻撃を3回受け流す', 'アルティメットを受け流すだけで自動スタン'], answer: 1 },
  { text: 'サプレッションを自分の通常スキルで解除できる代表的なチャンピオンは？', options: ['ガングプランク', 'ジャンナ', 'シヴィア', 'ラックス'], answer: 0 },
  { text: '行動妨害耐性（Tenacity）で基本的に効果時間を短縮できないCCは？', options: ['スタン', '恐怖', '挑発', 'ノックアップ'], answer: 3 },
  { text: 'サモナースペル「クレンズ」で解除できないCCは？', options: ['スタン', 'サプレッション', '恐怖', 'チャーム'], answer: 1 },
  { text: '「Grounded（釘付け）」状態で基本的に使用できなくなるものは？', options: ['通常攻撃', 'フラッシュなどの移動系スペル／スキル', 'アイテム購入', '対象指定の通常スキルすべて'], answer: 1 },
  { text: 'モルガナの「ブラックシールド（E）」の説明として最も正確なのは？', options: ['物理ダメージだけを吸収する', 'シールドが残っている間、魔法ダメージを吸収し多くのCCを防ぐ', 'すべてのダメージを完全無効化する', 'CCを受けた後に自動解除する'], answer: 1 },
  { text: 'キンドレッドの「羊の執行猶予（R）」について正しいものは？', options: ['味方だけが死亡を防がれる', '敵だけが死亡を防がれる', '範囲内なら敵味方の両方が死亡を防がれる', 'タワーだけが無敵になる'], answer: 2 },
  { text: 'バードの「運命の調律（R）」でステイシス状態にできるものは？', options: ['チャンピオンだけ', 'チャンピオンとミニオンだけ', 'チャンピオン・モンスター・タワーなど', '味方だけ'], answer: 2 },
  { text: 'ゾーニャ系の「ステイシス」中の状態として正しいものは？', options: ['移動できるがスキルは使えない', '対象指定されずダメージも受けないが、自分も行動できない', '通常攻撃だけできる', 'CCだけ受ける'], answer: 1 },
  { text: '「無敵（Invulnerability）」と「CC無効」は同じではない。ケイルRの対象について正しいものは？', options: ['ダメージを防いでも、CCまで必ず無効になるわけではない', 'すべてのCCも必ず無効になる', '対象指定そのものができなくなる', '移動できなくなる'], answer: 0 },
  { text: 'コントロールワードで直接暴けないステルスの種類は？', options: ['カモフラージュ', 'インビジブル', '通常の茂み隠れ', '視界外にいるだけの状態'], answer: 1 },
  { text: 'イブリンの高レベル時のパッシブによるステルスは、分類上どれ？', options: ['インビジブル', 'カモフラージュ', 'ステイシス', 'アンターゲッタブル'], answer: 1 },
  { text: 'アカリの煙幕（W）中のステルスについて正しいものは？', options: ['コントロールワードだけで常に完全可視になる', 'インビジブル系で、コントロールワードだけでは通常完全可視にならない', '敵タワーからも絶対に見えない', '攻撃しても一切姿を現さない'], answer: 1 },
  { text: 'アフェリオスで通常の「アクティブスキル」が存在しないキーは？', options: ['Q', 'W', 'E', 'R'], answer: 2 },
  { text: 'アフェリオスがゲーム開始時に持つ2つの武器は？', options: ['キャリブラム＋セヴェラム', 'インファーナム＋クレッシェンダム', 'グラヴィタム＋インファーナム', 'セヴェラム＋グラヴィタム'], answer: 0 },
  { text: 'ウディアのスキル構成として正しいものは？', options: ['QWEの3スキル＋通常のアルティメット', '4つのスタンス系スキルを持ち、一般的な「レベル6で覚えるR」という構造ではない', 'スキルは2つだけ', 'Rだけを切り替えて戦う'], answer: 1 },
  { text: 'フェイ（Hwei）はQ・W・Eの「主題」からさらにQ・W・Eを選ぶ。基本スキルの組み合わせは合計いくつ？', options: ['6', '8', '9', '12'], answer: 2 },
  { text: 'ヴィエゴが敵チャンピオンを憑依したとき、基本的にコピーしないものは？', options: ['通常スキル', '通常攻撃特性', 'アイテム由来の能力', 'その敵のアルティメット'], answer: 3 },
  { text: 'オリアナのRの中心地点はどこ？', options: ['常にオリアナ本人', 'ボールの現在位置', '最も近い味方', 'カーソル位置ならどこでも'], answer: 1 },
  { text: 'カリスタのRを使うために必要な関係は？', options: ['敵にマークを付けている', '契約で結ばれた味方がいる', 'ドラゴンを1体倒している', '槍を10本以上刺している'], answer: 1 },
  { text: 'カーサスのパッシブ発動中にできることは？', options: ['死亡後もしばらくスキルを使用できる', '自由に歩き回れる', '通常攻撃だけできる', 'アイテムを購入できる'], answer: 0 },
  { text: 'サイオンのパッシブ発動後の特徴は？', options: ['その場で即リスポーン', '死亡後もしばらく別状態で戦える', '味方1人を蘇生する', 'タワーに変身する'], answer: 1 },
  { text: 'アニビアのパッシブが使用可能な状態で致死ダメージを受けると？', options: ['即座に泉へ戻る', '卵になり、卵が生き残れば復活する', '5秒間無敵になるだけ', '敵を凍結して死亡する'], answer: 1 },
  { text: 'ザックのパッシブで死亡時に発生するものは？', options: ['4つの細胞片が出現し、残れば再生できる', '分身が1体だけ出る', '味方全員を回復する', '即時リスポーンする'], answer: 0 },
  { text: 'ジリアンのRが付いた味方が効果時間中に死亡すると？', options: ['そのまま死亡する', '一定時間後に復活する', '敵として復活する', 'スタート地点へテレポートするだけ'], answer: 1 },
  { text: 'レナータ・グラスクのWで「死亡猶予」状態になった味方が生き残るための代表的な条件は？', options: ['泉まで歩いて戻る', '猶予中にテイクダウンを取る', 'ワードを置く', 'アルティメットを使う'], answer: 1 },
  { text: 'ノクターンRの第1段階で敵チームに起こる代表的な効果は？', options: ['全員サイレンス', '全員スタン', '視界が大きく制限される', '全員ノックバック'], answer: 2 },
  { text: 'ポッピーRを十分にチャージして敵に当てると、基本的にどちらへ飛ばす？', options: ['ポッピーの泉側', '敵側の本拠地方向', '最寄りのドラゴンピット', 'ランダム方向'], answer: 1 },
  { text: 'Ability Hasteが100のとき、クールダウンは元の何％になる？', options: ['25%', '40%', '50%', '75%'], answer: 2 },
  { text: 'Ability Hasteが50のとき、CD短縮率は約何％？', options: ['25%', '33.3%', '40%', '50%'], answer: 1 },
  { text: 'CD短縮率20%に相当するAbility Hasteは？', options: ['20', '25', '30', '40'], answer: 1 },
  { text: '防御側のArmorが100で、貫通などを考えない場合、物理ダメージ軽減率は？', options: ['約33.3%', '約40%', '50%', '約66.7%'], answer: 2 },
  { text: '防御側のArmorが200で、貫通などを考えない場合、物理ダメージ軽減率は？', options: ['50%', '約60%', '約66.7%', '75%'], answer: 2 },
  { text: '2026シーズン変更後、多くのチャンピオンの基本クリティカルダメージは何％？', options: ['175%', '185%', '200%', '225%'], answer: 2 },
  { text: '2026年のトップRole Quest完了後に上がるレベル上限は？', options: ['18', '19', '20', '21'], answer: 2 },
  { text: '2026年のミッドRole Questの報酬として正しい組み合わせは？', options: ['Tier 2ブーツ→Tier 3ブーツ＋定期的な強化Recall', 'Smite強化＋ジャングル移動速度', '300G＋7枠目の実質解放', 'コントロールワードを2個保存'], answer: 0 },
  { text: '2026年のボットRole Quest完了後、ブーツはどこへ移動する？', options: ['トリンケット枠', 'Role Quest枠', 'サモナースペル枠', '消滅する'], answer: 1 },
  { text: '2026年のジャングルRole Questで最終段階まで強化されたSmiteのダメージは？', options: ['1200', '1300', '1400', '1500'], answer: 2 },
  { text: '2026年のサポートRole Quest完了後、Role Quest枠に保存できるコントロールワードは最大いくつ？', options: ['1', '2', '3', '4'], answer: 1 },
  { text: '2026年に追加された「Faelight」の使い方として正しいものは？', options: ['上にワードを置くと、周辺の追加エリアを一時的に視界化する', '踏むと即座にRecallする', 'Smiteするとドラゴンが出る', '破壊すると500Gを得る'], answer: 0 },
  { text: '2026シーズンのサモナーズリフトで削除された組み合わせは？', options: ['Atakhan＋Blood Roses', 'Baron Nashor＋Elder Dragon', 'Void Grubs＋Rift Scuttler', 'Blue Buff＋Red Buff'], answer: 0 },
  { text: 'Ability Haste 66.7前後は、CD短縮率でおよそ何％に相当する？', options: ['30%', '35%', '40%', '50%'], answer: 2 },
  { text: 'Ability Haste 60のとき、クールダウンは元の何％？', options: ['50%', '60%', '62.5%', '66.7%'], answer: 2 },
  { text: 'Ability Haste 80のとき、CD短縮率は約何％？', options: ['約40%', '約44.4%', '約50%', '約55.6%'], answer: 1 },
  { text: '元のCDが12秒のスキルにAbility Haste 50がある。実際のCDは？', options: ['6秒', '7秒', '8秒', '9秒'], answer: 2 },
  { text: '元のCDが10秒のスキルにAbility Haste 100がある。実際のCDは？', options: ['4秒', '5秒', '6秒', '7.5秒'], answer: 1 },
  { text: 'Armor 120、貫通なしの場合、受ける物理ダメージは元のおよそ何％？', options: ['約40%', '約45.5%', '約50%', '約54.5%'], answer: 1 },
  { text: 'Magic Resist 50、魔法貫通なしの場合、受ける魔法ダメージは元のおよそ何％？', options: ['50%', '約60%', '約66.7%', '75%'], answer: 2 }
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
  const slots = [];
  for (let i = 0; i < count; i++) slots.push(i % 4);
  let shuffled = shuffleArray(slots);
  for (let tries = 0; tries < 100 && hasTripleStreak(shuffled); tries++) shuffled = shuffleArray(slots);
  return shuffled;
}

function buildPlayQuestions(sourceQuestions) {
  const questions = shuffleArray(sourceQuestions.map(q => ({
    text: q.text,
    options: [...q.options],
    answer: q.answer
  })));
  const answerSlots = makeBalancedAnswerSlots(questions.length);

  return questions.map((q, index) => {
    const correctText = q.options[q.answer];
    const wrong = shuffleArray(q.options.filter((_, i) => i !== q.answer));
    const target = answerSlots[index];
    const options = new Array(4);
    options[target] = correctText;

    let wi = 0;
    for (let i = 0; i < 4; i++) {
      if (i !== target) options[i] = wrong[wi++];
    }
    return { text: q.text, options, answer: target };
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
  const q = room.playQuestions[room.questionIndex];
  io.to(room.code).emit('question', {
    index: room.questionIndex,
    total: room.playQuestions.length,
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
  const q = room.playQuestions[room.questionIndex];
  io.to(room.code).emit('answer-reveal', {
    correctIndex: q.answer,
    players: publicPlayers(room)
  });
  room.nextTimer = setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'playing') return;
    room.questionIndex += 1;
    if (room.questionIndex >= room.playQuestions.length) finishGame(room);
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
      playQuestions: [],
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
    room.playQuestions = buildPlayQuestions(room.questions);
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
    const q = room.playQuestions[room.questionIndex];
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
    room.playQuestions = [];
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
