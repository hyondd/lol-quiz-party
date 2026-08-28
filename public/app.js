const socket = io();
const $ = id => document.getElementById(id);
const screens = ['home', 'lobby', 'game', 'result', 'closed'];

let currentRoom = '';
let isHost = false;
let latestPlayers = [];
let timerInterval = null;
let myRole = null;
let myRoleLabel = '';
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
  $('timerText').textContent = '—';
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

function clearGame() {
  $('gameContent').innerHTML = '';
  $('gameMessage').textContent = '';
}

function roleIcon(role) {
  if (role === 'wolf') return '🐺';
  if (role === 'seer') return '🔮';
  return '🏠';
}

function showRoleBanner() {
  const banner = $('roleBanner');
  if (!myRole) {
    banner.className = 'role-banner hidden';
    banner.textContent = '';
    return;
  }
  banner.className = `role-banner ${myRole}`;
  banner.textContent = `${roleIcon(myRole)} あなたは「${myRoleLabel}」`;
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

    const ready = document.createElement('span');
    ready.className = 'player-ready';
    ready.textContent = '参加中';
    row.append(left, ready);
    box.appendChild(row);
  });

  if (isHost) {
    $('startBtn').disabled = latestPlayers.length !== 4;
    $('startBtn').textContent = latestPlayers.length === 4
      ? 'ゲーム開始'
      : `あと${4 - latestPlayers.length}人`;
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

function renderRoleInfo(data) {
  myRole = data.role;
  myRoleLabel = data.roleLabel;
  showRoleBanner();
}

function renderSeerPhase(data) {
  showScreen('game');
  clearGame();
  $('stageLabel').textContent = 'NIGHT · ROLE';
  $('progressText').textContent = data.isSeer ? '占う相手を1人選んでください' : '占い師が行動しています...';
  showRoleBanner();

  const card = document.createElement('div');
  card.className = `phase-card role-main ${myRole || 'unknown'}`;

  const icon = document.createElement('div');
  icon.className = 'big-role-icon';
  icon.textContent = roleIcon(myRole || 'villager');
  const title = document.createElement('h2');
  title.textContent = myRoleLabel ? `あなたは「${myRoleLabel}」` : '役職を確認中...';
  const desc = document.createElement('p');
  desc.className = 'muted';
  desc.textContent = myRole === 'wolf'
    ? '人狼だとバレないように会話しよう。投票で処刑されなければ勝ち。'
    : myRole === 'seer'
      ? '今夜、1人だけ占えます。結果はあなただけが知ることができます。'
      : '村人です。会話と投票から人狼を探そう。';
  card.append(icon, title, desc);
  $('gameContent').appendChild(card);

  if (data.isSeer) {
    const section = document.createElement('div');
    section.className = 'seer-box';
    const heading = document.createElement('strong');
    heading.textContent = '🔮 誰を占う？';
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'target-grid';
    data.targets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'target-card';
      const avatar = document.createElement('span');
      avatar.className = 'target-avatar';
      avatar.textContent = p.name.slice(0, 1).toUpperCase();
      const name = document.createElement('strong');
      name.textContent = p.name;
      btn.append(avatar, name);
      btn.onclick = () => {
        document.querySelectorAll('.target-card').forEach(b => b.disabled = true);
        btn.classList.add('selected');
        socket.emit('seer-check', { code: currentRoom, targetId: p.id });
      };
      grid.appendChild(btn);
    });
    section.appendChild(grid);

    const result = document.createElement('div');
    result.id = 'seerResult';
    result.className = 'seer-result hidden';
    section.appendChild(result);
    $('gameContent').appendChild(section);
  } else {
    const wait = document.createElement('div');
    wait.className = 'waiting-inline';
    wait.textContent = '🌙 夜が明けるまで少し待ってね...';
    $('gameContent').appendChild(wait);
  }

  startTimer(data.seconds);
}

function renderSeerResult(data) {
  let result = $('seerResult');
  if (!result) {
    result = document.createElement('div');
    result.id = 'seerResult';
    result.className = 'seer-result';
    $('gameContent').appendChild(result);
  }
  result.classList.remove('hidden');
  result.classList.toggle('danger', data.isWolf);
  result.textContent = data.isWolf
    ? `🐺 ${data.targetName} は「人狼」です。`
    : `✅ ${data.targetName} は「人狼ではありません」。`;
  $('gameMessage').textContent = 'この結果をどう使うかはあなた次第。もうすぐ話し合いが始まります。';
}

