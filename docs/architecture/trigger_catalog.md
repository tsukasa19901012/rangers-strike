# Trigger 一覧（出現頻度）

**生成:** `npm run extract-trigger-catalog -w @rangers-strike/cards`
**日付:** 2026-06-09

## サマリー

| 指標 | 値 |
|------|-----|
| Wiki カード総数 | 1849 |
| 効果文あり（Wiki） | 1836 |
| 検出 Trigger ヒット総数 | 2159 |
| Trigger 種類 | 18 |

## 用語対応

| 一覧名（camelCase） | DSL type | 説明 |
|--------------------|----------|------|
| `onCounter` | `operation` (`counter`) | カウンターオペレーション（被アタック時等に発動） |
| `onStrike` | `on_strike` | ストライクした／されたとき |
| `onDestroy` | `on_destroy` | 撃破されたとき |
| `onLeave` | `on_leave` | 場を離れる／捨札になるとき |
| `onDamage` | `on_damage` | ダメージを受けた／与えたとき |
| `onRush` | `on_rush` | ラッシュしたとき発動 |
| `onBattle` | `on_attack` | アタックした／アタックするとき（バトルフェイズ） |
| `onEnterBattle` | `enter_battle` | バトルエリアに出たとき |
| `onTurnEnd` | `on_turn_end` | ターン終了時 |
| `onJointComboL` | `joint_combo_l` | ジョイントコンボ L |
| `onJointComboR` | `joint_combo_r` | ジョイントコンボ R |
| `onRidingCombo` | `riding_combo` | ライディングコンボ |
| `onComboFrom` | `nc_or_combo_from` | 特定カードからコンビネーションするとき |
| `onConditional` | `conditional` | バトル投入時など任意コスト支払い型 |
| `onGameStart` | `game_start` | ゲーム開始時（コマンダー等） |
| `onOperationRush` | `operation` (`rush`) | ラッシュフェイズ即時オペレーション（インスタント） |
| `onOperationResident` | `operation` (`resident`) | 常駐オペレーション |
| `whileInField` | `while_in_field` | 常時効果・※注釈ルール |
| `onNc` | `nc` | ナンバーコンビネーション（NC）／【名前】効果 |

## 出現頻度（効果セグメント単位）

| Trigger | DSL | 説明 | 効果数 | カード数 | カード率 | ソース |
|---------|-----|------|--------|----------|----------|--------|
| `onNc` | `nc` | ナンバーコンビネーション（NC）／【名前】効果 | 918 | 856 | 46.3% | wiki+unit_effects |
| `onEnterBattle` | `enter_battle` | バトルエリアに出たとき | 269 | 248 | 13.4% | wiki+unit_effects |
| `whileInField` | `while_in_field` | 常時効果・※注釈ルール | 247 | 196 | 10.6% | wiki+unit_effects |
| `onRush` | `on_rush` | ラッシュしたとき発動 | 164 | 141 | 7.6% | wiki+unit_effects |
| `onDestroy` | `on_destroy` | 撃破されたとき | 148 | 142 | 7.7% | wiki+unit_effects |
| `onBattle` | `on_attack` | アタックした／アタックするとき（バトルフェイズ） | 108 | 95 | 5.1% | wiki+unit_effects |
| `onComboFrom` | `nc_or_combo_from` | 特定カードからコンビネーションするとき | 66 | 63 | 3.4% | wiki+unit_effects |
| `onCounter` | `operation:counter` | カウンターオペレーション（被アタック時等に発動） | 52 | 41 | 2.2% | wiki+operations |
| `onDamage` | `on_damage` | ダメージを受けた／与えたとき | 48 | 47 | 2.5% | wiki |
| `onOperationResident` | `operation:resident` | 常駐オペレーション | 35 | 35 | 1.9% | wiki+operations |
| `onLeave` | `on_leave` | 場を離れる／捨札になるとき | 24 | 24 | 1.3% | wiki |
| `onConditional` | `conditional` | バトル投入時など任意コスト支払い型 | 22 | 17 | 0.9% | wiki+unit_effects |
| `onOperationRush` | `operation:rush` | ラッシュフェイズ即時オペレーション（インスタント） | 19 | 19 | 1.0% | operations |
| `onStrike` | `on_strike` | ストライクした／されたとき | 16 | 15 | 0.8% | wiki |
| `onGameStart` | `game_start` | ゲーム開始時（コマンダー等） | 10 | 10 | 0.5% | wiki |
| `onTurnEnd` | `on_turn_end` | ターン終了時 | 5 | 5 | 0.3% | wiki+unit_effects |
| `onJointComboR` | `joint_combo_r` | ジョイントコンボ R | 5 | 5 | 0.3% | unit_effects |
| `onJointComboL` | `joint_combo_l` | ジョイントコンボ L | 3 | 3 | 0.2% | unit_effects |

## ユーザー指定 Trigger（抜粋）

| Trigger | 効果数 | カード数 |
|---------|--------|----------|
| `onRush` | 164 | 141 |
| `onBattle` | 108 | 95 |
| `onEnterBattle` | 269 | 248 |
| `onStrike` | 16 | 15 |
| `onLeave` | 24 | 24 |
| `onDamage` | 48 | 47 |
| `onDestroy` | 148 | 142 |
| `onCounter` | 52 | 41 |
| `onNc` | 918 | 856 |
| `whileInField` | 247 | 196 |
| `onOperationRush` | 19 | 19 |
| `onOperationResident` | 35 | 35 |

## 集計方法

1. **Wiki 全文スキャン** — `docs/wiki/cards/*.md` の効果文をセグメント分割し、正規表現で Trigger 推論
2. **unitEffects.json** — Legend 1–3 の `namedEffects[].trigger.type` を加算
3. **operations** — `effects.ts` のオペ `kind`（instant→rush, counter, permanent→resident）

同一カードが複数 Trigger に該当する場合あり。効果数はセグメント／named 効果の件数。
