# イラスト生成プロンプト集

**絵はこのリポジトリで作り込みません。** Grok / ChatGPT / NanoBanana などで生成して
`assets/` に置くと、エンジンが差し替えます。ここはそのためのプロンプト集です。

設計の前提：**キャラクターは「役割スロット」であって、特定の人格ではありません。**
性格はプレゼンごとに台本で変わるので、絵のほうは**どんな性格にも振れる中立な造形**にします。
1セット作れば、以後どのケースでも使い回せる、という状態がゴールです。

---

## 0. まず、何枚いるのか

最小構成は **キャラ5体 × ポーズ6種＋背景4枚**。これで大半のケースが回ります。
決めショット（指差し・机バン）は**主役2体ぶんだけ**あれば足ります。

| 用途 | 枚数 | 優先 |
|---|---|---|
| 役割A〜E の立ち絵（通常・喋り・自信・動揺・驚愕・ダメージ） | 5×6 = 30 | ★必須 |
| 決めポーズ（指差し・机バン）主役2体ぶん | 2×2 = 4 | ★必須 |
| 背景（正面・左席から・右席から・傍聴席） | 4 | ★必須 |
| 思考・汗（深掘り用） | 5×2 = 10 | あれば |
| 証拠品アイコン | ケース次第 | あれば |

**全部揃うまで待たなくていい。** 絵が無いスロットは、エンジンが生成SVGに落として動きます。

---

## 0.5. まずこの1枚を出してみる（トンマナがここで決まる）

いちばん象徴的なのは **指差し（`point`）** です。これが決まれば残りは参照画像で揃います。
以下をそのまま貼ってください。

```
Japanese anime visual-novel character art, clean cel shading with two tone steps,
bold confident dark outlines of even weight, saturated but not neon colors, simple
flat rendering with minimal gradients, no texture noise, no painterly brushwork.
Designed to be read from across a room on a projector: large readable facial
expression, high contrast between hair / skin / clothing. Modern-day setting.
Flat even lighting — no rim light, no lens flare. Neutral, versatile character
design with no franchise-specific motifs.

CHARACTER: a young adult in a deep navy suit jacket over a white shirt and a red
tie, short tousled black hair, straight eyebrows, bright eyes, slim build.

POSE: a decisive accusatory point. The body is turned about 30 degrees into a
three-quarter view and leans forward. The pointing arm extends DIAGONALLY ACROSS
THE BODY toward the lower-left of the frame, finger extended, aimed slightly PAST
the camera rather than straight into the lens. The hand sits around chest height
and is NOT larger than the head — only moderate foreshortening. The FACE IS THE
MAIN SUBJECT: fully visible, unobstructed by the hand, brow furrowed, mouth open
mid-shout, eyes locked forward.

CAMERA: eye level, straight on. Framed from the waist up. The character occupies
roughly the right two-thirds of the frame, leaving open space on the left where
the arm reaches. Normal lens, no wide-angle distortion.

OUTPUT: single character only, centered, transparent background (if transparency is
unavailable, use a flat solid #FF00FF magenta background and nothing else), no
ground shadow, no props, no text, no watermark, no border. Portrait 2:3.
```

気に入ったものが出たら、**それを参照画像として添付**して他のポーズを出します。
`assets/chars/a/point.png` として保存し、ケースJSONの `poses.point` に書けば差し替わります。

---

## 1. 共通スタイルブロック（**全プロンプトの先頭に必ず貼る**）

一貫性はここで決まります。1文字も変えずに毎回貼ってください。

```
STYLE: Japanese anime visual-novel character art, clean cel shading with two tone
steps, bold confident dark outlines of even weight, saturated but not neon colors,
simple flat rendering with minimal gradients, no texture noise, no painterly
brushwork. Designed to be read from across a room on a projector: large readable
facial expression, high contrast between hair / skin / clothing, silhouette stays
clear when shrunk to 20% size. Modern-day setting, smart formal clothing.
Full-body lighting is flat and even — no dramatic rim light, no lens flare.
Neutral, versatile character design with no franchise-specific motifs.
OUTPUT: single character only, centered, facing the camera as specified,
transparent background (if transparency is unavailable, use a flat solid
#FF00FF magenta background and nothing else), no ground shadow, no props
other than those specified, no text, no watermark, no border, no frame.
ASPECT: portrait 2:3.
```