function renderDiscussion(data) {
  showScreen('game');
  clearGame();
  $('stageLabel').textContent = 'DAY · DISCUSSION';
  $('progressText').textContent = '誰が人狼か、4人で話し合おう';
  showRoleBanner();

  const card = document.createElement('div');
  card.className = 'discussion-card';
  const icon = document.createElement('div');
  icon.className = 'discussion-icon';
  icon.textContent = '☀️';
  const h2 = document.createElement('h2');
  h2.textContent = '話し合いスタート';
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = '人狼は嘘をついてOK。占い師は結果を言っても、隠してもOK。村人は発言の矛盾を探そう。';
  card.append(icon, h2, p);

  const chips = document.createElement('div');
  chips.className = 'discussion-players';
  (data.players || latestPlayers).forEach(player => {
    const chip = document.createElement('span');
    chip.textContent = player.name;
    chips.appendChild(chip);
  });
  card.appendChild(chips);
  $('gameContent').appendChild(card);

  if (isHost) {
    const force = document.createElement('button');
    force.className = 'btn secondary vote-now';
    force.textContent = '話し合い終了 → 投票へ';
    force.onclick = () => {
      force.disabled = true;
      socket.emit('force-vote', { code: currentRoom });
    };
    $('gameContent').appendChild(force);
  }

  $('gameMessage').textContent = '自分の役職は上に表示されています。他の人には見えていません。';
  startTimer(data.seconds);
}

function renderVoting(data) {
  showScreen('game');
  clearGame();
  $('stageLabel').textContent = data.revote ? 'REVOTE' : 'VOTE';
  $('progressText').textContent = `0/${data.players.length}人 投票済み`;
  showRoleBanner();

  const title = document.createElement('div');
  title.className = 'vote-title';
  const icon = document.createElement('span');
  icon.textContent = data.revote ? '🔁' : '🗳️';
  const textWrap = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = data.revote ? '同票になった人だけで再投票' : '人狼だと思う人に投票';
  const small = document.createElement('small');
  small.textContent = '自分には投票できません。投票後の変更もできません。';
  textWrap.append(strong, small);
  title.append(icon, textWrap);
  $('gameContent').appendChild(title);

  const candidates = data.candidates || data.players;
  const grid = document.createElement('div');
  grid.className = 'vote-grid';
  candidates.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'vote-card';
    btn.disabled = p.id === socket.id;

    const avatar = document.createElement('span');
    avatar.className = 'vote-avatar';
    avatar.textContent = p.name.slice(0, 1).toUpperCase();
    const name = document.createElement('strong');
    name.textContent = p.name;
    const hint = document.createElement('small');
    hint.textContent = p.id === socket.id ? 'あなた自身' : 'この人に投票';
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
  startTimer(data.seconds);
}

function renderTie(data) {
  stopTimer();
  clearGame();
  $('stageLabel').textContent = 'TIE';
  $('progressText').textContent = '最多票が同数！';
  showRoleBanner();

  const box = document.createElement('div');
  box.className = 'tie-card';
  const icon = document.createElement('div');
  icon.textContent = '⚖️';
  icon.className = 'tie-icon';
  const title = document.createElement('h2');
  title.textContent = '再投票！';
  const names = document.createElement('p');
  names.textContent = `${(data.candidates || []).map(p => p.name).join('・')} が同票です。`;
  const note = document.createElement('small');
  note.textContent = 'もう一度同票になった場合は、人狼の逃げ切りになります。';
  box.append(icon, title, names, note);
  $('gameContent').appendChild(box);
  $('gameMessage').textContent = '再投票を準備中...';
}

