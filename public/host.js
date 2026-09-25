const socket = io();

const SYMBOLS = ['▲', '◆', '●', '■'];
const LETTERS = ['A', 'B', 'C', 'D'];

let questions = []; // ngan hang cau hoi (do giao vien soan)
let serverInfo = null; // {pin, ips, port}
let currentTime = 20;
let timerId = null;

// ---------- Views ----------
const V = {
  setup: document.getElementById('setupView'),
  lobby: document.getElementById('lobbyView'),
  question: document.getElementById('questionView'),
  reveal: document.getElementById('revealView'),
  end: document.getElementById('endView'),
  history: document.getElementById('historyView'),
};
function show(name) {
  Object.values(V).forEach((v) => v.classList.add('hidden'));
  V[name].classList.remove('hidden');
}

// ---------- Am thanh ----------
let musicTrack = null;
function setMusic(name, vol) {
  if (musicTrack === name) { Music.resume(); return; }
  Music.play(name, { volume: vol });
  musicTrack = name;
}
const tMusic = document.getElementById('toggleMusic');
const tSfx = document.getElementById('toggleSfx');
tMusic.addEventListener('click', () => {
  const on = !Music.isEnabled();
  Music.setEnabled(on);
  tMusic.textContent = '🎵 Nhạc nền: ' + (on ? 'Bật' : 'Tắt');
});
tSfx.addEventListener('click', () => {
  const on = !SFX.isEnabled();
  SFX.setEnabled(on);
  tSfx.textContent = '🔊 Hiệu ứng: ' + (on ? 'Bật' : 'Tắt');
  if (on) { SFX.init(); SFX.correct(); } // phat tieng "ding" thu de kiem tra loa
});

// Mo khoa am thanh ngay lan bam/cham dau tien tren trang (chinh sach Chrome)
document.addEventListener('pointerdown', () => SFX.init(), { once: true });

// ================= EDITOR =================
let editingIndex = null;

function renderList() {
  document.getElementById('qCount').textContent = questions.length;
  const list = document.getElementById('qList');
  list.innerHTML = '';
  questions.forEach((q, idx) => {
    const div = document.createElement('div');
    div.className = 'qitem';
    const opts = q.options
      .map((o, i) => `<div class="opt ${i === q.answer ? 'ok' : ''}">${LETTERS[i]}. ${escapeHtml(o)}${i === q.answer ? ' ✓' : ''}</div>`)
      .join('');
    div.innerHTML = `
      <div style="float:right;display:flex;gap:6px;align-items:center">
        <label style="font-size:12px;color:#666">Giây</label>
        <input type="number" class="itime" data-i="${idx}" value="${q.time || 20}" min="5" max="300"
          style="width:62px;margin:0;padding:6px;font-size:14px;text-align:center">
        <button class="q-edit" data-i="${idx}" style="background:#1368ce;color:#fff;padding:5px 12px;font-size:12px;border-radius:6px;border:none;cursor:pointer">Sửa</button>
        <button class="q-del" data-i="${idx}" style="background:#e21b3c;color:#fff;padding:5px 12px;font-size:12px;border-radius:6px;border:none;cursor:pointer">Xóa</button>
      </div>
      <h4>${idx + 1}. ${escapeHtml(q.question)}</h4>${opts}`;
    list.appendChild(div);
  });

  list.querySelectorAll('.itime').forEach((inp) =>
    inp.addEventListener('change', () => {
      const v = Math.max(5, Math.min(300, Number(inp.value) || 20));
      questions[Number(inp.dataset.i)].time = v;
      inp.value = v;
    })
  );
  list.querySelectorAll('.q-del').forEach((b) =>
    b.addEventListener('click', () => {
      questions.splice(Number(b.dataset.i), 1);
      cancelEdit();
      renderList();
    })
  );
  list.querySelectorAll('.q-edit').forEach((b) =>
    b.addEventListener('click', () => startEdit(Number(b.dataset.i)))
  );
  document.getElementById('createBtn').disabled = questions.length === 0;
}

