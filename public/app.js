const socket = io();

const $ = id => document.getElementById(id);
const screens = ['home', 'lobby', 'game', 'result', 'closed'];

let currentRoom = '';
let isHost = false;
let latestPlayers = [];
let quizQuestions = [];
let currentQuestion = null;
let timerInterval = null;
let selectedAnswer = null;

function showScreen(id) {
  screens.forEach(s => $(s).classList.toggle('hidden', s !== id));
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

function escRoomInput(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function getNickname() {
  const n = $('nickname').value.trim();
  if (!n) {
    $('homeError').textContent = 'まずニックネームを入力してね！';
    return null;
  }
  localStorage.setItem('lolquiz-name', n);
  return n;
}

function shareUrl(code) {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`;
}

function renderPlayers(players) {
  latestPlayers = players || [];
  $('playerCount').textContent = latestPlayers.length;
  $('players').innerHTML = '';
  latestPlayers.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';

    const left = document.createElement('div');
    left.className = 'player-name';
    const rank = document.createElement('span');
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('strong');
    name.textContent = p.name;
    left.append(rank, name);

    if (p.isHost) {
      const pill = document.createElement('span');
      pill.className = 'host-pill';
      pill.textContent = 'ホスト';
      left.appendChild(pill);
    }

    const score = document.createElement('span');
    score.className = 'muted';
    score.textContent = `${p.score} pt`;
    row.append(left, score);
    $('players').appendChild(row);
  });
  renderMiniScore(latestPlayers);
}

function renderMiniScore(players) {
  const box = $('miniScoreboard');
  box.innerHTML = '';
  (players || []).slice(0, 6).forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    const name = document.createElement('span');
    name.textContent = `${i + 1}. ${p.name}`;
    const score = document.createElement('strong');
    score.textContent = p.score;
    row.append(name, score);
    box.appendChild(row);
  });
}

function makeQuestionCard(q, index) {
  const card = document.createElement('div');
  card.className = 'q-card';
  card.dataset.index = index;

  const top = document.createElement('div');
  top.className = 'q-top';
  const num = document.createElement('div');
  num.className = 'q-number';
  num.textContent = index + 1;
  const text = document.createElement('input');
  text.className = 'q-text-input';
  text.value = q.text || '';
  text.placeholder = '問題文を入力';
  const del = document.createElement('button');
  del.className = 'icon-btn';
  del.type = 'button';
  del.textContent = '×';
  del.title = '問題を削除';
  del.onclick = () => {
    quizQuestions.splice(index, 1);
    renderQuestionEditor();
  };
  top.append(num, text, del);

  const opts = document.createElement('div');
  opts.className = 'option-editor';
  ['A', 'B', 'C', 'D'].forEach((letter, oi) => {
    const item = document.createElement('label');
    item.className = 'option-item';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `answer-${index}`;
    radio.value = oi;
    radio.checked = Number(q.answer) === oi;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'q-option-input';
    inp.value = q.options?.[oi] || '';
    inp.placeholder = `${letter} の選択肢`;
    item.append(radio, inp);
    opts.appendChild(item);
  });

  card.append(top, opts);
  return card;
}

function renderQuestionEditor() {
  const editor = $('questionEditor');
  editor.innerHTML = '';
  quizQuestions.forEach((q, i) => editor.appendChild(makeQuestionCard(q, i)));
}

function collectQuestions() {
  const cards = [...document.querySelectorAll('.q-card')];
  return cards.map(card => {
    const text = card.querySelector('.q-text-input').value.trim();
    const options = [...card.querySelectorAll('.q-option-input')].map(i => i.value.trim());
    const checked = card.querySelector('input[type="radio"]:checked');
    return { text, options, answer: checked ? Number(checked.value) : -1 };
  });
}

function saveQuiz(startAfter = false) {
  const questions = collectQuestions();
  if (!questions.length) return toast('問題を1問以上作ってね！');
  if (questions.some(q => !q.text || q.options.some(o => !o) || q.answer < 0)) {
    return toast('空欄の問題や選択肢がないか確認してね！');
  }
  quizQuestions = questions;
  $('saveStatus').textContent = '保存中...';
  socket.emit('update-quiz', {
    code: currentRoom,
    title: $('quizTitle').value.trim(),
    questions,
    secondsPerQuestion: Number($('secondsSelect').value)
  });
  if (startAfter) {
    const handler = () => {
      socket.off('quiz-saved', handler);
      socket.emit('start-game', { code: currentRoom });
    };
    socket.on('quiz-saved', handler);
  }
}

function setLobby(code, host) {
  currentRoom = code;
  isHost = host;
  $('roomCodeText').textContent = code;
  $('shareLink').value = shareUrl(code);
  $('hostTools').classList.toggle('hidden', !host);
  $('guestWaiting').classList.toggle('hidden', host);
  showScreen('lobby');
  history.replaceState(null, '', `?room=${encodeURIComponent(code)}`);
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  const start = performance.now();
  $('timerText').textContent = seconds;
  $('timerBar').style.width = '100%';
  timerInterval = setInterval(() => {
    const elapsed = (performance.now() - start) / 1000;
    const remaining = Math.max(0, seconds - elapsed);
    $('timerText').textContent = Math.ceil(remaining);
    $('timerBar').style.width = `${(remaining / seconds) * 100}%`;
    if (remaining <= 0) clearInterval(timerInterval);
  }, 80);
}

function renderQuestion(data) {
  selectedAnswer = null;
  currentQuestion = data;
  $('questionNum').textContent = data.index + 1;
  $('questionTotal').textContent = data.total;
  $('questionText').textContent = data.text;
  $('answerProgress').textContent = `0人回答済み`;
  $('answerMessage').textContent = '';
  const box = $('answers');
  box.innerHTML = '';
  data.options.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.dataset.index = i;
    const letter = document.createElement('span');
    letter.className = 'answer-letter';
    letter.textContent = String.fromCharCode(65 + i);
    const label = document.createElement('span');
    label.textContent = text;
    btn.append(letter, label);
    btn.onclick = () => submitAnswer(i);
    box.appendChild(btn);
  });
  startTimer(data.seconds);
}

function submitAnswer(i) {
  if (selectedAnswer !== null) return;
  selectedAnswer = i;
  [...document.querySelectorAll('.answer-btn')].forEach((b, bi) => {
    b.disabled = true;
    if (bi === i) b.classList.add('selected');
  });
  $('answerMessage').textContent = '回答を確定！ほかのプレイヤーを待っています...';
  socket.emit('submit-answer', { code: currentRoom, answerIndex: i });
}

function revealAnswer(data) {
  clearInterval(timerInterval);
  latestPlayers = data.players || latestPlayers;
  [...document.querySelectorAll('.answer-btn')].forEach((b, i) => {
    b.disabled = true;
    if (i === data.correctIndex) b.classList.add('correct');
    if (selectedAnswer === i && i !== data.correctIndex) b.classList.add('wrong');
  });
  $('answerMessage').textContent = selectedAnswer === data.correctIndex ? '正解！ポイント獲得！' : '正解発表！次の問題を準備中...';
  renderMiniScore(latestPlayers);
}

function renderFinal(players) {
  const sorted = [...(players || [])].sort((a, b) => b.score - a.score);
  $('podium').innerHTML = '';
  const top3 = sorted.slice(0, 3);
  const displayOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  displayOrder.forEach(p => {
    const actualRank = sorted.findIndex(x => x.id === p.id) + 1;
    const card = document.createElement('div');
    card.className = `podium-card ${actualRank === 1 ? 'first' : ''}`;
    const rank = document.createElement('div');
    rank.className = 'rank';
    rank.textContent = actualRank === 1 ? '🥇' : actualRank === 2 ? '🥈' : '🥉';
    const name = document.createElement('strong');
    name.textContent = p.name;
    const score = document.createElement('span');
    score.textContent = `${p.score} pt`;
    card.append(rank, name, score);
    $('podium').appendChild(card);
  });

  $('finalScoreboard').innerHTML = '';
  sorted.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    const n = document.createElement('span');
    n.textContent = `${i + 1}位 · ${p.name}`;
    const s = document.createElement('strong');
    s.textContent = `${p.score} pt`;
    row.append(n, s);
    $('finalScoreboard').appendChild(row);
  });
  $('restartBtn').classList.toggle('hidden', !isHost);
  showScreen('result');
}

$('roomCode').addEventListener('input', e => e.target.value = escRoomInput(e.target.value));
$('nickname').value = localStorage.getItem('lolquiz-name') || '';

const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) $('roomCode').value = escRoomInput(urlRoom);

$('createBtn').onclick = () => {
  const name = getNickname();
  if (!name) return;
  $('homeError').textContent = '';
  socket.emit('create-room', { name, title: 'LoL クイズパーティー' });
};

$('joinBtn').onclick = () => {
  const name = getNickname();
  if (!name) return;
  const code = escRoomInput($('roomCode').value);
  if (!code) return $('homeError').textContent = 'ルームコードを入力してね！';
  $('homeError').textContent = '';
  socket.emit('join-room', { code, name });
};

$('copyBtn').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('shareLink').value);
    toast('招待リンクをコピーしました！');
  } catch {
    $('shareLink').select();
    document.execCommand('copy');
    toast('招待リンクをコピーしました！');
  }
};

$('addQuestionBtn').onclick = () => {
  syncEditorToState();
  quizQuestions.push({ text: '', options: ['', '', '', ''], answer: 0 });
  renderQuestionEditor();
  setTimeout(() => $('questionEditor').scrollTo({ top: $('questionEditor').scrollHeight, behavior: 'smooth' }), 50);
};

function syncEditorToState() {
  const cards = [...document.querySelectorAll('.q-card')];
  if (cards.length) quizQuestions = collectQuestions();
}

$('saveQuizBtn').onclick = () => saveQuiz(false);
$('startBtn').onclick = () => saveQuiz(true);
$('restartBtn').onclick = () => socket.emit('restart-lobby', { code: currentRoom });

socket.on('room-created', ({ code, isHost: host }) => setLobby(code, host));
socket.on('room-joined', ({ code, isHost: host }) => setLobby(code, host));
socket.on('join-error', msg => $('homeError').textContent = msg);
socket.on('quiz-error', msg => toast(msg));
socket.on('quiz-saved', () => {
  $('saveStatus').textContent = '保存しました';
  setTimeout(() => $('saveStatus').textContent = '', 1400);
});

socket.on('quiz-data', data => {
  quizQuestions = data.questions || [];
  $('quizTitle').value = data.title || 'LoL クイズパーティー';
  $('secondsSelect').value = String(data.secondsPerQuestion || 15);
  renderQuestionEditor();
});

socket.on('lobby-state', data => {
  currentRoom = data.code;
  $('roomCodeText').textContent = data.code;
  $('roomTitleText').textContent = data.title;
  $('shareLink').value = shareUrl(data.code);
  renderPlayers(data.players);
});

socket.on('game-started', () => {
  showScreen('game');
  $('questionText').textContent = 'ゲームスタート！';
  $('answers').innerHTML = '';
  $('answerMessage').textContent = '第1問を準備中...';
  renderMiniScore(latestPlayers);
});

socket.on('question', data => {
  showScreen('game');
  renderQuestion(data);
});

socket.on('answer-locked', ({ correct, gained }) => {
  $('answerMessage').textContent = correct ? `正解！ +${gained}点 · 正解発表を待っています...` : '回答済み · 正解発表を待っています...';
});

socket.on('answer-progress', ({ answered, total }) => {
  $('answerProgress').textContent = `${answered}/${total}人回答済み`;
});

socket.on('answer-reveal', revealAnswer);
socket.on('game-finished', ({ players }) => renderFinal(players));
socket.on('back-to-lobby', () => showScreen('lobby'));

socket.on('room-closed', msg => {
  clearInterval(timerInterval);
  $('closedMessage').textContent = msg;
  showScreen('closed');
});
