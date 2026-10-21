# CPU の学習（自己対戦データ）

手書きの盤面評価（`src/ai/scoring.ts` の `evaluateState`）を、自己対戦で学習した価値ネットワークに置き換えるための道具です。
データ作り（ロードマップの Phase 0〜2）と、学習・対戦台での比較（Phase 3〜4）の道具があります。

| ファイル | 役割 |
|---|---|
| `src/ai/valueFeatures.ts` | 盤面を 413 個の数値にする。自分から見える情報だけを使う（相手の手札・山札は枚数だけ） |
| `scripts/selfplay.ts` | CPU 同士を対戦させ、途中の盤面と勝敗を書き出す |
| `scripts/selfplay-par.sh` | `selfplay.ts` をコア数ぶん並列に回す |
| `scripts/nn/check_data.py` | 書き出したデータの件数と、勝敗の当てやすさを確かめる（numpy だけで動く） |
| `scripts/nn/train.py` | 価値ネットワークを学習して、重みを JSON で書き出す（PyTorch） |
| `src/ai/valueNet.ts` | その JSON を読んで盤面を評価する（TypeScript だけで計算） |

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
- 時間の目安は 1 試合あたり約 3〜4 コア秒（開発用コンテナでの実測）です。10 コアで 8〜10 時間を見込んでください（最初に `--games 2000` で測ると確実です）。
- 出力は 1 試合 約 40 KB、10 万試合で約 4 GB です。`.cache/` は git の管理外です。
- 途中で止めた場合は、`--seed` を変えて別の `--out` に続きを回せば、あとでまとめて学習に使えます。

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

## 対戦台で比べる（Phase 4）

```sh
scripts/cpu-arena-par.sh --a 5 --b 5 --mirror --games 368 --decks <46 デッキ> --nna .cache/nn/value-v1.json
```

`--nna` / `--nnb` を付けた側だけが、決着していない盤面の評価に学習したネットを使います。`--nn-blend 0.5` を足すと、ネットだけでなく「手書き評価 + ネットの評価 × 0.5」を使います（約 7,000 試合のネットで Lv5 同士 55.0%、ネットだけでは 49.2%。2026-10-21）。`ARENA_PROCS=10` で M1 Max の全コアを使えます。
学習版同士で対戦データを集め直すとき（Phase 5）は、`selfplay-par.sh` に `--nn .cache/nn/value-v1.json` を付けます。
