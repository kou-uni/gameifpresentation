/* =========================================================================
   GAMEIF PRESENTATION — camera.js

   原作の芯は演出ではなくカメラにある。
   「誰の席から」「どの距離で」「どう動いて」見ているかが、台詞ごとに変わる。
   指摘の瞬間に寄り、切り返しで視点が飛び、追い詰めるときは煽りになる。
   ここが固定されたままだと、同じセリフでも“紙芝居”に落ちる。

   層の構造（内側ほど小さい動き）:
     #stage
       .cam      … カメラ本体。寄り・引き・ダッチ角・あおり（JSが transform を書く）
         .world  … 切り返しのホイップパン（CSSアニメーション。JSと衝突させない）
           .drift… 常時の微かな呼吸。静止画に見せないためだけの層
             .bg      … 視点のヨー角（どの席から見ているか）
             .actors
   ========================================================================= */
(function (G) {
  'use strict';

  /* ---- ショット（距離と角度）---------------------------------------- */
  /* oy = 寄りの支点（縦）。ここが肝。
     支点より下にあるものは、寄るほど下へ押し出される。顔の近くに支点を置くと、
     胸から下のジェスチャーがテキストボックスの裏へ消える。
     決めのショットほど支点を下げて、腕と手を画面に残す。 */
  var SHOT = {
    wide:    { s: 1.00, y: 0,    oy: 50, dutch: 0,    tiltX: 0 },   // 法廷全景
    mid:     { s: 1.18, y: 2.0,  oy: 56, dutch: 0,    tiltX: 0 },   // 既定。バストアップ
    close:   { s: 1.34, y: 2.0,  oy: 66, dutch: 0,    tiltX: 0 },   // 寄り。指摘・決め台詞
    extreme: { s: 1.70, y: 2.0,  oy: 64, dutch: 0,    tiltX: 0 },   // 極寄り。異議あり
    low:     { s: 1.26, y: 0,    oy: 78, dutch: 0,    tiltX: 6 },   // 煽り。追い詰める
    high:    { s: 1.10, y: -4.0, oy: 34, dutch: 0,    tiltX: -5 },  // 俯瞰。突き放す
    think:   { s: 1.40, y: 2.0,  oy: 62, dutch: -2.4, tiltX: 0 },   // 検討。わずかに傾ける
    gallery: { s: 1.02, y: -2.0, oy: 46, dutch: 1.5,  tiltX: -3 },  // 傍聴席。ざわめき

    /* --- 決めショット。原作で「ここだ」というときに出る画 --- */
    /* 決めショットは「寄りすぎない」。角度を作るのは絵のほうで、
       カメラが詰めすぎるとジェスチャーが画面外に出て、決めが消える。 */
    /* 指差しは「目線の高さ」。絵のほうが角度を持っているので、
       カメラまで煽ると二重にかかって絵と喧嘩する。傾きだけ少し足す。 */
    point:   { s: 1.30, y: 0,    oy: 76, dutch: -2.0, tiltX: 0 },   // 指差し
    slam:    { s: 1.36, y: 0,    oy: 82, dutch:  2.5, tiltX: 4 },   // 机を叩く
    shock:   { s: 1.38, y: 1.0,  oy: 70, dutch:  0,   tiltX: 0 },   // ガーン
    stare:   { s: 1.22, y: 1.0,  oy: 60, dutch:  0,   tiltX: 0 }    // 睨み合い
  };

  /* ---- 視点（どの席から見ているか）= 背景のヨー角 -------------------- */
  var ANGLE = {
    front:       0,
    defense:   -11,   // 弁護席の側から法廷を見る
    prosecution: 11,  // 検察席の側から
    witness:      0,  // 証言台の正面
    judge:       -4,
    gallery:      6
  };

  /* ---- カメラの動き（＝トランジションの質）--------------------------- */
  var MOVE = {
    cut:   { ms: 0,    ease: 'linear' },
    snap:  { ms: 320,  ease: 'cubic-bezier(.22,.9,.26,1)' },       // 既定
    punch: { ms: 150,  ease: 'cubic-bezier(.2,1.7,.35,1)' },       // 一気に寄る
    push:  { ms: 2400, ease: 'cubic-bezier(.16,.72,.24,1)' },      // 喋りながらじわ寄り
    pull:  { ms: 900,  ease: 'cubic-bezier(.2,.8,.3,1)' },         // 引く
    drift: { ms: 5200, ease: 'linear' }                            // ほぼ気づかない移動
  };

  function Camera(stage, cam, world, drift, bg) {
    this.stage = stage; this.cam = cam; this.world = world;
    this.drift = drift; this.bg = bg;
    this.state = { shot: 'mid', angle: 'front', origin: 50 };
    this._whipT = null;
  }

  /* 立ち絵の立ち位置に合わせて、寄りの中心をずらす */
  function originFor(side) {
    return side === 'left' ? 42 : side === 'right' ? 58 : 50;
  }

  Camera.prototype.set = function (o) {
    o = o || {};
    var shot = SHOT[o.shot] || SHOT.mid;
    var mv = MOVE[o.move] || MOVE.snap;
    var ox = o.origin != null ? o.origin : originFor(o.side);
    var dutch = (shot.dutch || 0) + (o.dutch || 0);

    this.cam.style.transformOrigin = ox + '% ' + (o.originY != null ? o.originY : (shot.oy || 56)) + '%';
    this.cam.style.transition = mv.ms ? 'transform ' + mv.ms + 'ms ' + mv.ease : 'none';
    this.cam.style.transform =
      (shot.tiltX ? 'perspective(1700px) rotateX(' + shot.tiltX + 'deg) ' : '') +
      'translate(' + (o.x || 0) + '%, ' + shot.y + '%) ' +
      'scale(' + (shot.s * (o.scale || 1)) + ') ' +
      (dutch ? 'rotate(' + dutch + 'deg)' : '');

    var yaw = o.yaw != null ? o.yaw : (ANGLE[o.angle] != null ? ANGLE[o.angle] : 0);
    this.bg.style.transition = 'transform ' + Math.max(mv.ms, 260) + 'ms ' + mv.ease;
    this.bg.style.transform = 'perspective(1500px) rotateY(' + yaw + 'deg) scale(' + (1 + Math.abs(yaw) / 110) + ')';

    this.state.shot = o.shot || 'mid';
    this.state.angle = o.angle || 'front';
    this.stage.dataset.shot = this.state.shot;   /* ビネットの濃さが画角に連動する */
  };

  /* 切り返し。視点が反対側へ飛ぶときの、速いパン。
     真ん中で中身を入れ替えるので、移動中に相手が現れたように見える。 */
  Camera.prototype.whip = function (dir, swap) {
    var w = this.world, self = this;
    clearTimeout(this._whipT);
    w.classList.remove('whip-l', 'whip-r');
    void w.offsetWidth;
    w.classList.add(dir < 0 ? 'whip-l' : 'whip-r');
    this._whipT = setTimeout(function () { if (swap) swap(); }, 130);
    setTimeout(function () { w.classList.remove('whip-l', 'whip-r'); }, 340);
  };

  Camera.prototype.reduced = function () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  /* ---- 台詞から自動でカメラを決める --------------------------------
     明示指定（line.shot / line.angle / line.move）が最優先。
     無ければ、何が起きている台詞かから決める。
     「重要な指摘のとき、検討のときに画角が変わる」を、書き手に負担させない。 */
  Camera.prototype.autoFor = function (line, side, prevSide) {
    var shot = line.shot, move = line.move, angle = line.angle, dutch = line.dutch || 0;

    if (!shot) {
      if (line.shout)                         shot = 'extreme';
      else if (line.pose === 'damage')        shot = 'shock';
      else if (line.pose === 'point')         shot = 'point';
      else if (line.pose === 'slam')          shot = 'slam';
      else if (line.pose === 'shock')         shot = 'close';
      else if (line.pose === 'think')         shot = 'think';
      else if (line.style === 'press')        shot = 'low';
      else if (line.style === 'testimony')    shot = 'mid';
      else                                    shot = 'mid';
    }
    if (!move) {
      if (line.shout || line.pose === 'damage' || line.pose === 'point'
          || line.pose === 'slam') move = 'punch';
      else if (shot === 'think' || line.style === 'press')               move = 'push';
      else if (side !== prevSide)                                        move = 'snap';
      else                                                               move = 'drift';
    }
    if (!angle) {
      /* 左の人物が喋るときは、検察席の側から見る。逆も同じ。
         見ている側が毎回入れ替わるのが、法廷ものの画の作り方。 */
      angle = side === 'left' ? 'prosecution'
            : side === 'right' ? 'defense'
            : 'front';
    }
    if (!line.dutch && (line.shout || line.pose === 'damage')) dutch = (side === 'right' ? 3 : -3);

    return { shot: shot, move: move, angle: angle, side: side, dutch: dutch };
  };

  /* じわ寄り。台詞を読んでいる間だけ、ゆっくり詰める。 */
  Camera.prototype.creep = function (side, amount) {
    if (this.reduced()) return;
    var cur = SHOT[this.state.shot] || SHOT.mid;
    var mv = MOVE.push;
    this.cam.style.transition = 'transform ' + mv.ms + 'ms ' + mv.ease;
    this.cam.style.transform = this.cam.style.transform.replace(
      /scale\(([\d.]+)\)/, function (m, s) { return 'scale(' + (parseFloat(s) * (amount || 1.06)) + ')'; });
  };

  G.Camera = Camera;
  G.CAMERA_SHOTS = Object.keys(SHOT);
  G.CAMERA_ANGLES = Object.keys(ANGLE);
  G.CAMERA_MOVES = Object.keys(MOVE);
})(window.GIF = window.GIF || {});
