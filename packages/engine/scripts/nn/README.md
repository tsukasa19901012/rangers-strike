# CPU の学習（自己対戦データ）

手書きの盤面評価（`src/ai/scoring.ts` の `evaluateState`）を、自己対戦で学習した価値ネットワークに置き換えるための道具です。
データ作り（ロードマップの Phase 0〜2）、学習・対戦台での比較（Phase 3〜4）、ゲームへの同梱、学習版で集め直す（Phase 5）ための道具があります。
今の Lv5 は、手書きの評価に同梱のネット（`src/ai/weights/valueNetV1.ts`）の評価を 0.5 倍して足しています。
同梱しているのは、スターターとブログ・wiki 等のデッキの自己対戦を足して学習した v5r です（2026-10-27）。

| 版 | 学習データ | v1 の Lv5 との対戦 |
|---|---|---|
| v1 | 手書き評価の CPU 同士 21.8 万試合（run1・run2） | ―（手書きだけの Lv5 に 62%） |
| v2 | run1〜run3（新しい Lv5 中心の 4 万試合を足す） | 52.0%（736 試合、±3.7%） |
| v3a | run1〜run4（run3・run4 を 2 倍に重み付け） | 50.6%（720 試合、±3.7%） |
| **v3b** | **run3・run4 だけ（新しい Lv5 中心の 16 万試合）** | **54.3%（6 seed 2,154 試合、±2.1%）。手書きだけの Lv5 には 65.2%** |

古い CPU の試合を混ぜた v2・v3a は検証 logloss では同等以上でも、対戦では v1 と差がありませんでした。強くなった CPU 同士の試合だけで学び直すのが効きます。

v3b のあとは、デッキを `--decks starters,arena`（スターター 46 個＋ブログ・wiki 等 135 個）にして集め直しました。比べた相手は v3b の Lv5（Lv5 同士、ミラー、starters と arena × seed 2 つ × 920 試合）。

| 版 | 学習データ | v3b の Lv5 との対戦 |
|---|---|---|
| v4 / v4r | run3・run4・run6（run6 は starters,arena の 10 万試合。v4r は同じデータで学習し直したもの） | 53.2% / 54.9%（各 3,670 試合、±1.6%） |
| **v5r** | **run3・run4・run6・run7（run7 も starters,arena の 10 万試合、2026-10-26 の CPU）** | **53.8%（3,671 試合、±1.6%）。v4r には 50.4%（v5・v5r の 7,338 試合、±1.1%）** |

- run6 を 1/4・1/2・全部と増やすと v3b への勝率は 50.4%・52.6%・54.0% と上がりましたが、run7 でさらに 10 万試合足しても v4r との差はほぼありませんでした（今の幅 256,128 では、このデータの足し方では頭打ち）。
- 同じデータで学習し直すと、勝率は 2 ポイントほどぶれます（v4 と v4r）。

| ファイル | 役割 |
|---|---|
| `src/ai/valueFeatures.ts` | 盤面を 413 個の数値にする。自分から見える情報だけを使う（相手の手札・山札は枚数だけ） |
| `scripts/selfplay.ts` | CPU 同士を対戦させ、途中の盤面と勝敗を書き出す |
| `scripts/selfplay-par.sh` | `selfplay.ts` をコア数ぶん並列に回す |
| `scripts/nn/check_data.py` | 書き出したデータの件数と、勝敗の当てやすさを確かめる（numpy だけで動く） |
| `scripts/nn/train.py` | 価値ネットワークを学習して、重みを JSON で書き出す（PyTorch） |
| `src/ai/valueNet.ts` | その JSON を読んで盤面を評価する（TypeScript だけで計算） |
| `scripts/nn/pack.py` | 重みの JSON を、ゲームに同梱する TS ファイル（float16 + base64）に詰める |

## M1 Max で 10 万試合を集める（Phase 2）

```sh
cd packages/engine
npm ci                        # リポジトリの直下で一度だけ
npx turbo run build --filter=@rangers-strike/cards   # 初回だけ（cards の dist が無いと selfplay が起動しない）
caffeinate -i scripts/selfplay-par.sh --games 100000 --seed 1 --out .cache/selfplay/run1
python3 scripts/nn/check_data.py .cache/selfplay/run1
```

