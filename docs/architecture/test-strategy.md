# テスト戦略 — Rule Engine / Event / Card / Battle / Counter / Damage / Win-Lose

**目的:** 全カード実装（1,849 枚）でも破綻しない検証体系を定義する  
**対象:** `packages/engine`, `packages/cards`, `apps/web`（UI 配線のみ）  
**日付:** 2026-06-09  
**実行:** Vitest（`packages/engine`, `packages/cards`）

---

## 0. 設計原則

| 原則 | 内容 |
|------|------|
| **Engine-first** | ルールの正しさは engine で担保。web は UI ルーティングのみ薄くテスト |
| **Action → State** | テストの基本単位は `GameAction` 列と期待 `GameState`（または差分） |
| **Event は観測点** | Event System 導入後は「事実のログ」として assert。Action との二重管理を避ける |
| **カードはデータ駆動** | A/B カードは generated + golden。C カードのみ cardId 直書き integration |
| **決定論** | すべてのテストに固定 `rng` seed。flaky を禁止 |
| **不変条件 > 例** | property test で「常に成り立つこと」を先に固定し、golden で例外を捕える |

### テストピラミッド（目標比率）

```
                    ┌─────────────┐
                    │ Golden ~5%  │  公式裁定・FAQ・回帰固定
                    ├─────────────┤
                    │ Integration │  15%  フロー・反応窓・カード代表
                    │   ~15%      │
                    ├─────────────┤
                    │  Unit ~50%  │  純関数・primitive・ルールモジュール
                    ├─────────────┤
                    │ Property    │  10%  不変条件・monkey 拡張
                    │ Replay ~5%  │  実戦ログ・バグ再現
                    └─────────────┘
```

---

## 1. Unit Test（単体テスト）

**役割:** 最小単位の純関数・ルールモジュールを、GameState 最小構成で検証する。  
**速度目標:** 全体 < 30 秒（CI）。1 ファイル < 200ms。

### 1.1 配置

```
packages/engine/src/
  rules/
    *.test.ts              # フェイズ・BP・コスト等
    effectStack.test.ts    # 既存
  effects/
    primitives/
      draw.test.ts
      modifyBp.test.ts
    interpreter.test.ts    # DSL 接続後
  events/
    dispatcher.test.ts     # Event 導入後
    subscriptions.test.ts
  core/
    legalActions.test.ts
    catalog.test.ts
packages/cards/src/
  dsl/validator.test.ts  # 既存
  deckRules.test.ts
```

### 1.2 ドメイン別 — 何を・どうテストするか

#### Rule Engine

| 対象 | テスト内容 | 既存 | 追加 |
|------|-----------|------|------|
| `startPhase` / `advancePhase` | フェイズ遷移表、先攻 1T スタート省略 | `startPhase.test.ts` | 全フェイズ遷移表 |
| `parsePowerCost` / `countAvailablePower` | コスト・敵マルチ→パワー | `rules.test.ts` | I-01 敵マルチ |
| `getLegalActions` | フェイズ別合法手の存在/非存在 | 分散 | phase × pending マトリクス |
| `restrictions` | cardId ではなく rule id で | `restrictions.test.ts` | UnnamedUnitRule 化後 |
| `turnModifiers` | ターン終了クリア | 部分 | 全フィールドクリア表 |

```typescript
// 例: フェイズ遷移（純関数）
it("rush → battle when battle entry required", () => {
  const next = advancePhase(stateInRushWithMandatoryEntry);
  expect(next.phase).toBe("battle");
});
```

#### Event System（導入後）

| 対象 | テスト内容 |
|------|-----------|
| `EventDispatcher.emit` | 1 Action が N イベントを正しい順序で発行 |
| `subscribe(trigger, handler)` | 購読解除・once・優先度 |
| `event → primitive` | `rush_completed` のみが on_rush を起動 |
| 冪等性 | 同一イベント二重発行で効果が二重適用されない |

```typescript
it("emits rush_completed before effect_triggered", () => {
  const log = captureEvents(() => finalizeRush(state, action));
  expect(log).toEqual(["rush_completed", "effect_triggered", "reaction_window_opened"]);
});
```

