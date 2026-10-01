/* =========================================================================
   GAMEIF PRESENTATION — engine.js
   ケース(JSON)を読み、法廷型プレゼンとして進行させる。

   設計の前提（当日の会場を想定して決めたこと）
   - 発表者は手元を見ない。クリッカーが送る →/←/PageDown/PageUp/Space だけで
     最低限すべて進行できる。
   - 絶対に行き止まりを作らない。ライフが0でも審理は続行する（ゲームオーバーで
     プレゼンが止まったら、それは事故）。
   - 聴衆は画面しか見ない。文字は cqw 基準で常に巨大。
   - 外部ネットワークに依存しない。フォント・音・絵はすべてローカル生成。
   ========================================================================= */
(function (G) {
  'use strict';

  var NEXT_KEYS = [' ', 'Enter', 'ArrowRight', 'PageDown', 'ArrowDown', 'n'];
  var BACK_KEYS = ['ArrowLeft', 'PageUp', 'ArrowUp', 'Backspace'];

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function on(el, cls, v) { el.classList[v ? 'add' : 'remove'](cls); }

  /* text ノードを1文字ずつ span に包む。タグ（<b> など）は保つ */
  function wrapChars(el) {
    var chars = [];
    (function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.nodeValue.split('').forEach(function (ch) {
            var s = document.createElement('span');
            s.className = 'c'; s.textContent = ch;
            frag.appendChild(s); chars.push(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
    return chars;
  }

  /* ====================================================================== */
  function Player(root, data) {
    this.root = root;
    this.data = data;
    this.meta = data.meta || {};
    this.cast = data.cast || {};
    this.evidence = (data.evidence || []).slice();
    this.scenes = data.scenes || [];

    this.lifeMax = this.meta.lifeMax == null ? 5 : this.meta.lifeMax;
    this.life = this.lifeMax;
    this.owned = {};
    this.sceneIndex = -1;
    this.mode = 'idle';        // idle|line|statements|record|choices|menu|title
    this.queue = [];
    this.past = [];
    this.typing = null;
    this.notesOn = false;
    this.timerOn = false;
    this.startedAt = null;
    this.stats = { wrong: 0, solved: 0 };

    (this.meta.startEvidence || []).forEach(function (id) { this.owned[id] = true; }, this);
    if (this.meta.allEvidenceFromStart) this.evidence.forEach(function (e) { this.owned[e.id] = true; }, this);

    this.build();
    this.bind();
  }

  /* ---------------------------------------------------------------- DOM -- */
  Player.prototype.build = function () {
    var m = this.meta;
    this.root.innerHTML = '';
    this.root.id = 'stage';
    if (m.theme) this.root.dataset.theme = m.theme;
    document.title = (m.title || 'GAMEIF PRESENTATION');

    this.el = {};
    var bg = h('div', 'bg');
    bg.dataset.bg = 'courtroom';
    bg.appendChild(h('div', 'lines'));
    var em = h('div', 'emblem'); em.innerHTML = G.art.emblem();
    bg.appendChild(em);
    this.el.bg = bg;

    this.el.actors = h('div', 'actors');

    /* カメラの層。内側ほど小さい動きを担当する（engine/camera.js 参照） */
    var drift = h('div', 'drift');
    drift.appendChild(bg); drift.appendChild(this.el.actors);
    var world = h('div', 'world'); world.appendChild(drift);
    var cam = h('div', 'cam'); cam.appendChild(world);
    this.el.cam = cam; this.el.world = world; this.el.drift = drift;
    this.cam = new G.Camera(this.root, cam, world, drift, bg);

    var hud = h('div', 'hud');
    this.el.life = h('div', 'life');
    this.el.chapter = h('div', 'chapter');
    hud.appendChild(this.el.life); hud.appendChild(this.el.chapter);
    this.el.hud = hud;

    this.el.banner = h('div', 'banner');
    this.el.hint = h('div', 'hint');
    this.el.prevArrow = h('div', 'stmt-arrow prev', '◀');
    this.el.nextArrow = h('div', 'stmt-arrow next-s', '▶');
    this.el.xebar = h('div', 'xe-bar',
      '<button class="xe-btn press">ゆさぶる<span class="k">P</span></button>' +
      '<button class="xe-btn present">つきつける<span class="k">E</span></button>');

    var tb = h('div', 'textbox');
    this.el.name = h('div', 'nameplate');
    this.el.mark = h('div', 'statement-mark');
    this.el.line = h('div', 'line');
    this.el.next = h('div', 'next');
    tb.appendChild(this.el.name); tb.appendChild(this.el.mark);
    tb.appendChild(this.el.line); tb.appendChild(this.el.next);
    this.el.textbox = tb;

    this.el.slide = h('div', 'slide');
    this.el.title = h('div', 'title-card');
    this.el.choices = h('div', 'choices');
    this.el.record = h('div', 'court-record');
    this.el.menu = h('div', 'menu');
    this.el.notes = h('div', 'notes');
    this.el.timer = h('div', 'timer');
    this.el.toast = h('div', 'toast');
    this.el.shout = h('div', 'shout', '<span></span>');
    this.el.flash = h('div', 'flash');
    this.el.vignette = h('div', 'vignette');
    this.el.bars = h('div', 'bars', '<i></i><i></i>');

    [cam, this.el.vignette, this.el.bars, this.el.banner, this.el.hint,
     this.el.prevArrow, this.el.nextArrow, this.el.xebar,
     this.el.slide, this.el.title, tb, this.el.choices, this.el.record,
     this.el.notes, this.el.timer, this.el.toast, this.el.menu,
     this.el.shout, this.el.flash
    ].forEach(function (e) { this.root.appendChild(e); }, this);
    this.root.appendChild(hud);

    this.renderLife();
  };

  /* ------------------------------------------------------------- 入力 -- */
  Player.prototype.bind = function () {
    var self = this;
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key;
      G.sfx.unlock();
      if (self.startedAt == null) self.startedAt = Date.now();

      /* 常時きくキー */
      if (k === 'Escape') {
        e.preventDefault();
        if (self.mode === 'record') return self.closeRecord();
        if (self.mode === 'menu')   return self.closeMenu();
        return self.toggleMenu();
      }
      if (k === 'e' || k === 'E')              { e.preventDefault(); return self.toggleRecord(); }
      if (k === 'm' || k === 'M')              { e.preventDefault(); return self.toast(G.sfx.mute() ? '🔇 消音' : '🔊 音あり'); }
      if (k === 'p' && self.mode === 'statements') { e.preventDefault(); return self.press(); }
      if (k === 'P')                           { e.preventDefault(); return self.press(); }
      if (k === 't' || k === 'T')              { e.preventDefault(); return self.toggleTimer(); }
      if (k === 'f' || k === 'F')              { e.preventDefault(); return self.fullscreen(); }
      if (k === 'r' || k === 'R')              { e.preventDefault(); return self.restart(); }
      if (k === '?' || k === '/')              { e.preventDefault(); return self.toggleMenu(); }
      if (k === 'h' || k === 'H')              { e.preventDefault(); return self.toggleNotes(); }

      if (self.mode === 'menu')      return self.menuKey(e);
      if (self.mode === 'record')    return self.recordKey(e);
      if (self.mode === 'choices')   return self.choicesKey(e);

      if (NEXT_KEYS.indexOf(k) >= 0) { e.preventDefault(); return self.next(); }
      if (BACK_KEYS.indexOf(k) >= 0) { e.preventDefault(); return self.back(); }
    });

    this.root.addEventListener('click', function (e) {
      if (self.mode === 'record' || self.mode === 'choices' || self.mode === 'menu') return;
      G.sfx.unlock();
      if (self.startedAt == null) self.startedAt = Date.now();
      self.next();
    });
    this.root.addEventListener('contextmenu', function (e) { e.preventDefault(); self.back(); });

    var stop = function (e) { e.stopPropagation(); };
    this.el.prevArrow.addEventListener('click', function (e) { stop(e); self.stmtMove(-1); });
    this.el.nextArrow.addEventListener('click', function (e) { stop(e); self.stmtMove(1); });
    this.el.xebar.querySelector('.press').addEventListener('click', function (e) { stop(e); self.press(); });
    this.el.xebar.querySelector('.present').addEventListener('click', function (e) { stop(e); self.openRecord(); });
    this.el.xebar.addEventListener('click', stop);
  };

  /* ------------------------------------------------------------ HUD 系 -- */
  Player.prototype.renderLife = function () {
    if (this.lifeMax <= 0) { this.el.life.innerHTML = ''; this.el.life.style.display = 'none'; return; }
    var s = '';
    for (var i = 0; i < this.lifeMax; i++) s += '<div class="pip' + (i < this.life ? '' : ' off') + '"></div>';
    this.el.life.innerHTML = s;
    var r = this.life / this.lifeMax;
    this.el.life.dataset.level = r > 0.6 ? 'high' : r > 0.3 ? 'mid' : 'low';
  };
  Player.prototype.setChapter = function (t, sub) {
    this.el.chapter.innerHTML = (sub ? '<small>' + sub + '</small>' : '') + (t || '');
  };
  Player.prototype.toast = function (msg, ms) {
    var el = this.el.toast; el.innerHTML = msg; on(el, 'show', true);
    clearTimeout(this._toastT);
    this._toastT = setTimeout(function () { on(el, 'show', false); }, ms || 1600);
  };
  Player.prototype.toggleTimer = function () {
    this.timerOn = !this.timerOn; on(this.el.timer, 'show', this.timerOn);
    var self = this;
    clearInterval(this._timerI);
    if (this.timerOn) {
      if (this.startedAt == null) this.startedAt = Date.now();
      this._timerI = setInterval(function () {
        var s = Math.floor((Date.now() - self.startedAt) / 1000);
        self.el.timer.textContent = ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
      }, 500);
    }
  };
  Player.prototype.toggleNotes = function () {
    this.notesOn = !this.notesOn;
    on(this.el.notes, 'show', this.notesOn && !!this.el.notes.innerHTML);
    this.toast(this.notesOn ? '発表者ノート ON' : '発表者ノート OFF', 900);
  };
  Player.prototype.setNote = function (txt) {
    this.el.notes.innerHTML = txt ? '<b>NOTE</b> ' + txt : '';
    on(this.el.notes, 'show', this.notesOn && !!txt);
  };
  Player.prototype.fullscreen = function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else (document.documentElement.requestFullscreen || function () {}).call(document.documentElement);
  };
  Player.prototype.restart = function () {
    this.life = this.lifeMax; this.owned = {}; this.stats = { wrong: 0, solved: 0 };
    (this.meta.startEvidence || []).forEach(function (id) { this.owned[id] = true; }, this);
    if (this.meta.allEvidenceFromStart) this.evidence.forEach(function (e) { this.owned[e.id] = true; }, this);
    this.renderLife(); this.goScene(0); this.toast('最初から', 900);
  };

  /* --------------------------------------------------------- 演出 系 -- */
  Player.prototype.flash = function () {
    var f = this.el.flash; on(f, 'go', false); void f.offsetWidth; on(f, 'go', true);
  };
  Player.prototype.shake = function () {
    var r = this.root; on(r, 'shake', false); void r.offsetWidth; on(r, 'shake', true);
    setTimeout(function () { on(r, 'shake', false); }, 450);
  };
  Player.prototype.shout = function (text, cb) {
    var self = this;
    this.el.shout.querySelector('span').textContent = text;
    on(this.el.shout, 'show', true); on(this.root, 'shouting', true);
    this.flash(); this.shake(); G.sfx.play('objection');
    setTimeout(function () {
      on(self.el.shout, 'show', false); on(self.root, 'shouting', false);
      cb && cb();
    }, 1100);
  };
  /* 背景。meta.backgrounds に画像パスがあればそれを使い、無ければCSSの生成背景。
     絵を描き足すほど本物に寄る、という伸びしろをここに置いてある。 */
  /* 視点（angle）ごとの絵があればそれを優先する。
     meta.backgrounds のキーは "courtroom" / "courtroom@defense" のように書く。
     絵を3枚用意したぶんだけ、切り返しが本物になる。 */
  Player.prototype.setBg = function (name, angle) {
    if (name) this._bgName = name;
    name = name || this._bgName;
    if (!name) return;
    if (angle) this._bgAngle = angle;
    this.el.bg.dataset.bg = name;
    var bgs = this.meta.backgrounds || {};
    var src = bgs[name + '@' + (angle || this._bgAngle || '')] || bgs[name];
    if (src) {
      this.el.bg.style.backgroundImage = 'url("' + src + '")';
      on(this.el.bg, 'img', true);
    } else {
      this.el.bg.style.backgroundImage = '';
      on(this.el.bg, 'img', false);
    }
  };
  Player.prototype.hurt = function (n) {
    if (this.lifeMax <= 0) return;
    this.life = Math.max(0, this.life - (n || 1));
    this.stats.wrong++;
    this.renderLife(); G.sfx.play('damage'); this.shake();
    var a = this.root.querySelector('.actor.show');
    if (a) { on(a, 'damage', true); setTimeout(function () { on(a, 'damage', false); }, 1100); }
  };

  /* ------------------------------------------------------- 立ち絵 表示 -- */
  Player.prototype.showActor = function (whoId, pose, side) {
    this.el.actors.innerHTML = '';
    if (!whoId) return;
    var def = this.cast[whoId]; if (!def) return;
    var wrap = h('div', 'actor ' + (side || def.side || 'center'));
    if (def.img) {
      /* poses は "path" でも {src, flip} でも書ける。
         生成した絵が相手と逆を向いているときは flip:true で左右反転する。
         向きのためだけに描き直すのは無駄なので。 */
      var src = def.img, flip = !!def.flip;
      var pv = def.poses && def.poses[pose];
      if (typeof pv === 'string') src = pv;
      else if (pv && pv.src) { src = pv.src; if (pv.flip != null) flip = !!pv.flip; }
      var im = new Image(); im.src = src; im.alt = def.name || whoId;
      if (flip) wrap.classList.add('flip');
      wrap.appendChild(im);
    } else {
      wrap.innerHTML = G.art.portrait(def, pose || 'normal');
    }
    this.el.actors.appendChild(wrap);
    void wrap.offsetWidth; on(wrap, 'show', true);
    this._actor = wrap;
  };

  /* ------------------------------------------------------- 1行を表示 -- */
  Player.prototype.showLine = function (line) {
    var self = this;
    this.mode = 'line';
    on(this.el.prevArrow, 'show', false);
    on(this.el.nextArrow, 'show', false);
    on(this.el.xebar, 'show', false);
    on(this.el.slide, 'show', false);
    on(this.el.title, 'show', false);
    if (line.bgm !== undefined) G.sfx.bgm(line.bgm);

    var def = line.who ? this.cast[line.who] : null;
    var side = line.side || (def && def.side) || 'center';
    var prevSide = this._prevSide || 'center';
    var shot = this.cam.autoFor(line, side, prevSide);

    /* 席が入れ替わるときは切り返し。中身の差し替えはパンの途中でやる。 */
    var swap = function () {
      self.setBg(line.bg, shot.angle);
      if (line.who) self.showActor(line.who, line.pose || 'talk', side);
      if (line.hideActor) self.el.actors.innerHTML = '';
      self.cam.set(shot);
    };
    var crossing = side !== 'center' && prevSide !== 'center' && side !== prevSide
                   && line.whip !== false && !this.cam.reduced();
    if (line.whip === true || crossing) {
      G.sfx.play('move');
      this.cam.whip(side === 'left' ? -1 : 1, swap);
    } else {
      swap();
    }
    this._prevSide = side;
    on(this.el.bars, 'show', !!line.cinematic);

    on(this.el.name, 'show', !!def);
    this.el.name.textContent = def ? (def.name || line.who) : '';
    if (def && def.color) this.el.name.style.background = def.color;
    else this.el.name.style.background = '';

    on(this.el.textbox, 'show', true);
    on(this.el.banner, 'show', !!line.banner);
    if (line.banner) this.el.banner.textContent = line.banner;

    this.el.line.className = 'line' + (line.style ? ' ' + line.style : '');
    this.setNote(line.note);
    this.el.mark.textContent = '';

    var go = function () {
      if (line.sfx) G.sfx.play(line.sfx);
      if (line.flash) self.flash();
      if (line.shake) self.shake();
      self.type(line.text || '', line.speed);
      /* 読んでいる間だけ、気づかない速さで詰める。静止画に見せないため。 */
      if (shot.move === 'drift' || shot.move === 'push') {
        setTimeout(function () { if (self.mode === 'line') self.cam.creep(side, 1.05); }, 60);
      }
    };
    if (line.shout) this.shout(line.shout, go); else go();
  };

  Player.prototype.type = function (html, speed) {
    var self = this;
    clearInterval(this.typing);
    on(this.el.next, 'show', false);
    this.el.line.innerHTML = html;
    var chars = wrapChars(this.el.line), i = 0;
    var ms = speed != null ? speed
           : (this.meta.typeSpeed != null ? this.meta.typeSpeed : 22);
    var a = this._actor; if (a) on(a, 'talking', true);
    if (ms <= 0) { chars.forEach(function (c) { on(c, 'on', true); }); return this.typeDone(); }
    this.typing = setInterval(function () {
      var step = 0;
      while (i < chars.length && step < 1) { on(chars[i], 'on', true); i++; step++; }
      if (i % 3 === 0) G.sfx.play('type');
      if (i >= chars.length) self.typeDone();
    }, ms);
    this._chars = chars;
  };
  Player.prototype.typeDone = function () {
    clearInterval(this.typing); this.typing = null;
    if (this._chars) this._chars.forEach(function (c) { on(c, 'on', true); });
    var a = this._actor; if (a) on(a, 'talking', false);
    on(this.el.next, 'show', true);
  };
  Player.prototype.isTyping = function () {
    return !!this.typing;
  };

  /* --------------------------------------------------- 行キューの実行 -- */
  Player.prototype.playLines = function (lines, done) {
    /* 走っているタイプライターは打ち切る。ここで advance() に飲ませると
       最初の1行が消え、mode が idle のまま残って次のキーでシーンが飛ぶ。 */
    clearInterval(this.typing); this.typing = null;
    this.queue = (lines || []).slice();
    this.queueDone = done || null;
    this.past = [];
    this.advance();
  };
  Player.prototype.advance = function () {
    if (this.isTyping()) { this.typeDone(); return; }
    if (!this.queue.length) {
      var d = this.queueDone; this.queueDone = null;
      if (d) d(); else this.nextScene();
      return;
    }
    var line = this.queue.shift();
    this.past.push(line);
    this.showLine(line);
  };
  Player.prototype.rewind = function () {
    if (this.past.length <= 1) return false;
    var cur = this.past.pop();
    this.queue.unshift(cur);
    var prev = this.past[this.past.length - 1];
    this.showLine(prev);
    if (this.isTyping()) this.typeDone();
    return true;
  };

  /* ------------------------------------------------------------ 進行 -- */
  Player.prototype.next = function () {
    if (this.mode === 'line')       return this.advance();
    if (this.mode === 'statements') return this.stmtMove(1);
    if (this.mode === 'slide') {
      var f = this._slideLines; this._slideLines = null;
      this.mode = 'idle';
      if (f) { on(this.el.slide, 'show', false); return this.playLines(f, null); }
      return this.nextScene();
    }
    if (this.mode === 'title')      return this.nextScene();
    if (this.mode === 'idle')       return this.nextScene();
  };
  Player.prototype.back = function () {
    if (this.mode === 'statements') return this.stmtMove(-1);
    if (this.mode === 'line' && this.rewind()) return;
    if (this.sceneIndex > 0) { G.sfx.play('close'); this.goScene(this.sceneIndex - 1); }
  };
  Player.prototype.nextScene = function () {
    if (this.sceneIndex + 1 >= this.scenes.length) {
      var last = this.scenes[this.sceneIndex] || {};
      if (last.type === 'verdict') { this.toast('これが最後のシーンです', 1400); this._ended = true; return; }
      this.finish();
      return;
    }
    this.goScene(this.sceneIndex + 1);
  };

  Player.prototype.goScene = function (i) {
    if (i < 0 || i >= this.scenes.length) return;
    this.sceneIndex = i;
    this.syncEvidence(i);
    var sc = this.scenes[i];
    this.mode = 'idle';
    this.queue = []; this.queueDone = null; this.past = [];
    clearInterval(this.typing); this.typing = null;
    clearTimeout(this._autoT); this._autoT = null;
    on(this.el.banner, 'show', false);
    on(this.el.hint, 'show', false);
    on(this.el.prevArrow, 'show', false);
    on(this.el.nextArrow, 'show', false);
    on(this.el.xebar, 'show', false);
    on(this.el.bars, 'show', false);
    on(this.el.choices, 'show', false);
    on(this.el.record, 'show', false);
    on(this.el.slide, 'show', false);
    on(this.el.title, 'show', false);
    this.setChapter(sc.chapter || this.scenes[i].title || '', sc.kicker || this.meta.subtitle);
    if (sc.bg) this.setBg(sc.bg);
    if (sc.bgm !== undefined) G.sfx.bgm(sc.bgm);
    if (location.hash !== '#' + i) history.replaceState(null, '', '#' + i);

    var fn = this['scene_' + (sc.type || 'dialogue')];
    if (!fn) { console.warn('unknown scene type', sc.type); return this.nextScene(); }
    fn.call(this, sc);
  };

  /* そのシーンに到達した時点で持っているべき証拠を揃える。
     目次から飛んでも、戻っても、所持状態が話の順番と食い違わない。 */
  Player.prototype.syncEvidence = function (upto) {
    this.owned = {};
    (this.meta.startEvidence || []).forEach(function (id) { this.owned[id] = true; }, this);
    if (this.meta.allEvidenceFromStart) this.evidence.forEach(function (e) { this.owned[e.id] = true; }, this);
    for (var k = 0; k < upto; k++) {
      var s = this.scenes[k];
      if (s.type === 'evidence') (s.give || []).forEach(function (id) { this.owned[id] = true; }, this);
    }
  };

  Player.prototype.finish = function () {
    G.sfx.bgm('off'); G.sfx.play('fanfare');
    this.mode = 'idle';
    on(this.el.textbox, 'show', false);
    on(this.el.name, 'show', false);
    this.el.actors.innerHTML = '';
    var t = this.el.title;
    t.innerHTML =
      '<div class="kicker">CASE CLOSED</div>' +
      '<h1>結審</h1>' +
      '<div class="sub">お手つき ' + this.stats.wrong + ' 回 / ムジュン突破 ' + this.stats.solved + ' 回</div>' +
      '<div class="go">R でもう一度　Esc で目次</div>';
    on(t, 'show', true);
  };

  /* =================================================== シーン: title == */
  Player.prototype.scene_title = function (sc) {
    this.mode = 'title';
    on(this.el.textbox, 'show', false);
    on(this.el.name, 'show', false);
    this.el.actors.innerHTML = '';
    var t = this.el.title;
    t.innerHTML =
      '<div class="kicker">' + (sc.kicker || this.meta.subtitle || 'GAMEIF PRESENTATION') + '</div>' +
      '<h1>' + (sc.title || this.meta.title || '') + '</h1>' +
      (sc.sub ? '<div class="sub">' + sc.sub + '</div>' : '') +
      '<div class="go">' + (sc.cta || 'ここをクリック / Space で開廷') + '</div>';
    on(t, 'show', true);
    this.setNote(sc.note);
    G.sfx.play('reveal');
  };

  /* ================================================ シーン: dialogue == */
  Player.prototype.scene_dialogue = function (sc) {
    this.playLines(sc.lines, null);
  };

  /* =================================================== シーン: slide == */
  /* 講義パート。逆転裁判で言えば「休廷」。ここだけは普通のスライドに戻る。
     lines を付けると、スライドを出したあとにキャラの会話を続けられる。 */
  Player.prototype.scene_slide = function (sc) {
    this.mode = sc.lines && sc.lines.length ? 'slide' : 'idle';
    on(this.el.textbox, 'show', false);
    on(this.el.name, 'show', false);
    this.el.actors.innerHTML = '';
    var s = this.el.slide, html = '';
    if (sc.title) html += '<h2>' + (sc.kicker ? '<small>' + sc.kicker + '</small>' : '') + sc.title + '</h2>';
    if (sc.big)   html += '<div class="big">' + sc.big + '</div>';
    if (sc.image) html += '<figure><img src="' + sc.image.src + '" alt="">' +
                          (sc.image.caption ? '<figcaption>' + sc.image.caption + '</figcaption>' : '') + '</figure>';
    if (sc.bullets && sc.bullets.length) {
      html += '<ul>' + sc.bullets.map(function (b, i) {
        return '<li style="animation-delay:' + (i * 0.12) + 's">' + b + '</li>';
      }).join('') + '</ul>';
    }
    if (sc.html)  html += sc.html;
    if (sc.footnote) html += '<div class="note">' + sc.footnote + '</div>';
    s.innerHTML = html;
    on(s, 'show', true);
    this.setNote(sc.note);
    G.sfx.play('open');
    this._slideLines = sc.lines || null;
  };

  /* ================================================ シーン: evidence == */
  Player.prototype.scene_evidence = function (sc) {
    var self = this, names = [];
    (sc.give || []).forEach(function (id) {
      self.owned[id] = true;
      var e = self.evidence.filter(function (x) { return x.id === id; })[0];
      if (e) names.push(e.name);
    });
    G.sfx.play('evidence');
    if (names.length) this.toast('🗂 法廷記録に追加: ' + names.join(' / '), 2600);
    if (sc.lines && sc.lines.length) this.playLines(sc.lines, null);
    else { var s = this; this._autoT = setTimeout(function () { s.nextScene(); }, 1400); }
  };

  /* =============================================== シーン: testimony == */
  Player.prototype.scene_testimony = function (sc) {
    var self = this;
    this.t = {
      sc: sc,
      i: 0,
      solved: {},
      need: sc.statements.filter(function (s) { return !!s.weak; }).length
    };
    if (this.t.need === 0) this.t.need = 0;
    var start = function () { self.stmtShow(0); };
    if (sc.intro && sc.intro.length) this.playLines(sc.intro, start);
    else start();
  };

  Player.prototype.stmtShow = function (i) {
    var t = this.t, sc = t.sc, st = sc.statements[i];
    t.i = i;
    this.mode = 'statements';
    on(this.el.slide, 'show', false);
    on(this.el.title, 'show', false);
    this.setBg(sc.bg, st.angle || 'witness');
    this.showActor(sc.witness, st.pose || 'talk', sc.side);
    var def = this.cast[sc.witness] || {};
    on(this.el.name, 'show', true);
    this.el.name.textContent = def.name || sc.witness;
    on(this.el.textbox, 'show', true);
    on(this.el.banner, 'show', true);
    this.el.banner.textContent = sc.banner || '証言';
    this.el.mark.textContent = (i + 1) + ' / ' + sc.statements.length +
      (t.solved[i] ? '　ムジュン発見' : '');
    on(this.el.mark, 'broken', !!t.solved[i]);
    this.el.line.className = 'line testimony';
    this.setNote(st.note);
    on(this.el.hint, 'show', false);
    on(this.el.prevArrow, 'show', true);
    on(this.el.nextArrow, 'show', true);
    on(this.el.xebar, 'show', true);
    this.el.xebar.querySelector('.press').style.opacity = (st.press && st.press.length) ? '1' : '.4';

    /* 証言中のカメラ。証言台は正面、わずかに寄る。
       突かれていない証言は「見られている」感じを作るため少し煽る。 */
    this.cam.set(st.shot ? { shot: st.shot, angle: st.angle || 'witness', move: 'snap', side: sc.side }
                         : { shot: 'mid', angle: 'witness', move: 'snap', side: sc.side });
    this._prevSide = sc.side || 'center';
    this.type(st.text || '', sc.speed);
  };

  Player.prototype.stmtMove = function (d) {
    if (this.isTyping()) { this.typeDone(); return; }
    var t = this.t, n = t.sc.statements.length, i = t.i + d;
    G.sfx.play('move');
    if (i >= n) { this.toast('証言をもう一度聞いた', 1200); i = 0; }
    if (i < 0) i = n - 1;
    this.stmtShow(i);
  };

  Player.prototype.press = function () {
    if (this.mode !== 'statements') return;
    var t = this.t, st = t.sc.statements[t.i], self = this;
    if (!st.press || !st.press.length) { this.toast('ここは掘っても何も出ない', 1100); return; }
    G.sfx.play('press');
    on(this.el.hint, 'show', false);
    this.playLines(st.press, function () { self.stmtShow(t.i); });
  };

  /* 証拠をつきつける */
  Player.prototype.present = function (evId) {
    var t = this.t, sc = t.sc, st = sc.statements[t.i], self = this;
    on(this.el.record, 'show', false);
    on(this.root, 'overlay-open', false);
    on(this.el.hint, 'show', false);
    on(this.el.prevArrow, 'show', false);
    on(this.el.nextArrow, 'show', false);
    on(this.el.xebar, 'show', false);
    this.mode = 'line';
    if (st.weak && st.weak.evidence === evId) {
      t.solved[t.i] = true;
      this.stats.solved++;
      var solvedCount = Object.keys(t.solved).length;
      this.shout(sc.shout || '異議あり！', function () {
        G.sfx.play('breakthrough');
        self.playLines(st.weak.onCorrect || [], function () {
          if (solvedCount >= t.need) self.nextScene();
          else self.stmtShow(t.i);
        });
      });
    } else {
      this.hurt(sc.penalty || 1);
      var wrong = (st.weak && st.weak.onWrong) || sc.onWrong || [
        { who: sc.judge || this.firstCastOf('judge'), pose: 'confident',
          text: 'それのどこがムジュンだと言うのかね。<span class="hit">軽率</span>だぞ。' }
      ];
      if (this.life <= 0 && this.lifeMax > 0) {
        this.toast('⚠️ 審理は続行された', 2200);
        this.life = 1; this.renderLife();
      }
      this.playLines(wrong, function () { self.stmtShow(t.i); });
    }
  };
  Player.prototype.firstCastOf = function (art) {
    var ids = Object.keys(this.cast);
    for (var i = 0; i < ids.length; i++) if (this.cast[ids[i]].art === art) return ids[i];
    return ids[0];
  };

  /* ================================================== シーン: choice == */
  Player.prototype.scene_choice = function (sc) {
    var self = this;
    var run = function () {
      self.mode = 'choices';
      self.c = { sc: sc, i: 0 };
      on(self.el.textbox, 'show', false);
      on(self.el.name, 'show', false);
      var c = self.el.choices;
      c.innerHTML = '<div class="q">' + (sc.question || '') + '</div>' +
        sc.options.map(function (o, i) {
          return '<div class="choice" data-i="' + i + '"><span class="k">' + (i + 1) + '</span>' + o.text + '</div>';
        }).join('');
      Array.prototype.forEach.call(c.querySelectorAll('.choice'), function (el) {
        el.addEventListener('click', function () { self.pick(+el.dataset.i); });
        el.addEventListener('mouseenter', function () { self.choiceSel(+el.dataset.i); });
      });
      on(c, 'show', true);
      self.choiceSel(0);
      self.setNote(sc.note);
      G.sfx.play('open');
    };
    if (sc.lines && sc.lines.length) this.playLines(sc.lines, run); else run();
  };
  Player.prototype.choiceSel = function (i) {
    this.c.i = i;
    Array.prototype.forEach.call(this.el.choices.querySelectorAll('.choice'), function (el, j) {
      on(el, 'sel', i === j);
    });
  };
  Player.prototype.choicesKey = function (e) {
    var k = e.key, n = this.c.sc.options.length;
    if (k >= '1' && k <= '9') { e.preventDefault(); var i = +k - 1; if (i < n) { this.choiceSel(i); this.pick(i); } return; }
    if (BACK_KEYS.indexOf(k) >= 0) { e.preventDefault(); G.sfx.play('move'); return this.choiceSel((this.c.i + n - 1) % n); }
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') { e.preventDefault(); G.sfx.play('move'); return this.choiceSel((this.c.i + 1) % n); }
    if (k === ' ' || k === 'Enter') { e.preventDefault(); return this.pick(this.c.i); }
  };
  Player.prototype.pick = function (i) {
    var sc = this.c.sc, o = sc.options[i], self = this;
    on(this.el.choices, 'show', false);
    this.mode = 'idle';
    if (o.correct) {
      G.sfx.play('breakthrough');
      var go = function () { self.playLines(o.reply || [], null); };
      if (o.shout) this.shout(o.shout, go); else go();
    } else {
      this.hurt(sc.penalty || 1);
      if (this.life <= 0 && this.lifeMax > 0) { this.life = 1; this.renderLife(); this.toast('⚠️ 審理は続行された', 2000); }
      this.playLines(o.reply || [
        { who: sc.judge || this.firstCastOf('judge'), pose: 'confident', text: 'それは違うな。' }
      ], function () { self.scene_choice(Object.assign({}, sc, { lines: null })); });
    }
  };

  /* ================================================= シーン: verdict == */
  Player.prototype.scene_verdict = function (sc) {
    var self = this;
    var run = function () {
      self.mode = 'idle';
      on(self.el.textbox, 'show', false);
      on(self.el.name, 'show', false);
      self.el.actors.innerHTML = '';
      var t = self.el.title;
      t.innerHTML =
        '<div class="kicker">' + (sc.kicker || '判決') + '</div>' +
        '<h1>' + (sc.title || '今日の結論') + '</h1>' +
        '<ul class="verdict-list">' + (sc.takeaways || []).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
        '<div class="sub" style="font-size:1.7cqw;opacity:.6">お手つき ' + self.stats.wrong +
          ' 回 / ムジュン突破 ' + self.stats.solved + ' 回</div>' +
        (sc.cta ? '<div class="go">' + sc.cta + '</div>' : '');
      on(t, 'show', true);
      self.setNote(sc.note);
      G.sfx.play('fanfare');
      self.mode = 'idle';
    };
    if (sc.lines && sc.lines.length) this.playLines(sc.lines, run); else run();
  };

  /* ============================================== 法廷記録（証拠品） == */
  Player.prototype.toggleRecord = function () {
    if (this.mode === 'record') return this.closeRecord();
    this.openRecord();
  };
  Player.prototype.openRecord = function () {
    var self = this;
    var list = this.evidence.filter(function (e) { return self.owned[e.id]; });
    if (!list.length) { this.toast('法廷記録はまだ空だ', 1200); return; }
    if (this.mode !== 'record') this._prevMode = this.mode;
    this.mode = 'record';
    this.r = { list: list, i: 0, presenting: this._prevMode === 'statements' };

    var r = this.el.record;
    r.innerHTML =
      '<h3>法廷記録<small>' +
        (this.r.presenting ? '◀ ▶ で選び、<b>Enter / クリック</b> でつきつける　Esc で閉じる'
                           : '◀ ▶ で送る　Esc で閉じる') +
      '</small></h3>' +
      '<div class="ev-stage"><div class="ev-face"></div><div class="ev-info"></div></div>' +
      '<div class="ev-nav"><button class="pv">◀</button><span class="pos"></span><button class="nx">▶</button></div>' +
      '<div class="ev-strip"></div>';

    r.querySelector('.pv').addEventListener('click', function (e) { e.stopPropagation(); self.recordMove(-1); });
    r.querySelector('.nx').addEventListener('click', function (e) { e.stopPropagation(); self.recordMove(1); });
    r.querySelector('.ev-stage').addEventListener('click', function (e) { e.stopPropagation(); self.recordPick(self.r.i); });

    var strip = r.querySelector('.ev-strip');
    list.forEach(function (e, i) {
      var b = h('i');
      b.addEventListener('click', function (ev) { ev.stopPropagation(); self.recordSel(i); });
      strip.appendChild(b);
    });

    on(r, 'show', true);
    on(this.root, 'overlay-open', true);
    this.recordSel(0);
    G.sfx.play('open');
  };

  Player.prototype.recordSel = function (i) {
    var r = this.el.record, e = this.r.list[i];
    this.r.i = i;
    r.querySelector('.ev-face').innerHTML =
      e.img ? '<img src="' + e.img + '" alt="">' : G.art.evidenceIcon(e.icon);
    r.querySelector('.ev-info').innerHTML =
      '<div class="no">証拠品 ' + (i + 1) + ' / ' + this.r.list.length + '</div>' +
      '<div class="nm">' + e.name + '</div>' +
      '<div class="ds">' + (e.desc || '') + '</div>' +
      (e.detail ? '<div class="dt">' + e.detail + '</div>' : '');
    r.querySelector('.pos').textContent = (i + 1) + ' / ' + this.r.list.length;
    Array.prototype.forEach.call(r.querySelectorAll('.ev-strip i'), function (b, j) { on(b, 'cur', i === j); });
  };

  Player.prototype.recordMove = function (d) {
    var n = this.r.list.length;
    G.sfx.play('move');
    this.recordSel((this.r.i + d + n) % n);
  };

  Player.prototype.recordPick = function (i) {
    var e = this.r.list[i];
    if (this.r.presenting) return this.present(e.id);
    G.sfx.play('select');
    this.toast('<b>' + e.name + '</b>', 1600);
  };

  Player.prototype.recordKey = function (ev) {
    var k = ev.key, n = this.r.list.length;
    if (k === 'Escape' || k === 'e' || k === 'E') { ev.preventDefault(); return this.closeRecord(); }
    if (k >= '1' && k <= '9') { ev.preventDefault(); var i = +k - 1; if (i < n) { this.recordSel(i); this.recordPick(i); } return; }
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') { ev.preventDefault(); return this.recordMove(1); }
    if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { ev.preventDefault(); return this.recordMove(-1); }
    if (k === ' ' || k === 'Enter') { ev.preventDefault(); return this.recordPick(this.r.i); }
  };

  Player.prototype.closeRecord = function () {
    on(this.el.record, 'show', false);
    on(this.root, 'overlay-open', false);
    G.sfx.play('close');
    this.mode = this._prevMode || 'idle';
    if (this.mode === 'statements') this.stmtShow(this.t.i);
  };

  /* ======================================================= メニュー == */
  Player.prototype.toggleMenu = function () {
    if (this.mode === 'menu') return this.closeMenu();
    this._prevMode2 = this.mode;
    this.mode = 'menu';
    var self = this, m = this.el.menu;
    m.innerHTML = '<h3>目次 / CONTENTS</h3><ol></ol>' +
      '<div class="keys">' +
      '<kbd>Space</kbd><kbd>→</kbd> 進む　<kbd>←</kbd> 戻る　' +
      '<kbd>E</kbd> 法廷記録（証拠をつきつける）　<kbd>P</kbd> ゆさぶる<br>' +
      '<kbd>H</kbd> 発表者ノート　<kbd>T</kbd> タイマー　<kbd>M</kbd> 消音　' +
      '<kbd>F</kbd> 全画面　<kbd>R</kbd> 最初から　<kbd>Esc</kbd> この画面<br>' +
      'クリッカーは <kbd>→</kbd><kbd>←</kbd> だけで進行できます。' +
      '</div>';
    var ol = m.querySelector('ol');
    this.scenes.forEach(function (sc, i) {
      var label = sc.chapter || sc.title || sc.question || ({
        dialogue: '会話', testimony: '証言', slide: 'スライド',
        choice: '選択', evidence: '証拠品入手', verdict: '判決', title: 'タイトル'
      }[sc.type] || sc.type);
      var li = h('li', i === self.sceneIndex ? 'cur' : '');
      li.innerHTML = '<span class="t">' + (i + 1) + '</span><span>' + label +
        '<small style="opacity:.5"> ' + (sc.type || 'dialogue') + '</small></span>';
      li.addEventListener('click', function () { self.closeMenu(); self.goScene(i); });
      ol.appendChild(li);
    });
    on(m, 'show', true);
    on(this.root, 'overlay-open', true);
    G.sfx.play('open');
  };
  Player.prototype.closeMenu = function () {
    on(this.el.menu, 'show', false);
    on(this.root, 'overlay-open', false);
    G.sfx.play('close');
    this.mode = this._prevMode2 || 'idle';
    if (this.mode === 'statements') this.stmtShow(this.t.i);
  };
  Player.prototype.menuKey = function (e) {
    if (e.key === 'Escape') { e.preventDefault(); return this.closeMenu(); }
  };

  /* ========================================================= 起動 == */
  Player.prototype.start = function (sceneIndex) {
    var i = sceneIndex;
    if (i == null) {
      var hash = parseInt((location.hash || '').replace('#', ''), 10);
      i = isNaN(hash) ? 0 : hash;
    }
    this.goScene(i);
  };

  G.Player = Player;

  /* ケース読み込み ------------------------------------------------------ */
  G.boot = function (opts) {
    opts = opts || {};
    var root = document.getElementById('stage') || document.body.appendChild(h('div'));
    var qs = new URLSearchParams(location.search);
    var start = qs.has('scene') ? parseInt(qs.get('scene'), 10) : null;

    function run(data) {
      var p = new Player(root, data);
      G.player = p;
      if (qs.get('mute') === '1') G.sfx.mute(true);
      if (qs.get('notes') === '1') p.toggleNotes();
      if (qs.get('timer') === '1') p.toggleTimer();
      p.start(start);
    }
    function fail(msg) {
      root.innerHTML = '<div style="padding:6vh 6vw;font:600 2.2cqw/1.6 var(--font);color:#fff">' +
        '<h1 style="font-size:4cqw;margin-bottom:2cqh">ケースを読み込めませんでした</h1>' +
        '<p style="opacity:.8">' + msg + '</p>' +
        '<p style="opacity:.6;margin-top:2cqh">file:// で開いている場合は 1枚HTML版（dist/）を使ってください。</p></div>';
    }

    if (window.GIF_CASE) return run(window.GIF_CASE);
    if (opts.data) return run(opts.data);
    var url = qs.get('case') || opts.url;
    if (!url) return fail('?case=cases/xxx.json を指定してください。');
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return r.json();
    }).then(run).catch(function (err) { fail(String(err)); });
  };
})(window.GIF = window.GIF || {});
