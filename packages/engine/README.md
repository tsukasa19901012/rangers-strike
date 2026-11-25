# @rangers-strike/engine — ルールエンジンと CPU AI

ゲームの状態（`GameState`）・合法手・アクション適用・効果解決・CPU AI を持つパッケージです。
UI を持たず、`@rangers-strike/cards` のカードデータだけに依存します。ルールの正は [docs/rules](../../docs/rules/README.md) です。

## 主な API

| API | 場所 |
|---|---|
| `createStarterGame` / `createGame` | `src/verticalSlice/createStarterGame.ts`、`src/core/createGame.ts` |
| `getLegalActions` / `isLegalAction` | `src/core/legalActions.ts` |
| `applyAction` | `src/core/applyAction.ts` |
| `pickCpuAction(state, playerId, level)` | `src/ai/index.ts`（レベル設定は `src/ai/types.ts` の `getCpuLevelConfig`） |
| `formatGameLog` / `formatActionError` | `src/log/` |
| `viewFor` / `resolveViewAction` / `redactNewLogLines` / `forgetHiddenAliases`（対人戦でプレイヤーごとに見える盤面） | `src/view/viewFor.ts` |
| `createMatch` / `joinMatch` / `matchAct` / `matchTick` / `matchResign` / `matchView` / `serializeMatch` / `deserializeMatch` / `createRematch` / `touchMatch` / `matchRecord`（対人戦の対戦進行） | `src/match/match.ts` |

UI 側（`packages/client-core`）は合法手をそのまま選択肢にし、選ばれたアクションを `applyAction` に渡すだけです。

## 構成

| ディレクトリ | 内容 |
|---|---|
| `src/core/` | 状態の生成、合法手、アクション適用、パワー、乱数 |
| `src/rules/` | フェイズ・ラッシュ・バトル・支払いなどのルールと、弾ごとのカード効果（`legend1`〜`3`、`rs`、`rk`、`rm`、`bk`、`xg1`〜`xg7`、`promo` 等） |
| `src/dsl/` | `@rangers-strike/cards` の DSL を解釈して効果を実行する |
| `src/keywords/` | キーワード能力（チェイス・ライド・ウイング・モーフ等） |
| `src/events/` | イベントキューとリスナー |
| `src/effects/` | オペレーション解決などの効果ブリッジ |
| `src/ai/` | CPU AI（ヒューリスティック・探索・チャージの先読み・ターン単位の読み・NC の並べ方・価値ネットワーク） |
| `src/view/` | 対人戦（サーバー判定）で1人のプレイヤーに渡す盤面（`viewFor`）と、その漏れ検査（`viewChecks.ts`） |
| `src/match/` | 対人戦の対戦進行（部屋・操作の受け付け・持ち時間・保存と読み込み）。Vercel も Upstash も知らない純粋な処理 |
| `src/ai/weights/` | Lv5 が使う価値ネットワークの重み（`scripts/nn/pack.py` が作る。手で書き換えない） |
| `src/cardSpec/`, `src/rulesSpec/` | カードごと・ルール章ごとのテスト |
| `src/verticalSlice/` | スターター対戦の生成と、CPU 同士の長い対戦テスト |
| `scripts/` | CPU の対戦台・監査・負荷テスト・デバッグ用スクリプト |

## 対人戦の「自分から見える盤面」（viewFor）

対人戦では、本物の盤面・シード・乱数の状態はサーバーだけが持ち、ブラウザには `viewFor(state, viewer, { aliases, newAliasBody })` の結果だけを渡します（仕様: 対人戦（C案）仕様書の「見える情報の切り分け」）。

- カードの ID（`RS-024-17` のようにカード番号を含む）は、プレイヤーごとの意味のない別 ID（`~` で始まる）に振り直します。対応表 `IdAliasTable` はサーバーが対戦ごとに保存し、ブラウザから届いた操作は `resolveViewAction` で本物の ID に戻します（知らない別 ID・見えないカード・本物の ID を指す操作は `null`）。文字列に埋め込まれた ID（`search:XG7-042-42` 等）も同じに扱います。見えなくなったカード（山札に戻った・相手の手札に入った・ウラ向きになった）の別 ID は `viewFor` が忘れ、次に見えたときは新しい別 ID にします（一度見たカードを追跡させない）。対戦の進行側は `viewFor` を呼ばない手の後にも `forgetHiddenAliases` を呼びます。
- 見えないカードは、中身も ID も持たない裏面（`cardId: "?"`）になります。相手の手札・お互いの山札は常に裏面で、ウラ向きのパワー（ダメージ）は持ち主にも見せません（ルール: ウラ向きのカードは誰も見られない）。
- 「山札を見て」の中身・相手の手札を見る効果などで見えているカードは、並びを見せないよう `revealedCards` にカード番号順で入ります。どのプレイヤーの山札・手札にあるかは同じ順の `revealedFrom`（`{ player, zone }`。山札の中の位置は渡さない）にあり、画面はそれで山札・手札に戻して描きます。選んでいない側には、選択の候補も `?` になります。
- 合法手は操作番のプレイヤーにだけ別 ID で渡ります。`rngState` は渡さず、カード定義は表示に出てくるカードの分だけ渡します。
- 効果の発生源・使用を宣言したカードの番号（`sourceCardId`・`zordCardId` 等）と、「このターン撃破した・ホールドした・使ったカード」の記録（`modifiers` の `payload.cardId`。場で表だったカード）は、公開済みの情報として、カードが手札にあっても伏せません（`src/view/viewChecks.ts` の `PUBLIC_CARD_ID_KEYS`）。
- ログは、その時点で見えたかで決まるので `viewFor` では作りません。1回の `applyAction` で増えた行を `redactNewLogLines(before, after, viewer)` で伏せ（操作の前にも後にも見えていなかったカードの番号と名前を「？」にする）、対戦の進行側が貯めて `viewFor` の `log` に渡します。行の後ろの詳しい部分（5つ目の `|` から。「未来予知で引いたカード」「山札の上の並び」など）は、番号のない名前だけでも出るので、このプレイヤーに見えないまま動いたカードや相手だけが見ているカードの名前も、同じ名前のカードが場に見えていても伏せます（自分で同じカードを引いた・見たときは伏せない）。見えるカードの名前の一部（「マジピンク×マジブルー」の「マジブルー」）は残します。

漏れ検査は `src/view/viewFor.test.ts`（単体）と `src/verticalSlice/viewForLeak.test.ts`（`test:sim`。スターター・ブログ／大会デッキ同士の CPU 対戦 20 試合で毎手、両者の表示に本物の ID・相手の手札や山札の中身・乱数の状態が無いこと、合法手が本物に戻せること、ログに見えなかったカードの番号・本物の ID・名前が出ないことを確かめ、さらに両者が自分の表示の合法手だけから選んで 6 試合を進める。2 分ほど）です。盤面に新しい欄を足して、そこに見えないカードの番号が出るとこの検査が落ちます。公開してよい情報なら `PUBLIC_CARD_ID_KEYS` に足し、そうでなければ `viewFor` で伏せてください。

## 対人戦の対戦進行（match）