function fillForm(q) {
  document.getElementById('qText').value = q.question;
  [0, 1, 2, 3].forEach((k) => {
    document.getElementById('opt' + k).value = q.options[k] || '';
  });
  document.querySelectorAll('input[name=correct]').forEach((r) => {
    r.checked = Number(r.value) === q.answer;
  });
  document.getElementById('qTime').value = q.time || 20;
}
function startEdit(i) {
  editingIndex = i;
  fillForm(questions[i]);
  document.getElementById('addBtn').textContent = '💾 Lưu thay đổi (câu ' + (i + 1) + ')';
  document.getElementById('qText').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('qText').focus();
}
function cancelEdit() {
  editingIndex = null;
  document.getElementById('addBtn').textContent = '+ Thêm vào ngân hàng';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

document.getElementById('addBtn').addEventListener('click', () => {
  const text = document.getElementById('qText').value.trim();
  const opts = [0, 1, 2, 3]
    .map((i) => document.getElementById('opt' + i).value.trim());
  const filled = opts.filter((o) => o !== '');
  const answer = Number(document.querySelector('input[name=correct]:checked').value);
  const time = Math.max(5, Math.min(120, Number(document.getElementById('qTime').value) || 20));

  if (!text) return alert('Vui lòng nhập nội dung câu hỏi.');
  if (filled.length < 2) return alert('Cần ít nhất 2 đáp án.');
  if (opts[answer] === '') return alert('Đáp án đúng đang để trống. Chọn lại nút tròn ở đáp án có nội dung.');

  if (editingIndex !== null) {
    questions[editingIndex] = { question: text, options: filled, answer, time };
    cancelEdit();
  } else {
    questions.push({ question: text, options: filled, answer, time });
  }
  document.getElementById('qText').value = '';
  [0, 1, 2, 3].forEach((i) => (document.getElementById('opt' + i).value = ''));
  document.querySelector('input[name=correct][value="0"]').checked = true;
  document.getElementById('qTime').value = 20;
  renderList();
});

document.getElementById('bulkApply').addEventListener('click', () => {
  const v = Math.max(5, Math.min(300, Number(document.getElementById('bulkTime').value) || 20));
  if (!questions.length) return alert('Ngân hàng câu hỏi đang trống.');
  questions.forEach((q) => (q.time = v));
  renderList();
});

document.getElementById('loadDefault').addEventListener('click', async () => {  try {
    const r = await fetch('/questions.json');
    const data = await r.json();
    if (Array.isArray(data)) { questions = data; renderList(); }
  } catch (e) { alert('Không tải được bộ câu hỏi mẫu.'); }
});

// ----- Import / Export -----
const fileInput = document.getElementById('fileInput');
document.getElementById('importBtn').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let imported = [];
      if (name.endsWith('.json')) {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('File JSON phải là một danh sách câu hỏi.');
        imported = data.map(normalizeQ).filter((q) => q.options.length >= 2);
      } else if (isExcel) {
        if (typeof XLSX === 'undefined') throw new Error('Không tải được thư viện Excel.');
        const wb = XLSX.read(reader.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        imported = rowsToQuestions(rows);
      } else {
        imported = parseCSV(reader.result);
      }
      if (!imported.length) throw new Error('Không tìm thấy câu hỏi hợp lệ trong file.');
      questions = imported;
      cancelEdit();
      renderList();
      alert('Đã nạp ' + imported.length + ' câu từ file (đã thay thế bộ câu trước đó).');
    } catch (err) {
      alert('Lỗi khi đọc file: ' + err.message);
    }
    fileInput.value = '';
  };
  if (isExcel) reader.readAsArrayBuffer(file);
  else reader.readAsText(file, 'utf-8');
});

function normalizeQ(q) {
  return {
    question: String(q.question || ''),
    options: (q.options || []).map(String).filter((o) => o !== ''),
    answer: Number(q.answer) || 0,
    time: Number(q.time) || 20,
  };
}

