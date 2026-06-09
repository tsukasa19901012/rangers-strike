# ラッシュ仕様

## 基本ラッシュ

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html
* https://www.grnrngr.com/documents/rangersstrike/faq/
* https://w.atwiki.jp/renst/pages/146.html

概要:
手札（または効果）からユニットをラッシュエリアへ。

ルール:
手順（FAQ + atwiki Q3 2010/10/25修正）:
1. 必要パワーと追加条件を満たせるか確認（両方）
2. 必要コマンドをホールド
3. 追加条件実行
4. ユニットをラッシュ（リリース状態）

atwiki 補足:
* 手順処理中にコマンド/パワーが変化しても、該当手順完了済みならラッシュ続行可
* 効果によるラッシュ（通常手順以外）: 特記なし限り必要パワー・追加条件・コマンド不要（マルチカテゴリも同様）
* 「出したユニットの効果は発動しない」= `ラッシュされたとき` タイミングのみ無効（全効果無効ではない）
* スタートの battle→rush 戻しはラッシュではない
* 既存ユニットのビークル化等もラッシュではない
* BP/特徴修正: `ラッシュの瞬間` 適用 vs `ラッシュしたとき` 発動 — タイミング区別（アギト例）

実装仕様:
* `rush` アクション
* `canRushUnitExceptCommandHold` — ホールド前検証
* `initiate_command_payment` kind=category_use → continuation rush
* ラッシュ後 `PendingRush` → 相手 `pass_rush_reaction` / カウンター

タイミング:
* rush フェイズ（RS-013 等例外あり）

制約:
* 同名ユニット複数場可（FAQ）
* マルチカテゴリ: 両カテゴリコマンド — カード別

必要State:
* rushCategoryHoldReady, shironLightRushInstanceId

必要Action:
* rush, initiate/resolve_command_payment

必要Event:
* on_rush, rush_reaction

依存:
* legalActions.ts, rushEffects.ts, commandPayment.ts

不明点:
* なし

confidence: HIGH

---

## 追加条件（ゾードアップ）

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html
* https://www.grnrngr.com/documents/rangersstrike/faq/
* https://w.atwiki.jp/renst/pages/584.html

概要:
powerCost の「+」付きユニットは追加コストが必要。変身・搭乗・合体の再現。

ルール:
* 追加条件は**必要パワー充足後**の条件（パワー送りで必要パワーを満たすことは不可 — atwiki Q3）
* 「ユニット」指定は rush/battle 上のユニットのみ（手札・パワー・コマンドから不可）
* 合体ユニット捨て: テキストの「合体-」名のパートナー（rush/battle 上）
* S→command: 空きがあっても捨札選択可（atwiki Q1）
* コマンド送り: リリース状態で置く（atwiki Q2）
* 一部ビークルにもゾードアップあり

実装仕様:
* `PendingZordSetup`: material → destination → mothership
* `ZordConditionId` in effectTaxonomy
* `zordMaterialCardId` 記録（RS-009 回収）

タイミング:
* ラッシュ宣言時（手順4）

制約:
* `requiresAllFusionPartners` 等 fusion ルール

必要State:
* pendingZordSetup, CardInstance.zordMaterialCardId

必要Action:
* zord_setup steps, rush

必要Event:
* zord_material_sent

依存:
* zordSetup.ts, zord.ts, mothership.ts

不明点:
* 母艦 XL 詳細 — L2カード別

confidence: HIGH

---

## ラッシュ応答（カウンター）

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html
* packages/cards/src/errata.ts（RS-026）

概要:
相手ラッシュ後、守り側がカウンター可能。

ルール:
* RS-026 Q6/Q10: ラッシュ誘発効果は疾風カウンター窓より先（エラッタ）

実装仕様:
* `pendingRush` → effectStack rush_reaction
* `RUSH_COUNTER_AFTER_TRIGGERED_EFFECTS = true`
* `canPlayHandCounter`, `play_counter`

タイミング:
* rush 完了 → on_rush 効果 → rush 窓

制約:
* RS-072 infinite_chain: 相手カウンター不可

必要State:
* pendingRush

必要Action:
* play_counter, pass_rush_reaction

必要Event:
* rush_reaction

依存:
* rushEffects.ts, errata.ts

不明点:
* チェイス — keywords.md 参照（page 1292 取得済）

confidence: HIGH

---

## コマンドゾーンからのラッシュ

出典:
* https://www.grnrngr.com/documents/rangersstrike/faq/
* RS-005 等（wikiReference）

概要:
リリース状態のSユニットコマンド等をラッシュ。

ルール:
* 必要パワー・追加条件・カテゴリホールドを通常ラッシュと同様満たす

実装仕様:
* `rush` from command zone paths in legalActions

タイミング:
* rush フェイズ

制約:
* リリース状態のみ

必要State:
* なし（zone 参照）

必要Action:
* rush

必要Event:
* on_rush

依存:
* legalActions.ts

不明点:
* なし

confidence: MEDIUM
