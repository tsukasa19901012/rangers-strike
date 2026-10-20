# apps/vita — PS Vita 版試作（PocketJS）

人間 1 人と CPU が、既存のスターターデッキで 1 試合を最後まで遊べる PS Vita アプリの試作です。対戦画面はカードを並べた GUI、タイトルと結果はテキストです。
UI は [PocketJS](https://github.com/pocket-stack/pocketjs)（npm `@pocketjs/framework` / `@pocketjs/cli` 0.14.0、Solid）で書いています。
ゲームの進行・表示内容・入力の解釈はすべて共有パッケージ `packages/client-core` にあり、このディレクトリは **PocketJS 向けの薄い描画・入力層** です。

- 盤面（手札・バトル・ラッシュ・コマンドはカード、パワー・ダメージ・山札などは枚数）を GUI で表示します（480×272 論理解像度、Vita では 2 倍表示）。
- 合法手はエンジンの `getLegalActions` から作り、十字キーでカードを選んで ○ でそのカードの操作を出します。タッチでも選べます。
- CPU は既存 AI（`pickCpuAction` → `pickCpuFallbackAction`）で動きます。
- 保留中の選択（効果の選択・コマンド支払い・ダメージ支払い・ゾード素材・反応窓）を、元カードのテキストと一緒に表示します。
- ログ・CPU 思考時間（直近・平均・最大）・メモリを画面下に表示します。

## 1. 構成

```
packages/client-core   プラットフォーム非依存（DOM / Node / PocketJS 依存なし、lib=ES2022・types なし）
  engineApi.ts         エンジンの必要最小 API（型のみ import、実装は各シェルが注入）
  session/             1 試合: 合法手→ラベル付き選択肢、CPU 1 手の実行と時間計測、ログ整形
  view/board.ts        GameState → 盤面テキスト・保留中の選択の表示モデル
  view/layout.ts       画面サイズ・向きから各ペインの矩形・行数・折り返し幅を計算
  text/wrap.ts         日本語の折り返し（行頭・行末禁則、英数字の語はまとめる、省略記号）
  text/labels.ts       フェイズ・行動・ログの日本語ラベル
  input/actions.ts     論理入力（prev/next/pagePrev/pageNext/confirm/cancel/tab*/select）
  input/devices.ts     ボタン→論理入力（オートリピート）、タップ認識、座標→論理入力のヒットテスト
  app/controller.ts    タイトル→対戦→結果の状態機械。毎フレーム tick() で CPU を 1 手ずつ進める
  app/guiMatch.ts      対戦画面の GUI 状態（カードのフォーカス・操作メニュー）。合法手をカードごとに振り分ける
  view/gui.ts          GameState → カードタイルの表示モデルと、描画・タッチ判定共通の座標
  platform/            Clock / LogSink / MemoryProbe / KeyValueStore / AssetLoader のインターフェースと汎用実装
  data/split.ts        カードデータ分割（デッキ→カード ID、生成 JSON の刈り込み、デッキ単位チャンク）

apps/vita              PocketJS シェル（このディレクトリ）
  src/app.tsx          ScreenView を描くだけ。Vita ボタン/タッチ → 論理入力
  src/GuiMatchView.tsx 対戦画面（ScreenView.gui）をコアが決めた座標に描く
  src/DeckBuilderView.tsx デッキ構築画面（ScreenView.deck）を描く
  src/cardTextures.ts  カード画像のテクスチャ（試合ごとに両デッキ分だけアップロード・解放）
  src/platform.ts      Vita 用 Platform 実装（保存はメモリ、ブラウザ host では localStorage）
  src/engine.ts        事前バンドル済みエンジンを EngineApi として渡す
  engine/entry.ts      エンジンのバンドル入口（使う関数だけ re-export）
  scripts/             エンジンのバンドル、PocketJS 呼び出し、QuickJS スモーク、ブラウザ確認
  toolchain/           PocketJS ツールチェーン（npm workspace の外。npm ci --prefix で入れる）
```

エンジン（`packages/engine`）の挙動は変更していません。エンジンのソースは esbuild で 1 ファイルに束ね、
**全プレイアブルカード（1,832 枚＋スターターの 1 枚、計 1,833 枚）** を入れます（`scripts/build-engine.ts`）。
`--starter` を付けると、28 種のスターターデッキに含まれる 405 枚へ刈り込んだ版を `.cache/engine-starter.js` に作ります
（ルールは `client-core/src/data/split.ts`）。刈り込み版と全カード版で同じ乱数種の CPU 対 CPU 56 試合を再生し、
ログが完全一致することを `npm run verify:prune` で確認できます。

**カード画像**も同じビルド手順で焼き込みます（`scripts/bake-card-images.ts`、リポジトリ直下の `npm install` で入る sharp を使用）。
`apps/web/public/cards` の JPEG（130×190）を、全 1,833 枚と裏面を 128×128・256 色（CLUT8、1 枚 17KB）の
PocketJS IMG エントリに変換し、`src/pak.json` 経由で pak に入れます（計 30.4MB。初回の変換は約 2 分、生成物は gitignore 済みで 2 回目以降は差分だけ）。
キーは `app:card.<カードID>` で、起動時には読み込みません。試合が始まると両デッキのカード（多くて 80 枚前後、約 1.4MB）だけを
テクスチャにアップロードし、デッキ外から出たカードはその場で読み、対戦画面を閉じると全部解放します。
デッキ構築画面では表示中のページの分だけを読み、最大 96 枚（約 1.6MB）を超えると古いものから解放します。
sharp がない環境では画像なしでビルドし、従来の文字タイルで表示します。

| バンドル | サイズ |
|---|---|
| エンジン（全カード、minify） | 8.33 MiB |
| Vita 用 JS（エンジン＋client-core＋PocketJS＋Solid） | 9.63 MiB |
| Vita 用 pak（カード画像 1,834 枚 30.4 MiB＋12px/12px 太字/16px 既定スロットの文字アトラス 各 1,359 字） | 34.2 MiB |

日本語の文字は `src/generated/chars.txt`（ビルド時に、エンジン（カード名・本文を含む）と UI ソースに現れる非 ASCII 文字 約 1,260 字を収集）を
`src/fonts.json` の `characterFiles` で指定し、Noto Sans JP（npm `@expo-google-fonts/noto-sans-jp`、SIL OFL）を
フォールバック書体としてアトラスに焼き込みます。PocketJS には日本語の自動改行がないため、改行は client-core が行います。

## 2. セットアップ（macOS / Linux 共通）

リポジトリのルートで:

```sh
npm ci
npx turbo run build --filter=@rangers-strike/engine   # client-core の型が engine の dist を参照する
cd apps/vita
npm run setup        # = npm ci --prefix toolchain && node scripts/fetch-font.mjs
```

`toolchain/` には `@pocketjs/framework`・`@pocketjs/cli`・`bun`（npm 版）と、PocketJS のコンパイラが必要とする
`@babel/core`・`@babel/preset-typescript`・`babel-preset-solid`・`opentype.js` を固定版で入れます（いずれも npm から）。
npm の install-script 承認設定で `bun` の postinstall が止まっても、`bun/bin/bun.exe` が実体なので動きます。

## 3. Vita 実機・エミュレータなしで確認する

```sh
npm run smoke:qjs        # QuickJS（qjs）で client-core＋全カード版エンジンを動かし 3 試合を最後まで進める
npm run verify:prune     # スターター刈り込み版と全カード版で 56 試合を再生し一致を確認（約 90 秒）
npm run pocket:check     # PocketJS の型検査（Vita プロファイル）
npm run pocket:compile   # Vita 用 JS と pak を dist/ に出力（VitaSDK 不要）
npm run web:preview      # PocketJS のブラウザ host（WASM）で起動 → http://127.0.0.1:8130/ で "main" を選ぶ
```

`smoke:qjs` は `brew install quickjs` などで入る `qjs` を使います（別の場所なら `QJS=/path/to/qjs`）。
結果は `.cache/smoke-qjs.log` にも書き、`qjs -d` の QuickJS メモリ統計を末尾に出します。
ブラウザ host のキー割り当ては矢印＝十字キー、Enter/Z＝○、X＝×、Q/E＝L/R です。

## 4. VitaSDK と Rust の導入（VPK を作るのに必要）

PocketJS 0.14 の Vita ホストは Rust（`hosts/vita`）で、VitaSDK・`cargo-vita` 0.2.2・Rust nightly `2026-05-28`（`rust-src` 付き）が必要です
（`toolchain/node_modules/@pocketjs/framework/hosts/vita/README.md`）。システム全体ではなくホームディレクトリに入れる手順です。

1. VitaSDK（公式 https://vitasdk.org の vdpm 手順）

   ```sh
   export VITASDK="$HOME/vitasdk"
   export PATH="$VITASDK/bin:$PATH"
   git clone https://github.com/vitasdk/vdpm
   cd vdpm
   ./bootstrap-vitasdk.sh
   vdpm install libvita2d taihen libpng zlib libjpeg-turbo freetype   # Vita ホストが使うライブラリ（確認を求められたら Y）
   ```

   `./install-all.sh` は vdpm 0.1.3（2026.08）では「package client is not executable: …/bin/pacman」で止まるため、
   必要なライブラリだけを `vdpm install` で入れます（2026-10-14 に macOS arm64 で確認）。

   macOS では事前に Xcode Command Line Tools（`xcode-select --install`）が必要です。
   `~/.zshrc` に上の 2 行の `export` を追記しておくと便利です。

2. rustup（公式 https://rustup.rs）と固定の nightly

   ```sh
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- --no-modify-path
   export PATH="$HOME/.cargo/bin:$PATH"
   rustup toolchain install nightly-2026-05-28 --component rust-src
   cargo install cargo-vita --version 0.2.2 --locked
   ```

   Homebrew の `rust` が入っていても構いません。PocketJS のビルドスクリプトが `~/.cargo/bin` と `$VITASDK/bin` を先頭に置きます。

3. 確認

   ```sh
   arm-vita-eabi-gcc --version
   ~/.cargo/bin/rustup run nightly-2026-05-28 cargo vita --help
   ```

## 5. VPK のビルド

```sh
cd apps/vita
export VITASDK="$HOME/vitasdk"
export PATH="$VITASDK/bin:$HOME/.cargo/bin:$PATH"
npm run build:vpk
# -> apps/vita/dist/vita/rangers-strike-main.vpk
```

初回は crates.io から依存クレートを取得し、`toolchain/node_modules/@pocketjs/framework/hosts/vita/target/` に Rust の成果物を作ります。
Title ID は `pocket.json` の `id`（`dev.rangers-strike.vita`）から決まり **`P295CF96C`** です。

`build:vpk` は先に `scripts/patch-pocketjs-vita.mjs` を実行します。PocketJS 0.14 の USB デバッグ版ホストは
JS の評価を 5 秒、1 フレームを 250 ms で打ち切りますが、実機ではエンジンの読み込みがこれを超え、
「InternalError: interrupted」で止まるためです（2026-10-14 に実機で確認）。上限は評価 120 秒・フレーム 30 秒に広げてあり、
`POCKET_VITA_EVAL_MS`・`POCKET_VITA_FRAME_MS` で変えられます。`--no-usb-debug` のビルドにはこの打ち切り自体がありません。

既定の VPK には PocketJS の USB 開発用ランタイムが入り、「unsafe homebrew」権限の SELF になります。
それを外すには `node scripts/pocket.mjs build -- --release --no-usb-debug` を使います。

## 6. Vita3K で動かす

1. Vita3K を公式サイト（https://vita3k.org、配布元 https://github.com/Vita3K/Vita3K/releases）から取得し、macOS では `Vita3K.app` を `~/Applications` か `/Applications` に置きます。
2. 初回起動の案内に従い、Sony 公式のファームウェア（`PSVUPDAT.PUP`）とフォントパッケージ（`PSP2UPDAT.PUP`）をインストールします。
3. メニュー **File → Install .zip, .vpk** で `dist/vita/rangers-strike-main.vpk` を選びます。
4. 一覧の「Rangers Strike」を起動します。コマンドラインからは
   `~/Applications/Vita3K.app/Contents/MacOS/Vita3K -r P295CF96C`。
5. 既定キー: 矢印＝十字キー、`C`＝○、`X`＝×、`Q`/`E`＝L/R、`V`＝△。

エミュレータでの速度は実機の速度の根拠になりません。思考時間とメモリは実機で測ってください。

## 7. 実機（PS Vita）で動かす

前提: HENkaku／Ensō などで自作ソフトが動く本体と VitaShell。

1. HENkaku の設定で「Enable Unsafe Homebrew」をオンにします（`--no-usb-debug` で作った VPK なら不要）。
2. VitaShell で `SELECT` を USB 接続に設定し、`SELECT` を押して USB ストレージモードにします。
3. `rangers-strike-main.vpk` を `ux0:/data/` などにコピーし、接続を切ります。
4. VitaShell で VPK を選び `○`（本体の決定ボタン設定によっては `×`）→ インストールを確認します。
5. LiveArea の「Rangers Strike」を起動します。

## 8. 操作

対戦画面は市販のデジタルカードゲームに近い GUI です（`client-core` の `GuiMatch`／`view/gui.ts` が表示モデルと座標を作り、`src/GuiMatchView.tsx` が描くだけ）。

- 左: フォーカス中のカードの全文（名前・種類・コスト・BP・テキスト）。L でログに切り替わります。
- 中央: 上から CPU のラッシュ・バトル、自分のバトル・ラッシュ・コマンド・手札。帯には各プレイヤーのダメージ・手札・山札・捨札・パワー・コマンド枚数を出します。
- 右: フェイズの一覧（今のフェイズが青）と、フェイズ終了ボタン（R）。手がひとつしかないとき（スタートフェイズのドロー、進入を終える等）は、ボタンがその手になります。
- 上端: 今のターンと手番。CPU や自分の手は、上端右に黄色の通知でしばらく出ます。
- カードはカード画像のイラスト部分と BP（ユニット）または種類で表示します。裏向きのカードは裏面の画像です。左のパネルには、フォーカス中のカードの画像を大きめに出します。
- 操作できるカードは黄色い枠、フォーカス中は白い枠、対象として選べるカードは赤い枠です。対象を選んでいる間、選べないカードは暗くなります。

カードで ○ を押すと、カードの横にそのカードでできる操作が出ます（例: パワーにチャージ／コマンドにチャージ、アタック）。
対象が要る操作を選ぶと、盤面で対象を選ぶモードになります。支払い・効果の対象・宣言など保留中の選択は、画面中央の選択ウィンドウに
選べるカードとボタンを並べます（手札・パワーゾーン・捨札など盤面に描いていない場所のカードも、ウィンドウにカードとして出ます）。

操作はすべてエンジンの合法手（`getLegalActions`）から作ります。カードの操作は「その合法手がそのカードの instanceId を含むか」で振り分けるだけで、GUI 側で可否は判断しません。

| 操作 | Vita | タッチ |
|---|---|---|
| カードを選ぶ | 十字キー（上下で段、左右で同じ段の隣） | カードをタップ（そのカードの操作が開く） |
| カードの操作を開く／決定 | ○（START も可）。操作のないカードでは全体の操作を開く | ポップアップの行をタップ |
| 戻る／全体の操作 | ×（ポップアップ・対象選択をやめる。盤面ではパス・スキップなど盤面のカードを指さない操作を開く） | 枠の外をタップ |
| フェイズ終了 | R | 右のフェイズ終了ボタン |
| すべての合法手 | △ | — |
| ログ／選択ウィンドウ中に盤面を見る | L | 上端・左パネルをタップ |

### デッキ構築

タイトルの「デッキ構築（全カード）」で開きます。始め方（空のデッキ・スターターを元にする・保存済みの編集）を選ぶと、
左に選んでいるカードの画像と本文、右に全カードの一覧（1 ページ 24 枚）が出ます。カードの右下は「デッキに入っている枚数/上限」です。
上端に枚数と、対戦できるか（40 枚以上・同名 3 枚まで。ルールは `@rangers-strike/cards` の `validateDeckEntries`）を出します。
保存したデッキはタイトルで「自作: 名前」として自分と CPU のどちらにも選べます。

| 操作 | Vita | タッチ |
|---|---|---|
| カードを選ぶ | 十字キー（端でページが変わる） | カードをタップ |
| 1 枚入れる／抜く | ○ ／ □ | 選んでいるカードをもう一度タップで 1 枚入れる |
| 一覧とデッキの切替 | L | 上の左のボタン |
| 種類で絞る（全種類・ユニット・オペレーション・ビークル） | △ | 上の中央のボタン |
| カテゴリで絞る（ET・WB・OT・MA・DA） | R | 上の右のボタン |
| メニュー（保存して戻る・保存せずに戻る・別のデッキ・削除） | × | 上端をタップ |

タイトル・結果画面は従来どおりテキストの一覧です（上下で選択、左右で値の変更、L／R／△でタブ切替）。
ブラウザ host のキー: 矢印＝十字、Enter／Z＝○、X＝×、A＝□、S＝△、Q＝L、E＝R。

## 9. 計測と記録

- 画面下: `CPU思考 <直近>ms 平均 最大 手数 | <メモリ>`。思考時間は `pickCpuAction` の時間で、適用（`applyAction`）は含みません。
- メモリ: ブラウザ host では JS ヒープ（`performance.memory`）、Vita と QuickJS では JS からヒープ量を取れないため
  **GameState の直列化サイズ（`state≈`）を推定値として** 表示します。実プロセスの使用量ではありません。
- ログ行（`cpu move=… think=…ms apply=…ms mem=…`、試合開始・終了）は `Platform.log` に出ます。
  ブラウザ host と QuickJS スモークでは標準出力／コンソールに出ます。**Vita では PocketJS 0.14 のホストに `console` の出力先がない** ため捨てられます。
- 保存: Vita プロファイルに `data.fs`／`data.sqlite` がないので、設定と対戦記録はメモリのみ（終了で消えます）。ブラウザ host では localStorage に残ります。

参考値（M1 Max、QuickJS 2026-06-04、`npm run smoke:qjs`。実機の値ではありません）:
エンジン読み込み 0.19 秒（全カード版 0.37 秒）、QuickJS ヒープ使用 9.6 MB（全カード版のエンジン読み込みだけで 15.8 MB）、
プロセス最大 RSS 32 MB、CPU（Lv2）1 手の思考 平均 4.0〜8.8 ms・最大 110 ms。

実機の値（PS Vita、2026-10-14、USB デバッグ版、アバレンオージ Type A 対 デカレンジャーロボ、CPU Lv2、1 試合を決着まで）:
CPU 1 手の思考 平均 192.7 ms・最大 2,805 ms（197 手）、GameState 推定 約 386 KB、
USB status の空きメモリ CDRAM 約 57 MB（起動前 約 73 MB）。Mac の QuickJS 比でおよそ 25 倍遅く、
最大の手では画面が約 3 秒止まるため、本番では CPU の思考を複数フレームに分けるか、別スレッドで実行する必要があります。

## 10. Web アプリ・スマホ／タブレットへの展開

client-core は DOM・Node・PocketJS に依存しないので、そのまま別のシェルから使えます。シェルが用意するのは次の 4 点だけです。

1. `EngineApi` の実装: Web なら `import * as engine from "@rangers-strike/engine"` と `getEffectLabel`・`starterDecks`（cards）を束ねるだけ。
2. `Platform`: `clock`（`performance.now`）、`log`（console）、`memory`（`heapOrEstimateProbe`）、`storage`（localStorage／IndexedDB、ネイティブなら AsyncStorage や SQLite）、
   `assets`（`loadMatchData` は Promise を返してよい。`data/split.ts` の `buildDeckChunks`／`chunksForMatch` で対戦に必要なデッキ分だけ取得する設計にできる）。
3. 入力: クリック／タップ座標を `hitTest(view, point)` に、キーボードを `ButtonRepeater` か直接 `controller.dispatch(input.…)` に渡す。
4. 描画: `controller.view()` の `ScreenView`（ヘッダ・タブ・行・選択肢・フッタと `layout` の矩形）を描く。`controller.setViewport()` で回転・リサイズに追従します（横長は 2 列、縦長は上下 2 段、短辺に応じて 12/14/16px）。

既存の React 版（`apps/web`）に組み込む場合は、`GameApp.tsx` の CPU ループ（`setTimeout` で `pickCpuAction`）を `GameSession.cpuStep()` に、
選択肢の文言を `describeAction` に、ログの整形を `humanizeLogEntry` に置き換えていくのが段階的な道筋です。
Web 版の豊富な専用モーダル（ゾード・バトルダンス等）はそのまま残せます。

### 移植経路の比較: PocketJS のブラウザ／WASM host か、既存 React Web アプリか

| 観点 | PocketJS ブラウザ host（WASM コア） | 既存 React／Next.js（apps/web） |
|---|---|---|
| コードの共有 | Vita と同じ `src/app.tsx` がそのまま動く（`npm run web:preview` で確認済み） | client-core を共有し、描画は React で別に書く |
| 表示 | Canvas に自前描画。文字はビルド時の焼き込みアトラス（ブラウザでは不足字を実行時に補う機能あり） | DOM・CSS。カード画像・アクセシビリティ・選択コピー・ブラウザ翻訳がそのまま使える |
| スマホ／タブレット | 固定論理解像度（Vita は 480×272）を整数倍表示。縦画面や可変サイズは PocketJS の window 系ターゲット次第 | レスポンシブ CSS、PWA、Capacitor 等でネイティブ包装しやすい |
| 依存・配布 | Bun・WASM コア・PocketJS（0.x で API 変化が速い） | 既存の Next.js 構成・Vercel 配備・Playwright テストを流用 |
| 向く用途 | 携帯機と同じ見た目の確認、Vita 版の開発ループ | 本番の Web／モバイル版 |

結論: **本番の Web／スマホ版は既存 React アプリに client-core を取り込む** のが自然で、PocketJS のブラウザ host は Vita 版の開発・確認用と位置づけるのが妥当です。

## 11. 既知の制約・未解決

- VitaSDK・cargo-vita・Rust nightly・Vita3K はこの試作の作業環境に入っていないため、**VPK の生成と Vita3K／実機での起動は未確認** です（`pocket build` は `VITASDK` 未設定で止まるところまで確認）。
  PocketJS の Vita ホストの Cargo マニフェストが npm 版パッケージ内で解決できることは `cargo metadata --offline` で確認しています。
- ブラウザ host（WASM コア＋ブラウザの JS エンジン）とホスト側 QuickJS では最後まで対戦できますが、Vita の QuickJS 上での実行速度とメモリは未計測です。
- カードデータは全カードを 1 チャンクとしてバンドルに焼き込んでいます。実行時にデッキごとのチャンクを読み込む仕組み（`AssetLoader.loadMatchData` の非同期版）は
  インターフェースと分割計画（`PER_DECK_CHUNKS`）まで用意してあります。
- 16px の既定フォントスロットは PocketJS が常に焼き込むため、使わなくても pak に 1.6 MB 含まれます。
- 選択肢はエンジンの合法手をそのまま並べるため、複数枚の支払い候補などで行数が多くなることがあります（左右キーでページ送り）。
- デッキ構築で作ったデッキは `KeyValueStore` に保存します。Vita では保存先がないため、アプリを終了すると消えます（ブラウザ host では localStorage に残ります）。
  デッキ名は自動で付けます（文字入力は未対応）。
- 全カード版の pak は約 34MB（カード画像 30.4MB＋文字アトラス）で、VPK の実行ファイルに埋め込まれます。実機でのメモリと起動時間は未計測です。
