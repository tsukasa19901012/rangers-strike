# @rangers-strike/engine — ルールエンジンと CPU AI

ゲームの状態（`GameState`）・合法手・アクション適用・効果解決・CPU AI を持つパッケージです。
UI を持たず、`@rangers-strike/cards` のカードデータだけに依存します。ルールの正は [docs/rules](../../docs/rules/README.md) です。

## 主な API

| API | 場所 |
|---|---|
| `createStarterGame` / `createGame` | `src/verticalSlice/createStarterGame.ts`、`src/core/createGame.ts` |
| `getLegalActions` / `isLegalAction` | `src/core/legalActions.ts` |
| `applyAction` | `src/core/applyAction.ts` |
| `pickCpuAction(state, playerId, level)` | `src/ai/index.ts`（レベル設定は `src/ai/types.ts` の `getCpuLevelConfig`） |
| `formatGameLog` / `formatActionError` | `src/log/` |

UI 側（`packages/client-core`）は合法手をそのまま選択肢にし、選ばれたアクションを `applyAction` に渡すだけです。

## 構成

| ディレクトリ | 内容 |
|---|---|
| `src/core/` | 状態の生成、合法手、アクション適用、パワー、乱数 |
| `src/rules/` | フェイズ・ラッシュ・バトル・支払いなどのルールと、弾ごとのカード効果（`legend1`〜`3`、`rs`、`rk`、`rm`、`bk`、`xg1`〜`xg7`、`promo` 等） |
| `src/dsl/` | `@rangers-strike/cards` の DSL を解釈して効果を実行する |
| `src/keywords/` | キーワード能力（チェイス・ライド・ウイング・モーフ等） |
| `src/events/` | イベントキューとリスナー |
| `src/effects/` | オペレーション解決などの効果ブリッジ |
| `src/ai/` | CPU AI（ヒューリスティック・探索・チャージの先読み・ターン単位の読み・NC の並べ方・価値ネットワーク） |
| `src/ai/weights/` | Lv5 が使う価値ネットワークの重み（`scripts/nn/pack.py` が作る。手で書き換えない） |
| `src/cardSpec/`, `src/rulesSpec/` | カードごと・ルール章ごとのテスト |
| `src/verticalSlice/` | スターター対戦の生成と、CPU 同士の長い対戦テスト |
| `scripts/` | CPU の対戦台・監査・負荷テスト・デバッグ用スクリプト |

## 効果を書くときの注意

- 「○○を持つ自軍コマンド」のようにコマンドのカテゴリを見るときは、`cardCategories`（印刷されたカテゴリ）ではなく `src/core/catalog.ts` の `commandCategoriesOf(state, playerId, cardId)` を使います。XG7-055〜059 のドーパント（自軍ターン中、コマンドゾーンでもカテゴリが追加される）や XG1-033・XG6-013/060 で増えたカテゴリを含めるためです。
- 特定のカード名を見るときは `src/core/cardNames.ts` の `hasNameOrAlias` を使います（「※これは「X」としてつかえる」を含めるため）。

## テスト

```bash
npm test -w @rangers-strike/engine            # test:unit と test:sim の両方
npm run test:unit -w @rangers-strike/engine   # シミュレーション以外
npm run test:sim -w @rangers-strike/engine    # src/verticalSlice とモンキーテスト（長時間・直列実行）
npm run test:monkey -w @rangers-strike/engine # ランダム対戦のモンキーテストだけ
```

CI は `test:sim` を `test:sim:starters`（simulateAllStarters）・`test:sim:monkey`（2 つのモンキーテスト）・`test:sim:rest`（それ以外の `src/verticalSlice`）に分けて並列に流します。

## CPU の強さを測る

`scripts/cpu-arena.ts` は CPU 同士を、席と先攻を入れ替えて対戦させます。

```bash
cd packages/engine
npx tsx scripts/cpu-arena.ts --a 3 --b 2 --games 40 [--decks abarenoh,dekaranger,magiking]
ARENA_PROCS=4 scripts/cpu-arena-par.sh --a 3 --b 2 --games 40   # 4 プロセスで回して合算
```

`--b-src <別の作業ツリーの src/ai/index.ts>` で改良前の AI と比べられます。
学習した価値ネットワークを試すときは `--nna <重みの JSON> [--nn-blend 0.5]`、レベル設定を片側だけ変えるときは `--oa` / `--ob`（例 `--ob '{"valueNetBlend":0}'` で B を手書きの評価だけの Lv5 にする）を使います。
自己対戦データの集め方・学習・重みの同梱は [scripts/nn/README.md](scripts/nn/README.md) にまとめています。
スターター同士の行動の内訳は `npx tsx scripts/starter-sim-stats.ts --p1 w-impact-b --p2 w-impact-a --games 10` で数えられます。

## CPU・エンジンを速くするとき

- CPU の探索の間（`src/ai/index.ts` の `pickCpuAction` の中）は状態を書き換えないので、`src/core/searchCache.ts` の表で合法手・`applyAction` の結果・BP 等を使い回します。状態だけで決まる計算はここに載せます。
- 弾ごとのフック（`src/rules/xg1`〜`xg7` の BP の補正・`applyAction` の後処理）は、探索の間はその弾のカードが対局に無ければ呼びません（`src/rules/setHookGates.ts`）。フックに他の弾のカードの ID を書いたら `SET_HOOK_EXTRA_IDS` にも足します（`setHookGates.test.ts` が突き合わせます）。呼ばないフックが本当に何もしないかは、`RS_HOOK_GATE_CHECK=1 npm run test:unit -w @rangers-strike/engine` で確かめます（呼ばないことにしたフックも呼んで比べ、違えば例外にします）。
- 選ぶ手を変えない変更は、変更の前後で `scripts/cpu-move-hash.ts` の出力（同じ seed の対局の手順のハッシュ）を diff して確かめます。

```bash
npx tsx scripts/cpu-move-hash.ts 5 0 16 > before.txt   # Lv5 の 16 局（Lv1 なら 0 46 で全スターター）
```

2026-10-25 の見直し（候補が 1 つの読みを省く、支払いの試し打ちを必要な分だけにする、弾ごとのフックを絞る等）で、
選ぶ手は同じまま、Lv5 同士の 4 局の思考時間は 42.5 秒 → 26.4 秒になりました（1 手あたり 25 ms → 16 ms）。

## ビルド

`npm run build -w @rangers-strike/engine`（`tsc` で `dist/` に出力）。Vita 版とブラウザ版は `dist` ではなく、
`apps/vita/scripts/build-engine.ts` で `src/` を esbuild でバンドルして使います。
