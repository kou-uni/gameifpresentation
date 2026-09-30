# ケースJSONの書式

1本の発表 = 1つの JSON。`cases/` に置きます。
`node tools/check.mjs` で検査、`node tools/build.mjs` で1枚HTMLに焼きます。

`text` 系のフィールドは **HTMLを書けます**（`<b>` `<em>` `<br>` `<span class="hit">`）。
ケースは自分で書くものなので、そのまま描画します。

---

## 全体

```jsonc
{
  "meta":     { ... },   // 作品情報とトンマナ
  "cast":     { ... },   // 登場人物
  "evidence": [ ... ],   // 証拠品
  "scenes":   [ ... ]    // 進行
}
```

## meta

| キー | 既定 | 意味 |
|---|---|---|
| `title` | — | 作品名。ブラウザのタイトルにもなる |
| `subtitle` | — | 画面右上の小さい文字 |
| `theme` | `court` | `court` / `lab` / `startup` / `warm` |
| `lifeMax` | `5` | ライフの数。`0` でライフ表示なし |
| `typeSpeed` | `22` | 文字送りのms。`0` で即時 |
| `startEvidence` | `[]` | 最初から持っている証拠のid |
| `allEvidenceFromStart` | `false` | 全部最初から持たせる |
| `learning.goal` | — | 何を学ばせたいか。**書くと自分が助かる** |
| `minutes` | — | 想定の尺。一覧に出る |

## cast

```jsonc
"hero": {
  "name": "弁護人 ミライ",     // 名前プレートに出る文字
  "art":  "hero",              // 立ち絵のプリセット
  "side": "left",              // left / center / right
  "img":  "assets/mirai.png",  // 画像を使うならこれ（art より優先）
  "poses": { "confident": "assets/mirai-confident.png" },
  "outfit": "#1d3a8f", "hairColor": "#1a1a22",
  "tie": "#d33", "skin": "#f6d5b8", "hair": "spike"
}
```

`art` プリセット: `hero` `prosecutor` `witness` `judge` `assistant` `expert` `detective`
`hair`: `spike` `slick` `bob` `long` `short` `messy` `beard` `none`

## evidence

```jsonc
{ "id": "ev-logical", "name": "論理量子ビットの値段",
  "icon": "chart",                  // doc chart photo quote code thing
  "desc": "一覧に出る短い説明",
  "detail": "つきつける前に読ませたい中身",
  "img": "assets/chart.png" }       // あれば icon より優先
```

## lines（セリフの並び）— 共通

```jsonc
{ "who": "hero",            // cast のキー。省略するとナレーション
  "text": "話す内容",
  "pose": "confident",      // normal talk confident shock think sweat damage point slam
  "side": "left",
  "bg": "courtroom",        // courtroom stand lobby dark white
  "sfx": "gavel",           // gavel objection breakthrough wrong damage evidence
                            // press select move open close fanfare reveal
  "shout": "異議あり！",     // 叫び演出を挟んでから喋る
  "flash": true, "shake": true,
  "style": "testimony",     // testimony=緑 / press=水色
  "speed": 0,               // この行だけ文字送り速度を変える
  "note": "発表者ノート（H キーで表示）",
  "hideActor": true }
```

---

## シーン

### `title` — 表紙
```jsonc
{ "type":"title", "chapter":"開廷", "kicker":"CASE 001",
  "title":"争点を一行で", "sub":"副題", "cta":"Space で開廷" }
```

### `dialogue` — 会話
```jsonc
{ "type":"dialogue", "chapter":"導入", "bg":"courtroom", "lines":[ ... ] }
```

### `slide` — 講義パート（休廷）
```jsonc
{ "type":"slide", "chapter":"物理と論理", "kicker":"RECESS",
  "title":"見出し", "big":"でかい一言",
  "bullets":["1","2","3"],            // 5行まで
  "image": { "src":"assets/x.png", "caption":"出典" },
  "html":"<自由なHTML>", "footnote":"出典",
  "lines":[ ... ] }                   // スライドの後に会話を続けられる
```

### `evidence` — 証拠品を配る
```jsonc
{ "type":"evidence", "chapter":"証拠の開示",
  "give":["ev-1","ev-2"], "lines":[ ... ] }
```
**証拠は、つきつける場面より前に配ること。** `check.mjs` が検査します。

### `testimony` — 証言（本体）
```jsonc
{ "type":"testimony", "chapter":"証人ハイプの証言",
  "banner":"証言 — もう時間がない", "bg":"stand",
  "witness":"hype", "penalty":1, "shout":"異議あり！",
  "intro":[ ... ],
  "statements":[
    { "text":"証言1行", "pose":"confident", "note":"発表者ノート",
      "press":[ ... ],                    // P キーで掘る
      "weak":{                            // ★ムジュン
        "evidence":"ev-logical",
        "onCorrect":[ ... ],
        "onWrong":[ ... ] } }
  ] }
```
- `weak` を複数の証言に置ける。**全部突くまで次のシーンに進みません**
- 証言は `→` でループします。何度でも聞き直せます

### `choice` — 聴衆に選ばせる
```jsonc
{ "type":"choice", "chapter":"最終弁論", "question":"問い", "penalty":1,
  "options":[
    { "text":"外れ", "correct":false, "reply":[ ... ] },
    { "text":"正解", "correct":true, "shout":"異議なし！", "reply":[ ... ] } ] }
```

### `verdict` — 判決（回収）
```jsonc
{ "type":"verdict", "chapter":"判決", "kicker":"VERDICT",
  "title":"本日の認定事実",
  "takeaways":["持ち帰り1","2","3"], "cta":"R でもう一度" }
```

---

## 操作キー

| キー | 動作 |
|---|---|
| `Space` `→` `PageDown` クリック | 進む |
| `←` `PageUp` 右クリック | 戻る |
| `E` | 法廷記録（証言中は数字キーでつきつけ） |
| `P` | ゆさぶる |
| `Esc` | 目次（章ジャンプ） |
| `H` | 発表者ノート |
| `T` | タイマー / `M` 消音 / `F` 全画面 / `R` 最初から |

**クリッカーの `→` `←` だけで最後まで通せます。**
証拠をつきつける場面だけは、手元で数字キーかクリックが要ります。

## URL パラメータ

```
player/index.html?case=../cases/x.json&scene=4&notes=1&timer=1&mute=1
```
`#4` のように hash でもシーンを指定できます（進むと自動で更新されます）。
