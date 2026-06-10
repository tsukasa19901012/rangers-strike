# 第1弾スターター DSL 実装 — 不足 Effect / Trigger 洗い出し

**日付:** 2026-06-09  
**対象デッキ:** Type A `abarenoh` / Type B `dekaranger` / Type C `magiking`（計36ユニークカード）  
**DSL 配置:** `packages/cards/src/dsl/legend1/starter/`  
**方針:** `fallback_handler`（TypeScript 委譲）禁止。primitives + `grant_keyword` のみ。

---

## 実装サマリー

| 項目 | 値 |
|------|-----|
| スターター固有カード | 36 |
| DSL オーバーレイ | 36（100%） |
| `fallback_handler` 使用 | **0** |
| `implementation.handler` | 全件 `interpreter` |
| 再生成 | `npm run generate-legend1-starter-dsl -w @rangers-strike/cards` |

`loadAllCardDocuments()` は L1 スターター36枚について DSL オーバーレイでレガシー `unitEffects` / `effects.ts` の TS ハンドラ定義を上書きする。

---

## 現行 DSL で primitives 表現済み（インタープリタ実装待ち）

| カード | effectId | primitives |
|--------|----------|------------|
| RS-020 | place_in_power | `move` → power |
| RS-023 | discard_s_unit_to_hand | `choose` + `move` discard→hand |
| RS-025 | bp_boost_4000 | `choose` + `modify_bp`（※下記ギャップ） |
| RS-046 | armor_attack | `choose` + `move` battle→power |
| RS-050 | destroy_enemy_bp4000 | `choose` + `discard` |
| RS-059 | future_sight | `draw` |
| RS-060 | pink_storm | `choose` + `move` → deck |
| RS-061 | green_ground | `choose` + `move` command→hand |
| RS-063 | radial_hammer | `choose` scry_keep_one |
| RS-068 | discard_to_hand | `choose` + `move` discard→hand |
| RS-054 | grant_sp1 | `grant_keyword` SP1 |
| RS-057/058 | red_fire / yellow_thunder | `grant_keyword` SP1 + 拡張 keyword |

---

## 不足 Trigger（スキーマに型はあるがエンジン未接続）

| Trigger | 必要カード例 | 用途 |
|---------|-------------|------|
| `on_attack` + `comboPartnerCardIds` | RS-032, RS-033, RS-053 | コンボ元に関係なく発動 |
| `nc_or_combo_from` | （L1スターター外 RS-031 等） | コンボ元指定 NC |
| `on_leave` | RS-027（カウンター） | 場を離れるとき |
| `on_strike` | RS-014, RS-067 | ストライク時 / されたとき |
| `on_turn_end` | RS-030 | ターン終了時（常駐 OP） |
| `conditional` | RS-051, RS-052, RS-042, RS-043 | 任意コスト支払い型 |
| `while_in_field` | RS-045, RS-047, RS-022 相当 | 常時修正 / ロック |

---

## 不足 Effect Primitive

### 1. 選択・対象

| 不足 | 例 | 現状回避 |
|------|-----|----------|
| **複数ゾーン Union 選択** | RS-025「自軍ユニット」 | rush / battle を2つの `choose` に分割（不正確） |
| **`minBp` フィルタ** | RS-047 BP5000以上 | `grant_keyword: block_m_battle_entry_bp5000_plus` |
| **カテゴリフィルタ** | RS-045「オーバーテクノロジー」M | keyword 委譲 |
| **名前指定カード選択** | RS-051 手札から「爆竜ティラノサウルス」 | keyword 委譲 |
| **`select_discard` kind** | 捨札からの選択 UX | `select_unit` + zone discard で代替 |
| **任意枚数パワー捨て** | RS-042（5枚）, RS-043（2枚） | `select_power` count=N（要インタープリタ） |

### 2. バトル・ダメージ

| 不足 | 例 |
|------|-----|
| **`use_printed_bp`** | RS-032, RS-053 |
| **`prevent_counter`** | RS-033 |
| **`attack_rush_zone`** | RS-058 |
| **`destroy` / 撃破** | RS-050 は `discard` で近似 |
| **`strike_intercept`** | RS-014 ファイブテクター |
| **`substitute_on_destroy`** | RS-052 超シールド進化 |
| **`deal_damage_on_destroy`** | RS-054 ※撃破時1ダメージ |

### 3. 常駐・グローバル修正

| 不足 | 例 |
|------|-----|
| **`auto_battle_entry_from_rush`** | RS-022 アースの力 |
| **`auto_battle_entry_each_turn`** | RS-054 |
| **`m_battle_entry_requires_hold`** | RS-069 |
| **`category_substitute_via_hold`** | RS-010 |
| **`bp_plus_per_released_command`** | RS-017, RS-057 |
| **`bp_plus_per_own_damage`** | RS-011 |
| **`release_command_on_event`** | RS-029 |

### 4. コスト・任意効果

| 不足 | 例 |
|------|-----|
| **`pay_power_discard_for_keyword`** | RS-042/043 SP付与 |
| **`pay_hand_discard_named_for_keyword`** | RS-051 |
| **`prevent_leave_with_draw_cost`** | RS-027 |
| **`reveal_top_match_destroy`** | RS-028 ジャッジメント |

### 5. 相手操作・強制

