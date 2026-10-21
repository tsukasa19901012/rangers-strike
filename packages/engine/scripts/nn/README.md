# CPU の学習（自己対戦データ）

手書きの盤面評価（`src/ai/scoring.ts` の `evaluateState`）を、自己対戦で学習した価値ネットワークに置き換えるための道具です。
今あるのはデータを作るところ（ロードマップの Phase 0〜2）までです。

| ファイル | 役割 |
|---|---|
| `src/ai/valueFeatures.ts` | 盤面を 306 個の数値にする。自分から見える情報だけを使う（相手の手札・山札は枚数だけ） |
| `scripts/selfplay.ts` | CPU 同士を対戦させ、途中の盤面と勝敗を書き出す |
| `scripts/selfplay-par.sh` | `selfplay.ts` をコア数ぶん並列に回す |
| `scripts/nn/check_data.py` | 書き出したデータの件数と、勝敗の当てやすさを確かめる（numpy だけで動く） |

## M1 Max で 10 万試合を集める（Phase 2）

```sh
cd packages/engine
npm ci                        # リポジトリの直下で一度だけ
caffeinate -i scripts/selfplay-par.sh --games 100000 --seed 1 --out .cache/selfplay/run1
python3 scripts/nn/check_data.py .cache/selfplay/run1
```

- `caffeinate -i` は回している間 Mac をスリープさせないためのものです。
- 既定ではコア数（M1 Max なら 10）のプロセスで回ります。`SELFPLAY_PROCS=8` のように減らすと、その間も Mac を使いやすくなります。
- 途中経過は `.cache/selfplay/run1/shard-<k>.jsonl`（1 試合 1 行）の行数で分かります: `cat .cache/selfplay/run1/shard-*.jsonl | wc -l`
- 時間の目安は 1 試合あたり約 4〜5 コア秒です。10 コアで 12〜14 時間を見込んでください（最初に `--games 2000` で測ると確実です）。
- 出力は 1 試合 約 29 KB、10 万試合で約 3 GB です。`.cache/` は git の管理外です。
- 途中で止めた場合は、`--seed` を変えて別の `--out` に続きを回せば、あとでまとめて学習に使えます。

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
