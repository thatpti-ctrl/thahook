/**
 * sfx.js - Hieu ung am thanh tao truc tiep bang Web Audio API.
 * Khong can file mp3. Dung chung cho man giao vien va sinh vien.
 */
(function () {
  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Tao mot not: tan so, thoi diem bat dau, do dai, dang song, am luong
  function tone(freq, start, dur, type, vol) {
    const c = ac();
    if (!c || !enabled) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  window.SFX = {
    init() { ac(); },                       // goi khi co thao tac dau tien cua nguoi dung
    getContext() { return ac(); },          // dung chung "dong co" am thanh voi nhac nen
    setEnabled(v) { enabled = !!v; },
    isEnabled() { return enabled; },

    tick()  { tone(880, 0, 0.07, 'square', 0.10); },                 // dem nguoc
    click() { tone(600, 0, 0.05, 'triangle', 0.14); },               // bam chon dap an
    join()  { tone(523, 0, 0.10, 'sine', 0.20); tone(784, 0.08, 0.12, 'sine', 0.20); },

    correct() {                                                       // dung: arpeggio vui
      tone(523.25, 0,    0.12, 'sine', 0.22);
      tone(659.25, 0.12, 0.12, 'sine', 0.22);
      tone(783.99, 0.24, 0.12, 'sine', 0.22);
      tone(1046.5, 0.36, 0.24, 'sine', 0.24);
    },
    wrong() {                                                         // sai: tieng tram
      tone(196, 0,    0.38, 'sawtooth', 0.18);
      tone(146, 0.06, 0.38, 'sawtooth', 0.14);
    },
    timeup() {                                                        // het gio / hien dap an
      tone(440, 0,    0.14, 'square', 0.16);
      tone(330, 0.14, 0.26, 'square', 0.16);
    },
    reveal() {                                                        // hien tung giai
      tone(659.25, 0, 0.14, 'sine', 0.22);
      tone(987.77, 0.12, 0.20, 'sine', 0.22);
    },
    win() {                                                           // ket thuc: fanfare
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
      notes.forEach((f, i) => tone(f, i * 0.14, 0.22, 'sine', 0.22));
    }
  };
})();
