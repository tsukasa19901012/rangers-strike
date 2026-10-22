# apps/web-pocket — ブラウザ版（PocketJS）

Rangers Strike の Web 版です。旧 Next.js 版（`apps/web`）を置き換えます。
UI は Vita 版と同じ [PocketJS](https://github.com/pocket-stack/pocketjs)（Solid）で書き、ゲームの進行・CPU・デッキルールは
`packages/client-core` と `packages/engine` をそのまま使います。ビルド結果は静的ファイルだけで、どの静的ホスティングにも置けます。

- タイトル: 自分と CPU のデッキ（スターター 46 種・自作）と CPU レベル（Lv1〜5）を選んで対戦開始。デッキ構築へ
- 対戦: 左にカード詳細（マウスを乗せたカード）、中央に盤面（CPU / 自分のラッシュ・バトル・コマンド・手札、
  山札・捨札・パワー）、右にフェイズと「フェイズ終了」ボタン。カードをクリックするとそのカードでできる操作が
  横に出て、対象が要る操作は対象が光ります。効果の選択や支払いは選択ウィンドウに出ます。
  パワーはパワーゾーンの枚数ではなく、相手コマンドゾーンのマルチカテゴリ 1 枚につき +1 した数を出します
  （例: `パワー 4(裏1・マルチ+1)`。上端の帯の `P4(…)` も同じ）
- デッキ構築: 全 1,832 枚の一覧からクリックで追加・右クリックで削除、保存。種類・カテゴリ・弾・コスト・BP で絞り込み、
  文字列検索（カード名・効果文・特徴・カード番号。スペース区切りで AND、ひらがな／カタカナ・全角／半角を区別しない）。
  デッキ名は上部の欄で付け替え（検索欄・デッキ名欄はホストページの `<input>` をキャンバスに重ねたもので、スマホの IME が使えます）
- スマホを縦に持つと、縦積みのスマホ用レイアウトに切り替わり、タップで操作します
- 保存（設定・自作デッキ・戦績）は localStorage（キー `rs.settings.v1` / `rs.decks.v1` / `rs.records.v1`）

## 構成

```
src/main.tsx        エントリ
src/app.tsx         画面の切り替えと入力（マウス・タッチ・キー → client-core の論理入力）
src/TitleView.tsx   タイトル（フレックスレイアウト + focusable なボタン）
src/MatchView.tsx   対戦画面（GuiView を client-core の矩形どおりに描く）
src/DeckView.tsx    デッキ構築（DeckBuilderView を描く）
src/ResultView.tsx  結果画面
src/cardArt.ts      カード画像テクスチャ（ホストがデコードしてアップロード）
src/engine.ts       ホストが読み込んだエンジン（globalThis.__rsEngine）を EngineApi として渡す
src/platform.ts     ブラウザ用 Platform 実装（localStorage、プライベートウィンドウではメモリ）
src/ui.tsx          画面共通の描画ヘルパ
host/               ブラウザホスト（index.html, host.js）
scripts/            ビルド・開発用静的サーバ・フォント取得・pocket check
```

対戦とデッキ構築の配置は `client-core/src/view/webGui.ts`（`computeWebGuiGeometry` /
`computeWebDeckGeometry`）で、Vita 版と同じ `GuiMatch` / `DeckBuilder` にこの配置を `AppController` の `layouts` として渡しています。

ホスト（`host/host.js`）は PocketJS の WASM コアを全画面の canvas で動かします。

- 論理解像度は横長ならウィンドウに合わせて 1024×640〜1680×1050（範囲外は canvas を拡大縮小）、
  縦長（スマホ）なら幅 430〜600 でウィンドウの縦横比に合わせます。密度 2 で描画します
- マウス・ペン・タッチは PocketJS の overlay サービス経由で渡します（ボタンのホバー・クリックと、カードの当たり判定用の座標）
- キーは Vita のボタンに割り当てて渡します（下の表）
- カード画像（`apps/web/public/cards` のコピー）はブラウザでデコードしてテクスチャにします
- ルールエンジン（`dist/engine.js`）は UI と別ファイルの ESM として読み込みます
- テスト用に `window.__rsApp`（`controller` と `pile(player)`）を公開しています

## 操作

| 操作 | マウス | キー |
|---|---|---|
| カードの詳細 | 乗せる | ←→↑↓ |
| カードの操作・決定 | クリック | Enter / Z |
| 戻る・閉じる | 右クリック | Esc / Backspace / X |
| フェイズ終了 | 右の青いボタン | Space / E |
| すべての操作 | 右のボタン | Tab / S |
| ログ | 右のボタン | L / Q |
| デッキから 1 枚抜く（デッキ構築） | 右クリック | Delete / A |
| 検索欄へ（デッキ構築） | 検索欄をクリック | / |

スマホ（縦持ち）ではカードをタップすると詳細と操作が出ます。枠の外のタップで閉じます。

## ビルドと実行

PocketJS のツールチェーンは Vita 版と共用です（`apps/vita/toolchain`、npm workspace の外）。リポジトリのルートで:

```sh
npm ci
cd apps/web-pocket
npm run setup        # apps/vita/toolchain に PocketJS を入れ、Noto Sans JP（通常・太字）を .cache/fonts に取得
npm run web:dev      # dist/ をビルドして http://127.0.0.1:8140/ で配信
```

| コマンド | 内容 |
|---|---|
| `npm run web:build` | `dist/` を作る（エンジン・UI・カード画像すべて） |
| `npm run web:build:app` | UI とホストだけ再ビルド（エンジンとカード画像は前回のもの。engine / cards を変えたら `web:build`） |
| `npm run web:serve` | `dist/` を http://127.0.0.1:8140/ で配信（`node scripts/serve.mjs --port=…` で変更可。開発用） |
| `npm run pocket:check` | `pocket.json` を PocketJS の web-app プロファイルで検査し、型検査 |

`web:*` / `pocket:*` はルートの turbo（`build` / `test` / `typecheck`）や CI からは実行されません。

`dist/` の中身とサイズ（2026-10-21 時点）:

| ファイル | 内容 | サイズ |
|---|---|---|
| `index.html`, `host.js` | ブラウザホスト | — |
| `pocket/` | PocketJS の WASM コアと JS バインディング | — |
| `app/main.js` | UI バンドル（Solid + client-core） | 0.39 MiB |
| `app/main.pak` | 日本語フォントアトラス（約 1,270 字） | 12.4 MiB（gzip 1.7 MiB） |
| `engine.js` | ルールエンジン + 全プレイアブルカード（`apps/vita/scripts/build-engine.ts` で作る） | 8.35 MiB（gzip 1.3 MiB） |
| `cards/`, `card-images.json` | カード画像 1,842 枚 | 約 38 MiB |

## Vercel で公開

`vercel.json` に設定があります。Next.js 版で使っていた Vercel プロジェクトをそのまま PocketJS 版に切り替えます
（Project → Settings → Build and Deployment）。

1. **Root Directory** を `apps/web` から `apps/web-pocket` に変える（「Include files outside the root directory」は有効のまま）
2. **Framework Preset** を `Other` にする。Build / Install / Output の上書きはオフ（`vercel.json` の値が使われます）
3. Node.js は 20 以上（既定の 22 で可）
4. Deployments から最新の main を **Redeploy**

ビルドはリポジトリ全体の `npm ci` → PocketJS ツールチェーンの `npm ci` → フォント取得 → `scripts/build.mjs` の順で、
`dist/` を静的サイトとして配信します。