**現状:** Event 未実装 → `effectStack.test.ts` で Pending 導出を代替。Event 導入時に **同じシナリオを event log assert に置換**。

#### Card Effects

| 対象 | テスト内容 | 既存 |
|------|-----------|------|
| DSL `validator` | schema 違反検出 | `validator.test.ts` |
| `interpretPrimitive` | 各 primitive 1 種 1 ファイル | 未 |
| `UnnamedUnitRule` | rule id → 制限フラグ | `restrictions.test.ts` |
| `namedUnitEffects` ルータ | trigger → handler 解決 | `namedUnitEffects.test.ts` |

```typescript
// primitive 単体（GameState 最小）
it("modify_bp adds amount for turn duration", () => {
  const next = interpretModifyBp(state, {
    target: { type: "self" },
    amount: 2000,
    duration: "turn",
  });
  expect(getEffectiveBp(next, instanceId)).toBe(5000);
});
```

#### Battle Resolution

| 対象 | テスト内容 | 既存 |
|------|-----------|------|
| BP 比較 | 攻撃/防御/修飾子/印刷値 | `battle.test.ts` |
| `use_printed_defender_bp` | シャークジョーズ等 | `namedUnitEffects.test.ts` |
| 勝敗判定（バトル内） | 破壊 vs 残存 | `battle.test.ts` |
| `block_counter` | カウンター不可 | 部分 |
| レジスト / 登録 | `pendingRegister` 順序 | `resist.test.ts`, `effectStack.test.ts` |

#### Counter

| 対象 | テスト内容 | 既存 |
|------|-----------|------|
| 反応窓開閉 | rush/battle/strike/leave | `reactionPriority.test.ts` |
| カウンターコスト | コマンド支払い・カテゴリ | `counterPaymentCoverage.test.ts` |
| キャンセル vs 代用 | RS-006 等 | `operationCounters.test.ts` |
| `operationCounters` | 合法タイミング | `operationCounters.test.ts` |

#### Damage

| 対象 | テスト内容 | 既存 |
|------|-----------|------|
| `requiresDamagePowerChoice` | 複数パワー選択要否 | `damagePayment.test.ts` |
| ダメージ量計算 | SP 合算・修飾子 | `damagePayment.test.ts` |
| パワー裏返し順序 | プレイヤー選択 | `damagePayment.test.ts` |
| デッキアウト | ダメージ時ドロー | 部分 |

#### Win/Lose

| 対象 | テスト内容 | 既存 |
|------|-----------|------|
| `WIN_DAMAGE` (6) | 閾値到達 | `index.test.ts` |
| `checkWinner` | 同時 6 ダメージ | 追加 |
| ゲーム終了後 | 合法手なし・apply 拒否 | 追加 |
| 先攻/後攻 | ダメージカウント独立 | 部分 |

```typescript
it("sets winner when damage reaches WIN_DAMAGE", () => {
  const s = applyDamage(playerState, 6);
  expect(s.winner).toBe(opponent(playerId));
});
```

### 1.3 Unit Test 禁止事項

- `applyAction` 端到端（→ Integration へ）
- 実カード ID 依存の複合フロー（→ Golden / Integration へ）
- ランダム seed なし（→ Property へ）

---

## 2. Integration Test（結合テスト）

**役割:** `applyAction` チェーンで複数モジュールが連携するフローを検証する。  
**Fixture:** `testing/fixtures.ts`（TST-* カード）+ `testing/gameplayFlow.ts`。

### 2.1 配置

```
packages/engine/src/
  gameplayFlow.integration.test.ts   # 既存
  legend2.integration.test.ts
  legend3.integration.test.ts
  jointRiding.integration.test.ts
  namedUnitEffects.integration.test.ts
  integration/
    phases.integration.test.ts       # 新規: フェイズ通し
    reactionWindows.integration.test.ts
    counterFlow.integration.test.ts
    damageChain.integration.test.ts
    winConditions.integration.test.ts
```

### 2.2 ドメイン別シナリオ