> **透過が出ない場合**：`#FF00FF` 背景で出してから、プレビュー.app の
> 「インスタントアルファ」か remove.bg で抜きます。マゼンタは肌や服と衝突しにくいので
> 抜きやすい色です。

---

## 2. 役割スロット（人格ではなく、画面上の機能）

| スロット | 画面上の機能 | 立ち位置 | 造形の方向 |
|---|---|---|---|
| **A 主張する人** | 聴衆の分身。発表者側 | 左 | 若い。姿勢がいい。表情が大きく動く |
| **B 反論する人** | 対立意見。強いほど学びが濃い | 右 | 落ち着いた大人。隙がない立ち姿 |
| **C 裁定する人** | 結論を言語化して締める | 中央奥 | 年長。横幅がある。動かない |
| **D 語る人（証人）** | 通説・誤解を喋る | 中央 | 普通の人。癖のある特徴を1つだけ |
| **E 相棒** | 聴衆の代弁者。操作説明も担当 | 左手前 | 小柄。表情が素直 |

**性格づけは台本（ケースJSON）でやります。** 絵に性格を描き込みすぎると、
次のケースで使えなくなります。「中立で、どちらにも振れる」が正解です。

各スロットに1行の **キャラ定義** を決め、以後すべてのプロンプトで使い回してください。
例：

```
CHARACTER A: a young adult in a deep navy suit jacket over a white shirt and a red
tie, short tousled black hair, straight eyebrows, bright eyes, slim build.

CHARACTER B: a composed adult in a dark crimson tailored coat with gold trim,
silver-grey hair swept back, sharp narrow eyes, tall and upright.

CHARACTER C: an older figure in a plain black robe with a high collar, full white
beard, heavy-set, calm half-closed eyes.

CHARACTER D: an ordinary office worker in a beige jacket and green tie, neatly
parted brown hair, round face, slightly nervous posture.

CHARACTER E: a small, bright-eyed assistant in a purple vest over a cream blouse,
long dark hair tied back, expressive eyebrows.
```

> **ここは自由に差し替えてください。** 題材が理科なら白衣、事業なら私服、など。
> 変えるときは**5体まとめて**変えると世界観が揃います。

---

## 3. ポーズ × 角度（エンジンのスロットと1対1）

**ここが一番大事なところです。** 決めの瞬間は、カメラではなく**絵の角度そのもの**が変わります。
寄っただけでは、あの画にはなりません。

| `pose` | 使う場面 | **描く角度** | 構図 |
|---|---|---|---|
| `normal` | 待機 | 正面やや斜め（約15°） | 胸から上 |
| `talk` | 普通の喋り | 正面やや斜め（約15°） | 胸から上 |
| `confident` | 優勢・自信 | 斜め45°、顎を引く | 胸から上 |
| `think` | 検討・深掘り | 斜め30°、やや伏し目 | 胸から上 |
| `sweat` | 旗色が悪い | 正面、わずかに引く | 胸から上 |
| `shock` | 驚愕 | 正面、のけぞり | 胸から上 |
| `damage` | 致命打 | やや煽り、強くのけぞる | 腰から上 |
| `point` | **指差し（決め）** | **目線の高さ・3/4。腕は斜め、手は頭より小さく** | 腰から上・右2/3に寄せる |
| `slam` | **机を叩く（決め）** | やや煽り・3/4。手は画面下端 | 腰から上 |

### プロンプト本体（`STYLE` と `CHARACTER` の後ろに貼る）

