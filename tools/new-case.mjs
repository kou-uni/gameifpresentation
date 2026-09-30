#!/usr/bin/env node
/* テンプレートから新しいケースを起こす: node tools/new-case.mjs my-topic "第2審 — 〇〇" */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
const title = process.argv[3];
if (!slug) { console.error('使い方: node tools/new-case.mjs <slug> ["タイトル"]'); process.exit(1); }

const out = join(ROOT, 'cases', slug + '.json');
if (existsSync(out)) { console.error(`すでにある: cases/${slug}.json`); process.exit(1); }

const tpl = JSON.parse(readFileSync(join(ROOT, 'cases', 'template.json'), 'utf8'));
if (title) { tpl.meta.title = title; tpl.scenes[0].title = title.replace(/^.*?—\s*/, ''); }
writeFileSync(out, JSON.stringify(tpl, null, 2) + '\n', 'utf8');

const idxPath = join(ROOT, 'cases', 'index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
idx.splice(idx.length - 1, 0, { file: slug + '.json', title: title || slug, desc: '', theme: tpl.meta.theme, minutes: tpl.meta.minutes });
writeFileSync(idxPath, JSON.stringify(idx, null, 2) + '\n', 'utf8');

console.log(`できました: cases/${slug}.json
  1. docs/TONE-AND-MANNER.md を読んで、証言とムジュンを決める
  2. npm start して http://localhost:8787/player/index.html?case=../cases/${slug}.json
  3. npm run build で1枚HTMLに焼く`);
