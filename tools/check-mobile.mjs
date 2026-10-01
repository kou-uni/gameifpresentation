#!/usr/bin/env node
/* =========================================================================
   check-mobile.mjs — スマホで開いたときの画面崩れを検出する。

   「時々バグります」と報告が出た種類の壊れ方を、毎回機械的に見る。
   実際に出た不具合は2つ：
     - 画面の部品が position:fixed でステージの外へ飛んでいた
     - 縦画面でステージが細い帯になり、本文が 12px になっていた
   どちらも PC では一度も再現しない。だから計測する側を用意する。

     node tools/check-mobile.mjs [URL or ローカル]
   ========================================================================= */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const selfTest = process.argv.includes('--self-test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/* CDP は WebSocket で叩く。グローバル WebSocket は Node 22 以降にしか無い */
if (typeof WebSocket === 'undefined') {
  console.error(`このツールは Node 22 以上が要ります（いまは ${process.version}）。
  理由: ブラウザを CDP で操作するのに、グローバル WebSocket を使っています。`);
  process.exit(2);
}

const PORT = 8843, CDP = 9355;
const MIN_FONT = 18;          /* 本文がこれより小さいと、手元でも読めない */

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium', '/usr/bin/chromium-browser'
].filter(Boolean).find(existsSync);
if (!CHROME) { console.error('Chrome 系が見つかりません'); process.exit(2); }

const server = spawn(process.execPath, [join(ROOT, 'tools/serve.mjs')],
  { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const profile = mkdtempSync(join(tmpdir(), 'gif-mobile-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--mute-audio',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP}`, 'about:blank'], { stdio: 'ignore' });
const done = (c) => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} process.exit(c); };

/* --self-test: わざと壊した要素を入れて、検出器が鳴るかを確かめる。
   一度も鳴ったことのない警報は、警報ではない。 */
const BREAK_IT = `(() => {
  const d = document.createElement('div');
  d.className = 'self-test-stray';
  d.textContent = 'X';
  d.style.cssText = 'position:fixed;left:2px;top:2px;width:40px;height:20px;z-index:999';
  document.getElementById('stage').appendChild(d);
  /* 画面の外に出すため、ステージの transform による封じ込めを外す */
  document.getElementById('stage').style.transform = 'none';
  return true;
})()`;

/* ステージの外へ出た部品と、小さすぎる文字を探す */
const PROBE = `(() => {
  const st = document.getElementById('stage');
  const b = st.getBoundingClientRect();
  const strays = [];
  document.querySelectorAll('#stage *').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.top < b.top - 2 || r.bottom > b.bottom + 2 ||
        r.left < b.left - 2 || r.right > b.right + 2) {
      strays.push((el.className || el.tagName) + ' @' + Math.round(r.x) + ',' + Math.round(r.y));
    }
  });
  const line = document.querySelector('.line');
  return {
    vw: innerWidth, vh: innerHeight,
    stage: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
    fill: Math.round(b.width * b.height / (innerWidth * innerHeight) * 100),
    rot: st.dataset.rot || '0',
    fontPx: line ? +parseFloat(getComputedStyle(line).fontSize).toFixed(1) : null,
    strays,
    orientShown: !!document.querySelector('.orient.show'),
    rotToggle: !!document.querySelector('.rot-toggle.show')
  };
})()`;

(async () => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/cases/index.json`)).ok) break; } catch {}
    await sleep(200);
  }
  let wsUrl;
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
      const p = l.find(t => t.type === 'page');
      if (p) { wsUrl = p.webSocketDebuggerUrl; break; }
    } catch {}
    await sleep(250);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise(r => { ws.onopen = r; });
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
  const ev = async (e, a = false) =>
    (await send('Runtime.evaluate', { expression: e, awaitPromise: a, returnByValue: true })).result.value;

  await send('Runtime.enable'); await send('Page.enable');
  const url = `http://127.0.0.1:${PORT}/player/index.html?case=../cases/demo-quantum.json&mute=1`;

  const cases = [
    { name: 'iPhone 縦',          w: 390, h: 844, rotate: false },
    { name: 'iPhone 縦（回転）',  w: 390, h: 844, rotate: true  },
    { name: 'iPhone 横',          w: 844, h: 390, rotate: false },
    { name: '小さめ Android 縦',  w: 360, h: 780, rotate: true  },
    { name: 'タブレット 横',      w: 1024, h: 768, rotate: false }
  ];

  let fail = 0;
  console.log('GAMEIF PRESENTATION — スマホ表示の検査' +
    (selfTest ? '（自己テスト: わざと壊すので、全件 ❌ になるのが正常）' : '') + '\n');
  for (const c of cases) {
    await send('Emulation.setDeviceMetricsOverride',
      { width: c.w, height: c.h, deviceScaleFactor: 2, mobile: c.w < 900 });
    await send('Page.navigate', { url });
    await sleep(1400);
    await ev(`GIF.player && (GIF.player.meta.typeSpeed=0, GIF.sfx.mute(true), GIF.player.goScene(4))`);
    await sleep(400);
    await ev(`(async()=>{const p=GIF.player,k=x=>document.dispatchEvent(new KeyboardEvent('keydown',{key:x,bubbles:true}));
      const w=m=>new Promise(r=>setTimeout(r,m)); for(let i=0;i<12&&p.mode!=='statements';i++){k(' ');await w(60)} })()`, true);
    if (c.rotate) { await ev(`GIF.player.setRotated(true)`); await sleep(350); }
    if (selfTest) { await ev(BREAK_IT); await sleep(150); }
    await sleep(250);

    const r = await ev(PROBE);
    const problems = [];
    if (r.strays.length) problems.push(`ステージの外に出た部品: ${r.strays.join(', ')}`);
    if (r.fontPx != null && r.fontPx < MIN_FONT && !r.orientShown)
      problems.push(`本文が ${r.fontPx}px — 小さすぎる（${MIN_FONT}px 以上、または回転の案内を出すこと）`);
    if (r.stage.w <= 0 || r.stage.h <= 0) problems.push('ステージの大きさがゼロ');
    if (r.stage.x < -1 || r.stage.y < -1) problems.push(`ステージが画面外にはみ出している (${r.stage.x},${r.stage.y})`);

    const ok = problems.length === 0;
    if (!ok) fail++;
    console.log(`${ok ? '✅' : '❌'} ${c.name}  ${c.w}x${c.h}${c.rotate ? '（回転あり）' : ''}`);
    console.log(`     ステージ ${r.stage.w}x${r.stage.h}（画面の ${r.fill}%）  本文 ${r.fontPx}px` +
                `  案内 ${r.orientShown ? '出す' : '出さない'}  回転ボタン ${r.rotToggle ? 'あり' : 'なし'}`);
    problems.forEach(m => console.log(`     ⚠️ ${m}`));
  }
  if (selfTest) {
    const ok = fail === cases.length;
    console.log(`\n${ok ? '✅ 検出器は鳴ります（' + fail + '/' + cases.length + ' 件を検出）'
                       : '❌ 検出器が鳴りません。これでは守れていません（' + fail + '/' + cases.length + '）'}`);
    return done(ok ? 0 : 1);
  }
  console.log(`\n${fail ? '❌ ' + fail + ' 件' : '✅ 問題なし'}`);
  done(fail ? 1 : 0);
})().catch(e => { console.error('❌ ' + e.message); done(2); });
