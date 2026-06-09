# ダメージ仕様

## ストライクダメージ

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html
* https://w.atwiki.jp/renst/pages/105.html

概要:
SP1以上のユニットが相手プレイヤーへ直接攻撃。7ダメージで敗北。

ルール:
* 1ストライク = 1ダメージ（基本）
* 7ダメージで勝利
* ストライク時も常駐・NC 有効

実装仕様:
* `strike` → `PendingStrike`
* `PendingStrike.damage`（効果で増減/cancel）
* 守り側: five_tech, plasma_energy, pass_strike_reaction
* RS-014: ストライク無効化バトル

タイミング:
* battle フェイズ、pendingBattleEntry 後
* strike_reaction 窓 → damage_payment

制約:
* SP要件: `canStrikeUnit`
* `noAttackOrStrikeTurnRushed`

必要State:
* pendingStrike, pendingDamagePayment

必要Action:
* strike, pass_strike_reaction, five_tech_intercept, use_plasma_energy

必要Event:
* strike_reaction, damage_applied

依存:
* strikeReactions.ts, applyAction.ts

不明点:
* タッグストライク — 未実装（glossaryImplementation）

confidence: HIGH（単体ストライク）

---

## ダメージ支払い

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html
* https://www.grnrngr.com/documents/rangersstrike/faq/
* https://w.atwiki.jp/renst/pages/105.html

概要:
ダメージN点 → 表向きパワーN枚を裏返し。不足分は山札上から裏向きでパワーへ。

ルール:
* 裏パワー1枚=ダメージ1点（atwiki 105）
* 裏返す表パワーは自由選択（FAQ）
* パワー裏枚数は非公開（FAQ）
* 山札0で引けない場合は敗北（必須ドロー時）
* ダメージ枚数 > 手札 → スタートフェイズ追加ドロー可（phases.md）

実装仕様:
* `startDamagePayment` → `PendingDamagePayment`
* `remainingFlips`, `deckDraws`, `selectedFlipIds`
* 表パワー > 必要枚数: プレイヤー選択（RS-149 等で choosingPlayerId 変更）
* `applyPlayerDamage`: damage カウンタ更新
* `resume`: strike 再開等

タイミング:
* effectStack priority 5 damage_payment

制約:
* フルブラスト等: 負け点以上裏返し不可 — XGカード、本引擎未対応

必要State:
* pendingDamagePayment, PlayerState.damage, CardInstance.faceDown

必要Action:
* select_damage_power, resolve_damage_payment

必要Event:
* damage_payment, post_damage_triggers

依存:
* damagePayment.ts, postDamageEffects.ts

不明点:
* なし

confidence: HIGH

---

## BP修正・参照

出典:
* https://www.grnrngr.com/documents/rangersstrike/faq/（リファレンス）

概要:
BP計算と「本来の値」の区別。

ルール:
* 参照時はその時点の修正後BP
* 「本来の値」明示時は印刷BP
* 「+」効果は重複加算
* 「～になる」は上書き（低い方優先）
* 計算順: 指定値 → 「+」→ 「-」

実装仕様:
* `effectiveBp`, `bpModifier`, `mirageBeamBpOverride`
* RS-123 super_dynamite: 印刷BPでバトル

タイミング:
* バトル宣言時

制約:
* ターン終了で bpModifier クリア

必要State:
* CardInstance.bpModifier, TurnModifiers.ghostAbsorptionBp

必要Action:
* なし（自動計算）

必要Event:
* bp_recalculated

依存:
* catalog.ts, combo.ts

不明点:
* 全カードの「～になる」同時発動 — ターンプレイヤー順序選択（FAQ）の UI

confidence: HIGH

---

## 追加ドロー（スタート）

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
手札 < ダメージなら追加1枚（1ターン1回）。

ルール:
* 手札と同数になるまでではない（FAQ: 1回のみ）

実装仕様:
* startPhase bonus draw logic

タイミング:
* 必須ドロー後

制約:
* 1ターン1回

必要State:
* hasDrawnThisStart

必要Action:
* draw_start（bonus 分）

必要Event:
* なし

依存:
* startPhase.ts

不明点:
* なし

confidence: HIGH
