# カードフラグ移行レポート（Phase 0–6 実施）

**日付:** 2026-06-09  
**参照:** `card-flags-migration.md`  
**テスト:** 551/551 PASS（monkey 80 + vertical slice 100 含む）

---

## Phase 0 — 準備 ✅

| 項目 | 状態 |
|------|------|
| `packages/engine/src/events/` スケルトン | ✅ 完了（前セッション） |
| `GameEvent` 7 種 | ✅ `types.ts` |
| `EventQueue` / `EventDispatcher` / `EventResolver` | ✅ |
| integration test 維持 | ✅ 548 PASS |

---

## Phase 1 — Modifier 基盤 ✅

| 項目 | 実装 |
|------|------|
| `ScopedModifier[]` | `PlayerState.modifiers` |
| ターンスコープ rule 移行 | `zenibomb`, `infinite_chain`, `deace_sniper`, `super_dynamite` |
| ラッシュフェイズ rule | `hidora_egg` → `RUSH_PHASE_RULE_IDS` |
| restriction 移行 | `battleBlocked`, `rushedThisTurn` → `RESTRICTION_IDS` |
| `getStaticRestrictions(cardId)` | `rules/staticRestrictions.ts` |
| `clearTurnModifiers` | `clearTurnScopedModifiers` 連携 |
| `resetRushPhaseFlags` | `clearRushPhaseScopedModifiers` 連携 |

**削除した TurnModifiers boolean:** `infiniteChainActive`, `deaceSniperActive`, `zenibombActive`, `superDynamiteActive`, `shironLightUsed`, `hidoraEggUsed`

---

## Phase 2 — Event 層 ✅

| Event | Listener | 発火経路 |
|-------|----------|----------|
| `UnitRushed` | `unitRushedListener` | `emitUnitRushedAndFinalize` |
| `UnitEnteredBattle` | `unitEnteredBattleListener` | `emitUnitEnteredBattleEffects` |
| `BattleDeclared` | `battleDeclaredListener` | `emitBattleDeclaredAndResolve` |
| `StrikeDeclared` | `strikeDeclaredListener`（スタブ） | `emitStrikeDeclared`（strike アクション） |
| `UnitLeftZone` | `unitLeftZoneListener` | `finalizeLeavePending` → `emitUnitLeftZoneAndResolve` |
| `DamageApplied` | `damageAppliedListener` | `applyDamageToPlayer` |
| `TurnEnding` | `turnEndingListener` | `finalizeTurnEnd` → `emitTurnEndingAndResolve` |

**抽出モジュール:** `leaveEffects.ts`, `turnEndingEffects.ts`

---

## Phase 3 — CostWindow 統合 ✅（基盤）

| 項目 | 実装 |
|------|------|
| `PlayerState.costWindows` | `types/costWindow.ts` |
| ブリッジ API | `core/costWindow.ts`（レガシー boolean と二重書き込み） |
| `battle_entry_hold` 接続 | `restrictions.ts` の `satisfyCostWindow` / `isCostWindowSatisfied` |

**残作業（段階移行）:** 完了 — 全 CostWindow 種別を `isCostWindowSatisfied` / `satisfyCostWindow` 経由に統合。RS-132 metadata は enter_battle 解決後にクリア。

---

## Phase 1 追補 — TurnModifiers 残フィールド ✅

| フィールド | 移行先 |
|-----------|--------|
| `comboNumberDelta` | `TURN_RULE_IDS.COMBO_NUMBER_DELTA` (payload) |
| `sComboFinisher` | `TURN_RULE_IDS.S_COMBO_FINISHER` |
| `auraPowerInstanceId` | `TURN_RULE_IDS.AURA_POWER` |
| `bakiBakiExtraAttackIds` | `RESTRICTION_IDS.BAKI_BAKI_EXTRA_ATTACK` |
| `ghostAbsorptionBp` | 削除（未使用、`bpModifier` が正） |
| `shiftUpSp1InstanceIds` | 削除（未使用、`spModifier` が正） |

API: `rules/turnModifierBridge.ts`

---

## Phase 5 追補 — カード JSON パイプライン ✅

