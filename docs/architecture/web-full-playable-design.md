# Web フルプレイアブル — 設計メモ（W1–W2）

**更新:** 2026-06-10  
**要件:** [web-full-playable-requirements.md](./web-full-playable-requirements.md)（OQ 確定済み）

---

## 1. カタログ API

### 決定: `@rangers-strike/cards` に `resolvePlayableCard` を追加（PR-3 / W2）

```ts
// packages/cards/src/extendedCatalog.ts（または catalog.ts 再 export）
export function resolvePlayableCard(id: string): CardDefinition | undefined {
  return getCardById(id) ?? getFullPlayableCardById(id);
}
```

- **シグネチャ:** `getCardById` → `getFullPlayableCardById` フォールバック
- **export:** `packages/cards/src/index.ts` から公開
- **テスト:** `packages/cards/src/extendedCatalog.test.ts` に core / promoted / unknown の 3 ケース
- **Web では W2 で一括置換。** W1 の DeckBuilder は `getFullPlayableCardById` 直使用で可

### Wiki 収録ラベル（OQ-02 / W1 追加）

expansion フィルタは技術キーではなく **Wiki「収録」先頭トークン**（例: `英雄の再誕`）で統一。

| 層 | 実装 |
|----|------|
| 生成 | `packages/cards/scripts/generate-wiki-set-labels.ts` — `docs/wiki/cards/*.md` から `cardId → wikiSetLabel` を抽出（約 80 セット） |
| 配布 | `packages/cards/pipeline/data/wiki-set-labels.json` + `getWikiSetLabel(id)` を cards から export |
| Web | `DeckBuilderScreen` フィルタは `wikiSetLabel` で絞り込み。「全件」+ セット名ソート |

収録行の正規化: `収録：英雄の再誕　自販：パック` → `英雄の再誕`（全角スペース前まで）。

L1–3 core カードも wiki md から同じ map で解決（`legend1` 技術キーは UI に出さない）。

---

## 2. deckBuilder 切替（W1）

```ts
// apps/web/lib/deckBuilder.ts
import { fullPlayableCatalog, ... } from "@rangers-strike/cards";

export function validateDeckEntries(entries) {
  return validateDeckEntriesCore(entries, fullPlayableCatalog);
}
export function buildCardDefinitions(entries) {
  return expandDeck({ ...shell, entries }, fullPlayableCatalog);
}
```

**後方互換:** L1–3 の cardId は full の部分集合。既存 localStorage custom デッキはそのまま検証・展開可能。

---

## 3. 警告ロジック（W2 MVP / OQ-03）

新規: `apps/web/lib/deckWarnings.ts`

```ts
export type DeckWarningEstimate = {
  uiUncertainCount: number;  // デッキ内枚数（count 加重）
  unknownIds: string[];
};

export function estimateDeckWarnings(entries: DeckEntry[]): DeckWarningEstimate
```

**判定（MVP）:** `resolvePlayableCard(id)` 成功かつ `getCardById(id)` 失敗 → promoted（UI 未確認）。`entries[].count` で加重集計。

**表示:** 保存時（`DeckBuilderScreen`）、開始時（`StartScreen` / `startGame` 前）。  
**文言:** 「UI 未確認カードが N 枚含まれます」— **保存・開始はブロックしない**。

---

## 4. GameApp カード解決（W2 置換対象）

`getCardById` → `resolvePlayableCard` に置換するファイル（grep 確定）:

| ファイル | 用途 |
|---------|------|
| `components/GameApp.tsx` | エラーメッセージ、op 解決、preview |
| `components/DeckBuilderScreen.tsx` | デッキ内容パネル（W1 で `getFullPlayableCardById` 可） |
| `components/EffectChoiceModal.tsx` | ソース・ターゲット表示 |
| `components/OperationPromptModal.tsx` | OP 名 |
| `components/ReactionModal.tsx` | カウンター候補 |
| `components/CyberSRiderModal.tsx` | L1–3 専用（既存優先、フォールバックのみ promoted） |
| `components/BattleDanceModal.tsx` | 同上 |
| `components/ShironLightModal.tsx` | 同上 |
| `lib/cardTargets.ts` | ターゲット解決 |
| `lib/effectChoiceBoardTap.ts` | ボードタップ |
| `lib/zordSetupUi.ts` | ゾードセットアップ |

**置換しない（意図的）:**

- `lib/webUiUnitEffectCoverage.test.ts` — L1–3 UI カバレッジ専用、`getCardById` 維持
- `lib/webUiIntegration.test.ts` — 一部は拡張、core 回帰は `getCardById` 維持可

**PlayerBoard / CardImage:** `definitions[cardId]` 経由（game state 展開済み定義）。`startGame` で full 展開すれば追加置換不要。  
**CardImage:** `imageUrl` 欠損時プレースホルダ強化（名前・BP・category）— OQ-05 W1–W2 方針。

---

## 5. deckSelection / game 起動（W2）

