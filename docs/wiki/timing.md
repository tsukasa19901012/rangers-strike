# タイミング・優先順位

## 効果スタック優先度

出典:
* packages/engine/src/rules/effectStack.ts（コメント: 公式 離場→ストライク→バトル→ラッシュ）
* packages/cards/src/errata.ts（RS-026）

概要:
pending* から導出される単一優先度ソース。

ルール:
* 離場応答 → レジスト → ストライク → バトル → ラッシュ → ダメージ支払い → 効果選択 → バトル進入 → コマンド支払い → ゾード設定

実装仕様:
```
priority 0: leave_reaction
priority 1: register_choice
priority 2: strike_reaction
priority 3: battle_reaction
priority 4: rush_reaction
priority 5: damage_payment
priority 6: effect_choice
priority 7: battle_entry
priority 8: command_payment
priority 9: zord_setup
```

タイミング:
* `buildEffectStack(state)` — applyAction 後 sync

制約:
* `hasOpenReactionWindow` — 窓中はフェイズ行動制限

必要State:
* effectStack, pending* 群

必要Action:
* pass_*_reaction, play_counter, use_register 等

必要Event:
* stack_frame_resolved

依存:
* effectStack.ts, applyAction.ts

不明点:
* 公式全文の「離場最優先」以外の細粒度 — wiki 裁定個別

confidence: HIGH（実装順）/ MEDIUM（公式一覧との字句一致）

---

## 効果の解決

出典:
* https://w.atwiki.jp/renst/pages/1869.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
タイミング内に発動した効果を内容どおり実行。

ルール:
* 同一タイミング複数効果: 優先順位高い順 → 同順位はターンプレイヤーが順序決定
* 解決は1効果ずつ、複数カード操作も1枚ずつ
* 解決途中に発動元が離場しても、期限指定なし効果は解決続行
* 「好きなだけ」「×回まで」: 解決中に回数決定可（事前宣言不要）
* 空撃ち（対象なし）: 可、効果不発
* 対象ありで「0回」: 不可（効果未使用扱い）
* 強制効果: 対象があれば必ず選択
* 無限ループ組み合わせ: ターンプレイヤーが適用する効果を決定

実装仕様:
* effectStack + pending* 段階解決
* 空撃ち: 各 effect handler で対象なし時スキップ

confidence: HIGH

---

## 同時解決

出典:
* https://www.grnrngr.com/documents/rangersstrike/faq/
* https://w.atwiki.jp/renst/pages/1869.html

概要:
同タイミング複数効果はターンプレイヤーが順序決定。

ルール:
* BP「～になる」複数時は低い方優先（FAQ）

実装仕様:
* `simultaneousGroupId` on EffectStackFrame（部分対応）
* 完全なプレイヤー順序選択 UI — 部分未実装

confidence: MEDIUM

---

## 「このターン」

出典:
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
効果発動〜ターンプレイヤーのターンエンドまで。

実装仕様:
* `TurnModifiers` — ターン終了クリア
* `CardInstance.bpModifier` 等 — end でクリア

confidence: HIGH

---

## ラッシュ vs カウンター（RS-026）

出典:
* https://wikiwiki.jp/renst/疾風流超忍法（errata.ts 参照）
* packages/cards/src/errata.ts

矛盾:
* なし（エラッタで確定）

ルール:
* ラッシュ誘発効果 → その後 疾風カウンター窓

実装仕様:
* `RUSH_COUNTER_AFTER_TRIGGERED_EFFECTS = true`

confidence: HIGH

---

## フェイズ内行動順

出典:
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
ラッシュフェイズ内でラッシュ・オペ・常駐効果の順序自由。

実装仕様:
* legalActions は phase のみ制限、順序不問

confidence: HIGH

---

## ダメージ支払い vs ストライク再開

出典:
* packages/engine/src/types/game.ts PendingDamagePayment.resume

概要:
ストライク/leave 等の中断後 damage_payment 完了で再開。

実装仕様:
* `DamagePaymentResume`: none | strike

confidence: HIGH
