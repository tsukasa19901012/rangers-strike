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
| `src/ai/weights/` | Lv5 が使う価値ネットワークの重み（`scripts/nn/pack.py` が作る。手で書き換えない） |
| `src/cardSpec/`, `src/rulesSpec/` | カードごと・ルール章ごとのテスト |
| `src/verticalSlice/` | スターター対戦の生成と、CPU 同士の長い対戦テスト |
| `scripts/` | CPU の対戦台・監査・負荷テスト・デバッグ用スクリプト |

## 効果を書くときの注意

- 「○○を持つ自軍コマンド」のようにコマンドのカテゴリを見るときは、`cardCategories`（印刷されたカテゴリ）ではなく `src/core/catalog.ts` の `commandCategoriesOf(state, playerId, cardId)` を使います。XG7-055〜059 のドーパント（自軍ターン中、コマンドゾーンでもカテゴリが追加される）や XG1-033・XG6-013/060 で増えたカテゴリを含めるためです。
- 「〜してもよい。そうしたとき…選ぶ」のように選択が続く効果は、CPU の読み（`src/ai/simulation.ts`）が続きの自分の選択を簡易の選び方で済ませてから盤面を評価します（途中の盤面では払った分しか見えず、「行う」が選ばれなかった）。
- 効果の選択の簡易の選び方（`src/ai/helpers.ts` の `pickEffectChoice`）が `null` や「見送り」しか返さない選択は、読みに入れても使われません。新しい選択を足すときは CPU の選び方も確かめてください。手札・山札のカードを 1 枚選ぶ選択は、選んだ後の盤面の評価で選びます（`pickChoiceByEvaluation`。何枚か選んでから確定する選択は扱わない）。重ねたカードと場のユニットの置き換え（RK-022・RK-080・RK-082）は組を全部試して良ければ置き換え（`pickResidentSwapChoice`）、RS-257【予告ホームラン】は相手の山札の必要パワーの割合で決めます。
- 「コマンド」はコマンドゾーンに置かれたカードすべてです（atwiki/page-151）。チャージしたユニットのカードも含むので、「追加で自軍コマンドを N つホールドする」などでオペレーションのカードだけに絞らないでください（以前は絞っていて、ユニットのカードしかないと XG7-037 などがラッシュできなかった）。
- ストライクへの反応（プラズマエネルギー・ファイブテクター・カウンター等）のログは、`src/core/applyAction.ts` の `completeStrike` に `extraLogs` で渡します。ダメージの支払い選択などで止まるときも先にログへ残します。渡し忘れると、その効果を使ってもログに出ません。
- 特定のカード名を見るときは `src/core/cardNames.ts` の `hasNameOrAlias` を使います（「※これは「X」としてつかえる」を含めるため）。
- 「…を好きな順で山札の下（上）に戻す」は `src/rules/deckOrder.ts` の共通の選択（効果 id `deck_bottom_order` / `deck_top_order`）で選びます。選んだ順に番号が付き（下に戻すときは 1 番が上で最後の番号が一番下、上に戻すときは 1 番が一番上）、番号の付いたカードをもう一度選ぶと番号が外れ、全部に番号が付いたら「この順で戻す」で確定します。番号を外す・「選び直す」は選択がループしないよう合わせて 10 回まで。CPU は並びどおりに確定します。解決は `applyEffectChoiceSelect` が `deckOrderMeta` を見て `resolveDeckOrderPick` に回すので、カードごとの登録は要りません。
  - 使い方: 効果の処理を閉じた後なら `returnToDeckInOrder`（今の順で置いてから選択を開く）、まだ開いている選択を閉じるときは `closeWithDeckOrder`、カードを確定まで山札の上に置いたままにする効果（オモテにしたカードを戻す等）は `deckOrderChoice` で選択だけ作り、自分で開きます。2枚未満なら選択は作りません。選ぶのは効果を使ったプレイヤーが既定で、「相手が好きな順で」「持ち主が」の効果は chooser を渡します。確定した後に続きがある効果は `then`（`src/rules/deckOrderThen.ts` の `DECK_ORDER_THEN` に登録。import の循環を避けるため別ファイル）を使います（RK-089 の持ち主ごとの順、RS-433 の後のドロー、RS-515 の持ち主ごとの順）。「N枚まで選んで好きな順で戻す」は1枚ずつ選ぶ選択に `pickThenDeckOrder` を付けると、見送ったときも選んだカードの順を選べます（RS-137）。
  - 使っているカード: 山札の下は RK-089・RS-004・RS-137・RS-353・RS-387・RS-433・RS-455・RS-457・RS-515・RS-556・XG1-077・XG4-023・XG4-038・XG4-066・XG6-001・XG6-008・XG7-042・XP-031、山札の上は RK-025・RS-169・RS-186・RS-293・RS-585・XG5-047・XG5-072。RS-489（2体の場を離れる処理と一緒に選ぶ）、RK-002・RK-274（上か下かをそれぞれ選ぶ）、バトルエリアの並べ替え・ラッシュやホールドの順・重ねる順はそれぞれの選び方のままです。山札をオモテにする効果は、選べるカードが無くても `recordReveal` で公開表示に出します。