- `caffeinate -i` は回している間 Mac をスリープさせないためのものです。
- 既定ではコア数（M1 Max なら 10）のプロセスで回ります。`SELFPLAY_PROCS=8` のように減らすと、その間も Mac を使いやすくなります。
- 途中経過は `.cache/selfplay/run1/shard-<k>.jsonl`（1 試合 1 行）の行数で分かります: `cat .cache/selfplay/run1/shard-*.jsonl | wc -l`
- 時間の目安は、既定の組み合わせで M1 Max（10 プロセス、ほかの重い処理を止めた状態）が約 7 試合/秒、10 万試合で約 3.5 時間です（2026-10-21 の実測）。Lv5 同士を 50% にした組み合わせでは約 3.7 試合/秒に落ちます。開発用コンテナでは 1 試合あたり約 3〜4 コア秒です。最初に `--games 2000` で測ると確実です。
- 出力は 1 試合 約 40 KB、10 万試合で約 4 GB です。`.cache/` は git の管理外です。
- 途中で止めた場合は、`--seed` を変えて別の `--out` に続きを回せば、あとでまとめて学習に使えます。
- 対戦するデッキは既定でスターター 46 個です。`--decks starters,arena` で [arena-decks/](../../arena-decks/README.md) の大会・atwiki・ブログのデッキも混ぜられます（`wiki`・`blog`・`livedoor` だけ、や id の列挙もできます。livedoor の 373 個は `arena` に入らないので、混ぜるときは `--decks starters,arena,livedoor`）。
- エンジンの例外で 1 試合が落ちても、そのシャードの残りは続けます。落ちた試合は `shard-<k>.jsonl` に `error` 付きで残るので、`selfplay.ts --seed <同じ値> --only <試合番号>` で再現できます。

## 入力に入れているもの

- 盤面: フェイズ、手番、ダメージ、各ゾーンの枚数、バトルエリア 7 枠とラッシュエリア 5 枠のユニット（BP・SP・サイズ・行動済み・NC が成立しているか）。自分と相手の両方。
- 今の手書き評価（`evaluateState`）の値。ネットはここからの補正を学べばよい。
- 自分の手札: 種類、出せる枚数、必要パワー別の枚数、効果の種類別の枚数。
- 自分の残り山札: 必要パワー・ナンバー・カテゴリ別の枚数、ゾードアップとその素材、回収・サーチ効果を持つカード。
- 自分のデッキレシピ全体（デッキの性格）: 必要パワーの分布、ナンバー、カテゴリ、サイズ、SP、ゾードアップと素材の割合、一番多い特徴の割合、回収効果と効果の種類（撃破・BP 増減・カウンター・常駐・特徴参照など）の割合。
- 相手の手札・山札の中身は入れません（枚数だけ）。

カードは ID ではなく性能と効果の種類で表すので、スターターやカードが増えても同じ列のまま使えます。
効果の種類はカードの効果文の言い回しから見分けています（`valueFeatures.ts` の `EFFECT_KINDS`・`RECOVERY_KINDS`）。

## 対戦の組み合わせ

- デッキは 46 スターターから毎試合無作為に 2 つ選びます（ミラー以外も入ります）。
- レベルは `--mix` で決めます。既定は `2:2=45,3:2=20,3:3=20,5:5=15`（Lv2 同士 45%、Lv3 と Lv2 が 20%、…）。
- `--explore 0.03` で、3% の手を無作為な合法手にできます（似た局面ばかりになるのを防ぐ）。既定は 0 です。
- 1 試合から `--positions`（既定 12）個の盤面を無作為に選び、両方のプレイヤーから見た行を書くので、1 試合 24 行になります。
- 決着しなかった試合（6,000 手を超えたもの）は捨てます。

## データの形式

`<out>/shard-<k>.f32` は Float32 の行の並びで、列名は `<out>/features.json` にあります。
1 行 = `[label, game, turn, ...特徴]`。`label` はその行のプレイヤーが最後に勝ったら 1 です。
学習と検証は `game` で分けてください（同じ試合の盤面が両方に入ると、当たりやすく見えてしまいます）。

```python
import json, numpy as np
cols = json.load(open("features.json"))["columns"]
rows = np.fromfile("shard-0.f32", dtype=np.float32).reshape(-1, len(cols))
```

特徴の列を変えたら `valueFeatures.ts` の `FEATURE_VERSION` を上げてください。古いデータとは混ぜられません。

## 学習する（Phase 3）

```sh
pip3 install torch numpy      # M1 では GPU（MPS）が自動で使われる
python3 scripts/nn/train.py .cache/selfplay/run1 --out .cache/nn/value-v1.json
```

