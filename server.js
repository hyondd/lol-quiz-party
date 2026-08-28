const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: false },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();
const pendingDisconnects = new Map();
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 4;
const DISCONNECT_GRACE_MS = 30000;

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

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function publicPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    isHost: p.id === room.hostId
  }));
}

function emitLobby(room) {
  io.to(room.code).emit('lobby-state', {
    code: room.code,
    status: room.status,
    phase: room.phase,
    discussionSeconds: room.discussionSeconds,
    players: publicPlayers(room)
  });
}

function clearTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.phaseEndsAt = 0;
}

function secondsLeft(room, fallback = 1) {
  if (!room.phaseEndsAt) return fallback;
  return Math.max(1, Math.ceil((room.phaseEndsAt - Date.now()) / 1000));
}

function setPhaseTimer(room, seconds, fn) {
  clearTimer(room);
  room.phaseEndsAt = Date.now() + seconds * 1000;
  room.timer = setTimeout(fn, seconds * 1000);
}

function playerRoleLabel(role) {
  if (role === 'wolf') return '人狼';
  if (role === 'seer') return '占い師';
  return '村人';
}

function sendRole(room, player) {
  io.to(player.id).emit('role-info', {
    role: player.role,
    roleLabel: playerRoleLabel(player.role),
    description: player.role === 'wolf'
      ? '正体を隠して、最後の投票で処刑されなければ勝ち。'
      : player.role === 'seer'
        ? 'ゲーム開始時に1人を占い、その人が人狼かどうかを知ることができます。'
        : '会話と投票から人狼を見つけよう。'
  });
}

function seerTargets(room, seerId) {
  return publicPlayers(room)
    .filter(p => p.id !== seerId)
    .map(p => ({ id: p.id, name: p.name }));
}

function emitPrivateSync(room, socket) {
  const player = room.players.get(socket.id);
  if (!player) return;
  sendRole(room, player);

  if (room.phase === 'seer') {
    socket.emit('seer-phase', {
      isSeer: player.role === 'seer',
      targets: player.role === 'seer' ? seerTargets(room, player.id) : [],
      seconds: secondsLeft(room, 20)
    });
    if (player.role === 'seer' && room.seerResult) {
      socket.emit('seer-result', room.seerResult);
    }
  } else if (room.phase === 'discussion') {
    socket.emit('discussion-start', {
      seconds: secondsLeft(room, room.discussionSeconds),
      players: publicPlayers(room)
    });
  } else if (room.phase === 'voting' || room.phase === 'revoting') {
    const candidates = publicPlayers(room).filter(p => room.voteCandidates.includes(p.id));
    socket.emit('voting-start', {
      seconds: secondsLeft(room, 25),
      players: publicPlayers(room),
      candidates,
      revote: room.phase === 'revoting'
    });
    socket.emit('vote-progress', { voted: room.votes.size, total: room.players.size });
  }
}

function resetGameState(room) {
  clearTimer(room);
  room.phase = 'lobby';
  room.wolfId = null;
  room.seerId = null;
  room.seerResult = null;
  room.votes = new Map();
  room.voteCandidates = [];
  room.voteHistory = [];
  for (const p of room.players.values()) p.role = null;
}

function abortToLobby(room, message) {
  resetGameState(room);
  room.status = 'lobby';
  io.to(room.code).emit('game-aborted', message);
  emitLobby(room);
}

function startGame(room) {
  const roles = shuffle(['wolf', 'seer', 'villager', 'villager']);
  const players = [...room.players.values()];

  players.forEach((p, i) => {
    p.role = roles[i];
    if (p.role === 'wolf') room.wolfId = p.id;
    if (p.role === 'seer') room.seerId = p.id;
  });

  room.status = 'playing';
  room.phase = 'seer';
  room.seerResult = null;
  room.votes = new Map();
  room.voteCandidates = [];
  room.voteHistory = [];

  io.to(room.code).emit('game-started', { players: publicPlayers(room) });
  players.forEach(p => sendRole(room, p));

  for (const p of players) {
    io.to(p.id).emit('seer-phase', {
      isSeer: p.role === 'seer',
      targets: p.role === 'seer' ? seerTargets(room, p.id) : [],
      seconds: 20
    });
  }

  setPhaseTimer(room, 20, () => beginDiscussion(room));
}

