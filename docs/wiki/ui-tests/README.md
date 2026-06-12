# Wiki 完成版テストスイート

`docs/wiki` のルール・カード仕様に**完全準拠した完成版**を想定したテストケース一覧。

現状の実装ギャップ（`engine-gaps.md`）はテストに含めず、wiki 通りに動くことを検証する。

## 構成

| レイヤ | 対象 | 実装 | 件数 |
|--------|------|------|------|
| カード（カタログ） | full-playable 全カード | `apps/web/lib/wikiComplete.test.ts` | 1849 |
| カード（UI/DSL） | 同上 | 同上 | 1849 |
| ルール（仕様登録） | core/phases/battle/rush/damage/keywords | `apps/web/lib/wikiTestSpecs/ruleSpecs.ts` | 28 |
| ルール（E2E） | 代表シナリオ | `packages/engine/src/wikiRulesComplete.test.ts` | 7+ |
| RK オペ（手動バッチ） | RK-001〜020 | `rk-batch-01.md` / `rk-batch-02.md` | 20 |

## テスト観点（カード共通）

| # | 観点 | 内容 |
|---|------|------|
| 1 | カタログ整合 | `full-playable` の name / type / powerCost / category / text が wiki と一致 |
| 2 | 画像 | `resolveCardImageUrl` がローカルまたは grnrngr URL を返す |
| 3 | DSL | `isCardDslReady` が true（完成版） |
| 4 | UI カバレッジ | `estimateCardUiCoverage` → `promoted-ui` |
| 5 | 効果メタ | operation: `getCardEffect().kind` が wiki の常駐/カウンター/即時と一致 |
| 6 | UI 経路 | operation: `resolvePromotedOperationUiMechanisms` が期待 mechanism を含む |
| 7 | ドロップ | instant オペ: `resolveOperationDropRoute` = `direct_play` |
| 8 | DSL キーワード | `grant_keyword` が wiki 効果クラスと一致 |
| 9 | デッキ警告 | DSL ready カードは `estimateDeckWarnings` で UI 未確認にならない |
| 10 | ユニット/ビークル | bp / size / sp が wiki ステータスと一致 |

## 仕様データの生成

```bash
npx tsx apps/web/scripts/generate-wiki-complete-specs.ts
```

出力:

- `apps/web/lib/wikiTestSpecs/generated/all-specs.json` — 全カード仕様
- `apps/web/lib/wikiTestSpecs/generated/{prefix}-specs.json` — プレフィックス別
- `apps/web/lib/wikiTestSpecs/generated/manifest.json` — サマリ

## テスト実行

```bash
# 仕様再生成（wiki / catalog 更新後）
cd apps/web && npm run generate:wiki-specs

# Web — カタログ整合（1849 枚・現状パス想定）
cd apps/web && npm test -- wikiComplete -t "catalog fields"

# Web — 完成版（DSL + promoted-ui。未配線カードは失敗＝実装 TODO）
cd apps/web && npm test -- wikiComplete -t "matches wiki"

# Engine — ルール E2E
cd packages/engine && npm test -- wikiRulesComplete

# RK 手動バッチ（既存・RK-001〜020）
cd apps/web && npm test -- rkUiLogic.batch
```

### 現状サマリ（2026-06-12）

| スイート | 件数 | 状態 |
|----------|------|------|
| カタログ整合 | 1849 | パス |
| 完成版（UI/DSL） | 1849 | パス |
| ルール E2E | 7 シナリオ + 仕様 28 件 | パス |

## ドキュメント索引

- [rules-complete.md](./rules-complete.md) — 全ルールテストケース ID 一覧
- [card-matrix.md](./card-matrix.md) — プレフィックス別カードテストマトリクス
- [rk-batch-01.md](./rk-batch-01.md) / [rk-batch-02.md](./rk-batch-02.md) — RK オペ手動バッチ（001〜020）
- [rk-batch-03.md](./rk-batch-03.md) — RK-021〜030（ID 帯、全カード種別）

## 完成版の定義

1. **カード**: wiki 効果文・ステータスとカタログ/DSL が一致し、UI が `promoted-ui`
2. **ルール**: `docs/wiki/*.md` の HIGH confidence セクションがエンジン E2E で再現
3. **既知スコープ外**: タッグストライク、XG ブラスト等は `engine-gaps.md` 参照のうえテスト対象外
