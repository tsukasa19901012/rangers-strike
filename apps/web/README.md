# apps/web — 旧 Next.js 版（削除予定）

Next.js 15 + React 19 で書いた最初の Web 版です。PocketJS のブラウザ版 [`apps/web-pocket`](../web-pocket/README.md) に置き換えて削除する予定なので、
新しい機能はここに入れません。

## 起動・ビルド・テスト

リポジトリのルートで `npm ci` を済ませてから:

```bash
npm run dev                                   # ルートから。http://localhost:3000
npm run build -w @rangers-strike/web          # prebuild で cards / engine を先にビルドしてから next build
npm test -w @rangers-strike/web               # Vitest（UI ロジック・効果配線のカバレッジ・g5Acceptance 等）
npm run test:e2e:install -w @rangers-strike/web   # 初回のみ Playwright の Chromium を入れる
npm run test:e2e -w @rangers-strike/web       # Playwright（e2e/、スマホ幅のデッキ構築。ポート 3001）
```

Vitest は `@rangers-strike/engine` / `@rangers-strike/cards` をビルド済みの `dist` ではなくソースに解決します（`vitest.config.ts`）。

## 構成

| 場所 | 内容 |
|---|---|
| `app/` | ページ（`page.tsx`）とスタイル（`globals.css`） |
| `components/GameApp.tsx` | 対戦画面のメイン |
| `components/*Modal.tsx` | カード効果ごとの操作モーダル（効果選択・ダメージ支払い・ゾード構築など） |
| `components/DeckBuilderScreen.tsx` | デッキ構築 |
| `lib/` | UI ロジックとテスト（`webUiEffectCoverage.ts` に効果ごとの UI 経路一覧） |
| `public/cards/` | カード画像（legend1〜3・promoted、計約 38 MB） |
| `scripts/` | Wiki 準拠テスト仕様の生成（`npm run generate:wiki-specs`）など |

自作デッキはブラウザの localStorage（キー `rangers-strike/custom-decks/v1`）に保存します。PocketJS 版とは共有しません。

## デプロイ

`vercel.json`（install / build コマンド）と `next.config.ts`（モノレポ向けの `outputFileTracingRoot`）があり、
Vercel プロジェクトの Root Directory を `apps/web` にすると Next.js としてビルドされます。
Vercel は PocketJS 版（Root Directory `apps/web-pocket`）に切り替える予定です。

## 削除するときの注意

`public/cards/` のカード画像は `apps/web-pocket/scripts/build.mjs` と `apps/vita/scripts/bake-card-images.ts` も読んでいます。
また Vita 版の画像変換が使う `sharp` は、いまは `next` の依存としてインストールされています。
このディレクトリを消す前に、画像の置き場所と `sharp` の依存を移してください。