// Chuyen mot bang (mang cac dong) thanh danh sach cau hoi.
// Cot: Cau hoi | A | B | C | D | Dap an dung (A-D hoac 0-3) | Thoi gian(giay)
function rowsToQuestions(rows) {
  rows = (rows || []).filter((r) => r.some((c) => String(c == null ? '' : c).trim() !== ''));
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map((c) => (c == null ? '' : String(c)));
    if (i === 0 && /c\u00e2u h\u1ecfi|question/i.test(r[0])) continue; // bo dong tieu de
    const question = (r[0] || '').trim();
    if (!question) continue;
    const options = [r[1], r[2], r[3], r[4]].map((x) => (x || '').trim()).filter((x) => x !== '');
    let ans = (r[5] || '0').trim().toUpperCase();
    let answer = LETTERS.indexOf(ans);
    if (answer < 0) answer = Number(ans) || 0;
    const time = Math.max(5, Math.min(300, Number((r[6] || '20').toString().trim()) || 20));
    if (options.length >= 2) out.push({ question, options, answer, time });
  }
  if (!out.length) throw new Error('Không tìm thấy câu hỏi hợp lệ (kiểm tra lại các cột).');
  return out;
}

function parseCSV(text) {
  if (text && text.charCodeAt(0) === 0xfeff) text = text.slice(1); // bo BOM neu co
  return rowsToQuestions(csvToRows(text));
}

