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

## 進捗（2026-10-10 ローカル）

- 手順1・2は完了。公式と wikiwiki はスクリプトで、atwiki は Cloudflare に弾かれるためブラウザ経由で本文を
  `docs/rules/sources/web/` に保存し、全章を照合した（照合済 237 件、未照合は R-KW-BLAST-03 のみ）。
- 公式と atwiki の食い違いは README §5.7。a（スタートでリリースするのはコマンドだけ）と
  b（「アタックするかわりに」は対象なしでも使える）はユーザー決定。
- E5・E6 は修正済み。次は E7 と手順3（古いドキュメントの削除。`docs/wiki/cards` などはカード生成スクリプトとテストが読んでいるので、そのままは消せない）。

## 最初にやること

1. web のルールページを取得する（クラウド環境からは接続できなかった）:
   ```bash
   node scripts/fetch-rule-sources.mjs
   ```
   → `docs/rules/sources/web/` に保存され、`manifest.json` に取得結果が残る。
2. `docs/rules/`（ルールブック）を web 版と照合し、各ルールの「web未照合」を確定させる。
   ルールブックの下書きは保存済みスナップショットと監査レポートから作成したもの。
3. 照合で確定した内容に合わせて、古いドキュメントを削除する。

## ルールブック（docs/rules/）の状態

- 9ファイル・209ルール＋エラッタ36件。全ルールが `web未照合`（保存スナップショット由来）で、各ルールに照合先の web URL 付き。
- 取得すべき web ページの一覧と未確定事項35件は `docs/rules/README.md`。
- 作成中に見つかった、精査レポートと食い違う点（ルールブック側が正しいと判断したもの）:
  1. 「アタックするかわりに」: 公式コラムvol44（atwiki page-318 に引用）でルールが整理され、攻撃対象がいなくても
     アタックする権利を失うかわりに発動できる。精査レポート05は古い公式FAQ（RS-100/106）を現行扱いしている。→ R-ATK-05, R-REPL-03
  2. エラッタ: 保存済み errata.html は6件だが、atwiki の「修正後は以下」は34枚（公式エラッタと明記されたものを含む）。
     errata.html が古いか一部のみの可能性。web 版で要確認。
  3. 効果によるラッシュ: 必要パワー・追加条件が要るのはカードに書いてある場合だけ（RS-005, RS-013）。既定では不要（RS-121 公式FAQ）。
     → R-RUSH-20/21。精査レポート05の一般則は誤り。

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
| E5 | ブラスト条件 | ✅ `blastBypassesRushAdditionalCondition`（閾値−1 かつ L なし、ブレイカー判定を先に） |
| E6 | クロスの向き | ✅ `crossReductionFor` / `crossReducedNumber`（CN・分数SP分母を減らす） |
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
