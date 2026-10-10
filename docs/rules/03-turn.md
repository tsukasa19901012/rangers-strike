# 03 ターンの流れ（フェイズ）

記法は [README](README.md#記法) を参照。照合状態はすべて `web未照合`。公式ルールのフェイズ解説ページ（rule_phase1-2 / 3 / 4）は未取得のため、本章は atwiki と公式カードFAQに基づく。

---

## 1. ターン構造

#### R-TURN-01 5つのフェイズ [wiki] `web未照合`
ターンはスタート → チャージ → ラッシュ → バトル → エンドの5フェイズを順に行う。順番は入れ替えられない。ターンが終われば速やかに相手のターンが始まる。
- 出典: `atwiki/page-69`「フェイズの順番を前後させることはできない」、`atwiki/page-588`
- Web: https://w.atwiki.jp/renst/pages/69.html , https://w.atwiki.jp/renst/pages/588.html
- 実装: ✅

#### R-TURN-02 フェイズ内の行動順は自由 [公式] `web未照合`
各フェイズ中の行動に順序の制限はない（例: ラッシュ → オペレーション → ラッシュ）。
- 出典: `atwiki/page-69` Q1/A1「各フェイズ中の行動には、順序の制限はありません」
- Web: https://w.atwiki.jp/renst/pages/69.html

#### R-TURN-03 先攻1ターン目はチャージから [wiki] `web未照合`
R-SETUP-07 を参照。
- Web: https://w.atwiki.jp/renst/pages/264.html
- 実装: ✅

#### R-TURN-04 「このターン」の期間 [公式] `web未照合`
「このターン」は、そのテキストが有効になった時点から、ターンプレイヤーが「ターンエンド」を宣言するまで。どちらのプレイヤーのカードに付いた効果でも同じ。発動前の事象には遡らない（例: 発動前にホールドされていたコマンドには及ばない）。
- 出典: `atwiki/page-588` Q1/A1「ターンプレイヤーが「ターンエンド」と宣言するまでです」、`grnrngr/faq-card-2` RS-107 Q1
- Web: https://w.atwiki.jp/renst/pages/588.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html
- 実装: ❌ E4（相手ユニットに付いた「このターン」修正が残る）

#### R-TURN-05 ターンプレイヤー [wiki] `web未照合`
現在ターンを行っているプレイヤー。同時に起きた処理の順番を決める権利を持つ（R-SIM-01）。
- 出典: `atwiki/page-588`、`atwiki/page-2167`
- Web: https://w.atwiki.jp/renst/pages/2167.html

---

## 2. スタートフェイズ

#### R-START-01 3つの行程 [wiki] `web未照合`
次の3つを好きな順に、必ず行う。
1. ホールド状態の自軍コマンドをリリースする。
2. バトルエリアの自軍ユニットとビークルをすべてラッシュエリアに戻す（戻す順は任意。ライドしていないビークルも戻す）。
3. 山札から1枚ドローする。

すべて済んだらチャージフェイズへ進む。
- 出典: `atwiki/page-264`「スタートフェイズでは次の３つの行程を好きな順に必ず行う」、`atwiki/page-457` Q1/A1、`atwiki/page-141` Q9
- Web: https://w.atwiki.jp/renst/pages/264.html , https://w.atwiki.jp/renst/pages/457.html
- 実装: ✅

#### R-START-02 戻すことはラッシュではない [wiki] `web未照合`
スタートフェイズにバトルエリアからラッシュエリアへ戻すのはラッシュではない。ライド状態は維持される（R-KW-RIDE-05）。バトルエリア⇔ラッシュエリアの移動ではホールド状態も消えない（R-ZONE-04）。
- 出典: `atwiki/page-146`、`atwiki/page-141` Q1/A1、`atwiki/page-1512`
- Web: https://w.atwiki.jp/renst/pages/146.html

#### R-START-03 追加ドロー [公式] `web未照合`
通常ドローで引いたカードを手札に合わせた枚数が自軍ダメージ未満なら、続けてもう1枚だけドローしてよい（任意）。**1ターンに1度だけ**。
- 出典: `atwiki/page-264`「ドローしたカードを手札と合わせて、枚数が自軍ダメージの数値未満ならばもう一枚だけ続けてドローすることも出来る」、`atwiki/page-123` Q1/A1「いいえ。追加ドローは1ターンに1度だけです」
- Web: https://w.atwiki.jp/renst/pages/264.html , https://w.atwiki.jp/renst/pages/123.html
- [未確定] page-105 は「ダメージの枚数が手札を上回る」と判定時点を書き分けていない。「続けて」が通常ドロー直後に限るかも不明（02-D10）。
- 実装: ❌ E3（回数制限なし）。判定時点は通常ドロー後で page-264 と一致。

#### R-START-04 ドローの定義 [公式] `web未照合`
ドロー＝山札からカードを引いて手札に加えるまでの一連の操作。追加ドローや効果によるドローも「ドロー」で、「ドローするとき」の効果が誘発する。山札から直接捨てる・オモテにする・サーチする、「ひく」だけ（ダイノガッツ）はドローではない。
- 出典: `grnrngr/faq-card-1` RS-008「はい、発動します」、RS-027 Q3、`grnrngr/faq-card-2` RS-122、`atwiki/page-123`
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://w.atwiki.jp/renst/pages/123.html
- 実装: ❌ 05-D11（DSL/NC ドローに超電子頭脳が適用されない）

#### R-START-05 引けなければ敗北 [wiki] `web未照合`
ドローすべきときに引けなければ負け（R-WIN-03）。
- 出典: `atwiki/page-123`「山札からドローすべき時にカードが引けなければ負けとなる」
- Web: https://w.atwiki.jp/renst/pages/123.html
- 実装: ✅ スタートフェイズの通常ドロー。効果ドローは ❌ E2。

#### R-START-06 「フェイズ開始時」の効果 [wiki] `web未照合`
「あるフェイズの開始時」に発動する効果は、そのフェイズ中の行動を一切行う前に発動・解決する（R-TIME-06）。スタートフェイズでは3行程より前。
- 出典: `atwiki/page-1828`「フェイズ中の行動を一切行う前・行った後に発動及び解決を行う」
- Web: https://w.atwiki.jp/renst/pages/1828.html
- [未確定] 「ターン開始時」「スタートフェイズ時」と書かれたカード（ゲゲル、XG4 の入れ替え等）が3行程のどこで処理されるか。
- 実装: ❌ E17（ホールド中のコマンドがないと発動しない）

---

## 3. チャージフェイズ

#### R-CHARGE-01 1枚チャージ [wiki] `web未照合`
手札からカードを1枚選び、パワーゾーンかコマンドゾーンに置ける。1ターン1枚まで。置かなくてもよい。コマンドゾーンが5枚ならコマンドには置けない（R-ZONE-08）。
- 出典: `atwiki/page-145`「1ターンに置く事が出来るのは一枚だけ。無論、置かずに手札を維持することもできる」
- Web: https://w.atwiki.jp/renst/pages/145.html
- 実装: ✅

#### R-CHARGE-02 置くときの向き・状態 [wiki] `web未照合`
コマンドゾーンにはリリース状態、パワーゾーンにはオモテ向きで置く。
- 出典: `atwiki/page-1872`（「送る」場合の既定）、`atwiki/page-105`（ウラ向き＝ダメージ）
- Web: https://w.atwiki.jp/renst/pages/1872.html
- [未確定] チャージしたカードの向きの明文は保存資料にない（公式 rule_phase1-2 で確認）。
- 実装: ✅ オモテ向き／リリース

---

## 4. ラッシュフェイズ

#### R-RUSHPH-01 ラッシュフェイズの行動 [wiki] `web未照合`
手札からのユニット・ビークルのラッシュ（[04](04-rush.md)）、通常オペレーションの使用、常駐の配置。カウンター以外のオペレーションはこのフェイズのみ。
- 出典: `atwiki/page-516`、`atwiki/page-1828`「カウンター以外のオペレーションカードが使用できるのはラッシュフェイズのみ」
- Web: https://w.atwiki.jp/renst/pages/516.html , https://w.atwiki.jp/renst/pages/1828.html

---

## 5. バトルフェイズ

#### R-BATTLEPH-01 バトルフェイズの行動 [wiki] `web未照合`
ユニットのバトルエリアへの移動、アタック、ストライク（[05](05-battle-strike-damage.md)）。
- 出典: `atwiki/page-593`
- Web: https://w.atwiki.jp/renst/pages/593.html

---

## 6. エンドフェイズ

#### R-END-01 ターン終了 [wiki] `web未照合`
ターン終了を宣言して相手のターンに移る。「ターンを終えるとき」の効果はこのフェイズ中に処理し、「自軍エンドフェイズ」の効果はそれより先に処理する。手札上限による捨てる手順はない。
- 出典: `atwiki/page-155`「タイミングが「自軍エンドフェイズ」のテキストの場合は「ターンを終えるとき」のテキストよりも先に処理する」、`atwiki/page-122`
- Web: https://w.atwiki.jp/renst/pages/155.html
- [未確定] エンドフェイズの公式ステップ一覧（rule_phase4 等）。
- 実装: ✅

#### R-END-02 ターン終了処理は終えたプレイヤーのみ [公式] `web未照合`
「ターンを終えるとき」系の常駐（例: RS-030 アドベンチャー）は、ターンを終えたプレイヤーだけが処理する。
- 出典: `grnrngr/faq-card-1` RS-030 Q2
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