`src/match/match.ts` は、対人戦の部屋 1 つ分の状態（`MatchState`）を進める純粋な処理です。API（`apps/web-pocket/api/match.js`）や将来の常時接続の対戦サーバーは、これを呼んで書き換わった `MatchState` を保存するだけにします。時刻・別 ID・シードの乱数は `MatchDeps`（`now` / `newAliasBody` / `randomSeed`）で渡すので、テストで差し替えられます。

- 部屋は `waiting`（`createMatch`。ホスト = player1 のデッキと先攻の決め方 `host` / `guest` / `random`）→ `playing`（`joinMatch`。ゲスト = player2 が参加し、シードを作って `createGame`）→ `finished`（勝敗・投了・3 回目の時間切れ・無効試合）。
- デッキは `{ starter: "<スターターの id>" }` か `{ cards: ["RS-001", ...] }`（同じ番号を枚数分）。実在するカードかだけを確かめ、枚数や同名の上限は確かめません（極端な入力を弾くため 1〜200 枚だけ）。
- 操作は `matchAct(m, player, { seq, version, action }, deps)`。`action` はそのプレイヤーの表示の別 ID のまま受け取り、`resolveViewAction` で戻してから、本物の合法手と（キーの順番によらず）同じかを確かめて適用します。同じ `seq` の再送は適用せずに `{ ok: true, duplicate: true }`、古い `seq`・版番号のずれ（`stale`）・操作番でない（`not_your_turn`）・知らない別 ID（`unknown_card`）・合法でない（`illegal`）は盤面を変えずに断ります。
- 持ち時間はターン制です。ターンプレイヤーは 1 ターン 3 分（`TURN_TIME_MS`。ターンが変わると戻る）、相手ターン中の選択は 1 回ごとに 30 秒（`CHOICE_TIME_MS`）で、その間はターン側の残りを減らしません。期限は `matchTick`（`matchAct` / `matchResign` も最初に呼ぶ）で確かめ、過ぎていれば期限の時刻で順に処理します。時間切れはサーバーが自動で進め（ターンプレイヤーならターンが変わるまで、途中で相手の選択が入ってもその後また続ける。相手の選択なら操作番が移るまで。見送り・取り消しを優先する `pickCpuFallbackAction`、次に CPU Lv1 の手。その自動進行ですでに通った盤面に戻る手は選ばない。合法手が「支払いを始める」だけの選択で、支払いの取り消しと行き来し続けたため）、ログに `player|match_timeout_auto|N` を残し、対戦を通して 3 回目で負けです。自動で進める手が 400 手を超えるか、進める手が無ければ無効試合にします（止まる・ループする不具合で対戦が終わらなくならないように）。
- `matchView(m, player, deps)` はブラウザに返す表示（形式の版 `format`・版番号・時計と期限・時間切れの回数・そのプレイヤーが最後に通した操作の `lastSeq`（読み込み直した画面はこの次の番号から送る）・結果・`viewFor` の表示とそのプレイヤー用に伏せたログ）。操作のたびに両者の別 ID を振っておくので、表示を作るだけでは `MatchState` は変わらず、poll で保存し直す必要はありません。
- 保存は `serializeMatch`（盤面のカード定義を除く）、読み込みは `deserializeMatch(json, engineVersion, deps)`。保存時とエンジンの版が違えば、シードと操作の記録（`actions`。時間切れで自動で進めた手も含み、その位置は `autoActions`）から最初から再生して盤面を作り直し、再生できなければ無効試合（`engine_update`）にします。盤面が保存されていないとき（操作の記録だけ）も再生します。
- 再戦は `createRematch(prev, id, engineVersion, deps)`（終わった対戦から、同じ席・同じデッキで先攻を前の逆にして、すぐ `playing` の部屋を作る）。終わった対戦の外の変化（再戦の希望・デッキ公開の同意。部屋の側が持つ）は `touchMatch` で版番号だけ進めて poll に知らせます（対戦中は使えない）。
- 対戦の記録は `matchRecord(m, at)`。CPU 戦の記録（client-core `app/gameRecord.ts`）と同じ形に `pvp: true`・`firstPlayer`・`reason` を足したもので、`createStarterGame`（`seed`・`firstPlayer`・デッキ。自作デッキは `getFullPlayableCardById`）に `actions` を順に当てると同じ対戦になります（テストで時間切れの自動進行を含めて確かめている）。勝者のいない対戦・1 手も指していない対戦は `null`。

テストは `src/match/match.test.ts`（単体）と `src/verticalSlice/matchPlay.test.ts`（`test:sim`。CPU 同士 8 試合を表示の別 ID だけで操作し、保存と読み込みを挟みながら毎 7 手に漏れ検査。さらに 10 試合で、ときどき操作番を放置して時間切れにしても無効試合にならず終わることを確かめる）です。自動進行のループの回帰テストは、見つかった盤面を `src/match/fixtures/timeoutPaymentLoop.json`（デッキ・シード・操作の記録）に置いています。

## 効果を書くときの注意

