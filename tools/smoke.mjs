#!/usr/bin/env node
/* =========================================================================
   smoke.mjs — 実際のブラウザでケースを頭から最後まで通す。
   キーボードイベントを本当に投げるので、入力バインドごと検査できる。
   スクリーンショットを dist/shots/ に落とすので、見た目も目で確認できる。

     node tools/smoke.mjs                       # demo-quantum を通す
     node tools/smoke.mjs cases/x.json
   ========================================================================= */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const casePath = process.argv[2] || 'cases/demo-quantum.json';
const PORT = 8791, CDP = 9333;

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
].find(existsSync);
if (!CHROME) { console.error('Chrome 系が見つかりません'); process.exit(2); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---- 静的サーバ ---- */
const server = spawn(process.execPath, [join(ROOT, 'tools/serve.mjs')],
  { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });

/* ---- Chrome ---- */
const profile = mkdtempSync(join(tmpdir(), 'gif-smoke-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--mute-audio', '--window-size=1600,900',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP}`, 'about:blank'
], { stdio: 'ignore' });

function cleanup(code) { try { chrome.kill(); } catch {} try { server.kill(); } catch {} process.exit(code); }
process.on('SIGINT', () => cleanup(130));

/* ---- 最小CDPクライアント ---- */
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); this.handlers = {};
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.waiting.has(m.id)) {
        const { res, rej } = this.waiting.get(m.id); this.waiting.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method && this.handlers[m.method]) this.handlers[m.method].forEach(f => f(m.params));
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.waiting.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.waiting.has(id)) { this.waiting.delete(id); rej(new Error('timeout ' + method)); } }, 30000);
    });
  }
  on(method, fn) { (this.handlers[method] ||= []).push(fn); }
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/cases/index.json`); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error(`ローカルサーバが :${PORT} で立ちません`);
}

async function getPageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome の DevTools に繋がりません');
}

/* ---- ページ内で走る踏破ロジック ---- */
const WALK = `(async () => {
  const p = GIF.player;
  const log = [];
  p.meta.typeSpeed = 0;              // 文字送りを即時に
  GIF.sfx.mute(true);
  let finished = false;
  const origFinish = p.finish.bind(p);
  p.finish = function () { finished = true; return origFinish(); };

  const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  let steps = 0, pressed = 0, presented = 0, wrongTried = 0, guard = 0;
  let lastScene = -1;

  while (!finished && steps < 900) {
    steps++;
    if (p._ended) { finished = true; break; }   // 最後が verdict のケースはそこで止まる
    const m = p.mode, si = p.sceneIndex;
    if (si !== lastScene) { log.push('scene ' + si + ' / ' + (p.scenes[si].type) + ' / ' + (p.scenes[si].chapter || '')); lastScene = si; guard = 0; }
    guard++;
    if (guard > 200) { log.push('!! シーン ' + si + ' から抜け出せない'); break; }

    if (m === 'statements') {
      const st = p.t.sc.statements[p.t.i];
      if (st.press && st.press.length && !st.__pressed) {
        st.__pressed = true; pressed++; key('P'); await wait(30); continue;
      }
      if (st.weak && !p.t.solved[p.t.i]) {
        if (!wrongTried) {                       // 一度だけ「外す」経路も通す
          wrongTried = 1;
          const wrongId = (p.evidence.find(e => p.owned[e.id] && e.id !== st.weak.evidence) || {}).id;
          if (wrongId) { p.present(wrongId); await wait(60); continue; }
        }
        key('E'); await wait(30);
        if (p.mode !== 'record') { log.push('!! 法廷記録が開かない (scene ' + si + ')'); break; }
        const idx = p.r.list.findIndex(e => e.id === st.weak.evidence);
        if (idx < 0) { log.push('!! 証拠 ' + st.weak.evidence + ' を所持していない (scene ' + si + ')'); break; }
        key(String(idx + 1)); presented++;
        await wait(1400);                        // shout の演出待ち
        continue;
      }
      key('ArrowRight'); await wait(20); continue;
    }

    if (m === 'choices') {
      const i = p.c.sc.options.findIndex(o => o.correct);
      key(String(i + 1)); await wait(1300); continue;
    }

    if (m === 'record') { key('Escape'); await wait(30); continue; }

    key(' '); await wait(40);
  }

  finished = finished || !!p._ended;
  return {
    finished, steps, pressed, presented, wrongTried,
    life: p.life, lifeMax: p.lifeMax, solved: p.stats.solved, wrong: p.stats.wrong,
    scenesVisited: lastScene + 1, totalScenes: p.scenes.length, log
  };
})()`;