- 検証の logloss が一番よかったエポックの重みを書き出します。手書き評価だけの場合の logloss も並べて出すので、下回っていれば Phase 3 の完了条件を満たします。
- 隠れ層の幅は `--hidden 256,128`（既定）で変えられます。
- 複数の run をまとめて学習できます: `train.py .cache/selfplay/run1 .cache/selfplay/run2 ...`
- `features.json` の無いフォルダを渡すと、その下の run（`run2/chunk-0` など、小分けにして回したもの）をまとめて読みます。
- 途中で止めたシャードの最後の欠けた行は、読むときに切り捨てます。
- run3・run4 は `--mix 5:5=50,5:3=20,3:3=15,2:2=15` で集めたものです。v3b は `train.py .cache/selfplay/run3 .cache/selfplay/run4 --out .cache/nn/value-v3b.json`。run6・run7 は同じ `--mix` に `--decks starters,arena` を足したもので、v5r は `train.py .cache/selfplay/run3 .cache/selfplay/run4 .cache/selfplay/run6 .cache/selfplay/run7 --out .cache/nn/value-v5r.json`。
- `--run-weights 1,1,4` のように、run ごとに学習での重みを付けられます（run と同じ順）。新しい CPU の試合を重く見たいときに使います。run を 2 つ以上渡すと、最後に run ごとの検証 logloss も出します。
- データは CPU のメモリに置き、バッチごとに GPU へ送ります。MPS は 1 つのテンソルに約 21 億要素までしか載らないので、以前は 500 万行を超えると落ちていました。
- 2026-10-22 の value-v1（21.8 万試合、513 万行）は、MPS で 11 エポック約 100 秒でした。検証 logloss は 0.4145 で、手書き評価だけだと 0.5590 です。

## 対戦台で比べる（Phase 4）

```sh
scripts/cpu-arena-par.sh --a 5 --b 5 --mirror --games 368 --decks <46 デッキ> --nna .cache/nn/value-v1.json
```

`--nna` / `--nnb` を付けた側だけが、決着していない盤面の評価に学習したネットを使います。`--nn-blend 0.5` を足すと、ネットだけでなく「手書き評価 + ネットの評価 × 0.5」を使います（21.8 万試合の value-v1 で、Lv5 同士 62.2% と 61.2%（seed 2 つ）、ネットだけでは 56.9%。Lv2 ではネットだけだと 46.1% で、手書きに負けます）。`ARENA_PROCS=10` で M1 Max の全コアを使えます。
46 デッキの一覧は、`src/verticalSlice/starterDeckIds.ts` の `ALL_STARTER_DECK_IDS` をカンマでつないだものです（以下では `.cache/decks.txt` に書いておいたものを使います）。

## 学習版で集め直す（Phase 5）

Lv5 は同梱のネットをもう使っているので、`--nn` は付けずに、Lv5 を多めにした組み合わせで集めます。

```sh
scripts/selfplay-par.sh --games 2000 --seed 500000 --mix 5:5=50,5:3=20,3:3=15,2:2=15 --out .cache/selfplay/run3/chunk-0
```

`--nn <JSON>` を付けると、どのレベルも手書きの評価を使わず、ネットの評価だけで指します。本番の Lv5 とは違う CPU になるので、ネットだけの CPU を試すとき以外は使いません。
集めたら前の run と合わせて学習し、新しい重みを `--nna <新しい JSON> --nn-blend 0.5` の側にして、同梱の重みを使う Lv5（`--nnb` なし）と対戦台で比べます。

## ゲームに同梱する

Lv5 は、手書きの評価に同梱のネットの評価を 0.5 倍して足す（`ai/types.ts` の `valueNetBlend`）。重みを入れ替えるときは:

```bash
python3 scripts/nn/pack.py .cache/nn/value-v5r.json --out src/ai/weights/valueNetV1.ts
```

- 層の重みは float16 を base64 にした文字列になる（2.9 MB の JSON が 400 KB ほど）。詰める前後の logit の差の最大値も出す。
- 入れ替える前に、今の Lv5 と対戦台で比べる: `scripts/cpu-arena-par.sh --a 5 --b 5 --ob '{"valueNetBlend":0}' --decks "$(cat .cache/decks.txt)" --mirror --games 368`（B が手書きの評価だけの Lv5）。
- `setValueEvaluator` で外から評価を差し替えているとき（`--nna` など）は、そちらが優先される。