#### Rule Engine

| シナリオ | Action 列 | 検証 |
|----------|-----------|------|
| 標準ターン | start → charge → rush → battle → end | フェイズ・手番交代 |
| 先攻 1T | createGame → charge | start 省略 |
| 必須バトル進入 | rush のみで end 不可 | `phase_end_blocked` 相当 |
| コマンド支払い連鎖 | initiate → select → confirm | `commandPayment.test.ts` 拡張 |

#### Event System（導入後）

| シナリオ | 検証 |
|----------|------|
| Rush → on_rush → 反応窓 → pass | event log 全文 |
| Battle → on_attack → on_destroy 順 | RS-026 公式順序 |
| ターン終了 | self_end → turn_end_effects → clear |

#### Card Effects

| パターン | 代表カード | 既存 |
|----------|-----------|------|
| on_rush 選択 | RS-046 armor_attack | `rushEffects.test.ts` |
| enter_battle | RS-090 系 | `rs090.test.ts` |
| on_attack BP 修正 | RS-112 | `rs112.test.ts` |
| 常駐オペ | RS-003 battle_dance | `battleDance.test.ts` |
| NC | comboNumber 一致 | `numberCombo.test.ts` |
| ゾード rush 支払い | 全 zordId | `gameplayFlow.integration.test.ts` |

**目標:** B カード（1,625 枚）は `testGenerator` から **integration stub** を自動生成し、interpreter 接続後に `skip` → `run` へ移行。

#### Battle Resolution

| シナリオ | 検証 |
|----------|------|
| S vs S BP 勝利 | 破壊ゾーン・ラッシュ残留 |
| レジスト発動 | pendingRegister → 反応 → 続行 |
| バウンス | `bounce.test.ts` |
| 複数バトル/ターン | battleFillers パターン |

#### Counter

| シナリオ | 検証 |
|----------|------|
| バトル宣言 → カウンター → キャンセル | RS-006 |
| ストライク → カウンター | `strikeReactions.test.ts` |
| ラッシュ → カウンター | 部分 |
| カウンター後の再宣言不可 | 状態復元 |

#### Damage

| シナリオ | 検証 |
|----------|------|
| ストライク → 1 ダメージ → パワー 1 枚裏 | 基本 |
| 3 ダメージ → 選択 → 裏 3 枚 | `damagePayment.test.ts` |
| 6 ダメージ → 勝利 | Win/Lose 連携 |
| ダメージ中の誘発 | RS-112 閾値 |

#### Win/Lose

| シナリオ | 検証 |
|----------|------|
| ストライク 6 ダメージ勝利 | winner 設定・合法手空 |
| バトル勝利で相手ユニット破壊 | ゲーム継続 |
| 同ターン双方ダメージ | 公式裁定（golden 参照） |

### 2.3 Integration ヘルパ API（標準化）

```typescript
// testing/scenarioRunner.ts（新規推奨）
export function runScenario(
  steps: Array<{ action: GameAction; label?: string }>,
  initial?: Partial<GameState>,
): ScenarioResult;

export function expectZone(state: GameState, playerId: PlayerId, zone: Zone, cardIds: string[]): void;
export function expectPending(state: GameState, kind: PendingKind): void;
export function expectNoPending(state: GameState): void;
export function expectWinner(state: GameState, playerId: PlayerId | null): void;
```

---

## 3. Golden Test（ゴールデンテスト）

**役割:** 公式裁定・FAQ・grnrngr Q&A を **固定 Action 列 + 固定 State スナップショット** で回帰ロックする。  
**性質:** 変更は意図的（ルール改正・バグ修正）のみ。diff が出たら人間がレビュー。

### 3.1 配置

```
packages/engine/
  golden/
    manifest.json              # ケース一覧・出典 URL
    cases/
      RS-001_goren_storm_nc5.json
      RS-026_effect_order.json
      RS-090_enter_battle.json
      FAQ_battle_entry_hold.json
    runner.ts                  # vitest から呼ぶ
    snapshot.ts                # State 正規化
```

### 3.2 Golden ファイル形式