- `resolveDeckCards` → custom は `buildCardDefinitions`（full カタログ）で promoted 含む展開
- `createGameFromDeckSelections` — custom vs starter 混在は既存 `createGameForDecks` 経路
- `GameApp.startGame` — `validateDeckEntries` を full 基準に（GA-07）

---

## 6. 禁止カード（W2 / OQ-01）

- ソース: `docs/wiki/sources/atwiki/page-2079-banned.md`
- 適用: **通常大会禁止のみ**（タッグ専用 RS-244/289/348 は除外）
- 実装: `packages/cards/src/deckRules.ts` に `BANNED_CARD_IDS`
- **要調査:** XG2 ドギー・クルーガーの正確な cardId（wiki は `XG2-???`）。候補調査を W2 PR に含める
- 検証エラー: 「禁止カードが含まれています: {name}」

---

## 7. テスト方針

| パッケージ | 内容 |
|-----------|------|
| `cards` | `resolvePlayableCard` 単体、既存 deckRules 回帰、`wiki-set-labels` 生成スクリプト smoke |
| `apps/web` | `deckBuilder` full カタログ検証、promoted 1 枚 custom で `createGameFromDeckSelections`（`webUiIntegration.test.ts` 拡張） |
| `engine` | 回帰不要（Web 接続のみ） |

**AC マッピング:** AC-01〜06 を W1–W2 PR 完了時にチェックリスト化。

---

## 8. PR 分割（確定）

| PR | フェーズ | 内容 | バックログ # |
|----|---------|------|-------------|
| PR-1 | W1 | `deckBuilder` full + `DeckBuilderScreen` カタログ・wiki 収録フィルタ | 1, 2, 3, 4 |
| PR-2 | W1 | 空検索 UX + 検証エラー文言（DB-08）+ SS-04 | 4 |
| PR-3 | W2 | `resolvePlayableCard` + Web 一括置換 + CardImage プレースホルダ | 5 |
| PR-4 | W2 | `deckSelection` custom full + `GameApp.startGame` | 6, 8 |
| PR-5 | W2 | 警告 UI + banned リスト + StartScreen 文言 | 7, 9, 20 |
| PR-6 | W2 | 回帰テスト + `webUiIntegration` 拡張 | 10, 17 |

**順序:** PR-1 → PR-2（W1）→ テスト PASS → PR-3〜6（W2）。

**W1 スコープ追加（OQ-02）:** `wiki-set-labels.json` 生成 + 収録フィルタ（PR-1 に含める）。

**W2 スコープ追加（OQ-01）:** banned リスト（PR-5 に含める。旧バックログ #20 から前倒し）。

---

## 9. リスクメモ

- **80 収録セット:** `<select>` は長いがモバイルでもスクロール可能。W3 でグルーピング検討可
- **XG2 禁止 ID 不明:** W2 着手前に wiki / catalog 横断で ID 確定必須
- **1849 件 DOM:** 空検索時は 0 件表示 + 促し文言（PR-2）。全件 map 禁止

---

## 10. W3 設計（2026-06-10）

### PR 分割

| PR | 内容 | 要件 |
|----|------|------|
| **W3-1** | デッキビルダー検索結果の仮想スクロール | DB-11, GAP-09 |
| **W3-2** | promoted 画像: `resolveCardImageUrl` + grnrngr リモート URL + Next remotePatterns | GAP-05, OQ-05 |

### W3-1: 仮想スクロール

- `@tanstack/react-virtual` を `apps/web` に追加
- `DeckBuilderCatalogList.tsx` — 固定行高 (~72px) の `useVirtualizer`
- 検索結果 0 件 / 空検索 UX は現状維持
- デッキ内容パネルは件数少ないため仮想化不要

### W3-2: 画像（段階取得 MVP）

- `packages/cards/src/cardImages.ts`: `resolveCardImageUrl(id)` = catalog `imageUrl` → grnrngr 慣例 URL
- `getCardImageUrl` を `resolvePlayableCard` + 上記に更新
- `CardImage.tsx`: `resolveCardImageUrl` 使用、`onError` でプレースホルダ fallback
- `next.config.ts`: `images.remotePatterns` に `www.grnrngr.com`
- **一括ダウンロード完了（2026-06-10）:** `npm run download-promoted-images` — 1,004 成功 / 666 404（grnrngr 未掲載）。`/cards/promoted/{id}.jpg` + catalog `imageUrl` 更新。manifest: `pipeline/data/promoted-image-download.json`

---

## 11. W4 設計（2026-06-10）

| PR | 内容 | 要件 |
|----|------|------|
| **W4** | 実装ステータスバッジ + 汎用 EffectChoice + 効果デバッグ | DB-06, GA-04–06, GAP-06–07 |

- `cardImplementationStatus.ts` — Core 無バッジ / promoted → `UI未確認`
- `isKnownEffectChoice` — 未知 pending は汎用 modal + スキップ（UI未対応）
- `debugEffectLog` — development トグル + console / ログ modal
