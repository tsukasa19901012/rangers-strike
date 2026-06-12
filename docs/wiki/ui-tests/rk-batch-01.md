# RK UI ロジック単体テスト — バッチ 01（RK-001〜RK-010）

出典: [docs/wiki/cards/RK-001.md](../cards/RK-001.md) 〜 [RK-010.md](../cards/RK-010.md) の atwiki 効果文・ステータス

実装: `apps/web/lib/rkUiLogic.batch01.test.ts`（仕様データ: `apps/web/lib/rkUiTestSpecs/batch01.ts`）

## テスト観点（共通）

| # | 観点 | 内容 |
|---|------|------|
| 1 | カタログ整合 | `full-playable` の name / type / powerCost / category / text が wiki と一致 |
| 2 | 画像 | `resolveCardImageUrl` がローカルまたは grnrngr URL を返す |
| 3 | DSL | `isCardDslReady` が true |
| 4 | UI カバレッジ | `estimateCardUiCoverage` → `promoted-ui`（`DSL未実装` なし） |
| 5 | 効果メタ | `getCardEffect().kind` が wiki の常駐 / カウンター / 即時と一致 |
| 6 | UI 経路 | `resolvePromotedOperationUiMechanisms` が期待 mechanism を含む |
| 7 | ドロップ | instant オペは `resolveOperationDropRoute` を検証 |
| 8 | デッキ警告 | DSL ready カードは `estimateDeckWarnings` で UI 未確認にならない |

## カード別仕様

### RK-001 改造人間

- **wiki**: [RK-001.md](../cards/RK-001.md) — ※常駐、特徴「男」「女」に「改造人間」追加
- **種別**: permanent（power 0 / ET）
- **UI**: `operation_permanent_place`, `passive_engine_only`
- **DSL**: `resident`

### RK-002 V3ホッパー

- **wiki**: [RK-002.md](../cards/RK-002.md) — 山札上3枚見て上下に戻す
- **種別**: instant rush（power 0 / ET）
- **UI**: `operation_drag_direct`, `effect_choice_modal`
- **ドロップ**: `direct_play`
- **DSL**: `deck_scry_three_reorder`

### RK-003 カイゾーグ

- **wiki**: [RK-003.md](../cards/RK-003.md) — ※常駐、Sユニット撃破時コマンドホールドで山札下へ
- **種別**: permanent（power 2 / ET）
- **UI**: `operation_permanent_place`, `passive_engine_only`
- **DSL**: `resident`

### RK-004 ギギの腕輪

- **wiki**: [RK-004.md](../cards/RK-004.md) — ※カウンター、BP+2000
- **種別**: counter（power 3 / WB）
- **UI**: `operation_counter_reaction`
- **DSL**: `counter_defender_bp_2000`

### RK-005 超電子ダイナモ

- **wiki**: [RK-005.md](../cards/RK-005.md) — 改造人間Sユニット選択、撃破時1ダメージ能力付与
- **種別**: instant rush（power 0 / ET）
- **UI**: `operation_drag_direct`（現状）
- **ドロップ**: `direct_play`
- **既知ギャップ**: DSL primitive が `deal_damage` になっており、wiki 通りのユニット選択＋能力付与は未実装

### RK-006 セイリングジャンプ

- **wiki**: [RK-006.md](../cards/RK-006.md) — ※常駐、非ライドSはライド中ユニットにアタックされない
- **種別**: permanent（power 3 / ET）
- **UI**: `operation_permanent_place`, `passive_engine_only`
- **DSL**: `resident`

### RK-007 メンテナンス

- **wiki**: [RK-007.md](../cards/RK-007.md) — コマンドSを手札へ、捨札から改造人間Sをホールド配置
- **種別**: instant rush（power 2 / ET）
- **UI**: `operation_drag_direct`, `effect_choice_modal`
- **ドロップ**: `direct_play`
- **DSL**: `command_return_then_recruit_discard`

### RK-008 メカニック忍者

- **wiki**: [RK-008.md](../cards/RK-008.md) — ※カウンター、改造人間Sをラッシュ、被アタックをホールド、バトル不成立
- **種別**: counter（power 4 / ET）
- **UI**: `operation_counter_reaction`
- **DSL**: `counter_hold_kamen_s`

### RK-009 二人の世紀王

- **wiki**: [RK-009.md](../cards/RK-009.md) — ※カウンター、バトル外Sを手札へ、BP+1000
- **種別**: counter（power 5 / MA）
- **UI**: `operation_counter_reaction`
- **DSL**: `counter_return_all_s_on_attack`

### RK-010 ハイブリッドエネルギー

- **wiki**: [RK-010.md](../cards/RK-010.md) — ※常駐、ターン終了時山札オモテ、同カテゴリS BP+1000
- **種別**: permanent（power 4 / MA）
- **UI**: `operation_permanent_place`, `passive_engine_only`
- **DSL**: `resident`
