const socket = io();
const $ = id => document.getElementById(id);
const screens = ['home', 'lobby', 'game', 'result', 'closed'];

let currentRoom = '';
let isHost = false;
let latestPlayers = [];
let timerInterval = null;
let hasConnectedOnce = false;

function showScreen(id) {
  screens.forEach(screen => $(screen).classList.toggle('hidden', screen !== id));
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function escRoomInput(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function getNickname() {
  const name = $('nickname').value.trim();
  if (!name) {
    $('homeError').textContent = 'ニックネームを入力してね！';
    return null;
  }
  localStorage.setItem('party-name', name);
  return name;
}

function shareUrl(code) {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`;
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  $('timerText').textContent = '—';
  $('timerBar').style.width = '0%';
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  const total = Math.max(1, Number(seconds) || 1);
  const start = performance.now();
  $('timerText').textContent = total;
  $('timerBar').style.width = '100%';

  timerInterval = setInterval(() => {
    const elapsed = (performance.now() - start) / 1000;
    const remaining = Math.max(0, total - elapsed);
    $('timerText').textContent = Math.ceil(remaining);
    $('timerBar').style.width = `${(remaining / total) * 100}%`;
    if (remaining <= 0) clearInterval(timerInterval);
  }, 100);
}

function setRound(round, total, stage) {
  $('roundNum').textContent = round;
  $('roundTotal').textContent = total;
  $('stageLabel').textContent = stage;
}

function clearGame() {
  $('gameContent').innerHTML = '';
  $('gameMessage').textContent = '';
}

function renderPlayers(players) {
  latestPlayers = players || [];
  $('playerCount').textContent = latestPlayers.length;
  const box = $('players');
  box.innerHTML = '';

  latestPlayers.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'player-row';

    const left = document.createElement('div');
    left.className = 'player-name';

    const number = document.createElement('span');
    number.className = 'player-index';
    number.textContent = index + 1;

    const name = document.createElement('strong');
    name.textContent = player.name;
    left.append(number, name);

    if (player.isHost) {
      const host = document.createElement('span');
      host.className = 'host-pill';
      host.textContent = 'HOST';
      left.appendChild(host);
    }

    const score = document.createElement('span');
    score.className = 'player-score';
    score.textContent = `${player.score} pt`;

    row.append(left, score);
    box.appendChild(row);
  });

  renderMiniScore(latestPlayers);

  if (isHost) {
    $('startBtn').disabled = latestPlayers.length < 3;
    $('startBtn').textContent = latestPlayers.length < 3
      ? `あと${3 - latestPlayers.length}人で開始`
      : 'ゲーム開始';
  }
}

function renderMiniScore(players) {
  const box = $('miniScoreboard');
  box.innerHTML = '';
  (players || []).slice(0, 8).forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    const name = document.createElement('span');
    name.textContent = `${index + 1}. ${player.name}`;
    const score = document.createElement('strong');
    score.textContent = `${player.score}`;
    row.append(name, score);
    box.appendChild(row);
  });
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

function makeSceneCard(scene, compact = false) {
  const card = document.createElement('div');
  card.className = `scene-card ${compact ? 'compact' : ''}`;

  const tape = document.createElement('div');
  tape.className = 'scene-tape';
  tape.textContent = 'お題画像';

  const art = document.createElement('div');
  art.className = 'scene-art';
  art.textContent = scene?.art || '？';

  const detail = document.createElement('div');
  detail.className = 'scene-detail';
  detail.textContent = scene?.detail || '';

  card.append(tape, art, detail);
  return card;
}

function lockCaptionForm(message = '提出済み。みんなの回答を待っています...') {
  const input = $('captionInput');
  const button = $('captionSubmit');
  if (input) input.disabled = true;
  if (button) button.disabled = true;
  $('gameMessage').textContent = message;
}

function renderRoundStart(data) {
  showScreen('game');
  clearGame();
  setRound(data.round, data.total, 'TITLE');
  $('progressText').textContent = `0/${latestPlayers.length}人 提出済み`;

  const layout = document.createElement('div');
  layout.className = 'write-layout';
  layout.appendChild(makeSceneCard(data.scene));

  const write = document.createElement('div');
  write.className = 'write-card';

  const heading = document.createElement('div');
  heading.className = 'write-heading';
  const h2 = document.createElement('h2');
  h2.textContent = 'この画像にタイトルをつけて';
  const hint = document.createElement('p');
  hint.className = 'muted';
  hint.textContent = '説明より、一瞬で意味が伝わる一言が強い。';
  heading.append(h2, hint);

  const textarea = document.createElement('textarea');
  textarea.id = 'captionInput';
  textarea.maxLength = 80;
  textarea.placeholder = '例：月曜日の僕';

  const bottom = document.createElement('div');
  bottom.className = 'write-bottom';
  const counter = document.createElement('span');
  counter.className = 'muted';
  counter.textContent = '0/80';
  const submit = document.createElement('button');
  submit.id = 'captionSubmit';
  submit.className = 'btn primary';
  submit.textContent = 'タイトルを提出';

  textarea.oninput = () => {
    counter.textContent = `${textarea.value.length}/80`;
  };

  submit.onclick = () => {
    const text = textarea.value.trim();
    if (!text) return toast('タイトルを入力してね！');
    socket.emit('submit-caption', { code: currentRoom, text });
    lockCaptionForm();
  };

  bottom.append(counter, submit);
  write.append(heading, textarea, bottom);
  layout.appendChild(write);
  $('gameContent').appendChild(layout);

  if (data.submitted) lockCaptionForm();
  startTimer(data.seconds);
  renderMiniScore(latestPlayers);
}

function renderVoting(data) {
  showScreen('game');
  clearGame();
  setRound(data.round, data.total, 'VOTE');
  $('progressText').textContent = 'いちばん好きなタイトルを1つ選んで！';

  const top = document.createElement('div');
  top.className = 'vote-scene-wrap';
  top.appendChild(makeSceneCard(data.scene, true));
  $('gameContent').appendChild(top);

  const grid = document.createElement('div');
  grid.className = 'caption-grid';

  (data.submissions || []).forEach((submission, index) => {
    const button = document.createElement('button');
    button.className = `caption-card ${submission.mine ? 'mine' : ''}`;
    button.disabled = Boolean(submission.mine || data.voted);

    const label = document.createElement('span');
    label.className = 'caption-label';
    label.textContent = submission.mine ? 'あなたの回答' : `作品 ${index + 1}`;

    const text = document.createElement('strong');
    text.textContent = submission.text;
    button.append(label, text);

    if (!submission.mine && !data.voted) {
      button.onclick = () => {
        document.querySelectorAll('.caption-card').forEach(card => card.disabled = true);
        button.classList.add('selected');
        socket.emit('submit-vote', { code: currentRoom, submissionId: submission.id });
      };
    }

    grid.appendChild(button);
  });

  $('gameContent').appendChild(grid);
  $('gameMessage').textContent = data.voted
    ? '投票済み。結果発表を待っています...'
    : '作者名は投票が終わるまで秘密。自分の回答には投票できません。';
  startTimer(data.seconds);
}

function renderRoundResult(data) {
  stopTimer();
  showScreen('game');
  clearGame();
  setRound(data.round, data.total, 'RESULT');
  $('progressText').textContent = '作者オープン！';

  const top = document.createElement('div');
  top.className = 'result-scene-wrap';
  top.appendChild(makeSceneCard(data.scene, true));
  $('gameContent').appendChild(top);

  if (!(data.entries || []).length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.textContent = data.message || '今回は回答がありませんでした。';
    $('gameContent').appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'reveal-list';

    data.entries.forEach((entry, index) => {
      const card = document.createElement('div');
      card.className = `reveal-card ${entry.winner ? 'winner' : ''}`;

      const rank = document.createElement('span');
      rank.className = 'reveal-rank';
      rank.textContent = entry.winner ? '🏆' : `${index + 1}`;

      const body = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = entry.text;
      const meta = document.createElement('small');
      meta.textContent = `${entry.authorName} · ${entry.votes}票`;
      body.append(title, meta);

      card.append(rank, body);
      list.appendChild(card);
    });

    $('gameContent').appendChild(list);
  }

  $('gameMessage').textContent = data.message || '';
  renderPlayers(data.players || latestPlayers);
}

function renderFinal(players) {
  stopTimer();
  const sorted = [...(players || [])].sort((a, b) => b.score - a.score);
  $('podium').innerHTML = '';

  const top3 = sorted.slice(0, 3);
  const displayOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  displayOrder.forEach(player => {
    const actualRank = sorted.findIndex(p => p.id === player.id) + 1;
    const card = document.createElement('div');
    card.className = `podium-card ${actualRank === 1 ? 'first' : ''}`;

    const medal = document.createElement('div');
    medal.className = 'rank';
    medal.textContent = actualRank === 1 ? '🥇' : actualRank === 2 ? '🥈' : '🥉';
    const name = document.createElement('strong');
    name.textContent = player.name;
    const score = document.createElement('span');
    score.textContent = `${player.score} pt`;
    card.append(medal, name, score);
    $('podium').appendChild(card);
  });

  $('finalScoreboard').innerHTML = '';
  sorted.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'score-row final-row';
    const name = document.createElement('span');
    name.textContent = `${index + 1}位 · ${player.name}`;
    const score = document.createElement('strong');
    score.textContent = `${player.score} pt`;
    row.append(name, score);
    $('finalScoreboard').appendChild(row);
  });

  $('restartBtn').classList.toggle('hidden', !isHost);
  showScreen('result');
}

// Home
$('nickname').value = localStorage.getItem('party-name') || localStorage.getItem('lolquiz-name') || '';
$('roomCode').addEventListener('input', event => {
  event.target.value = escRoomInput(event.target.value);
});

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
    writingSeconds: Number($('writingSelect').value)
  });
}

$('roundsSelect').onchange = emitSettings;
$('writingSelect').onchange = emitSettings;
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
socket.on('join-error', message => $('homeError').textContent = message);
socket.on('input-error', message => toast(message));

socket.on('lobby-state', data => {
  currentRoom = data.code;
  $('roomCodeText').textContent = data.code;
  $('shareLink').value = shareUrl(data.code);
  renderPlayers(data.players);

  if (isHost) {
    $('roundsSelect').value = String(data.rounds);
    $('writingSelect').value = String(data.writingSeconds);
  }
});

socket.on('game-started', ({ total }) => {
  showScreen('game');
  clearGame();
  setRound('—', total, 'START');
  $('progressText').textContent = 'お題を選んでいます...';
  $('gameMessage').textContent = 'タイトル学園、開校！';
  stopTimer();
});

socket.on('round-start', renderRoundStart);
socket.on('submission-locked', () => lockCaptionForm());
socket.on('answer-progress', ({ done, total }) => {
  $('progressText').textContent = `${done}/${total}人 提出済み`;
});

socket.on('voting-start', renderVoting);
socket.on('vote-locked', () => {
  document.querySelectorAll('.caption-card').forEach(card => card.disabled = true);
  $('gameMessage').textContent = '投票済み。結果発表を待っています...';
});
socket.on('vote-progress', ({ voted, total }) => {
  $('progressText').textContent = `${voted}/${total}人 投票済み`;
});

socket.on('round-result', renderRoundResult);
socket.on('game-finished', ({ players }) => renderFinal(players));
socket.on('back-to-lobby', () => showScreen('lobby'));
socket.on('game-aborted', message => {
  stopTimer();
  toast(message);
  showScreen('lobby');
});
socket.on('room-closed', message => {
  stopTimer();
  $('closedMessage').textContent = message;
  showScreen('closed');
});
