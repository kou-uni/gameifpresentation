#!/usr/bin/env node
/* =========================================================================
   build.mjs — ケースを「1枚のHTML」に焼き込む。
   なぜ必要か: USBで持ち込む / 会場のネットが死ぬ / file:// で開く、を通すため。
   CSS・JS・ケースJSON・assets/ 配下の画像を全部インラインにする。外部参照ゼロ。

   使い方:
     node tools/build.mjs                 # cases/*.json を全部 dist/ に
     node tools/build.mjs cases/x.json    # 1本だけ
   ========================================================================= */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.avif': 'image/avif'
};

/** ケースJSON内の assets/... 参照を data URI に置き換える */
function inlineAssets(caseObj) {
  const json = JSON.stringify(caseObj);
  const missing = [];
  const out = json.replace(/"((?:\.\.\/)*assets\/[^"]+?)"/g, (m, p) => {
    const rel = p.replace(/^(\.\.\/)+/, '');
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) { missing.push(rel); return m; }
    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
    const mime = MIME[ext];
    if (!mime) { missing.push(rel + ' (未対応の拡張子)'); return m; }
    const b64 = readFileSync(abs).toString('base64');
    return JSON.stringify(`data:${mime};base64,${b64}`);
  });
  return { json: out, missing };
}

/* Artifact（claude.ai）用: doctype/html/head/body を持たない本体だけの版。
   外からスマホで開きたいときの入口。外部参照ゼロなので CSP にも当たらない。 */
function buildArtifact(casePath) {
  const caseObj = JSON.parse(read(casePath));
  const { json } = inlineAssets(caseObj);
  const css = read('engine/theme.css');
  const js = ['engine/sfx.js', 'engine/art.js', 'engine/camera.js', 'engine/engine.js'].map(read).join('\n');
  const name = (caseObj.meta && caseObj.meta.artifactTitle)
    || (caseObj.meta && caseObj.meta.title || basename(casePath, '.json')).replace(/<[^>]+>/g, '');
  const html = `<title>${name}</title>
<style>
${css}
</style>
<div id="stage"></div>
<script>
${js}
</script>
<script id="gif-case" type="application/json">${json.replace(/<\//g, '<\\/')}</script>
<script>
window.GIF_CASE = JSON.parse(document.getElementById('gif-case').textContent);
GIF.boot();
</script>
`;
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  const outName = basename(casePath, '.json') + '.artifact.html';
  writeFileSync(join(ROOT, 'dist', outName), html, 'utf8');
  console.log(`  dist/${outName}  ${(Buffer.byteLength(html)/1024).toFixed(0)} KB  (artifact用)`);
}

function buildOne(casePath) {
  const caseObj = JSON.parse(read(casePath));
  const { json, missing } = inlineAssets(caseObj);

  const css = read('engine/theme.css');
  const js = ['engine/sfx.js', 'engine/art.js', 'engine/camera.js', 'engine/engine.js'].map(read).join('\n');
  const title = (caseObj.meta && caseObj.meta.title) || basename(casePath, '.json');

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${title.replace(/<[^>]+>/g, '')}</title>
<meta name="generator" content="GAMEIF PRESENTATION (single-file build)">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23101d3a'/%3E%3Cpath d='M50 20v56M30 32h40M30 32L20 54h20zM70 32L60 54h20zM34 80h32' stroke='%23f0c23c' stroke-width='6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E">
<style>
${css}
</style>
</head>
<body>
<div id="stage"></div>
<script>
${js}
</script>
<script id="gif-case" type="application/json">${json.replace(/<\//g, '<\\/')}</script>
<script>
window.GIF_CASE = JSON.parse(document.getElementById('gif-case').textContent);
GIF.boot();
</script>
</body>
</html>
`;
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  const outName = basename(casePath, '.json') + '.html';
  writeFileSync(join(ROOT, 'dist', outName), html, 'utf8');
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`  dist/${outName}  ${kb} KB  (scenes: ${caseObj.scenes.length})`);
  if (missing.length) console.log(`    ⚠️ インラインできなかった参照: ${missing.join(', ')}`);
  return outName;
}

const argv = process.argv.slice(2);
const artifactMode = argv.includes('--artifact');
const args = argv.filter(a => a !== '--artifact');
const targets = args.length
  ? args
  : readdirSync(join(ROOT, 'cases')).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => 'cases/' + f);

console.log('GAMEIF PRESENTATION — single-file build');
if (artifactMode) { targets.forEach(buildArtifact); process.exit(0); }
const built = targets.map(buildOne);

/* dist/index.html = 1枚HTMLの一覧（配布フォルダだけ渡しても迷わないように） */
const list = built.map(f => `<li><a href="${f}">${f}</a></li>`).join('');
writeFileSync(join(ROOT, 'dist', 'index.html'), `<!doctype html><html lang="ja"><head>
<meta charset="utf-8"><title>GAMEIF — 1枚HTML版</title>
<style>body{background:#0b1224;color:#eef2f8;font:600 16px/1.9 "Hiragino Sans",system-ui,sans-serif;padding:8vh 6vw}
h1{font-size:1.8rem;margin-bottom:1rem}a{color:#f0c23c}li{margin:.4rem 0}
p{opacity:.75;font-weight:400;max-width:40rem}</style></head><body>
<h1>GAMEIF PRESENTATION — 1枚HTML版</h1>
<p>それぞれ単体で完結しています。USBに入れても、ネットが無くても、file:// で開いても動きます。</p>
<ul>${list}</ul></body></html>
`, 'utf8');
console.log(`  dist/index.html  (${built.length} 本)`);
