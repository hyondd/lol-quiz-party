const socket = io();
const $ = id => document.getElementById(id);
const screens = ['home', 'lobby', 'game', 'result', 'closed'];

let currentRoom = '';
let isHost = false;
let latestPlayers = [];
let timerInterval = null;
let secretWord = '';
let hasConnectedOnce = false;

function showScreen(id) {
  screens.forEach(s => $(s).classList.toggle('hidden', s !== id));
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
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
  }, 100);
}

function setRound(round, total, stage) {
  $('roundNum').textContent = round;
  $('roundTotal').textContent = total;
  $('stageLabel').textContent = stage;
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
    const index = document.createElement('span');
    index.className = 'player-index';
    index.textContent = i + 1;
    const name = document.createElement('strong');
    name.textContent = p.name;
    left.append(index, name);

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
  (players || []).slice(0, 8).forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    const name = document.createElement('span');
    name.textContent = `${i + 1}. ${p.name}`;
    const score = document.createElement('strong');
    score.textContent = `${p.score}`;
    row.append(name, score);
    box.appendChild(row);
  });
}

function clearGame() {
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

function renderRoundStart(data) {
  showScreen('game');
  clearGame();
  secretWord = '';
  setRound(data.round, data.total, 'DISCUSSION');
  $('progressText').textContent = '自分のお題を確認して、みんなで話そう';

  const wrap = document.createElement('div');
  wrap.className = 'secret-wrap';

  const label = document.createElement('div');
  label.className = 'secret-label';
  label.textContent = '🔒 あなたのお題';

  const word = document.createElement('div');
  word.id = 'secretWord';
  word.className = 'secret-word';
  word.textContent = '受信中...';

  const note = document.createElement('p');
  note.className = 'muted secret-note';
  note.textContent = 'このお題は他の人に見せないでね。自分が多数派か少数派かは誰にも分かりません。';

  wrap.append(label, word, note);
  $('gameContent').appendChild(wrap);

  const talk = document.createElement('div');
  talk.className = 'talk-card';
  talk.innerHTML = '<strong>💬 話し方のコツ</strong><span>お題を直接言わずに、特徴や思い出を少しずつ話そう。</span>';
  $('gameContent').appendChild(talk);

  if (isHost) {
    const force = document.createElement('button');
    force.className = 'btn secondary vote-now';
    force.textContent = 'みんな話し終わった → 投票へ';
    force.onclick = () => {
      force.disabled = true;
      socket.emit('force-vote', { code: currentRoom });
    };
    $('gameContent').appendChild(force);
  }

  startTimer(data.seconds);
  renderMiniScore(data.players || latestPlayers);
}

function renderSecretWord(data) {
  secretWord = data.word || '';
  const el = $('secretWord');
  if (el) el.textContent = secretWord || '？？？';
}

function renderVoting(data) {
  stopTimer();
  clearGame();
  setRound(data.round, data.total, 'VOTE');
  $('progressText').textContent = `0/${data.players.length}人 投票済み`;

  const title = document.createElement('div');
  title.className = 'vote-title';
  title.innerHTML = '<span>🐺</span><strong>誰が少数派だと思う？</strong><small>自分以外の1人に投票</small>';
  $('gameContent').appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'vote-grid';
  data.players.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'vote-card';
    btn.disabled = p.id === socket.id;

    const avatar = document.createElement('span');
    avatar.className = 'vote-avatar';
    avatar.textContent = p.name.slice(0, 1).toUpperCase();
    const name = document.createElement('strong');
    name.textContent = p.name;
    const hint = document.createElement('small');
    hint.textContent = p.id === socket.id ? 'あなた' : 'この人に投票';
    btn.append(avatar, name, hint);

    if (p.id !== socket.id) {
      btn.onclick = () => {
        document.querySelectorAll('.vote-card').forEach(b => b.disabled = true);
        btn.classList.add('selected');
        socket.emit('submit-vote', { code: currentRoom, targetId: p.id });
      };
    }
    grid.appendChild(btn);
  });
  $('gameContent').appendChild(grid);
  $('gameMessage').textContent = '投票後は変更できません。';
  startTimer(data.seconds);
}

