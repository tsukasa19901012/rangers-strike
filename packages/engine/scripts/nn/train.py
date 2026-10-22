"""自己対戦データ（scripts/selfplay.ts の出力）から価値ネットワークを学習する（ロードマップ Phase 3）。

    python3 scripts/nn/train.py .cache/selfplay/run1 [.cache/selfplay/run2 ...] --out .cache/nn/value-v1.json

- 入力は valueFeatures.ts の特徴、出力は「この盤面から勝つ確率」1 つ。
- 試合単位で 9:1 に学習と検証を分ける（同じ試合の盤面が両方に入ると当たりやすく見えるため）。
- M1 の GPU（MPS）、CUDA、CPU の順に使えるものを使う。データは CPU のメモリに置き、バッチごとに GPU へ送る
  （MPS は 1 つのテンソルに約 21 億要素までしか載らず、500 万行 × 413 列を超えると全部は載せられないため）。
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


def load_runs(tops):
    """全シャードの行と、試合ごとに一意な番号（int64）と、各行がコマンドラインの何番目の run から来たかを返す。"""
    cols, parts, games, source = None, [], [], []
    # features.json の無いフォルダは、その下の run（小分けにして回したもの）をまとめて読む。
    dirs = [(k, d) for k, top in enumerate(tops) for d in ([top] if os.path.exists(os.path.join(top, "features.json")) else sorted(glob.glob(os.path.join(top, "*", ""))))]
    for k, d in dirs:
        meta = json.load(open(os.path.join(d, "features.json")))
        if cols is None:
            cols, version = meta["columns"], meta["version"]
        elif meta["columns"] != cols:
            raise SystemExit(f"{d}: 特徴の列が他のデータと違います（FEATURE_VERSION {meta['version']} と {version}）")
        for f in sorted(glob.glob(os.path.join(d, "shard-*.f32"))):
            raw = np.fromfile(f, dtype=np.float32)
            # 途中で止めたシャードは最後の行が欠けていることがあるので、行の幅で切り詰める。
            a = raw[: len(raw) // len(cols) * len(cols)].reshape(-1, len(cols))
            # 別のシャード・run の同じ試合番号と混ざらないよう、ファイルごとにずらす（float32 では桁が足りないので int64 で持つ）。
            games.append(a[:, 1].astype(np.int64) + len(parts) * 10_000_000)
            source.append(np.full(len(a), k, dtype=np.int8))
            parts.append(a)
    return cols, version, np.concatenate(parts), np.concatenate(games), np.concatenate(source)


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


def evaluate(model, x, y, device, batch=65536):
    model.eval()
    total = 0.0
    correct = 0
    with torch.no_grad():
        for i in range(0, len(y), batch):
            yb = y[i : i + batch].to(device)
            logits = model(x[i : i + batch].to(device)).squeeze(1)
            total += nn.functional.binary_cross_entropy_with_logits(logits, yb, reduction="sum").item()
            correct += ((logits > 0) == (yb > 0.5)).sum().item()
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
    ap.add_argument("--run-weights", default="", help="run ごとの学習での重み（カンマ区切り、run と同じ順。例 1,1,4 で 3 つめの run を 4 倍重く見る）")
    args = ap.parse_args()

    cols, version, data, game, source = load_runs(args.runs)
    y_all = data[:, 0]
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
    run_w = np.array([float(w) for w in args.run_weights.split(",")] if args.run_weights else [1.0] * len(args.runs), dtype=np.float32)
    if len(run_w) != len(args.runs):
        raise SystemExit("--run-weights の数が run の数と違います")
    wt = torch.from_numpy(run_w[source[~val]])
    if args.run_weights:
        print("run weights " + ", ".join(f"{r}={w:g} ({int((source[~val] == k).sum())} rows)" for k, (r, w) in enumerate(zip(args.runs, run_w))))
    xt = torch.from_numpy(np.ascontiguousarray(x_all[~val]))
    yt = torch.from_numpy(np.ascontiguousarray(y_all[~val]))
    xv = torch.from_numpy(np.ascontiguousarray(x_all[val]))
    yv = torch.from_numpy(np.ascontiguousarray(y_all[val]))
    del x_all

    # 比較: 手書き評価だけのロジスティック回帰。
    ev = cols.index("eval") - 3
    base = nn.Linear(1, 1).to(device)
    opt = torch.optim.LBFGS(base.parameters(), max_iter=200)

    ev_col, yt_dev = xt[:, ev : ev + 1].contiguous().to(device), yt.to(device)

    def closure():
        opt.zero_grad()
        loss = nn.functional.binary_cross_entropy_with_logits(base(ev_col).squeeze(1), yt_dev)
        loss.backward()
        return loss

    opt.step(closure)
    base_loss, base_acc = evaluate(base, xv[:, ev : ev + 1], yv, device)
    del ev_col, yt_dev
    print(f"baseline (hand-written eval only): val logloss {base_loss:.4f}  accuracy {base_acc * 100:.1f}%")

    hidden = [int(h) for h in args.hidden.split(",") if h]
    model = make_model(xt.shape[1], hidden).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    best, best_state, stale = float("inf"), None, 0
    n = len(yt)
    for epoch in range(args.epochs):
        t = time.time()
        model.train()
        perm = torch.randperm(n)
        for i in range(0, n, args.batch):
            idx = perm[i : i + args.batch]
            w = wt[idx].to(device)
            loss = (nn.functional.binary_cross_entropy_with_logits(model(xt[idx].to(device)).squeeze(1), yt[idx].to(device), reduction="none") * w).sum() / w.sum()
            opt.zero_grad()
            loss.backward()
            opt.step()
        val_loss, val_acc = evaluate(model, xv, yv, device)
        mark = ""
        if val_loss < best:
            best, best_state, stale, mark = val_loss, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}, 0, " *"
        else:
            stale += 1
        print(f"epoch {epoch + 1:3d}  val logloss {val_loss:.4f}  accuracy {val_acc * 100:.1f}%  ({time.time() - t:.1f}s){mark}")
        if stale >= args.patience:
            break

    model.load_state_dict(best_state)
    # run ごとの検証 logloss（新しい run の盤面にどれだけ合っているかを見る）。
    if len(args.runs) > 1:
        sv = torch.from_numpy(source[val])
        for k, r in enumerate(args.runs):
            m = sv == k
            if m.any():
                l, acc = evaluate(model, xv[m], yv[m], device)
                bl, _ = evaluate(base, xv[m][:, ev : ev + 1], yv[m], device)
                print(f"  {r}: val logloss {l:.4f} (hand-written {bl:.4f}), accuracy {acc * 100:.1f}%, {int(m.sum())} rows")
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
