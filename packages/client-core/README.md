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
| `src/session/session.ts` | 1 試合: 合法手 → ラベル付き選択肢、CPU 1 手の実行と時間計測、ログ整形（ターン交代の「━━ ターンN：〜のターン ━━」行、新しい 1000 行まで）、適用した手の記録（`actions`） |
| `src/session/remoteSession.ts` | 対人戦の 1 試合（`RemoteSession`）: サーバーの表示を受け取って描き、選んだ手を送る。通信は `MatchTransport` に任せる |
| `src/session/replay.ts` | 相手の手を1手ずつ見せるための手順（`replayEvents`: ログの新しい行と前後の盤面から、ラッシュ・NC・アタック・ストライク・カウンター・オペレーション・効果・ダメージで裏返したパワーを作る）と、それを順に再生する `ReplayPlayer` |
| `src/session/remoteView.ts` | 対人戦の表示を画面用の盤面にする（見えている山札・手札のカードを戻す、player2 なら player1 と入れ替える） |
| `src/app/gameRecord.ts` | 終わった対戦の記録（種・デッキ・手の全部）。`Platform.sendGameRecord` があるシェル（ブラウザ版）が終局時に送る |
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
| `src/testing/matchTransport.ts` | テスト用の同じプロセスの対人戦サーバー（engine `match.ts`）と、届かない・返事が消える通信 |

保存キーは `rs.settings.v1`（設定）・`rs.decks.v1`（自作デッキ）・`rs.records.v1`（戦績）・`rs.autoplay.v1`（計測用の CPU 同士の自動対戦）です。

## 新しいアプリから使う

1. `EngineApi` を用意する（例: `apps/vita/engine/entry.ts` + `apps/vita/src/engine.ts`）
2. `Platform`（時計・ログ・メモリ・保存・アセット）を実装する（例: `apps/web-pocket/src/platform.ts`）
3. `new AppController({ platform, viewport, gui: true, layouts?, ... })` を作り、入力を `controller.dispatch(...)` に渡す
4. 毎フレーム `controller.tick()` を呼び、`controller.view()` の `ScreenView` を描く。サイズが変わったら `controller.setViewport()`

## 相手の手の再生（replay）

相手（CPU・対人戦の相手）の手は盤面が一度に変わるので、何が起きたかを1手ずつ見せます。`new AppController({ ..., replay: true })` のシェル（ブラウザ版）だけが使い、Vita は使いません。

- `GameSession` は手を適用するたびに、増えたログの行と前後の盤面から `ReplayEvent` を作ってためます（`takeReplay()`）。対人戦では届いた表示ごとに作るので、相手が何手も進めていてもまとめて並びます。材料は画面に届いたログと盤面だけなので、自分に見えないカードは出てきません（相手の裏向きのパワーは新しい隠し ID で届くので、表から消えた枚数で裏返したカードを決める）。
- 拾うのは相手の手（ラッシュ・NC・アタック・ストライク・カウンター・オペレーション・効果・ダメージで裏返したパワー）と、自分のアタック・ストライク（`own: true`。動きだけで、お知らせは出さない）。バトルで場を離れたユニットも描けるように、手の前にいた列と位置（`from` / `to`）を持ちます。
- `AppController` は `ReplayPlayer` で1手ずつ流し（長さは `REPLAY_FRAMES`、3手以上たまると倍速、8手を超えたら古い手から捨てる）、`replayView()` で今の手を渡します。CPU 戦では見せ終わるまで CPU の次の手を待ちます。自分のストライクの後、相手がダメージで裏返すパワーを選んでいる間は `waiting`（「相手が裏返すパワーを選んでいます…」）を出します。
- テストは `src/session/replay.test.ts`（CPU 同士の対戦で全種類が拾えること、隠し ID のパワー、ストライクの「unknown」、カウンター、`ReplayPlayer` の順番と早送り、CPU が待つこと）と `remoteSession.test.ts`（対人戦で両方の画面に見えたカードだけで届くこと）です。

