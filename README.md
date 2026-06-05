# レンジャーズストライク（Rangers Strike）

レンジャーズストライク（第1弾・第2弾・第3弾）の対戦シミュレーターです。  
カードデータ・ルールエンジン・Web UI をモノレポ構成で管理しています。

- **プレイ形式:** 1人 vs CPU（CPU レベル Lv1〜Lv5 を選択可能）
- **対応カード:** Legend 1（RS-001〜070）/ Legend 2（RS-071〜122）/ Legend 3（RS-123〜178, SR-001）
- **UI:** スマホ・タブレット・PC 向けレスポンシブ

## 対戦画面のレイアウト方針

対戦中の UI は次の契約に従います（変更時は意図的な仕様変更として扱う）。

| 項目 | 方針 |
|------|------|
| ボード配置 | **CPU 上 / プレイヤー下**（縦並びのみ。横並びにしない） |
| 操作位置 | 自軍ゾーン・手札は画面下側 |
| スクロール | 画面に収まらないときは **ページを縦スクロール**（手札まで到達できること） |
| ゾーン内 | 手札・横長ゾーンは **ゾーン内の横スクロール** のみ |
| サイズ調整 | **CSS（メディアクエリ）を主**、不足時のみ横向き低高さで JS 縮小（`apps/web/lib/compactViewport.ts`） |
| ヘッダー等 | タイトル・フェイズガイドは **折りたたみ可能**（横向きでは初期状態で畳む。畳んだときもタイトルへ戻るボタンを表示） |
| スタート完了 | 3行程完了後は **自動でチャージフェイズへ**（任意の追加ドローがある間は待機） |
| フェイズ通知 | フェイズが変わったときにモーダルで通知 |
| スタートフェイズ | バトルエリアのユニットは **一括でラッシュに戻す**（`return_all_battle_to_rush`）。戻し後の個別効果（ファルコンクロー等）はキューで順次処理 |

実装の参照: `apps/web/app/globals.css`、`apps/web/components/GameApp.tsx`

## 主な機能

| 機能 | 説明 |
|------|------|
| CPU 対戦 | ターン進行・ラッシュ・バトル・ストライクなど基本ルールを実装。Lv1〜Lv5 で強さを調整 |
| デッキ作成 | カード検索・カテゴリー絞り込み・自作デッキ保存（最低40枚・同名3枚まで、戦闘員等は例外） |
| スターターデッキ | Type A/B/C（L1）＋ 轟の翼 / 銀の冒険者（L3）の計5種 |
| カード詳細 | 画像と効果テキストをモーダルで表示 |
| エラタ対応 | 公式 wiki のエラタ・Q&A を `packages/cards` で管理 |
| 効果 UI | オペレーション・効果選択・ダメージ支払い・ゾード構築など、カード効果ごとの操作モーダルを配線 |

## CPU AI（Lv1〜Lv5）

スタート画面の「CPUレベル」で選択します。設定は `packages/engine/src/ai/types.ts` の `getCpuLevelConfig` で定義されています。

| レベル | 方式 | 候補数 | 応答深度 |
|--------|------|--------|----------|
| Lv1 | ヒューリスティックのみ（探索なし） | — | — |
| Lv2 | 探索あり | 12 | 4 |
| Lv3 | 探索あり | 22 | 6 |
| Lv4 | 探索あり | 35 | 8 |
| Lv5 | 探索あり（最上級） | 42 | 100 |

- エントリポイント: `packages/engine/src/ai/index.ts` の `pickCpuAction(state, playerId, level)`
- 探索ロジック: `packages/engine/src/ai/simulation.ts`（相手のリアクション窓をヒューリスティックで解決）
- UI ラベル: `apps/web/lib/labels.ts` の `CPU_LEVEL_OPTIONS`

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
├── packages/cards/        # カード定義・効果カタログ
├── packages/engine/       # ゲームルールエンジン
└── scripts/               # 検証スクリプトなど
```

| パッケージ | 役割 |
|-----------|------|
| `@rangers-strike/cards` | カード JSON、効果パース、スターターデッキ、エラタ |
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
```

| パッケージ | 主なテスト |
|-----------|-----------|
| `engine` | ルール統合、CPU AI（`src/ai/`）、スタートフェイズ、カード効果 |
| `cards` | デッキルール、効果カタログ、スキーマ |
| `web` | Web UI 効果カバレッジ（`apps/web/lib/webUiEffectCoverage.ts`） |

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

| 内容 | ファイル |
|------|----------|
| カード定義 L1 / L2 / L3 | `src/legend1/cards.json`、`src/legend2/cards.json`、`src/legend3/cards.json` |
| ユニット効果 JSON L1 / L2 / L3 | `src/legend1/unitEffects.json`、`src/legend2/unitEffects.json`、`src/legend3/unitEffects.json` |
| 実装済み効果 ID 一覧 | `src/unitEffectCatalog.ts` |
| NC（ナンバーコンボ） | `src/comboEffects.ts` |
| 合体 / ライディング | `src/comboEffectCatalog.ts` |
| オペレーション | `src/operationCatalog.ts` |
| 表示ラベル | `src/effectLabels.ts` |
| エラタ・Q&A | `src/errata.ts` |
| デッキ構築ルール | `src/deckRules.ts` |
| カテゴリー（ET/MA/OT 等） | `src/legend2/cards.json`（公式: grnrngr カードリスト） |
| wiki 参照テキスト | `src/wikiReference.ts` |
| L3 atwiki 取り込み元 | `src/legend3/atwiki-pages.json` |

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

wiki 効果テキスト照合（Legend 1/2 は wikiwiki.jp、Legend 3 は w.atwiki.jp）:

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

# unitEffects.json 生成
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