- 「○○を持つ自軍コマンド」のようにコマンドのカテゴリを見るときは、`cardCategories`（印刷されたカテゴリ）ではなく `src/core/catalog.ts` の `commandCategoriesOf(state, playerId, cardId)` を使います。XG7-055〜059 のドーパント（自軍ターン中、コマンドゾーンでもカテゴリが追加される）や XG1-033・XG6-013/060 で増えたカテゴリを含めるためです。
- 「〜してもよい。そうしたとき…選ぶ」のように選択が続く効果は、CPU の読み（`src/ai/simulation.ts`）が続きの自分の選択を簡易の選び方で済ませてから盤面を評価します（途中の盤面では払った分しか見えず、「行う」が選ばれなかった）。
- 効果の選択の簡易の選び方（`src/ai/helpers.ts` の `pickEffectChoice`）が `null` や「見送り」しか返さない選択は、読みに入れても使われません。新しい選択を足すときは CPU の選び方も確かめてください。手札・山札のカードを 1 枚選ぶ選択は、選んだ後の盤面の評価で選びます（`pickChoiceByEvaluation`。何枚か選んでから確定する選択は扱わない）。重ねたカードと場のユニットの置き換え（RK-022・RK-080・RK-082）は組を全部試して良ければ置き換え（`pickResidentSwapChoice`）、RS-257【予告ホームラン】は相手の山札の必要パワーの割合で決めます。
- 「コマンド」はコマンドゾーンに置かれたカードすべてです（atwiki/page-151）。チャージしたユニットのカードも含むので、「追加で自軍コマンドを N つホールドする」などでオペレーションのカードだけに絞らないでください（以前は絞っていて、ユニットのカードしかないと XG7-037 などがラッシュできなかった）。
- 効果の選択・ダメージの支払いを開くときのターンプレイヤー（`phasePlayerId`・`resume.activePlayer`）は、`src/core/helpers.ts` の `turnPlayerOf(state)` で取ります。反応窓・相手の選択・ダメージの支払いの間は `activePlayer` が守る側に移っているので、`state.activePlayer` を使うと解決後にターンが相手に渡ります（2026-11-12 報告「CPU のモーフ後にターンが入れ替わる」とその横展開）。
- バトル進入の効果で選択が開くと、進入の続きは `deferredBattleEntry` に残ります。続きは操作待ちがすべて終わった時点で `applyAction` の後処理（`resumeDeferredBattleEntryWhenIdle`）から再開し、ターン終了で捨てます（以前は選択のあとにダメージの支払いが挟まると再開されず、次の相手のターンに相手側で再開されていた）。
- ターンが入れ替わらないことは `npx tsx scripts/turn-owner-sweep.ts --games 800 --seed 7 --shard 0 --shards 4` で確かめます（CPU 同士の対戦で、ターンの持ち主以外がフェイズを終える試合と、持ち越した中断中のバトル進入を探す。`--only <試合番号> --trace` で 1 試合の手順を出す）。見つかった試合は `src/verticalSlice/turnOwner.test.ts` に足します。
- ストライクへの反応（プラズマエネルギー・ファイブテクター・カウンター等）のログは、`src/core/applyAction.ts` の `completeStrike` に `extraLogs` で渡します。ダメージの支払い選択などで止まるときも先にログへ残します。渡し忘れると、その効果を使ってもログに出ません。
- 「ターンを終えるとき」の効果（XG2-087 ゴールドプラチナムの捨札など）のログは、`src/core/applyAction.ts` の `finalizeTurnEnd` が `end_turn` の前に足します。`src/rules/turnEndingEffects.ts` で効果を足すときは、返り値の `logs` に入れてください。
- 効果でユニットを「バトルエリアからラッシュエリアに戻す」ときは、`trySet6BBattleToRush`（チェンジフォーメーション等）と `afterUnitsReturnedToRush`（コサック等）も呼びます。呼ばないと「戻ったとき」の誘発が起きません（RK-026【正義】で RS-394・RS-057 が誘発しなかった）。
- 効果で `phase` を直接書き換えて別のフェイズへ移すとき（RS-208【天時星・時間返し】等）も、「フェイズを終えるとき」の処理（`applyXg2BattlePhaseEnd` 等）を通します。フェイズを移るときは必ずそのフェイズを終えている扱いです（faq-card-4 RS-208）。
- 手札から見せたカードの効果（XG6-003【爆竜マルチコンバイン】で発動させた JC 等）はユニットの効果ではないので、ブレイカーで防げません。開いた選択に `sourceNotUnit: true` を付け、候補を `isSelectableByOpponentEffect(..., { sourceNotUnit })` で絞ります（atwiki/page-2355 Q5）。
- 効果で選んだ対象をログに出すには、`src/log/effectChoiceNotice.ts` の `EFFECT_TARGET_SUFFIX` と `RESOLVE_EFFECT_TARGET_NOTICE_IDS` に効果 ID を足します（`resolve_effect_choice` の詳細が `効果ID:instanceId` なら、カード名にして表示します）。効果名は `@rangers-strike/cards` の `getEffectLabel` が引き、`effectLabels.ts` に無い ID はカード文の【効果名】から作った `effect-name-registry.json` の名前を使います。
- `formatGameLog(entry, definitions, labels?)` の `labels` はプレイヤーの呼び名です（省略時は「あなた」「CPU」。対人戦の画面は「あなた」「相手」を渡す）。
- ログの文（`src/log/formatLog.ts`）には内部の名前を出しません。名前の分からない効果 ID は「効果」と書き（`readableEffectLabel`。`dark_dual_blade_command` のように後ろが付いた ID は前の部分の名前を使う）、文の決まっていない種類は `ACTION_SUFFIX` の言い方（「の撃破されたときの効果」など）にし、`cancelled` などの印やインスタンス ID（RS-454-60）はカード名と文にします。352 局の対戦ログで「self_damageを発動」「V-1システム (destroy_effect)」「「cancelled」とバトル」などが出ていた件（2026-11-16）。client-core の `labels.test.ts` が、ログの種類の総当たりと CPU 同士 12 局のログで確かめます。
- 置き換え（RK-022 ライダーパス・RK-080 超変身・RK-082 オルタフォース）は、先に置き換える場のユニット、次に重ねたカードを選びます（`src/rules/errataCardEffects.ts` の `beginRiderPass`）。起動の合法手 `activate_resident_operation` は置き換えるユニットごとに `targetInstanceId` を付けて並び、付いた手は重ねたカードの選択から始まります（GUI で場のユニットを押して起動したとき）。`targetInstanceId` を省いた手も合法で、ユニットの選択から始まります。XG4-064【リボルバーハンガー】も場のビークル → コマンドゾーンのカードの順です。モーフはもともとモーフ持ちユニット（場）を決めてから置き換えるカードを選びます。
- モーフで出たユニットの「バトルエリアに出たとき」（XG2-067【邪魔するなら撃つよ】など）は、置き換えの選択（`morph_replacement`）の `phasePlayerId` をターンプレイヤーにします。モーフ後に守る側のカウンター窓が開くと `activePlayer` は守る側になっているため、それを使うと効果の解決後にターンが入れ替わります（2026-11-12 報告）。
- 置き換え（RK-022 ライダーパス・RK-080 超変身・RK-082 オルタフォース）で場に出たカードはラッシュしたものとして扱います（`src/core/applyAction.ts` の `settleEffectRushes`）。同じターンに一度場を離れたカードがまた出るときも新しいユニットなので、`src/rules/errataCardEffects.ts` で「このターンラッシュした」の印を外してから出します（外さないと、同じ2枚を入れ替え直したときに RS-299 VRVマスターなどの「ラッシュするたび」が発動しませんでした）。「山札の上から1枚をオモテにする」効果は `src/rules/revealNotice.ts` の `recordReveal` で公開したカードを記録し、画面に出します（RS-299 も記録するようにした）。
- ウイングのホールド（`hold_for_wing`）は、ホールドした後にアタックできる敵軍ユニットがいるときだけ合法手です（`src/core/legalActions.ts` の `wingHoldHasAttackTarget`。docs/rules/07-keywords.md R-KW-WING-01）。ホールドはアタックの手順の一部なので、アタック先がないのにホールドだけする「空打ち」はできません（以前はでき、CPU がアタック先なしでナスカ・ドーパントをホールドしていた）。アタック先を広げる効果（ラッシュエリアへのアタック等）を足すときは `canAttackDefender` に入れれば、ここにも反映されます。
- 捨札コストのない起動効果（`src/rules/fieldActivatedAbilities.ts`）は、`repeatable` を付けなければ1ターン1回です。「〜選んでもよい」で見送れる効果に `repeatable` を付けると、CPU が起動→見送りを繰り返して対局が終わらなくなります（XG6-037【振り切るぜ】で起きたので外した）。
- 選んだカードの効果をコピーする効果は、コピー元に同じコピー効果を選べないようにします。XG5-079 ディケイド【ライダーカード】で敵軍捨札の XG5-079 を選ぶと同じ選択がまた開くだけで、CPU が選び続けて対局が終わらなかったので、候補から外しています（`src/ai/decadeRiderCardLoop.test.ts`）。
- 特定のカード名を見るときは `src/core/cardNames.ts` の `hasNameOrAlias` を使います（「※これは「X」としてつかえる」を含めるため）。
- 「山札の上から…をオモテにしてもよい（見てもよい）」「次の効果を発動できる⇒山札の上から…」のように、山札のカードを候補にする選択を開く任意の効果は、選択に `revealGate`（`src/rules/revealGate.ts` の `gateReveal`）を付けます。付いている間は「発動する」（`confirm_effect_choice`）と「発動しない」（`skip_effect_choice`）だけが合法手で、候補の山札のカードは画面に出ません（client-core の `viewedCardIds` も空）。発動すると確認が外れ、同じ選択が見送れない形で続きます。付けないと、発動するかを決める前に山札の上が見えてしまいます（XG7-042【ライダー大戦の世界】の報告。RK-030・RK-274・RS-063・RS-066・RS-257・RS-353（1枚ごと）・XG1-077・XG2-084・XG7-001 も同じ形）。CPU は確認を外した選択で見送るかを今までどおり決めます（`ai/helpers.ts` `pickEffectChoice`）。`src/sweep/revealGateAllCards.test.ts` が、この形の本文のカードを全部使って、見送れる最初の選択で山札のカードが見えていないかを確かめます。
  - 発動したあとも見送れる選択にしたいとき（XP-032）は `gateReveal(choice, true)`（`revealKeepsOptional`）。候補が0枚でも確認は出し、「発動する」を選ぶとそのまま `skip_effect_choice` に流れます。見送り処理（skipper）は `pending.revealGate` が残っていれば「発動しなかった」なので何もせず、外れていれば「発動したが選ぶものが無かった」なのでシャッフルなどの後処理だけをします。XG7-009 は候補が無いと聞かずにシャッフルし、XG7-009・XP-032 は「発動しない」でも山札をシャッフルしていたので、この形に直しました。同じテストの「発動しなければ、何も動かない」は「〜とき、次の効果を発動できる⇒」のカードを全部、見送ったときにカードの置き場所も山札の順番も変わらないかを確かめます。
