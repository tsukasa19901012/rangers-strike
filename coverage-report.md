# カード実装カバレッジレポート

生成日時: 2026-06-11T12:54:26.282Z

## サマリー

| 指標 | 件数 | 割合 |
|------|------|------|
| 総カード数 | 1849 | 100% |
| 実装済み | 1839 | 99.5% |
| 部分実装 | 10 | 0.5% |
| 未実装 | 0 | 0.0% |

### レジストリ参考値

- DSL interpreter: 1849
- legacy handler: 0
- unimplemented handler: 0
- core: 179 / promoted: 1670

## カテゴリ別

| カテゴリ | 総数 | 実装済み | 部分実装 | 未実装 | 実装率 |
|----------|------|----------|----------|--------|--------|
| Unit | 1006 | 1001 | 5 | 0 | 99.5% |
| Operation | 215 | 214 | 1 | 0 | 99.5% |
| Counter | 27 | 27 | 0 | 0 | 100.0% |
| Commander | 17 | 17 | 0 | 0 | 100.0% |
| Vehicle | 83 | 83 | 0 | 0 | 100.0% |
| Megazord | 501 | 497 | 4 | 0 | 99.2% |

## Effect 別

| 指標 | 件数 |
|------|------|
| ユニーク effect ID | 1564 |
| 実装済み effect | 1554 |
| 部分実装 effect | 10 |
| 未実装 effect | 0 |

### 優先度: 未実装 effect（カード数降順）

_なし_

### 優先度: 部分実装 effect（カード数降順、上位 30）

| effect ID | カード数 | サンプル | 理由 |
|-----------|----------|----------|------|
| `named_e382b8e382a7e38383e38388` | 3 | RK-289, RS-618, XG5-032 | catchall_interpret |
| `named_e382b0e383aae38395e382a9` | 2 | RS-536, RS-622 | catchall_interpret |
| `named_e382b7e382b6e383bce382b9` | 1 | RK-282 | catchall_interpret |
| `named_e4babae381aee591bde381af` | 1 | RS-382 | catchall_interpret |
| `named_e4ba88e69c9fe3819be381ac` | 1 | RS-397 | catchall_interpret |
| `named_e382aae3838de382b9e38388` | 1 | RS-427 | catchall_interpret |
| `named_e382ace382ace381aee88595` | 1 | XG1-041 | catchall_interpret |
| `named_e383ade382b1e38383e38388` | 1 | XG4-031 | catchall_interpret |
| `named_e5bfa0e5ae9fe381aae6849b` | 1 | XG4-058 | catchall_interpret |
| `named_e38396e383abe383bce382b8` | 1 | XG5-003 | catchall_interpret |

### 実装済み effect（カード数降順、上位 20）

| effect ID | カード数 | サンプル |
|-----------|----------|----------|
| `unnamed_register` | 151 | PK-009, PK-014, RK-097, RK-099, RK-102 |
| `note_e280bbe38193e3828ce381af` | 87 | RK-067, RK-117, RK-127, RK-158, RK-161 |
| `unnamed_wing` | 74 | RS-611, RS-619, RS-621, RS-622, RS-623 |
| `unnamed_morph` | 68 | RK-261, RK-262, RK-263, RK-271, RK-272 |
| `unnamed_resident` | 65 | PK-010, PK-011, PR-003, PR-021, RK-001 |
| `require_command_hold_entry` | 61 | RK-034, RK-035, RK-037, RK-039, RK-040 |
| `recruit_from_discard_on_destroy` | 53 | PK-012, RK-187, RK-203, RK-206, RK-207 |
| `note_e280bbe38193e3828ce3818c` | 49 | RK-128, RK-180, RK-194, RK-197, RK-217 |
| `unnamed_deck_unlimited` | 34 | PK-002, RK-043, RK-044, RK-059, RK-090 |
| `unnamed_destroy_on_win_vs_sp1` | 30 | PK-006, RK-231, RK-269, RK-291, RK-329 |
| `unnamed_cross1` | 25 | SX-009, SX-010, XG7-007, XG7-008, XG7-010 |
| `named_e383a9e382a4e38380e383bc` | 23 | RK-027, RK-054, RK-055, RK-057, RK-065 |
| `unnamed_scrum` | 23 | RK-212, RK-213, RK-228, RK-229, RK-230 |
| `unnamed_auto_battle_entry_each_turn` | 21 | PR-022, RS-041, RS-054, RS-055, RS-077 |
| `note_e280bbe382abe382a6e383b3` | 19 | PR-012, RK-008, RK-009, RK-012, RK-015 |
| `unnamed_tag` | 18 | PK-010, PK-011, RK-170, RK-239, RK-242 |
| `unnamed_battle_entry_hold` | 18 | RS-035, RS-036, RS-037, RS-038, RS-039 |
| `note_e280bbe38193e3828ce38292` | 17 | RK-185, RK-319, RS-188, RS-576, XG1-026 |
| `grant_sp1` | 16 | PR-010, RM-008, RS-041, RS-048, RS-054 |
| `unnamed_cannot_attack` | 15 | PR-022, RK-116, RK-147, RK-206, RM-046 |

_他 1534 件（省略）_

## 優先度: 要対応カード

| 優先 | ID | 名前 | カテゴリ | 状態 | 理由 |
|------|-----|------|----------|------|------|
| P1 | RK-282 | 仮面ライダーシザース | Unit | partial | catchall_interpret fallback |
| P1 | RS-382 | ビクトリーロボ | Megazord | partial | catchall_interpret fallback |
| P1 | RS-397 | タイムジェット1 | Megazord | partial | catchall_interpret fallback |
| P1 | RS-427 | スーパーゲキイエロー | Megazord | partial | catchall_interpret fallback |
| P1 | RS-622 | グリフォーザー | Unit | partial | catchall_interpret fallback |
| P1 | XG1-041 | 仮面ライダーアマゾン（XG） | Unit | partial | catchall_interpret fallback |
| P1 | XG4-031 | ロケットブースター | Operation | partial | catchall_interpret fallback |
| P1 | XG4-058 | オートバジンBM（XG4） | Unit | partial | catchall_interpret fallback |
| P1 | XG5-003 | ゴーグルブルー | Unit | partial | catchall_interpret fallback |
| P1 | XG5-032 | ゲキペンギン | Megazord | partial | catchall_interpret fallback |

