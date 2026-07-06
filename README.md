# レンジャーズストライク（Rangers Strike）

レンジャーズストライク（第1弾〜第9弾・ベルト・クロスギャザー等）の対戦シミュレーターです。  
カードデータ・ルールエンジン・Web UI をモノレポ構成で管理しています。

- **プレイ形式:** 1人 vs CPU（CPU レベル Lv1〜Lv5 を選択可能）
- **対応カード:** コア 1,052 枚 + promoted 780 枚 — **フルプレイアブル計 1,832 枚**（`fullPlayableCatalog`、Wiki 収録の全対戦カード。コマンダー 17 枚はプール外）
- **実装状況:** ロールアウトゲート G0–G5 すべて pass（`dslReady=1832`、`effect_delegate=0`）。詳細は [full-card-rollout-process.md](docs/architecture/full-card-rollout-process.md) / `npm run audit:rollout-status -w @rangers-strike/cards`
- **UI:** スマホ・タブレット・PC 向けレスポンシブ

## 対戦画面のレイアウト方針（公式プレイシート準拠 / 2026-07 刷新）

対戦中の UI は公式プレイマット（wikiwiki playseat新）をベースに、次の契約に従います（変更時は意図的な仕様変更として扱う）。

| 項目 | 方針 |
|------|------|
| ボード配置 | **CPU 上 / プレイヤー下**。各半面は **バトル（赤帯）/ ラッシュ（青帯）/ コマンド（緑帯）の 3 バンド + サイドカラム（山札・捨札・常駐置き場）+ 右端の縦型パワーゾーン**。CPU 半面は上下反転（両バトルエリアが中央で向かい合う） |
| 1画面固定 | デスクトップは HUD / 両盤面 / 手札ドックを **100dvh に収める**（カードサイズはビューポート高さから CSS 変数で自動算出）。モバイル（<640px）は 1 カラム積みで縦スクロール可 |
| コマンド | ホールド状態のコマンドは **90 度回転（ヨコ置き）** で表示 |
| 手札 | 画面下部の **固定ドック（sticky）** にファン表示。常に到達可能 |
| 操作 | **タップ**（カード → アクションシート）と **ドラッグ** の両対応 |
| ゾーン内 | 横長ゾーンは **ゾーン内の横スクロール** のみ |
| HUD | 上部バーに ターン / **番号付きフェイズトラッカー（1紫 2橙 3青 4赤 5灰）** / ログ。フェイズガイドはその直下の 1 行 |
| アクション | フェイズ終了などの主要ボタンは **右下の固定ドック** |
| スタート完了 | 3行程完了後は **自動でチャージフェイズへ**（任意の追加ドローがある間は待機） |
| フェイズ通知 | フェイズが変わったときにモーダルで通知 |
| スタートフェイズ | バトルエリアのユニットは **一括でラッシュに戻す**（`return_all_battle_to_rush`）。戻し後の個別効果（ファルコンクロー等）はキューで順次処理 |

実装の参照: `apps/web/app/globals.css`、`apps/web/components/GameApp.tsx`

## 主な機能

| 機能 | 説明 |
|------|------|
| CPU 対戦 | ターン進行・ラッシュ・バトル・ストライクなど基本ルールを実装。Lv1〜Lv5 で強さを調整 |
| デッキ作成 | 1,832 枚プールから検索・収録セット絞り込み・自作デッキ保存（40枚固定・同名3枚まで、戦闘員等は例外） |
| スターターデッキ | Type A/B/C（L1）＋ 轟の翼 / 銀の冒険者（L3）の計5種 |
| フルプレイアブル | full-playable 1,832 枚すべて DSL 解釈可能。ランダムプリセット・promoted 混在の自作デッキで CPU 対戦 |
| カード詳細 | 画像と効果テキストをモーダルで表示 |
| エラタ対応 | 公式 wiki のエラタ・Q&A を `packages/cards` で管理 |
| 効果 UI | オペレーション・効果選択・ダメージ支払い・ゾード構築など、カード効果ごとの操作モーダルを配線 |