| 項目 | 実装 |
|------|------|
| `loadCardDslEffectsFromCatalog()` | `dsl/loadFromCards.ts` |
| 起動 | `globalDispatcher` 初回 init |
| primitive 拡張 | `add_combo_number_delta`, `set_aura_power` |

---

## Phase 6 追補 — キーワード実装 ✅

| キーワード | 実装 |
|-----------|------|
| ウイング | `wingCanAttackEnemyRush` — 敵ラッシュ S へアタック |
| チェイス | `canInitiateChase` / `pendingChase` — ライド離場時 |
| コマンダー | `checkCommanderDefeat` — commander 離場時敗北判定 |

---

## テスト

**558/558 PASS**（+4 cardInterpreter.test.ts: Phase C）

---

## Phase C — DSL choose + L1 スターター ✅

| 項目 | 内容 |
|------|------|
| C1 choose | `cardInterpreter.ts` — `choose` → `pendingEffectChoice` + `dslResume` |
| C2 L1 rush OP | RS-011/020/023/025/068 を interpreter 経由（RS-028 等 keyword は legacy フォールバック） |
| C3 primitives | `move`, `modify_bp`, `modify_sp`, `draw`, `deal_damage`, `discard`, `grant_keyword`（aura） |
| 互換 |  upfront `targetInstanceId` 指定時は choose をスキップ（既存テスト維持） |

---

## A1–B1 移行 ✅

| 項目 | 内容 |
|------|------|
| A1 CostWindow | `PlayerState` レガシー boolean 6 種削除、`costWindows` のみ |
| A2 TurnModifiers | `TurnModifiers` 型・`turnModifiers` フィールド削除、`modifiers` + bridge のみ |
| B1 チェイス | `resolve_chase` / `pass_chase` アクション、`keywords/chase.ts`、3 テスト |

---

## 次の推奨ステップ

1. NC / enter_battle トリガーの DSL 完全接続（flatten 廃止、カード単位マッチング）
2. チェイス `UnitLeftZone` イベント発火（ビークル捨札時）
3. AI への `pass_chase` / `resolve_chase` 対応
4. `grant_keyword` 拡張（judgment, SP1 等）と RS-028 以降の interpreter 化

| 項目 | 実装 |
|------|------|
| RS-013 統合モジュール | `rules/wizards/shironLightWizard.ts` |
| ゾード / denji / mirage 等 | 既存 `Pending*` 維持（Event フック追加は Phase 2 完了後に段階実施） |

---

## Phase 5 — DSL 接続 ✅（基盤）

| 項目 | 実装 |
|------|------|
| DSL 型 | `dsl/types.ts` |
| インタープリタ | `dsl/interpreter.ts`（draw / damage / add_turn_rule） |
| Event registry 接続 | `dsl/registry.ts` → `globalDispatcher` |
| テスト | `dsl/interpreter.test.ts` |

**残作業:** カード JSON からの `registerDslEffect` 自動登録、primitive 拡張

---

## Phase 6 — 未実装キーワード ✅（型・スタブ）

| キーワード | 実装 |
|-----------|------|
| チェイス | `PendingChase` 型 + `canInitiateChase` スタブ |
| ウイング | `WingBattleRule` + `wingAllowsEmptyBattleStrike` スタブ |
| コマンダー | `CommanderZoneRule` + `hasActiveCommander` |

---

## 新規ファイル一覧

```
packages/engine/src/
├── core/costWindow.ts
├── core/scopedModifiers.ts（拡張）
├── dsl/{types,interpreter,registry}.ts
├── events/
│   ├── emit{StrikeDeclared,UnitLeftZone,DamageApplied,TurnEnding}.ts
│   └── listeners/{unitLeftZone,damageApplied,turnEnding,strikeDeclared}Listener.ts
├── keywords/index.ts
├── rules/{staticRestrictions,leaveEffects,turnEndingEffects}.ts
├── rules/wizards/shironLightWizard.ts
└── types/{costWindow,keywords,scopedModifiers}.ts
```

---

## 次の推奨ステップ（完了）

上記「Phase 1/3/5/6 追補」参照。残るのはレガシー型削除と DSL choose 接続のみ。
