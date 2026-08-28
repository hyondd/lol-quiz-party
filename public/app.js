const socket = io();
const $ = id => document.getElementById(id);
const screens = ['home', 'lobby', 'game', 'result', 'closed'];

let selectedMode = 'values';
let currentRoom = '';
let isHost = false;
let latestPlayers = [];
let currentPrompt = '';
let timerInterval = null;

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
    $('homeError').textContent = 'ニックネームを入力してね！';
    return null;
  }
  localStorage.setItem('party-name', n);
  return n;
}

function shareUrl(code) {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`;
}

function modeName(mode) {
  return mode === 'oneLiner' ? 'お題で一言' : '価値観一致ゲーム';
}

function modeDescription(mode) {
  return mode === 'oneLiner'
    ? '全員が匿名で一言を投稿。回答者の名前を隠したまま投票して、一番票を集めた回答がボーナス！'
    : '全員が4択から選択。一番多かった選択肢を選んだ人が500ポイント獲得！同率なら両方が多数派。';
}

function renderPlayers(players) {
  latestPlayers = players || [];
  $('playerCount').textContent = latestPlayers.length;
  const box = $('players');
  box.innerHTML = '';
  latestPlayers.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    const left = document.createElement('div');
    left.className = 'player-name';
    const rank = document.createElement('span');
    rank.className = 'player-index';
    rank.textContent = `${i + 1}`;
    const name = document.createElement('strong');
    name.textContent = p.name;
    left.append(rank, name);
    if (p.isHost) {
      const pill = document.createElement('span');
      pill.className = 'host-pill';
      pill.textContent = 'HOST';
      left.appendChild(pill);
    }
    const score = document.createElement('span');
    score.className = 'muted';
    score.textContent = `${p.score} pt`;
    row.append(left, score);
    box.appendChild(row);
  });
  renderMiniScore(latestPlayers);
}

function renderMiniScore(players) {
  const box = $('miniScoreboard');
  box.innerHTML = '';
  (players || []).slice(0, 6).forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    const n = document.createElement('span');
    n.textContent = `${i + 1}. ${p.name}`;
    const s = document.createElement('strong');
    s.textContent = p.score;
    row.append(n, s);
    box.appendChild(row);
  });
}

function setRound(round, total, label) {
  $('roundNum').textContent = round;
  $('roundTotal').textContent = total;
  $('stageLabel').textContent = label;
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  $('timerBar').style.width = '0%';
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

function setPrompt(text) {
  currentPrompt = text || currentPrompt;
  $('promptText').textContent = text || '';
}

function clearGameContent() {
  $('gameContent').innerHTML = '';
  $('gameMessage').textContent = '';
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

function updateModePicker() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.mode === selectedMode);
  });
}

function renderValueRound(data) {
  showScreen('game');
  clearGameContent();
  setRound(data.round, data.total, '価値観');
  setPrompt(data.text);
  $('progressText').textContent = `0/${latestPlayers.length}人 選択済み`;

  const grid = document.createElement('div');
  grid.className = 'choice-grid';
  data.options.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.className = 'choice-card';
    const num = document.createElement('span');
    num.className = 'choice-num';
    num.textContent = String.fromCharCode(65 + index);
    const text = document.createElement('strong');
    text.textContent = option;
    btn.append(num, text);
    btn.onclick = () => {
      document.querySelectorAll('.choice-card').forEach(b => b.disabled = true);
      btn.classList.add('selected');
      socket.emit('submit-value', { code: currentRoom, choice: index });
    };
    grid.appendChild(btn);
  });
  $('gameContent').appendChild(grid);
  startTimer(data.seconds);
}

function renderValueResult(data) {
  stopTimer();
  setRound(data.round, data.total, '結果発表');
  setPrompt(data.text);
  $('progressText').textContent = 'みんなの価値観はこちら';
  $('gameContent').innerHTML = '';

  const max = Math.max(1, ...data.counts);
  const box = document.createElement('div');
  box.className = 'result-choice-list';
  data.options.forEach((option, i) => {
    const card = document.createElement('div');
    card.className = `result-choice ${data.winners.includes(i) ? 'winner' : ''}`;
    const top = document.createElement('div');
    top.className = 'result-choice-top';
    const label = document.createElement('strong');
    label.textContent = option;
    const count = document.createElement('span');
    count.textContent = `${data.counts[i]}票`;
    top.append(label, count);

    const bar = document.createElement('div');
    bar.className = 'vote-bar';
    const fill = document.createElement('div');
    fill.style.width = `${(data.counts[i] / max) * 100}%`;
    bar.appendChild(fill);

    const names = document.createElement('small');
    names.textContent = data.voters[i]?.length ? data.voters[i].join('・') : '選んだ人なし';
    card.append(top, bar, names);
    box.appendChild(card);
  });
  $('gameContent').appendChild(box);
  $('gameMessage').textContent = data.winners.length > 1
    ? '🤝 同率多数派！該当する選択をした人は +500pt'
    : '🎯 多数派を選んだ人は +500pt';
  renderPlayers(data.players);
}

function renderOneLinerRound(data) {
  showScreen('game');
  clearGameContent();
  setRound(data.round, data.total, 'お題で一言');
  setPrompt(data.text);
  $('progressText').textContent = `0/${latestPlayers.length}人 回答済み`;

  const wrap = document.createElement('div');
  wrap.className = 'write-box';
  const textarea = document.createElement('textarea');
  textarea.maxLength = 80;
  textarea.placeholder = 'ここに一言。短いほど強いかも。';
  const bottom = document.createElement('div');
  bottom.className = 'write-bottom';
  const counter = document.createElement('span');
  counter.className = 'muted';
  counter.textContent = '0/80';
  const submit = document.createElement('button');
  submit.className = 'btn primary';
  submit.textContent = '回答を送信';
  textarea.oninput = () => counter.textContent = `${textarea.value.length}/80`;
  submit.onclick = () => {
    if (!textarea.value.trim()) return toast('一言を入力してね！');
    socket.emit('submit-one-liner', { code: currentRoom, text: textarea.value });
    textarea.disabled = true;
    submit.disabled = true;
  };
  bottom.append(counter, submit);
  wrap.append(textarea, bottom);
  $('gameContent').appendChild(wrap);
  startTimer(data.seconds);
  setTimeout(() => textarea.focus(), 100);
}

function renderOneLinerVote(data) {
  stopTimer();
  setRound(data.round, data.total, '匿名投票');
  $('progressText').textContent = '一番好きな回答を1つ選んで！';
  $('gameContent').innerHTML = '';
  $('gameMessage').textContent = '誰の回答かは結果発表まで秘密。';

  const grid = document.createElement('div');
  grid.className = 'submission-grid';
  data.submissions.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.className = `submission-card ${s.mine ? 'mine' : ''}`;
    btn.disabled = s.mine;
    const tag = document.createElement('span');
    tag.className = 'submission-tag';
    tag.textContent = s.mine ? 'あなたの回答' : `回答 ${i + 1}`;
    const text = document.createElement('strong');
    text.textContent = s.text;
    btn.append(tag, text);
    if (!s.mine) {
      btn.onclick = () => {
        document.querySelectorAll('.submission-card').forEach(b => b.disabled = true);
        btn.classList.add('selected');
        socket.emit('submit-vote', { code: currentRoom, submissionId: s.id });
      };
    }
    grid.appendChild(btn);
  });
  $('gameContent').appendChild(grid);
  startTimer(data.seconds);
}

function renderOneLinerResult(data) {
  stopTimer();
  setRound(data.round, data.total, '結果発表');
  $('progressText').textContent = '回答者オープン！';
  $('gameContent').innerHTML = '';

  if (!data.entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.textContent = data.message || '回答がありませんでした。';
    $('gameContent').appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'reveal-list';
    data.entries.forEach((entry, i) => {
      const card = document.createElement('div');
      card.className = `reveal-card ${entry.winner ? 'winner' : ''}`;
      const rank = document.createElement('span');
      rank.className = 'reveal-rank';
      rank.textContent = entry.winner ? '👑' : `${i + 1}`;
      const body = document.createElement('div');
      const text = document.createElement('strong');
      text.textContent = entry.text;
      const meta = document.createElement('small');
      meta.textContent = `${entry.authorName} · ${entry.votes}票`;
      body.append(text, meta);
      card.append(rank, body);
      list.appendChild(card);
    });
    $('gameContent').appendChild(list);
  }
  $('gameMessage').textContent = '1票 = 200pt、最多得票の回答にはさらに +500pt';
  renderPlayers(data.players);
}

function renderFinal(players) {
  stopTimer();
  const sorted = [...(players || [])].sort((a, b) => b.score - a.score);
  $('podium').innerHTML = '';
  const top3 = sorted.slice(0, 3);
  const displayOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  displayOrder.forEach(p => {
    const actualRank = sorted.findIndex(x => x.id === p.id) + 1;
    const card = document.createElement('div');
    card.className = `podium-card ${actualRank === 1 ? 'first' : ''}`;
    const medal = document.createElement('div');
    medal.className = 'rank';
    medal.textContent = actualRank === 1 ? '🥇' : actualRank === 2 ? '🥈' : '🥉';
    const name = document.createElement('strong');
    name.textContent = p.name;
    const score = document.createElement('span');
    score.textContent = `${p.score} pt`;
    card.append(medal, name, score);
    $('podium').appendChild(card);
  });

  $('finalScoreboard').innerHTML = '';
  sorted.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    const name = document.createElement('span');
    name.textContent = `${i + 1}位 · ${p.name}`;
    const score = document.createElement('strong');
    score.textContent = `${p.score} pt`;
    row.append(name, score);
    $('finalScoreboard').appendChild(row);
  });
  $('restartBtn').classList.toggle('hidden', !isHost);
  showScreen('result');
}

// Home
$('nickname').value = localStorage.getItem('party-name') || localStorage.getItem('lolquiz-name') || '';
$('roomCode').addEventListener('input', e => e.target.value = escRoomInput(e.target.value));
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) $('roomCode').value = escRoomInput(urlRoom);

document.querySelectorAll('.mode-card').forEach(card => {
  card.onclick = () => {
    selectedMode = card.dataset.mode;
    updateModePicker();
  };
});

$('createBtn').onclick = () => {
  const name = getNickname();
  if (!name) return;
  $('homeError').textContent = '';
  socket.emit('create-room', { name, mode: selectedMode });
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

function emitSettings() {
  if (!isHost || !currentRoom) return;
  socket.emit('update-settings', {
    code: currentRoom,
    mode: $('modeSelect').value,
    rounds: Number($('roundsSelect').value)
  });
}

$('modeSelect').onchange = emitSettings;
$('roundsSelect').onchange = emitSettings;
$('startBtn').onclick = () => socket.emit('start-game', { code: currentRoom });
$('restartBtn').onclick = () => socket.emit('restart-lobby', { code: currentRoom });

// Socket events
socket.on('room-created', ({ code, isHost: host }) => setLobby(code, host));
socket.on('room-joined', ({ code, isHost: host }) => setLobby(code, host));
socket.on('join-error', msg => $('homeError').textContent = msg);
socket.on('input-error', msg => toast(msg));
socket.on('submission-locked', msg => $('gameMessage').textContent = `${msg} みんなを待っています...`);
socket.on('vote-locked', () => $('gameMessage').textContent = '投票しました！結果を待っています...');

socket.on('lobby-state', data => {
  currentRoom = data.code;
  $('roomCodeText').textContent = data.code;
  $('roomTitleText').textContent = data.modeTitle || modeName(data.mode);
  $('shareLink').value = shareUrl(data.code);
  renderPlayers(data.players);
  if (isHost) {
    $('modeSelect').value = data.mode;
    $('roundsSelect').value = String(data.rounds);
    $('modeExplain').textContent = modeDescription(data.mode);
  }
});

socket.on('game-started', ({ modeTitle }) => {
  showScreen('game');
  clearGameContent();
  $('stageLabel').textContent = 'START';
  $('roundNum').textContent = '—';
  $('roundTotal').textContent = '—';
  $('progressText').textContent = modeTitle;
  setPrompt('ゲームスタート！');
  renderMiniScore(latestPlayers);
});

socket.on('value-round', renderValueRound);
socket.on('value-result', renderValueResult);
socket.on('one-liner-round', renderOneLinerRound);
socket.on('one-liner-vote', renderOneLinerVote);
socket.on('one-liner-result', renderOneLinerResult);

socket.on('answer-progress', ({ done, total }) => {
  $('progressText').textContent = `${done}/${total}人 完了`;
});

socket.on('vote-progress', ({ voted, total }) => {
  if (total > 0) $('progressText').textContent = `${voted}/${total}人 投票済み`;
});

socket.on('game-finished', ({ players }) => renderFinal(players));
socket.on('back-to-lobby', () => showScreen('lobby'));
socket.on('room-closed', msg => {
  stopTimer();
  $('closedMessage').textContent = msg;
  showScreen('closed');
});
