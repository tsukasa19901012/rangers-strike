# 引き継ぎメモ（2026-10-10）

クラウドセッションからローカルの Claude Code へ引き継ぐためのメモ。作業ブランチは `claude/card-game-completion-59wo7p`。
作業が終わったらこのファイルは削除してよい。

## 方針（ユーザー決定事項）

- ルールの正は **web のwiki・公式サイト**（w.atwiki.jp/renst、wikiwiki.jp/renst、www.grnrngr.com）。
  `docs/wiki/sources/` の保存済みスナップショットは参考扱い。
- ルールは新規の `docs/rules/` に一本化する。各ルールに ID（例: `R-WIN-02`）と出典URLを付け、修正やテストはその ID を参照する。
- 古いドキュメント（`docs/wiki/*.md` の要約、`docs/wiki/glossary/`、`docs/wiki/cards/`、ルート直下の
  `implementation-report.md` / `coverage-report.md` / `simulation-report.md`、古い `docs/architecture/*`）は
  **削除する前提**。`docs/rules/` はこれらにリンクしない。

## 最初にやること

1. web のルールページを取得する（クラウド環境からは接続できなかった）:
   ```bash
   node scripts/fetch-rule-sources.mjs
   ```
   → `docs/rules/sources/web/` に保存され、`manifest.json` に取得結果が残る。
2. `docs/rules/`（ルールブック）を web 版と照合し、各ルールの「web未照合」を確定させる。
   ルールブックの下書きは保存済みスナップショットと監査レポートから作成したもの。
3. 照合で確定した内容に合わせて、古いドキュメントを削除する。

## 調査結果

- 保存データの検証: `docs/verification/source-data-audit.md`
- ルール精査（5トピック＋優先度付きサマリー）: `docs/verification/rules-audit/README.md`

## P0 修正の進捗

| ID | 内容 | 状態 |
|----|------|------|
| E1 | 同時7点目はターンプレイヤーの勝ち | ✅ `core/createGame.ts` `checkWinner` |
| E2 | 効果ドローで引けなければデッキアウト敗北 | ✅ `PlayerState.deckedOut`、`performDeckDraws` / `requestDrawFromDeck` |
| E3 | 追加ドローは1ターン1回 | ✅ `hasBonusDrawnThisStart` |
| E4 | ターン終了で両プレイヤーの「このターン」修正を消す | ✅ `finalizeTurnEnd` |
| E5 | ブラスト条件 | 未着手 |
| E6 | クロスの向き | 未着手 |
| E7 | 効果なしで動いている13枚 | 未着手 |

### E5 ブラスト（`packages/engine/src/keywords/battleKeywords.ts` `blastBypassesRushAdditionalCondition`）

- 原文（atwiki page-1701、公式注釈）: 「自分がゲームに負けるまで残りダメージ1点で、自軍Lユニットが１体もなければ、これの追加条件は満たさなくてもよい」
- 現状: `damage >= WIN_DAMAGE - 1` **または** 表パワー≤1。L ユニット条件なし。
- 修正: `damage === loseDamageThreshold - 1`（命の泉等の閾値変更も考慮）**かつ** 自軍に L ユニットがない。
  未使用の `playerHasAllyLargeUnit` が同ファイルにある。`docs/architecture/adr-blast-rush-condition.md` の独自解釈は破棄。
- 併せて `core/catalog.ts:571-578` でブラスト判定がブレイカーの同名禁止より先にある問題も確認。

### E6 クロス（`battleKeywords.ts` `crossAdjustedBattlePosition` / `numberComboEffects.ts`）

- 原文（atwiki page-2393）: 「これが自軍バトルエリアにある間、これより右にあるユニットの、ナンバーの数字とSPの分母の数字はX少なくなる。ただし2より少なくならない。」
- 並び順は変わらない（Q2）。CN5 は左にクロス1が2体あれば CN3（rule-qa）。
- 現状: 位置から X を引いて CN と比較しているため逆方向（クロス1の右の2番目で CN1 が成立してしまう）。
- 修正: 実効CN = max(2, 印刷CN − 左側クロス合計)。ただし元が2未満（CN1）なら変えない。位置はそのまま。
  分数SPの分母も同様（`rules/fractionalSp.ts` と `legend2/fieldEffects.ts` の両方）。
  `keywords/battleKeywords.test.ts:37` は誤った挙動を期待しているので直す。

### E7 効果なしの13枚

PR-015, PR-016, RK-140, RK-334, RS-230, RS-288, XG1-028, XG1-029, XG1-030, XG1-062, XG3-005, XG5-014, XG6-015。
原文には効果テキストがあるが、カタログ `text` が空で DSL stub の `effects` / `unnamedRules` も 0 件。
カタログ生成のテキスト抽出（原文の「テキスト:」半角コロンやラベルなし形式）を疑う。
修正後、監査に「原文に効果テキストがあるのに効果定義0件」の検出を追加する。

## P1 以降

`docs/verification/rules-audit/README.md` の P1（E8〜E17）・P2、およびエラッタ未反映8枚
（RS-003, 043, 051, 052, 058, 065, 106, 118）、RS-076/RS-105 のサイズ（XL）、オペレーションの特徴欠落23枚。

## テスト

```bash
npm ci
npm run typecheck
npx vitest run --exclude "**/simulateAllStarters.test.ts"   # packages/engine で実行。全件は15分以上かかる
npm test
```

- `simulateAllStarters.test.ts`（150試合）はクラウド環境で 900 秒のタイムアウトに達した。原因（環境の遅さか、どこかで止まっているか）は未調査。
