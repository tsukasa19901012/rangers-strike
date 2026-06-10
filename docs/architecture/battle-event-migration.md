# UnitEnteredBattle / BattleDeclared イベント移行レポート

**日付:** 2026-06-09  
**スコープ:** `combo.ts` 進入効果 + `operationCounters.ts` バトル解決  
**回帰:** `npm test -w @rangers-strike/engine` — **539/539 PASS**

---

## 1. 変更概要

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| バトル進入効果 | `applyAction` → `resolveEnterBattleEffects` 直呼び | `emitUnitEnteredBattleEffects` → `UnitEnteredBattle` → Listener |
| バトル解決 | `applyAction` → `resolveBattlePending` 直呼び | `emitBattleDeclaredAndResolve` → `BattleDeclared` → Listener |
| 実装本体 | `combo.resolveEnterBattleEffectsImpl` | 同上（Listener から委譲） |
| バトル本体 | `operationCounters.resolveBattlePendingCore` | 同上 |
| 後方互換 API | — | `resolveEnterBattleEffects`, `resolveBattlePending` 維持 |

### 新規・更新ファイル

| パス | 責務 |
|------|------|
| `events/listeners/unitEnteredBattleListener.ts` | `UnitEnteredBattle` Listener + impl 登録 |
| `events/listeners/battleDeclaredListener.ts` | `BattleDeclared` Listener + resolver 登録 |
| `events/emitUnitEnteredBattle.ts` | 進入効果の enqueue + resolve |
| `events/emitBattleDeclared.ts` | バトル解決の dispatch（同期） |
| `events/registerListeners.ts` | 2 種 Listener 登録追加 |

---

## 2. 呼び出しフロー

### UnitEnteredBattle（進入）

```
applyAction (move_to_battle)
  → ゾーン移動
  → emitUnitEnteredBattleEffects()
       → buildUnitEnteredBattleEvent + EventQueue
       → resolveUntilBlocked()
            → unitEnteredBattleListener
                 → resolveEnterBattleEffectsImpl (combo.ts)
                      → legend2/3 battleEffects (enter)
                      → legend3/enterBattleEffects (base_attack)
                      → NC / joint / conditional 等
```

### BattleDeclared（アタック解決）

```
applyAction (battle / pass_battle_reaction / counter後)
  → emitBattleDeclaredAndResolve()
       → buildBattleDeclaredEvent
       → dispatcher.dispatch()  ※ pendingBattle 共存のため直接 dispatch
            → battleDeclaredListener
                 → resolveBattlePendingCore (operationCounters.ts)
                      → battleAttackerBpBonus / battleDefenderBp
                           → legend2/3 battleEffects (on_attack BP)
                      → 撃破・離場・legend3OnBattleWin
```

**設計メモ:** `BattleDeclared` は解決時に `pendingBattle` / `pendingBattleEntry` が既に開いているため、`resolveUntilBlocked` ではなく **直接 `dispatch`** する（旧 `resolveBattlePending` と等価）。

---

## 3. 移行カード一覧

### 3.1 enter_battle 固有名（`legend2/3/battleEffects`）

| カード ID | effectId | モジュール |
|-----------|----------|-----------|
| RS-050 | `destroy_enemy_bp4000` | combo / namedUnitEffects |
| RS-070, RS-111 | `sky_magic_slash` | legend2/battleEffects |
| RS-095 | `mane_hurricane` | legend2/battleEffects |
| RS-121 | `ruin_excavation` | legend2/battleEffects |
| RS-079 | `anti_bio_cannon` | legend3/battleEffects |
| RS-117 | `fire_dance` | legend3/battleEffects |
| RS-118 | `crown_final_crush` | legend3/battleEffects |
| RS-119 | `hyper_civilization_guard` | legend3/battleEffects |
| RS-120 | `steel_horn` | legend3/battleEffects |
| RS-122 | `bio_particle_slash` | legend3/battleEffects |

### 3.2 enter_battle 条件付き（進入時選択）

`tryStartConditionalChoice` 経由 — `ghost_absorption`, `shift_up`, `string_fist`, `red_boot` 等（`namedUnitEffects` + `legend2/3/battleEffects`）。

### 3.3 enterBattleEffects（`legend3/enterBattleEffects.ts`）

| カード ID | effectId | 条件 |
|-----------|----------|------|
| RS-128 | `base_attack` | RS-129 バイオジェット2号が既にバトルにいる |

### 3.4 on_attack（`legend2/3/battleEffects` — バトル解決時 BP）

| effectId | 代表カード | 効果 |
|----------|-----------|------|
| `dump_punch` | L2 | BP +2000 |
| `adventure_drive_sword` | L2 | BP +4000 |
| `val_cannon` | RS-074 等 | 印刷 BP / カウンター不可 |
| `ptera_dagger` | L2 | 印刷 BP |
| `super_live_crush` | L3 | BP +4000 |
| `surging_chopper` | L3 | 対 S +5000 |
| `moonlight_sonic` | L3 | ラッシュ S アタック可 |

`battleAttackerBpBonus` / `battleDefenderBp`（`namedUnitEffects.ts`）が上記を集約。`BattleDeclared` Listener 内の `resolveBattlePendingCore` から間接呼び出し。

### 3.5 NC / ジョイント / ライディング（進入 tail ステップ）

`resolveEnterBattleEffectsImpl` の `nc` / `tail` フェイズ — `numberComboEffects`, `jointComboEffects` 等（Listener 経由で不変）。

---

## 4. 公開 API

```typescript
// 進入（後方互換）
resolveEnterBattleEffects(state, playerId, card, position, options?)
resolveEnterBattleEffectsImpl(...)  // 実装本体

// 進入（applyAction 経路）
emitUnitEnteredBattleEffects(...)

// バトル解決（後方互換）
resolveBattlePending(state, pending)
resolveBattlePendingCore(state, pending)

// バトル解決（applyAction 経路）
emitBattleDeclaredAndResolve(state, pending)
```

---

## 5. 登録パターン（循環依存回避）

```typescript
// combo.ts（モジュールロード時）
registerEnterBattleEffectsImpl(resolveEnterBattleEffectsImpl);

// operationCounters.ts（モジュールロード時）
registerBattlePendingResolver(resolveBattlePendingCore);
```

`registerEngineEventListeners` は Listener 関数のみ登録。実装本体は各 rules モジュールが登録。

---

## 6. 次のステップ

1. `resolveNamedOnRushEffects` と同様、effectId 別マイクロ Listener へ分割
2. `BattleDeclared` をカウンター窓前にも発火（declare / resolve の 2 フェイズ化）
3. `StrikeDeclared` / `UnitLeftZone` パイロット移行

---

## 7. 参照

- `docs/architecture/rush-event-migration.md`
- `docs/architecture/event-migration-report.md`
- `packages/engine/src/events/listeners/unitEnteredBattleListener.ts`
- `packages/engine/src/events/listeners/battleDeclaredListener.ts`
