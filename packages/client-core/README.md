# @rangers-strike/client-core — 共有クライアント層

PocketJS のブラウザ版（`apps/web-pocket`）と PS Vita 版（`apps/vita`）が共有する、画面に依存しないクライアント層です。
タイトル → 対戦 → 結果の進行、CPU の手の実行、盤面の表示モデル、入力の解釈、デッキ構築、保存をここに置き、
各アプリは「入力を論理入力に変換する」「`ScreenView` を描く」だけを持ちます。

DOM・Node・PocketJS には依存しません（`lib` は ES2022、`types` なし）。エンジンも実行時には import せず、
`EngineApi`（`src/engineApi.ts`）として各アプリから注入します。

## 構成

| ファイル | 内容 |
|---|---|
| `src/engineApi.ts` | クライアントが使うエンジンの最小 API（型のみ import） |
| `src/app/controller.ts` | `AppController`: タイトル → 対戦 → 結果の状態機械。毎フレーム `tick()` で CPU を 1 手ずつ進める |
| `src/app/guiMatch.ts` | 対戦画面の GUI 状態（カードのフォーカス・操作メニュー）。合法手をカードごとに振り分ける |
| `src/app/deckBuilder.ts` | デッキ構築画面の状態（一覧・絞り込み・保存）。`deckSharing` のシェルでは「共有する」「テキストから取り込む」も出す |
| `src/app/deckShare.ts` | デッキの共有形式（URL 用の `{v, name, cards}` とテキストのカードリスト）の作成と読み取り |
| `src/session/session.ts` | 1 試合: 合法手 → ラベル付き選択肢、CPU 1 手の実行と時間計測、ログ整形 |
| `src/view/gui.ts` | GameState → カードタイルの表示モデルと、Vita 用の配置 |
| `src/view/webGui.ts` | ブラウザ版の配置（`computeWebGuiGeometry` / `computeWebDeckGeometry`、縦持ちのスマホ配置を含む） |
| `src/view/board.ts`, `src/view/layout.ts` | テキスト画面（タイトル・結果）の表示モデルと配置 |
| `src/input/actions.ts` | 論理入力（`prev` / `next` / `confirm` / `cancel` / `menu` / `allActions` 等） |
| `src/input/devices.ts` | ボタン → 論理入力（`ButtonRepeater`、オートリピート）、座標の当たり判定（`hitTestGui` / `hitTestDeck`） |
| `src/text/` | 日本語の折り返し（禁則）と、フェイズ・行動・ログの日本語ラベル |
| `src/platform/` | `Clock` / `LogSink` / `MemoryProbe` / `KeyValueStore` / `AssetLoader` のインターフェースと、設定・デッキ・戦績・自動対戦の保存（`settings.ts`） |
| `src/data/split.ts` | カードデータの分割（デッキ → カード ID、生成 JSON の刈り込み） |
| `src/data/deckApi.ts` | cards のデッキルール関数から `DeckApi` を作る（`createDeckApi`） |
| `src/testing/engine.ts` | テスト用に TypeScript ソースのエンジンを `EngineApi` として渡す |

保存キーは `rs.settings.v1`（設定）・`rs.decks.v1`（自作デッキ）・`rs.records.v1`（戦績）・`rs.autoplay.v1`（計測用の CPU 同士の自動対戦）です。

## 新しいアプリから使う

1. `EngineApi` を用意する（例: `apps/vita/engine/entry.ts` + `apps/vita/src/engine.ts`）
2. `Platform`（時計・ログ・メモリ・保存・アセット）を実装する（例: `apps/web-pocket/src/platform.ts`）
3. `new AppController({ platform, viewport, gui: true, layouts?, ... })` を作り、入力を `controller.dispatch(...)` に渡す
4. 毎フレーム `controller.tick()` を呼び、`controller.view()` の `ScreenView` を描く。サイズが変わったら `controller.setViewport()`

## ビルドとテスト

```bash
npm run build -w @rangers-strike/client-core       # tsc で dist/ に出力（engine を先にビルドしておく）
npm test -w @rangers-strike/client-core            # Vitest
npm run typecheck -w @rangers-strike/client-core
```
