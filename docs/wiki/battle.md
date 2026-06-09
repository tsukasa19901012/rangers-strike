# バトル仕様

## バトル進入

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
ラッシュエリアのユニットを左詰めでバトルエリアへ。

ルール:
* 進入時 NC 判定（左から数えた位置 = comboNumber）
* 進入後アタック/ストライク/パス選択
* ※バトル進入: コマンド追加ホールド要件（カード文面）

実装仕様:
* `move_to_battle` → 必要なら `PendingCommandPayment`（battle_entry）
* `PendingBattleEntry` 開く
* `EnterBattleResume` — NC/conditional/enter 効果の多段解決
* `deferredBattleEntry` — 選択が先の効果

タイミング:
* battle フェイズ、pending 解決後

制約:
* `cannotEnterBattle`, RS-022 強制進入, `battleBlockedInstanceIds`
* RS-069 Mユニット追加ホールド（lightning_gravity 重複）

必要State:
* pendingBattleEntry, pendingCommandPayment, battleEntry*Ready フラグ

必要Action:
* move_to_battle, pass_battle_entry, initiate/resolve_command_payment

必要Event:
* enter_battle, nc_trigger

依存:
* battleEntry.ts, combo.ts, restrictions.ts

不明点:
* なし

confidence: HIGH

---

## アタック（バトル）

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html
* https://w.atwiki.jp/renst/pages/138.html

概要:
攻撃側が防御側バトルユニットを指定し BP 比較。

ルール:
* 低BP側撃破→捨札
* 同BP相討ち（→下記）
* 相手バトル空ではアタック不可（ウイング等は例外）
* SP1以上はアタックかストライクを選択可
* 「アタックするとき/されるとき」効果はアタック処理中のみ、終了時に効果終了
* 常駐オペ・NC 効果有効

実装仕様:
* `attack` → `PendingBattle`
* `effectiveBp` + 修飾子 + 効果上書き（mirage_beam 等）
* 相討ち: 両者 leave → `PendingLeave` キュー

タイミング:
* pendingBattleEntry 解決後
* 守り側: `pendingBattle` カウンター窓

制約:
* `battleActed`, `noAttackOrStrikeTurnRushed`
* 1ユニット1ターン1回（battleActed）

必要State:
* pendingBattle, pendingLeave

必要Action:
* attack, play_counter, pass_battle_reaction

必要Event:
* battle_reaction, on_attack, unit_destroyed

依存:
* applyAction.ts, namedUnitEffects.ts, operationCounters.ts

不明点:
* なし

confidence: HIGH

---

## 相打ち

出典:
* https://w.atwiki.jp/renst/pages/1826.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
同BPでバトルし双方撃破。

ルール:
* 2体は**同時撃破**扱い
* レジスト持ちは撃破されつつ生存可（片方のみ）
* 後続NCの被りユニット活用に使える（自爆特攻と類似だが敵除去が可能）

実装仕様:
* `attack` 同BP → 両者 `PendingLeave`
* レジスト: `PendingRegister`

補助情報（atwiki 1974 コミュニティ）:
* 効果による撃破（「SP1以上の～」自壊等）とバトル撃破は区別される場合あり — 公式FAQ優先

confidence: HIGH

---

## ナンバーコンビネーション（NC）

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
バトル左からN番目に並んだ comboNumber=N ユニットの効果発動。

ルール:
* サイズ混在でも位置で判定
* ユニット「出たとき」の並びで判定（後から並び変わっても再発動しない）
* 途中ユニットが離れても欠番詰め→右端は1番として扱う（FAQ）
* 「～してもよい」のみ任意
* カテゴリ・サイズ混在コンボ可

実装仕様:
* `battlePosition` 左1始まり
* `getBattleEntryComboFromPartnerIds` 等
* RS-015: `TurnModifiers.comboNumberDelta`
* Sコンボフィニッシャー: RS-001/002

タイミング:
* バトル進入直後（enter_battle / nc）

制約:
* comboNumber 最低2（RS-015）

必要State:
* TurnModifiers, CardInstance.activatedNcEffects

必要Action:
* move_to_battle（NC解決内包）

必要Event:
* nc_trigger

依存:
* combo.ts, numberComboEffects.ts

不明点:
* ジョイントコンボ / ライディングコンボの細部 — カード別

confidence: HIGH

---

## レジスト

出典:
* https://www.grnrngr.com/documents/rangersstrike/faq/
* https://www.grnrngr.com/documents/rangersstrike/information/（ライダー2弾紹介）

概要:
「バトルで撃破されたとき」ホールド留場。

ルール:
* アタックBP比較による撃破のみ（効果撃破では不可）
* 「勝っても撃破」効果 vs レジスト — 勝利側撃破ではレジスト不可（FAQ）
* 相討ちでもレジスト可（FAQ）

実装仕様:
* `PendingRegister` / `use_register` / `pass_register`
* `registerHeld` on CardInstance
* leave 解決前に register 選択

タイミング:
* バトル撃破 → leave_reaction より前（priority 1 register_choice）

制約:
* fromZone battle のみ

必要State:
* pendingRegister, registerHeld

必要Action:
* use_register, pass_register

必要Event:
* register_choice

依存:
* resist.ts, effectStack.ts

不明点:
* なし

confidence: HIGH

---

## 代用・バトルキャンセル

出典:
* packages/cards/src/errata.ts（RS-006, RS-018）
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
カウンターによるバトル形状変更。

ルール:
* RS-006: アタック対象をラッシュへ戻しバトル不成立
* RS-018: 別ユニットに代用バトル（エラッタ文面）

実装仕様:
* `PendingBattle.battleCancelled`, `substituteInstanceId`
* `play_counter` + category payment

タイミング:
* battle_reaction 窓

制約:
* infinite_chain 等で相手カウンター不可

必要State:
* pendingBattle

必要Action:
* play_counter

必要Event:
* battle_reaction

依存:
* operationCounters.ts, namedUnitEffects.ts

不明点:
* なし

confidence: HIGH
