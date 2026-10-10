# 05 バトルエリア・アタック・バトル・ストライク・ダメージ・コンビネーション・カウンター

記法は [README](README.md#記法) を参照。照合状態は 2026-10-10 取得のライブページ（`docs/rules/sources/web/`）で照合済み（R-BA-05 のみ照合対象の記述なし）。ライド／ライドオフは [07](07-keywords.md#ライド--ライドオフ--rc) を参照。

---

## 1. バトルエリアへ出る

#### R-BA-01 出る時期と義務 [公式] `web照合済(2026-10-10)`
ユニットは自軍バトルフェイズにラッシュエリアからバトルエリアに出られる。出ることは義務ではなく、出た後にアタックもストライクもしない（「なにもしない」）ことも選べる。
- 出典: `atwiki/page-593`、`atwiki/page-457` Q2/A2「「なにもしない」を選ぶこともできます」（公式FAQ リファレンス「バトルエリア」に同文）、公式ルール バトルフェイズ「移動させなくてもかまいません」
- Web: https://w.atwiki.jp/renst/pages/457.html , https://w.atwiki.jp/renst/pages/593.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html
- 実装: ✅

#### R-BA-02 並び順と配置位置 [公式] `web照合済(2026-10-10)`
新しく出たユニットはバトルエリアの一番右に置く（左から順に詰める）。並び順は左から数える。ライドオフしたビークルも数える。ビークルにライドしたまま出たユニットは、ビークルと合わせて1つの並び順を占め、ライドオフするとユニットはその右（次の番号）に並ぶ。並び順はライドオフするかしないかを選んだ後で確定する。
- 出典: `atwiki/page-141` Q10/A10「バトルエリアの一番右に置きます」、`atwiki/page-226`「数え方は左から順に」、`atwiki/page-141`「バトルエリアにある場合、ユニットと同様に並び順の個数に数えられる」、公式ルール バトルフェイズ「カードはバトルエリアの左から順に詰めておきます」、`grnrngr/faq-rider-1` RK-023「ビーグルにライドさせた…を4番目にバトルエリアに出し、ライドオフ…5番目に並ぶ」、`grnrngr/faq-card-4` RS-187「並び順が確定するのは、「ライドオフするかしないか」を選択した後」
- Web: https://w.atwiki.jp/renst/pages/141.html , https://w.atwiki.jp/renst/pages/226.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html , https://www.grnrngr.com/documents/rangersstrike/faq/rider_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_4.html
- 解決済み（旧[未確定]）: ライドしたまま（ライドオフ前）のペアは1枠（公式FAQ RK-023 / RS-187、2026-10-10 web確認）。
- 実装: ? 右端に追加（ライド中ペアの1枠扱いは未確認）

#### R-BA-03 出る制限は直前に判定 [wiki] `web照合済(2026-10-10)`
「バトルエリアに出られない」等の制限を持つユニットは、出る直前にその制限を満たさなければならない。バトルフェイズ外や敵軍ターン中に効果で出る場合も同じ。
- 出典: `atwiki/page-457`「バトルエリアに出る直前にその制限を満たさなければならない」
- Web: https://w.atwiki.jp/renst/pages/457.html
- 実装: ✅ 効果で出す経路（ファイブテクター・パワーバズーカの合体素材・デカグリーン・ピットインダイブ等）も `autoHoldForBattleEntry`（`rules/restrictions.ts`）で「ホールドしなければ出られない」「手札を捨てなければ出られない」を出る直前に満たす。満たせなければ出せない

#### R-BA-04 「可能なら出る」の判定 [公式] `web照合済(2026-10-10)`
「可能なら出る」「出さなければならない」は、ホールドできるコマンドがあれば「可能」とみなし、ホールドして出す義務がある。ホールドできなければ「出られない」。手札を捨てる条件も同様。
- 出典: `grnrngr/faq-card-1` RS-022、`grnrngr/faq-card-2` RS-097（RS-041 タイガーレンジャーの Q）、RS-090 Q1、RS-097 Q6、RS-108 Q2「手札を２枚捨てればバトルエリアに出ることは可能である」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html
- 実装: ✅ 「可能なら出る」の必須進入（`findMandatoryBattleEntries`）はホールドが必要なユニットも、リリース状態のコマンドで払えるなら含め、その battle_entry 支払いを合法手に出す。レッドレーサーの「ラッシュするとき可能なら」は必要ホールドを新たに払って出る（選択肢が無ければ自動）。効果で出される狼鬼は手札2枚を捨てて出る（捨てるカードは手札の先頭から自動）。ゼニボムは「次の相手ターン」に有効（`next_turn` スコープ）

#### R-BA-05 1ターンに出られる数 [未確定] `web未照合`
出られるユニット数の上限や、同じユニットの再進入の可否を定める記述は資料にない。効果でラッシュエリアに戻ったユニットはウイングで再アタックできる（R-KW-WING-04）。
- 確定方法: 公式ルール rule_phase3/4。（2026-10-10 web確認: 記載なし。rule_phase4 は「ラッシュエリアにあるユニットを１体選んでバトルエリアに移動」を繰り返す説明のみで、上限・再進入の記述はない）

---

## 2. アタックとバトル

#### R-ATK-01 アタック [公式] `web照合済(2026-10-10)`
アタック＝自軍ユニットで敵軍ユニットにバトルをしかけること。基本はバトルエリアのユニットから相手のバトルエリアのユニットへ（ウイング・マジイエロー等は例外）。バトルの相手はアタック宣言と同時に指定する。相手のバトルエリアにユニットがなければアタックを宣言できない。
- 出典: `atwiki/page-138`「自軍ユニットで敵軍ユニットにバトルをしかけること。（公式用語集ver1.0より）」、公式ルール バトルフェイズ「相手のバトルエリアにユニットがない場合、アタックを宣言できません」
- Web: https://w.atwiki.jp/renst/pages/138.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html

#### R-ATK-02 1体1行動 [公式] `web照合済(2026-10-10)`
バトルエリアのユニットは、アタックかストライクのどちらか1回を行えばそのターンの行動を終える。SP が1以上になる条件を満たすユニットはどちらかを選ぶ。
- 出典: `grnrngr/faq-card-1` RS-058 Q2「アタックかストライクのどちらかを行った時点で…ターン中にできる行動は終了します」、`atwiki/page-138`
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅

#### R-ATK-03 アタック時の効果の期間 [公式] `web照合済(2026-10-10)`
「アタックするとき」「アタックされるとき」の効果はアタックの処理（バトル）が終わった時点で終了する。「アタックするとき」に得た BP 上昇はそのバトルが終わるまで続く。
- 出典: `atwiki/page-138`、`grnrngr/faq-card-1` RS-019「「アタックしてバトルが終了するまで」を期限とする」
- Web: https://w.atwiki.jp/renst/pages/138.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-ATK-04 アタック対象とバトル対象は別 [公式] `web照合済(2026-10-10)`
隠流忍術などが変えるのはバトルの対象だけで、アタック対象を参照する条件はそのまま残る。
- 出典: `grnrngr/faq-card-1` RS-018 Q11「「隠流忍術」で変更されるのはバトルの対象のみです」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-ATK-05 「アタックするかわりに」 [公式] `web照合済(2026-10-10)`
アタックしてもよいタイミング（そのユニットが自軍バトルフェイズにアタックかストライクをまだしていない）であれば、相手のバトルエリアにアタック対象がいなくても、アタックする権利を失うかわりに「アタックするかわりに」の効果を発動できる。その効果はアタックとはみなさない（隠流忍術は使えない）。一般則は R-REPL-03。
- 出典: `atwiki/page-318`（RS-100 の公式Q&A A2「ルール整理後（※公式コラムvol44より抜粋）：…敵軍バトルエリアにユニットがいない（アタックする対象がいない）状態でも、アタックする権利を失う代わりに効果を発動することができる」、同注釈「Ａを行ってもよいタイミングであれば、Ａを行うことができなくても、Ａを行う権利を失うかわりに、Ｂを行うことができる」）、`grnrngr/faq-card-2` RS-106 Q4（アタックとはみなさない：「いいえ、できません」）
- Web: https://w.atwiki.jp/renst/pages/318.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_3.html , https://wikiwiki.jp/renst/エラッタ
- **注意:** ライブの公式カードFAQ（`grnrngr/faq-card-2` RS-100 Q2、RS-106 Q3・Q6、`grnrngr/faq-card-3` RS-135 の項のデカレッド Q）は 2026-10-10 時点でも「対象がいなければ（アタックできなければ）発動できない」のまま更新されていないが、これはルール整理**前**の裁定で、上記 page-318 の公式コラム vol44 抜粋により置き換えられている（README §1.2）。RS-106 デカレッドは読み替えにより「アタックできるとき」が条件なので、対象がいなければ発動できない（R-ERR-RS106。wikiwiki「エラッタ」も「ルール改正時に「～するかわりに」の処理ルールが明言された際、強力すぎるとして変更された」と記載）。
- 補足: `grnrngr/faq-card-4` RS-187 ゴーマ宮が配置されているとき、1番目に並ぶユニットとして出した RS-106／RS-100 は「アタックできる状態であれば、アタックしなければなりません」（ゴーマ宮の強制アタックが優先し、かわりに効果は使えない）。
- [未確定] 公式コラム vol44 の原文そのものは未取得（page-318 の抜粋・注釈で内容は確認済み）。
- 実装: ✅ RS-100／RS-307【超忍法・舞獅子】は CN を満たしてバトルエリアに出ると発動可能になり、バトルフェイズに「アタックするかわりに」（`use_juu_kun_do` アクション、`rules/juuKunDo.ts`）プレイヤーが選んで発動する（対象不要・山札に無くても可、アタック権を失う）。ゴーマ宮の強制アタック中は使えない（`gomaPalaceForcesAttack`。ストライク・パスも不可）

#### R-BTL-01 バトル [wiki] `web照合済(2026-10-10)`
2体の BP を比べ、低い方（同じなら両方）が撃破され捨札になる。アタックした側とされた側の区別はない。アタックを経ずに効果で直接バトルが起きることもある（その場合「アタックできない／されない」は関係しない）。
- 出典: `atwiki/page-592`「２体のユニットのＢＰを比べ、数値の低い方（同じなら両方）が撃破され、捨札になる」、公式ルール バトルフェイズ「BPが同じ値の時はお互いに撃破扱いになります」
- Web: https://w.atwiki.jp/renst/pages/592.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html
- 実装: ✅

#### R-BTL-02 相打ち [公式] `web照合済(2026-10-10)`
相打ちの2体は同時に撃破された扱い。互いに相手を撃破したことになる。その後の捨札処理と効果の順はターンプレイヤーが決める。
- 出典: `atwiki/page-1826`「２つのユニットは同時に撃破された扱いになる」、`grnrngr/faq-card-1` RS-018 Q12「まず同タイミングでお互いに「撃破」扱いになります」、`page-1974`（「バトルの結果が相打ちならゴーオンゴールドは敵軍ユニットを撃破したし、敵軍ユニットはゴーオンゴールドを撃破した事になる」）[Q&A]
- Web: https://w.atwiki.jp/renst/pages/1826.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://w.atwiki.jp/renst/pages/1974.html
- 実装: ✅ 05-D17 修正済み。相打ちで処理順により結果が変わるとき（プテラノドンとレスキューファイター等）、ターンプレイヤーに `simultaneous_order` の選択を開き、選んだユニットから処理する（`rules/operationCounters.ts` `processMutualDestruction`、Web UI は `EffectChoiceModal`、CPU は各順の結果を評価して選ぶ）。「撃破した」ことによる攻撃側の効果（一点突破等）は順番によらず解決する。

#### R-BTL-03 「勝っても撃破される」は撃破されたユニット自身の効果 [Q&A] `web照合済(2026-10-10)`
「敵軍ターン中、SP1以上のユニットとバトルしたとき勝っても撃破される」による撃破は、バトルで負けた撃破ではない。相手はそのユニットを撃破したことにならない。
- 出典: `page-1974`（ゴーオンゴールドの回答「ゴーオンゴールドが敵軍ユニットを撃破したことにはならない」）、`atwiki/page-1289` Q3（公式、レジスト不可。公式FAQ リファレンス「レジスト」に同文「「バトルに勝っても撃破される」の効果で撃破された場合は、レジストを発動することはできません」）
- Web: https://w.atwiki.jp/renst/pages/1974.html , https://w.atwiki.jp/renst/pages/1289.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html

---

## 3. BP

#### R-BP-01 BP の計算順 [公式] `web照合済(2026-10-10)`
同じタイミングの増減は「＋」→「－」の順で計算する。「～になる」（指定の値になる）効果が同時に存在するときはそれを最も優先し、増減の計算は行わない。「～になる」が複数あればタイミングに関わらず低い方を適用。BP は常にこの計算順で算出された値とする。
- 出典: 公式FAQ リファレンス「ＢＰの値を変化させる効果の計算順序は「＋」→「－」の順になります。また、同時に「指定の値になる」が存在する場合は、「指定の値になる」を最も優先し、計算は行われません」（`grnrngr/faq-rider-2` RK-154 ジークの回答に同文）、`atwiki/page-458`「ＢＰの値が「～になる」効果が適用される場合はこちらを優先し、以降のＢＰ増減効果はすべて無効になる」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/index.html , https://www.grnrngr.com/documents/rangersstrike/faq/rider_2.html , https://w.atwiki.jp/renst/pages/458.html
- 解決済み（旧[未確定]）: 「指定値 → ＋ → －」（指定値の後に増減を適用）とする旧資料の記述は誤り。公式リファレンスで「指定の値になる」が優先し増減は計算しないと確認（2026-10-10）。
- 実装: ✅ ミラージュビーム・RK-154【頭が高い！】の「指定の値になる」を最優先し、増減（超力・ビークル等）は計算しない（03-D6 解消）。RK-154 の「M ユニットを S ユニットにする」分岐は未対応（対象は S ユニットのみ）。

#### R-BP-02 BP0 はルールによる撃破 [wiki] `web照合済(2026-10-10)`
BP の最低値は500。効果で BP が0になったユニットは撃破される。これはルールによる撃破で、ユニットや効果による撃破とはみなさない。
- 出典: `atwiki/page-458`「効果によってＢＰが０になったユニットは撃破される。この撃破はルールによる撃破であり」
- Web: https://w.atwiki.jp/renst/pages/458.html
- 補足: `grnrngr/faq-rider-1` RK-046 オートバジンBM: ファイブテクターで出した BP500 の S ユニットが BP－500 されて BP0 になる場合でも「撃破されて捨札になるより先に」バトルになり、ストライクは無効になる（BP0 による撃破は、進行中のバトル発生より後に処理される）。
- 実装: ✅ 処理中の選択・バトル・離場反応が終わった時点で BP0 以下のユニットをルールで撃破する（`applyBpZeroRuleDestruction`、03-D7 解消）。ファイブテクターのバトルは BP0 撃破より先に行い、ストライクは無効。RK-046【バスターホイール】の BP-500 も実装。

---

## 4. ストライク・SP

#### R-STK-01 ストライクとダメージ量 [wiki] `web照合済(2026-10-10)`
ストライク＝バトルフェイズに相手プレイヤーへ直接攻撃すること。与えるダメージは SP の値（整数ならその数値。固定値の最高は4）。
- 出典: `atwiki/page-103`「ＳＰ…によって与えるダメージは異なる」、`atwiki/page-104`「記載が整数の場合はそのままダメージをその数値分与えることが出来る」「今のところ固定値の最高値は４」
- Web: https://w.atwiki.jp/renst/pages/103.html , https://w.atwiki.jp/renst/pages/104.html
- 実装: ✅ SP＝ダメージ（03-D2）

#### R-STK-02 SP「！」 [公式] `web照合済(2026-10-10)`
CN やテキストの効果で SP が決まる。有効期限は通常ターン終了時まで。SP を得る効果に発動タイミングの記載がなければ、自軍バトルフェイズ中にのみ発動できる。
- 出典: `atwiki/page-104`、`grnrngr/faq-card-1` RS-051 Q3「ストライクポイントを得る効果は、自軍バトルフェイズに発動できます」
- Web: https://w.atwiki.jp/renst/pages/104.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 補足: RS-051 Q3 は読み替え前テキストへの回答。R-ERR-RS051 の読み替え後は「自軍ターン中、これがバトルエリアに出たとき」に発動タイミングが書かれているため、この効果は自軍バトルフェイズにバトルエリアへ出たときに発動する（ルール仕様テストはこの状況で確認する）。
- 実装: ✅ RS-051（エラッタ後の進入時効果）・RS-043 は自軍ターン中の進入時、RS-042 は自軍バトルフェイズの進入時に発動（`canRunEnterBattleConditionalEffect`）。タイミング記載のない SP 獲得効果を、進入時以外の自軍バトルフェイズ中に起動する手段は未実装。

#### R-STK-03 分数 SP [公式] `web照合済(2026-10-10)`
「1/2」等は、分母と同じ並び順にある間は常に SP1。並び順が変わるたびに更新され、敵軍ターン中も有効。NC ではなく、分母はナンバー（CN）でもない。ラッシュエリアにある間は SP1 でも SP！でもない。「SP1以上」として扱うのは SP1 になっているときだけで、「SP！」とは同一視しない。
- 出典: `atwiki/page-104` Q1〜Q5「分母の数字と同じ順番に並んでいれば、常に「SP1」として扱います」、`grnrngr/faq-card-1` RS-065 Q1「分数表記のＳＰは「ＳＰ！」と同一には扱いません」、`grnrngr/faq-card-2` RS-097 Q1
- Web: https://w.atwiki.jp/renst/pages/104.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html

#### R-STK-04 SP 空欄 [wiki] `web照合済(2026-10-10)`
SP 空欄はテキスト上 SP0。SP を得ている間は「SP 空欄」の対象から外れる。SP の「なる」は最低値固定ではなく変動を受け付け、同時の SP 変動はターンプレイヤーが順を決めて適用する。
- 出典: `atwiki/page-104`「SPが変動する効果が同時に複数発生した場合は、ユニットの状態を参照するたびにターンプレーヤーが順番を決めて適用する」
- Web: https://w.atwiki.jp/renst/pages/104.html

#### R-STK-05 ストライクを無効にしてバトルさせる効果 [公式] `web照合済(2026-10-10)`
RS-014 ファイブテクター等はストライクを無効にしてバトルにするが、アタックにはならない（隠流忍術不可、「アタックしたとき」の修正も不適用）。
- 出典: `grnrngr/faq-card-1` RS-014 Q1「相手の宣言したストライクをアタックに変更する効果はありません」、RS-057 Q1「「アタックしたとき」ではないのでＢＰ修正されません」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

---

## 5. ダメージ

#### R-DMG-01 ダメージの表し方 [wiki] `web照合済(2026-10-10)`
パワーゾーンのウラ向きカード1枚が1点。
- 出典: `atwiki/page-105`「パワーゾーンにあるウラ向きのカード1枚につき1点として表される」
- Web: https://w.atwiki.jp/renst/pages/105.html
- 実装: ✅ ダメージを受けたときはウラ向き枚数以上、効果でダメージをオモテにしたとき（消火作業等）はカウンタも減らし、ウラ向き枚数と一致させる（03-D8 解消）。

#### R-DMG-02 ダメージの受け方 [公式] `web照合済(2026-10-10)`
ダメージを受けるプレイヤーは、自分のパワーゾーンのオモテ向きカードから自由に選んで裏返す。なければ山札の上から1枚をウラ向きのままパワーゾーンに置く。ダメージにするカードを指定する効果もある。
- 出典: `atwiki/page-105`、`atwiki/page-109` Q1/A1「はい、自由に選ぶことができます」（公式FAQ リファレンス「パワーゾーン」に同文）、公式ルール バトルフェイズ「裏返しにできるカードがなければ、山札の上から１枚を裏向きのままパワーゾーンに置き１点とします」
- Web: https://w.atwiki.jp/renst/pages/105.html , https://w.atwiki.jp/renst/pages/109.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html
- [未確定] 山札が空の場合（R-WIN-05）。（2026-10-10 web確認: 記載なし。公式リファレンスは「カードを引くべきときに引けなかった場合にゲームに負けてしまいます」とするのみで、ダメージを山札から置けない場合には触れていない）

---

## 6. コンビネーション

#### R-CN-01 コンビネーションナンバー（CN） [wiki] `web照合済(2026-10-10)`
テキスト左端の表記。数字なら NC、「RC」ならライディングコンビネーション、「L」「R」ならジョイントコンビネーション。印刷値は1〜7。数字ナンバーが0なら CN 効果は発動不可。
- 出典: `atwiki/page-140`「カードに表記された数字のナンバーの最低値は1、最高値は7」「数字ナンバーが0のときはCN効果自体が発動不可能になる」
- Web: https://w.atwiki.jp/renst/pages/140.html

#### R-CN-02 NC の発動 [公式] `web照合済(2026-10-10)`
ユニットがバトルエリアに出たときの並び順（左から）が CN と一致すると発動する。発動は強制（「～してもよい」部分のみ任意）。カテゴリ・サイズが違っても成立する。
- 出典: `atwiki/page-226` Q1〜Q3「ナンバーコンビネーションの効果は、発動条件を満たした場合、必ず発動します」（公式FAQ リファレンス「ナンバーコンビネーション」に同文）、公式ルール バトルフェイズ「サイズの違うユニットが、途中にあってもコンビネーションは発動します」
- Web: https://w.atwiki.jp/renst/pages/226.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html

#### R-CN-03 NC は出た時点の並び順で判定 [公式] `web照合済(2026-10-10)`
先に出たユニットが離れていれば、次に出たユニットは1番目として数える。並び順が後から変わっても発動しない／無効にならない。撃破された後、別のユニットで再び発動できる。
- 出典: `atwiki/page-226` Q4〜Q6「コンビネーションナンバーをもつユニットがバトルエリアに出たときに発動する能力です」（公式FAQ リファレンスに同文）
- Web: https://w.atwiki.jp/renst/pages/226.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html

#### R-CN-04 コンビネーションは自軍バトルフェイズのみ [公式] `web照合済(2026-10-10)`
コンビネーション効果が発動するのは自軍バトルフェイズに出て並び順が確定したときだけ（「バトルエリアに出たとき」効果やライドオフの決定の後）。敵軍ターン中に効果でCNの位置に出されても（ファイブテクター等）NC は発動しない。
- 出典: `grnrngr/faq-card-1` RS-014 Q3「コンビネーションの効果を発動できるのは、自分のバトルフェイズになります」、`atwiki/page-267`、`grnrngr/faq-card-3` RS-135「ユニットのコンビネーションの効果は、その持ち主のバトルフェイズにのみ発動できます」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://w.atwiki.jp/renst/pages/267.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_3.html
- 補足: 自軍バトルフェイズ中であれば、相手の効果（RS-135 ジェットファルコン）でバトルエリアに出された自軍ユニットも「自分でバトルエリアに出したときと同じように扱」い、NC の条件が揃えば発動し、アタック／ストライクもできる（`grnrngr/faq-card-3` RS-141 紐男爵の Q）。
- 実装: ✅ NC はバトルフェイズに出たときだけ発動（03-D10 解消）。自軍バトルフェイズに相手の効果（ジェットファルコン等）で出された自軍ユニットは自分で出したのと同じに扱い、それまでバトル進入処理中だったユニットはアタックできない。

#### R-CN-05 コンビネーションの相手 [公式] `web照合済(2026-10-10)`
コンビネーションは直前に出たユニット（左隣）との間に成立する。「順番」と CN は別概念（コロンは CN を変えるが順番を変えない）。「本来のナンバー」は印刷値。
- 出典: `grnrngr/faq-card-1` RS-031 Q1「直前に出たユニット（左隣のユニット）との間に成立しています」、RS-001、RS-015 Q1「「カードに表記された本来のナンバー」だけです」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CN-06 NC 効果の期間 [公式] `web照合済(2026-10-10)`
期限の記載がなければターン終了時まで。発動元が撃破・並び順変化しても無効にならない。「コンビネーションが成立している間」と書かれたものは、一度でも隣り合わなくなれば無効。
- 出典: `atwiki/page-267`、`grnrngr/faq-card-1` RS-018 Q5、`grnrngr/faq-card-2` RS-110
- Web: https://w.atwiki.jp/renst/pages/267.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html

#### R-CN-07 NC とアタックは順に処理 [公式] `web照合済(2026-10-10)`
NC の適用とアタックは1つずつ処理する（NC でドローした後にアタックできる）。
- 出典: `grnrngr/faq-card-1` RS-059「ナンバーコンビネーションの適用とアタックは基本的にひとつづつ順番に処理します」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CN-08 CN の下限 [Q&A] `web照合済(2026-10-10)`
「2より少なくならない」とする減少効果で、CN1 が CN2 に上がることはない。
- 出典: `page-1974`「それらは2以上を減らすときに2で止まるという意味なので、1から増えることはない」
- Web: https://w.atwiki.jp/renst/pages/1974.html

---

## 7. カウンター

#### R-CTR-01 カウンター [wiki] `web照合済(2026-10-10)`
カウンターオペレーションは敵軍ターン中にのみ使用できる。使用にはコマンドのホールドが必要。使用タイミングはカードごと。
- 出典: `atwiki/page-1295`「これは敵軍ターン中にのみ使用できる」、`atwiki/page-260`、公式ルール ラッシュフェイズ「カウンターのテキストには、必ず発動条件が書いてあります」「カウンターを使う場合にも、コマンドをホールドする」
- Web: https://w.atwiki.jp/renst/pages/1295.html , https://w.atwiki.jp/renst/pages/260.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html
- 実装: ✅

#### R-CTR-02 同時に複数枚 [公式] `web照合済(2026-10-10)`
1回のアタック（ストライク）に対して、対応するカウンターを同時に2枚以上使ってよい。
- 出典: `grnrngr/faq-card-1` RS-018 Q1「はい、できます」（`grnrngr/faq-card-4` にも同じ Q）
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CTR-03 カウンター封じの期間 [公式] `web照合済(2026-10-10)`
「相手はカウンターを発動できない」（RS-033 バルパンサー）は、アタック宣言から自分の次の宣言までの間。
- 出典: `grnrngr/faq-card-1` RS-033「アタックを宣言してから、 自分の次の宣言のタイミングが来るまで」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