- 「自軍山札を見て…を1枚選び」のように山札全体から探す効果は、選ぶ人に山札の全部を見せます（`src/rules/deckLook.ts`）。選べるカードがあるときは、`applyAction` の後に開いている選択へ `deckLookInstanceIds`（山札の全部。カード ID 順で、山札の並びは見せない。表示だけで解決には使わない）を足し、候補の後ろに見るだけのカードとして並びます（本文に「山札を見て（見る）」があるカードで、候補が全部選ぶ人の山札のカードのとき）。選べるカードがないときは、各効果の「候補なし」の分かれ道で `openDeckLook` を呼び、見るだけの窓（`effectId` `deck_look`、候補 0 枚、「選ばない」だけ）を開きます。閉じると効果の続き（`resumeChoice`）に戻ります。以前は窓を開かずにシャッフルして終わり、山札を確かめられませんでした（XG1-076 ディケイドライバーの報告。ほか RK-146・RK-190・RK-292・RK-319・RK-326〜328・RM-004・RM-016・RM-024・RS-100・RS-177・RS-186・RS-201・RS-249・RS-251・RS-307・RS-349・RS-519・RS-525・RS-526・RS-582・RS-605・RS-612・SM-001・SX-009・XG2-064 系のキャストオフ・XG2-087・XG3-024・XG3-025・XG3-068・XG4-004・XG4-102・XG5-008・XG5-094・XG6-014・XG6-061・XG7-009・XG7-045・XP-015・XP-032）。DSL のオペレーションは `interpretEffectPrimitives` の `deckLook` を見て、オペレーションを捨札にした後に開きます。`src/sweep/deckLookAllCards.test.ts` が、本文に「山札を見て」があるカードを、山札 3 通り（混ぜたもの／オペレーションだけ／素の S ユニットだけ）で使い、山札が動いた軍にはその山札の全部が見えていたかを確かめます。新しく山札全体から探す効果を足すときは、候補が 0 枚の分かれ道で `openDeckLook` を呼んでください。
- 「山札の上から…を見る（オモテにする）」効果は、見た（オモテにした）カードを画面に見せてから進みます。見せ方は、そのカードの選択の候補・見ているカード（`viewedInstanceIds` など。選択肢が「山札の上／下」のような言葉だけのときも、見ているカードを `viewedInstanceIds` に入れる）か、公開の記録 `GameState.lastReveal`（`src/rules/revealNotice.ts` の `recordReveal`。`from`（どこから）とカードごとの行き先 `destination` を必ず渡す）です。選択が開かずにそのまま解決する効果は `recordReveal` を呼んでください。1 つの操作で 2 回以上公開しても、直前の公開が `lastReveal.earlier`（最大 3 件、`revealNotices` で古い順に取れる）に残り、画面は見ていない公開を順に全部見せます。お互いの山札をオモテにする効果は、1 回の公開にまとめてカードごとに `ownerId` を付けます。以前は選択が開かない形の効果で、何をオモテにしたか見えないまま進みました（2026-11-20 の報告。RS-596・RS-641・RS-665・XG1-045・XG1-049・XG1-094・XG2-048・XG2-049・XG2-100・XG3-043・XG3-053・XG3-071・XG3-097・XG6-044・RS-071・RS-293、上か下かの選択でカードが出なかった BK-002、2 回目しか見えなかった XG6-008、行き先が空だった XG6-001〜003・XG6-012・XG6-027/028・XG6-046・XG6-050）。`src/sweep/deckTopRevealAllCards.test.ts` が、本文に「山札の上（から N 枚）を見る／オモテにする」があるカード（71 枚）をラッシュ・出たとき・オペレーション・起動効果・NC で使い、山札の上のカードを使ったのにどちらでも見せていないものが無いかを確かめます（アタック・バトル・RC・常駐から起きる効果は各 cardSpec の `revealedBy`）。
- 「自軍山札から（山札を見て）…を1枚選び、相手に見せてから手札に加える」効果は、選んだカードを公開の記録 `GameState.lastReveal`（`from: "deck"`、行き先 `hand`）に残し、ログにも「（効果名）で山札から「…」を見せて手札に加えた」（`deck_search_reveal`）を足します。選ぶ窓は選ぶ本人にしか見えないので、記録しないと相手には何を加えたか分かりません（2026-11-21 の報告: RK-146 デネブ【デネブキャンディー】）。カードごとの処理はそのままで、`src/rules/deckSearchReveal.ts` の一覧（カード番号と選ぶ窓の効果 ID）に載っている窓を答えたアクションの前後で、選ぶ本人の山札から手札に移ったカードを `src/core/applyAction.ts` が記録します（BK-001〜003・BK-005〜008・BK-014・RK-146・RK-156・RK-292・RM-010・RS-178・RS-349・RS-404・RS-439・RS-525・RS-582・XG3-098・XG5-094。XG7-009・XG7-045・XP-015 は自分の処理で記録）。画面では公開の窓が「山札から1枚選んで見せた」と出し、相手の手のリプレイ（client-core `replayMoves.ts`）も公開されたカードは名前を出します。対人戦の `viewFor` は公開の記録のカードを相手にも見せます。`src/sweep/deckSearchRevealAllCards.test.ts` が、本文にこの文言があるカードが一覧に漏れなく載っていること、ラッシュ・オペレーション・起動効果の盤面で山札から手札に加わったカードが公開されていることを確かめます。新しいカードは一覧に足すか、自分の処理で `recordReveal` を呼んでください。
- 同じ点検（2026-11-22、「公開なのに見えていないもの」）で、ほかに 2 種類を直しました。(1)「自分の手札から…を選び、相手に見せる」「自軍山札を見て…を選び、相手に見せる（手札に加えない）」: 選び終えたカードを公開します（`PICK_SHOW_REVEALS`。複数枚選ぶ窓は選び終えたとき。行き先は手札のままなら `stay`）。PK-014・RK-125〜128・RK-210・RK-211・RK-314・RM-024・RM-042・RS-186・RS-462・RS-463・RS-500・RS-524・RS-525・RS-568・XG1-059・XG1-061・XG1-067・XG4-081・XG5-033・XG5-055・XG7-038。手札をすべて見せる RS-365・XG2-059 はそれぞれの処理で `recordReveal` します。(2)「山札の上から…をオモテにして（にし）、その中から選ぶ／好きな順で戻す」: 選ぶ・並べる窓が開いたとき、窓に出ている山札のカードを両プレイヤーに公開します（`OPEN_SHOW_REVEALS`: RS-237・RS-257・RS-294・RS-353・RS-457・RS-515・RS-556・SR-006・XG1-054・XG2-084・XG4-066・XG5-072・XG7-042。以前は選ぶ本人の窓にしか出ませんでした）。選んでいる本人の画面では、窓に出ているカードだけの公開は重ねて出しません（client-core `guiMatch.ts`）。`src/sweep/deckSearchRevealAllCards.test.ts` が、本文に「手札から…選び、相手に見せる」があるカードが一覧かほかの見せ方に載っていること、(2) のカードの窓に出た山札のカードが効果の間に両プレイヤーに見えたことを確かめます。点検は、cardSpec・rulesSpec・sweep 全体の applyAction の前後で「オモテ・見せ・公開」と書かれたカードの選ぶ窓に出た（選んだ）山札・手札のカードが、選ばない側に見えるようになるかを調べました。
- 「…を好きな順で山札の下（上）に戻す」は `src/rules/deckOrder.ts` の共通の選択（効果 id `deck_bottom_order` / `deck_top_order`）で選びます。選んだ順に番号が付き（下に戻すときは 1 番が上で最後の番号が一番下、上に戻すときは 1 番が一番上）、番号の付いたカードをもう一度選ぶと番号が外れ、全部に番号が付いたら「この順で戻す」で確定します。番号を外す・「選び直す」は選択がループしないよう合わせて 10 回まで。CPU は並びどおりに確定します。解決は `applyEffectChoiceSelect` が `deckOrderMeta` を見て `resolveDeckOrderPick` に回すので、カードごとの登録は要りません。画面（client-core `view/board.ts`）ではこの窓の題を「続き「カード名」: 山札の上（下）に戻す順番を選ぶ」にして、直前のカードを選ぶ窓と同じ「効果の選択」の題で効果がもう1回発動したように見えないようにしています。「山札を見て」のカードの続きでも、順番の窓には山札の全部（`deckLookInstanceIds`、rules/deckLook.ts）を足さず、戻すカードだけを出します。
  - 使い方: 効果の処理を閉じた後なら `returnToDeckInOrder`（今の順で置いてから選択を開く）、まだ開いている選択を閉じるときは `closeWithDeckOrder`、カードを確定まで山札の上に置いたままにする効果（オモテにしたカードを戻す等）は `deckOrderChoice` で選択だけ作り、自分で開きます。2枚未満なら選択は作りません。選ぶのは効果を使ったプレイヤーが既定で、「相手が好きな順で」「持ち主が」の効果は chooser を渡します。確定した後に続きがある効果は `then`（`src/rules/deckOrderThen.ts` の `DECK_ORDER_THEN` に登録。import の循環を避けるため別ファイル）を使います（RK-089 の持ち主ごとの順、RS-433 の後のドロー、RS-515 の持ち主ごとの順）。「N枚まで選んで好きな順で戻す」は1枚ずつ選ぶ選択に `pickThenDeckOrder` を付けると、見送ったときも選んだカードの順を選べます（RS-137）。
  - 使っているカード: 山札の下は RK-089・RS-004・RS-137・RS-353・RS-387・RS-433・RS-455・RS-457・RS-515・RS-556・XG1-077・XG4-023・XG4-038・XG4-066・XG6-001・XG6-008・XG7-042・XP-031、山札の上は RK-025・RS-169・RS-186・RS-293・RS-585・XG5-047・XG5-072。RS-489（2体の場を離れる処理と一緒に選ぶ）、RK-002・RK-274（上か下かをそれぞれ選ぶ）、バトルエリアの並べ替え・ラッシュやホールドの順・重ねる順はそれぞれの選び方のままです。山札をオモテにする効果は、選べるカードが無くても `recordReveal` で公開表示に出します。