```
POSE normal:
Standing still, arms relaxed at the sides, mouth closed in a neutral line,
calm open eyes, body turned about 15 degrees from the camera, head facing
the viewer. Framed from the chest up. Eye level camera.
```
```
POSE talk:
Mid-sentence, mouth open in a natural speaking shape, eyes open and engaged,
one hand raised slightly in a small gesture. Body turned about 15 degrees.
Framed from the chest up. Eye level camera.
```
```
POSE confident:
Chin slightly lowered, eyes narrowed with a small knowing smile, shoulders
squared, arms folded or one hand resting at the hip. Body turned 45 degrees
from the camera, head turned back toward the viewer. Framed from the chest up.
Eye level camera.
```
```
POSE think:
Eyes lowered in thought, brow drawn together, one hand near the chin.
Body turned 30 degrees, head tilted slightly down. Framed from the chest up.
Eye level camera.
```
```
POSE sweat:
Forced stiff smile, eyes wide and fixed, a single large cartoon sweat drop
on the temple, shoulders raised in tension. Facing the camera straight on.
Framed from the chest up. Eye level camera.
```
```
POSE shock:
Eyes wide with small pupils, mouth open in a gasp, head and upper body
recoiling backwards, both hands lifted. Facing the camera straight on.
Framed from the chest up. Eye level camera.
```
```
POSE damage:
Struck by a revelation — head thrown back, eyes screwed shut or drawn as X
marks, mouth open in a shout, body twisting away, several sweat drops flying.
CAMERA: slightly below eye level, looking up a little. Framed from the waist up.
The face stays the main subject — do not let the shoulders crowd it out.
```
```
POSE point:
A decisive accusatory point. The body is turned about 30 degrees into a
three-quarter view and leans forward. The pointing arm extends DIAGONALLY ACROSS
THE BODY toward the lower-left of the frame, finger extended, aimed slightly PAST
the camera rather than straight into the lens. The hand sits around chest height
and is NOT larger than the head — only moderate foreshortening. The FACE IS THE
MAIN SUBJECT: fully visible, unobstructed by the hand, brow furrowed, mouth open
mid-shout, eyes locked forward.
CAMERA: eye level, straight on. Framed from the waist up. The character occupies
roughly the right two-thirds of the frame, leaving open space on the left where
the arm reaches. Normal lens, no wide-angle distortion.
```
> **ここを外すと全部おかしくなります。** 「真正面に向けて突き出す」「手を大きく」
> 「下から煽る」と書くと、手が顔より大きい別物が出ます。
> **主役は顔です。** 手は斜めに、胸の高さ、頭より小さく。カメラは目線の高さ。
```
POSE slam:
Both palms slamming down onto an unseen desk edge along the bottom of the frame,
body leaning forward over the desk, shoulders hunched, mouth open in a shout,
eyes fierce and locked forward. The hands are at the bottom edge and are NOT
larger than the head — moderate foreshortening only. The face stays fully visible.
CAMERA: slightly below eye level, looking up a little from desk height, body
turned about 20 degrees. Framed from the waist up. Normal lens.
```

### 一貫性を保つやり方（これが実務上いちばん効く）

1. **まず `normal` を1枚だけ丁寧に出す。** 気に入るまでここで粘る
2. その画像を**参照として添付**し、残りのポーズを出す。先頭に1行足す：
   ```
   Keep the exact same character design, colours, hairstyle and outfit as the
   attached reference image. Only the pose, angle and expression change.
   ```
3. どうしても揺れる場合は、**1枚の画像に複数ポーズを並べて出させる**：
   ```
   Produce a character expression sheet: one image containing 6 separate
   half-body illustrations of the SAME character in a 3x2 grid on a flat
   #FF00FF background, each clearly separated, in these poses: normal, talk,
   confident, sweat, shock, damage. Same design in every cell.
   ```
   出てきた1枚を切り分けます。**揃い方はこの方法が一番安定します。**

---

## 4. 背景（視点ごと）

背景は「どの席から法廷を見ているか」で別の絵が要ります。
エンジンのカメラは背景にヨー角をかけますが、**元の絵が正面だけだと限界があります。**
`@defense` / `@prosecution` の絵を足すと、**切り返しのたびに実際に別の絵へ切り替わります。**

共通ブロック：

```
STYLE: Japanese anime visual-novel background art, clean cel shading, bold but
sparse outlines, warm even lighting, simple flat rendering, no characters, no
people, no text, no logos, no watermark. Slightly desaturated so that character
art placed on top stays readable. Composition leaves the lower third and the
centre visually calm, because a dialogue box and a character will cover them.
ASPECT: 16:9, 1920x1080.
```