## CPU AI（Lv1〜Lv5）

スタート画面の「CPUレベル」で選択します。設定は `packages/engine/src/ai/types.ts` の `getCpuLevelConfig` で定義されています。

| レベル | 方式 | 候補数 | 応答深度 |
|--------|------|--------|----------|
| Lv1 | ヒューリスティックのみ（探索なし） | — | — |
| Lv2 | 探索あり | 28 | 10 |
| Lv3 | 探索あり | 44 | 14 |
| Lv4 | 探索あり（2手読み） | 56 | 20 |
| Lv5 | 探索あり（2手読み・最上級） | 64 | 28 |

- エントリポイント: `packages/engine/src/ai/index.ts` の `pickCpuAction(state, playerId, level)`
- 探索ロジック: `packages/engine/src/ai/simulation.ts`（相手のリアクション窓をヒューリスティックで解決）
- UI ラベル: `apps/web/lib/labels.ts` の `CPU_LEVEL_OPTIONS`

## カタログ tier

| Tier | 枚数 | 内容 |
|------|------|------|
| `core` | 1,052 | RS-001..690、BK/RK/SR、L1–L3 ベース（`corePlayableCatalog`） |
| `vanilla-promoted` | 184 | 単純効果の昇格カード |
| `complexity-promoted` | 613 | 複合効果の昇格カード |
| `full-playable` | **1,832** | 上記 tier の合計（`fullPlayableCatalog`） |

定数: `packages/cards/src/catalog/tiers.ts`（`CORE_PLAYABLE_CARD_COUNT` / `FULL_PLAYABLE_CARD_COUNT`）

## スターターデッキ

| ID | 名称 | 弾 |
|----|------|-----|
| `abarenoh` | Type A: アバレンオー | Legend 1 |
| `dekaranger` | Type B: デカレンジャーロボ | Legend 1 |
| `magiking` | Type C: マジキング | Legend 1 |
| `roaring-wings` | 轟の翼: ダイタンケン | Legend 3 |
| `silver-adventurer` | 銀の冒険者: ボウケンシルバー | Legend 3 |

定義: `packages/cards/src/legend1/decks/`、`packages/cards/src/legend3/decks/`  
エクスポート: `packages/cards/src/index.ts` の `starterDecks`

## リポジトリ構成

```
rangers-strike/
├── apps/web/              # Next.js プレイ UI
├── packages/cards/        # カード定義・DSL パイプライン・効果カタログ
├── packages/engine/       # ゲームルールエンジン・CPU AI
├── docs/                  # アーキテクチャ設計・Wiki 収集物
└── scripts/               # リポジトリ横断の検証スクリプト
```

| パッケージ | 役割 |
|-----------|------|
| `@rangers-strike/cards` | カードカタログ（registry / 生成 JSON）、効果パース、スターターデッキ、エラタ |
| `@rangers-strike/engine` | 状態管理、合法手判定、アクション適用、CPU AI |
| `@rangers-strike/web` | 対戦画面・デッキビルダー・効果操作モーダル |

## 必要環境

- **Node.js** 20 以上
- **npm** 10 以上（`packageManager` に合わせて `npm ci` を推奨）

## セットアップ

```bash
git clone https://github.com/tsukasa19901012/rangers-strike.git
cd rangers-strike
npm ci
```

## 開発

```bash
# Web アプリ起動 → http://localhost:3000
npm run dev

# 型チェック
npm run typecheck
```

## テスト

```bash
# 全パッケージ（cards / engine / web）
npm test

# 個別
npm test -w @rangers-strike/cards
npm test -w @rangers-strike/engine
npm test -w @rangers-strike/web

# カタログ parity ゲート（cards）
npm run audit:catalog-parity -w @rangers-strike/cards
```