- ユニットをバトルエリアからラッシュエリアへ自前で移す効果は、`src/rules/bounce.ts` の `sanitizeBouncedCard` と同じくエリアでの状態（`battleActed`・`activatedNcEffects` 等）を消します。残すと、出し直したユニットがアタックもストライクもできません（RS-440【武器換装】。JC の能力だけは atwiki/page-780 Q2 のとおり `jointComboGrantsKept` で持ち越す）。

- 追加条件の素材を手札のカードで代える効果は `src/rules/zord.ts` が見ます。XG4-008 メガシルバー【I.N.E.T.特別開発班チーフ】は1回のラッシュに何回でも使えるので（atwiki/page-2137 Q2）、合体の素材（`matchFusionCombination`）でも、場で揃わない合体ユニットを手札の同名のユニットカードで1体ずつ代えます。回数はリリース状態の ET のコマンドの数まで（ラッシュのカテゴリのホールドがまだなら1つ除く。`xg4HandSubstituteBudget`）で、代えた枚数だけホールドします。以前は合体では手札を見ておらず、XG6-020 アルティメットダイボウケンをダイボウケン・ダイタンケンの両方を手札から捨札にしてラッシュできませんでした。自軍 L ユニットが場にあると使えないのは本文どおりです（ダイタンケンが場にあるときは不可）。
- 「Sユニットをラッシュしたとき」のように「ユニット」と書いてある誘発は、サイズ（`isSmallUnit`）だけでなく種類が `unit` かも見ます。ビークルにもサイズがあるので、見ないと S ビークル（XG4-049 アクロバッター）のラッシュでも発動します（RS-180 ライドラプターの報告）。
- 「追加条件を実行して満たしたとき」（RS-558 ガンマジン【鍵の持ち主の願い】）は、追加条件で捨札にしたカード（`PlayerState.lastZordDiscard`）と、手札に戻す・コマンドをホールドするなど捨札以外で動かしたカード（`lastZordExecuted`。`src/core/applyAction.ts` の手札からのラッシュで記録）のどちらかがあれば満たしたことにします。以前は捨札しか見ておらず、XG2-080 リュウキドラグレッダー（「自軍「仮面ライダー龍騎」1体を手札に戻す」）で発動しませんでした。場の状況を見るだけの追加条件（「〜がある」）は今までどおり対象外です（grnrngr/faq-card-8 RS-558 Q3）。
- 「自軍Sユニットを…パワーゾーンに送る／捨札にする／コマンドゾーンに送るか捨札にする」型の追加条件（RK-147 デンライナーイスルギ、RS-043 パトストライカー等、約 100 枚）の素材は S ユニットだけです（`isValidPowerMaterial`）。以前は大きさしか見ておらず、RK-058 マシンゼクトロンのような S ビークルでも満たせました（`src/rules/zordSVehicle.test.ts`）。
- 効果ラッシュ（`src/rules/effectRush.ts`。RS-180 ライドラプター等）の選択の後ろに別の選択が積まれていたら（`resumeChoice`。同じラッシュで出た RS-558 のドロー等）、効果ラッシュの選択を閉じるときに `PendingEffectRush.resumeChoice` に預け、効果ラッシュを終えたら開きます（`finishEffectRush`）。以前は閉じるときに落としていて、ライドラプターを使っても使わなくてもガンマジンのドローが出ませんでした。
- 場のユニットとコマンドをまとめて別のゾーンへ移す効果で、間に反応（場を離れるときのダイノガッツ・コマンドが離れたときの RS-238【プロジェットカノン】）が入りうるものは、一度に移さず段階に分けます。RS-566【アルティマストーム】（`src/rules/legend1/set8NamedEffectsC.ts`）は、ターンプレイヤーが「コマンドから」「ユニットから」を選び（atwiki/page-1229 Q1・Q2）、コマンドは移してから `afterCommandCardsLeft`、ユニットは1体ずつ `leaveFieldInOrder`（`toZone: "deck_bottom"`）で離場の処理に通します。反応で止まったら残りを `GameState.ultimaStorm` に置き、`core/applyAction.ts` の後処理（`continueUltimaStorm`）で続け、最後に山札をシャッフルします。
- カウンターなどの処理の途中でコマンドがコマンドゾーンを離れ、補充（RS-238）などの選択が開くときは、`pendingBattle` などの進行中のフレームを state に退避して外し、選択が済んだ後に `core/applyAction.ts` の後処理フックで戻して続きを処理します（例: `rk1MechanicNinjaResume`・`rk2RaiaResumeCounter`）。`pendingBattle` は合法手で `pendingEffectChoice` より優先されるため、外さないと選択より先にバトルが進みます。
- 置き換え等で「ラッシュした」扱いのユニットがアタックの途中に出たとき（XG7-055【神出鬼没の疾風】）は、`openRushCounterWindow` で「ラッシュされたとき」の窓を開き、進めるはずのバトルを state に預けて（`xg7CycloneResumeAttack`）、窓が閉じたら `core/applyAction.ts` の後処理で `continueAttackAfterDeclaration` に戻します（atwiki/page-198 Q1）。場のリードでしか払えないカウンターでも窓は開きます（`canPayCounterCategoryHold`）。
- 何回かに分けて行う処理（「…を1～5回実行」）を一度にまとめて済ませると、その途中で発動する効果が割り込めません（R-TIME-04）。1回ずつ行い、割り込む選択が開くところで止めて続きを state に預け（XG7-028 の `xg7UltimateResume`。割り込むかは `rk195RebootOpensOnRelease` のように誘発側に関数を用意して聞く）、後処理で割り込みの解決後に残りを続けます。後処理は誘発を開くフック（`applyRk10AfterAction`）の後に置き、続けた分にもそのフックを通します。

