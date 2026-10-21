"""train.py が書いた重み（JSON）を、エンジンに同梱する小さな TS ファイルに詰める（ロードマップ Phase 4）。

    python3 scripts/nn/pack.py .cache/nn/value-v1.json --out src/ai/weights/valueNetV1.ts

- 層の重み w は float16 にして base64 の文字列で持つ（2.9 MB の JSON が 400 KB ほどになる）。
- mean・std・b は数が少ないので数値のまま（有効数字 7 桁）。
- 読むのは src/ai/valueNet.ts の createValueNet（w が文字列なら float16 として読む）。
- 詰める前後で、無作為な入力に対する logit の差の最大値を出す。
"""
import argparse
import base64
import json
import os

import numpy as np


def forward(layers, x):
    for i, (w, b) in enumerate(layers):
        x = x @ w.T + b
        if i < len(layers) - 1:
            x = np.maximum(x, 0)
    return x[:, 0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("weights")
    ap.add_argument("--out", default="src/ai/weights/valueNetV1.ts")
    ap.add_argument("--name", default="VALUE_NET_V1")
    args = ap.parse_args()

    src = json.load(open(args.weights))
    full = [(np.array(l["w"], dtype=np.float32), np.array(l["b"], dtype=np.float32)) for l in src["layers"]]
    half = [(w.astype(np.float16).astype(np.float32), b) for w, b in full]
    x = np.random.default_rng(0).standard_normal((4096, full[0][0].shape[1])).astype(np.float32)
    diff = np.abs(forward(full, x) - forward(half, x)).max()

    g = lambda v: float(f"{v:.7g}")
    packed = {
        "featureVersion": src["featureVersion"],
        "mean": [g(v) for v in src["mean"]],
        "std": [g(v) for v in src["std"]],
        "layers": [
            {"out": w.shape[0], "inp": w.shape[1], "w": base64.b64encode(w.astype("<f2").tobytes()).decode(), "b": [g(v) for v in b.tolist()]}
            for w, b in full
        ],
    }
    val = src.get("val", {})
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        f.write(f"// scripts/nn/pack.py が {os.path.basename(args.weights)} から作ったファイル。手で書き換えない。\n")
        f.write(f"// 検証 logloss {val.get('logloss', float('nan')):.4f}（手書き評価だけ {val.get('baselineLogloss', float('nan')):.4f}）、検証 {val.get('rows', 0)} 盤面。\n")
        f.write('import type { ValueNetWeights } from "../valueNet";\n\n')
        f.write(f"export const {args.name}: ValueNetWeights = {json.dumps(packed, separators=(',', ':'))};\n")
    print(f"{args.out}: {os.path.getsize(args.out) / 1e3:.0f} kB, float16 max |logit diff| {diff:.5f}")


if __name__ == "__main__":
    main()
