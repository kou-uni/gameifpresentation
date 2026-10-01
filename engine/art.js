/* =========================================================================
   GAMEIF PRESENTATION — art.js
   立ち絵はパラメトリックSVGで生成する。既存ゲームの素材は一切使わない。
   cast の指定で色・髪型・衣装が変わる。画像を持っているなら img: で差し替え可。
   ========================================================================= */
(function (G) {
  'use strict';

  var cache = {};

  var PRESETS = {
    hero:       { outfit:'#1d3a8f', accent:'#e8e8ef', hair:'spike',  hairColor:'#1a1a22', tie:'#d33', skin:'#f6d5b8' },
    prosecutor: { outfit:'#6b1f2e', accent:'#f0dfa0', hair:'slick',  hairColor:'#c9c4cf', tie:'#2b2b33', skin:'#f3d0b4' },
    witness:    { outfit:'#2f6d4f', accent:'#e6e6dc', hair:'bob',    hairColor:'#4a2f1c', tie:'#e0b23c', skin:'#f8dcc2' },
    judge:      { outfit:'#15151c', accent:'#dcdce6', hair:'beard',  hairColor:'#e8e8ee', tie:'#8d1f2b', skin:'#f0cfb2' },
    assistant:  { outfit:'#7a3f86', accent:'#f2e3f5', hair:'long',   hairColor:'#2a1a2e', tie:'#ffd166', skin:'#fadfc8' },
    expert:     { outfit:'#26505e', accent:'#eaf4f7', hair:'short',  hairColor:'#22252b', tie:'#4fd6ff', skin:'#f4d6bb' },
    detective:  { outfit:'#8a6a34', accent:'#f0e6cf', hair:'messy',  hairColor:'#2b2015', tie:'#6b8f3a', skin:'#f2cfae' }
  };

  /* --- 髪型: 頭（cx=100, cy=86, r=42）に載せる path --- */
  function hair(style, c) {
    switch (style) {
      case 'spike': return '<path d="M58 78 Q60 40 100 38 Q142 40 144 80 L150 58 L142 40 L118 26 L96 34 L74 26 L62 44Z" fill="'+c+'"/>'
                         + '<path d="M58 78 Q62 46 100 44 Q140 46 144 80 L144 66 Q126 52 100 52 Q74 52 58 66Z" fill="'+c+'"/>';
      case 'slick': return '<path d="M56 82 Q58 40 100 38 Q144 40 146 84 Q146 62 130 54 Q112 62 96 54 Q74 50 60 68Z" fill="'+c+'"/>'
                         + '<path d="M146 84 Q160 120 150 152 Q142 122 142 96Z" fill="'+c+'"/>'
                         + '<path d="M56 82 Q42 118 50 150 Q58 120 58 96Z" fill="'+c+'"/>';
      case 'bob':   return '<path d="M52 92 Q52 38 100 36 Q148 38 148 92 L148 128 Q138 108 140 88 Q120 66 100 66 Q80 66 60 88 Q62 108 52 128Z" fill="'+c+'"/>';
      case 'long':  return '<path d="M52 92 Q52 36 100 34 Q148 36 148 92 L152 176 Q140 150 142 96 Q120 68 100 68 Q80 68 58 96 Q60 150 48 176Z" fill="'+c+'"/>';
      case 'short': return '<path d="M58 84 Q60 40 100 38 Q140 40 142 84 Q136 62 100 60 Q64 62 58 84Z" fill="'+c+'"/>';
      case 'messy': return '<path d="M56 84 Q54 40 100 36 Q146 40 144 86 L152 62 L138 50 L122 58 L108 44 L92 58 L76 46 L62 58Z" fill="'+c+'"/>';
      case 'beard': return '<path d="M56 82 Q58 40 100 38 Q142 40 144 82 Q134 60 100 58 Q66 60 56 82Z" fill="'+c+'"/>'
                         + '<path d="M62 104 Q64 156 100 162 Q136 156 138 104 Q126 132 100 132 Q74 132 62 104Z" fill="'+c+'"/>';
      case 'none':  return '';
      default:      return '<path d="M58 84 Q60 40 100 38 Q140 40 142 84 Q136 62 100 60 Q64 62 58 84Z" fill="'+c+'"/>';
    }
  }

  /* --- 表情 --- */
  function face(pose, p) {
    var eyes, mouth, brow = '', extra = '';
    switch (pose) {
      case 'confident':
        eyes  = '<path d="M74 92 q10 -7 20 0" stroke="#1a1a22" stroke-width="4" fill="none" stroke-linecap="round"/>'
              + '<path d="M106 92 q10 -7 20 0" stroke="#1a1a22" stroke-width="4" fill="none" stroke-linecap="round"/>';
        mouth = '<path d="M88 116 q12 8 24 -2" stroke="#8a3b34" stroke-width="4" fill="none" stroke-linecap="round"/>';
        brow  = '<path d="M72 80 l22 4 M128 80 l-22 4" stroke="#1a1a22" stroke-width="4" stroke-linecap="round"/>';
        break;
      case 'shock':
        eyes  = '<circle cx="84" cy="94" r="9" fill="#fff"/><circle cx="84" cy="94" r="4.5" fill="#1a1a22"/>'
              + '<circle cx="116" cy="94" r="9" fill="#fff"/><circle cx="116" cy="94" r="4.5" fill="#1a1a22"/>';
        mouth = '<ellipse cx="100" cy="120" rx="11" ry="9" fill="#7a2a24"/>';
        brow  = '<path d="M72 76 l22 -2 M128 76 l-22 -2" stroke="#1a1a22" stroke-width="4" stroke-linecap="round"/>';
        extra = '<path d="M150 74 q8 12 0 20 q-8 -8 0 -20Z" fill="#7fd3ff" opacity=".9"/>';
        break;
      case 'damage':
        eyes  = '<path d="M76 88 l16 14 M92 88 l-16 14" stroke="#1a1a22" stroke-width="4" stroke-linecap="round"/>'
              + '<path d="M108 88 l16 14 M124 88 l-16 14" stroke="#1a1a22" stroke-width="4" stroke-linecap="round"/>';
        mouth = '<path d="M86 120 q14 -10 28 0 q-14 10 -28 0Z" fill="#7a2a24"/>';
        extra = '<path d="M152 72 q9 14 0 23 q-9 -9 0 -23Z" fill="#7fd3ff"/>'
              + '<path d="M44 84 q9 14 0 23 q-9 -9 0 -23Z" fill="#7fd3ff"/>';
        break;
      case 'think':
        eyes  = '<path d="M74 96 q10 6 20 0" stroke="#1a1a22" stroke-width="4" fill="none" stroke-linecap="round"/>'
              + '<path d="M106 96 q10 6 20 0" stroke="#1a1a22" stroke-width="4" fill="none" stroke-linecap="round"/>';
        mouth = '<path d="M90 118 l20 0" stroke="#8a3b34" stroke-width="4" stroke-linecap="round"/>';
        break;
      case 'talk':
        eyes  = '<ellipse cx="84" cy="94" rx="5.5" ry="7" fill="#1a1a22"/><ellipse cx="116" cy="94" rx="5.5" ry="7" fill="#1a1a22"/>';
        mouth = '<ellipse cx="100" cy="119" rx="9" ry="6.5" fill="#7a2a24"/>';
        break;
      case 'sweat':
        eyes  = '<ellipse cx="84" cy="94" rx="5" ry="6" fill="#1a1a22"/><ellipse cx="116" cy="94" rx="5" ry="6" fill="#1a1a22"/>';
        mouth = '<path d="M88 120 q12 -7 24 0" stroke="#8a3b34" stroke-width="4" fill="none" stroke-linecap="round"/>';
        extra = '<path d="M150 76 q8 12 0 20 q-8 -8 0 -20Z" fill="#7fd3ff" opacity=".9"/>';
        break;
      default: /* normal */
        eyes  = '<ellipse cx="84" cy="94" rx="5.5" ry="7.5" fill="#1a1a22"/><ellipse cx="116" cy="94" rx="5.5" ry="7.5" fill="#1a1a22"/>';
        mouth = '<path d="M90 118 q10 5 20 0" stroke="#8a3b34" stroke-width="4" fill="none" stroke-linecap="round"/>';
    }
    return brow + eyes + mouth + extra;
  }

  /* --- 腕（ポーズ） --- */
  function arms(pose, p) {
    var sleeve = p.outfit, hand = p.skin;
    /* 指差し: 体を横切って斜めに。手は胸の高さで、頭より小さい。
       （docs/ILLUSTRATION-PROMPTS.md の POSE point と同じ仕様） */
    if (pose === 'point')
      return '<path d="M124 196 q-40 -8 -70 16 l10 22 q30 -18 64 -14Z" fill="'+sleeve+'"/>'
           + '<circle cx="46" cy="222" r="17" fill="'+hand+'"/>'
           + '<path d="M40 214 l-30 -12 l-4 12 l30 12Z" fill="'+hand+'"/>'
           + '<path d="M76 212 q28 16 48 10 l-4 18 q-28 4 -52 -12Z" fill="'+sleeve+'"/>';
    /* 机バン: 両手を画面下端に。顔は隠さない */
    if (pose === 'slam')
      return '<path d="M126 206 q44 14 60 56 l-22 10 q-14 -34 -48 -44Z" fill="'+sleeve+'"/>'
           + '<path d="M74 206 q-44 14 -60 56 l22 10 q14 -34 48 -44Z" fill="'+sleeve+'"/>'
           + '<ellipse cx="172" cy="282" rx="20" ry="14" fill="'+hand+'"/>'
           + '<ellipse cx="28" cy="282" rx="20" ry="14" fill="'+hand+'"/>';
    if (pose === 'think')
      return '<path d="M124 216 q40 -6 54 -34 l20 10 q-18 42 -66 48Z" fill="'+sleeve+'"/>'
           + '<circle cx="176" cy="178" r="14" fill="'+hand+'"/>';
    if (pose === 'shock' || pose === 'damage')
      return '<path d="M68 214 q-36 -6 -50 -44 l-20 10 q16 54 66 62Z" fill="'+sleeve+'"/>'
           + '<path d="M132 214 q40 -8 56 -42 l20 12 q-20 46 -70 56Z" fill="'+sleeve+'"/>'
           + '<circle cx="186" cy="182" r="14" fill="'+hand+'"/><circle cx="8" cy="182" r="14" fill="'+hand+'"/>';
    /* normal */
    return '<path d="M126 214 q30 20 32 76 l-24 4 q-4 -48 -22 -66Z" fill="'+sleeve+'"/>'
         + '<path d="M74 214 q-30 20 -32 76 l24 4 q4 -48 22 -66Z" fill="'+sleeve+'"/>'
         + '<circle cx="146" cy="300" r="14" fill="'+hand+'"/><circle cx="54" cy="300" r="14" fill="'+hand+'"/>';
  }

  /* --- 立ち絵本体 --- */
  function portrait(def, pose) {
    def = def || {};
    var base = PRESETS[def.art] || PRESETS[def.preset] || PRESETS.witness;
    var p = {
      outfit:    def.outfit    || base.outfit,
      accent:    def.accentCol || base.accent,
      hair:      def.hair      || base.hair,
      hairColor: def.hairColor || base.hairColor,
      tie:       def.tie       || base.tie,
      skin:      def.skin      || base.skin
    };
    var key = JSON.stringify(p) + '|' + pose;
    if (cache[key]) return cache[key];

    var svg =
      '<svg viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">' +
      /* 体 */
      '<path d="M100 150 q-44 6 -52 48 L38 340 L162 340 L152 198 q-8 -42 -52 -48Z" fill="' + p.outfit + '"/>' +
      /* 襟とシャツ */
      '<path d="M100 152 L78 176 L100 236 L122 176Z" fill="' + p.accent + '"/>' +
      '<path d="M100 158 L92 178 L100 216 L108 178Z" fill="' + p.tie + '"/>' +
      '<path d="M78 172 q-10 14 -12 34 l14 6 q2 -24 10 -34Z" fill="' + p.accent + '" opacity=".55"/>' +
      '<path d="M122 172 q10 14 12 34 l-14 6 q-2 -24 -10 -34Z" fill="' + p.accent + '" opacity=".55"/>' +
      arms(pose, p) +
      /* 首・頭 */
      '<rect x="90" y="138" width="20" height="22" fill="' + p.skin + '"/>' +
      '<ellipse cx="100" cy="98" rx="42" ry="46" fill="' + p.skin + '"/>' +
      '<ellipse cx="58" cy="102" rx="7" ry="10" fill="' + p.skin + '"/>' +
      '<ellipse cx="142" cy="102" rx="7" ry="10" fill="' + p.skin + '"/>' +
      hair(p.hair, p.hairColor) +
      face(pose, p) +
      '</svg>';
    cache[key] = svg;
    return svg;
  }

  /* --- 紋章（法廷背景） --- */
  function emblem(color) {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="50" cy="50" r="46" fill="none" stroke="' + (color || '#f0c23c') + '" stroke-width="3"/>' +
      '<path d="M50 18 L50 74 M30 30 L70 30" stroke="' + (color || '#f0c23c') + '" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M30 30 L20 52 L40 52Z M70 30 L60 52 L80 52Z" fill="none" stroke="' + (color || '#f0c23c') + '" stroke-width="3"/>' +
      '<path d="M34 78 L66 78" stroke="' + (color || '#f0c23c') + '" stroke-width="5" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* --- 証拠品の既定アイコン --- */
  function evidenceIcon(kind) {
    var c = '#3a2e18';
    var body = {
      doc:   '<rect x="18" y="8" width="44" height="64" rx="3" fill="#fff" stroke="'+c+'" stroke-width="3"/><path d="M26 24h28M26 34h28M26 44h20" stroke="'+c+'" stroke-width="3"/>',
      chart: '<rect x="10" y="10" width="60" height="60" rx="3" fill="#fff" stroke="'+c+'" stroke-width="3"/><path d="M20 58V40M34 58V26M48 58V34M60 58V20" stroke="#c0392b" stroke-width="6" stroke-linecap="round"/>',
      photo: '<rect x="10" y="16" width="60" height="48" rx="3" fill="#cfe3ef" stroke="'+c+'" stroke-width="3"/><circle cx="30" cy="34" r="7" fill="#f5c542"/><path d="M14 60l18-18 12 12 10-8 12 14Z" fill="#6aa96a"/>',
      quote: '<rect x="12" y="12" width="56" height="56" rx="6" fill="#fff" stroke="'+c+'" stroke-width="3"/><text x="40" y="56" font-size="44" text-anchor="middle" fill="'+c+'" font-family="serif">&#8220;</text>',
      code:  '<rect x="8" y="14" width="64" height="52" rx="4" fill="#15181f"/><path d="M26 32l-8 8 8 8M54 32l8 8-8 8M44 28l-8 24" stroke="#5ef08a" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
      thing: '<path d="M40 8l28 16v32L40 72 12 56V24Z" fill="#d9c9a3" stroke="'+c+'" stroke-width="3"/>'
    }[kind || 'doc'] || '';
    return '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
  }

  G.art = { portrait: portrait, emblem: emblem, evidenceIcon: evidenceIcon, presets: PRESETS };
})(window.GIF = window.GIF || {});
