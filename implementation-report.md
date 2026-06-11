# カード実装進捗レポート

生成日時: 2026-06-10T15:21:00.000Z  
サイクル: 1  
担当: Manager Agent

## サマリー

| 指標 | 件数 | 割合 |
|------|------|------|
| 総カード数 | 1849 | 100% |
| 実装済み | 1839 | 99.5% |
| 部分実装 | 10 | 0.5% |
| 未実装 | 0 | 0.0% |
| 実装率（完全） | 1839/1849 | 99.5% |
| 目標実装率 | 1849/1849 | 100% |

## Effect 分類

| 区分 | 件数 | 備考 |
|------|------|------|
| ユニーク effect ID | 1564 | — |
| 実装済み effect | 1554 | — |
| 部分実装 effect | 10 | すべて `catchall_interpret` fallback |
| 未実装 effect | 0 | — |
| 新規 Effect（本サイクル追加） | 0 | Worker 未着手 |
| 共通 Effect（再利用候補） | 3 | 下記参照 |

### 共通 Effect 再利用候補

| 既存キーワード / パターン | 参照 | 対象カード候補 |
|---------------------------|------|----------------|
| `attack_rush_zone` | `effectBuilders.ts` → `yellow_thunder` | RS-622 |
| `grant_sp1` / `grant_sp2` + 条件 | `effectBuilders.ts` | RK-282 |
| `require_command_hold_entry` | 既存 unnamed rule | XG4-058（前半は実装済） |

### 新規共通 Effect 追加候補（複数枚対応）

| 提案 ID | 対象カード | 効果概要 |
|---------|-----------|----------|
| `reorder_enemy_battle` | RS-397 | ラッシュ時、敵バトル並び替え |
| `end_turn_battle_to_rush` | XG5-032 | ターン終了時、バトル→ラッシュ任意移動 |
| `enemy_power_cost_minus` | XG5-003 | ターン中、敵必要パワー -1 |
| `sp_per_discard_to_hand_on_strike` | RS-382 | ストライク時、ターン内捨札→手札 S 枚数分 SP+1 |
| `release_self` | XG1-041 | NC：自身をリリース |
| `invalidate_next_opponent_turn_effects` | RS-427 | 直前ターン敵の「次の相手ターン」効果無効 |
| `last_battle_protect_other_s` | XG4-058 | 最後尾配置中、他自軍 S はアタック不可 |
| `declare_name_grant_abilities` | XG4-031 | カード名宣言＋一時テキスト付与（専用度高） |

## 優先度: 要対応カード（P1 — 部分実装）

| ID | 名前 | カテゴリ | 実装方針 | Worker |
|----|------|----------|----------|--------|
| RS-622 | グリフォーザー | Unit | 既存 `attack_rush_zone` 再利用 | A |
| RK-282 | 仮面ライダーシザース | Unit | 条件（ラッシュにボルキャンサー）+ SP1/2 | A |
| RS-397 | タイムジェット1 | Megazord | 新規 `reorder_enemy_battle`（on_rush） | B |
| XG5-032 | ゲキペンギン | Megazord | 新規 `end_turn_battle_to_rush` | B |
| RS-382 | ビクトリーロボ | Megazord | 新規 `sp_per_discard_to_hand_on_strike` | C |
| XG5-003 | ゴーグルブルー | Unit | 新規 `enemy_power_cost_minus`（Modifier） | C |
| XG4-058 | オートバジンBM | Unit | 新規 `last_battle_protect_other_s`（Aura） | C |
| XG1-041 | 仮面ライダーアマゾン | Unit | 新規 `release_self` | D |
| RS-427 | スーパーゲキイエロー | Megazord | 新規 `invalidate_next_opponent_turn_effects` | D |
| XG4-031 | ロケットブースター | Operation | 専用実装（宣言＋一時能力付与） | D |

## テスト状況

| スイート | 結果 | 詳細 |
|----------|------|------|
| `@rangers-strike/engine` | **673/673 PASS** | カード・エンジン統合含む |
| `@rangers-strike/cards` | **438/439 PASS** | `cardImages.test.ts` 1 件失敗（画像 URL、実装無関係） |
| 部分実装カード専用テスト | **未整備** | catchall fallback のため smoke のみ |

### 部分実装カードに必要なテスト（Worker 必須）

各カードについて以下 4 観点を `packages/engine/src/` または `packages/cards/pipeline/examples/` に追加:

1. **正常系** — 効果が意図どおり発動
2. **異常系** — 条件不成立時は不発 / エラーなし
3. **誘発効果** — トリガー連鎖・カウンター窓との整合
4. **同時解決** — 複数効果・スタック順序

## Worker 割当（サイクル 1）

### Worker-A（優先度 1 — 既存 Effect 再利用）

担当: **RK-282, RS-622**

### Worker-B（優先度 2 — ラッシュ / ターン終了系共通 Effect）

担当: **RS-397, XG5-032**

### Worker-C（優先度 2 — Modifier / ストライク系共通 Effect）

担当: **RS-382, XG5-003, XG4-058**

### Worker-D（優先度 3 — 専用裁定）

担当: **XG1-041, RS-427, XG4-031**

## 完了条件チェックリスト

| 条件 | 状態 |
|------|------|
| 全カード実装率 100% | ❌ 10 枚 partial 残 |
| 全テスト成功 | ⚠️ engine OK / cards 1 件失敗（画像） |
| 1000 試合連続自己対戦成功 | ❌ 100 試合のみ実施済 |

## 次サイクルアクション

1. Worker A–D にタスク配布（下記フォーマット）
2. Worker 成果物レビュー（Event / Modifier / DSL / 裁定準拠）
3. `npm test -w @rangers-strike/engine` + 部分実装カードテスト確認
4. 100 試合自己対戦 → 部分実装 0 確認後 1000 試合へ拡張
5. 本レポート・`coverage-report.md`・`simulation-report.md` 更新