## 対人戦の画面（RemoteSession）

対人戦（オンライン、仕様: 対人戦（C案）仕様書）では、盤面はサーバーが持ち、画面は自分に見える表示（engine `matchView` / `viewFor`）だけを受け取ります。対戦画面（`GuiMatch`）は CPU 戦と同じものを使います。

- 画面は「自分 = player1」で作られているので、自分がサーバーの player2 のときは表示の中の `player1` と `player2` を全部入れ替えて描き（`swapPlayers`。キー・値・ログの行。カード定義は入れ替えない）、選んだ手は入れ替え直して送ります。エンジンは左右対称なので、入れ替えた盤面でも合法手と結果が入れ替えたものと同じになります（`remoteView.test.ts` で CPU 同士の対戦の毎手に確かめる）。
- 「山札を見て」などで見えている山札・相手の手札のカード（`revealedCards` / `revealedFrom`）は、その置き場の裏面のカードと置き換えて描きます（`materializeView`。山札の中の位置は分からないので上から）。
- 合法手はサーバーから届いたものです（`RemoteSession` の `engine` は、画面の盤面の合法手を届いた手にし、チェックウィンドウやコールの下見は自分に見える盤面でエンジンを動かす。見えないカードで動かなければ「できない」扱い）。CPU の手は動かしません。呼び名は「あなた」「相手」（`REMOTE_LABELS`。ログ・帯・ターンの見出しも）。
- 手は1つずつ送り、返事（とその後の表示）が届くまで次は送りません（`busy` の間は `turnOwner()` が `"remote"`、足元は「送信中…」）。チェックウィンドウの「N枚選んで確定」は `chooseHumanActions` で順に送ります（次の手は、前の手の後に届いた合法手の中から探す。無ければ残りは送らない）。
- 手には通し番号 `seq` を付け、通信が切れたら同じ番号と同じ版番号で送り直します（サーバーは同じ番号を2回適用しない）。断られた手（盤面が変わった等）は短いお知らせ（`takeNotice`）になり、表示を取り直します。読み込み直した画面は表示の `lastSeq` の次から送ります。
- 自分の番でなければ 1 秒ごと、自分の番でも 3 秒ごとに表示を取りに行きます（相手の手・時間切れの自動進行・投了を拾う）。前に送った問い合わせの古い表示が後から届いても、版番号が古ければ使いません。相手の手はログの最後の行をお知らせに出します。
- 対戦が終わったか（投了・時間切れ・無効試合を含む）は `session.over`、勝者は画面の呼び方（自分 = `player1`）の `winner` です。対人戦の盤面は共有ボタンの対象外で、CPU 戦の戦績にも入れません。

テストは `src/session/remoteView.test.ts`（入れ替えと、山札のカードを戻すこと）、`src/session/remoteSession.test.ts`（同じプロセスのサーバーとつないだ 2 つの画面で決着まで。毎手、自分の番の画面がサーバーの表示と同じか、通信が切れても手が2回適用されないか、放置して時間切れになっても止まらないか、投了。さらに `GuiMatch` を指の操作と同じ入力で player1 側・player2 側から決着まで）、`src/session/remoteGui.test.ts`（スターター・ブログ／大会デッキ同士の CPU 対戦の毎手に、本物の盤面から作った画面と自分に見える表示から作った画面を、盤面・全操作の一覧・カードごとの操作メニューで比べる。違えば、見えない情報で表示が変わっている）です。

## ビルドとテスト

```bash
npm run build -w @rangers-strike/client-core       # tsc で dist/ に出力（engine を先にビルドしておく）
npm test -w @rangers-strike/client-core            # Vitest
npm run typecheck -w @rangers-strike/client-core
```

`src/app/guiStall.test.ts` は CPU 同士の対戦で、自分の番なのに選択ウィンドウも盤面の手もない局面（画面では止まって見える）がないことを確かめます。エンジンに新しい待ち（`pending…`）を足したら、`src/view/board.ts` の `buildPendingView` にも足してください。

