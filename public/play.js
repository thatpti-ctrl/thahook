const socket = io();

const views = {
  join: document.getElementById('joinView'),
  lobby: document.getElementById('lobbyView'),
  play: document.getElementById('playView'),
  wait: document.getElementById('waitView'),
  result: document.getElementById('resultView'),
  end: document.getElementById('endView'),
};
function show(name) {
  Object.values(views).forEach((v) => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
}

let myName = '';
let currentQIndex = -1;

// Luu phien de VAO LAI giu diem khi rot mang / tai lai trang
const SKEY = 'thahook_sess';
let sess = null; // {pin, name, token}
function loadSess() {
  if (sess) return sess;
  try { sess = JSON.parse(sessionStorage.getItem(SKEY)); } catch (e) {}
  return sess;
}
function saveSess(s) { sess = s; try { sessionStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} }
function clearSess() { sess = null; try { sessionStorage.removeItem(SKEY); } catch (e) {} }

const params = new URLSearchParams(location.search);
(function prefill() {
  const s = loadSess();
  if (s && s.pin) document.getElementById('pinInput').value = s.pin;
  if (params.get('pin')) document.getElementById('pinInput').value = params.get('pin');
  if (s && s.name) document.getElementById('nameInput').value = s.name;
})();

document.getElementById('joinBtn').addEventListener('click', join);
document.getElementById('nameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') join();
});

function doJoin(pin, name, token, isAuto) {
  const err = document.getElementById('joinErr');
  socket.emit('player:join', { pin, name, token }, (res) => {
    if (!res || !res.ok) {
      if (!isAuto) err.textContent = (res && res.error) || 'Không vào được phòng.';
      else clearSess(); // tu dong vao lai that bai -> xoa phien cu
      return;
    }
    myName = res.name;
    saveSess({ pin, name: res.name, token: res.token });
    document.getElementById('myName').textContent = myName;
    document.getElementById('lobbyMsg').textContent = res.inProgress
      ? (res.restored ? 'Đã kết nối lại — chờ câu hỏi tiếp theo…' : 'Trò chơi đang diễn ra — chờ câu hỏi tiếp theo…')
      : 'Đang chờ giáo viên bắt đầu…';
    if (!isAuto) SFX.join();
    show('lobby');
  });
}

function join() {
  const pin = document.getElementById('pinInput').value.trim();
  const name = document.getElementById('nameInput').value.trim();
  const err = document.getElementById('joinErr');
  err.textContent = '';
  if (!pin || !name) {
    err.textContent = 'Vui lòng nhập đủ mã PIN và tên.';
    return;
  }
  SFX.init(); // kich hoat am thanh (thao tac cham cua nguoi dung)
  const s = loadSess();
  const tok = (s && s.name && s.name.toLowerCase() === name.toLowerCase()) ? s.token : undefined;
  doJoin(pin, name, tok, false);
}

// Tu dong vao lai khi ket noi lai (rot mang) hoac tai lai trang giua chung
socket.on('connect', () => {
  const e = document.getElementById('joinErr'); if (e) e.textContent = '';
  const s = loadSess();
  if (s && s.pin && s.name) doJoin(s.pin, s.name, s.token, true);
});

// Nut tat/bat tieng
document.getElementById('pMute').addEventListener('click', () => {
  const on = !SFX.isEnabled();
  SFX.setEnabled(on);
  document.getElementById('pMute').textContent = on ? '🔊' : '🔇';
});

// Nut tra loi
document.querySelectorAll('.pbtn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const opt = Number(btn.dataset.opt);
    SFX.click();
    socket.emit('player:answer', { option: opt });
    show('wait');
  });
});

socket.on('game:question', (q) => {
  currentQIndex = q.index;
  document.getElementById('pQIdx').textContent = `${q.index + 1}/${q.total}`;
  document.getElementById('pQuestion').textContent = q.question;
  // Hien nut co dap an tuong ung, kem noi dung dap an
  document.querySelectorAll('.pbtn').forEach((btn, i) => {
    const has = i < q.options.length;
    btn.style.display = has ? '' : 'none';
    btn.disabled = false;
    const t = btn.querySelector('.ptext');
    if (t) t.textContent = has ? q.options[i] : '';
  });
  show('play');
});

socket.on('player:result', (r) => {
  const msg = document.getElementById('rMsg');
  if (r.correct) {
    msg.textContent = '✔ Chính xác!';
    msg.className = 'status-big result-correct';
    SFX.correct();
  } else {
    msg.textContent = '✘ Chưa đúng';
    msg.className = 'status-big result-wrong';
    SFX.wrong();
  }
  document.getElementById('rGain').textContent = r.gained > 0 ? `+${r.gained} điểm` : 'Không có điểm câu này';
  document.getElementById('rScore').textContent = r.score;
  document.getElementById('rRank').textContent = `${r.rank}/${r.total}`;
  show('result');
});

socket.on('game:end', () => {
  clearSess();
  SFX.win();
  show('end');
});
// Diem cuoi lay tu ket qua cau cuoi (da luu tren #rScore/#rRank)
socket.on('game:end', () => {
  document.getElementById('endScore').textContent = document.getElementById('rScore').textContent || '0';
  const rank = document.getElementById('rRank').textContent || '';
  document.getElementById('endRank').textContent = rank ? `Hạng của bạn: ${rank}` : '';
});

socket.on('game:aborted', () => {
  clearSess();
  alert('Giáo viên đã kết thúc phiên chơi.');
  location.reload();
});

socket.on('disconnect', () => {
  const err = document.getElementById('joinErr');
  if (err) err.textContent = '⚠ Mất kết nối — đang thử kết nối lại…';
});
