#!/usr/bin/env node
/* 依存ゼロの静的サーバ。ケースJSONを fetch するので file:// では動かないため。 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8787;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.gif':'image/gif', '.md':'text/plain; charset=utf-8' };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(302, { Location: p + '/' }).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream',
                         'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
       .end('<h1>404</h1><p><a href="/">一覧へ</a></p>');
  }
}).listen(PORT, () => {
  console.log(`GAMEIF PRESENTATION
  一覧      http://localhost:${PORT}/
  デモ      http://localhost:${PORT}/player/index.html?case=../cases/demo-quantum.json
  発表者用  ...&notes=1&timer=1`);
});
