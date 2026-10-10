# 03 ターンの流れ（フェイズ）

記法は [README](README.md#記法) を参照。2026-10-10 に取得したライブページ（公式ルール rule_tarn / rule_phase1-2 / rule_phase3 / rule_phase4、公式FAQ index / card_1〜6 / rider_1〜2、atwiki 各ページ）で全ルールを照合した。略記 `grnrngr/rule_phase1-2` 等は https://www.grnrngr.com/documents/rangersstrike/rule/ 配下、`grnrngr/faq-index` は https://www.grnrngr.com/documents/rangersstrike/faq/index.html を指す。

---

## 1. ターン構造

#### R-TURN-01 5つのフェイズ [wiki] `web照合済(2026-10-10)`
ターンはスタート → チャージ → ラッシュ → バトル → エンドの5フェイズを順に行う。順番は入れ替えられない。ターンが終われば速やかに相手のターンが始まる。
- 出典: `atwiki/page-69`「フェイズの順番を前後させることはできない」、`atwiki/page-588`「片方のターンが終了した場合、速やかにもう片方のターンが開始される」、`grnrngr/rule_tarn`（１～５のフェイズ）
- Web: https://w.atwiki.jp/renst/pages/69.html , https://w.atwiki.jp/renst/pages/588.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_tarn.html
- 実装: ✅

#### R-TURN-02 フェイズ内の行動順は自由 [公式] `web照合済(2026-10-10)`
各フェイズ中の行動に順序の制限はない（例: ラッシュ → オペレーション → ラッシュ）。
- 出典: `atwiki/page-69` Q1/A1・`grnrngr/faq-index`「フェイズ」「各フェイズ中の行動には、順序の制限はありません」
- Web: https://w.atwiki.jp/renst/pages/69.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html

#### R-TURN-03 先攻1ターン目はチャージから [公式] `web照合済(2026-10-10)`
先攻プレイヤーの1ターン目はスタートフェイズを飛ばし、チャージフェイズから始める。R-SETUP-07 も参照。
- 出典: `grnrngr/rule_phase1-2`「先攻１ターン目はスタートフェイズがスキップされ」、`atwiki/page-264`「先攻側は１ターン目のみ、このフェイズを飛ばしてチャージフェイズからの始まりとなる」
- Web: https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html , https://w.atwiki.jp/renst/pages/264.html
- 実装: ✅

#### R-TURN-04 「このターン」の期間 [公式] `web照合済(2026-10-10)`
「このターン」は、そのテキストが有効になった時点から、ターンプレイヤーが「ターンエンド」を宣言するまで。どちらのプレイヤーのカードに付いた効果でも同じ。発動前の事象には遡らない（例: 発動前にホールドされていたコマンドには及ばない）。
- 出典: `atwiki/page-588` Q1/A1・`grnrngr/faq-index`「ターン」「ターンプレイヤーが「ターンエンド」と宣言するまでです」、`grnrngr/faq-card-2` RS-107 Q1「その効果が発動した以降のターン中にのみ適用される」（RS-363 バルパンサー（2nd）の FAQ〔faq/card_6〕も同旨）
- Web: https://w.atwiki.jp/renst/pages/588.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html
- 実装: ✅ E4。`finalizeTurnEnd`（core/applyAction.ts）が「ターンを終えるとき」の効果をすべて処理した後に両プレイヤーの「このターン」修正を消し、ターンを1回だけ渡す。RS-107 ディースナイパーの「発動後のターン中」継続（デカブルーが場を離れた後のカウンター用ホールドを捨札）も ✅。

#### R-TURN-05 ターンプレイヤー [wiki] `web照合済(2026-10-10)`
現在ターンを行っているプレイヤー。同時に起きた処理の順番を決める権利を持つ（R-SIM-01）。
- 出典: `atwiki/page-588`「同時のタイミングに起こった処理の順番を決める権利がある」、`atwiki/page-2167`（止められない無限ループで優先する効果の決定権もターンプレイヤー。マルチカテゴリの処理順など例外あり）
- Web: https://w.atwiki.jp/renst/pages/588.html , https://w.atwiki.jp/renst/pages/2167.html

---

## 2. スタートフェイズ

#### R-START-01 3つの行程 [公式] `web照合済(2026-10-10)`
次の3つを好きな順に、必ず行う。
1. ホールド状態の自軍コマンドをリリースする。
2. バトルエリアの自軍ユニットとビークルをすべてラッシュエリアに戻す（戻す順は任意。ライドしていないビークルも戻す）。
3. 山札から1枚ドローする。

すべて済んだらチャージフェイズへ進む。戻す途中で誘発した効果を解決してから残りを戻してよい（RS-135/RS-097 の FAQ）。
- 出典: `grnrngr/rule_phase1-2`（ラッシュエリアに戻す・ホールド状態のカードをリリース・１枚ドローの3項目）、`atwiki/page-264`「スタートフェイズでは次の３つの行程を好きな順に必ず行う」、`atwiki/page-457` Q1/A1・`grnrngr/faq-index`「任意の順番で戻すことができます」、`atwiki/page-141` Q9、`grnrngr/faq-card-3` RS-135 Q（ジェットファルコンを戻して効果を解決してからハリケンレオンを戻す →「はい、できます」）
- Web: https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html , https://w.atwiki.jp/renst/pages/264.html , https://w.atwiki.jp/renst/pages/457.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_3.html
- 注: 公式 rule_phase1-2 は「自分の場にホールド状態（ヨコ置き）のカードがあれば、すべてリリース状態」と入門向けに広く書いているが、`atwiki/page-157`「ホールド状態のユニットはスタートフェイズになってもリリースされず」、`atwiki/page-151`・`page-158` によりリリースされるのはコマンドのみとする（R-HOLD-02）。
- 実装: ✅ `return_all_battle_to_rush`（rules/startPhase.ts）。`instanceId` 指定で1組（ライドの組は一緒）ずつ任意の順に戻せる。省略時は並び順で1組ずつ戻し、誘発した効果（RS-135【ファルコンクロー】等）の選択が開いたら中断し、解決後に残りを戻す（`pendingStartReturnQueue`）。CPU は省略形を使う。

#### R-START-02 戻すことはラッシュではない [wiki] `web照合済(2026-10-10)`
スタートフェイズにバトルエリアからラッシュエリアへ戻すのはラッシュではない。ライド状態は維持され（R-KW-RIDE-04）、このときライドオフはできない。バトルエリア⇔ラッシュエリアの移動ではホールド状態も消えない（R-ZONE-04）。
- 出典: `atwiki/page-146`「スタートフェイズでバトルエリアからラッシュエリアにユニットやビークルを戻すのはラッシュでは無い」、`atwiki/page-141` Q1/A1、`atwiki/page-1512`、`grnrngr/faq/rider`（ライドオフ）「いいえ、できません」
- Web: https://w.atwiki.jp/renst/pages/146.html , https://w.atwiki.jp/renst/pages/141.html , https://www.grnrngr.com/documents/rangersstrike/faq/rider.html
- 実装: ✅ 戻すのはラッシュとして扱わない（「ラッシュされたとき」は誘発しない）。ライド状態・ホールド状態はそのまま（`prepareRegisterUnitReturnedToRush`）。

#### R-START-03 追加ドロー [公式] `web照合済(2026-10-10)`
通常ドローをしたあとで、手札（引いたカードを含む）の枚数が自軍ダメージより少ないなら、もう1枚だけドローしてよい（任意）。**1ターンに1度だけ**。
- 出典: `grnrngr/rule_phase1-2`「ドローしたあとで、自分の手札の枚数が自分のダメージ（パワーゾーンのウラ向きカード）よりも少ないときは、追加でもう１枚ドローできる！（１ターンに１回まで）」、`atwiki/page-264`「ドローしたカードを手札と合わせて、枚数が自軍ダメージの数値未満ならばもう一枚だけ続けてドローすることも出来る」、`atwiki/page-123` Q1/A1・`grnrngr/faq-index`「追加ドローは１ターンに１度だけです」
- Web: https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html , https://w.atwiki.jp/renst/pages/264.html , https://w.atwiki.jp/renst/pages/123.html
- 判定時点は公式ルールにより「通常ドローの後」で確定（page-105 の「ダメージの枚数が手札を上回る」は同じ条件の別表現）。
- [未確定] 「続けて」（page-264）が通常ドロー直後に限るか、スタートフェイズ中の他の行程を挟んでよいか（02-D10）。（2026-10-10 web確認: 記載なし）
- 実装: ❌ E3（回数制限なし）。判定時点は通常ドロー後で公式ルールと一致。

#### R-START-04 ドローの定義 [公式] `web照合済(2026-10-10)`
ドロー＝山札からカードを引いて手札に加えるまでの一連の操作。追加ドローや効果によるドローも「ドロー」で、「ドローするとき」の効果が誘発する。山札から直接捨てる・オモテにする・サーチする、「ひく」だけ（ダイノガッツ）はドローではない。
- 出典: `grnrngr/faq-card-1` RS-008 Q1「はい、発動します」・Q2「ドローは「カードをひいて手札に加えるまでの一連の操作」のことです」、RS-027、`grnrngr/faq-card-2` RS-122、`atwiki/page-123`
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html , https://w.atwiki.jp/renst/pages/123.html
- 実装: ❌ 05-D11（DSL/NC ドローに超電子頭脳が適用されない）

#### R-START-05 引けなければ敗北 [公式] `web照合済(2026-10-10)`
ドローすべきときに引けなければ負け（R-WIN-03）。ドローでなく「ひく」だけの効果（ダイノガッツ）でも、ひくべきときにひけなければ負け。
- 出典: `grnrngr/rule_phase1-2`「山札が無くドローできないときは、ゲームに負けてしまいます」、`atwiki/page-123`「山札からドローすべき時にカードが引けなければ負けとなる」、`grnrngr/faq-card-1` RS-027「カードをひくべきときにひけなかった場合はゲームに負けてしまいます」
- Web: https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html , https://w.atwiki.jp/renst/pages/123.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅ スタートフェイズの通常ドロー。✅ 効果ドロー（E2: `performDeckDraws`／`requestDrawFromDeck`）。✅ 「ひく」だけの効果も、ひけなければ敗北（`takeFromDeckTop`: RS-027 ダイノガッツ、RK-021/RK-078 クロックアップ。ダイノガッツは山札不足でも使用可。BK-010 の「1枚ドロー」も山札0で敗北）。残り: RS-174【リフトアップ】は効果を任意で発動する選択がないため、山札0では「ひく」部分を飛ばしたまま。

#### R-START-06 「フェイズ開始時」の効果 [wiki] `web照合済(2026-10-10)`
「あるフェイズの開始時」に発動する効果は、そのフェイズ中の行動を一切行う前に発動・解決する（R-TIME-06）。スタートフェイズでは3行程より前。一方、「自軍スタートフェイズに」行う（開始時と書かれていない）効果はフェイズ中の行動の一つで、3行程と好きな順に行える（例: 闇の戒律の選択はドロー後でもよい）。「スタートフェイズを終えるとき」の効果は3行程の後で、毎ターン発動できる。
- 出典: `atwiki/page-1828`「フェイズ中の行動を一切行う前・行った後に発動及び解決を行う」「効果を発動できるタイミングが「あるフェイズ中」である場合、そのフェイズ中の行動の一つとしてその効果を発動・使用できる」、`grnrngr/faq-card-5` RS-256「はい、ドローした後でもかまいません」、`grnrngr/faq-rider-2` RK-080「毎ターン1回ずつ発動できる」、`grnrngr/faq-rider-1` RK-042（相手がスタートフェイズにリリースした後、スタートフェイズを終えるときにホールド）
- Web: https://w.atwiki.jp/renst/pages/1828.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_5.html , https://www.grnrngr.com/documents/rangersstrike/faq/rider_2.html , https://www.grnrngr.com/documents/rangersstrike/faq/rider_1.html
- [未確定] 「ターン開始時」と書かれたカード（ゲゲル、XG4 の入れ替え等）が「スタートフェイズ開始時」と同じく3行程より前か。（2026-10-10 web確認: 記載なし。RK-081 ゲゲルの公式FAQはウラ向きで重ねる点のみ）
- 実装: ✅ E17 修正。ターンが替わってスタートフェイズに入った直後（3行程より前）に `applyStartPhaseBeginEffects`（XG4-049〜051 のターン開始時の入れ替え、RK-081 ゲゲルの判定）を処理する。ホールド中のコマンドの有無に依存しない。XG3-009 ミント【戦いの記録】は未実装（DSL が on_rush のまま）。

---

## 3. チャージフェイズ

#### R-CHARGE-01 1枚チャージ [公式] `web照合済(2026-10-10)`
手札からカードを1枚選び、パワーゾーンかコマンドゾーンに置ける。1ターン1枚まで。置かなくてもよい。コマンドゾーンが5枚ならコマンドには置けない（R-ZONE-08）。
- 出典: `grnrngr/rule_phase1-2`「１ターンに１枚だけです。しなくても構いません」「コマンドゾーンには５枚までカードを置くことができます」、`atwiki/page-145`「1ターンに置く事が出来るのは一枚だけ。無論、置かずに手札を維持することもできる」
- Web: https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html , https://w.atwiki.jp/renst/pages/145.html
- 実装: ✅

#### R-CHARGE-02 置くときの向き・状態 [公式] `web照合済(2026-10-10)`
チャージするカードは必ずオモテ向きに置く。コマンドゾーンにはリリース状態で置く。
- 出典: `grnrngr/rule_phase1-2`「カードは必ずオモテ向きに置きます」、`grnrngr/faq-index`「ゾードアップ」「チャージフェイズにカードを置く時と同じように、カードを置く場所のルールに従って置いてください」（コマンドゾーンへ送るカードはリリース状態）、`atwiki/page-1872`
- Web: https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html , https://w.atwiki.jp/renst/pages/1872.html
- 向きは公式ルールで確定。リリース状態は公式FAQからの推論（チャージ時を基準にリリースで置く旨）で、チャージ自体について「リリース状態」と書いた明文はない。
- 実装: ✅ オモテ向き／リリース

---

## 4. ラッシュフェイズ

#### R-RUSHPH-01 ラッシュフェイズの行動 [wiki] `web照合済(2026-10-10)`
手札からのユニット・ビークルのラッシュ（[04](04-rush.md)）、通常オペレーションの使用、常駐の配置。カウンター以外のオペレーションはこのフェイズのみ。
- 出典: `atwiki/page-516`「ユニット、ビークルのラッシュとオペレーションの使用ができる」、`atwiki/page-1828`「カウンター以外のオペレーションカードが使用できるのはラッシュフェイズのみ」、`grnrngr/rule_phase3`「自分のラッシュフェイズに手札から使用」（常駐も同じ）
- Web: https://w.atwiki.jp/renst/pages/516.html , https://w.atwiki.jp/renst/pages/1828.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html

---

## 5. バトルフェイズ

#### R-BATTLEPH-01 バトルフェイズの行動 [wiki] `web照合済(2026-10-10)`
ユニットのバトルエリアへの移動、アタック、ストライク（[05](05-battle-strike-damage.md)）。
- 出典: `atwiki/page-593`「ユニットのバトルエリアへの移動、アタック及びストライクが行える」、`grnrngr/rule_phase4`
- Web: https://w.atwiki.jp/renst/pages/593.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html

---

## 6. エンドフェイズ

#### R-END-01 ターン終了 [wiki] `web照合済(2026-10-10)`
ターン終了を宣言して相手のターンに移る。「ターンを終えるとき」の効果はこのフェイズ中に処理し、「自軍エンドフェイズ」の効果はそれより先に処理する。「ターンを終えるとき」の時点はまだそのプレイヤーのターン中である。手札上限による捨てる手順はない。
- 出典: `atwiki/page-155`「タイミングが「自軍エンドフェイズ」のテキストの場合は「ターンを終えるとき」のテキストよりも先に処理する」、`grnrngr/faq-card-4` RS-238「「ターンを終えるとき」はまだ自分のターンです」、`grnrngr/faq-card-5` RS-310、`atwiki/page-122`・`grnrngr/faq-index`（手札上限なし）
- Web: https://w.atwiki.jp/renst/pages/155.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_4.html , https://w.atwiki.jp/renst/pages/122.html
- [未確定] エンドフェイズの公式ステップ一覧。（2026-10-10 web確認: 記載なし。公式ルールのエンドフェイズ項は rule_tarn.html#5 へのリンクのみで本文テキストがない）
- 実装: ✅ `finalizeTurnEnd`／`resolveTurnEndingEffectsImpl`（rules/turnEndingEffects.ts）。「ターンを終えるとき」の効果は phase "end"・終えるプレイヤーの手番のまま処理し、選択が開いたら `turnEndProgress` に進捗を残して止まり、解決後に続きから処理してからターンを渡す。RS-310 ゴウライビートルの撃破判定は「このターン」の修正込みで行う。残り: 同時に処理する効果の順序選択（RS-310 Q2）、「自軍エンドフェイズ」効果（闇の戒律等）は未実装。

#### R-END-02 ターン終了処理は終えたプレイヤーのみ [公式] `web照合済(2026-10-10)`
「ターンを終えるとき」系の常駐（例: RS-030 アドベンチャー）は、ターンを終えたプレイヤーだけが処理する。
- 出典: `grnrngr/faq-card-1` RS-030 Q2「いいえ。ターンを終えたプレイヤーのみ行います」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅ 自軍の常駐に加え、相手のアドベンチャーもターンを終えたプレイヤーが自分のコマンドで処理する。2枚あれば重複（rules/residentOperation.ts `collectTurnEndResidentQueue`）。