function renderResult(data) {
  stopTimer();
  myRole = null;
  myRoleLabel = '';
  showScreen('result');

  const heroBox = $('resultHero');
  heroBox.innerHTML = '';
  const hero = document.createElement('div');
  hero.className = `final-hero ${data.villageWin ? 'village-win' : 'wolf-win'}`;
  const icon = document.createElement('div');
  icon.className = 'final-icon';
  icon.textContent = data.villageWin ? '🏘️' : '🐺';
  const title = document.createElement('h2');
  title.textContent = data.villageWin ? '村人陣営の勝利！' : '人狼の勝利！';
  const msg = document.createElement('p');
  msg.textContent = data.message;
  const wolf = document.createElement('strong');
  wolf.className = 'wolf-answer';
  wolf.textContent = `人狼は ${data.wolfName}`;
  hero.append(icon, title, msg, wolf);
  heroBox.appendChild(hero);

  const roleBox = $('roleReveal');
  roleBox.innerHTML = '';
  (data.roles || []).forEach(p => {
    const card = document.createElement('div');
    card.className = `role-reveal-card ${p.role}`;
    const icon = document.createElement('span');
    icon.textContent = roleIcon(p.role);
    const body = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = p.name;
    const role = document.createElement('small');
    role.textContent = p.roleLabel;
    body.append(name, role);
    card.append(icon, body);
    roleBox.appendChild(card);
  });

  const historyBox = $('voteHistory');
  historyBox.innerHTML = '';
  (data.voteHistory || []).forEach(round => {
    const section = document.createElement('div');
    section.className = 'vote-history-card';
    const h = document.createElement('strong');
    h.textContent = round.revote ? '再投票' : '1回目の投票';
    section.appendChild(h);

    (round.results || []).forEach(r => {
      const row = document.createElement('div');
      row.className = 'history-row';
      const left = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = r.name;
      const voters = document.createElement('small');
      voters.textContent = r.voters?.length ? `← ${r.voters.join('・')}` : '投票なし';
      left.append(name, voters);
      const votes = document.createElement('strong');
      votes.textContent = `${r.votes}票`;
      row.append(left, votes);
      section.appendChild(row);
    });
    historyBox.appendChild(section);
  });

  $('restartBtn').classList.toggle('hidden', !isHost);
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

$('discussionSelect').onchange = () => {
  if (!isHost || !currentRoom) return;
  socket.emit('update-settings', {
    code: currentRoom,
    discussionSeconds: Number($('discussionSelect').value)
  });
};

$('startBtn').onclick = () => socket.emit('start-game', { code: currentRoom });
$('restartBtn').onclick = () => socket.emit('restart-lobby', { code: currentRoom });

// Connection
socket.on('connect', () => {
  if (hasConnectedOnce) toast('再接続しました！');
  hasConnectedOnce = true;
});
socket.on('disconnect', () => toast('通信が切れました。再接続中...'));

// Room
socket.on('room-created', ({ code, isHost: host }) => setLobby(code, host));
socket.on('room-joined', ({ code, isHost: host }) => setLobby(code, host));
socket.on('join-error', msg => $('homeError').textContent = msg);
socket.on('input-error', msg => toast(msg));

socket.on('lobby-state', data => {
  currentRoom = data.code;
  $('roomCodeText').textContent = data.code;
  $('shareLink').value = shareUrl(data.code);
  renderPlayers(data.players);
  if (isHost) $('discussionSelect').value = String(data.discussionSeconds || 90);
});

// Game
socket.on('game-started', ({ players }) => {
  latestPlayers = players || latestPlayers;
  showScreen('game');
  clearGame();
  myRole = null;
  myRoleLabel = '';
  showRoleBanner();
  $('stageLabel').textContent = 'START';
  $('progressText').textContent = '役職を配っています...';
  $('gameMessage').textContent = '他の人の画面を見ないでね！';
  stopTimer();
});

socket.on('role-info', renderRoleInfo);
socket.on('seer-phase', renderSeerPhase);
socket.on('seer-result', renderSeerResult);
socket.on('discussion-start', renderDiscussion);
socket.on('voting-start', renderVoting);
socket.on('vote-tie', renderTie);
socket.on('vote-progress', ({ voted, total }) => {
  $('progressText').textContent = `${voted}/${total}人 投票済み`;
});
socket.on('vote-locked', () => {
  $('gameMessage').textContent = '投票しました。全員の投票を待っています...';
});
socket.on('game-result', renderResult);

socket.on('game-aborted', msg => {
  stopTimer();
  myRole = null;
  myRoleLabel = '';
  showRoleBanner();
  showScreen('lobby');
  toast(msg);
});

socket.on('back-to-lobby', () => {
  stopTimer();
  myRole = null;
  myRoleLabel = '';
  showRoleBanner();
  showScreen('lobby');
});

socket.on('room-closed', msg => {
  stopTimer();
  $('closedMessage').textContent = msg;
  showScreen('closed');
});