function renderRoundResult(data) {
  stopTimer();
  clearGame();
  setRound(data.round, data.total, 'REVEAL');
  $('progressText').textContent = data.caught ? '少数派を発見！' : '少数派が逃げ切った！';

  const hero = document.createElement('div');
  hero.className = `reveal-hero ${data.caught ? 'caught' : 'escaped'}`;
  const icon = document.createElement('div');
  icon.className = 'reveal-icon';
  icon.textContent = data.caught ? '🎯' : '🐺';
  const title = document.createElement('h2');
  title.textContent = data.caught ? '多数派の勝ち！' : '少数派の勝ち！';
  const who = document.createElement('p');
  who.innerHTML = `少数派は <strong>${escapeHtml(data.minorityName)}</strong>`;
  hero.append(icon, title, who);
  $('gameContent').appendChild(hero);

  const words = document.createElement('div');
  words.className = 'word-reveal-grid';
  const majority = document.createElement('div');
  majority.className = 'word-reveal majority';
  majority.innerHTML = `<small>多数派のお題</small><strong>${escapeHtml(data.majorityWord)}</strong>`;
  const minority = document.createElement('div');
  minority.className = 'word-reveal minority';
  minority.innerHTML = `<small>少数派のお題</small><strong>${escapeHtml(data.minorityWord)}</strong>`;
  words.append(majority, minority);
  $('gameContent').appendChild(words);

  const list = document.createElement('div');
  list.className = 'vote-result-list';
  data.voteResults.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = `vote-result-row ${r.isMinority ? 'minority-row' : ''}`;
    const left = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = `${r.isMinority ? '🐺 ' : ''}${r.name}`;
    const voters = document.createElement('small');
    voters.textContent = r.voters.length ? `← ${r.voters.join('・')}` : '投票なし';
    left.append(name, voters);
    const count = document.createElement('span');
    count.textContent = `${r.votes}票`;
    row.append(left, count);
    list.appendChild(row);
  });
  $('gameContent').appendChild(list);

  $('gameMessage').textContent = data.message;
  renderPlayers(data.players);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderFinal(players) {
  stopTimer();
  const sorted = [...(players || [])].sort((a, b) => b.score - a.score);
  $('podium').innerHTML = '';
  const top3 = sorted.slice(0, 3);
  const displayOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  displayOrder.forEach(p => {
    const rankNum = sorted.findIndex(x => x.id === p.id) + 1;
    const card = document.createElement('div');
    card.className = `podium-card ${rankNum === 1 ? 'first' : ''}`;
    const medal = document.createElement('div');
    medal.className = 'rank';
    medal.textContent = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : '🥉';
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

$('createBtn').onclick = () => {
  const name = getNickname();
  if (!name) return;
  $('homeError').textContent = '';
  socket.emit('create-room', { name });
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
    rounds: Number($('roundsSelect').value),
    discussionSeconds: Number($('discussionSelect').value)
  });
}

$('roundsSelect').onchange = emitSettings;
$('discussionSelect').onchange = emitSettings;
$('startBtn').onclick = () => socket.emit('start-game', { code: currentRoom });
$('restartBtn').onclick = () => socket.emit('restart-lobby', { code: currentRoom });

// Socket events
socket.on('connect', () => {
  if (hasConnectedOnce) toast('再接続しました！');
  hasConnectedOnce = true;
});
socket.on('disconnect', () => toast('通信が切れました。再接続中...'));

socket.on('room-created', ({ code, isHost: host }) => setLobby(code, host));
socket.on('room-joined', ({ code, isHost: host }) => setLobby(code, host));
socket.on('join-error', msg => $('homeError').textContent = msg);
socket.on('input-error', msg => toast(msg));

socket.on('lobby-state', data => {
  currentRoom = data.code;
  $('roomCodeText').textContent = data.code;
  $('shareLink').value = shareUrl(data.code);
  renderPlayers(data.players);
  if (isHost) {
    $('roundsSelect').value = String(data.rounds);
    $('discussionSelect').value = String(data.discussionSeconds);
  }
});

socket.on('game-started', ({ total }) => {
  showScreen('game');
  clearGame();
  setRound('—', total, 'START');
  $('progressText').textContent = 'お題を配っています...';
  $('gameMessage').textContent = '他の人の画面は見ないでね！';
  stopTimer();
});

socket.on('round-start', renderRoundStart);
socket.on('secret-word', renderSecretWord);
socket.on('voting-start', renderVoting);
socket.on('round-result', renderRoundResult);
socket.on('vote-progress', ({ voted, total }) => {
  $('progressText').textContent = `${voted}/${total}人 投票済み`;
});
socket.on('vote-locked', () => {
  $('gameMessage').textContent = '投票しました！みんなの投票を待っています...';
});
socket.on('round-cancelled', msg => {
  stopTimer();
  clearGame();
  const card = document.createElement('div');
  card.className = 'empty-card';
  card.textContent = msg;
  $('gameContent').appendChild(card);
  $('progressText').textContent = 'ラウンドを再準備中...';
});
socket.on('game-aborted', msg => {
  stopTimer();
  showScreen('lobby');
  toast(msg);
});
socket.on('game-finished', ({ players }) => renderFinal(players));
socket.on('back-to-lobby', () => showScreen('lobby'));
socket.on('room-closed', msg => {
  stopTimer();
  $('closedMessage').textContent = msg;
  showScreen('closed');
});
