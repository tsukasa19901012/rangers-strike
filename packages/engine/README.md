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
| `src/ai/` | CPU AI（ヒューリスティック・探索・チャージの先読み・NC の並べ方・価値ネットワーク） |
| `src/ai/weights/` | Lv5 が使う価値ネットワークの重み（`scripts/nn/pack.py` が作る。手で書き換えない） |
| `src/cardSpec/`, `src/rulesSpec/` | カードごと・ルール章ごとのテスト |
| `src/verticalSlice/` | スターター対戦の生成と、CPU 同士の長い対戦テスト |
| `scripts/` | CPU の対戦台・監査・負荷テスト・デバッグ用スクリプト |

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

## ビルド

`npm run build -w @rangers-strike/engine`（`tsc` で `dist/` に出力）。Vita 版とブラウザ版は `dist` ではなく、
`apps/vita/scripts/build-engine.ts` で `src/` を esbuild でバンドルして使います。