/* ---- 本体 ---- */
(async () => {
  await waitForServer();
  const wsUrl = await getPageTarget();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new Cdp(ws);

  const consoleErrors = [], exceptions = [];
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning') {
      consoleErrors.push(p.type + ': ' + p.args.map(a => a.value ?? a.description ?? a.type).join(' '));
    }
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    exceptions.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

  const url = `http://127.0.0.1:${PORT}/player/index.html?case=../${casePath}&mute=1`;
  const loaded = new Promise(res => cdp.on('Page.loadEventFired', res));
  await cdp.send('Page.navigate', { url });
  await loaded;
  await sleep(700);

  const shotDir = join(ROOT, 'dist', 'shots');
  mkdirSync(shotDir, { recursive: true });
  const shot = async (name) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(shotDir, name + '.png'), Buffer.from(data, 'base64'));
    return name + '.png';
  };

  /* ケースが読めたか */
  const booted = await cdp.send('Runtime.evaluate', {
    expression: '!!(window.GIF && GIF.player && GIF.player.scenes && GIF.player.scenes.length)',
    returnByValue: true
  });
  if (!booted.result.value) {
    const dom = await cdp.send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,400)', returnByValue: true });
    console.error('❌ ケースを読み込めませんでした\n' + dom.result.value);
    await shot('00-failed'); cleanup(1);
  }

  const shots = [];
  const key = (k) => cdp.send('Runtime.evaluate', {
    expression: `document.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}))`,
    returnByValue: true });
  const evalIn = (expr) => cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true });

  await evalIn('GIF.player.meta.typeSpeed=0; GIF.sfx.mute(true)');
  shots.push(await shot('01-title'));

  /* スライド（講義パート） */
  await evalIn('GIF.player.goScene(2)'); await sleep(400);
  shots.push(await shot('02-slide'));

  /* 証言 — ムジュンのある証言まで送る */
  await evalIn('GIF.player.goScene(4)'); await sleep(300);
  await cdp.send('Runtime.evaluate', {
    expression: `(async()=>{const p=GIF.player,k=x=>document.dispatchEvent(new KeyboardEvent('keydown',{key:x,bubbles:true}));
      const w=m=>new Promise(r=>setTimeout(r,m));
      for(let i=0;i<12&&p.mode!=='statements';i++){k(' ');await w(60);}
      while(p.t.i<2){k('ArrowRight');await w(80);} })()`,
    awaitPromise: true, returnByValue: true });
  await sleep(500); shots.push(await shot('03-testimony'));

  /* 法廷記録（証拠つきつけ） */
  await key('E'); await sleep(450);
  shots.push(await shot('04-court-record'));

  /* 「異議あり！」の瞬間 */
  await cdp.send('Runtime.evaluate', {
    expression: `(()=>{const p=GIF.player;const id=p.t.sc.statements[p.t.i].weak.evidence;
      const i=p.r.list.findIndex(e=>e.id===id);
      document.dispatchEvent(new KeyboardEvent('keydown',{key:String(i+1),bubbles:true}));})()`,
    returnByValue: true });
  await sleep(820); shots.push(await shot('05-objection'));   // shake(.4s) が終わり、shout(1.1s) が出ている間
  await sleep(900);
  /* 叫びが引けた直後＝指差しの煽り（決めショット）が出ている瞬間 */
  shots.push(await shot('05b-point'));

  /* 選択肢（客席に決めさせる画面） */
  await evalIn('GIF.player.goScene(9)'); await sleep(700);
  shots.push(await shot('06-choice'));

  /* 目次 */
  await key('Escape'); await sleep(450);
  shots.push(await shot('07-menu'));
  await key('Escape'); await sleep(250);

  /* 頭から最後まで通す */
  await cdp.send('Runtime.evaluate', { expression: 'GIF.player.restart()', returnByValue: true });
  await sleep(400);
  const res = await cdp.send('Runtime.evaluate', { expression: WALK, awaitPromise: true, returnByValue: true });
  const r = res.result.value;
  await sleep(400); shots.push(await shot('08-verdict'));

  /* 出力 */
  console.log(`GAMEIF PRESENTATION — スモークテスト: ${casePath}\n`);
  r.log.forEach(l => console.log('  ' + l));
  console.log('');
  console.log(`  踏破          ${r.scenesVisited} / ${r.totalScenes} シーン`);
  console.log(`  ゆさぶり      ${r.pressed} 回`);
  console.log(`  つきつけ成功  ${r.presented} 回（ムジュン突破 ${r.solved}）`);
  console.log(`  わざと外した  ${r.wrongTried} 回 → お手つき ${r.wrong}、ライフ ${r.life}/${r.lifeMax}`);
  console.log(`  操作回数      ${r.steps}`);
  console.log(`  結審まで到達  ${r.finished ? 'はい' : 'いいえ'}`);
  console.log(`\n  スクリーンショット dist/shots/ : ${shots.join(', ')}`);

  if (exceptions.length) { console.log('\n  ❌ 例外:'); exceptions.forEach(e => console.log('    ' + e.split('\n')[0])); }
  if (consoleErrors.length) { console.log('\n  ⚠️ console:'); consoleErrors.slice(0, 10).forEach(e => console.log('    ' + e)); }

  const ok = r.finished && !exceptions.length && r.scenesVisited === r.totalScenes;
  console.log(`\n${ok ? '✅ 通しました' : '❌ 通りませんでした'}`);
  cleanup(ok ? 0 : 1);
})().catch(e => { console.error('❌ ' + e.message); cleanup(2); });
