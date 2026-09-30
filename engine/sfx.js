/* =========================================================================
   GAMEIF PRESENTATION — sfx.js
   効果音はすべて WebAudio で合成する。音源ファイルを持たない。
   理由: (1) 会場でオフラインでも鳴る (2) 権利の心配がない (3) 1枚HTMLに収まる
   ========================================================================= */
(function (G) {
  'use strict';

  var ctx = null, master = null, muted = false;

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function env(node, t0, a, d, peak) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g); g.connect(master);
    return g;
  }

  function tone(freq, dur, type, peak, slideTo) {
    if (!ac() || muted) return;
    var t0 = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    env(o, t0, 0.004, dur, peak == null ? 0.25 : peak);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, peak, lo, hi) {
    if (!ac() || muted) return;
    var t0 = ctx.currentTime, n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = (lo + hi) / 2; bp.Q = 0.7;
    src.connect(bp);
    env(bp, t0, 0.003, dur, peak == null ? 0.4 : peak);
    src.start(t0);
  }

  function chord(freqs, dur, type, peak) {
    freqs.forEach(function (f, i) { setTimeout(function () { tone(f, dur, type, peak); }, i * 45); });
  }

  var LIB = {
    /* 文字送り。短く軽く。連打されるので音量は小さい */
    type:      function () { tone(1200 + Math.random() * 160, 0.02, 'square', 0.045); },
    /* 木槌 */
    gavel:     function () { noise(0.09, 0.55, 90, 900); tone(150, 0.13, 'triangle', 0.4, 70); },
    /* 「異議あり！」の衝撃 */
    objection: function () {
      noise(0.28, 0.75, 120, 2600);
      tone(880, 0.10, 'sawtooth', 0.35, 110);
      setTimeout(function () { tone(220, 0.35, 'square', 0.3, 80); }, 60);
    },
    /* ムジュンを突いた瞬間 */
    breakthrough: function () {
      chord([523, 659, 784, 1046], 0.4, 'triangle', 0.3);
      setTimeout(function(){ noise(0.35, 0.3, 2000, 7000); }, 40);
    },
    /* 外した */
    wrong:     function () { tone(160, 0.28, 'square', 0.32, 110);
                             setTimeout(function(){ tone(120, 0.34, 'square', 0.3, 80); }, 130); },
    /* ライフが減る */
    damage:    function () { noise(0.22, 0.5, 60, 700); tone(90, 0.3, 'sawtooth', 0.3, 45); },
    /* 証拠品を手に入れた */
    evidence:  function () { chord([784, 1046, 1318], 0.22, 'triangle', 0.26); },
    /* ゆさぶる */
    press:     function () { tone(520, 0.08, 'triangle', 0.22, 700); },
    select:    function () { tone(760, 0.05, 'square', 0.18); },
    move:      function () { tone(420, 0.035, 'square', 0.12); },
    open:      function () { tone(300, 0.09, 'triangle', 0.2, 620); },
    close:     function () { tone(620, 0.09, 'triangle', 0.2, 300); },
    /* 結審 */
    fanfare:   function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.3, 'triangle', 0.3); }, i * 110);
      });
    },
    reveal:    function () { tone(300, 0.5, 'sine', 0.25, 1400); }
  };

  /* --- 簡易BGM（既定オフ）。案件の緊張感だけ作る2音のループ --- */
  var bgmTimer = null, bgmStep = 0;
  var MOODS = {
    tense: { seq: [110, 110, 138, 110, 146, 110, 130, 110], ms: 260, type: 'triangle', peak: 0.09 },
    calm:  { seq: [196, 233, 261, 233], ms: 620, type: 'sine', peak: 0.07 }
  };
  function bgm(mood) {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    if (!mood || mood === 'off' || !MOODS[mood]) return;
    var m = MOODS[mood]; bgmStep = 0;
    bgmTimer = setInterval(function () {
      if (muted) return;
      tone(m.seq[bgmStep % m.seq.length], m.ms / 1000 * 0.8, m.type, m.peak);
      bgmStep++;
    }, m.ms);
  }

  G.sfx = {
    play: function (name) { var f = LIB[name]; if (f) { try { f(); } catch (e) {} } },
    bgm: bgm,
    mute: function (v) { muted = v == null ? !muted : !!v; if (muted) bgm('off'); return muted; },
    isMuted: function () { return muted; },
    unlock: function () { ac(); }
  };
})(window.GIF = window.GIF || {});
