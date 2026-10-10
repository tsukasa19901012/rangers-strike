# 02 ゾーン・カード・パワー・コマンド

記法は [README](README.md#記法) を参照。照合状態はすべて `web未照合`。

---

## 1. 場所（エリア・ゾーン）

#### R-ZONE-01 場所の一覧と総称 [公式] `web未照合`
- **エリア** = バトルエリア＋ラッシュエリア。
- **ゾーン** = パワーゾーン＋コマンドゾーン（公式 Q&A）。
- **場** = バトルエリア、ラッシュエリア、パワーゾーン、コマンドゾーン、常駐置き場。
- 場の外に山札・手札・捨札・除外がある。
- 出典: `atwiki/page-1517` Q1/A1「パワーゾーンとコマンドゾーンの両方を指した総称です」、`atwiki/page-1512`、`atwiki/page-591`
- Web: https://w.atwiki.jp/renst/pages/1517.html , https://w.atwiki.jp/renst/pages/1512.html , https://w.atwiki.jp/renst/pages/591.html

#### R-ZONE-02 カードは持ち主の領域から離れない [公式] `web未照合`
「パワーゾーンに送る」などで自軍・敵軍の指定がなければ、持ち主のゾーンに送る。
- 出典: `atwiki/page-1517` Q2/A2「基本的にカードはそのカードの持ち主の領域を離れることはありません」、`atwiki/page-1872`
- Web: https://w.atwiki.jp/renst/pages/1517.html , https://w.atwiki.jp/renst/pages/1872.html

#### R-ZONE-03 エリアのカードはユニット／ビークル [wiki] `web未照合`
エリアにオモテ向きで置かれたユニットカード・ビークルカードは、断り書きがない限りユニット・ビークルとして扱う。ユニットとユニットカードはルール上別物。
- 出典: `atwiki/page-1512`、`atwiki/page-137`「ユニットとユニットカードはルール上別のものとして扱われる」
- Web: https://w.atwiki.jp/renst/pages/1512.html , https://w.atwiki.jp/renst/pages/137.html

#### R-ZONE-04 エリア出入りで付加情報は消える [wiki] `web未照合`
エリアとエリア外の間を移動すると、BP 等の変動、追加された特徴・カテゴリ、ホールド/リリース状態、回数制限の使用履歴など、カードに本来書かれていない情報はすべて消える。バトルエリア⇔ラッシュエリアの移動では消えない。
- 出典: `atwiki/page-1512`「エリアとエリア以外の間をカードが移動した場合…すべて消える」
- Web: https://w.atwiki.jp/renst/pages/1512.html

#### R-ZONE-05 ラッシュエリア [wiki] `web未照合`
枚数制限なし、並び順の概念なし。特殊な能力を除き、ここのユニットにアタックすること、ここからアタック・ストライクすることはできない。
- 出典: `atwiki/page-147`「このエリアに置けるカードの枚数制限は無い。また、バトルエリアと違い並び順の概念は存在しない」
- Web: https://w.atwiki.jp/renst/pages/147.html
- 実装: ✅

#### R-ZONE-06 バトルエリア [公式] `web未照合`
アタック・ストライクをするにはバトルエリアに出る必要がある。並び順（左から数える）がコンビネーションに関わる。新しく出たユニットは一番右に置く。詳細は [05](05-battle-strike-damage.md)。
- 出典: `atwiki/page-457`、`atwiki/page-141` Q10/A10「バトルエリアの一番右に置きます」
- Web: https://w.atwiki.jp/renst/pages/457.html , https://w.atwiki.jp/renst/pages/141.html

#### R-ZONE-07 パワーゾーン [公式] `web未照合`
枚数上限なし。オモテ・ウラ・カテゴリに関係なく1枚につきパワー1。ウラ向きのカードがダメージ（R-DMG-01）。ウラ向きのカードは誰も見られない。表裏を保ったままの並べ替えはルール上可（マナーとして相手の了解を得る）。
- 出典: `atwiki/page-109` A2、A3「何枚でも置くことができます」、A4、本文
- Web: https://w.atwiki.jp/renst/pages/109.html

#### R-ZONE-08 コマンドゾーン [公式] `web未照合`
置けるのは5枚まで（ホールド数ではなく枚数の上限）。どんな種類のカードでも置ける。一度置いたカードは、カード効果以外で入れ替えられない。効果で5枚を超えて置かれるカードは捨札になる。
- 出典: `atwiki/page-108` A2、A3「5枚まで置くことができます。…5枚を越えて置かれるときは、そのカードは捨札になります」、`atwiki/page-151`
- Web: https://w.atwiki.jp/renst/pages/108.html , https://w.atwiki.jp/renst/pages/151.html
- [未確定] wiki 本文は「かわりに捨札」「発動できない」「捨ててから送る」など効果ごとに異なるとする。既定は捨札、テキストに指定があれば従う、と解釈する。
- 実装: ✅ 挙動は正しい（コメント・doc の「ホールド上限」は誤記、02-D8）

#### R-ZONE-09 送るときの向き・状態 [公式] `web未照合`
特に指定がなければ、コマンドゾーンへはリリース状態で、パワーゾーンへはオモテ向きで置く。送られたユニットはユニットカードになる（「ユニットでなくなるとき」に当たる）。疾風などで山札に戻すカードはウラ向き。
- 出典: `atwiki/page-108` Q1/A1、`atwiki/page-1872`、`grnrngr/faq-card-1` RS-024、RS-026 Q8
- Web: https://w.atwiki.jp/renst/pages/1872.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-ZONE-10 捨札 [公式] `web未照合`
オモテ向きで重ねて置く公開情報。順番は自由。尋ねられたら正しく答える。
- 出典: `atwiki/page-1287` Q1/A1
- Web: https://w.atwiki.jp/renst/pages/1287.html

#### R-ZONE-11 除外 [wiki] `web未照合`
XG1 から。捨札とは別に扱い、捨札への効果を受けない。公開情報。除外は撃破ではないので「撃破されるとき・されたとき」は発動しない。除外されたカードはそのゲーム中再びプレイに使えない。
- 出典: `atwiki/page-1970`（公式コラム引用「除外されたカードは、そのゲーム中再びプレイに使うことはできない」）
- Web: https://w.atwiki.jp/renst/pages/1970.html
- 実装: ? 除外からの復帰を許す関数あり（現状呼び出しなし、04-#34）

#### R-ZONE-12 常駐置き場 [公式] `web未照合`
常駐オペレーションを置く場所。各プレイヤー1枚まで（タッグは R-KW-TAG）。詳細は R-KW-PERM。
- 出典: `atwiki/page-1296` A2
- Web: https://w.atwiki.jp/renst/pages/1296.html

---

## 2. カードの種類・サイズ・カテゴリ

#### R-CARD-01 カードの種類 [wiki] `web未照合`
ユニットカード、ビークルカード、オペレーションカード（通常・常駐・カウンター）。コマンダーカードはデッキ外（R-DECK-07）。
- 出典: `atwiki/page-581`「常駐オペレーションと…通常のオペレーション、…カウンターオペレーションの3種類」、`atwiki/page-141`
- Web: https://w.atwiki.jp/renst/pages/581.html , https://w.atwiki.jp/renst/pages/141.html

#### R-CARD-02 オペレーションの使用時期 [wiki] `web未照合`
通常オペレーションと常駐の配置は自軍ラッシュフェイズのみ。カウンターは敵軍ターン中のみ（R-CTR-01）。通常オペレーションは使用後捨札（例外あり）。
- 出典: `atwiki/page-581`「通常オペレーションは自軍ラッシュフェイズにのみ使用可能」、`atwiki/page-1828`
- Web: https://w.atwiki.jp/renst/pages/581.html , https://w.atwiki.jp/renst/pages/1828.html

#### R-CARD-03 空撃ち [公式] `web未照合`
適正な対象がない（解決不能な）オペレーションも、コマンドのホールドや手札を減らす目的で使用できる。効果は発動せず、発動したものとして捨札にする。
- 出典: `atwiki/page-581` Q1/A1、`grnrngr/faq-card-1` RS-004
- Web: https://w.atwiki.jp/renst/pages/581.html
- 実装: ✅（05 整合項目）

#### R-CARD-04 ビークル [公式] `web未照合`
ユニットとは別物で、ユニットを対象にする効果を受けない。BP を持たず、アタックすることもされることもない。ライドされなければ基本的にバトルエリアに出られない。バトルエリアのビークルは並び順に数える。ライドしたユニットにビークルの特徴は追加されない。
- 出典: `atwiki/page-141` Q3〜Q5、本文
- Web: https://w.atwiki.jp/renst/pages/141.html

#### R-SIZE-01 ユニットサイズ [wiki] `web未照合`
S / M / L / XL / SC の5種類。SC は M とは別サイズで、M を対象にする効果を受けない。サイズによる枚数制限ルールはない（制限はカード効果による）。
- 出典: `atwiki/page-144`、`atwiki/page-1555`「Mユニットとは異なるサイズなので、当然Mユニットを対象にした効果は受けない」
- Web: https://w.atwiki.jp/renst/pages/144.html , https://w.atwiki.jp/renst/pages/1555.html

#### R-SIZE-02 ビークルサイズ [wiki] `web未照合`
S / M / L の3種類。RC を持つユニットは、指定がない限りサイズに関係なくライドできる。
- 出典: `atwiki/page-1550`
- Web: https://w.atwiki.jp/renst/pages/1550.html

#### R-CAT-01 カテゴリ [wiki] `web未照合`
5カテゴリ: ワイルドビースト（WB）、アーステクノロジー（ET）、オーバーテクノロジー（OT）、ミスティックアームズ（MA）、ダークアライアンス（DA）。基本は1枚1カテゴリ。
- 出典: `atwiki/page-70`、`atwiki/page-137`
- Web: https://w.atwiki.jp/renst/pages/70.html , https://w.atwiki.jp/renst/pages/137.html

#### R-CAT-02 マルチカテゴリ [公式] `web未照合`
- 手札から通常の手順で使うときは、持つ全カテゴリのコマンドが自軍コマンドゾーンにあり、そのうちいずれかのカテゴリのコマンドをホールドする。
- 効果によるラッシュではコマンドゾーンのカテゴリを参照しない（公式 Q&A）。
- コマンドゾーンのマルチカテゴリカードは、どのカテゴリのコマンドとしても使え、敵軍パワー1つ分として数える（カテゴリ数に関わらず1枚につき1）。効果でカテゴリが追加されたコマンドも同様。
- 常に全カテゴリを参照する（単一カテゴリとして扱えない）。
- 出典: `atwiki/page-1559` Q1/A1「カード効果などによるラッシュの場合は、自軍コマンドゾーンのカテゴリを参照する必要はありません」、本文
- Web: https://w.atwiki.jp/renst/pages/1559.html

---

## 3. パワー

#### R-POW-01 パワーの数 [wiki] `web未照合`
自軍パワー＝自軍パワーゾーンのカード枚数＋敵軍コマンドゾーンのマルチカテゴリカードの枚数。表裏は関係ない。「パワーゾーンの枚数」と「パワーの数」は一致しないことがある。
- 出典: `atwiki/page-110`「自軍のパワーは自軍パワーゾーンに置かれているカードの枚数と、敵軍コマンドゾーンに置かれているマルチカテゴリのカードの枚数で決まる」「カードの裏表は関係ない」
- Web: https://w.atwiki.jp/renst/pages/110.html
- 実装: ✅（02-D6）

#### R-POW-02 必要パワーは閾値 [公式] `web未照合`
必要パワーは消費するコストではなく閾値。自軍パワーがその数以上あればラッシュ・オペレーション使用ができる。効果で変動するが0未満にならず、上限はない。
- 出典: `atwiki/page-1721`（公式用語集の引用）「自軍パワーがこの数字の数以上なければ…できない」、`grnrngr/faq-card-1` RS-005
- Web: https://w.atwiki.jp/renst/pages/1721.html
- 実装: ✅

#### R-POW-03 追加条件による必要パワー0はラッシュの瞬間のみ [公式] `web未照合`
追加条件で必要パワーが0になるのはラッシュするそのときだけ。場に出た後は印刷どおりの値で扱う（例: RS-230 アバレッドAM は場では必要パワー7）。
- 出典: `grnrngr/faq-card-1` RS-027 Q2「追加条件で必要パワー０になるのは、ラッシュするそのときだけと考えてください」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅（ダイノガッツの枚数）

---

## 4. コマンド・ホールド・リリース

#### R-CMD-01 コマンドのホールド [wiki] `web未照合`
手札からユニットをラッシュする、またはオペレーションを使うときは、そのカードと同じカテゴリのコマンドをホールドする。ホールドしたコマンドは消費された扱いで、リリースされるまでそのまま。
- 出典: `atwiki/page-151`、`atwiki/page-157`
- Web: https://w.atwiki.jp/renst/pages/151.html , https://w.atwiki.jp/renst/pages/157.html

#### R-CMD-02 効果による使用ではホールド不要 [公式] `web未照合`
正規の手順でなく効果によってラッシュやオペレーション効果を使う場合、コマンドのホールドは不要（個別にホールドを要求するカードは例外）。
- 出典: `atwiki/page-151`、`grnrngr/faq-card-1` RS-005、RS-013「コマンドをホールドしなくてもラッシュエリアに出すことができます」
- Web: https://w.atwiki.jp/renst/pages/151.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CMD-03 ホールドするカテゴリの指定がない場合 [公式] `web未照合`
カテゴリの指定がないホールド要求は、どのカテゴリのコマンドでもよい。
- 出典: `grnrngr/faq-card-1` RS-051 Q1、RS-069 Q1
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CMD-04 コマンドの代わりにユニットを使う [wiki] `web未照合`
コール・リード等でユニットをコマンドとして使うのは使う瞬間だけの代用で、そのユニットはスタートフェイズにリリースされない。
- 出典: `atwiki/page-151`
- Web: https://w.atwiki.jp/renst/pages/151.html

#### R-HOLD-01 コマンドはスタートフェイズに強制リリース [wiki] `web未照合`
効果を受けていない限り、自軍コマンドは自軍スタートフェイズにすべてリリースされる。
- 出典: `atwiki/page-157`、`atwiki/page-158`「コマンドはスタートフェイズに強制的にリリースされるが、ユニットは何らかの効果を使わなければリリースできない」
- Web: https://w.atwiki.jp/renst/pages/157.html , https://w.atwiki.jp/renst/pages/158.html
- 実装: ✅

#### R-HOLD-02 ユニットのホールドは自動で解除されない [wiki] `web未照合`
ホールド状態のユニットはスタートフェイズにもリリースされず、リリース効果（ギルスレイダー、ウエイクアップ！等）がない限りユニットである間ずっとホールドのまま。ユニットでなくなれば（捨札・コマンド・パワー等）解除される。
- 出典: `atwiki/page-157`「ホールド状態のユニットはスタートフェイズになってもリリースされず」、`atwiki/page-1289`
- Web: https://w.atwiki.jp/renst/pages/157.html , https://w.atwiki.jp/renst/pages/1289.html
- 実装: ❌ E8（レジストのホールドがスタートフェイズに解除される）

#### R-HOLD-03 ホールド状態のユニットに制限はない [wiki] `web未照合`
ホールド状態でもユニットとしての働きに特に制限はない（バトルエリアに出る、ライド、コンビネーション可）。ただしホールドを必要とする能力（レジスト、ウイング等）は使えない。
- 出典: `atwiki/page-157`「ホールド状態でも特にユニットとしての働きに制限はない」、`atwiki/page-1289`「ライドオンやコンビネーションも当然可能」
- Web: https://w.atwiki.jp/renst/pages/157.html , https://w.atwiki.jp/renst/pages/1289.html
- [未確定] ホールド中のユニットがアタック・ストライクできるかの明文はない（ウイングはホールドしてアタックするので妨げないと読める）。
- 実装: ❌ E8（ホールド中は進入・ストライク不可にしている、04-#16）

#### R-HOLD-04 選択時点の状態 [公式] `web未照合`
効果の対象として選んだ時点で適正（リリース状態など）であれば、その後ホールドされても構わない。
- 出典: `grnrngr/faq-card-2` RS-076 Q3
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html