- 「特徴○○を持つ自軍ユニット」を数えるときは、ライドされていないビークルを含めません（ユニットではないため。faq-card-5 RS-216）。`fieldUnits` 系は場のビークルも返すので、`src/rules/turnEndingEffects.ts` の `isOwnVehicleFeatureUnit` のようにユニットとして扱える状態かを確かめます。
- BP0 のルール撃破（`src/core/applyAction.ts` の `applyBpZeroRuleDestruction`）は、ラッシュへのカウンターの窓（`pendingRush`）が開いていても止めません（grnrngr/faq-card-1 RS-026 Q5/Q8。ラッシュしたユニットが疾風流超忍法で山札に戻されても、その前の効果で BP0 になった敵軍ユニットは撃破される）。新しい操作待ちを `hasBlockingInteraction` に足すときは、ルール処理を待たせてよいものかを確かめてください。
- 同時に誘発した2つの効果（どちらも選択を開く）の処理順は、ターンプレイヤーが選びます（R-SIM-01）。順番で結果が変わるときは `src/rules/triggerOrder.ts` の `triggerOrderChoice(chooser, a, b)` で simultaneous_order の選択を作り（撃破の誘発の順と同じ `battleDestroyOrderMeta`。選んだほうを先に開き、もう一方をその続きにする）、後に回す選択の候補が先の効果で変わるなら `refreshOnOpen` を付けます。別のモジュールの「出たとき」の効果を取り出すときは、import の循環を避けて `registerEntryTriggerTaker` に登録したものを `takeEntryTrigger` で呼びます（XG4-075【生命の強奪】と RK-239 ウエイクアップ！。atwiki/page-2062 Q1）。CPU は両方の順を試して評価の良いほう（`ai/helpers.ts`）。
- 継続効果どうしが互いの条件を崩し合う止められないループ（R-SIM-02）は、`src/rules/loopPriority.ts` の `registerLoopDetector` に「いまループになっている組」を返す関数を登録します。いちばん外側の `applyAction` の後に、まだ選んでいない組があればターンプレイヤーに `loop_priority` の選択（kind simultaneous_order、候補は効果の発動元）を開き、結果は `state.loopPriority[key]` に残ります。各効果は `loopWinner` を見て、優先されなかった側を適用しません。検出は結果を見ない状態で行われ（`withoutLoopPriority`）、組が無くなれば結果は消えます。使っているのは XG2-029【災魔ツリー】×RS-364・XG6-053×RS-558 等・RK-013×XG3-029（サイズ。M は `sizeOverride: "M"`）・XG1-078 でコピーした RS-497【変身の妨害】。誘発どうしのループ（RS-363×RS-238）は、ターンプレイヤーの選択（【パンサークロー】）にループを止める候補（バルパンサー自身）を足す形です。
- マジチケット（RS-325）でコマンドゾーンのカウンターを使えるようにするには、`src/rules/magiTicketStage.ts` の `magiTicketCounterCandidates` / `stageMagiTicket(..., "counter_category")` を使います。合法手は `use_magi_ticket`（`counter: true`）で、カウンターの窓を開くかどうかの判定（`hasBattleCounterReactions`・巨大爆弾の `giantBombAvailable`）も手札だけでなくこの候補を見ます。
- 効果による撃破でも RK-005【超電子ダイナモ】の1点ダメージを起こすときは、撃破のあとに撃破した効果のカードを撃破者として `applyRk1DestroyerDamage` を呼びます。特徴は効果で付いたもの（`addedFeatures`）も見ます。
- 「期限なし」で SP を変える効果（XP-018 黄金の希望の SP2）は、ターン終了で消える `spOverride` ではなく `spUntilLeave` に書きます。場を離れたとき（`sanitizeUnitLeavingField`・`sanitizeBouncedCard`）に消えます。
- プロモの「○○があれば△△を得る」の付与（XP-018 のタクシス・チェイス・コール）は `promoGrantsKeyword` で引き、キーワードの判定（`cardHasKeyword`・`taxisSpFloor` 等）からも見ます。
- ゲーム開始時の効果の前に XG7-059 の選択を開くときは、`openXg7BeforeOnRush` に `resume` を渡し、`src/rules/xg7/xg7GameStartResume.ts` に再開の処理を登録します（XG5-010 ゴッドホーン）。
- 山札の一番上を公開する効果に割り込む効果は、XG5-085【ワープ】（`openXg5WarpOnDeckReveal`）を先に確認し、使わなかったときだけ SR-006【超忍法・分身魔球】（`promoInterceptDeckReveal`）を確認します。
- 新しい選択や再開処理（ループの優先・処理順・解決途中の割り込み等）を足したら、その盤面で `src/testing/noFreeze.ts` の `freezeProblems` を回すテストを足します。CPU Lv1/3/5 と「いつも最初の手」「いつも最後の手」で進め、合法手がなくなる・同じ局面に4回以上戻る・見張る選択が開き直し続けるのを見つけます（`watchedOpened` で盤面がその選択を実際に通ることも確かめる）。これで RS-363【パンサークロー】×RS-238【プロジェットカノン】で CPU が同じカードを選び続ける無限ループが見つかりました（同じカードで一度ループを回したら、次はバルパンサー（優先）か見送りだけを出す）。
## テスト