選択ウィンドウのカードは `src/view/gui.ts` の `locateInstance` で探します。常駐やユニットに重ねたカード（`stackedCards`）も探し、置き場は `operation:stack` のように `:stack` を付けて返します（表示は「自重ね」。ウラ向きは裏で出す）。見つからない id はカードでなくボタンになるため、重ねたカードを選ぶ効果がウィンドウから選べませんでした（XG6-048）。プレイヤーの配列のうち `cardId` を持つものだけをカードとして扱います（`modifiers` の「このターンラッシュした」等も `instanceId` を持つため、RK-080 超変身で同じ2枚を入れ替え直すと重ねたカードの代わりにそれを拾い、描画が毎フレーム例外になって盤面が止まりました）。

好きな枚数（「N枚まで」など）のカードを選ぶ効果（RK-080 超変身のスタートフェイズを終えるときの効果など）は、選択ウィンドウでカードにチェックを付けて「選択を確定（N枚）」で送ります（`src/app/guiMatch.ts` の check window）。チェックしたカードは窓に残り（✓・「✓選択中」）、もう一度選ぶとチェックが外れ、「選び直す（チェックをすべて外す）」で全部外れます。以前は選ぶたびにその場で送られ、カードが窓から減っていきました。カードごとの登録は要りません。人の選択で、最初の候補を状態のコピーに選んでみて同じ選択（効果 id・カードが同じで、候補が元の候補の中だけ）が開いたままなら、この窓にします。チェックはコピーの状態に順に選んで試し（選べなくなったものは外す）、ボタンを押すとチェックした順に選んでからそのボタンの手（確定・選ばない など、選んだ後の状態でエンジンが出す手）をセッションに送ります。上限まで選んで選択が閉じたら、残りのカードは選べなくなり「選択を確定」だけが出ます。選んだ後に別の質問が開く選択や、山札に戻す順番の窓（`deckOrderMeta`）・発動の確認（`mayConfirm`・`revealGate`）・1枚だけ選ぶ選択はこれまでどおりです。エンジンと CPU は変わりません。

「山札の上から…をオモテにしてもよい」の発動の確認（エンジンの選択の `revealGate`）の間は、選択ウィンドウに山札のカードを出さず（`viewedCardIds` は空）、ボタンは「発動する」「発動しない」です（`src/text/labels.ts` `describeAction`）。発動してから候補のカードが出ます（XG7-042 で発動を選ぶ前に山札の上5枚が見えていた）。

効果がオモテにしたカード（engine `GameState.lastReveal`）は「オモテにしたカード」の窓（見出し「あなたが山札の上から1枚オモテにした（効果名）」、カードの下に行き先）で見せ、閉じるまで CPU は進みません。1 つの操作で 2 回以上公開したとき（`lastReveal.earlier`）は、見ていない公開を古い順に 1 つずつ見せます（`src/app/guiMatch.ts` `revealQueue`。2 回目しか見えなかった、2026-11-20 の「見たカードが何か確認できずに処理が進む」報告）。

「自軍山札を見て…」の選択では、エンジンが足す `deckLookInstanceIds`（山札の全部）も `viewedCardIds` に入り、選べるカードの後ろに見るだけのカードとして並びます。山札から選べるカードの下の表示は「選択可能」、選べるカードと一緒に並ぶ見るだけのカードは「対象外」、山札に戻す順番の窓のカードは「選択対象」、選べるカードがない窓（山札の上の1枚を見て上か下かを選ぶ、など）では「選択対象」です（`src/app/guiMatch.ts`、2026-11-05）。ただし `deckLookInstanceIds` に入った山札のカードと、答えが「選ばない」だけの窓（RS-667 ジャン・ボエールで炎神のMユニットがない、など）のカードは、「対象外」です（XG3-063 ドレイクMF【キャストオフ】でドレイクRFが山札にないとき、山札の全部が「選択対象」と出て選べるように見えた報告。共有盤面 PV34qCqV、2026-11-11）。本文に「山札…見」があるカード全部の窓を `src/sweep/deckLookWindowAllCards.test.ts` で確かめています（engine `sweep/effectBoard.ts` の `Probe.see` で効果の選択の盤面を集め、山札 3 通りで開く）。選べるカードがないときの見るだけの窓（`effectId` `deck_look`）は、見出しが「山札を見る「カード名」: 選べるカードはありません」で、ボタンは「選ばない」だけです（`src/view/board.ts`。XG1-076 ディケイドライバーで山札を確かめられなかった報告）。

