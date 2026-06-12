# RK UI ロジック単体テスト — バッチ 02（RK-011〜RK-020）

出典: [docs/wiki/cards/RK-011.md](../cards/RK-011.md) 〜 [RK-020.md](../cards/RK-020.md)

実装: `apps/web/lib/rkUiLogic.batch02.test.ts`（仕様: `apps/web/lib/rkUiTestSpecs/batch02.ts`）

共通観点は [rk-batch-01.md](./rk-batch-01.md) と同じ。

## カード別仕様

| ID | 名前 | 種別 | power | cat | UI mechanisms | DSL keyword |
|----|------|------|-------|-----|---------------|-------------|
| RK-011 | 第三の眼 | permanent | 2 | ET | permanent_place, passive | resident |
| RK-012 | 宏のオルゴール時計 | counter | 4 | ET | counter_reaction | counter_skip_battle_phase |
| RK-013 | Jパワー | instant | 4 | MA | drag_direct, choice_modal | stack_s_on_self_rush |
| RK-014 | 共同戦線 | permanent | 2 | MA | permanent_place, passive | resident |
| RK-015 | 人類の進化 | counter | 3 | MA | counter_reaction | counter_recruit_on_destroy |
| RK-016 | ミラーワールド | permanent | 0 | WB | permanent_place, passive | resident |
| RK-017 | ミッションメモリー | instant | 2 | ET | drag_direct, choice_modal | rc_hold_skip_rideoff |
| RK-018 | ラウズカード | instant | 2 | WB | drag_direct, choice_modal | dual_bp_rush_discard_combine |
| RK-019 | 音撃 | instant | 4 | MA | drag_direct, choice_modal | impose_destroy_rule_on_enemy |
| RK-020 | ダブルライダーキック | instant | 6 | ET | drag_direct, choice_modal | (choose select_unit) |