```bash
npm test -w @rangers-strike/engine            # test:unit と test:sim の両方
npm run test:unit -w @rangers-strike/engine   # シミュレーション以外
npm run test:sim -w @rangers-strike/engine    # src/verticalSlice とモンキーテスト（長時間・直列実行）
npm run test:monkey -w @rangers-strike/engine # ランダム対戦のモンキーテストだけ
```

`src/ai/legalActionsApply.test.ts` は、CPU 同士の対戦を進めながら局面ごとに合法手（`getLegalActions`）を全部 `applyAction` に通し、合法手に出るのに断られる手がないことを確かめます（合法手の一覧と受け付けの判定の食い違いは、画面ではボタンを押してもエラーになり、CPU は指せずに対局が止まります）。合法手や「誰の番か」（`getActionPlayerId`・`isCpuTurn`）を変えたときは、`getLegalActions` と `isLegalAction` の両方に同じ順で入れてください。`applyAction` の入口（`applyActionCore`）の「○○の選択待ち」で断る判定も同じ優先順にそろえます。たとえばチェイスの窓（`pendingChase`）とライドオフの選択（`pendingRideOffChoice`）が同時に開いたとき（RK-264 アクロバッターで相手がライド中のチェイスユニットを山札の下に戻したとき）は、チェイスが進入効果の処理（離場）への反応なので先に解決し、ライドオフの選択はそのあとです（以前は合法手と手番がチェイスを出すのに、`applyAction` がライドオフの選択待ちで断り、対局が止まっていた）。

Lv5 のチャージは、切り札の道筋を残します（`keyCardGuard`、`src/ai/level1.ts` の `guardKeyCharges`）。
- 切り札は、デッキで一番重い「合体―」ユニットです。その合体の文に名前が出る自分のカードも対象になります（`src/ai/deckProfile.ts` の `keyCards`）。
- これらのカードの最後の 1 枚（手札・山札・ラッシュ・バトルにほかの同じカードがない）は、パワーに置きません。
- コマンドに置くのは、XG1-088 バイクルのように自軍コマンドを手札に戻すカードがデッキにあるとき（`commandRecovery`）だけです。
- 置けるカードがほかになければ、チャージしないでフェイズを終えます。

効くのは 701 デッキ中 116 デッキです。同じデッキ同士の Lv5 対戦では、ありの側が 463 戦で 52.5%（±4.5）でした。
「パワーに一度も置かない」版も試しました。アルティメットダイボウケンを出せる試合は 192 戦で 5 → 11 に増えましたが、勝率は 29.2% → 28.6% で上がらなかったので入れていません。

CPU が合体の手順（`begin_zord_setup`・`resolve_zord_setup`）を判断するときも、`getLegalActions` と同じ前提でルールを呼びます（`src/ai/helpers.ts` の `inZordRules`）。前提は、「※このカードの追加条件は、…のとき、次のように変更される」を反映した定義（`withEffectiveRushConditionDefinitions`）と、素材の特徴の文脈（`withZordFeatureContext`）です。生の状態で呼ぶと合法な素材が見えません。以前は XG6-019 ダイボウケン（自軍捨札7枚以上でイエローの S ユニット1体に変わる）で、CPU が合体を途中で取り消し、アルティメットダイボウケンまでたどり着けませんでした。

`src/sweep/rushAllUnits.test.ts` は、全ユニット（約 1,500 枚）について、追加条件・必要パワー・カテゴリを満たす盤面を本物のカードで組み（`src/sweep/rushBoard.ts`。素材は追加条件の文から読み取る）、合法手だけでラッシュできるかを確かめます。コマンドがユニットのカードだけ／オペレーションだけ、パワーちょうど、素材がバトルエリア、の盤面で出せること、パワーが 1 足りなければ出せないことを見ます。追加条件の新しい書き方のカードが入って盤面を組めないときは「盤面を組めない」で落ちるので、`buildRushBoard` に読み方を足してください。

`src/sweep/effectsAllCards.test.ts` は、効果の対象になりやすいカードを両軍に置いた盤面（`src/sweep/effectBoard.ts`）で、「これをラッシュしたとき」「これがバトルエリアに出たとき」のユニット・手札のオペレーション・起動効果を全カード分使い、自分の選択を「先頭」「末尾」「見送り」の 3 通りで最後まで進めます（1 分ほど）。途中で止まる・合法手が断られる・例外が出るカード、効果を使えない・発動しないカードがあれば落ちます。結果は、効果の文のうち条件や分岐の無い最初の 1 文（約 210 枚分）について、書かれた動詞（撃破する・引く・手札に戻す・ホールドする・ダメージ等）のとおりにカードが動いたかを、使う前と後のカードの置き場所を比べて確かめます（`src/sweep/effectResult.ts`）。BP・能力の付与・細かい枚数は見ません（カード仕様テストの役目）。分岐は、「〜してもよい」（行う／見送る）・「次の効果から1つ選び ◎」・「相手は A か B かを選ぶ」の最初の選択を候補ごとに選び分け、見送ったら何も動かないこと、どの選択肢の動きもどれかの選び方で起きることを確かめます（`src/sweep/effectBranches.ts`）。「敵軍ビークルが2体以上あれば」のような盤面で決まる条件は、条件を満たす盤面と満たさない盤面を組んで、満たすときだけ書かれた動きが起きることを確かめます（`src/sweep/effectConditions.ts`。条件の書き方ごとに盤面の作り方を足す）。テストの盤面は、コマンドゾーンが 5 枚を超えないようにしています（超えると「ホールドする」等が置き場所を失って捨札になる）。「…を1体捨札にしなければバトルエリアに出られない」ユニット（RS-416 冥府神トード等。手札・パワーゾーンから捨てるものも同じ）は、バトルエリアに出すときに捨てるカードを選び、選び終えるとそのまま出ます（`GameState.battleEntryResumeMove`。もう一度「バトルエリアに出す」を選ぶ必要はない）。この盤面で発動しないのが正しいカードは、テストの `QUIET_ON_THIS_BOARD`・`REACTION_OPERATIONS`・`NO_RESULT_ON_THIS_BOARD` に理由と一緒に足してください。 `Probe.see` を渡すと、そのカードの効果の選択が開くたびに盤面を受け取れます（client-core `src/sweep/deckLookWindowAllCards.test.ts` が選択窓の表示の確認に使う）。

