# apps/vita — PS Vita テキスト版試作（PocketJS）

人間 1 人と CPU が、既存のスターターデッキで 1 試合を最後まで遊べる、テキストだけの PS Vita アプリの試作です。
UI は [PocketJS](https://github.com/pocket-stack/pocketjs)（npm `@pocketjs/framework` / `@pocketjs/cli` 0.14.0、Solid）で書いています。
ゲームの進行・表示内容・入力の解釈はすべて共有パッケージ `packages/client-core` にあり、このディレクトリは **PocketJS 向けの薄い描画・入力層** です。

- 盤面（手札・バトル・ラッシュ・パワー・コマンド・ダメージ・フェイズ）をテキストで表示します。
- 合法手はエンジンの `getLegalActions` から作り、十字キーまたはタッチで選びます。
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
  platform/            Clock / LogSink / MemoryProbe / KeyValueStore / AssetLoader のインターフェースと汎用実装
  data/split.ts        カードデータ分割（デッキ→カード ID、生成 JSON の刈り込み、デッキ単位チャンク）

apps/vita              PocketJS シェル（このディレクトリ）
  src/app.tsx          ScreenView を描くだけ。Vita ボタン/タッチ → 論理入力
  src/platform.ts      Vita 用 Platform 実装（保存はメモリ、ブラウザ host では localStorage）
  src/engine.ts        事前バンドル済みエンジンを EngineApi として渡す
  engine/entry.ts      エンジンのバンドル入口（使う関数だけ re-export）
  scripts/             エンジンのバンドル、PocketJS 呼び出し、QuickJS スモーク、ブラウザ確認
  toolchain/           PocketJS ツールチェーン（npm workspace の外。npm ci --prefix で入れる）
```

エンジン（`packages/engine`）の挙動は変更していません。エンジンのソースは esbuild で 1 ファイルに束ね、
**ビルド時にカードデータを 28 種のスターターデッキに含まれる 405 枚へ刈り込みます**
（`scripts/build-engine.ts`、ルールは `client-core/src/data/split.ts`）。
刈り込み前後で同じ乱数種の CPU 対 CPU 56 試合（全 28 デッキ）を再生し、ログが完全一致することを
`scripts/verify-engine-prune.mjs` で確認しています。

| バンドル | サイズ |
|---|---|
| エンジン（全カード、minify） | 7.32 MiB |
| エンジン（スターター 405 枚に刈り込み、minify） | 2.79 MiB |
| Vita 用 JS（エンジン＋client-core＋PocketJS＋Solid） | 3.46 MiB |
| Vita 用 pak（12px/12px 太字/16px 既定スロットの文字アトラス、各 1,264 字） | 3.38 MiB |

日本語の文字は `src/generated/chars.txt`（ビルド時に、刈り込み後エンジンと UI ソースに現れる非 ASCII 文字 約 1,170 字を収集）を
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
npm run smoke:qjs        # QuickJS（qjs）で client-core＋刈り込み済みエンジンを動かし 3 試合を最後まで進める
npm run verify:prune     # 刈り込み前後のエンジンで 56 試合を再生し一致を確認（約 90 秒）
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

| 論理入力 | Vita | タッチ |
|---|---|---|
| 前／次の選択肢 | 十字キー上／下（押し続けでリピート） | — |
| ページ送り・タイトル画面の値変更 | 十字キー左／右 | — |
| 決定 | ○（START も可） | 選択肢の行をタップ（選択して即決定） |
| パス系へ移動 | × | — |
| 表示切替（盤面:CPU／盤面:自分／ログ／詳細） | L／R（△は次へ） | 左ペイン 1 行目のタブをタップ、左ペインのその他はタブ送り |

「詳細」タブには、選択中の操作の対象カード（なければ保留中の効果の元カード）の名前・コスト・BP・テキストを折り返して表示します。

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
- 刈り込みはスターターデッキ 28 種の和集合（405 枚）単位です。実行時にデッキごとのチャンクを読み込む仕組み（`AssetLoader.loadMatchData` の非同期版）は
  インターフェースと分割計画（`PER_DECK_CHUNKS`）まで用意し、Vita では 1 チャンクをバンドルに焼き込んでいます。
- 16px の既定フォントスロットは PocketJS が常に焼き込むため、使わなくても pak に 1.6 MB 含まれます。
- 選択肢はエンジンの合法手をそのまま並べるため、複数枚の支払い候補などで行数が多くなることがあります（左右キーでページ送り）。
- カスタムデッキ（デッキ構築）は対象外です。保存インターフェース（`KeyValueStore`）は用意済みです。
