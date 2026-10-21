"""自己対戦データ（scripts/selfplay.ts の出力）を読んで、件数と簡単な当てやすさを確かめる。

    python3 scripts/nn/check_data.py .cache/selfplay/run1

numpy だけで動く。試合単位で 9:1 に分け、検証側で次の 2 つの勝敗予測を比べる。
  - eval: 今の手書き評価（列 "eval"）だけを使ったロジスティック回帰（Phase 3 の比較相手）
  - linear: 全部の列を使ったロジスティック回帰（ネットを使う前の目安）
"""
import glob
import json
import os
import sys

import numpy as np


def load(run_dir):
    cols = json.load(open(os.path.join(run_dir, "features.json")))["columns"]
    raws = [np.fromfile(f, dtype=np.float32) for f in sorted(glob.glob(os.path.join(run_dir, "shard-*.f32")))]
    # 途中で止めたシャードは最後の行が欠けていることがあるので、行の幅で切り詰める。
    parts = [r[: len(r) // len(cols) * len(cols)].reshape(-1, len(cols)) for r in raws]
    return cols, np.concatenate(parts)


def fit_logistic(x, y, steps=300, lr=0.5):
    w = np.zeros(x.shape[1], dtype=np.float64)
    b = 0.0
    for _ in range(steps):
        p = 1 / (1 + np.exp(-(x @ w + b)))
        g = p - y
        w -= lr * (x.T @ g / len(y) + 1e-4 * w)
        b -= lr * g.mean()
    return lambda z: 1 / (1 + np.exp(-(z @ w + b)))


def report(name, p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    loss = -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
    acc = np.mean((p > 0.5) == (y > 0.5))
    print(f"  {name:7s} logloss {loss:.4f}  accuracy {acc * 100:.1f}%")


def main():
    run_dir = sys.argv[1] if len(sys.argv) > 1 else ".cache/selfplay/run"
    cols, data = load(run_dir)
    metas = [json.loads(l) for f in glob.glob(os.path.join(run_dir, "shard-*.jsonl")) for l in open(f) if l.strip()]
    y, game, x = data[:, 0].astype(np.float64), data[:, 1].astype(np.int64), data[:, 3:].astype(np.float64)
    print(f"rows {len(y)}, games {len(np.unique(game))} decided / {len(metas)} played, features {x.shape[1]}, label mean {y.mean():.3f}")
    draws = sum(1 for m in metas if m["winner"] is None and "error" not in m)
    errors = sum(1 for m in metas if "error" in m)
    print(f"draws {draws}, errors {errors}, avg sec/game {np.mean([m['ms'] for m in metas if 'ms' in m]) / 1000:.2f}")
    val = (game * 2654435761 % 10) == 0
    ev = cols.index("eval") - 3
    print("validation (10% of games):")
    report("eval", fit_logistic(x[~val][:, [ev]], y[~val])(x[val][:, [ev]]), y[val])
    report("linear", fit_logistic(x[~val], y[~val])(x[val]), y[val])


if __name__ == "__main__":
    main()