function beginDiscussion(room) {
  if (!rooms.has(room.code) || room.status !== 'playing') return;
  if (!['seer', 'starting'].includes(room.phase)) return;

  room.phase = 'discussion';
  io.to(room.code).emit('discussion-start', {
    seconds: room.discussionSeconds,
    players: publicPlayers(room)
  });
  setPhaseTimer(room, room.discussionSeconds, () => beginVoting(room, false));
}

function beginVoting(room, revote = false, candidates = null) {
  if (!rooms.has(room.code) || room.status !== 'playing') return;
  clearTimer(room);
  room.phase = revote ? 'revoting' : 'voting';
  room.votes = new Map();
  room.voteCandidates = candidates && candidates.length
    ? [...candidates]
    : [...room.players.keys()];

  const candidatePlayers = publicPlayers(room).filter(p => room.voteCandidates.includes(p.id));
  io.to(room.code).emit('voting-start', {
    seconds: 25,
    players: publicPlayers(room),
    candidates: candidatePlayers,
    revote
  });
  io.to(room.code).emit('vote-progress', { voted: 0, total: room.players.size });
  setPhaseTimer(room, 25, () => resolveVote(room));
}

function resolveVote(room) {
  if (!rooms.has(room.code) || room.status !== 'playing' || !['voting', 'revoting'].includes(room.phase)) return;
  const wasRevote = room.phase === 'revoting';
  clearTimer(room);

  const counts = new Map(room.voteCandidates.map(id => [id, 0]));
  const votersByTarget = new Map(room.voteCandidates.map(id => [id, []]));

  for (const [voterId, targetId] of room.votes.entries()) {
    if (!room.players.has(voterId) || !counts.has(targetId)) continue;
    counts.set(targetId, counts.get(targetId) + 1);
    votersByTarget.get(targetId).push(room.players.get(voterId).name);
  }

  const maxVotes = Math.max(0, ...counts.values());
  const topIds = maxVotes > 0
    ? [...counts.entries()].filter(([, count]) => count === maxVotes).map(([id]) => id)
    : [];

  room.voteHistory.push({
    revote: wasRevote,
    results: room.voteCandidates.map(id => ({
      id,
      name: room.players.get(id)?.name || '退出した人',
      votes: counts.get(id) || 0,
      voters: votersByTarget.get(id) || []
    }))
  });

  if (!wasRevote && topIds.length > 1) {
    room.phase = 'tie';
    io.to(room.code).emit('vote-tie', {
      candidates: publicPlayers(room).filter(p => topIds.includes(p.id))
    });
    room.timer = setTimeout(() => {
      if (rooms.has(room.code) && room.status === 'playing' && room.phase === 'tie') {
        beginVoting(room, true, topIds);
      }
    }, 2200);
    return;
  }

  const executedId = topIds.length === 1 ? topIds[0] : null;
  const villageWin = executedId === room.wolfId;
  finishGame(room, {
    villageWin,
    executedId,
    finalTie: wasRevote && topIds.length !== 1,
    noVotes: topIds.length === 0
  });
}

function finishGame(room, outcome) {
  clearTimer(room);
  room.status = 'finished';
  room.phase = 'finished';

  const roles = [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    roleLabel: playerRoleLabel(p.role)
  }));

  io.to(room.code).emit('game-result', {
    ...outcome,
    wolfId: room.wolfId,
    wolfName: room.players.get(room.wolfId)?.name || '不明',
    roles,
    voteHistory: room.voteHistory,
    message: outcome.villageWin
      ? '村人陣営の勝利！人狼を見破った！'
      : outcome.finalTie
        ? '再投票も同票！人狼が逃げ切った！'
        : outcome.noVotes
          ? '投票が成立せず、人狼が逃げ切った！'
          : '人狼の勝利！最後まで正体を隠し切った！'
  });
  emitLobby(room);
}

function checkVoteComplete(room) {
  if (room.status === 'playing' && ['voting', 'revoting'].includes(room.phase) && room.votes.size >= room.players.size) {
    setTimeout(() => resolveVote(room), 350);
  }
}