// Tach CSV co ho tro dau ngoac kep
function csvToRows(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Mau bang cau hoi (dung cho tao mau va xuat file)
const TEMPLATE_HEADER = ['Câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 'Đáp án đúng (A-D)', 'Thời gian(giây)'];
const XLSX_COLS = [{ wch: 44 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];

function saveXlsx(rows, filename, sheetName) {
  if (typeof XLSX === 'undefined') return alert('Không tải được thư viện Excel.');
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = XLSX_COLS;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Câu hỏi');
  XLSX.writeFile(wb, filename);
}

// Tai mau Excel de thay dien cau hoi
document.getElementById('xlsxTemplateBtn').addEventListener('click', () => {
  const rows = [
    TEMPLATE_HEADER,
    ['Thủ đô của Việt Nam là?', 'Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Huế', 'A', 15],
    ['2 + 2 = ?', '3', '4', '5', '6', 'B', 10],
  ];
  saveXlsx(rows, 'mau-cau-hoi.xlsx');
});

// Xuat ngan hang cau hoi hien tai ra Excel (de sua/luu lai)
document.getElementById('exportXlsxBankBtn').addEventListener('click', () => {
  if (!questions.length) return alert('Ngân hàng câu hỏi đang trống.');
  const rows = [TEMPLATE_HEADER.slice()];
  questions.forEach((q) => {
    const o = q.options;
    rows.push([q.question, o[0] || '', o[1] || '', o[2] || '', o[3] || '', LETTERS[q.answer] || 'A', q.time || 20]);
  });
  saveXlsx(rows, 'ngan-hang-cau-hoi.xlsx');
});

document.getElementById('exportJsonBtn').addEventListener('click', () => {
  if (!questions.length) return alert('Ngân hàng câu hỏi đang trống.');
  download('ngan-hang-cau-hoi.json', JSON.stringify(questions, null, 2));
});
function download(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ================= TAO PHONG =================
document.getElementById('createBtn').addEventListener('click', () => {
  if (!questions.length) return alert('Ngân hàng câu hỏi đang trống.');
  SFX.init(); // kich hoat am thanh (phai goi trong thao tac cua nguoi dung)
  setMusic('lobby', 0.35); // bat nhac ngay trong cu click de trinh duyet cho phep phat
  socket.emit('host:create', { questions }, (res) => {
    if (!res || !res.ok) return alert('Không tạo được phòng.');
    serverInfo = res;
    setupLobby(res);
    show('lobby');
  });
});

function setupLobby(res) {
  document.getElementById('pinShow').textContent = res.pin;
  // Xac dinh dia chi sinh vien truy cap
  let base;
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    const ip = (res.ips && res.ips[0]) ? res.ips[0] : host;
    base = `http://${ip}:${res.port}`;
  } else {
    base = location.origin;
  }
  const joinUrl = `${base}/?pin=${res.pin}`;
  document.getElementById('joinUrl').textContent = base.replace(/^https?:\/\//, '');
  // QR (hien khi may co Internet; neu khong van dung URL + PIN)
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;
  document.getElementById('qrBox').innerHTML = `<img src="${qr}" alt="QR" width="200" height="200" onerror="this.parentNode.style.display='none'">`;
  // Dong nho hien PIN + dia chi trong suot luc choi
  document.getElementById('pinBadge').textContent = 'PIN ' + res.pin + ' · ' + base.replace(/^https?:\/\//, '');
}

socket.on('host:players', (d) => {
  document.getElementById('playerCount').textContent = d.count;
  const chips = document.getElementById('playerChips');
  chips.innerHTML = d.players.map((n) => `<span class="chip">${escapeHtml(n)}</span>`).join('');
  document.getElementById('startBtn').disabled = d.count === 0;
});

document.getElementById('startBtn').addEventListener('click', () => socket.emit('host:start'));

// ================= CAU HOI =================
socket.on('game:question', (q) => {
  document.getElementById('pinBadge').style.display = 'block';
  document.getElementById('qNum').textContent = `${q.index + 1}/${q.total}`;
  document.getElementById('qDisplay').textContent = q.question;
  document.getElementById('answeredCount').textContent = '0';
  document.getElementById('answeredTotal').textContent = '0';

  const grid = document.getElementById('ansGrid');
  grid.innerHTML = q.options
    .map((o, i) => `<div class="ans ${['a','b','c','d'][i]}"><span class="sym">${SYMBOLS[i]}</span> ${escapeHtml(o)}</div>`)
    .join('');

  currentTime = q.time;
  startTimer(q.time);
  setMusic('question', 0.22);
  setAdvance('question', 'Hiện đáp án');
  show('question');
});

function startTimer(sec) {
  clearInterval(timerId);
  let t = sec;
  const el = document.getElementById('timer');
  el.textContent = t;
  timerId = setInterval(() => {
    t--;
    el.textContent = t >= 0 ? t : 0;
    if (t > 0 && t <= 5) SFX.tick();
    if (t <= 0) clearInterval(timerId);
  }, 1000);
}

socket.on('host:answered', (d) => {
  document.getElementById('answeredCount').textContent = d.answered;
  document.getElementById('answeredTotal').textContent = d.total;
});

// ---- Dieu khien tien do: nut goc phai tren + phim tat (dung duoc but chieu) ----
let gamePhase = null; // 'question' | 'reveal' | null
const advanceBtn = document.getElementById('advanceBtn');
function setAdvance(phase, label) {
  gamePhase = phase;
  if (phase) { advanceBtn.textContent = label; advanceBtn.classList.remove('hidden'); }
  else { advanceBtn.classList.add('hidden'); }
}
function doAdvance() {
  if (gamePhase === 'question') socket.emit('host:reveal');
  else if (gamePhase === 'reveal') socket.emit('host:next');
}
advanceBtn.addEventListener('click', doAdvance);
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return; // dang go -> bo qua
  if (!gamePhase) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    doAdvance();
  }
});

// ================= REVEAL =================
socket.on('game:reveal', (d) => {
  clearInterval(timerId);
  SFX.timeup();
  // Khong tam dung nhac o man ket qua -> nhac chay lien tuc
  document.getElementById('rNum').textContent = document.getElementById('qNum').textContent;

  // Lay lai noi dung dap an tu grid cau hoi
  const ansEls = document.querySelectorAll('#ansGrid .ans');
  const grid = document.getElementById('revealGrid');
  grid.innerHTML = '';
  ansEls.forEach((el, i) => {
    const clone = el.cloneNode(true);
    clone.classList.remove('dim', 'win');
    if (i === d.answer) clone.classList.add('win');
    else clone.classList.add('dim');
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.textContent = (d.counts[i] || 0);
    clone.appendChild(cnt);
    grid.appendChild(clone);
  });

  renderBoard('miniBoard', d.leaderboard);
  setAdvance('reveal', d.isLast ? 'Xem kết quả cuối →' : 'Câu tiếp theo →');
  show('reveal');
});



function renderBoard(id, board, showCorrect) {
  const el = document.getElementById(id);
  el.innerHTML = board
    .map((p, i) => `<div class="row"><span class="rk">${i + 1}</span>
      <span class="nm">${escapeHtml(p.name)}</span>
      ${showCorrect && p.correct != null ? `<span style="color:#666;font-size:14px;margin-right:12px">✔ ${p.correct}</span>` : ''}
      <span class="sc">${p.score}</span></div>`)
    .join('') || '<div class="row"><span class="nm">Chưa có dữ liệu</span></div>';
}

// ================= KET THUC — VINH DANH =================
let lastResults = [];

// Phao giay (confetti) bang canvas, tu xoa sau khi xong
function confettiBurst(durationMs) {
  durationMs = durationMs || 2800;
  const cvs = document.createElement('canvas');
  cvs.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  cvs.width = window.innerWidth; cvs.height = window.innerHeight;
  document.body.appendChild(cvs);
  const ctx = cvs.getContext('2d');
  const colors = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#FFD447', '#ffffff'];
  const parts = [];
  for (let i = 0; i < 160; i++) {
    parts.push({
      x: Math.random() * cvs.width,
      y: -20 - Math.random() * cvs.height * 0.4,
      r: 6 + Math.random() * 7,
      c: colors[(Math.random() * colors.length) | 0],
      vx: -2.5 + Math.random() * 5,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 6.28,
      vr: -0.25 + Math.random() * 0.5,
    });
  }
  const start = performance.now();
  (function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    parts.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    });
    if (t < durationMs) requestAnimationFrame(frame);
    else cvs.remove();
  })(start);
}