| パッケージ | 主なテスト |
|-----------|-----------|
| `engine` | ルール統合、CPU AI（`src/ai/`）、スタートフェイズ、カード効果 |
| `cards` | デッキルール、効果カタログ、カタログ parity、スキーマ |
| `web` | Web UI 効果カバレッジ、`g5Acceptance`、Playwright E2E（AC-06） |

Web E2E（初回は `npm run test:e2e:install -w @rangers-strike/web`）:

```bash
npm run test:e2e -w @rangers-strike/web
```

エンジンのモンキーテスト（長時間ランダム対戦）:

```bash
npm run test:monkey -w @rangers-strike/engine
```

## ビルド

```bash
npm run build
```

## デッキ保存について

自作デッキは **ブラウザの localStorage** に保存されます（キー: `rangers-strike/custom-decks/v1`）。

- 端末・ブラウザごとに独立
- サーバーには送信されません
- ストレージを消すとデッキも消えます

## 効果実装の参照先

カード効果の実装状況や配線は、次のファイルを参照してください。

### カードデータ（`packages/cards`）

ランタイムの正は **生成カタログ + DSL registry** です。旧 `src/legend*/cards.json` / `unitEffects.json` は削除済みです。

| 内容 | ファイル / コマンド |
|------|---------------------|
| コア 1,052 枚 | `src/generated/catalog/core-playable/cards.json` |
| フルプレイアブル 1,832 枚 | `src/generated/catalog/full-playable/cards.json` |
| カタログ API | `src/catalog/unifiedCatalog.ts`（`loadCards` / `loadCardById` は `src/dsl/loader.ts`） |
| 後方互換 re-export | `src/extendedCatalog.ts`（`fullPlayableCatalog` 等） |
| promoted シャード | `generated/catalog/*-promoted/`（vanilla / complexity 等） |
| DSL stub / overlay | `src/generated/dsl-stubs/`（1,849 枚）、`src/dsl/generated/overlays-bundle.json`（コア 1,052 overlay） |
| カタログ parity 監査 | `npm run audit:catalog-parity -w @rangers-strike/cards` → `pipeline/data/catalog-parity.json` |
| ロールアウト進捗（G0–G5） | `npm run audit:rollout-status -w @rangers-strike/cards` → `pipeline/data/rollout-status.json` |
| フルプレイアブル指標 | `npm run metrics:full-playable -w @rangers-strike/cards` → `pipeline/data/full-playable-metrics.json` |
| RS 系監査（RS-001..690） | `npm run audit:rs-release -w @rangers-strike/cards` → `pipeline/data/rs-release-readiness.json` |
| grant_keyword ハッシュ修復 | `npm run repair-dsl-hash-keywords -w @rangers-strike/cards` → `pipeline/data/dsl-hash-keyword-repair.json` |
| ユニット効果（registry） | `src/unitEffects.ts`（`CardDocument` → `UnitEffectBlock`、`src/catalog/cardDocumentToUnitBlock.ts`） |
| 実装済み効果 ID 一覧 | `src/unitEffectCatalog.ts` |
| NC（ナンバーコンボ） | `src/comboEffects.ts` |
| 合体 / ライディング | `src/comboEffectCatalog.ts` |
| オペレーション | `src/operationCatalog.ts` |
| 表示ラベル | `src/effectLabels.ts` |
| エラタ・Q&A | `src/errata.ts` |
| デッキ構築ルール | `src/deckRules.ts` |
| カテゴリー（ET/MA/OT 等） | 各カードの `category` フィールド（生成カタログ / CardDocument） |
| wiki 参照テキスト | `src/wikiReference.ts` |
| L3 atwiki 取り込み元 | `src/legend3/atwiki-pages.json` |

カタログ生成パイプラインの詳細: [docs/architecture/card-generation-pipeline.md](docs/architecture/card-generation-pipeline.md)

### ルールエンジン（`packages/engine`）

