#!/usr/bin/env node
/* =========================================================================
   art-import.mjs — 生成した立ち絵を取り込む。

   Grok / ChatGPT から出てくる絵は、たいてい #FF00FF のマゼンタ背景つきです。
   それを抜いて、余白を切り詰めて、所定の場所に置くところまでやります。
   プレビュー.app を手で開く工程を消すためのツールです。

   依存は増やしません。画像処理は headless Chrome の canvas でやります
   （スモークテストで既に使っているので、新しく入れるものがない）。

     node tools/art-import.mjs <画像ファイル> <スロット> <ポーズ>
     例: node tools/art-import.mjs ~/Downloads/point.png a point

   オプション:
     --keep-bg      背景を抜かない（もともと透過している絵）
     --color=RRGGBB 抜く色を指定（既定 FF00FF）
     --tol=90       色の許容幅（既定 90。にじみが残るなら上げる）
   ========================================================================= */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const argv = process.argv.slice(2);
const flags = argv.filter(a => a.startsWith('--'));
const args = argv.filter(a => !a.startsWith('--'));
const [srcArg, slot, pose] = args;

if (!srcArg || !slot || !pose) {
  console.error(`使い方: node tools/art-import.mjs <画像> <スロット> <ポーズ>
  例:    node tools/art-import.mjs ~/Downloads/point.png a point

  スロット: a(主張する人) b(反論する人) c(裁定する人) d(語る人) e(相棒)
  ポーズ:   normal talk confident think sweat shock damage point slam

  オプション: --keep-bg  --color=RRGGBB  --tol=90`);
  process.exit(1);
}
const src = resolve(process.cwd(), srcArg);
if (!existsSync(src)) { console.error(`ありません: ${src}`); process.exit(2); }

const keepBg = flags.includes('--keep-bg');
const color = (flags.find(f => f.startsWith('--color=')) || '--color=FF00FF').split('=')[1];
const tol = parseInt((flags.find(f => f.startsWith('--tol=')) || '--tol=90').split('=')[1], 10);
const key = [parseInt(color.slice(0,2),16), parseInt(color.slice(2,4),16), parseInt(color.slice(4,6),16)];

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
].find(existsSync);
if (!CHROME) { console.error('Chrome 系が見つかりません'); process.exit(2); }

const MIME = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
               '.webp':'image/webp', '.gif':'image/gif' };
const mime = MIME[extname(src).toLowerCase()];
if (!mime) { console.error(`未対応の形式: ${extname(src)}`); process.exit(2); }

const CDP = 9347;
const profile = mkdtempSync(join(tmpdir(), 'gif-art-'));
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--mute-audio',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP}`, 'about:blank'], { stdio: 'ignore' });
const done = (code) => { try { chrome.kill(); } catch {} process.exit(code); };

(async () => {
  let wsUrl;
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
      const p = l.find(t => t.type === 'page');
      if (p) { wsUrl = p.webSocketDebuggerUrl; break; }
    } catch {}
    await sleep(250);
  }
  if (!wsUrl) { console.error('Chrome に繋がりません'); done(2); }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const waiting = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) {
      const { res, rej } = waiting.get(m.id); waiting.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; waiting.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expression, awaitPromise = true) =>
    (await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })).result.value;

  await send('Runtime.enable');
  const dataUri = `data:${mime};base64,${readFileSync(src).toString('base64')}`;

  const out = await ev(`(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(dataUri)};
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, w, h), p = d.data;
    const key = ${JSON.stringify(key)}, tol = ${tol}, keepBg = ${keepBg};
    let removed = 0;
    if (!keepBg) {
      for (let i = 0; i < p.length; i += 4) {
        const dr = p[i] - key[0], dg = p[i+1] - key[1], db = p[i+2] - key[2];
        const dist = Math.sqrt(dr*dr + dg*dg + db*db);
        if (dist < tol) { p[i+3] = 0; removed++; }
        else if (dist < tol * 1.8) {            /* 縁のにじみを半透明に落とす */
          p[i+3] = Math.round(p[i+3] * ((dist - tol) / (tol * 0.8)));
        }
      }
      x.putImageData(d, 0, 0);
    }
    /* 透明な余白を切り詰める。立ち絵の高さを揃えるため */
    const dd = x.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      if (dd[(yy*w + xx)*4 + 3] > 12) {
        if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
        if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      }
    }
    if (x1 < 0) return { error: '全部透明になりました。--tol を下げるか --color を見直してください' };
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
    c2.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
    return { png: c2.toDataURL('image/png').split(',')[1],
             w, h, cw, ch, removed, ratio: Math.round(removed / (w*h) * 100) };
  })()`);

  if (!out || out.error) { console.error('❌ ' + (out?.error || '変換に失敗しました')); done(1); }

  const dir = join(ROOT, 'assets', 'chars', slot);
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, pose + '.png');
  writeFileSync(outPath, Buffer.from(out.png, 'base64'));

  /* ケースJSONは cases/ にあるので、そこからの相対で書く */
  const rel = `../assets/chars/${slot}/${pose}.png`;
  console.log(`✅ ${rel}`);
  console.log(`   元 ${out.w}×${out.h} → 余白を切って ${out.cw}×${out.ch}`);
  if (!keepBg) console.log(`   背景を抜いた割合 ${out.ratio}%` +
    (out.ratio < 5 ? '　⚠️ ほとんど抜けていません。--color を確認してください' : ''));
  console.log(`\nケースJSONに書く:`);
  if (pose === 'normal') console.log(`   "img": "${rel}"`);
  else console.log(`   "poses": { "${pose}": "${rel}" }`);
  console.log(`   向きが相手と逆なら: { "src": "${rel}", "flip": true }`);
  done(0);
})().catch(e => { console.error('❌ ' + e.message); done(2); });