```json
{
  "id": "RS-026_effect_order",
  "source": "https://www.grnrngr.com/documents/rangersstrike/faq/...",
  "description": "ラッシュ時効果はバトル進入より先",
  "seed": 42,
  "definitions": ["RS-026", "RS-046"],
  "decks": { "player1": ["..."], "player2": ["..."] },
  "steps": [
    { "action": { "type": "rush", "..." }, "comment": "RS-026 rush" },
    { "action": { "type": "pass_rush_reaction", "..." } }
  ],
  "expect": {
    "phase": "battle",
    "pending": null,
    "zones": {
      "player1.rush": ["inst-r26"],
      "player2.battle": []
    },
    "events": ["rush_completed", "effect_triggered", "reaction_window_opened"],
    "log": ["optional: last N log lines"]
  }
}
```

### 3.3 ドメイン別 Golden 優先ケース

| ドメイン | 必須 Golden 数（初期） | 代表 |
|----------|----------------------|------|
| Rule Engine | 15 | 先攻 1T、必須進入、フェイズ終了ブロック |
| Event System | 20 | RS-026 順序、同時効果、離場→ストライク優先 |
| Card Effects | 50+ | 各 effectId C カード 1 件 + FAQ 裁定 |
| Battle Resolution | 15 | レジスト、印刷 BP、ブロックカウンター |
| Counter | 10 | キャンセル/代用、タイミング違反 |
| Damage | 10 | 選択順、6 ダメージ、デッキアウト |
| Win/Lose | 5 | 同時勝利、ゲーム終了後操作拒否 |

**State 正規化（snapshot）:** `instanceId` を順序ベースに置換、`log` はタイムスタンプ除去。差分は構造のみ比較。

### 3.4 Wiki / FAQ 連携

```
docs/wiki/cards/RS-026.md  →  golden/cases/RS-026_*.json
docs/wiki/faq/*.md          →  golden/cases/FAQ_*.json
```

`manifest.json` に `wikiCardId` / `faqId` を紐付け、カバレッジレポートを CI 出力。

---

## 4. Replay Test（リプレイテスト）

**役割:** 記録された Action 列（または monkey 失敗 seed）を再生し、再現性と回帰を検証する。

### 4.1 配置

```
packages/engine/
  replay/
    format.ts           # ReplayV1 型
    record.ts           # applyAction ラッパで記録
    play.ts             # 再生
    failures/           # monkey 失敗 seed から自動保存
      seed_12345.json
  replay.test.ts
```

### 4.2 Replay フォーマット

```typescript
type ReplayV1 = {
  version: 1;
  seed: number;
  firstPlayer: PlayerId;
  player1Deck: string[];   // cardId[]
  player2Deck: string[];
  actions: GameAction[];
  /** 記録時の終了状態（任意 — golden との併用） */
  finalHash?: string;
};
```

### 4.3 ドメイン別用途

| ドメイン | Replay の使い方 |
|----------|----------------|
| Rule Engine | 長いターンを一度記録し、リファクタ後に同一 hash |
| Event System | event log 全文を replay に含め、導入前後で diff |
| Card Effects | バグ報告者が「この操作列で壊れる」を JSON 添付 |
| Battle / Counter / Damage | 複雑な反応チェーンの最小再現 |
| Win/Lose | 勝利直前 10 Action の再生 |

### 4.4 Monkey 失敗 → Replay 自動化

既存 `monkey.test.ts` を拡張:

```typescript
// 失敗時
if (failure) {
  writeReplay(`replay/failures/seed_${seed}.json`, { seed, actions, state });
}
// replay.test.ts が failures/ を全実行
```

CI では `replay/failures/` を **常にグリーン** に保つ（修正 or golden 昇格）。

### 4.5 Web UI 連携（将来）

```
apps/web → 「リプレイエクスポート」→ ReplayV1 JSON
         → engine replay.play() で同一結果を検証
```

UI はテスト対象外。エクスポート形式のみ engine と共有。

---

## 5. Property Test（プロパティテスト）

