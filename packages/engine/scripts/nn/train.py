"""自己対戦データ（scripts/selfplay.ts の出力）から価値ネットワークを学習する（ロードマップ Phase 3）。

    python3 scripts/nn/train.py .cache/selfplay/run1 [.cache/selfplay/run2 ...] --out .cache/nn/value-v1.json

- 入力は valueFeatures.ts の特徴、出力は「この盤面から勝つ確率」1 つ。
- 試合単位で 9:1 に学習と検証を分ける（同じ試合の盤面が両方に入ると当たりやすく見えるため）。
- M1 の GPU（MPS）、CUDA、CPU の順に使えるものを使う。
- 検証の logloss が一番よかった時点の重みを JSON で書き出す。ゲーム側は src/ai/valueNet.ts で読む。
- 比較のため、手書き評価（列 "eval"）だけのロジスティック回帰の検証 logloss も出す。
"""
import argparse
import glob
import json
import os
import time

import numpy as np
import torch
from torch import nn


def load_runs(dirs):
    cols, parts = None, []
    for d in dirs:
        meta = json.load(open(os.path.join(d, "features.json")))
        if cols is None:
            cols, version = meta["columns"], meta["version"]
        elif meta["columns"] != cols:
            raise SystemExit(f"{d}: 特徴の列が他のデータと違います（FEATURE_VERSION {meta['version']} と {version}）")
        for f in sorted(glob.glob(os.path.join(d, "shard-*.f32"))):
            a = np.fromfile(f, dtype=np.float32).reshape(-1, len(cols))
            # 別の run の同じ試合番号と混ざらないよう、run ごとにずらす。
            a[:, 1] += len(parts) * 10_000_000
            parts.append(a)
    return cols, version, np.concatenate(parts)


def pick_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def make_model(dim, hidden):
    layers, last = [], dim
    for h in hidden:
        layers += [nn.Linear(last, h), nn.ReLU()]
        last = h
    layers.append(nn.Linear(last, 1))
    return nn.Sequential(*layers)


def evaluate(model, x, y, batch=65536):
    model.eval()
    total = 0.0
    correct = 0
    with torch.no_grad():
        for i in range(0, len(y), batch):
            logits = model(x[i : i + batch]).squeeze(1)
            total += nn.functional.binary_cross_entropy_with_logits(logits, y[i : i + batch], reduction="sum").item()
            correct += ((logits > 0) == (y[i : i + batch] > 0.5)).sum().item()
    return total / len(y), correct / len(y)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("runs", nargs="+")
    ap.add_argument("--out", default=".cache/nn/value.json")
    ap.add_argument("--hidden", default="256,128", help="隠れ層の幅（カンマ区切り）")
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--batch", type=int, default=1024)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--patience", type=int, default=5, help="検証が改善しないエポックがこれだけ続いたら止める")
    args = ap.parse_args()

    cols, version, data = load_runs(args.runs)
    y_all = data[:, 0]
    game = data[:, 1].astype(np.int64)
    x_all = data[:, 3:]
    val = (game * 2654435761 % 10) == 0
    print(f"rows {len(y_all)} (train {int((~val).sum())}, val {int(val.sum())}), features {x_all.shape[1]}, FEATURE_VERSION {version}")

    # 列ごとに平均 0・分散 1 に揃える（値は JSON に入れ、ゲーム側でも同じ変換をする）。
    mean = x_all[~val].mean(axis=0)
    std = x_all[~val].std(axis=0)
    std[std < 1e-6] = 1.0
    x_all = (x_all - mean) / std

    device = pick_device()
    print(f"device {device}")
    xt = torch.tensor(x_all[~val], device=device)
    yt = torch.tensor(y_all[~val], device=device)
    xv = torch.tensor(x_all[val], device=device)
    yv = torch.tensor(y_all[val], device=device)

    # 比較: 手書き評価だけのロジスティック回帰。
    ev = cols.index("eval") - 3
    base = nn.Linear(1, 1).to(device)
    opt = torch.optim.LBFGS(base.parameters(), max_iter=200)

    def closure():
        opt.zero_grad()
        loss = nn.functional.binary_cross_entropy_with_logits(base(xt[:, ev : ev + 1]).squeeze(1), yt)
        loss.backward()
        return loss

    opt.step(closure)
    base_loss, base_acc = evaluate(base, xv[:, ev : ev + 1], yv)
    print(f"baseline (hand-written eval only): val logloss {base_loss:.4f}  accuracy {base_acc * 100:.1f}%")

    hidden = [int(h) for h in args.hidden.split(",") if h]
    model = make_model(x_all.shape[1], hidden).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    best, best_state, stale = float("inf"), None, 0
    n = len(yt)
    for epoch in range(args.epochs):
        t = time.time()
        model.train()
        perm = torch.randperm(n, device=device)
        for i in range(0, n, args.batch):
            idx = perm[i : i + args.batch]
            loss = nn.functional.binary_cross_entropy_with_logits(model(xt[idx]).squeeze(1), yt[idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
        val_loss, val_acc = evaluate(model, xv, yv)
        mark = ""
        if val_loss < best:
            best, best_state, stale, mark = val_loss, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}, 0, " *"
        else:
            stale += 1
        print(f"epoch {epoch + 1:3d}  val logloss {val_loss:.4f}  accuracy {val_acc * 100:.1f}%  ({time.time() - t:.1f}s){mark}")
        if stale >= args.patience:
            break

    model.load_state_dict(best_state)
    linears = [m for m in model if isinstance(m, nn.Linear)]
    out = {
        "featureVersion": version,
        "columns": cols[3:],
        "mean": mean.tolist(),
        "std": std.tolist(),
        # layers[i].w は [出力][入力] の行列。最後の層以外は ReLU を通す。
        "layers": [{"w": l.weight.detach().cpu().numpy().round(6).tolist(), "b": l.bias.detach().cpu().numpy().round(6).tolist()} for l in linears],
        "val": {"logloss": best, "baselineLogloss": base_loss, "rows": int(val.sum())},
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"best val logloss {best:.4f} (baseline {base_loss:.4f}) -> {args.out} ({os.path.getsize(args.out) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
