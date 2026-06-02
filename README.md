# レンジャーズストライク（Rangers Strike）

レンジャーズストライク（第1弾・第2弾）の対戦シミュレーターです。  
カードデータ・ルールエンジン・Web UI をモノレポ構成で管理しています。

- **プレイ形式:** 1人 vs CPU
- **対応カード:** Legend 1（RS-001〜070）/ Legend 2（RS-071〜122）
- **UI:** スマホ・タブレット・PC 向けレスポンシブ

## 主な機能

| 機能 | 説明 |
|------|------|
| CPU 対戦 | ターン進行・ラッシュ・バトル・ストライクなど基本ルールを実装 |
| デッキ作成 | カード検索・カテゴリー絞り込み・自作デッキ保存（最低40枚・同名3枚まで、戦闘員等は例外） |
| スターターデッキ | Type A/B/C（アバレンオー / デカレンジャーロボ / マジキング） |
| カード詳細 | 画像と効果テキストをモーダルで表示 |
| エラタ対応 | 公式 wiki のエラタ・Q&A を `packages/cards` で管理 |

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
| `@rangers-strike/web` | 対戦画面・デッキビルダー |

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
# 全パッケージ
npm test

# 個別
npm test -w @rangers-strike/cards
npm test -w @rangers-strike/engine
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

| 内容 | ファイル |
|------|----------|
| NC（ナンバーコンボ） | `packages/cards/src/comboEffects.ts` |
| 合体 / ライディング | `packages/cards/src/comboEffectCatalog.ts` |
| ユニット効果 | `packages/cards/src/unitEffectCatalog.ts` |
| オペレーション | `packages/cards/src/operationCatalog.ts` |
| 表示ラベル | `packages/cards/src/effectLabels.ts` |
| エラタ・Q&A | `packages/cards/src/errata.ts` |
| デッキ構築ルール | `packages/cards/src/deckRules.ts` |
| カテゴリー（ET/MA/OT 等） | `packages/cards/src/legend2/cards.json`（公式: grnrngr カードリスト） |
| wiki 参照テキスト | `packages/cards/src/wikiReference.ts` |

wiki 効果テキストとの照合:

```bash
node scripts/verify-wiki-effects.mjs
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
