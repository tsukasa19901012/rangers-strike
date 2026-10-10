# 02 ゾーン・カード・パワー・コマンド

記法は [README](README.md#記法) を参照。照合状態は 2026-10-10 取得のライブページ（`docs/rules/sources/web/`）で照合済み。

---

## 1. 場所（エリア・ゾーン）

#### R-ZONE-01 場所の一覧と総称 [公式] `web照合済(2026-10-10)`
- **エリア** = バトルエリア＋ラッシュエリア。
- **ゾーン** = パワーゾーン＋コマンドゾーン（公式 Q&A）。
- **場** = バトルエリア、ラッシュエリア、パワーゾーン、コマンドゾーン、常駐置き場。
- 場の外に山札・手札・捨札・除外がある。
- 出典: `atwiki/page-1517` Q1/A1「パワーゾーンとコマンドゾーンの両方を指した総称です」、`atwiki/page-1512`、`atwiki/page-591`
- Web: https://w.atwiki.jp/renst/pages/1517.html , https://w.atwiki.jp/renst/pages/1512.html , https://w.atwiki.jp/renst/pages/591.html

#### R-ZONE-02 カードは持ち主の領域から離れない [公式] `web照合済(2026-10-10)`
「パワーゾーンに送る」などで自軍・敵軍の指定がなければ、持ち主のゾーンに送る。
- 出典: `atwiki/page-1517` Q2/A2「基本的にカードはそのカードの持ち主の領域を離れることはありません」、`atwiki/page-1872`
- Web: https://w.atwiki.jp/renst/pages/1517.html , https://w.atwiki.jp/renst/pages/1872.html

#### R-ZONE-03 エリアのカードはユニット／ビークル [wiki] `web照合済(2026-10-10)`
エリアにオモテ向きで置かれたユニットカード・ビークルカードは、断り書きがない限りユニット・ビークルとして扱う。ユニットとユニットカードはルール上別物。
- 出典: `atwiki/page-1512`、`atwiki/page-137`「ユニットとユニットカードはルール上別のものとして扱われる」、`grnrngr/faq/index.html` リファレンス「「ユニット」と表記されているときは、バトルエリアかラッシュエリアにある「ユニットとして扱われているカード」を指します」（ゾーン等のカードは「～のカード」と表記）
- Web: https://w.atwiki.jp/renst/pages/1512.html , https://w.atwiki.jp/renst/pages/137.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html

#### R-ZONE-04 エリア出入りで付加情報は消える [wiki] `web照合済(2026-10-10)`
エリアとエリア外の間を移動すると、BP 等の変動、追加された特徴・カテゴリ、ホールド/リリース状態、回数制限の使用履歴など、カードに本来書かれていない情報はすべて消える。バトルエリア⇔ラッシュエリアの移動では消えない。
- 出典: `atwiki/page-1512`「エリアとエリア以外の間をカードが移動した場合…すべて消える」（BA⇔RA で消えない点は「エリアとエリア以外の間」という限定からの読み）、`grnrngr/faq-rider-2` RK-166「ユニットはユニットでなくなった時点で、ユニットとして持っていた情報はすべて失われる」（ホールド状態で送られたユニットが再ラッシュ時リリース状態）
- Web: https://w.atwiki.jp/renst/pages/1512.html , https://www.grnrngr.com/documents/rangersstrike/faq/rider_2.html

#### R-ZONE-05 ラッシュエリア [wiki] `web照合済(2026-10-10)`
枚数制限なし、並び順の概念なし。特殊な能力を除き、ここのユニットにアタックすること、ここからアタック・ストライクすることはできない。
- 出典: `atwiki/page-147`「このエリアに置けるカードの枚数制限は無い。また、バトルエリアと違い並び順の概念は存在しない」
- Web: https://w.atwiki.jp/renst/pages/147.html
- 実装: ✅

#### R-ZONE-06 バトルエリア [公式] `web照合済(2026-10-10)`
アタック・ストライクをするにはバトルエリアに出る必要がある。並び順（左から数える）がコンビネーションに関わる。新しく出たユニットは一番右に置く。詳細は [05](05-battle-strike-damage.md)。
- 出典: `atwiki/page-457`、`atwiki/page-141` Q10/A10「バトルエリアの一番右に置きます」
- Web: https://w.atwiki.jp/renst/pages/457.html , https://w.atwiki.jp/renst/pages/141.html

#### R-ZONE-07 パワーゾーン [公式] `web照合済(2026-10-10)`
枚数上限なし。オモテ・ウラ・カテゴリに関係なく1枚につきパワー1。ウラ向きのカードがダメージ（R-DMG-01）。ウラ向きのカードは誰も見られない。表裏を保ったままの並べ替えはルール上可（マナーとして相手の了解を得る）。
- 出典: `atwiki/page-109` A2、A3「何枚でも置くことができます」、A4、本文（同じQ&Aが `grnrngr/faq/index.html`「パワーゾーン」に公式掲載）
- Web: https://w.atwiki.jp/renst/pages/109.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html

#### R-ZONE-08 コマンドゾーン [公式] `web照合済(2026-10-10)`
置けるのは5枚まで（ホールド数ではなく枚数の上限）。どんな種類のカードでも置ける。一度置いたカードは、カード効果以外で入れ替えられない。効果で5枚を超えて置かれるカードは捨札になる。
- 出典: `atwiki/page-108` A2、A3「5枚まで置くことができます。…5枚を越えて置かれるときは、そのカードは捨札になります」（同文が `grnrngr/faq/index.html`「コマンドゾーン」と公式ルール `rule/rule_phase1-2.html` チャージフェイズに掲載）、`atwiki/page-151`
- Web: https://w.atwiki.jp/renst/pages/108.html , https://w.atwiki.jp/renst/pages/151.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html
- [未確定] wiki 本文は「かわりに捨札」「発動できない」「捨ててから送る」など効果ごとに異なるとする。既定は捨札、テキストに指定があれば従う、と解釈する。（2026-10-10 web確認: 一般則を覆す記載はないが、公式FAQ `faq/rider_1.html` RK-008 メカニック忍者は、アタックされたユニットを上限5枚のコマンドゾーンにホールド状態で置く処理について「アタックされたユニットはその場に留まります。実行できない処理は、処理の途中であってもその時点で終了」と裁定しており、場のユニットを送る効果では「捨札」ではなく「実行不能→その場に留まり以降のテキスト無効」となる例がある。また `faq/card_2.html` RS-076 ではコマンドゾーンが5枚でSユニットを送れなくても効果を発動できる。どの効果がどちらになるかの一般則は記載なし）
- 実装: ✅ 挙動は正しい（コメント・doc の「ホールド上限」は誤記、02-D8）

#### R-ZONE-09 送るときの向き・状態 [公式] `web照合済(2026-10-10)`
特に指定がなければ、コマンドゾーンへはリリース状態で、パワーゾーンへはオモテ向きで置く。送られたユニットはユニットカードになる（「ユニットでなくなるとき」に当たる）。疾風などで山札に戻すカードはウラ向き。
- 出典: `atwiki/page-108` Q1/A1、`atwiki/page-1872`「コマンドゾーンに送られる場合、特に指定がなければカードはリリース状態で置く。パワーゾーンに送られる場合、指定がなければオモテ向きで置く」、`grnrngr/faq-card-1` RS-024「オモテ向きに置きます」、RS-026「ウラ向きに置きます」
- Web: https://w.atwiki.jp/renst/pages/108.html , https://w.atwiki.jp/renst/pages/1872.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-ZONE-10 捨札 [公式] `web照合済(2026-10-10)`
オモテ向きで重ねて置く公開情報。順番は自由。尋ねられたら正しく答える。
- 出典: `atwiki/page-1287` Q1/A1（同文が `grnrngr/faq/index.html`「捨札」に公式掲載）
- Web: https://w.atwiki.jp/renst/pages/1287.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html

#### R-ZONE-11 除外 [wiki] `web照合済(2026-10-10)`
XG1 から。捨札とは別に扱い、捨札への効果を受けない。公開情報。除外は撃破ではないので「撃破されるとき・されたとき」は発動しない。除外されたカードはそのゲーム中再びプレイに使えない。
- 出典: `atwiki/page-1970`（公式コラム引用「除外されたカードは、そのゲーム中再びプレイに使うことはできない」）
- Web: https://w.atwiki.jp/renst/pages/1970.html
- 実装: ? 除外からの復帰を許す関数あり（現状呼び出しなし、04-#34）

#### R-ZONE-12 常駐置き場 [公式] `web照合済(2026-10-10)`
常駐オペレーションを置く場所。各プレイヤー1枚まで（タッグは R-KW-TAG）。詳細は R-KW-PERM。
- 出典: `atwiki/page-1296` A2「元々あったものを捨札にしてから配置します。常駐オペレーションは、各プレイヤーごとに1枚だけ配置できます」（同文が `grnrngr/faq/index.html`「常駐オペレーション」、公式ルール `rule/rule_phase3.html` にも記載）
- Web: https://w.atwiki.jp/renst/pages/1296.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html

---

## 2. カードの種類・サイズ・カテゴリ

#### R-CARD-01 カードの種類 [wiki] `web照合済(2026-10-10)`
ユニットカード、ビークルカード、オペレーションカード（通常・常駐・カウンター）。コマンダーカードはデッキ外（R-DECK-07）。
- 出典: `atwiki/page-581`「常駐オペレーションと…通常のオペレーション、…カウンターオペレーションの3種類」、`atwiki/page-141`
- Web: https://w.atwiki.jp/renst/pages/581.html , https://w.atwiki.jp/renst/pages/141.html

#### R-CARD-02 オペレーションの使用時期 [wiki] `web照合済(2026-10-10)`
通常オペレーションと常駐の配置は自軍ラッシュフェイズのみ。カウンターは敵軍ターン中のみ（R-CTR-01）。通常オペレーションは使用後捨札（例外あり）。
- 出典: `atwiki/page-581`「通常オペレーションは自軍ラッシュフェイズにのみ使用可能」、`atwiki/page-1828`
- Web: https://w.atwiki.jp/renst/pages/581.html , https://w.atwiki.jp/renst/pages/1828.html

#### R-CARD-03 空撃ち [公式] `web照合済(2026-10-10)`
適正な対象がない（解決不能な）オペレーションも、コマンドのホールドや手札を減らす目的で使用できる。効果は発動せず、発動したものとして捨札にする。
- 出典: `atwiki/page-581` Q1/A1（同文が `grnrngr/faq/index.html`「オペレーション」に公式掲載）、`grnrngr/faq-card-1` RS-004
- Web: https://w.atwiki.jp/renst/pages/581.html , https://www.grnrngr.com/documents/rangersstrike/faq/index.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅（05 整合項目）

#### R-CARD-04 ビークル [公式] `web照合済(2026-10-10)`
ユニットとは別物で、ユニットを対象にする効果を受けない。BP を持たず、アタックすることもされることもない。ライドされなければ基本的にバトルエリアに出られない。バトルエリアのビークルは並び順に数える。ライドしたユニットにビークルの特徴は追加されない。
- 出典: `atwiki/page-141` Q3〜Q5、本文
- Web: https://w.atwiki.jp/renst/pages/141.html

#### R-SIZE-01 ユニットサイズ [wiki] `web照合済(2026-10-10)`
S / M / L / XL / SC の5種類。SC は M とは別サイズで、M を対象にする効果を受けず、Mユニットのカードとしてサーチもできない。サイズによる枚数制限ルールはない（制限はカード効果による）。
- 出典: `atwiki/page-144`、`atwiki/page-1555`「Mユニットとは異なるサイズなので、当然Mユニットを対象にした効果は受けないがMユニットのカードとしてサーチもできない」（「枚数制限ルールはない」は該当ページに制限の記載がないことによる）
- Web: https://w.atwiki.jp/renst/pages/144.html , https://w.atwiki.jp/renst/pages/1555.html

#### R-SIZE-02 ビークルサイズ [wiki] `web照合済(2026-10-10)`
S / M / L の3種類。RC を持つユニットは、指定がない限りサイズに関係なくライドできる。
- 出典: `atwiki/page-1550`
- Web: https://w.atwiki.jp/renst/pages/1550.html

#### R-CAT-01 カテゴリ [wiki] `web照合済(2026-10-10)`
5カテゴリ: ワイルドビースト（WB）、アーステクノロジー（ET）、オーバーテクノロジー（OT）、ミスティックアームズ（MA）、ダークアライアンス（DA）。基本は1枚1カテゴリ。
- 出典: `atwiki/page-70`、`atwiki/page-137`
- Web: https://w.atwiki.jp/renst/pages/70.html , https://w.atwiki.jp/renst/pages/137.html

#### R-CAT-02 マルチカテゴリ [公式] `web照合済(2026-10-10)`
- 手札から通常の手順で使うときは、持つ全カテゴリのコマンドが自軍コマンドゾーンにあり、そのうちいずれかのカテゴリのコマンドをホールドする。
- 効果によるラッシュではコマンドゾーンのカテゴリを参照しない（公式 Q&A）。
- コマンドゾーンのマルチカテゴリカードは、どのカテゴリのコマンドとしても使え、敵軍パワー1つ分として数える（カテゴリ数に関わらず1枚につき1）。効果でカテゴリが追加されたコマンドも同様。
- 常に全カテゴリを参照する（単一カテゴリとして扱えない）。
- 通常のラッシュを補助する効果（ライドシューター等）ではコマンドゾーンのカテゴリ制限がかかる。コール・リードでユニットをコマンドとして使う場合も、コマンドゾーンに必要なカテゴリが揃っていなければ使用できない（page-1559 本文）。
- 出典: `atwiki/page-1559` Q1/A1「カード効果などによるラッシュの場合は、自軍コマンドゾーンのカテゴリを参照する必要はありません」、本文
- Web: https://w.atwiki.jp/renst/pages/1559.html

---

## 3. パワー

#### R-POW-01 パワーの数 [wiki] `web照合済(2026-10-10)`
自軍パワー＝自軍パワーゾーンのカード枚数＋敵軍コマンドゾーンのマルチカテゴリカードの枚数。表裏は関係ない。「パワーゾーンの枚数」と「パワーの数」は一致しないことがある。
- 出典: `atwiki/page-110`「自軍のパワーは自軍パワーゾーンに置かれているカードの枚数と、敵軍コマンドゾーンに置かれているマルチカテゴリのカードの枚数で決まる」「カードの裏表は関係ない」、公式ルール `rule/rule_phase3.html`「カードのカテゴリやウラ・オモテに関係なく置かれているカードの枚数だけをみます」
- Web: https://w.atwiki.jp/renst/pages/110.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html
- 実装: ✅（02-D6）

#### R-POW-02 必要パワーは閾値 [公式] `web照合済(2026-10-10)`
必要パワーは消費するコストではなく閾値。自軍パワーがその数以上あればラッシュ・オペレーション使用ができる。効果で変動するが0未満にならず、上限はない。
- 出典: `atwiki/page-1721`（公式用語集の引用）「自軍パワーがこの数字の数以上なければ…できない」、`grnrngr/faq-card-1` RS-005
- Web: https://w.atwiki.jp/renst/pages/1721.html
- 実装: ✅

#### R-POW-03 追加条件による必要パワー0はラッシュの瞬間のみ [公式] `web照合済(2026-10-10)`
追加条件で必要パワーが0になるのはラッシュするそのときだけ。場に出た後は印刷どおりの値で扱う（例: RS-230 アバレッドAM は場では必要パワー7）。
- 出典: `grnrngr/faq-card-1` RS-027 Q2「追加条件で必要パワー０になるのは、ラッシュするそのときだけと考えてください」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html
- 実装: ✅（ダイノガッツの枚数）

---

## 4. コマンド・ホールド・リリース

#### R-CMD-01 コマンドのホールド [wiki] `web照合済(2026-10-10)`
手札からユニットをラッシュする、またはオペレーションを使うときは、そのカードと同じカテゴリのコマンドをホールドする。ホールドしたコマンドは消費された扱いで、リリースされるまでそのまま。
- 出典: `atwiki/page-151`、`atwiki/page-157`
- Web: https://w.atwiki.jp/renst/pages/151.html , https://w.atwiki.jp/renst/pages/157.html

#### R-CMD-02 効果による使用ではホールド不要 [公式] `web照合済(2026-10-10)`
正規の手順でなく効果によってラッシュやオペレーション効果を使う場合、コマンドのホールドは不要（個別にホールドを要求するカードは例外）。
- 出典: `atwiki/page-151`、`grnrngr/faq-card-1` RS-005、RS-013「コマンドをホールドしなくてもラッシュエリアに出すことができます」
- Web: https://w.atwiki.jp/renst/pages/151.html , https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CMD-03 ホールドするカテゴリの指定がない場合 [公式] `web照合済(2026-10-10)`
カテゴリの指定がないホールド要求は、どのカテゴリのコマンドでもよい。
- 出典: `grnrngr/faq-card-1` RS-051 Q1、RS-069 Q1
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_1.html

#### R-CMD-04 コマンドの代わりにユニットを使う [wiki] `web照合済(2026-10-10)`
コール・リード等でユニットをコマンドとして使うのは使う瞬間だけの代用で、そのユニットはスタートフェイズにリリースされない。
- 出典: `atwiki/page-151`
- Web: https://w.atwiki.jp/renst/pages/151.html

#### R-HOLD-01 コマンドはスタートフェイズに強制リリース [wiki] `web照合済(2026-10-10)`
効果を受けていない限り、自軍コマンドは自軍スタートフェイズにすべてリリースされる。
- 出典: `atwiki/page-157`、`atwiki/page-158`「コマンドはスタートフェイズに強制的にリリースされるが、ユニットは何らかの効果を使わなければリリースできない」、`atwiki/page-264`「ホールド状態の自軍コマンドをリリースする」、公式ルール `rule/rule_phase1-2.html`「自分の場にホールド状態（ヨコ置き）のカードがあれば、すべてリリース状態（タテ置き）にします」
- Web: https://w.atwiki.jp/renst/pages/157.html , https://w.atwiki.jp/renst/pages/158.html , https://w.atwiki.jp/renst/pages/264.html , https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html
- 実装: ✅

#### R-HOLD-02 ユニットのホールドは自動で解除されない [wiki] `web照合済(2026-10-10)`
ホールド状態のユニットはスタートフェイズにもリリースされず、リリース効果（ギルスレイダー、ウエイクアップ！等）がない限りユニットである間ずっとホールドのまま。ユニットでなくなれば（捨札・コマンド・パワー等）解除される。
- 出典: `atwiki/page-157`「ホールド状態のユニットはスタートフェイズになってもリリースされず」、`atwiki/page-1289`
- Web: https://w.atwiki.jp/renst/pages/157.html , https://w.atwiki.jp/renst/pages/1289.html
- [未確定] 公式ルール `rule/rule_phase1-2.html` のスタートフェイズは「自分の場にホールド状態（ヨコ置き）のカードがあれば、すべてリリース状態」と書き、ユニットを除外していない。ただしこの記述はユニットのホールド概念（ライダーEXP vol.2 のレジスト）登場前の基本ルールで、atwiki page-157・page-264（スタートフェイズでリリースするのは「ホールド状態の自軍コマンド」）と、ユニットをリリースするカード（ギルスレイダー等）の存在から、本規定を維持する。公式の後発資料でユニットのホールド持続を明言したものは取得ページ中になし（2026-10-10 web確認）。
- 実装: ✅ E8 修正済み（スタートフェイズでラッシュエリアに戻してもユニットのホールドは続く。場を離れたカードのホールドは解除。`rules/resist.ts`）

#### R-HOLD-03 ホールド状態のユニットに制限はない [wiki] `web照合済(2026-10-10)`
ホールド状態でもユニットとしての働きに特に制限はない（バトルエリアに出る、ライド、コンビネーション可）。ただしホールドを必要とする能力（レジスト、ウイング等）は使えない。
- 出典: `atwiki/page-157`「ホールド状態でも特にユニットとしての働きに制限はない」、`atwiki/page-1289`「ライドオンやコンビネーションも当然可能」
- Web: https://w.atwiki.jp/renst/pages/157.html , https://w.atwiki.jp/renst/pages/1289.html
- [未確定] ホールド中のユニットがアタック・ストライクできるかの明文はない（ウイングはホールドしてアタックするので妨げないと読める）。（2026-10-10 web確認: 記載なし。page-1413（置き換え）にホールド状態のユニットがバトルエリアに存在する図例があるのみ）
- 実装: ✅ E8 修正済み（ホールド中もバトルエリアに出られる・コンビネーション可）。アタック・ストライクは [未確定] のため従来どおり不可のまま（`rules/restrictions.ts` `cannotAttackOrStrikeThisTurn`、`rules/combo.ts` `canStrikeUnit`）

#### R-HOLD-04 選択時点の状態 [公式] `web照合済(2026-10-10)`
効果の対象として選んだ時点で適正（リリース状態など）であれば、その後ホールドされても構わない。
- 出典: `grnrngr/faq-card-2` RS-076 Q3「選んだ時点で「RS-195ダイナマッハ」が適正な対象であれば、その後…ホールドされてもラッシュすることができます」
- Web: https://www.grnrngr.com/documents/rangersstrike/faq/card_2.html
