---
name: gameif-case
description: 法廷バトル型プレゼン（GAMEIF PRESENTATION）のケースを作る・直す。「学びたいエッセンス」や題材を渡されたら、トーンとマナーを提案してから cases/*.json を書き、検査・ブラウザ通し・1枚HTMLビルドまで通す。逆転裁判形式のプレゼン、証言、ムジュン、証拠品、異議あり、という語が出たらこれを使う。
---

# GAMEIF ケース作成

このリポジトリは、プレゼンを法廷バトルとして行うためのテンプレートエンジンです。

## 手順

1. **`prompts/case-director.md` を読み、その手順に従う。**
   素材3つ（誤解 / ムジュン / 到達点）を確かめる前に JSON を書かない。
2. トーンとマナーを表1枚で提案し、合意を取る。
3. `docs/FORMAT.md` の書式で `cases/<slug>.json` を書く。
   `cases/demo-quantum.json` が実例、`cases/template.json` が雛形。
4. 必ずこの順で検証する：
   ```bash
   node tools/check.mjs cases/<slug>.json      # 設計ミス（証拠の配り忘れ等）
   node tools/smoke.mjs cases/<slug>.json      # 実ブラウザで頭から最後まで
   node tools/build.mjs cases/<slug>.json      # dist/<slug>.html
   ```
5. `cases/index.json` に1行足す（ランチャーの一覧に出る）。
6. 報告には **URL を必ず添える**（ローカル、または Pages のURL）。

## エンジンを直すとき

- `engine/engine.js` … 進行の状態機械
- `engine/camera.js` … 画角（寄り・切り返し・煽り）。決めショットの語彙はここ
- `engine/theme.css` … 見た目とトンマナ
- `engine/art.js` … 立ち絵のSVG生成
- `engine/sfx.js` … 効果音（WebAudio合成。音源ファイルは持たない）

直したら `node tools/smoke.mjs` を通し、`dist/shots/` の画像を**実際に見る**こと。
「動いたはず」で報告しない。過去に、山場の演出が画面全体を真っ暗にしていた不具合を
スクリーンショットだけが捕まえている。

## 守ること

- 既存ゲームの画像・音・フォント・キャラクターを持ち込まない。立ち絵はSVG生成、音はWebAudio合成。
  絵が要るときは自分で描かず、`docs/ILLUSTRATION-PROMPTS.md` の様式でプロンプトを出す。
- 作りたいのは特定作品の再現ではなく、**ゲームをしているようなプレゼン**。法廷は第一形式。
- 外部ネットワークに依存しない（会場のWi-Fiは死ぬ前提）。
- 行き止まりを作らない。ライフ0でも審理は続行する。