function revealPodium(slot, data, barHeight, isFirst) {
  const col = document.querySelector('.pcol[data-slot="' + slot + '"]');
  if (!col) return;
  if (!data) { col.style.visibility = 'hidden'; return; } // khong du nguoi cho hang nay
  col.style.visibility = '';
  col.querySelector('.pname').textContent = data.name;
  col.querySelector('.pscore').textContent = data.score + ' đ';
  col.classList.add('show');
  col.querySelector('.pbar').style.height = barHeight + 'px';
  if (isFirst) { SFX.win(); confettiBurst(); setTimeout(confettiBurst, 700); }
  else { SFX.reveal(); }
}

socket.on('game:end', (d) => {
  lastResults = d.leaderboard || [];
  const board = lastResults;
  document.getElementById('pinBadge').style.display = 'none';
  setAdvance(null);

  // Tu dong luu ket qua tran nay vao lich su (de hom sau van con)
  addToHistory({
    ts: Date.now(),
    pin: (serverInfo && serverInfo.pin) || '',
    totalQ: (serverInfo && serverInfo.count) || questions.length || '',
    count: board.length,
    results: board.map((p) => ({ name: p.name, score: p.score, correct: p.correct })),
  });

  // Reset buc ve trang thai ban dau (de chay lai co the hien lai hieu ung)
  document.querySelectorAll('.pcol').forEach((c) => {
    c.classList.remove('show');
    c.style.visibility = '';
    c.querySelector('.pbar').style.height = '0';
  });
  document.getElementById('endExtra').style.opacity = '0';
  document.getElementById('finalCount').textContent = board.length;
  renderBoard('finalBoard', board, true);
  show('end');

  // Nhac vinh danh soi dong (file win.mp3 neu co) + hieu ung phao giay
  Music.stop();
  musicTrack = 'win';
  Music.play('win', { loop: true, volume: 0.5 });

  // Hien lan luot, moi giai cach nhau 5 giay
  setTimeout(() => revealPodium(3, board[2], 110, false), 2000);   // Giai Ba: ~2s sau khi ket thuc
  setTimeout(() => revealPodium(2, board[1], 160, false), 4000);   // Giai Nhi: 2s sau giai Ba
  setTimeout(() => revealPodium(1, board[0], 215, true), 6000);    // Giai Nhat: 2s sau giai Nhi
  setTimeout(() => { document.getElementById('endExtra').style.opacity = '1'; }, 9500);
});

