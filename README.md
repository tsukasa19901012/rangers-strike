# レンジャーズストライク（Rangers Strike）

カードゲーム「レンジャーズストライク」（レジェンド 1〜9 弾、ライダー系、クロスギャザー等）の対戦シミュレーターです。
カードデータ・ルールエンジン・UI を npm workspaces + Turborepo のモノレポで管理しています。

- **プレイ形式:** 1 人 vs CPU（CPU レベル Lv1〜Lv5）
- **対応カード:** フルプレイアブル **1,832 枚**（コア 1,052 枚 + promoted 780 枚。コマンダーカードは対象外）
- **UI:** [PocketJS](https://github.com/pocket-stack/pocketjs)（Solid）で書いたブラウザ版と PS Vita 版。ゲーム進行は共有パッケージ `packages/client-core` にまとめ、各アプリは描画と入力だけを持ちます
- Next.js 版（`apps/web`）は旧版で、削除予定です。新しい機能は PocketJS 版に入れます

## リポジトリ構成

```
rangers-strike/
├── apps/
│   ├── web-pocket/     # ブラウザ版（PocketJS）。Web の本番はこちら
│   ├── vita/           # PS Vita 版（PocketJS）。PocketJS ツールチェーンもここに置く
│   └── web/            # 旧 Next.js 版（削除予定）
├── packages/
│   ├── cards/          # カード定義・生成カタログ・DSL・スターターデッキ・デッキ構築ルール
│   ├── engine/         # ルールエンジン（状態・合法手・アクション適用）と CPU AI
│   └── client-core/    # 画面に依存しないクライアント層（試合進行・表示モデル・入力・保存）
├── docs/               # ルールブック（docs/rules）・設計・Wiki 収集物・検証記録
└── scripts/            # リポジトリ横断のメンテナンススクリプト
```

| パッケージ | 役割 | README |
|---|---|---|
| `@rangers-strike/web-pocket` | ブラウザ版。静的サイトとしてビルドする | [apps/web-pocket](apps/web-pocket/README.md) |
| `@rangers-strike/vita` | PS Vita 版（VPK） | [apps/vita](apps/vita/README.md) |
| `@rangers-strike/web` | 旧 Next.js 版（削除予定） | [apps/web](apps/web/README.md) |
| `@rangers-strike/client-core` | DOM・Node・PocketJS に依存しない共有クライアント層 | [packages/client-core](packages/client-core/README.md) |
| `@rangers-strike/engine` | ゲームルールエンジン・CPU AI | [packages/engine](packages/engine/README.md) |
| `@rangers-strike/cards` | カードカタログ・効果データ・デッキルール | [packages/cards](packages/cards/README.md) |

依存の向きは `cards` ← `engine` ← `client-core` ← `web-pocket` / `vita` です（`apps/web` は `cards` と `engine` を直接使います）。

## 必要環境

- Node.js 20 以上
- npm 10 以上（`packageManager` は `npm@10.8.2`。`npm ci` を推奨）
- PS Vita 向け VPK を作る場合のみ VitaSDK・Rust（[apps/vita/README.md](apps/vita/README.md) 参照）

## セットアップと起動

```bash
git clone https://github.com/tsukasa19901012/rangers-strike.git
cd rangers-strike
npm ci
npm run build                 # cards → engine → client-core（と apps/web）を turbo でビルド
```

ブラウザ版（PocketJS）:

```bash
cd apps/web-pocket
npm run setup                 # PocketJS ツールチェーン（apps/vita/toolchain）と Noto Sans JP を取得
npm run web:dev               # dist/ をビルドして http://127.0.0.1:8140/ で配信
```

Vita 版のブラウザ確認（実機・エミュレータ不要）:

```bash
cd apps/vita
npm run setup
npm run web:preview           # http://127.0.0.1:8130/ を開いて "main" を選ぶ
```

ルートの `npm run dev` は旧 Next.js 版（`apps/web`、http://localhost:3000）を起動します。

## ビルド・テスト・型チェック

ルートのスクリプトは Turborepo で各ワークスペースの同名スクリプトを実行します。

| コマンド | 内容 |
|---|---|
| `npm run build` | `cards` / `engine` / `client-core` の `tsc` と `apps/web` の `next build` |
| `npm test` | `cards` / `engine` / `client-core` / `apps/web` の Vitest（engine は長時間のシミュレーションテストを含む） |
| `npm run typecheck` | 各ワークスペースの `tsc --noEmit`（`apps/vita` はビルドスクリプトのみ。UI は `pocket:check` で検査） |

PocketJS 版（`apps/web-pocket`・`apps/vita`）のビルドと検査は、turbo / CI に乗らないよう `web:*` / `pocket:*` という名前のスクリプトにしてあり、各ディレクトリで実行します。

個別に実行する例:

```bash
npm test -w @rangers-strike/client-core
npm run test:unit -w @rangers-strike/engine    # シミュレーション以外
npm run test:sim -w @rangers-strike/engine     # 縦切り・モンキーテスト（長時間）
npm run audit:catalog-parity -w @rangers-strike/cards
```

## CI

`.github/workflows/ci.yml` が `main` / `master` への push と全 PR で、`npm test` と `npm run build` と同じ内容を 3 種類のジョブに分けて並列に実行します（Node 20）。

- `test-and-build`: engine 以外のテストと全パッケージのビルド
- `engine-unit`: engine の `test:unit` を 2 分割
- `engine-sim`: engine の `test:sim` を `test:sim:starters` / `test:sim:monkey` / `test:sim:rest` の 3 グループに分けたもの

各ジョブは turbo のキャッシュ（`.turbo/cache`）を actions/cache で次の実行に引き継ぎます。入力が変わっていないタスク（UI だけの PR での engine のテストなど）は、実行せずにキャッシュの結果を再生します。

## デプロイ

Web 版は `apps/web-pocket` の静的サイト（`dist/`）を Vercel で配信します。設定は [apps/web-pocket/README.md](apps/web-pocket/README.md#vercel-で公開) を参照してください。
旧 Next.js 版の Vercel 設定（`apps/web/vercel.json`）は、Next.js 版の削除とともに不要になります。

## CPU AI（Lv1〜Lv5）

設定は `packages/engine/src/ai/types.ts` の `getCpuLevelConfig`、入口は `packages/engine/src/ai/index.ts` の `pickCpuAction(state, playerId, level)` です。

| レベル | 方式 |
|---|---|
| Lv1 | ヒューリスティックのみ（探索なし） |
| Lv2 | 1 手探索（候補 28・応答深度 10）。NC が成立する並べ方の先読み（`comboOrder`）と、山札切れを避ける追加ドロー抑制（`deckGuard`） |
| Lv3 | Lv2 に加え、チャージの判断を相手の次のターンの終わりまで進めて比べる（候補 44・応答深度 14） |
| Lv4 | 2 手読み（候補 56・応答深度 20）＋チャージの先読み |
| Lv5 | 2 手読み（候補 64・応答深度 28）＋チャージの先読み（試行 2 回）。盤面の評価は、手書きの評価に、自己対戦から学習した価値ネットワークの評価を 0.5 倍して足す（`valueNetBlend`）。読むときは相手の手札を山札と混ぜて配り直し、本物の手札は覗かない（`hideOpponentHand`。強さは覗く場合と同等で、1,104 試合で 50.1%）。ラッシュ・バトルフェイズの決定は、候補の手ごとに自分のターンの終わりまで指し進めて、ターンの終わりの盤面で比べる（ターン単位の読み、`turnPlanSteps`。1 回の決定で指し進める手は合わせて 60 手まで。時間でなく手の数で区切るので、端末の速さで選ぶ手は変わらない） |

Lv5 の価値ネットワークの重みは `packages/engine/src/ai/weights/valueNetV1.ts`（約 380 kB）に同梱しています。重みは、新しい Lv5 同士の自己対戦 16 万試合だけで学習し直した版（v3b、2026-10-22）です。手書きだけの Lv5 には、46 デッキのミラー戦 368 試合で 65% 勝ちます。最初の版（v1）との対戦では 54% です。学習のしかたは [packages/engine/scripts/nn/README.md](packages/engine/scripts/nn/README.md) を見てください。

強さの比較は `packages/engine/scripts/cpu-arena.ts`（並列版 `cpu-arena-par.sh`）で行います。

## カードとデッキ

| Tier | 枚数 | 内容 |
|---|---|---|
| `core-playable` | 1,052 | RS-001〜690、BK / RK / SR、レジェンド 1〜3 のベース |
| `vanilla-promoted` | 160 | 単純な効果の昇格カード |
| `complexity-promoted` | 620 | 複合効果の昇格カード |
| `full-playable` | **1,832** | 上の合計（`fullPlayableCatalog`）。対戦とデッキ構築で使うプール |

スターターデッキは 46 種（各 40 枚）で、`packages/cards/src/index.ts` の `starterDecks` にあります。

| シリーズ | デッキ ID |
|---|---|
| レジェンド 1 | `abarenoh` / `dekaranger` / `magiking` |
| レジェンド 3 | `roaring-wings` / `silver-adventurer` |
| レジェンド 5（五龍の逆鱗） | `five-dragons-a`〜`d` |
| レジェンド 7（七忍の炎陣） | `seven-ninja-a`〜`c` |
| レジェンド 9（青の九の翼） | `blue-nine-a`〜`c` |
| ライダー EXP vol.1〜4 | `rider-exp-1-a`〜`d`、`rider-exp-2-a`〜`d`、`rider-exp-3-a` / `b`、`rider-exp-4-1`〜`3` |
| ザ・ファーストエンカウント（XG1） | `first-encounter-a`〜`c` |
| ザ・ドラゴンタイガー（XG2） | `dragon-tiger-a`〜`c`（コマンダーカードは未対応のため除外） |
| ザ・W インパクト（XG3） | `w-impact-a`〜`c`（コマンダーカードは未対応のため除外） |
| ザ・ジェットアクセル（XG4） | `jet-accel-a`〜`c`（コマンダーカードは未対応のため除外） |
| ザ・チケットブレイカー（XG5） | `ticket-breaker-a`〜`c` |
| ザ・ベストパートナー アニバーサリーセット | `best-partner-a`〜`c` |

デッキ構築のルール（40 枚以上・同名 3 枚まで、例外あり）は `packages/cards/src/deckRules.ts` の `validateDeckEntries` です。

## 保存データ

PocketJS 版の設定・自作デッキ・戦績は `client-core` の `KeyValueStore` に保存します（キー `rs.settings.v1` / `rs.decks.v1` / `rs.records.v1`）。

- ブラウザ版: localStorage（端末・ブラウザごと。サーバーには送りません）
- Vita 版: `ux0:data/rangers-strike/<key>.json`

旧 Next.js 版は別のキー（localStorage の `rangers-strike/custom-decks/v1`）を使っており、PocketJS 版とは共有しません。

## ルールと資料

- ゲームルールの正: [docs/rules/README.md](docs/rules/README.md)（ルール ID `R-XXX-NN` で引用）
- カタログ生成パイプライン: [docs/architecture/card-generation-pipeline.md](docs/architecture/card-generation-pipeline.md)
- 全カード実装の進め方: [docs/architecture/full-card-rollout-process.md](docs/architecture/full-card-rollout-process.md)
- Wiki 収集状況: [docs/wiki/report.md](docs/wiki/report.md)

カード効果テキストと Wiki の照合:

```bash
node scripts/verify-wiki-effects.mjs                      # 全弾
node scripts/verify-wiki-effects.mjs --expansion=legend3  # レジェンド 3 のみ
```

## Next.js 版を削除するときの注意

PocketJS 版は次のものを `apps/web` から借りています。`apps/web` を消す前に移す必要があります。

- **カード画像:** `apps/web/public/cards`（約 38 MB）。`apps/web-pocket/scripts/build.mjs` と `apps/vita/scripts/bake-card-images.ts` がここから読みます
- **sharp:** Vita 版のカード画像変換が使う `sharp` は、いまは `next` の依存として入っています。消すとカード画像なし（文字タイル）でビルドされます

## 免責事項

本プロジェクトは **非公式のファン制作** です。
「レンジャーズストライク」および関連カードの権利は各権利者に帰属します。
