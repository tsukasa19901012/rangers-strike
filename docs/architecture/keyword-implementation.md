# キーワード実装状況（Wiki 参照 × エンジン）

**更新:** 2026-06-11  
**Wiki 一次ソース:** `docs/wiki/glossary/*`, `docs/wiki/sources/atwiki/page-*.md`  
**エンジン:** `packages/engine/src/keywords/`, `packages/engine/src/rules/resist.ts`, `packages/engine/src/rules/combo.ts`

---

## 1. 公式ルールの参照先

| キーワード | atwiki ページ | 用語集 md |
|-----------|--------------|-----------|
| ウイング | [1537](https://w.atwiki.jp/renst/pages/1537.html) | `glossary/wing.md` |
| チェイス | [1292](https://w.atwiki.jp/renst/pages/1292.html) | `glossary/chase-term.md` |
| モーフ | [1294](https://w.atwiki.jp/renst/pages/1294.html) | `glossary/p1294.md` |
| レジスト | [1289](https://w.atwiki.jp/renst/pages/1289.html) + grnrngr FAQ | `glossary/p1289.md`, `battle.md` |
| ライド | [156](https://w.atwiki.jp/renst/pages/156.html) | `glossary/ride.md` |
| RC | [228](https://w.atwiki.jp/renst/pages/228.html) | `glossary/p228.md` |
| クロス | [2393](https://w.atwiki.jp/renst/pages/2393.html) | `glossary/p2393.md` |
| スクラム | [1290](https://w.atwiki.jp/renst/pages/1290.html) | `glossary/p1290.md` |
| タクス | [1291](https://w.atwiki.jp/renst/pages/1291.html) | `glossary/p1291.md` |
| ブレイカー | [2355](https://w.atwiki.jp/renst/pages/2355.html) | `glossary/p2355.md` |
| ブラスト | [1701](https://w.atwiki.jp/renst/pages/1701.html) | `glossary/p1701.md` |
| ホールド（共通） | [157](https://w.atwiki.jp/renst/pages/157.html) | `glossary/p157.md` |

---

## 2. ルール要約 × 実装マトリクス

成熟度: **高** = 代表カード E2E 可 / **中** = 骨格あり・ギャップあり / **低** = 部分のみ

| キーワード | 公式ルール（要約） | 実装モジュール | 成熟度 | 主なギャップ |
|-----------|-------------------|---------------|--------|-------------|
| **レジスト** | バトル BP 比較で撃破されたときのみ、任意でホールド留場。効果撃破不可 | `resist.ts`, `registerEligible` on battle destroy | **高** | 「勝っても撃破」FAQ の残パターン |
| **スクラム** | 右隣ユニットの CN が「自 CN + 1」の間、アタック不可 | `scrumBlocksAttack` | **高** | — |
| **ライドオフ / RC** | ライドオフ時 RC。`no_strike_after_rideoff` はストライク不可 | `combo.ts`, `ridingComboEffects.ts`, `applyNoStrikeAfterRideOff` | **高** | NC レガシー/DSl 個別効果の網羅 |
| **ウイング** | BF 中ラッシュでホールド→ラッシュからアタック。当ターン BA/ストライク不可 | `hold_for_wing`, `resetWingUnitForReuse` | **高** | — |
| **クロス** | クロス N = 以降ユニットの CN・分数 SP が N 繰り上げ。重複は合算。タクス順は不変 | `battleKeywords.ts` (`crossValueForCard`, `crossAdjustedBattlePosition`) | **高** | NC/SP 解決への配線は済。追加条件のクロス分ホールドはカード別 |
| **ブラスト** | 敗北直前（実質ダメージ6）のみ、追加条件無視でラッシュ可。必要パワーは要充足 | `blastBypassesRushAdditionalCondition` → `rushAdditionalCondition.ts` | **高** | 代理条件: 表パワー≤1枚。ダメージ数明示チェックは未 |
| **ブレイカー** | 敵ユニット/ビークル**効果**の対象にならない（ブレイカー同士は可）。同名2体目ラッシュ不可 | `effectTargetability.ts`, `breakerBlocksEffectTarget` | **高** | `not_selectable_except_attack`（カブト系）との共存 |
| **タクス** | タクス○が絶対位置 P にいると、右隣の○カテゴリユニット SP=1。クロス非影響 | `taxisSpFloor`, `parseTaxisCategory` → `fractionalSp.ts` | **中** | 生インデックス判定（クロスと整合は wiki 通り）。WB/DA タクスカード少数 |
| **モーフ** | 敵ラッシュ時、特徴完全一致の自軍ユニット↔ゾーン内ユニットカード置換。通常ラッシュではない | `morph.ts`, `morphReaction.ts`, `emitUnitRushed` | **高** | 能動モーフ（カメンライド等）はカード別 |
| **ライド** | 自軍 BF 中、ラッシュ→バトル進入時に未搭乗ビークルへ重ね。1 ビークル 1 ライダー | `ride.ts` (`attachRideForBattleEntry`) | **高** | チェイス/効果ライドは別経路 |
| **チェイス** | ライド中ユニットが離場するとき、ビークル捨てて別ビークルへ。RC 付与なし | `chase.ts`, `operationCounters.ts` | **高** | 全離場 intent 監査・vehicle_destroyed E2E 拡充 |

---

## 3. キーワード別詳細

### レジスト（Register / Resist）

**Wiki:** バトル結果による撃破時のみ。ホールド後は BA 進入・攻撃不可（スタートでラッシュへ）。リリースで再使用可。

**実装:**
- `canOfferRegister`: `fromZone === "battle"` かつ `toZone === "discard"`
- `applyRegisterHold`: `registerHeld: true`, `battleActed: true`
- DSL grant `register` + `@rangers-strike/cards` の `hasResist`

**ギャップ:** 直接バトル（隠流忍術等）経路での register 提供、勝利側「撃破」判定の FAQ 網羅。

---

### クロス（Cross N）

**Wiki:** 左側クロス合計分、右側ユニットの CN/分数 SP が繰り上がる。`cross1`×2 ≠ `cross2`。

**実装:** `crossShiftLeftOf` + `crossAdjustedBattlePosition` を NC (`combo.ts`) と分数 SP (`fractionalSp.ts`) が参照。

**ギャップ:** なし（キーワード本体）。追加条件「クロス N 分ホールド」はカード DSL 側。

---

### ブラスト（Blast）

**Wiki:** 敗北直前に追加条件スキップ。必要パワーは通常通り。

**実装:** 表向きパワー ≤ 1 で `blastBypassesRushAdditionalCondition` が true → `rushAdditionalCondition.ts` でゲート短絡。

**ギャップ:** ダメージ 6 点明示よりパワー枚数代理。カード文面個別のブラスト条件は未。

---

### ブレイカー（Breaker）

**Wiki:** 敵効果のユニット/ビークル選択から保護。オペ・非選択効果・ユニットカード効果は防げない。

**実装:** `breakerBlocksEffectTarget` + 同名 rush ブロック。DSL promoted grant 対応。

**ギャップ:** 全 `effect_choice` / 手動ターゲット経路への配線監査。`not_selectable_except_attack`（カブト系）との共存。

---

### タクス（Taxis ○）

**Wiki:** 絶対位置（WB=1, MA=2, OT=3, ET=4）。NC/クロスと独立。

**実装:** `TAXIS_POSITION` + `taxisSpFloor` → `legend3EffectiveSp` 下限 1。

**ギャップ:** DA タクス未登録（カード実在少）。右隣カテゴリ不一致時の挙動テスト拡充。

---

### スクラム（Scrum）

**Wiki / カード文面:** 「これの CN より 1 多い CN を持つユニットが**次**に並んでいる間、これはアタックされない」

**実装:** `scrumBlocksAttack` — 防御側の右隣 CN === 自 CN + 1 のみ。旧 (A) 全体昇順ロジックは削除済（2026-06-11）。

---

### ウイング（Wing）

**Wiki (1537):** BF 中ラッシュでホールド → ラッシュからアタック。当ターン BA 不可・ストライク不可。

**実装:**
- `hold_for_wing` action → `commandHeld` + `markBattleBlocked` + `WING_TURN_NO_STRIKE`
- `canWingAttackFromRush` — 事前 `commandHeld` 必須
- バトル解決 — ラッシュ上の攻撃側ユニット対応

**ギャップ:** 同一 BF 内 BA→rush→再ウイング（P2）

---

### レジスト — 更新

**実装:** `registerEligible: true` はバトル BP 撃破の `LeaveIntent` のみ。効果撃破は opt-in なし → レジスト不可。

---

### ライドオフ — 更新

**実装:** `no_strike_after_rideoff` grant → `applyNoStrikeAfterRideOff` on `move_to_battle` with `rideOff`

---

### モーフ（Morph）

**Wiki:** 敵（モーフ以外）ラッシュ時のみ。特徴完全一致。置換ルール・ホールド引継ぎ適用。

**実装:**
- `openMorphReactionWindow` / `applyMorphSwap` / `featuresExactlyMatch`
- モーフ元は rush/battle、置換先 hand/rush/power/command

**ギャップ:** 敵ターン複数モーフの順序（相手選択）、能動置換オペ（ライダーパス等）は effectId 別。

---

### ライド / RC / ライドオフ

**Wiki (156, 228):** ラッシュ→BA 進入時ライド。RC は**ライドオフ時**にのみコンボ効果。効果によるライドオフでは RC 不発。

**実装:**
- `attachRideForBattleEntry` — 進入不可時ライド巻き戻し
- `resolveRidingComboOnRideOff` in `ridingComboEffects.ts` — grant_sp/bp_boost + NC + DSL
- `no_strike_after_rideoff` — `applyNoStrikeAfterRideOff` 配線済

**ギャップ:** NC レガシー個別効果の riding 経路テスト拡充

---

### チェイス（Chase）

**Wiki (1292):** 「ユニットでなくなるとき」。レジストより広い。RC 付与なし。ラッシュ上ビークルへ直接可。

**実装:** `canInitiateChase`, `PendingChase`, `applyResolveChase`, `canRiderMountVehicle`, battle→rush remount

**ギャップ:** 全離場 intent 監査、vehicle_destroyed 統合テスト拡充

---

### ウイング（Wing）— 詳細

**Wiki (1537):** BF 中ラッシュでホールド → ラッシュからアタック。当ターン BA 不可・ストライク不可。

**実装（2026-06-11 P0 対応済）:**
- `hold_for_wing` action → `commandHeld` + `markBattleBlocked` + `WING_TURN_NO_STRIKE`
- `canWingAttackFromRush` — 事前 `commandHeld` 必須
- `canStrikeUnit` — wing turn / ride-off 制限
- バトル解決 — ラッシュ上の攻撃側ユニット対応

**ギャップ（P2）:** 同一 BF 内 BA→rush→再ウイング、リリース連携による複数回ウイング

---

## 4. 未実装ルール — 優先順位付き TODO

### P0 — 誤裁定・多数カードに影響 ✅ 2026-06-11 完了

| ID | 項目 | 状態 |
|----|------|------|
| **KW-P0-01** | スクラム: 右隣 CN+1 のみ（旧 XG 昇順 variant 削除） | ✅ `scrumBlocksAttack` |
| **KW-P0-02** | ウイング: 事前ホールド + 当ターン BA 禁止 | ✅ `hold_for_wing`, `markBattleBlocked` |
| **KW-P0-03** | ウイング: 当ターンストライク禁止 | ✅ `WING_TURN_NO_STRIKE` |
| **KW-P0-04** | RC `no_strike_after_rideoff` | ✅ `applyNoStrikeAfterRideOff` |
| **KW-P0-05** | レジスト: バトル BP 撃破のみ | ✅ `registerEligible` on battle destroy |

### P1 — フレームワーク完成 ✅ 2026-06-11 完了

| ID | 項目 | 状態 |
|----|------|------|
| **KW-P1-01** | RC 汎用解決 | ✅ `ridingComboEffects.ts` — P0/NC/DSL テーブル |
| **KW-P1-02** | ブレイカー全経路 | ✅ `effectTargetability.ts` → DSL + オペ |
| **KW-P1-03** | チェイス E2E | ✅ battle→rush、`canRiderMountVehicle` |
| **KW-P1-04** | ライド巻き戻し | ✅ `attachRideForBattleEntry` |
| **KW-P1-05** | モーフ敵ターン順序 | ✅ `select_morph_unit` + 複数モーフテスト |

### P2 — 拡張・品質 ✅ 2026-06-11 完了

| ID | 項目 | 状態 |
|----|------|------|
| **KW-P2-01** | ウイング複数回 / BA→rush→wing | ✅ `prepareWingUnitReturnedToRush`, `resetWingUnitForReuse` |
| **KW-P2-02** | ブラスト条件 | ✅ ADR + `damage >= WIN-1` OR 表パワー≤1 |
| **KW-P2-03** | 能動モーフパターン | ✅ `activeMorph.ts`（カメンライド primitive） |
| **KW-P2-04** | キーワード回帰テスト | ✅ `keyword.integration.test.ts` |
| **KW-P2-05** | glossary 自動同期 | ✅ `sync-glossary-keyword-maturity.ts` |

---

## 5. エンジンファイル早見

```
packages/engine/src/
├── keywords/
│   ├── battleKeywords.ts   # cross, scrum, taxis, breaker, blast, wing helpers
│   ├── cardKeywords.ts     # wing/chase/morph/register 検出
│   ├── morph.ts / morphReaction.ts
│   ├── ride.ts
│   ├── chase.ts
│   └── registerReaction.ts
├── rules/
│   ├── resist.ts             # PendingRegister 解決
│   ├── combo.ts              # RC on ride-off dispatch
│   ├── ridingComboEffects.ts # RC effectId テーブル
│   ├── fractionalSp.ts       # cross + taxis → SP
│   └── rushAdditionalCondition.ts  # blast bypass
└── dsl/targetSelectors.ts    # effectTargetability フィルタ
```

---

## 6. 関連ドキュメント

| 文書 | 役割 |
|------|------|
| [keywords.md](../wiki/keywords.md) | Wiki ルール索引 |
| [battle.md](../wiki/battle.md) | レジスト・アタック |
| [engine-gaps.md](../wiki/engine-gaps.md) | 意図的未実装 |
| [implementation-roadmap.md](./implementation-roadmap.md) | Tier 3 スケジュール |
| [implementation-inventory.md](./implementation-inventory.md) | 開発バックログ入口 |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-06-11 | P2 完了 — ウイング再利用、ブラスト ADR、能動モーフ、回帰テスト、glossary 同期 |
| 2026-06-11 | P1 完了 — RC 汎用、ブレイカー統一、チェイス/ライド/モーフ |
| 2026-06-11 | 初版 — atwiki 用語集再読込 + エンジン突合 + P0–P2 TODO |