// ---- Xuat ket qua ra Excel ----
// ---- Xuat ket qua ra Excel (dung chung cho man cuoi va lich su) ----
function exportResultsXlsx(results, totalQ, whenTs) {
  if (!results || !results.length) return alert('Chưa có kết quả để tải.');
  if (typeof XLSX === 'undefined') return alert('Không tải được thư viện Excel.');
  const now = whenTs ? new Date(whenTs) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const rows = [
    ['KẾT QUẢ ÔN TẬP - THAHOOK'],
    ['Thời gian:', stamp, '', 'Tổng số câu:', totalQ],
    [],
    ['Hạng', 'Tên sinh viên', 'Số câu đúng', 'Tổng số câu', 'Điểm'],
  ];
  results.forEach((p, i) =>
    rows.push([i + 1, p.name, p.correct != null ? p.correct : '', totalQ, p.score])
  );
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ket qua');
  const fname = `KetQua_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
  XLSX.writeFile(wb, fname);
}

document.getElementById('exportXlsxBtn').addEventListener('click', () => {
  exportResultsXlsx(lastResults, (serverInfo && serverInfo.count) || questions.length || '', Date.now());
});

// ---- Lich su ket qua: tu dong luu vao trinh duyet may giao vien ----
const HIST_KEY = 'thahook_history';
const HIST_MAX = 60;
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (e) { return []; }
}
function addToHistory(record) {
  try {
    const h = getHistory();
    h.unshift(record);
    if (h.length > HIST_MAX) h.length = HIST_MAX;
    localStorage.setItem(HIST_KEY, JSON.stringify(h));
  } catch (e) { /* localStorage khong dung duoc -> bo qua, van con nut tai Excel */ }
}

document.getElementById('historyBtn').addEventListener('click', () => { renderHistory(); show('history'); });
document.getElementById('histBack').addEventListener('click', () => show('setup'));
document.getElementById('histClear').addEventListener('click', () => {
  if (!confirm('Xóa toàn bộ lịch sử kết quả đã lưu trên máy này?')) return;
  try { localStorage.removeItem(HIST_KEY); } catch (e) {}
  renderHistory();
});
function renderHistory() {
  const h = getHistory();
  const el = document.getElementById('histList');
  if (!h.length) {
    el.innerHTML = '<p style="color:#666">Chưa có kết quả nào được lưu. Kết quả sẽ tự động lưu sau mỗi lần chơi xong.</p>';
    return;
  }
  el.innerHTML = h.map((r, i) => {
    const when = new Date(r.ts).toLocaleString('vi-VN');
    return `<div class="qitem" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div><b>${when}</b><br><span style="color:#666;font-size:14px">PIN ${r.pin || '—'} · ${r.count} người chơi · ${r.totalQ} câu</span></div>
      <button class="hist-dl" data-i="${i}" style="background:#0d3b8c;color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:700">Tải Excel</button>
    </div>`;
  }).join('');
  el.querySelectorAll('.hist-dl').forEach((b) =>
    b.addEventListener('click', () => {
      const r = getHistory()[Number(b.dataset.i)];
      if (r) exportResultsXlsx(r.results, r.totalQ, r.ts);
    })
  );
}

document.getElementById('againBtn').addEventListener('click', () => location.reload());

socket.on('disconnect', () => {
  // May chu tat: quay ve setup o lan tuong tac sau
});

// Khoi tao: tai san bo cau hoi mau cho tien
(async function init() {
  try {
    const r = await fetch('/questions.json');
    const data = await r.json();
    if (Array.isArray(data)) questions = data;
  } catch (e) {}
  renderList();
})();