**役割:** ランダム探索で **不変条件（invariant）** を検証する。例示テストの抜け穴を埋める。  
**実装:** `fast-check` 導入推奨。現状 `monkey.test.ts` が原型。

### 5.1 配置

```
packages/engine/src/
  properties/
    invariants.ts        # 共有不変条件
    game.properties.test.ts
    legalActions.properties.test.ts
    effectStack.properties.test.ts
    damage.properties.test.ts
  monkey.test.ts         # 既存 → properties へ統合
```

### 5.2 グローバル不変条件（全ドメイン共通）

| ID | 不変条件 | ドメイン |
|----|----------|----------|
| INV-01 | `getLegalActions(s)` のすべてが `applyAction` 成功 | Rule Engine |
| INV-02 | `applyAction` 成功後、`buildEffectStack` と `pending*` が整合 | Rule Engine |
| INV-03 | ゲーム終了後は `getLegalActions` が空 | Win/Lose |
| INV-04 | 各ゾーンのカード instanceId はゲーム内で一意 | Rule Engine |
| INV-05 | ダメージ合計は負にならない・WIN_DAMAGE 超で winner | Damage / Win |
| INV-06 | 反応窓中はスタックトップの pass のみ or 明示的合法手 | Counter |
| INV-07 | 手札+全ゾーン枚数+除外=デッキ構築時枚数（カード消失なし） | Rule Engine |
| INV-08 | Event log（導入後）は時系列単調・因果順序 | Event System |

```typescript
// fast-check 例
it.prop("legal actions always apply successfully", [fc.integer()], (seed) => {
  let state = createRandomGame(seed);
  for (let i = 0; i < 100; i++) {
    if (state.winner) break;
    const actions = getLegalActions(state);
    const action = pickRandom(actions, seed + i);
    const result = applyAction(state, action);
    expect(result.ok).toBe(true);
    state = result.state;
    assertInvariants(state); // INV-01..08
  }
});
```

### 5.3 ドメイン別 Property

#### Rule Engine

- フェイズは `start|charge|rush|battle|end` のいずれか
- `activePlayer` は `player1|player2`
- ターン終了でターン限定修飾子がクリア

#### Event System

- 各 `effect_triggered` の前に対応する cause event が存在
- 反応窓 `opened` には必ず `closed` または `passed` が続く（pending 解消）

#### Card Effects

- primitive 適用後、対象カードは指定ゾーンに存在（move）
- `modify_bp` の turn 修飾子はターン終了で消える

#### Battle Resolution

- バトル後、敗者は破壊 or 残留のいずれか一方（ゾーン整合）
- BP 比較は対称的で決定論的

#### Counter

- カウンター解決後、元の pending が復元 or キャンセルで消滅
- カウンター不成立時は illegal_action

#### Damage

- 与えたダメージ = 裏にしたパワー枚数（選択完了後）
- 部分ダメージ時、表パワーが残るなら choice pending

#### Win/Lose

- `winner != null` → 双方ダメージいずれか >= WIN_DAMAGE
- winner 設定後 state 変化なし（操作拒否）

### 5.4 Monkey vs Property

| | monkey.test.ts（現状） | Property（目標） |
|--|------------------------|------------------|
| 目的 | クラッシュしないこと | 不変条件 + クラッシュなし |
| 失敗時 | seed 報告 | replay 自動保存 |
| 実行 | 80 game × CI | 1000 step × nightly |
| デッキ | 固定 5 種 | 構築ルール準拠ランダム |

---

## 6. ドメイン × テスト種別 マトリクス

| ドメイン | Unit | Integration | Golden | Replay | Property |
|----------|------|-------------|--------|--------|----------|
| **Rule Engine** | フェイズ・コスト・legal | ターン通し | FAQ 裁定 | 長ターン記録 | INV-01,02,04,07 |
| **Event System** | dispatcher・購読 | event log 通し | RS-026 順序 | event log 付 replay | 因果順序 |
| **Card Effects** | primitive・validator | 代表カード | 全 C カード | バグ再現 | primitive 不変 |
| **Battle Resolution** | BP 比較・破壊 | バトルフロー | レジスト FAQ | 複合バトル | ゾーン整合 |
| **Counter** | 窓優先度 | RS-006 等 | タイミング FAQ | 反応チェーン | INV-06 |
| **Damage** | choice 判定 | ストライク連鎖 | 6 ダメージ | 勝利直前 | INV-05 |
| **Win/Lose** | checkWinner | 勝利ゲーム | 同時勝利 | 終局 replay | INV-03,05 |