止められないループの優先（エンジンの選択 `loop_priority`、kind は simultaneous_order。XG2-029【災魔ツリー】×RS-364 など）は、見出しが「ループの優先: 互いの条件を崩し合う効果のうち、優先して適用するものを選ぶ」です（`src/view/board.ts`）。XG1-078 でコピーした RS-497 の制限の候補（`xg1078_rs497:<unitId>`）は「「（ユニット）」がコピーした【変身の妨害】の制限」と出ます。RS-566【アルティマストーム】の戻す順は「コマンドから先に山札に戻す」「ユニットから先に山札に戻す」、マジチケットでコマンドゾーンのカウンターを使う手（`use_magi_ticket` の `counter`）は「マジチケット: （カード）（カウンターとして）」です（`src/text/labels.ts`、2026-11-11）。RS-363【パンサークロー】×敵軍 RS-238【プロジェットカノン】のループでは、エンジンが「パンサークロー優先」をバルパンサー自身を選ぶ手で出しますが、GUI はこれをカードではなくボタン「パンサークローを優先してループを止める（捨札にして、プロジェットカノンは発動しない）」として出し、見送りは「捨札にしない（プロジェットカノンを優先）」と出します（`isPantherClawLoopStop`）。XG5-085【ワープ】の確認は「ワープする（…）」「ワープしない（このカードを効果の対象にする）」です（2026-11-12）。

ログの「プレイヤー|種類|…」の行のうち、エンジンの `formatGameLog` が文にしないものは `humanizeLogEntry` が日本語にします（`LOG_LABELS`。「あなた: command_payment_cancel」「あなた: turn_ending_effects」のように英語の種類名がそのまま出ていた件）。後ろの詳細は、インスタンス ID ならカード名「…」、カード ID や done などの印は出しません。`labels.test.ts` がエンジンのソースから `buildSimpleLogEntry` の種類を全部拾い、英語の種類名が残っていないかを確かめます（新しい種類を足したら `LOG_LABELS` にも足す）。カード付きのログ（`buildLogEntry`）の種類も、詳細に効果 ID や印が入った形で総当たりし、さらに CPU 同士 12 局を指して全部のログ行に英語が出ないことを確かめます（文はエンジンの `formatGameLog` 側で作ります）。

「これをホールドして次の効果を発動できる」（XG2-075・076・078。候補がこのユニット自身だけの選択）では、カードを選ぶ行は「ホールドして発動する」、選ばない行は「発動しない」です。エンジンは同じホールドを効果の支払い（`initiate_command_payment` `effect_hold`）としても合法手に出しますが、コマンドは支払わないのに「コマンドを支払って使う（種類:効果）」と並んで紛らわしかったので、`GameSession.humanOptions` が出しません（`isDuplicateSelfHoldPayment`）。

置き換えの常駐（RK-022 ライダーパス・RK-080 超変身・RK-082）は、常駐のカードを押すと「置き換える場のユニットを選ぶ」で盤面のユニットを選び、そのあと選択ウィンドウで重ねたカードを選びます（場のユニットが1体なら盤面の選択は飛ばす）。場のユニットを押すと「（常駐）で置き換える」が出て、そのユニットを選んだ状態で重ねたカードの選択から始まります。選択ウィンドウの題は `src/view/board.ts` の `buildPendingView` が「「（ユニット）」と置き換える重ねたカードを選ぶ」にします。