| 不足 | 例 |
|------|-----|
| **`force_enemy_s_rush_to_battle`** | RS-049 |
| **`hold_all_enemy_commands`** | RS-070 |
| **`opponent_must_hold_commands`** | （L1外 RS-036 等） |

### 6. ゾード / 合体（メタデータは `unnamedRules` で保持）

| ルール | カード | DSL 状態 |
|--------|--------|----------|
| `zord` fusion 定義 | RS-050, RS-042, RS-070 | `unnamedRules` + `rushAdditionalCondition` |
| `battle_entry_hold` | RS-051〜053 | `grant_keyword` + `unnamedRules` |
| `fusion_material_alias` | RS-057〜061 | `unnamedRules` + keyword |
| `send_s_unit_to_power` | RS-043〜047, RS-044 | `rushAdditionalCondition` |

**不足:** 合体素材の自動検証・RS-006 ログ相当はエンジン側ゾードルール層が必要（DSL primitives 外）。

---

## カード別ギャップ一覧（36枚）

| ID | 名称 | DSL 状態 | 主な不足 |
|----|------|----------|----------|
| RS-010 | プリズムパワー | keyword | category_substitute_via_hold |
| RS-011 | オーラパワー | keyword | bp_plus_per_own_damage |
| RS-014 | ファイブテクター | keyword | strike_intercept_with_s_unit |
| RS-017 | 気力 | keyword | s_bp_plus on opponent turn |
| RS-020 | クルマジックパワー | **primitives OK** | — |
| RS-022 | アースの力 | keyword | auto_battle_entry + upkeep cost |
| RS-023 | スーパーレスキュー | **primitives OK** | — |
| RS-025 | ガオ・ソウル | 部分 | Union ゾーン選択 |
| RS-027 | ダイノガッツ | 部分 | on_leave + draw cost |
| RS-028 | ジャッジメント | keyword | reveal_top_match_destroy |
| RS-029 | 勇気の魔法 | keyword | release on S battle entry |
| RS-030 | 冒険の記憶 | 部分 | on_turn_end + select_command |
| RS-032 | バルシャーク | keyword | use_printed_bp + combo trigger |
| RS-033 | バルパンサー | keyword | prevent_counter + combo trigger |
| RS-042 | デカレンジャーロボ | 部分 | pay 5 power for SP3 |
| RS-043 | パトストライカー | 部分 | pay 2 power for SP1 |
| RS-044 | パトアーマー | メタのみ | rush 追加条件のみ |
| RS-045 | パトシグナー | keyword | category aura on attacked |
| RS-046 | パトアーマー(L) | **primitives OK** | — |
| RS-047 | パトレーラー | keyword | block M BP≥5000 entry |
| RS-049 | パトジャイラー | keyword | force enemy S rush→battle |
| RS-050 | アバレンオー | **primitives OK** | zord fusion ルール層 |
| RS-051 | 爆竜ティラノ | keyword | named discard → SP1 |
| RS-052 | 爆竜トリケラ | keyword | substitute on WB destroy |
| RS-053 | 爆竜プテラ | keyword | use_printed_bp |
| RS-054 | ティラノロッド | 部分 | SP1 OK / auto entry / destroy dmg |
| RS-057 | マジフェニックス | keyword | BP+ per released command |
| RS-058 | マジガルーダ | keyword | attack_rush_zone |
| RS-059 | マジマーメイド | **primitives OK** | — |
| RS-060 | マジフェアリー | **primitives OK** | — |
| RS-061 | マジタウロス | **primitives OK** | — |
| RS-063 | ラジアルハンマー | **primitives OK** | — |
| RS-067 | プラズマエネルギー | keyword | on_strike destroy + self discard |
| RS-068 | 捨てて手札へ | **primitives OK** | — |
| RS-069 | 雷の重力 | keyword | M entry requires hold |
| RS-070 | マジキング | keyword | hold all enemy commands |

**primitives OK:** 10枚 — インタープリタ実装のみで動作可能（ゾード除く）  
**keyword / 部分:** 26枚 — 上記不足 primitive または trigger 接続が必要

---

## 推奨 DSL 拡張優先度（スターター完走向け）

### P0（スターター頻出）

1. `grant_keyword` インタープリタ — SP1, use_printed_bp, prevent_counter, attack_rush_zone
2. `on_attack` + comboPartner 無視ルール
3. `while_in_field` オーラ（BP 修正・入場制限）
4. ゾード `rushAdditionalCondition` + `unnamedRules.zord` エンジン接続

### P1（デッキ別特徴）

5. `conditional` + `select_power` コスト支払い → keyword 付与
6. `on_strike` / strike intercept（RS-014, RS-067）
7. `on_turn_end` 常駐 OP（RS-030）
8. `on_leave` カウンター（RS-027）

### P2

9. Union ターゲット / `minBp` フィルタ
10. 相手強制操作（RS-049, RS-070）

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `packages/cards/src/dsl/legend1/starter/overlays.json` | 36枚バンドル |
| `packages/cards/src/dsl/legend1/starter/*.dsl.json` | カード別 DSL |
| `packages/cards/scripts/generate-legend1-starter-dsl.mjs` | 再生成 |
| `packages/cards/src/dsl/legend1/starter/legend1StarterDsl.test.ts` | 検証テスト |
| `packages/cards/schema/effect.schema.json` | primitive 定義 |
