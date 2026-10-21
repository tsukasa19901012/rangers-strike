# @rangers-strike/cards — カードデータ

カードの定義（生成カタログと効果 DSL）、スターターデッキ、デッキ構築ルール、エラタ・Q&A を持つパッケージです。
ルールエンジン（`@rangers-strike/engine`）と各 UI はここからカードを読みます。

## カタログ

ランタイムの正は **生成カタログ + DSL registry** です。

| Tier | 枚数 | ファイル |
|---|---|---|
| `core-playable` | 1,052 | `src/generated/catalog/core-playable/cards.json` |
| `vanilla-promoted` | 160 | `src/generated/catalog/vanilla-promoted/cards.json` |
| `complexity-promoted` | 620 | `src/generated/catalog/complexity-promoted/cards.json` |
| `full-playable` | 1,832 | `src/generated/catalog/full-playable/cards.json`（上の 3 つのマージ。対戦・デッキ構築のプール） |

- 枚数の定数: `src/catalog/tiers.ts`（`CORE_PLAYABLE_CARD_COUNT` / `FULL_PLAYABLE_CARD_COUNT`）
- カタログ API: `src/catalog/unifiedCatalog.ts`、ローダーは `src/dsl/loader.ts`、後方互換の re-export は `src/extendedCatalog.ts`（`fullPlayableCatalog` 等）
- 効果 DSL: `src/generated/dsl-stubs/`（Wiki 収録カードごとの stub）と `src/dsl/generated/`（overlay。ビルド時に `overlays-bundle.json` へ束ねる）
- コマンダーカードはプレイ可能な定義がないため、プールに入りません

## 主なモジュール

| 内容 | ファイル |
|---|---|
| スターターデッキ 46 種（各 40 枚） | `src/index.ts` の `starterDecks`、定義は `src/<弾>/decks/*.json` |
| デッキ構築ルール（`validateDeckEntries`・同名判定・枚数上限） | `src/deckRules.ts` |
| ユニット効果（CardDocument → UnitEffectBlock） | `src/unitEffects.ts`、`src/catalog/cardDocumentToUnitBlock.ts` |
| 実装済み効果 ID 一覧 | `src/unitEffectCatalog.ts` |
| NC（ナンバーコンボ）・合体・ライディング | `src/comboEffects.ts`、`src/comboEffectCatalog.ts` |
| オペレーション | `src/operationCatalog.ts` |
| 効果の表示ラベル | `src/effectLabels.ts` |
| エラタ・Q&A | `src/errata.ts` |
| 禁止カード | `src/bannedCards.ts` |
| カード画像の URL | `src/cardImages.ts` |
| Wiki 参照テキスト | `src/wikiReference.ts` |
| JSON スキーマ | `schema/` |

## ビルドとテスト

```bash
npm run build -w @rangers-strike/cards       # overlay を束ねてから tsc で dist/ に出力
npm test -w @rangers-strike/cards            # Vitest（デッキルール・効果カタログ・カタログ parity・スキーマ）
npm run typecheck -w @rangers-strike/cards
```

`dist/` は拡張子なしの import を含むため、Node から直接ではなく TypeScript / バンドラ（tsx・Vitest・esbuild・Next.js）経由で使います。

## 監査とメンテナンス

`package.json` にはパイプライン用のスクリプトが多数あります。よく使うもの:

| コマンド | 出力 |
|---|---|
| `npm run audit:catalog-parity -w @rangers-strike/cards` | カタログ parity ゲート → `pipeline/data/catalog-parity.json` |
| `npm run audit:rollout-status -w @rangers-strike/cards` | ロールアウト進捗（G0–G5）→ `pipeline/data/rollout-status.json` |
| `npm run metrics:full-playable -w @rangers-strike/cards` | フルプレイアブル指標 → `pipeline/data/full-playable-metrics.json` |
| `npm run audit:rs-release -w @rangers-strike/cards` | RS-001〜690 の監査 → `pipeline/data/rs-release-readiness.json` |
| `npm run emit-core-catalog -w @rangers-strike/cards` | コアカタログの再生成 |
| `npm run emit-full-playable-catalog -w @rangers-strike/cards` | フルプレイアブルカタログの再生成（core + promoted のマージ） |
| `npm run download-images -w @rangers-strike/cards` | GrnRngr からレジェンド 1・2 の画像を `assets/` にダウンロード（UI が配信する画像は `apps/web/public/cards`） |

監査スクリプトは `pipeline/data/` の JSON を書き換えます（生成日時も変わります）。
パイプラインの全体像は [docs/architecture/card-generation-pipeline.md](../../docs/architecture/card-generation-pipeline.md) を参照してください。
