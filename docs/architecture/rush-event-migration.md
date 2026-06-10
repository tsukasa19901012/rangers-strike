# UnitRushed イベント移行レポート

**日付:** 2026-06-09  
**スコープ:** `rushEffects.ts` → `UnitRushed` EventListener  
**回帰:** `npm test -w @rangers-strike/engine` — **538/538 PASS**

---

## 1. 変更概要

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| ラッシュ効果の入口 | `applyAction` → `finalizeRushAction` → `resolveRushTriggeredEffects` 直呼び | `applyAction` → `emitUnitRushedAndFinalize` → `UnitRushed` → `unitRushedListener` |
| 効果実装 | `rushEffects.ts` 内の逐次呼び出し | `events/listeners/unitRushedListener.ts` |
| 後方互換 API | — | `resolveRushTriggeredEffects`, `finalizeRushAction` 維持（内部で Event 経由） |

### 新規ファイル

| パス | 責務 |
|------|------|
| `events/listeners/unitRushedListener.ts` | `UnitRushed` Listener（旧 `resolveRushTriggeredEffects` 本体） |
| `events/registerListeners.ts` | エンジン標準 Listener 登録 |
| `events/globalDispatcher.ts` | `getEngineEventDispatcher()` 共有インスタンス |
| `events/emitUnitRushed.ts` | `applyAction` 用: enqueue + resolve + カウンター窓 |

### 解決順序（Listener 内・不変）

RS-026 Q6/Q10 準拠。疾風カウンター窓は `openRushCounterWindow`（Event 解決後）で従来通り。

1. `ON_RUSH_EFFECTS` レガシー（`draw_1` 等）
2. `resolveLegend3UnnamedRushEffects`（`rush_power_to_discard`）
3. `resolveNamedOnRushEffects`（on_rush 固有名効果）
4. `applySuperRadarOnRush`（RS-124 常駐）

---

## 2. 呼び出しフロー

```
applyAction (rush)
  → ゾーン移動・コスト支払い
  → emitUnitRushedAndFinalize()
       → buildUnitRushedEvent + EventQueue.enqueue
       → resolveUntilBlocked(getEngineEventDispatcher())
            → unitRushedListener
       → openRushCounterWindow()
```

**テスト・外部コード向け後方互換:**

```
resolveRushTriggeredEffects()  → 同上（カウンター窓なし）
finalizeRushAction()           → emitUnitRushedAndFinalize() へのエイリアス
```

---

## 3. 移行カード一覧

### 3.1 on_rush 固有名効果（18 effectId / 21 カード）

| カード ID | 効果名 | effectId | 世代 |
|-----------|--------|----------|------|
| RS-046 | アーマーアタック | `armor_attack` | L1 |
| RS-035 | ティラノソニック | `tyranno_sonic` | L1 |
| RS-036 | モスブリザード | `moss_blizzard` | L1 |
| RS-039 | プテラビーム | `ptera_beam` | L1 |
| RS-075 | 救助活動 | `rescue_activity` | L2 |
| RS-084 | 必勝合体 | `sure_win_combination` | L2（ゾード） |
| RS-085 | 消火作業 | `firefighting` | L2 |
| RS-088 | 解体作業 | `dismantling` | L2 |
| RS-092 | 天の災 | `heavenly_disaster` | L2 |
| RS-098 | カラクリ忍法・大津波 | `karakuri_great_tsunami` | L2 |
| RS-120 | 空輸搬送 | `air_transport` | L2 |
| RS-136 | 強襲 | `assault` | L3 |
| RS-137 | 潜航 | `submerge` | L3 |
| RS-144 | タウラスダイブ | `taurus_dive` | L3 |
| RS-169 | 地球資源吸収 | `earth_resource_absorb` | L3 |
| RS-175 | 森羅万象ビッグバンファイナル | `nature_big_bang_final` | L3（ゾード） |
| RS-176 | 大突撃 | `great_assault` | L3（ゾード） |
| RS-177 | 空輸 | `airlift` | L3 |

**ハンドラ実装:** `namedUnitEffects.ts` → `legend2/rushEffects.ts` / `legend3/rushEffects.ts`（Listener から委譲。次フェーズで effectId 別 Listener 分割可）

### 3.2 ※無名ルール（ラッシュ時）

| カード ID | rule | 処理 |
|-----------|------|------|
| RS-128 | `rush_power_to_discard` | パワー1枚捨札選択 |
| RS-129 | `rush_power_to_discard` | パワー2枚捨札選択（1枚のみなら1枚） |

**ハンドラ:** `legend3/rushEffects.resolveLegend3UnnamedRushEffects`

### 3.3 常駐オペ（相手 S ラッシュ時に誘発）

| カード ID | カード名 | effectId | 条件 |
|-----------|----------|----------|------|
| RS-124 | 超電子レーダー | `super_electron_radar` | 場に常駐 + ラッシュが S ユニット |

**ハンドラ:** `legend3/rushEffects.applySuperRadarOnRush`

### 3.4 レガシー `ON_RUSH_EFFECTS` マップ

| 対象 | 効果 | 備考 |
|------|------|------|
| テストカード `TST-RUSH-FX` 等 | `draw_1` | `ON_RUSH_EFFECTS` 動的登録。本番カード未使用 |

### 3.5 移行対象外（参考）

| 種別 | 理由 |
|------|------|
| 疾風カウンター（RS-026 等） | `openRushCounterWindow` — ラッシュ**後**の反応窓（別タイミング） |
| `resolveNamedOnRushEffects` 直接呼び出し（integration test） | 単体 API として維持。本番フローは Event 経由 |

---

## 4. 集計

| 区分 | 枚数 |
|------|------|
| on_rush 固有名（実装済み） | 21 |
| rush_power_to_discard | 2 |
| 常駐誘発（RS-124） | 1 |
| ON_RUSH_EFFECTS レガシー | 0（本番） |
| **合計（ユニークカード）** | **24** |

---

## 5. 公開 API（維持）

```typescript
// rushEffects.ts — シグネチャ不変
resolveRushTriggeredEffects(state, rusherPlayerId, rushedInstanceId)
finalizeRushAction(state, rusherPlayerId, rushedInstanceId, phasePlayerId)
openRushCounterWindow(...)
ON_RUSH_EFFECTS
categoriesOverlap(...)

// 新規 — applyAction 経路
emitUnitRushedAndFinalize(state, rusherPlayerId, rushedInstanceId, phasePlayerId)

// Event 基盤
getEngineEventDispatcher()
unitRushedListener
```

---

## 6. 次のステップ

1. `resolveNamedOnRushEffects` を effectId 別マイクロ Listener に分割
2. `UnitEnteredBattle` パイロット移行（`combo.ts` / `ncEffects.ts`）
3. DSL interpreter を `registerEngineEventListeners` に接続

---

## 7. 参照

- `docs/architecture/event-migration-report.md` — Event 基盤
- `docs/architecture/card-flags-migration.md` — Phase 2 全体計画
- `packages/engine/src/events/listeners/unitRushedListener.ts` — Listener 実装
