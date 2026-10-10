# 04 ラッシュ

記法は [README](README.md#記法) を参照。2026-10-10 に取得したライブページ（`docs/rules/sources/web/`）で全ルールを照合済み。

---

## 1. ラッシュの定義

#### R-RUSH-01 ラッシュとは [公式] `web照合済(2026-10-10)`
エリア外にあったユニットカード／ビークルカードがエリア（ラッシュエリア・バトルエリア）に出ること。カードはエリアに出て初めてユニット・ビークルとして扱われる。効果による場合も含め、エリアに出ればすべて「ラッシュされた」扱い。
- 出典: `atwiki/page-146`「エリア以外の場所にあったカードがエリアに出た時は全て「ラッシュされた」として扱う」、`grnrngr/faq-card-1` RS-005 Q2「ユニットとして扱う場所（ラッシュエリアやバトルエリア）に置いたとき、「ラッシュした」と考えます」、RS-009
- Web: https://w.atwiki.jp/renst/pages/146.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅ 効果でエリアに出たユニットにもラッシュ記録を付ける（`finalizeEffectRush`、および applyAction 後処理 `settleEffectRushes` がエリア外から出たユニットを検出）

#### R-RUSH-02 ラッシュエリアを経由しないラッシュ [公式] `web照合済(2026-10-10)`
捨札などから直接バトルエリアに出た場合もラッシュ扱いで、ラッシュエリアは経由しない。
- 出典: `grnrngr/faq-card-1` RS-009 Q2「ラッシュされたとして扱います。ただし、ラッシュエリアを経由することはありません」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅ パワーバズーカの合体素材等、直接バトルエリアに出たユニットにもラッシュ記録を付ける

#### R-RUSH-03 ラッシュではないもの [wiki] `web照合済(2026-10-10)`
次はラッシュではない: スタートフェイズの戻し、場のユニットがビークルになる（またはその逆）こと、オペレーションの使用・配置。
- 出典: `atwiki/page-146`（「オペレーションの使用はラッシュでは無い」「スタートフェイズで…戻すのはラッシュでは無い」「…ビークルになったり、ビークルがユニットになったりすることはラッシュではない」）
- Web: https://w.atwiki.jp/renst/pages/146.html

#### R-RUSH-04 同名ユニットは複数出せる [公式] `web照合済(2026-10-10)`
同じ名前のユニットを複数場に出せる（ブレイカーは例外、R-KW-BREAKER-02）。
- 出典: `atwiki/page-146` Q1/A1「はい、出せます」
- Web: https://w.atwiki.jp/renst/pages/146.html

#### R-RUSH-05 ラッシュ時に適用中の修正 [wiki] `web照合済(2026-10-10)`
条件に当てはまるユニットを修正する継続効果が適用中なら、ユニットは最初から修正済みの状態でラッシュされたものとして扱う。「ラッシュしたとき」に上昇する効果はラッシュの瞬間には未適用。
- 出典: `atwiki/page-146`（恐竜やのカレー／仮面ライダーアギトの例）
- Web: https://w.atwiki.jp/renst/pages/146.html
- 実装: ✅ RS-179 恐竜やのカレーの BP+2000 はラッシュの瞬間から反映（疾風流超忍法の BP 判定にも適用）

---

## 2. 通常のラッシュ（手札から）

#### R-RUSH-10 時期 [wiki] `web照合済(2026-10-10)`
自軍ラッシュフェイズに、コマンドを消費して手札のユニット・ビークルをラッシュできる。
- 出典: `atwiki/page-146`「基本的にラッシュフェイズにコマンドを消費して手札のカードをラッシュできる」、`atwiki/page-516`、公式ルール rule_phase3「自分の手札からユニットカードを選んで場に出すことができます（これをラッシュといいます）」（ラッシュエリアにリリース状態で配置）
- Web: https://w.atwiki.jp/renst/pages/146.html , https://w.atwiki.jp/renst/pages/516.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html

#### R-RUSH-11 手順 [公式] `web照合済(2026-10-10)`
1. 必要パワーと追加条件を満たせるか確認する（R-POW-02）
2. 必要なコマンドをホールドする（R-CMD-01、マルチは R-CAT-02）
3. 追加条件を実行する
4. ユニットをラッシュする（ラッシュエリアに置く）

途中でコマンドやパワーの数が変わっても、該当手順を済ませていればラッシュは続行される。
- 出典: `atwiki/page-146` Q3/A3（2010/10/25修正）「「必要パワーと追加条件の確認（それぞれ満たせるかどうか）」→「必要なコマンドをホールドする」→「追加条件の実行」→「ユニットのラッシュ」」
- Web: https://w.atwiki.jp/renst/pages/146.html
- 実装: ✅ パワー判定は追加条件実行前の状態で行う（アブレラ【闇の取引】の補填も、ゾード素材ウィザード・カテゴリ支払いの段階で `rushPowerBudget` により考慮）

#### R-RUSH-12 追加条件で置くのはラッシュエリア [公式] `web照合済(2026-10-10)`
追加条件にバトルエリアのユニットを使っても、ラッシュするユニットはラッシュエリアに置く。
- 出典: `grnrngr/faq-card-2` RS-090「ラッシュするユニットはラッシュエリアに配置します」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html

---

## 3. 追加条件

#### R-ADD-01 追加条件の性質 [公式] `web照合済(2026-10-10)`
追加条件は必要パワーを満たした上での「追加のラッシュ条件」。追加条件の実行（例: パワーゾーンへ送る）で必要パワーを満たすことはできない。
- 出典: `atwiki/page-584` Q3/A3「追加条件は、必要パワーを満たした上での「追加のラッシュ条件」と考えてください」
- Web: https://w.atwiki.jp/renst/pages/584.html

#### R-ADD-02 「＋」と「－」 [wiki] `web照合済(2026-10-10)`
「＋」は手札からのラッシュ時に必ず満たす条件。「－」は任意で、満たすとパワー軽減などが得られる。
- 出典: `atwiki/page-586`「「＋」は手札からのラッシュ時に必ず満たさなければならない条件。「－」はラッシュ時に任意で満たすかどうか選択でき」、公式ルール rule_phase3（「＋」＝追加条件をもつユニット）
- 補足: 「－」のユニットも「追加条件を持つ」ユニットとして扱う（`grnrngr/faq-card-5` RS-318 Q3「カードの「追加条件」の欄に記述があるものは「追加条件を持つ」と考えて下さい」）。
- Web: https://w.atwiki.jp/renst/pages/586.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_5.html
- 実装: ✅ 「－」も「追加条件を持つ」として扱う（RS-318 出動指令の判定 `hasAdditionalCondition`）

#### R-ADD-03 「ユニット」指定 [公式] `web照合済(2026-10-10)`
追加条件の「ユニット」は、ユニットとして扱われているもの（自軍ラッシュエリア・バトルエリア）に限る。手札やゾーンのカードは不可。ライド中のユニットも選べる。
- 出典: `atwiki/page-146` Q2/A2、`atwiki/page-141` Q2/A2
- Web: https://w.atwiki.jp/renst/pages/146.html , https://w.atwiki.jp/renst/pages/141.html

#### R-ADD-04 「コマンドゾーンに送るか捨札」 [公式] `web照合済(2026-10-10)`
空きがあっても捨札を選べる。コマンドゾーンに送るカードはリリース状態で置く。
- 出典: `atwiki/page-584` Q1/A1「はい、できます」、Q2/A2「はい、リリース状態で置きます」
- Web: https://w.atwiki.jp/renst/pages/584.html
- 実装: ✅ 「2体をそれぞれ」はゾード素材ウィザードで必要体数分の素材を選ぶ（送り先は1回選択し全素材に適用。素材ごとに別の送り先を選ぶ UI は未対応）

#### R-ADD-05 捨てるはずのユニットが場に留まった場合 [wiki] `web照合済(2026-10-10)`
追加条件で捨札にするはずのユニットを何らかの方法で自軍エリアに留まらせると、追加条件を満たしたことにならない。
- 出典: `atwiki/page-586`
- Web: https://w.atwiki.jp/renst/pages/586.html

#### R-ADD-06 合体 [wiki] `web照合済(2026-10-10)`
「合体-」に列挙されたユニットを、すべて自軍エリアから捨札にする追加条件（エリア上のユニットに限る）。
- 出典: `atwiki/page-1841`「表記されたユニットを全て自軍エリアから捨札にすることで追加条件が満たされ」、`atwiki/page-146` Q2、公式ルール rule_phase3「捨札にする合体ユニットとは、テキストに書かれている「合体-」に続くユニット名を指します」
- Web: https://w.atwiki.jp/renst/pages/1841.html , https://w.atwiki.jp/renst/pages/146.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html

#### R-ADD-07 複数の「〜しなければ出られない」 [公式] `web照合済(2026-10-10)`
「〜しなければバトルエリアに出られない」制限が複数あれば、1つずつ別々に満たす（例: 稲妻重力エネルギー＋ティラノサウルスなら2ホールド）。同じ継続効果は枚数分重複（ハリケンレオン2体なら2ホールド）。
- 出典: `grnrngr/faq-card-1` RS-069 Q2・Q3（「制限はすべてひとつずつ解決します」）、RS-009 Q3（効果で捨札から出す場合も1体ごとにホールド）、`grnrngr/faq-card-2` RS-097 Q7
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html
- 実装: ✅ ※・稲妻重力エネルギー・ハリケンレオン（体数分）を `requiredBattleEntryHolds` で合算し、出る直前にリリース状態のコマンドを新たにホールドする（既にホールド済みのコマンドでは満たせない）。効果で出す場合も1体ごとに適用（`autoHoldForBattleEntry`）

#### R-ADD-08 追加条件の代替手段がある場合 [公式] `web照合済(2026-10-10)`
母艦（ジャガーバルカン、デカベースクローラー）などの代替手段で満たせるなら、強制の追加条件（人身略取）は満たさなければならない。母艦の置き換えは足りないSユニットの分だけに使える。
- 出典: `grnrngr/faq-card-2` RS-075、RS-076 Q1、RS-105
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html
- 実装: ✅ RS-322 人身略取: 相手は捨札にされたカードの追加条件を可能なら満たす。Sユニットが無い分は母艦（ジャガーバルカン等）のホールドで代える（`rules/abduction.ts`）

---

## 4. 効果によるラッシュ

#### R-RUSH-20 既定では条件不要 [公式] `web照合済(2026-10-10)`
「ラッシュフェイズの通常のラッシュ」以外では、特に指定がない限り必要パワー・追加条件・コマンドのホールド・マルチカテゴリのコマンド条件はいずれも不要。不要な追加条件を「あえて満たす」ことはできない。
- 出典: `atwiki/page-146`「特に指定がない限り必要パワー・追加条件を満たす必要は無く」、`atwiki/page-586`、`atwiki/page-1559` Q1/A1、`grnrngr/faq-card-2` RS-121「はい、できます」（必要パワー・追加条件を満たさなくてもラッシュ可）、`grnrngr/faq-card-1` RS-009 Q1・Q4、`grnrngr/faq-card-3` RS-170（RS-296 バラクティカの追加ラッシュについて）「「ラッシュエリアに出す」とある効果は、「追加条件を満たすこと」や「必要パワーを満たすこと」と書かれていなければ、テキストどおりラッシュの条件（追加条件、必要パワー）に関わらずラッシュエリアに出すことができる」、`grnrngr/faq-card-5` RS-318 Q1（ユニットの効果でラッシュエリアに出すとき「コマンドをホールドする必要はありません」）
- 補足: ここで不要になるのはラッシュのための通常のコマンドのホールドだけ。「〜しなければバトルエリアに出られない」制限（R-ADD-07）は効果でバトルエリアに出す場合にも適用される（`grnrngr/faq-card-1` RS-009 Q3、`grnrngr/faq-card-2` RS-097 Q2・Q6）。
- Web: https://w.atwiki.jp/renst/pages/146.html , https://w.atwiki.jp/renst/pages/586.html , https://w.atwiki.jp/renst/pages/1559.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_3.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_5.html
- 実装: ✅ 効果ラッシュではコマンドのホールド・必要パワー・追加条件を要求しない。RS-296 編隊出撃（手札のカードがラッシュエリアと捨札に重複していた不具合を修正。効果ラッシュでは再誘発しない）、RS-318 出動指令（敵軍 DA ユニットのラッシュで山札の上をオモテにし、追加条件の無い警察Sユニットならラッシュエリア、それ以外は手札）

#### R-RUSH-21 テキストで条件を課す場合 [公式] `web照合済(2026-10-10)`
カードに「ただし、ラッシュするための必要パワーと追加条件は満たすこと」とあれば、必要パワーと追加条件を満たす（コマンドのホールドは不要）。処理順は通常と同じ「必要パワー確認 → 追加条件 → 出す」。「－」の追加条件はこの場合も任意。
- 出典: RS-005 ランドバルカン本文（`atwiki/page-249`）、RS-013 シーロンの光本文（`atwiki/page-254`）、`grnrngr/faq-card-1` RS-005 Q3・RS-013 Q4「コマンドをホールドしなくてもラッシュエリアに出すことができます。ただし、選ばれたカードの「必要パワー」以上のカードが自軍パワーゾーンに置かれていることと、追加条件…があればそれを満たす必要があります」、`grnrngr/faq-card-2` RS-120、`grnrngr/faq-card-4` RS-197 Q4「「必要パワーを確認する」→「追加条件を満たす」→「ラッシュエリアに出す」の順で処理してください」、`atwiki/page-586`
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_4.html , https://w.atwiki.jp/renst/pages/586.html , https://w.atwiki.jp/renst/pages/249.html （RS-005 本文「ただし、ラッシュするための必要パワーと追加条件は満たすこと。」と公式 Q&A Q1〜Q3 の転載を確認）
- 実装: ✅ `rules/effectRush.ts`（`startEffectRush`, requireConditions）で「必要パワー確認 → 追加条件の実行（素材・送り先の選択）→ 出す」。接続済み: ランドバルカン（RS-005）、空輸搬送（RS-120）、パーツキャリアー（RS-197）。「－」は必要パワーを満たせば任意、満たせなければ実行して軽減

#### R-RUSH-22 効果ラッシュでも誘発とカウンター窓がある [公式] `web照合済(2026-10-10)`
効果でラッシュしたユニットにも「ラッシュしたとき」の効果は発動し、「ラッシュされたとき」のカウンターも発動できる。
- 出典: `grnrngr/faq-card-1` RS-005 Q2、RS-013 Q3「「ラッシュしたとき」の効果は発動しますし、「ラッシュされたとき」に発動できるカウンタを発動させることもできます」、`grnrngr/faq-card-2` RS-090 Q2、`grnrngr/faq-card-4` RS-197 Q1・Q3（効果で出したユニットの「ラッシュしたとき」は「はい、発動します」）
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_4.html
- 実装: ✅ E11 修正済み。共通処理 `finalizeEffectRush`（`events/emitUnitRushed.ts`）で通常ラッシュと同じ誘発とカウンター窓を開く（操作待ちがあれば `effectRushTriggerQueue` に積んで後で処理）。個別接続: ランドバルカン・空輸搬送・パーツキャリアー（`rules/effectRush.ts`）、コマンドゾーンから出す選択効果（遺跡発掘等）、捨札から出す選択効果、手札から出す選択効果（編隊出撃等）、出動指令、RS-284【スワンウィング】（敵軍コマンドゾーンの S ユニットを持ち主のラッシュエリアに同時に出す。2 体以上ならターンプレイヤーが処理順を選ぶ swan_wing_order（R-SIM-01、grnrngr/faq-card-5 RS-026「同時に発動した効果の処理順はターンプレイヤーが決定」）。窓には持ち主が応答し、RK-012・RS-026/RS-247 を使える。grnrngr/faq-rider-1 RS-284・RK-012、atwiki/page-472）。その他のカード個別処理が直接ラッシュエリアに置いた場合も、applyAction の後処理 `settleEffectRushes` がエリア外から出たユニットを検出して同じ処理を行う（モーフ等の置き換えは対象外）。レッドレーサーの「可能ならバトルエリアに置く」も効果ラッシュで処理

#### R-RUSH-23 複数体を出す効果は1体ずつ [公式] `web照合済(2026-10-10)`
「2枚まで選び、出してもよい」は、先に選んでから1枚ごとに「出してもよい」を実行する（1枚目にカウンターされたら2枚目を出さないことも可）。
- 出典: `grnrngr/faq-card-1` RS-005 Q1「「２枚まで選び」を実行してから、選んだ１枚ごとに「ラッシュエリアに出してもよい」を実行します」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅ 候補が上限を超えればプレイヤーが選び、選んだユニットを1体ずつ出す。1体ごとに誘発とカウンター窓を処理し、窓が閉じてから次を出す（`pendingEffectRush`）

#### R-RUSH-24 「このとき出したユニットの効果は発動しない」 [公式] `web照合済(2026-10-10)`
そのユニットの「ラッシュされたとき／ラッシュしたとき」タイミングの効果が使えないという意味で、効果全体の無効ではない。例: RS-121 で出した RS-090 は「ラッシュするとき可能ならバトルエリアに置く」に従わずラッシュエリアに置く。
- 出典: `atwiki/page-146`「そのユニットが持つ「ラッシュされたとき」のタイミングに発動する効果の使用ができないという意味」、`grnrngr/faq-card-2` RS-121 Q5・RS-090 Q6
- Web: https://w.atwiki.jp/renst/pages/146.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html

---

## 5. ラッシュへの応答

#### R-RUSH-30 「ラッシュされたとき」の窓 [公式] `web照合済(2026-10-10)`
「ラッシュされたとき」は、ラッシュしたユニット自身の「ラッシュしたとき」の効果とそれに誘発する処理をすべて終えてから、相手が次の宣言をするまでの間。非ターンプレイヤーはリリース状態のコマンドがあればカウンターをプレイできる。相手の確認なしにターンプレイヤーが先へ進めた場合は巻き戻しを要求できる。
- 出典: `grnrngr/faq-card-1` RS-026 Q6・Q7・Q10、RS-036
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅ 手動ラッシュ・効果ラッシュとも（誘発→モーフ→カウンター窓）。「ラッシュしたとき」の効果が選択待ちになった場合は、選択の解決後に窓を開く（`effectRushTriggerQueue` の windowOnly）
