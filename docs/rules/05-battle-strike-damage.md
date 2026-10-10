# 05 バトルエリア・アタック・バトル・ストライク・ダメージ・コンビネーション・カウンター

記法は [README](README.md#記法) を参照。照合状態はすべて `web未照合`。ライド／ライドオフは [07](07-keywords.md#ライド--ライドオフ--rc) を参照。

---

## 1. バトルエリアへ出る

#### R-BA-01 出る時期と義務 [公式] `web未照合`
ユニットは自軍バトルフェイズにラッシュエリアからバトルエリアに出られる。出ることは義務ではなく、出た後にアタックもストライクもしない（「なにもしない」）ことも選べる。
- 出典: `atwiki/page-593`、`atwiki/page-457` Q2/A2「「なにもしない」を選ぶこともできます」
- Web: https://w.atwiki.jp/renst/pages/457.html , https://w.atwiki.jp/renst/pages/593.html
- 実装: ✅

#### R-BA-02 並び順と配置位置 [公式] `web未照合`
新しく出たユニットはバトルエリアの一番右に置く。並び順は左から数える。ライドオフしたビークルも数える。
- 出典: `atwiki/page-141` Q10/A10「バトルエリアの一番右に置きます」、`atwiki/page-226`「数え方は左から順に」、`atwiki/page-141`（ビークルも並び順に入る）
- Web: https://w.atwiki.jp/renst/pages/141.html , https://w.atwiki.jp/renst/pages/226.html
- [未確定] ライドしたまま（ライドオフ前）のペアを1枠と数えるか2枠か（03 §3-4）。
- 実装: ✅ 右端に追加

#### R-BA-03 出る制限は直前に判定 [wiki] `web未照合`
「バトルエリアに出られない」等の制限を持つユニットは、出る直前にその制限を満たさなければならない。バトルフェイズ外や敵軍ターン中に効果で出る場合も同じ。
- 出典: `atwiki/page-457`
- Web: https://w.atwiki.jp/renst/pages/457.html

#### R-BA-04 「可能なら出る」の判定 [公式] `web未照合`
「可能なら出る」「出さなければならない」は、ホールドできるコマンドがあれば「可能」とみなし、ホールドして出す義務がある。ホールドできなければ「出られない」。手札を捨てる条件も同様。
- 出典: `grnrngr/faq-card-1` RS-022、RS-041、`grnrngr/faq-card-2` RS-090 Q1、RS-097 Q6、RS-108 Q2
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html

#### R-BA-05 1ターンに出られる数 [未確定] `web未照合`
出られるユニット数の上限や、同じユニットの再進入の可否を定める記述は資料にない。効果でラッシュエリアに戻ったユニットはウイングで再アタックできる（R-KW-WING-04）。
- 確定方法: 公式ルール rule_phase3/4。

---

## 2. アタックとバトル

#### R-ATK-01 アタック [公式] `web未照合`
アタック＝自軍ユニットで敵軍ユニットにバトルをしかけること。基本はバトルエリアのユニットから相手のバトルエリアのユニットへ（ウイング・マジイエロー等は例外）。
- 出典: `atwiki/page-138`（公式用語集の引用）
- Web: https://w.atwiki.jp/renst/pages/138.html

#### R-ATK-02 1体1行動 [公式] `web未照合`
バトルエリアのユニットは、アタックかストライクのどちらか1回を行えばそのターンの行動を終える。SP が1以上になる条件を満たすユニットはどちらかを選ぶ。
- 出典: `grnrngr/faq-card-1` RS-058 Q2「アタックかストライクのどちらかを行った時点で…ターン中にできる行動は終了します」、`atwiki/page-138`
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅

#### R-ATK-03 アタック時の効果の期間 [公式] `web未照合`
「アタックするとき」「アタックされるとき」の効果はアタックの処理（バトル）が終わった時点で終了する。「アタックするとき」に得た BP 上昇はそのバトルが終わるまで続く。
- 出典: `atwiki/page-138`、`grnrngr/faq-card-1` RS-019
- Web: https://w.atwiki.jp/renst/pages/138.html

#### R-ATK-04 アタック対象とバトル対象は別 [公式] `web未照合`
隠流忍術などが変えるのはバトルの対象だけで、アタック対象を参照する条件はそのまま残る。
- 出典: `grnrngr/faq-card-1` RS-018 Q11
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-ATK-05 「アタックするかわりに」 [公式] `web未照合`
「アタックするかわりに」の効果は、アタックする権利があるとき（相手のバトルエリアに適切なユニットがいるとき）だけ使える。その効果はアタックとはみなさない（隠流忍術は使えない）。一般則は R-REPL-03。
- 出典: `grnrngr/faq-card-2` RS-100 Q2、RS-106 Q3・Q4・Q6「「アタックするかわりに」を発動条件とする「ジュウクンドー」の効果は発動できないと考えます」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html

#### R-BTL-01 バトル [wiki] `web未照合`
2体の BP を比べ、低い方（同じなら両方）が撃破され捨札になる。アタックした側とされた側の区別はない。アタックを経ずに効果で直接バトルが起きることもある（その場合「アタックできない／されない」は関係しない）。
- 出典: `atwiki/page-592`「２体のユニットのＢＰを比べ、数値の低い方（同じなら両方）が撃破され、捨札になる」
- Web: https://w.atwiki.jp/renst/pages/592.html
- 実装: ✅

#### R-BTL-02 相打ち [公式] `web未照合`
相打ちの2体は同時に撃破された扱い。互いに相手を撃破したことになる。その後の捨札処理と効果の順はターンプレイヤーが決める。
- 出典: `atwiki/page-1826`「２つのユニットは同時に撃破された扱いになる」、`grnrngr/faq-card-1` RS-018 Q12、`page-1974`（互いに撃破）[Q&A]
- Web: https://w.atwiki.jp/renst/pages/1826.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ? 順序選択 UI は一部未実装（05-D17）

#### R-BTL-03 「勝っても撃破される」は撃破されたユニット自身の効果 [Q&A] `web未照合`
「敵軍ターン中、SP1以上のユニットとバトルしたとき勝っても撃破される」による撃破は、バトルで負けた撃破ではない。相手はそのユニットを撃破したことにならない。
- 出典: `page-1974`（ゴーオンゴールドの回答）、`atwiki/page-1289` Q3（公式、レジスト不可）
- Web: https://w.atwiki.jp/renst/pages/1974.html

---

## 3. BP

#### R-BP-01 BP の計算順 [wiki] `web未照合`
同じタイミングの増減は「＋」→「－」の順で計算する。「～になる」効果が適用されるときはそれを優先し、以降の増減はすべて無効。「～になる」が複数あればタイミングに関わらず低い方を適用。
- 出典: `atwiki/page-458`「ＢＰの値が「～になる」効果が適用される場合はこちらを優先し、以降のＢＰ増減効果はすべて無効になる」
- Web: https://w.atwiki.jp/renst/pages/458.html
- [未確定] 「指定値 → ＋ → －」（指定値の後に増減を適用）とする旧資料の記述と矛盾。公式リファレンスFAQで要確認（03-D6）。
- 実装: ? ミラージュビーム上書きに修正を加算（03-D6）

#### R-BP-02 BP0 はルールによる撃破 [wiki] `web未照合`
BP の最低値は500。効果で BP が0になったユニットは撃破される。これはルールによる撃破で、ユニットや効果による撃破とはみなさない。
- 出典: `atwiki/page-458`「効果によってＢＰが０になったユニットは撃破される。この撃破はルールによる撃破であり」
- Web: https://w.atwiki.jp/renst/pages/458.html
- 実装: ❌ 03-D7（汎用処理なし）

---

## 4. ストライク・SP

#### R-STK-01 ストライクとダメージ量 [wiki] `web未照合`
ストライク＝バトルフェイズに相手プレイヤーへ直接攻撃すること。与えるダメージは SP の値（整数ならその数値。固定値の最高は4）。
- 出典: `atwiki/page-103`「ＳＰ…によって与えるダメージは異なる」、`atwiki/page-104`「記載が整数の場合はそのままダメージをその数値分与えることが出来る」
- Web: https://w.atwiki.jp/renst/pages/103.html , https://w.atwiki.jp/renst/pages/104.html
- 実装: ✅ SP＝ダメージ（03-D2）

#### R-STK-02 SP「！」 [公式] `web未照合`
CN やテキストの効果で SP が決まる。有効期限は通常ターン終了時まで。SP を得る効果に発動タイミングの記載がなければ、自軍バトルフェイズ中にのみ発動できる。
- 出典: `atwiki/page-104`、`grnrngr/faq-card-1` RS-051 Q3
- Web: https://w.atwiki.jp/renst/pages/104.html

#### R-STK-03 分数 SP [公式] `web未照合`
「1/2」等は、分母と同じ並び順にある間は常に SP1。並び順が変わるたびに更新され、敵軍ターン中も有効。NC ではなく、分母はナンバー（CN）でもない。ラッシュエリアにある間は SP1 でも SP！でもない。「SP1以上」として扱うのは SP1 になっているときだけで、「SP！」とは同一視しない。
- 出典: `atwiki/page-104` Q1〜Q5「分母の数字と同じ順番に並んでいれば、常に「SP1」として扱います」、`grnrngr/faq-card-1` RS-065 Q1、`grnrngr/faq-card-2` RS-097 Q1
- Web: https://w.atwiki.jp/renst/pages/104.html

#### R-STK-04 SP 空欄 [wiki] `web未照合`
SP 空欄はテキスト上 SP0。SP を得ている間は「SP 空欄」の対象から外れる。SP の「なる」は最低値固定ではなく変動を受け付け、同時の SP 変動はターンプレイヤーが順を決めて適用する。
- 出典: `atwiki/page-104`
- Web: https://w.atwiki.jp/renst/pages/104.html

#### R-STK-05 ストライクを無効にしてバトルさせる効果 [公式] `web未照合`
RS-014 ファイブテクター等はストライクを無効にしてバトルにするが、アタックにはならない（隠流忍術不可、「アタックしたとき」の修正も不適用）。
- 出典: `grnrngr/faq-card-1` RS-014 Q1、RS-057 Q1
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

---

## 5. ダメージ

#### R-DMG-01 ダメージの表し方 [wiki] `web未照合`
パワーゾーンのウラ向きカード1枚が1点。
- 出典: `atwiki/page-105`
- Web: https://w.atwiki.jp/renst/pages/105.html
- 実装: ❌ 03-D8（独立カウンタで管理し、ウラ向き枚数と乖離しうる）

#### R-DMG-02 ダメージの受け方 [公式] `web未照合`
ダメージを受けるプレイヤーは、自分のパワーゾーンのオモテ向きカードから自由に選んで裏返す。なければ山札の上から1枚をウラ向きのままパワーゾーンに置く。ダメージにするカードを指定する効果もある。
- 出典: `atwiki/page-105`、`atwiki/page-109` Q1/A1「はい、自由に選ぶことができます」
- Web: https://w.atwiki.jp/renst/pages/105.html , https://w.atwiki.jp/renst/pages/109.html
- [未確定] 山札が空の場合（R-WIN-05）。

---

## 6. コンビネーション

#### R-CN-01 コンビネーションナンバー（CN） [wiki] `web未照合`
テキスト左端の表記。数字なら NC、「RC」ならライディングコンビネーション、「L」「R」ならジョイントコンビネーション。印刷値は1〜7。数字ナンバーが0なら CN 効果は発動不可。
- 出典: `atwiki/page-140`
- Web: https://w.atwiki.jp/renst/pages/140.html

#### R-CN-02 NC の発動 [公式] `web未照合`
ユニットがバトルエリアに出たときの並び順（左から）が CN と一致すると発動する。発動は強制（「～してもよい」部分のみ任意）。カテゴリ・サイズが違っても成立する。
- 出典: `atwiki/page-226` Q1〜Q3「ナンバーコンビネーションの効果は、発動条件を満たした場合、必ず発動します」
- Web: https://w.atwiki.jp/renst/pages/226.html

#### R-CN-03 NC は出た時点の並び順で判定 [公式] `web未照合`
先に出たユニットが離れていれば、次に出たユニットは1番目として数える。並び順が後から変わっても発動しない／無効にならない。撃破された後、別のユニットで再び発動できる。
- 出典: `atwiki/page-226` Q4〜Q6「コンビネーションナンバーをもつユニットがバトルエリアに出たときに発動する能力です」
- Web: https://w.atwiki.jp/renst/pages/226.html

#### R-CN-04 コンビネーションは自軍バトルフェイズのみ [公式] `web未照合`
コンビネーション効果が発動するのは自軍バトルフェイズに出て並び順が確定したときだけ（「バトルエリアに出たとき」効果やライドオフの決定の後）。効果でCNの位置に出されても（ファイブテクター等）NC は発動しない。
- 出典: `grnrngr/faq-card-1` RS-014 Q3「コンビネーションの効果を発動できるのは、自分のバトルフェイズになります」、`atwiki/page-267`
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html , https://w.atwiki.jp/renst/pages/267.html
- 実装: ❌ 03-D10（RS-090 をラッシュフェイズに置くと NC が発動しうる）

#### R-CN-05 コンビネーションの相手 [公式] `web未照合`
コンビネーションは直前に出たユニット（左隣）との間に成立する。「順番」と CN は別概念（コロンは CN を変えるが順番を変えない）。「本来のナンバー」は印刷値。
- 出典: `grnrngr/faq-card-1` RS-031 Q1、RS-001、RS-015 Q1
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CN-06 NC 効果の期間 [公式] `web未照合`
期限の記載がなければターン終了時まで。発動元が撃破・並び順変化しても無効にならない。「コンビネーションが成立している間」と書かれたものは、一度でも隣り合わなくなれば無効。
- 出典: `atwiki/page-267`、`grnrngr/faq-card-1` RS-018 Q5、`grnrngr/faq-card-2` RS-110
- Web: https://w.atwiki.jp/renst/pages/267.html

#### R-CN-07 NC とアタックは順に処理 [公式] `web未照合`
NC の適用とアタックは1つずつ処理する（NC でドローした後にアタックできる）。
- 出典: `grnrngr/faq-card-1` RS-059
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CN-08 CN の下限 [Q&A] `web未照合`
「2より少なくならない」とする減少効果で、CN1 が CN2 に上がることはない。
- 出典: `page-1974`
- Web: https://w.atwiki.jp/renst/pages/1974.html

---

## 7. カウンター

#### R-CTR-01 カウンター [wiki] `web未照合`
カウンターオペレーションは敵軍ターン中にのみ使用できる。使用にはコマンドのホールドが必要。使用タイミングはカードごと。
- 出典: `atwiki/page-1295`「これは敵軍ターン中にのみ使用できる」、`atwiki/page-260`
- Web: https://w.atwiki.jp/renst/pages/1295.html
- 実装: ✅

#### R-CTR-02 同時に複数枚 [公式] `web未照合`
1回のアタック（ストライク）に対して、対応するカウンターを同時に2枚以上使ってよい。
- 出典: `grnrngr/faq-card-1` RS-018 Q1
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CTR-03 カウンター封じの期間 [公式] `web未照合`
「相手はカウンターを発動できない」（RS-033 バルパンサー）は、アタック宣言から自分の次の宣言までの間。
- 出典: `grnrngr/faq-card-1` RS-033
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
