#!/usr/bin/env node
/* =========================================================================
   check-portable.mjs — 1枚HTMLが「本当に持ち運べるか」を確かめる。
   file:// で開き、外部参照がゼロであることを確認し、最後まで通す。
   USBで会場に持ち込む、ネットの無い部屋で開く、という使い方の保証。

     node tools/check-portable.mjs [dist/xxx.html]
   ========================================================================= */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const CDP=9341, sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=mkdtempSync(join(tmpdir(),'gif-file-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 ['--headless=new','--disable-gpu','--mute-audio','--window-size=1600,900',
  `--user-data-dir=${profile}`,`--remote-debugging-port=${CDP}`,'about:blank'],{stdio:'ignore'});
let wsUrl; for(let i=0;i<60;i++){try{const l=await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p){wsUrl=p.webSocketDebuggerUrl;break}}catch{};await sleep(250)}
const ws=new WebSocket(wsUrl); await new Promise(r=>ws.onopen=r);
let id=0; const w=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&w.has(m.id)){const{res,rej}=w.get(m.id);w.delete(m.id);m.error?rej(new Error(m.error.message)):res(m.result)}};
const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;w.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}))});
const ev=async(e,a=false)=>(await send('Runtime.evaluate',{expression:e,awaitPromise:a,returnByValue:true})).result.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});
const target = process.argv[2] || 'dist/demo-quantum.html';
const abs = resolve(dirname(fileURLToPath(import.meta.url)), '..', target);
if (!existsSync(abs)) { console.error(`ありません: ${target}（先に npm run build）`); process.exit(2); }
console.log(`対象     : ${target}`);
await send('Page.navigate',{url:'file://'+abs});
await sleep(1600);
console.log('protocol :', await ev('location.protocol'));
console.log('booted   :', await ev('!!(window.GIF && GIF.player)'));
console.log('scenes   :', await ev('GIF.player ? GIF.player.scenes.length : null'));
console.log('外部参照 :', await ev(`JSON.stringify([...document.querySelectorAll('script[src],link[href],img[src]')].map(e=>e.src||e.href).filter(u=>!/^data:/.test(u)))`));
// 実際に最後まで通す
const r = await ev(`(async()=>{const p=GIF.player;p.meta.typeSpeed=0;GIF.sfx.mute(true);
 const k=x=>document.dispatchEvent(new KeyboardEvent('keydown',{key:x,bubbles:true})),w=m=>new Promise(r=>setTimeout(r,m));
 let s=0,wrong=0; while(!p._ended&&s<900){s++;
  if(p.mode==='statements'){const st=p.t.sc.statements[p.t.i];
   if(st.weak&&!p.t.solved[p.t.i]){k('E');await w(40);
    const i=p.r.list.findIndex(e=>e.id===st.weak.evidence); if(i<0)return{err:'証拠なし'};
    k(String(i+1)); await w(1500); continue;}
   k('ArrowRight');await w(25);continue;}
  if(p.mode==='choices'){k(String(p.c.sc.options.findIndex(o=>o.correct)+1));await w(1300);continue;}
  if(p.mode==='record'){k('Escape');await w(30);continue;}
  k(' ');await w(40);}
 return {ended:!!p._ended, scene:p.sceneIndex, total:p.scenes.length, solved:p.stats.solved, steps:s};})()`,true);
console.log('通し     :', JSON.stringify(r));
const s=(await send('Page.captureScreenshot',{format:'png'})).data;
const shotDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'shots');
mkdirSync(shotDir, { recursive: true });
writeFileSync(join(shotDir, '09-file-protocol.png'), Buffer.from(s,'base64'));
const ext = await ev(`[...document.querySelectorAll('script[src],link[href],img[src]')].map(e=>e.src||e.href).filter(u=>!/^data:/.test(u)).length`);
const ok = r && r.ended && ext === 0;
console.log(`\n${ok ? '✅ 持ち運べます（file:// で完走・外部参照ゼロ）' : '❌ 持ち運べません'}`);
try{chrome.kill()}catch{} process.exit(ok?0:1);