| 内容 | ファイル |
|------|----------|
| アクション適用・合法手 | `src/core/applyAction.ts`、`src/core/legalActions.ts` |
| スタートフェイズ | `src/rules/startPhase.ts` |
| 命名ユニット効果 | `src/rules/namedUnitEffects.ts` |
| Legend 3 専用ルール | `src/rules/legend3/`（ラッシュ・バトル・NC・オペ・制限など） |
| CPU AI | `src/ai/` |

### Web UI 配線（`apps/web`）

| 内容 | ファイル |
|------|----------|
| 効果ごとの UI 経路一覧 | `lib/webUiEffectCoverage.ts` |
| 操作モーダル群 | `components/*Modal.tsx` |
| 対戦メイン | `components/GameApp.tsx` |

Wiki 収集状況は [docs/wiki/report.md](docs/wiki/report.md) を参照（カード md 1,849 件・atwiki 2,022 ページ）。

フルプレイアブル（G5）の要件・設計:

- [docs/architecture/web-full-playable-requirements.md](docs/architecture/web-full-playable-requirements.md)
- [docs/architecture/web-full-playable-design.md](docs/architecture/web-full-playable-design.md)
- [docs/architecture/full-card-rollout-process.md](docs/architecture/full-card-rollout-process.md)

wiki 効果テキスト照合（Legend 1/2 は grnrngr FAQ + atwiki、Legend 3+ は w.atwiki.jp）:

```bash
# 全弾
node scripts/verify-wiki-effects.mjs

# Legend 3 のみ
node scripts/verify-wiki-effects.mjs --expansion=legend3
```

Legend 3 カードデータのメンテナンス（開発者向け）:

```bash
# atwiki からカード取り込み
node packages/cards/scripts/import-legend3-from-atwiki.mjs

# コア / フルプレイアブルカタログ再生成（core 1,052 枚 + promoted 780 枚 → 1,832 枚マージ）
npm run emit-core-catalog -w @rangers-strike/cards
npm run emit-full-playable-catalog -w @rangers-strike/cards

# ロールアウト進捗（G0–G5）
npm run audit:rollout-status -w @rangers-strike/cards

# カタログ parity ゲート
npm run audit:catalog-parity -w @rangers-strike/cards

# L3 unit effect スナップショット（メンテ用 diff）
node packages/cards/scripts/build-legend3-unitEffects.mjs

# カード画像ダウンロード
npm run download-images -w @rangers-strike/cards
```

## CI

`main` ブランチへの push / PR で GitHub Actions が実行されます。

- `npm ci`
- `npm test`
- `npm run build`

## Vercel デプロイ

ビルドコマンドなどは `apps/web/vercel.json` に定義しています。  
**Root Directory だけは Vercel ダッシュボードで設定** してください（リポジトリ内に書けない項目です）。

### ダッシュボード設定（初回のみ）

**Settings → General → Build & Development Settings**

| 設定 | 値 |
|------|-----|
| Root Directory | `apps/web` |
| Framework Preset | **Next.js**（Override している場合は解除または Next.js に合わせる） |
| Output Directory | **空欄**（`public` などを削除） |
| Include source files outside Root Directory | **有効** |

設定変更後は **Deployments → Redeploy**（Build Cache オフ）→ **Promote to Production** してください。  
「Configuration Settings in the current Production deployment differ…」と出ている場合も同様です。

### リポジトリ側の設定

| ファイル | 内容 |
|---------|------|
| `apps/web/vercel.json` | framework / install / build / dev コマンド |
| `apps/web/next.config.ts` | モノレポ向け `outputFileTracingRoot` |
| `apps/web/.nvmrc` | Node 20 |
| `apps/web/package.json` | `prebuild` で cards / engine を先にビルド |

`main` への push で自動デプロイされます。

## 免責事項

本プロジェクトは **非公式のファン制作** です。  
「レンジャーズストライク」および関連カードの権利は各権利者に帰属します。