`src/sweep/resumeChoiceAllCards.test.ts` は、同じ盤面と進め方で、そのカードの効果の最初の選択が開いたときに、別のカードの選択（見張り役。RS-558 ガンマジンの「1枚ドローしてもよい」と同じ形）をその後ろ（`resumeChoice`）に積み、効果を最後まで進めたあとに見張り役の選択が開いたかを確かめます（選び方は「先頭」「見送り」。30 秒ほど）。効果の処理が選択を閉じるときに続きを引き継ぎ忘れると、後ろで待っていた別のカードの効果が消えます（2026-11-06 にライドラプターの後ろのガンマジンのドローが消えた件。見張り役を積むと、RK-089・RK-146・RS-004・RS-046・RS-050・RS-070・RS-186・RS-350・RS-366・RS-472・XG1-099・XG4-082 など 33 枚で消えていました）。いちばん外側の `applyAction` の後に `src/rules/waitingChoices.ts` の `keepWaitingChoices` が、前の状態で待っていた別のカードの選択が後の状態のどこにも無ければ付け直します（開いている選択の続き、効果ラッシュの預かり、支払い等の途中なら撃破の誘発の待ち行列）。同じカードの続きは、その効果が自分で打ち切ることがあるので触りません。

`src/rules/exile.test.ts` は除外ゾーン（`players[x].exile`）を確かめます。`moveToExile` で各ゾーンから除外ゾーンの末尾へ移ること、除外されたカードが戻らないこと（R-ZONE-11）、本物のカード効果（XG3-012【閃光星獣剣】）で除外したカードが除外ゾーンだけにあり、両プレイヤーの枚数が増減せず、BP 修正などを持ち越さないことを見ます。画面（web-pocket の「除外 N」・帯の `除N`）は除外ゾーンだけを読むので、除外する効果を書くときは必ずここへ移してください。

CI は `test:sim` を `test:sim:starters`（simulateAllStarters）・`test:sim:monkey`（2 つのモンキーテスト）・`test:sim:rest`（それ以外の `src/verticalSlice`）に分けて並列に流します。

## CPU の強さを測る

`scripts/cpu-arena.ts` は CPU 同士を、席と先攻を入れ替えて対戦させます。

```bash
cd packages/engine
npx tsx scripts/cpu-arena.ts --a 3 --b 2 --games 40 [--decks abarenoh,dekaranger,magiking]
ARENA_PROCS=4 scripts/cpu-arena-par.sh --a 3 --b 2 --games 40   # 4 プロセスで回して合算
```

`--b-src <別の作業ツリーの src/ai/index.ts>` で改良前の AI と比べられます。
`--decks` には、スターターのほかに [arena-decks/](arena-decks/README.md) の大会のデッキ・atwiki のデッキサンプルから組んだデッキ・ブログ等のデッキ（`zero-one`、`wiki-1716`、`blog-rabbit-9303419` など）も渡せます。まとめて `starters`・`arena`・`wiki`・`blog`・`livedoor`・`blog2`・`rstournament` とも書けます（`selfplay.ts` も同じ。最後の 3 つは `arena`・`blog` に入らず、名指ししたときだけ使います。`rstournament` は計測用のテスト用デッキです）。
学習した価値ネットワークを試すときは `--nna <重みの JSON> [--nn-blend 0.5]`、レベル設定を片側だけ変えるときは `--oa` / `--ob`（例 `--ob '{"valueNetBlend":0}'` で B を手書きの評価だけの Lv5 にする）を使います。
自己対戦データの集め方・学習・重みの同梱は [scripts/nn/README.md](scripts/nn/README.md) にまとめています。
人と CPU の対戦の記録（ブラウザ版が終局時に送るもの。[apps/web-pocket](../../apps/web-pocket/README.md) の `scripts/list-game-records.mjs` で読み出す）は
`npx tsx scripts/replay-game-records.ts game-records.json [--log <key>] [--nn-out <dir>]` で再生し、CPU の負けた対戦を並べます。`--nn-out` は `selfplay.ts` と同じ形式で学習用の局面を書きます。
スターター同士の行動の内訳は `npx tsx scripts/starter-sim-stats.ts --p1 w-impact-b --p2 w-impact-a --games 10` で数えられます。

## CPU・エンジンを速くするとき

- CPU の探索の間（`src/ai/index.ts` の `pickCpuAction` の中）は状態を書き換えないので、`src/core/searchCache.ts` の表で合法手・`applyAction` の結果・BP 等を使い回します。状態だけで決まる計算はここに載せます。
- 弾ごとのフック（`src/rules/xg1`〜`xg7` の BP の補正・`applyAction` の後処理）は、探索の間はその弾のカードが対局に無ければ呼びません（`src/rules/setHookGates.ts`）。フックに他の弾のカードの ID を書いたら `SET_HOOK_EXTRA_IDS` にも足します（`setHookGates.test.ts` が突き合わせます）。呼ばないフックが本当に何もしないかは、`RS_HOOK_GATE_CHECK=1 npm run test:unit -w @rangers-strike/engine` で確かめます（呼ばないことにしたフックも呼んで比べ、違えば例外にします）。
- 1 回の合法手の列挙の中で何度も呼ぶ重い判定は、`src/core/enumerationMemo.ts` の `memoizeInEnumeration` で列挙の間だけ覚えます。RS-353 デンジファイターは素材の組み合わせごとの支払いの確認でゾードの手順の判定を毎回やり直していて、自軍のユニットが 11 体いると合法手の計算に約 2 分かかっていました（今は 0.5 秒）。
- 選ぶ手を変えない変更は、変更の前後で `scripts/cpu-move-hash.ts` の出力（同じ seed の対局の手順のハッシュ）を diff して確かめます。

```bash
npx tsx scripts/cpu-move-hash.ts 5 0 16 > before.txt   # Lv5 の 16 局（Lv1 なら 0 46 で全スターター）
```

2026-10-25 の見直し（候補が 1 つの読みを省く、支払いの試し打ちを必要な分だけにする、弾ごとのフックを絞る等）で、
選ぶ手は同じまま、Lv5 同士の 4 局の思考時間は 42.5 秒 → 26.3 秒になりました（1 手あたり 25 ms → 16 ms）。

## ビルド

`npm run build -w @rangers-strike/engine`（`tsc` で `dist/` に出力）。Vita 版とブラウザ版は `dist` ではなく、
`apps/vita/scripts/build-engine.ts` で `src/` を esbuild でバンドルして使います。