---

## 7. CI パイプライン

```yaml
# 推奨ジョブ分割
jobs:
  unit:
    - npm run test -- packages/engine/src/rules packages/engine/src/effects
    - npm run test -- packages/cards
    time: < 30s

  integration:
    - npm run test -- packages/engine/src/*.integration.test.ts
    time: < 2min

  golden:
    - npm run test:golden
  # 失敗時 artifact: diff snapshot

  replay:
    - npm run test:replay
  # replay/failures/ 必須パス

  property:
    - MONKEY_GAMES=200 npm run test:monkey  # PR
    - MONKEY_GAMES=2000 npm run test:monkey # nightly
```

| トリガー | 実行 |
|----------|------|
| PR | unit + integration + golden + replay(failures) + monkey(80) |
| main nightly | property 拡張 + 全 golden + DSL generated tests |
| カード JSON 変更 | validate-cards + generated card tests |

---

## 8. 現状 → 目標ギャップ

| テスト種別 | 現状 | ギャップ |
|-----------|------|----------|
| Unit | ~40 ファイル。モジュール別に分散 | `legalActions` 専用・primitive 単体・Event dispatcher |
| Integration | legend2/3, gameplayFlow, カード ID 直書き | scenarioRunner 標準化・B カード自動生成 |
| Golden | **なし** | manifest + FAQ 50 件から開始 |
| Replay | monkey seed のみ | ReplayV1 形式・failures 自動化 |
| Property | monkey のみ | fast-check・INV 明示・不変条件 assert |

---

## 9. 実装ロードマップ

### Phase 1（1–2 週間）— 基盤

1. `testing/scenarioRunner.ts` + `assertInvariants()`
2. `golden/manifest.json` + FAQ 10 件
3. `ReplayV1` 型 + monkey 失敗保存
4. I-01 `countAvailablePower` unit test

### Phase 2（3–4 週間）— カードスケール

1. `testGenerator` → integration stub 量産（skip 付き）
2. Golden: 全 C カード（~35 L1-L3）+ RS-026 等
3. `properties/game.properties.test.ts`（INV-01–05）

### Phase 3（Event 導入と同期）

1. Unit: `EventDispatcher` + 購読テスト
2. Golden の `expect.events` を有効化
3. Integration を event log assert に段階移行

### Phase 4（全弾）

1. Golden: Wiki FAQ リンク 200+ 件
2. B カード generated test: skip → pass 率 85% 追跡
3. nightly property: ランダムデッキ生成（deckRules 準拠）

---

## 10. 成功指標

| 指標 | 現状 | Phase 2 | Phase 4 |
|------|------|---------|---------|
| Unit カバー（rules/*） | ~60% | 85% | 95% |
| L1-L3 integration | ~40% | 70% | 95% |
| Golden ケース | 0 | 50 | 200+ |
| Replay failures | 0 固定 | 自動 | 自動 |
| Monkey games/PR | 80 | 200 | 500 |
| INV 明示 assert | 0 | 5 | 8 |
| DSL generated tests | 130 skip 多 | 50% pass | 85% pass |

---

## 参照

| 文書 | 内容 |
|------|------|
| [game-events-catalog.md](./game-events-catalog.md) | 162 イベント — Golden / Event test の期待値 |
| [codebase-scalability-review.md](./codebase-scalability-review.md) | A/B/C 分類 — テスト生成方針 |
| [rules-engine-design.md](./rules-engine-design.md) | Action / Event / Stack 設計 |
| `packages/engine/src/testing/` | 既存 fixture・gameplayFlow |
| `packages/cards/src/dsl/testGenerator.ts` | カード別 stub 生成 |
