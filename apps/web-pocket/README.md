# apps/web-pocket — ブラウザ版（PocketJS）

Next.js 版（`apps/web`）を置き換える予定のブラウザ版です。UI は Vita 版と同じ
[PocketJS](https://github.com/pocket-stack/pocketjs)（Solid）で書き、ゲームの進行・CPU・デッキルールは
`packages/client-core` と `packages/engine` をそのまま使います。

- タイトル: デッキ（スターター・自作）と CPU レベルを選んで対戦開始、デッキ構築へ。
- 対戦: 左にカード詳細（マウスを乗せたカード）、中央に盤面（CPU / 自分のラッシュ・バトル・コマンド・手札、
  山札・捨札・パワー）、右にフェイズと「フェイズ終了」ボタン。カードをクリックするとそのカードでできる操作が
  横に出て、対象が要る操作は対象が光ります。効果の選択や支払いは選択ウィンドウに出ます。
- デッキ構築: 全カードの一覧をクリックで追加・右クリックで削除、種類・カテゴリで絞り込み、保存。
- 保存（設定・自作デッキ・戦績）は localStorage。

## 構成

```
src/app.tsx        画面の切り替えと入力（マウス・キー → client-core の論理入力）
src/TitleView.tsx  タイトル（フレックスレイアウト + focusable なボタン）
src/MatchView.tsx  対戦画面（GuiView を client-core の矩形どおりに描く）
src/DeckView.tsx   デッキ構築（DeckBuilderView を描く）
src/cardArt.ts     カード画像テクスチャ（ホストが読み込む）
host/              ブラウザホスト（index.html, host.js）
scripts/           ビルド・静的サーバ・フォント取得・pocket check
```

対戦とデッキ構築の配置は `client-core/src/view/webGui.ts`（`computeWebGuiGeometry` /
`computeWebDeckGeometry`）で、Vita 版と同じ `GuiMatch` / `DeckBuilder` にこの配置を渡しています。

ホスト（`host/host.js`）は PocketJS の WASM コアを全画面の canvas で動かします。

- 論理解像度はウィンドウに合わせて 1024x640〜1680x1050（範囲外は canvas を拡大縮小）、密度 2 で描画。
- マウスは PocketJS の overlay サービス経由で渡します（ボタンのホバー・クリックと、カードの当たり判定用の座標）。
- カード画像（`apps/web/public/cards` のコピー）はブラウザでデコードしてテクスチャにします。
- ルールエンジン（`dist/engine.js`）は UI と別ファイルの ESM として読み込みます。

## 操作

| 操作 | マウス | キー |
|---|---|---|
| カードの詳細 | 乗せる | ←→↑↓ |
| カードの操作・決定 | クリック | Enter |
| 戻る・閉じる | 右クリック | Esc |
| フェイズ終了 | 右の青いボタン | Space |
| すべての操作 | 右のボタン | Tab |
| ログ | 右のボタン | L |

## ビルドと実行

PocketJS のツールチェーンは Vita 版と共用です（`apps/vita/toolchain`）。リポジトリのルートで:

```sh
npm ci
cd apps/web-pocket
npm run setup        # PocketJS ツールチェーンと Noto Sans JP（通常・太字）
npm run web:dev      # dist/ をビルドして http://127.0.0.1:8140/ で配信
```

- `npm run web:build` — `dist/` を作る（静的ファイルのみ。どの静的ホスティングにも置けます）
- `npm run web:build:app` — UI だけ再ビルド（エンジンとカード画像は前回のもの）
- `npm run pocket:check` — `pocket.json` を PocketJS の web-app プロファイルで検査し、型検査

`dist/` の主なサイズ: `app/main.pak` 12.4 MiB（gzip 1.7 MiB、日本語フォントアトラス）、
`engine.js` 8.3 MiB（gzip 1.3 MiB）、`app/main.js` 0.35 MiB、カード画像 38 MiB。

## Vercel で公開

`vercel.json` に設定があります。Next.js 版で使っていた Vercel プロジェクトをそのまま PocketJS 版に切り替えます
（Project → Settings → Build and Deployment）。

1. **Root Directory** を `apps/web` から `apps/web-pocket` に変える（「Include files outside the root directory」は有効のまま）
2. **Framework Preset** を `Other` にする。Build / Install / Output の上書きはオフ（`vercel.json` の値が使われます）
3. Node.js は 20 以上（既定の 22 で可）
4. Deployments から最新の main を **Redeploy**

ビルドはリポジトリ全体の `npm ci` → PocketJS ツールチェーンの `npm ci` → フォント取得 → `scripts/build.mjs` の順で、
`dist/` を静的サイトとして配信します。