## テスト

```bash
npm test -w @rangers-strike/engine            # test:unit と test:sim の両方
npm run test:unit -w @rangers-strike/engine   # シミュレーション以外
npm run test:sim -w @rangers-strike/engine    # src/verticalSlice とモンキーテスト（長時間・直列実行）
npm run test:monkey -w @rangers-strike/engine # ランダム対戦のモンキーテストだけ
```

`src/ai/legalActionsApply.test.ts` は、CPU 同士の対戦を進めながら局面ごとに合法手（`getLegalActions`）を全部 `applyAction` に通し、合法手に出るのに断られる手がないことを確かめます（合法手の一覧と受け付けの判定の食い違いは、画面ではボタンを押してもエラーになり、CPU は指せずに対局が止まります）。合法手や「誰の番か」（`getActionPlayerId`・`isCpuTurn`）を変えたときは、`getLegalActions` と `isLegalAction` の両方に同じ順で入れてください。

`src/sweep/rushAllUnits.test.ts` は、全ユニット（約 1,500 枚）について、追加条件・必要パワー・カテゴリを満たす盤面を本物のカードで組み（`src/sweep/rushBoard.ts`。素材は追加条件の文から読み取る）、合法手だけでラッシュできるかを確かめます。コマンドがユニットのカードだけ／オペレーションだけ、パワーちょうど、素材がバトルエリア、の盤面で出せること、パワーが 1 足りなければ出せないことを見ます。追加条件の新しい書き方のカードが入って盤面を組めないときは「盤面を組めない」で落ちるので、`buildRushBoard` に読み方を足してください。

`src/sweep/effectsAllCards.test.ts` は、効果の対象になりやすいカードを両軍に置いた盤面（`src/sweep/effectBoard.ts`）で、「これをラッシュしたとき」「これがバトルエリアに出たとき」のユニット・手札のオペレーション・起動効果を全カード分使い、自分の選択を「先頭」「末尾」「見送り」の 3 通りで最後まで進めます（1 分ほど）。途中で止まる・合法手が断られる・例外が出るカード、効果を使えない・発動しないカードがあれば落ちます。結果は、効果の文のうち条件や分岐の無い最初の 1 文（約 210 枚分）について、書かれた動詞（撃破する・引く・手札に戻す・ホールドする・ダメージ等）のとおりにカードが動いたかを、使う前と後のカードの置き場所を比べて確かめます（`src/sweep/effectResult.ts`）。BP・能力の付与・細かい枚数は見ません（カード仕様テストの役目）。分岐は、「〜してもよい」（行う／見送る）・「次の効果から1つ選び ◎」・「相手は A か B かを選ぶ」の最初の選択を候補ごとに選び分け、見送ったら何も動かないこと、どの選択肢の動きもどれかの選び方で起きることを確かめます（`src/sweep/effectBranches.ts`）。「敵軍ビークルが2体以上あれば」のような盤面で決まる条件は、条件を満たす盤面と満たさない盤面を組んで、満たすときだけ書かれた動きが起きることを確かめます（`src/sweep/effectConditions.ts`。条件の書き方ごとに盤面の作り方を足す）。テストの盤面は、コマンドゾーンが 5 枚を超えないようにしています（超えると「ホールドする」等が置き場所を失って捨札になる）。「…を1体捨札にしなければバトルエリアに出られない」ユニット（RS-416 冥府神トード等。手札・パワーゾーンから捨てるものも同じ）は、バトルエリアに出すときに捨てるカードを選び、選び終えるとそのまま出ます（`GameState.battleEntryResumeMove`。もう一度「バトルエリアに出す」を選ぶ必要はない）。この盤面で発動しないのが正しいカードは、テストの `QUIET_ON_THIS_BOARD`・`REACTION_OPERATIONS`・`NO_RESULT_ON_THIS_BOARD` に理由と一緒に足してください。

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
