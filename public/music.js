/**
 * music.js - Quan ly nhac nen (.mp3) qua Web Audio API.
 * Dung CHUNG "dong co am thanh" voi hieu ung (sfx.js), nen neu hieu ung keu duoc
 * thi nhac nen cung phat duoc (tranh viec Chrome chan rieng the loai <audio>).
 * Dat file vao public/sounds/  (lobby.mp3, question.mp3). Thieu file thi bo qua, khong loi.
 */
(function () {
  let enabled = true;
  let curName = null;
  let source = null;
  let gainNode = null;
  let curVol = 0.35;
  const buffers = {};

  function getCtx() {
    if (window.SFX && SFX.getContext) return SFX.getContext();
    return null;
  }

  async function load(name) {
    if (buffers[name] !== undefined) return buffers[name];
    try {
      const res = await fetch('sounds/' + name + '.mp3');
      if (!res.ok) throw new Error('missing');
      const arr = await res.arrayBuffer();
      const ctx = getCtx();
      if (!ctx) return null;
      const buf = await ctx.decodeAudioData(arr);
      buffers[name] = buf;
      return buf;
    } catch (e) {
      buffers[name] = null;
      return null;
    }
  }

  function stopSource() {
    if (source) {
      try { source.stop(); } catch (e) {}
      try { source.disconnect(); } catch (e) {}
      source = null;
    }
  }

  window.Music = {
    setEnabled(v) {
      enabled = !!v;
      if (gainNode) gainNode.gain.value = enabled ? curVol : 0;
    },
    isEnabled() { return enabled; },

    play: async function (name, opts) {
      opts = opts || {};
      curVol = opts.volume != null ? opts.volume : 0.35;
      if (curName === name && source) {
        if (gainNode) gainNode.gain.value = enabled ? curVol : 0;
        return;
      }
      const ctx = getCtx();
      if (!ctx) return;
      const buf = await load(name);
      if (!buf) return;
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
      stopSource();
      source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = opts.loop !== false;
      gainNode = ctx.createGain();
      gainNode.gain.value = enabled ? curVol : 0;
      source.connect(gainNode).connect(ctx.destination);
      try { source.start(0); } catch (e) {}
      curName = name;
    },

    pause() { if (gainNode) gainNode.gain.value = 0; },
    resume() { if (gainNode) gainNode.gain.value = enabled ? curVol : 0; },
    stop() { stopSource(); curName = null; }
  };
})();
