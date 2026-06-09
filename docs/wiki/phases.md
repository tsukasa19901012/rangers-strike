# フェイズ仕様

## 1. スタートフェイズ

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html
* https://www.grnrngr.com/documents/rangersstrike/faq/
* https://w.atwiki.jp/renst/pages/264.html

概要:
ターン開始処理。先攻1ターン目は省略。

ルール:
次の3行程を**好きな順に**必ず行う（atwiki 264）:
1. ホールド中コマンドをすべてリリース
2. バトルエリアの自軍ユニット・ビークルをラッシュへ
3. 山札から1枚ドロー（山札0でドロー不可→敗北）
4. 手札枚数 < ダメージなら追加1枚ドロー可（**任意**、1ターン1回）

実装仕様:
* `returnAllBattleUnitsToRush` — 一括戻し（UI方針）
* `releaseAllCommands`
* `draw_start` / 追加ドロー: startPhase.ts
* `hasDrawnThisStart`, `hasReleasedCommandsThisStart`, `hasReturnedBattleThisStart`
* RS-022 アップキープ: `hasPaidEarthForceUpkeep`
* ファルコンクロー等: `pendingBattleToRushQueue`

タイミング:
* phase === "start"
* 3行程完了後 UI は自動でチャージへ（README）

制約:
* 各サブステップは1ターン1回

必要State:
* PlayerState has*ThisStart フラグ群

必要Action:
* return_all_battle_to_rush, release_all_commands, draw_start, pay_earth_force_upkeep

必要Event:
* start_phase_complete

依存:
* startPhase.ts, createGame.ts（先攻省略）

不明点:
* 個別ユニット戻し vs 一括 — 公式FAQは任意順可、一括もFAQ上問題なし

confidence: HIGH

---

## 2. チャージフェイズ

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html#2

概要:
手札1枚をパワーまたはコマンドへ置く（任意）。

ルール:
* 1ターン1枚まで
* 必ずオモテ向き
* スキップ可

実装仕様:
* `charge` アクション
* `hasChargedThisTurn`

タイミング:
* phase === "charge"

制約:
* 1ターン1回

必要State:
* hasChargedThisTurn

必要Action:
* charge

必要Event:
* なし

依存:
* applyAction.ts

不明点:
* なし

confidence: HIGH

---

## 3. ラッシュフェイズ

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html

概要:
オペレーション使用とユニットのラッシュ。

ルール:
* 通常オペ: 使用後捨札
* 常駐オペ: 場に配置（各プレイヤー1枚、上書き時旧常駐捨札）
* カウンター: 相手ターン・発動条件付き（詳細 timing.md）
* ラッシュ手順: 必要パワー → 追加条件可否 → コマンドホールド → 追加条件実行 → ラッシュ

実装仕様:
* phase === "rush"
* `play_operation`, `rush`, `play_counter`（窓外は不可）
* ラッシュ後 `pendingRush` で相手応答

タイミング:
* フェイズ内順序自由（FAQ）

制約:
* 必要パワー未達時は追加条件でパワー補填不可（FAQ）

必要State:
* pendingRush, pendingCommandPayment, pendingZordSetup

必要Action:
* rush, play_operation, initiate/resolve_command_payment

必要Event:
* on_rush, rush_reaction

依存:
* rushEffects.ts, zordSetup.ts, operationCounters.ts

不明点:
* XG独自キーワード（ブラスト等）— xgather 商品文のみ、コアルール未確認

confidence: HIGH（基本）/ LOW（XG拡張）

---

## 4. バトルフェイズ

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html

概要:
ラッシュ→バトル進入→NC→アタック/ストライク/パス。

ルール:
* 左から詰めて配置
* 進入ユニットはアタック・ストライク・何もしないを選択
* 何もしないでフェイズ終了可（NC人数合わせ可）
* 移動しなければバトルフェイズ終了→エンド

実装仕様:
* `move_to_battle`, `attack`, `strike`, `pass_battle_entry`
* `pendingBattleEntry` — 進入後は攻撃/ストライク/パス必須
* `mustEnterBattleBeforePhaseEnd` — RS-022 等

タイミング:
* phase === "battle"

制約:
* 相手バトルエリア空ではアタック不可
* SP1以上でストライク可（NC/効果で変動）

必要State:
* pendingBattleEntry, pendingBattle, pendingStrike, deferredBattleEntry

必要Action:
* move_to_battle, attack, strike, pass_battle_entry, end_phase

必要Event:
* enter_battle, battle_reaction, strike_reaction

依存:
* battleEntry.ts, combo.ts, applyAction.ts

不明点:
* なし（基本流れ）

confidence: HIGH

---

## 5. エンドフェイズ

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_tarn.html#5
* https://www.grnrngr.com/documents/rangersstrike/faq/（「このターン」終了）
* https://w.atwiki.jp/renst/pages/155.html

概要:
ターン終了処理。「ターンエンド」宣言で相手ターンへ移行。

ルール（atwiki 155）:
* バトルフェイズの次フェイズ
* 「ターンを終えるとき」効果はこのフェイズ中に処理
* 「自軍エンドフェイズ」は「ターンを終えるとき」より**先**に処理
* grnrngr rule_tarn.html#5 は画像主体で追加ステップは未抽出

実装仕様:
* phase === "end" → `end_phase` → 相手ターンへ
* `TurnModifiers` クリア、BP/SP修飾子クリア
* `endTurnEffects.ts` — ターン終了メニュー効果

タイミング:
* バトルフェイズ `end_phase` 後

制約:
* 必須バトル進入未完了時は battle フェイズで end 不可

必要State:
* turnModifiers, CardInstance bpModifier/spModifier/battleActed

必要Action:
* end_phase

必要Event:
* turn_end

依存:
* turnModifiers.ts, endTurnEffects.ts, createGame.ts

不明点:
* 公式エンドフェイズの明示的ステップリスト → UNKNOWN

confidence: HIGH（atwiki 155）/ MEDIUM（grnrngr 画像部）

---

## 勝利条件

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
7ダメージまたはデッキアウト（必須ドロー失敗）。

ルール:
* ダメージ7点 = パワー裏7枚相当 + damage カウンタ
* 山札0のみでは即敗北しない。引くべき時に引けないと敗北

実装仕様:
* `WIN_DAMAGE = 7`
* `player.damage` と `faceDown` power 同期
* `checkWinner`, draw 失敗時 deck-out

タイミング:
* ダメージ解決後、ドロー失敗時

制約:
* なし

必要State:
* winner, PlayerState.damage

必要Action:
* なし（自動判定）

必要Event:
* game_won

依存:
* createGame.ts, damagePayment.ts

不明点:
* なし

confidence: HIGH