| ファイル | `bg` の値 | プロンプト本体 |
|---|---|---|
| `assets/bg/court-front.png` | `courtroom` | `A modern courtroom interior seen straight on from the middle of the room: polished dark wood panelling, a raised bench across the back, a tall crest medallion on the wall above it, warm overhead light.` |
| `assets/bg/court-left.png` | `courtroom@defense` | `The same courtroom seen from the left-hand advocate's desk, looking across the floor toward the opposite desk: the wooden railing runs diagonally into the frame from the lower left, strong one-point perspective toward the right.` |
| `assets/bg/court-right.png` | `courtroom@prosecution` | `The same courtroom seen from the right-hand desk, mirrored: the railing runs diagonally in from the lower right, perspective toward the left.` |
| `assets/bg/stand.png` | `stand` | `Close view of a witness stand: a plain wooden podium filling the lower frame, panelled wall behind it slightly out of focus, shot from just above podium height.` |
| `assets/bg/gallery.png` | `gallery` | `The public gallery of the courtroom seen from the front, rows of empty bench seating receding into shadow, viewed from slightly above.` |

ケースJSONでの指定：

```jsonc
"meta": {
  "backgrounds": {
    "courtroom":             "assets/bg/court-front.png",
    "courtroom@defense":     "assets/bg/court-left.png",      // 弁護席の側から見たとき
    "courtroom@prosecution": "assets/bg/court-right.png",     // 検察席の側から見たとき
    "stand":                 "assets/bg/stand.png",
    "gallery":               "assets/bg/gallery.png"
  }
}
```

---

## 5. 証拠品

```
STYLE: a single object illustrated in flat anime style on a plain light cream
background, bold dark outline, clean cel shading, centred, filling about 70% of
the frame, slight top-down three-quarter view, no text, no labels, no watermark.
ASPECT: 1:1, 1024x1024.
OBJECT: <ここに証拠品そのものを書く。例: a folded printed research paper with a
bar chart visible on the top page>
```

> 文字は入れさせないこと。**生成画像の中の文字はほぼ必ず崩れます。**
> 名前と説明はエンジン側が描画します。

---

## 6. 置き場所と、ケースJSONへの書き方

```
assets/
  chars/
    a/normal.png  a/talk.png  a/confident.png  a/point.png  …
    b/…  c/…  d/…  e/…
  bg/court-front.png  bg/court-left.png  …
  ev/chart.png  ev/paper.png  …
```

```jsonc
"cast": {
  "hero": {
    "name": "弁護人 ミライ",
    "side": "left",
    "img": "assets/chars/a/normal.png",       // 既定の絵
    "poses": {                                 // ポーズごとの差し替え
      "talk":      "assets/chars/a/talk.png",
      "confident": "assets/chars/a/confident.png",
      "point":     "assets/chars/a/point.png",
      "shock":     "assets/chars/a/shock.png"
    }
  }
},
"evidence": [
  { "id":"ev-1", "name":"…", "img":"assets/ev/chart.png" }
]
```

**無いポーズは `img` の絵に落ちます。** 落ちていることは `npm run check` が警告します。
`npm run build` を通すと、画像は data URI として1枚HTMLに焼き込まれます。

---

## 7. よくある外れ方と、足す一文

| 出てきたもの | プロンプトに足す |
|---|---|
| 背景が描き込まれる | `Absolutely plain flat #FF00FF background. No room, no floor, no shadow.` |
| 全身が入って顔が小さい | `Crop at the waist. The head occupies the top third of the frame.` |
| 手が顔より大きい／顔が隠れる | `The hand must be smaller than the head and must not overlap the face. The face is the main subject.` |
| 真正面すぎて平板 | `Turn the body 30 degrees into a three-quarter view and lean it forward.` |
| 煽りすぎて見上げる画になる | `Eye level camera. No low angle, no wide-angle distortion.` |
| 塗りが厚い／油絵風 | `Flat two-tone cel shading only. No soft gradients, no painterly texture.` |
| 毎回デザインが変わる | 参照画像を添付し `Keep the exact same character design as the attached reference.` |
| 文字が入る | `No text, no letters, no signage anywhere in the image.` |
| 画面が暗くて投影で沈む | `Bright even lighting. Raise overall value so it reads on a projector.` |

---

## 8. 権利について

**既存ゲームのキャラクター名・作品名をプロンプトに書かないでください。**
生成が拒否されるか、似すぎたものが出て配布できなくなります。
ここにあるのは「アニメ調ビジュアルノベルの立ち絵」という**一般的な様式**の指定だけです。
作りたいのは特定作品の体験ではなく、**ゲームをしているようなプレゼンの体験**です。