function cleanupDisconnectedPlayer(code, playerId) {
  const room = rooms.get(code);
  if (!room || !room.players.has(playerId)) return;

  if (room.hostId === playerId) {
    clearTimer(room);
    io.to(code).emit('room-closed', 'ホストが退出したため、ルームが終了しました。');
    rooms.delete(code);
    return;
  }

  room.players.delete(playerId);
  room.votes.delete(playerId);
  for (const [voterId, targetId] of [...room.votes.entries()]) {
    if (targetId === playerId) room.votes.delete(voterId);
  }

  if (room.status === 'playing') {
    abortToLobby(room, 'プレイヤーが退出したためゲームを中断しました。4人そろったらもう一度スタートしてね。');
  } else {
    emitLobby(room);
  }
}

io.on('connection', socket => {
  if (socket.recovered) {
    const pending = pendingDisconnects.get(socket.id);
    if (pending) {
      clearTimeout(pending);
      pendingDisconnects.delete(socket.id);
    }
    const recoveredRoom = rooms.get(socket.data.roomCode);
    if (recoveredRoom) {
      emitLobby(recoveredRoom);
      if (recoveredRoom.status === 'playing') emitPrivateSync(recoveredRoom, socket);
    }
  }

  socket.on('create-room', ({ name }) => {
    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      status: 'lobby',
      phase: 'lobby',
      discussionSeconds: 90,
      players: new Map(),
      wolfId: null,
      seerId: null,
      seerResult: null,
      votes: new Map(),
      voteCandidates: [],
      voteHistory: [],
      timer: null,
      phaseEndsAt: 0
    };

    room.players.set(socket.id, { id: socket.id, name: safeName(name), role: null });
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
    if (room.players.size >= MAX_PLAYERS) return socket.emit('join-error', 'このルームは4人そろっています。');

    room.players.set(socket.id, { id: socket.id, name: safeName(name), role: null });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-joined', { code, isHost: false });
    emitLobby(room);
  });

  socket.on('update-settings', ({ code, discussionSeconds }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    const s = Number(discussionSeconds);
    room.discussionSeconds = [60, 90, 120, 180].includes(s) ? s : 90;
    emitLobby(room);
  });

  socket.on('start-game', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    if (room.players.size !== 4) return socket.emit('input-error', '4人ちょうどそろったら開始できます！');
    startGame(room);
  });

  socket.on('seer-check', ({ code, targetId }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.phase !== 'seer') return;
    const seer = room.players.get(socket.id);
    if (!seer || seer.role !== 'seer' || room.seerResult) return;
    targetId = String(targetId || '');
    if (!room.players.has(targetId) || targetId === socket.id) return;

    const target = room.players.get(targetId);
    room.seerResult = {
      targetId,
      targetName: target.name,
      isWolf: target.role === 'wolf'
    };
    socket.emit('seer-result', room.seerResult);
    setTimeout(() => beginDiscussion(room), 1500);
  });

  socket.on('force-vote', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'playing' || room.phase !== 'discussion') return;
    beginVoting(room, false);
  });

  socket.on('submit-vote', ({ code, targetId }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || !['voting', 'revoting'].includes(room.phase) || room.votes.has(socket.id)) return;
    if (!room.players.has(socket.id)) return;

    targetId = String(targetId || '');
    if (!room.voteCandidates.includes(targetId) || !room.players.has(targetId)) return;
    if (targetId === socket.id) return socket.emit('input-error', '自分には投票できません。');

    room.votes.set(socket.id, targetId);
    socket.emit('vote-locked');
    io.to(room.code).emit('vote-progress', { voted: room.votes.size, total: room.players.size });
    checkVoteComplete(room);
  });

  socket.on('restart-lobby', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'finished') return;
    room.status = 'lobby';
    resetGameState(room);
    io.to(room.code).emit('back-to-lobby');
    emitLobby(room);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) return;

    const old = pendingDisconnects.get(socket.id);
    if (old) clearTimeout(old);
    const timeout = setTimeout(() => {
      pendingDisconnects.delete(socket.id);
      cleanupDisconnectedPlayer(code, socket.id);
    }, DISCONNECT_GRACE_MS);
    pendingDisconnects.set(socket.id, timeout);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Four Player Werewolf running on port ${PORT}`));
