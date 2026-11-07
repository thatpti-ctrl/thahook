/**
 * THAHOOK - May chu tro choi on tap kieu Kahoot
 * Truong Dai hoc Gia Dinh
 *
 * Chay: node server.js   (hoac: npm start)
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Cau hinh chiu tai tot (~250 nguoi) va it bi rot mang:
// - pingTimeout 60s: mang yeu im lang toi 60 giay van KHONG bi coi la mat ket noi
// - maxHttpBufferSize nho goc: goi tin nhe
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6,
});

app.use(express.static(path.join(__dirname, 'public')));

// Cung cap bo cau hoi mac dinh cho trinh duyet (man hinh giao vien)
app.get('/questions.json', (req, res) => res.json(defaultQuestions));

// ---- Ngan hang cau hoi mac dinh ----
let defaultQuestions = [];
try {
  defaultQuestions = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8')
  );
} catch (e) {
  console.warn('Khong doc duoc questions.json, dung danh sach rong.');
  defaultQuestions = [];
}

// ---- Trang thai cac phong ----
const rooms = {}; // pin -> room object
const HOST_GRACE_MS = 2 * 60 * 1000; // giu phong 2 phut khi giao vien rot mang

function genPin() {
  let pin;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms[pin]);
  return pin;
}
function genToken() {
  return crypto.randomBytes(9).toString('hex');
}

function playerList(room) {
  return Object.values(room.players).map((p) => p.name);
}

// Bang xep hang: GOM ca nguoi dang online VA nguoi da roi mang (giu diem)
function leaderboard(room) {
  const list = [];
  const activeKeys = new Set();
  for (const p of Object.values(room.players)) {
    list.push({ name: p.name, score: p.score, correct: p.correct });
    activeKeys.add(p.nameKey);
  }
  for (const k in room.parked) {
    if (!activeKeys.has(k)) {
      const pk = room.parked[k];
      list.push({ name: pk.name, score: pk.score, correct: pk.correct });
    }
  }
  return list.sort((a, b) => b.score - a.score);
}

function localIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    }
  }
  return ips;
}

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  // ===== GIAO VIEN: tao phong =====
  socket.on('host:create', (payload, cb) => {
    const pin = genPin();
    const questions =
      payload && Array.isArray(payload.questions) && payload.questions.length
        ? payload.questions
        : defaultQuestions;
    const hostToken = genToken();

    rooms[pin] = {
      pin,
      hostId: socket.id,
      hostToken,
      players: {}, // socketId -> {name, nameKey, score, correct, answered, token}
      parked: {},  // nameKey -> {name, score, correct, token}  (nguoi da roi mang)
      questions,
      state: 'lobby', // lobby | question | reveal | ended
      current: -1,
      questionStart: 0,
      answers: {}, // socketId -> {option, correct, gained}
      participants: [],
      timer: null,
      hostGone: null,
    };
    socket.join(pin);
    socket.data.pin = pin;
    socket.data.role = 'host';
    if (cb) cb({ ok: true, pin, hostToken, count: questions.length, ips: localIPs(), port: PORT });
  });

  // ===== GIAO VIEN: vao lai sau khi rot mang (giu nguyen phong) =====
  socket.on('host:reclaim', (payload, cb) => {
    const { pin, hostToken } = payload || {};
    const room = rooms[pin];
    if (!room || room.hostToken !== hostToken) return cb && cb({ ok: false });
    if (room.hostGone) { clearTimeout(room.hostGone); room.hostGone = null; }
    room.hostId = socket.id;
    socket.join(pin);
    socket.data.pin = pin;
    socket.data.role = 'host';
    if (cb) cb({ ok: true, state: room.state });
    io.to(room.hostId).emit('host:players', {
      count: Object.keys(room.players).length,
      players: playerList(room),
    });
  });

  // ===== SINH VIEN: tham gia (hoac vao lai, giu diem) =====
  socket.on('player:join', (payload, cb) => {
    const { pin, name, token } = payload || {};
    const room = rooms[pin];
    if (!room) return cb && cb({ ok: false, error: 'Ma PIN khong ton tai.' });
    if (room.state === 'ended')
      return cb && cb({ ok: false, error: 'Tro choi da ket thuc.' });

    const cleanName = String(name || '').trim().slice(0, 20);
    if (!cleanName) return cb && cb({ ok: false, error: 'Vui long nhap ten.' });
    const nameKey = cleanName.toLowerCase();

    // Tim ban ghi cu de KHOI PHUC: uu tien theo token, roi theo ten
    let parkedKey = null;
    if (token) {
      for (const k in room.parked) {
        if (room.parked[k].token === token) { parkedKey = k; break; }
      }
    }
    if (parkedKey === null && room.parked[nameKey]) parkedKey = nameKey;

    // Co nguoi ONLINE khac dang dung ten nay -> tu choi (tranh 2 nguoi trung ten)
    const nameOnline = Object.values(room.players).some((p) => p.nameKey === nameKey);
    if (nameOnline) {
      return cb && cb({ ok: false, error: 'Ten dang duoc dung, chon ten khac.' });
    }

    let score = 0, correct = 0, pToken = genToken();
    if (parkedKey !== null) {
      const pk = room.parked[parkedKey];
      score = pk.score; correct = pk.correct; pToken = pk.token || pToken;
      delete room.parked[parkedKey];
    }

    room.players[socket.id] = {
      name: cleanName, nameKey, score, correct, answered: false, token: pToken,
    };
    socket.join(pin);
    socket.data.pin = pin;
    socket.data.role = 'player';
    if (cb) cb({
      ok: true, name: cleanName, token: pToken,
      restored: parkedKey !== null, score,
      inProgress: room.state !== 'lobby',
    });

    io.to(room.hostId).emit('host:players', {
      count: Object.keys(room.players).length,
      players: playerList(room),
    });
  });

  // ===== GIAO VIEN: bat dau =====
  socket.on('host:start', () => {
    const room = rooms[socket.data.pin];
    if (!room || room.hostId !== socket.id) return;
    if (Object.keys(room.players).length === 0) return;
    nextQuestion(room);
  });

  // ===== GIAO VIEN: cau tiep theo =====
  socket.on('host:next', () => {
    const room = rooms[socket.data.pin];
    if (!room || room.hostId !== socket.id) return;
    if (room.state === 'question') return;
    nextQuestion(room);
  });

  // ===== GIAO VIEN: hien dap an ngay =====
  socket.on('host:reveal', () => {
    const room = rooms[socket.data.pin];
    if (!room || room.hostId !== socket.id) return;
    if (room.state !== 'question') return;
    clearTimeout(room.timer);
    reveal(room);
  });

  // ===== SINH VIEN: tra loi =====
  socket.on('player:answer', (payload) => {
    const room = rooms[socket.data.pin];
    if (!room || room.state !== 'question') return;
    const player = room.players[socket.id];
    if (!player || player.answered) return;
    if (!room.participants || room.participants.indexOf(socket.id) < 0) return; // vao muon: cho cau sau

    const q = room.questions[room.current];
    const option = payload ? payload.option : -1;
    player.answered = true;

    const elapsed = Date.now() - room.questionStart;
    const timeLimit = (q.time || 20) * 1000;
    const correct = option === q.answer;
    let gained = 0;
    if (correct) {
      const totalQ = room.questions.length || 1;
      const frac = Math.max(0, 1 - elapsed / timeLimit);
      const speedBonus = Math.round((999 / totalQ) * frac);
      gained = 1000 + speedBonus;
      player.correct += 1;
    }
    player.score += gained;
    room.answers[socket.id] = { option, correct, gained };

    io.to(room.hostId).emit('host:answered', {
      answered: Object.keys(room.answers).length,
      total: room.participants.length,
    });

    if (Object.keys(room.answers).length >= room.participants.length) {
      clearTimeout(room.timer);
      reveal(room);
    }
  });

  // ===== Ngat ket noi =====
  socket.on('disconnect', () => {
    const room = rooms[socket.data.pin];
    if (!room) return;

    if (socket.data.role === 'host' && room.hostId === socket.id) {
      // KHONG xoa phong ngay -> cho giao vien vao lai trong HOST_GRACE_MS
      if (room.hostGone) clearTimeout(room.hostGone);
      room.hostGone = setTimeout(() => {
        io.to(room.pin).emit('game:aborted');
        clearTimeout(room.timer);
        delete rooms[room.pin];
      }, HOST_GRACE_MS);
    } else if (socket.data.role === 'player') {
      const p = room.players[socket.id];
      if (p) {
        // GIU DIEM vao "parked" de vao lai (dung ten/token) la khoi phuc
        room.parked[p.nameKey] = { name: p.name, score: p.score, correct: p.correct, token: p.token };
        delete room.players[socket.id];
      }
      delete room.answers[socket.id];
      const pi = room.participants.indexOf(socket.id);
      if (pi >= 0) room.participants.splice(pi, 1);

      if (rooms[room.pin]) {
        io.to(room.hostId).emit('host:players', {
          count: Object.keys(room.players).length,
          players: playerList(room),
        });
        // Neu tat ca nguoi con lai da tra loi -> hien dap an som
        if (room.state === 'question' && room.participants.length > 0 &&
            Object.keys(room.answers).length >= room.participants.length) {
          clearTimeout(room.timer);
          reveal(room);
        }
      }
    }
  });
});

function nextQuestion(room) {
  room.current += 1;
  if (room.current >= room.questions.length) {
    room.state = 'ended';
    io.to(room.pin).emit('game:end', { leaderboard: leaderboard(room) });
    return;
  }
  const q = room.questions[room.current];
  room.state = 'question';
  room.questionStart = Date.now();
  room.answers = {};
  Object.values(room.players).forEach((p) => (p.answered = false));
  room.participants = Object.keys(room.players); // ai co mat khi cau bat dau
  const time = q.time || 20;

  io.to(room.pin).emit('game:question', {
    index: room.current,
    total: room.questions.length,
    question: q.question,
    options: q.options,
    time,
  });
  io.to(room.hostId).emit('host:answered', {
    answered: 0,
    total: room.participants.length,
  });

  room.timer = setTimeout(() => reveal(room), time * 1000 + 400);
}

function reveal(room) {
  if (room.state !== 'question') return;
  room.state = 'reveal';
  const q = room.questions[room.current];

  const counts = q.options.map(
    (_, i) => Object.values(room.answers).filter((a) => a.option === i).length
  );
  const board = leaderboard(room);
  const isLast = room.current >= room.questions.length - 1;

  io.to(room.pin).emit('game:reveal', {
    answer: q.answer,
    counts,
    leaderboard: board.slice(0, 5),
    isLast,
  });

  const participants = room.participants || Object.keys(room.players);
  participants.forEach((id) => {
    const p = room.players[id];
    if (!p) return; // da roi mang
    const a = room.answers[id];
    io.to(id).emit('player:result', {
      correct: a ? a.correct : false,
      gained: a ? a.gained : 0,
      score: p.score,
      rank: board.findIndex((x) => x.name === p.name) + 1,
      total: board.length,
    });
  });
}

server.listen(PORT, () => {
  const ips = localIPs();
  console.log('\n========================================');
  console.log('   THAHOOK dang chay!');
  console.log('========================================');
  console.log(`\n[Man hinh GIAO VIEN - mo tren may chieu]:`);
  console.log(`   http://localhost:${PORT}/host.html`);
  console.log(`\n[SINH VIEN - mo tren dien thoai, cung WiFi]:`);
  if (ips.length) {
    ips.forEach((ip) => console.log(`   http://${ip}:${PORT}`));
  } else {
    console.log(`   (khong tim thay IP mang - kiem tra ket noi WiFi)`);
  }
  console.log('\nNhan Ctrl + C de dung may chu.\n');
});
