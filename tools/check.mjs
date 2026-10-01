#!/usr/bin/env node
/* =========================================================================
   check.mjs — ケースの「当日事故る間違い」を出発前に捕まえる。
   いちばん多い事故は「まだ持っていない証拠をつきつけさせる」設計ミス。
   これは本番で聴衆の前で詰む。だから静的に検出する。
   ========================================================================= */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VALID_TYPES = ['title', 'dialogue', 'slide', 'evidence', 'testimony', 'choice', 'verdict'];
const VALID_BG = ['courtroom', 'stand', 'lobby', 'dark', 'white', 'gallery'];
const VALID_SFX = ['type','gavel','objection','breakthrough','wrong','damage','evidence',
                   'press','select','move','open','close','fanfare','reveal'];
const VALID_SHOT  = ['wide','mid','close','extreme','low','high','think','gallery',
                     'point','slam','shock','stare'];
const VALID_ANGLE = ['front','defense','prosecution','witness','judge','gallery'];
const VALID_MOVE  = ['cut','snap','punch','push','pull','drift'];

let totalErr = 0, totalWarn = 0;

function checkCase(file) {
  const errs = [], warns = [];
  const d = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  const castIds = Object.keys(d.cast || {});
  const evIds = (d.evidence || []).map(e => e.id);
  const E = (m) => errs.push(m);
  const W = (m) => warns.push(m);

  if (!d.meta?.title) W('meta.title がない');
  if (!d.meta?.learning?.goal) W('meta.learning.goal がない — 何を学ばせたいのか書く');
  if (!Array.isArray(d.scenes) || !d.scenes.length) { E('scenes が空'); return report(file, errs, warns); }

  /* 証拠の所持状況をシーン順にシミュレートする */
  const owned = new Set(d.meta?.startEvidence || []);
  if (d.meta?.allEvidenceFromStart) evIds.forEach(id => owned.add(id));

  const seenIds = new Set();
  (d.evidence || []).forEach((e, i) => {
    if (!e.id) E(`evidence[${i}] に id がない`);
    else if (seenIds.has(e.id)) E(`evidence id が重複: ${e.id}`);
    seenIds.add(e.id);
    if (!e.name) W(`evidence ${e.id} に name がない`);
    if (!e.detail && !e.desc) W(`evidence ${e.id} に説明がない — つきつける前に読ませられない`);
  });

  /* 画像を差し込んでいる役で、使っているポーズの絵が無い場合は既定絵に落ちる。
     黙って落ちると当日まで気づかないので警告する。 */
  const posedCast = new Set(Object.keys(d.cast || {}).filter(k => d.cast[k].img));
  const missingPose = new Set();

  const checkLines = (lines, where) => (lines || []).forEach((l, i) => {
    const at = `${where}.lines[${i}]`;
    if (l.who && !castIds.includes(l.who)) E(`${at}: who "${l.who}" が cast にない`);
    if (l.bg && !VALID_BG.includes(l.bg)) W(`${at}: bg "${l.bg}" は未知（${VALID_BG.join('/')}）`);
    if (l.sfx && !VALID_SFX.includes(l.sfx)) W(`${at}: sfx "${l.sfx}" は未知`);
    if (l.shot && !VALID_SHOT.includes(l.shot)) W(`${at}: shot "${l.shot}" は未知（${VALID_SHOT.join('/')}）`);
    if (l.angle && !VALID_ANGLE.includes(l.angle)) W(`${at}: angle "${l.angle}" は未知（${VALID_ANGLE.join('/')}）`);
    if (l.move && !VALID_MOVE.includes(l.move)) W(`${at}: move "${l.move}" は未知（${VALID_MOVE.join('/')}）`);
    if (!l.text && !l.shout) W(`${at}: text が空`);
    if (l.text && l.text.length > 120) W(`${at}: ${l.text.length}文字 — テキストボックスから溢れる（目安90文字まで）`);
    if (l.who && l.pose && posedCast.has(l.who)) {
      const poses = d.cast[l.who].poses || {};
      if (!poses[l.pose]) missingPose.add(`${l.who}:${l.pose}`);
    }
  });

  let hasVerdict = false, testimonyCount = 0, interactions = 0;

  d.scenes.forEach((sc, si) => {
    const at = `scenes[${si}]${sc.chapter ? ' 「' + sc.chapter + '」' : ''}`;
    const t = sc.type || 'dialogue';
    if (!VALID_TYPES.includes(t)) { E(`${at}: 未知の type "${t}"`); return; }
    if (sc.bg && !VALID_BG.includes(sc.bg)) W(`${at}: bg "${sc.bg}" は未知`);
    if (!sc.chapter && t !== 'title') W(`${at}: chapter がない — Esc の目次で飛べなくなる`);

    checkLines(sc.intro, at + '.intro');
    checkLines(sc.lines, at);

    if (t === 'evidence') {
      if (!sc.give?.length) E(`${at}: give が空`);
      (sc.give || []).forEach(id => {
        if (!evIds.includes(id)) E(`${at}: give "${id}" が evidence にない`);
        owned.add(id);
      });
    }

    if (t === 'testimony') {
      testimonyCount++;
      if (!castIds.includes(sc.witness)) E(`${at}: witness "${sc.witness}" が cast にない`);
      if (!sc.statements?.length) { E(`${at}: statements が空`); return; }
      const weaks = sc.statements.filter(s => s.weak);
      if (!weaks.length) E(`${at}: ムジュンが1つもない — 永久に抜け出せない`);
      sc.statements.forEach((s, i) => {
        const sat = `${at}.statements[${i}]`;
        if (!s.text) E(`${sat}: text が空`);
        if (s.text && s.text.length > 110) W(`${sat}: ${s.text.length}文字 — 証言は短く。読み上げる前提`);
        checkLines(s.press, sat + '.press');
        if (s.weak) {
          interactions++;
          if (!s.weak.evidence) E(`${sat}.weak: evidence がない`);
          else if (!evIds.includes(s.weak.evidence)) E(`${sat}.weak: evidence "${s.weak.evidence}" が存在しない`);
          /* ここが本題: この時点で持っているか */
          else if (!owned.has(s.weak.evidence)) {
            E(`${sat}.weak: 「${s.weak.evidence}」をこの時点では持っていない — 本番で詰む。` +
              `先に type:"evidence" で give するか meta.startEvidence に入れる`);
          }
          if (!s.weak.onCorrect?.length) W(`${sat}.weak: onCorrect が空 — 突いても何も起きない`);
          checkLines(s.weak.onCorrect, sat + '.weak.onCorrect');
          checkLines(s.weak.onWrong, sat + '.weak.onWrong');
        }
      });
    }

    if (t === 'choice') {
      interactions++;
      if (!sc.question) W(`${at}: question がない`);
      if (!sc.options?.length) E(`${at}: options が空`);
      const correct = (sc.options || []).filter(o => o.correct);
      if (!correct.length) E(`${at}: correct:true の選択肢がない — 進めなくなる`);
      if (correct.length > 1) W(`${at}: correct が ${correct.length} 個ある`);
      (sc.options || []).forEach((o, i) => checkLines(o.reply, `${at}.options[${i}]`));
    }

    if (t === 'slide') {
      const n = (sc.bullets || []).length;
      if (n > 5) W(`${at}: bullets が ${n} 行 — 5行を超えると聴衆は読むのをやめる`);
      (sc.bullets || []).forEach((b, i) => {
        if (b.replace(/<[^>]+>/g, '').length > 60) W(`${at}.bullets[${i}]: 長い（60文字まで）`);
      });
      if (sc.image?.src && /^https?:/.test(sc.image.src))
        W(`${at}: image が外部URL — 会場のネットが死ぬと消える。assets/ に置く`);
    }

    if (t === 'verdict') {
      hasVerdict = true;
      if (!sc.takeaways?.length) E(`${at}: takeaways が空 — 何も持ち帰らせないことになる`);
      if ((sc.takeaways || []).length > 6) W(`${at}: takeaways が多い（6個まで）`);
    }
  });

  missingPose.forEach(k => W(`cast.${k.split(':')[0]}.poses に "${k.split(':')[1]}" の絵がない — 既定の絵に落ちます`));
  if (!hasVerdict) W('verdict シーンがない — 学びを回収せずに終わる');
  if (!testimonyCount) W('testimony が1つもない — これは法廷型ではなく普通のスライド');
  if (interactions < 2) W(`聴衆が手を動かす場面が ${interactions} 回 — ゲームとして薄い（3回以上を目安に）`);

  /* 発表者ノートの有無 */
  const notes = JSON.stringify(d).match(/"note":/g)?.length || 0;
  if (notes < 3) W(`発表者ノートが ${notes} 箇所 — H キーで出せる。当日の自分を助ける`);

  return report(file, errs, warns);
}

function report(file, errs, warns) {
  const ok = errs.length === 0;
  console.log(`\n${ok ? '✅' : '❌'} ${file}`);
  errs.forEach(m => console.log(`   ERROR  ${m}`));
  warns.forEach(m => console.log(`   warn   ${m}`));
  if (ok && !warns.length) console.log('   問題なし');
  totalErr += errs.length; totalWarn += warns.length;
}

const args = process.argv.slice(2);
const files = args.length ? args
  : readdirSync(join(ROOT, 'cases')).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => 'cases/' + f);

console.log('GAMEIF PRESENTATION — ケース検査');
files.forEach(f => { try { checkCase(f); } catch (e) { console.log(`\n❌ ${f}\n   PARSE  ${e.message}`); totalErr++; } });
console.log(`\n—— ERROR ${totalErr} / warn ${totalWarn}`);
process.exit(totalErr ? 1 : 0);
