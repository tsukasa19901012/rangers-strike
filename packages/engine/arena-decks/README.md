# 対戦台用のデッキ（スターター以外）

`scripts/cpu-arena.ts --decks`・`scripts/selfplay.ts --decks` に、ここにある `<id>.json` の id（ファイル名から `.json` を除いたもの）を渡せます。スターターの id と混ぜても使えます。形はスターターのデッキと同じ（`entries` にカード番号と枚数）です。

スターターはお試し用のデッキで、勝つために組まれたものではありません。CPU の強さは、勝つために組まれたデッキでも測るために置いています。

## 大会のデッキ（レシピそのまま、3 個）

[atwiki のデッキサンプル](https://w.atwiki.jp/renst/pages/225.html)のうち、カード名と枚数がそろっていたもの。カード番号は載っていないので、名前から直しました。同じ名前で効果の違うカード（疾風流超忍法 RS-026 と RS-247 など）は、そのデッキが使われた時期の版を選んでいます。

| id | デッキ | 時期 |
|---|---|---|
| `zero-one` | 01デッキ | 2007 秋 フェスティバル ガンスリンガー |
| `night-fever` | ナイトフィーバー | 2008 春 フェスティバル ガンスリンガー（上位の半数以上が使用） |
| `blue-yellow-rush` | 青黄速攻 | 2008 夏 ツアーフェスティバル チャンピオン大会 優勝 |

## 共有されたデッキ（1 個）

デッキ作りの「共有する」で短い URL にされたデッキ（`apps/web-pocket/scripts/list-shared-decks.mjs --arena` で書き出せます）。

| id | デッキ |
|---|---|
| `shared-BP7aNXyT` | 青単 加速カブトデッキ（/?d=BP7aNXyT） |

## atwiki のデッキサンプルから組んだデッキ（40 個）

残りのページには枚数がなく、「デッキの中核になるカード」「主な候補カード」「その他・候補カード」の一覧だけが載っています。そこで、次の決まりで 40 枚に組みました。大会で調整されたデッキほどの強さはありませんが、デッキのコンセプトどおりのカードがそろいます。

- 中核のカードを 3 枚ずつ、主な候補を 2 枚ずつ、その他の候補を 1 枚ずつ入れる。40 枚を超えるところで止める。
- 40 枚に届かなければ、主な候補・その他の候補の順に 3 枚まで増やす。
- 版の指定（「（XG3）」など）があればその版、「（2nd）」は 2 番目の版、指定がなければ最初の版。今のエンジンで動かない版や、「〜等の低コストビークル」のような説明の行は使わない。
- 「緑単色速攻・ハイランダー仕様」だけは、名前のとおり 1 枚ずつ 40 種。

| id | デッキ |
|---|---|
| `wiki-1707` | [赤青レスキューレーダー](https://w.atwiki.jp/renst/pages/1707.html) |
| `wiki-1709` | [青緑車両デッキ](https://w.atwiki.jp/renst/pages/1709.html) |
| `wiki-1722` | [Vコマレンオー](https://w.atwiki.jp/renst/pages/1722.html) |
| `wiki-1734` | [メレスラスターデッキ](https://w.atwiki.jp/renst/pages/1734.html) |
| `wiki-1874` | [赤緑メガヘラクレス](https://w.atwiki.jp/renst/pages/1874.html) |
| `wiki-1876` | [ディケイドCFデッキ](https://w.atwiki.jp/renst/pages/1876.html) |
| `wiki-2029` | [FFRデッキ](https://w.atwiki.jp/renst/pages/2029.html) |
| `wiki-1422` | [地球征服デッキ](https://w.atwiki.jp/renst/pages/1422.html) |
| `wiki-1716` | [赤黄激気](https://w.atwiki.jp/renst/pages/1716.html) |
| `wiki-1870` | [スーパー戦隊魂デッキ](https://w.atwiki.jp/renst/pages/1870.html) |
| `wiki-1420` | [青黒黄クライマックス刑事](https://w.atwiki.jp/renst/pages/1420.html) |
| `wiki-1731` | [緑青超電子ダイナモ](https://w.atwiki.jp/renst/pages/1731.html) |
| `wiki-2026` | [青単クロックアップ](https://w.atwiki.jp/renst/pages/2026.html) |
| `wiki-2027` | [赤単ミラーライダー](https://w.atwiki.jp/renst/pages/2027.html) |
| `wiki-2028` | [ディケイド・イン・ザ・ミラー](https://w.atwiki.jp/renst/pages/2028.html) |
| `wiki-744` | [シンプル戦闘員デッキ](https://w.atwiki.jp/renst/pages/744.html) |
| `wiki-1548` | [ドロー誘発デッキ](https://w.atwiki.jp/renst/pages/1548.html) |
| `wiki-1561` | [星獣合体デッキ](https://w.atwiki.jp/renst/pages/1561.html) |
| `wiki-1686` | [3色マルチJP](https://w.atwiki.jp/renst/pages/1686.html) |
| `wiki-1705` | [黄緑トリプルカウンター](https://w.atwiki.jp/renst/pages/1705.html) |
| `wiki-1706` | [青緑ハイビート](https://w.atwiki.jp/renst/pages/1706.html) |
| `wiki-1718` | [黄緑中速レスキューポリスデッキ](https://w.atwiki.jp/renst/pages/1718.html) |
| `wiki-1727` | [緑黒シザースマザー](https://w.atwiki.jp/renst/pages/1727.html) |
| `wiki-1728` | [侍コール](https://w.atwiki.jp/renst/pages/1728.html) |
| `wiki-1729` | [サイレンビルダー山札解体デッキ](https://w.atwiki.jp/renst/pages/1729.html) |
| `wiki-1732` | [赤緑プロジェクト呉越](https://w.atwiki.jp/renst/pages/1732.html) |
| `wiki-1730` | [黄青クウガUF](https://w.atwiki.jp/renst/pages/1730.html) |
| `wiki-1733` | [緑青ライジングイクサ](https://w.atwiki.jp/renst/pages/1733.html) |
| `wiki-1803` | [モーフダイデンジン](https://w.atwiki.jp/renst/pages/1803.html) |
| `wiki-1839` | [エンジンオーG12デッキ](https://w.atwiki.jp/renst/pages/1839.html) |
| `wiki-1959` | [赤黄速攻](https://w.atwiki.jp/renst/pages/1959.html) |
| `wiki-1975` | [Wのデッキ／夢の5色混合](https://w.atwiki.jp/renst/pages/1975.html) |
| `wiki-2018` | [赤緑ライフビート](https://w.atwiki.jp/renst/pages/2018.html) |
| `wiki-2019` | [青黒セイクウオー](https://w.atwiki.jp/renst/pages/2019.html) |
| `wiki-2030` | [赤黒戒律](https://w.atwiki.jp/renst/pages/2030.html) |
| `wiki-2315` | [ブラストテクター](https://w.atwiki.jp/renst/pages/2315.html) |
| `wiki-2360` | [青黒戒律](https://w.atwiki.jp/renst/pages/2360.html) |
| `wiki-2365` | [オーズとモーフと超電子レーダー](https://w.atwiki.jp/renst/pages/2365.html) |
| `wiki-2372` | [はい変わったー](https://w.atwiki.jp/renst/pages/2372.html) |
| `wiki-2251` | [緑単色速攻・ハイランダー仕様](https://w.atwiki.jp/renst/pages/2251.html) |

組めなかったもの（候補のカードが少なく 40 枚に届かない）: 01FFR（39 枚）、緑単ゴレンジャー（30 枚）、黄緑カラクリボール（39 枚）、ガトリングガイン（33 枚）、緑黄RCビート（36 枚）、赤単ミラワゼール（6 枚）、黒緑車両ン・マデッキ（39 枚）、緑黒ビッグワンパー（18 枚）、黄青アギトデッキ（12 枚）、緑赤コマ埋めビート（21 枚）、颯爽登場！！！三神合体！！！（39 枚）、緑黒ライオシンドローム（39 枚）。

## ブログ等のデッキ（91 個）

atwiki 以外のブログ・ファンサイトに、カード名と枚数がそろって載っていたデッキ（2026-10-25 に集めたもの）。出典は 蒼穹のメソウサガー（rabbitroar.exblog.jp）34、DuelPortal の「戦う力」シリーズ（tocage.jp）37、ameblo「種は種。」7、レンスト魂！ページ 12、カード・ブランチ 1。id は `blog-<出典>-<記事>`。

- カード名は記事の表記ゆれを直してカタログの名前に合わせました（隠流忍法→隠流忍術、ユガンテ→ユガンデ など）。版は atwiki のデッキと同じ決まり（「（XG3）」などの指定があればその版、「2nd」は 2 番目、指定がなければ最初の版）。
- カタログにないカード（ギンクロン、異次元からの友、ディケイドモモタロス）は抜き、40 枚に足りない分は 2 枚以下のカードを 1 枚ずつ増やしました。原文が 39 枚の `blog-rabbit-9424766` も同じように 40 枚にしています。41 枚・43 枚のデッキは原文どおりです。
- レンスト魂の運営デッキ（`blog-jimdo-*`）は大会の対戦用に運営が用意したものです。

| id | デッキ（時期・成績） |
|---|---|
| `blog-ameblo-10013270849` | [妄想デッキ 黄紫（2006-06-05）](https://ameblo.jp/usowoiwazuni-damasu/entry-10013270849.html) |
| `blog-ameblo-10013520714` | [緑単サンバルカンロボ（2006-06-11）](https://ameblo.jp/usowoiwazuni-damasu/entry-10013520714.html) |
| `blog-ameblo-10023546294` | [公認大会優勝デッキ（2007年1月）（2007-01-15 公認大会(3名)優勝）](https://ameblo.jp/usowoiwazuni-damasu/entry-10023546294.html) |
| `blog-ameblo-10038047298` | [赤黄青速攻 ver梅雨（2007-06-27 大会(6名)3勝1敗）](https://ameblo.jp/usowoiwazuni-damasu/entry-10038047298.html) |
| `blog-ameblo-10048739896` | [6弾 緑黒サンバルカン（2007-09-26）](https://ameblo.jp/usowoiwazuni-damasu/entry-10048739896.html) |
| `blog-ameblo-10051778139` | [緑黒サンバルカン（10月大会）（2007-10-20 大会(6名)2位）](https://ameblo.jp/usowoiwazuni-damasu/entry-10051778139.html) |
| `blog-ameblo-10063964391` | [電車デッキ（2008-01-05）](https://ameblo.jp/usowoiwazuni-damasu/entry-10063964391.html) |
| `blog-cbrunch-2010-01-05` | [気力張遼（コマンダー：ドギー・クルーガー）（2010-01-05）](http://c-brunch.jp/blog/2010/01/05/) |
| `blog-jimdo-bouken-winspector` | [ボウケンジャー＆ウインスペクター（2022-01-22）](https://rensutodamasi.jimdofree.com/2022/01/22/) |
| `blog-jimdo-ccrs-black` | [黒単（NOVA）（CCRS大会 運営デッキ）](https://rensutodamasi.jimdofree.com/レポート/レンスト超超非公認大会/) |
| `blog-jimdo-ccrs-bluegreen` | [青緑（涼）（CCRS大会 運営デッキ）](https://rensutodamasi.jimdofree.com/レポート/レンスト超超非公認大会/) |
| `blog-jimdo-ccrs-green` | [緑単（白くま）（CCRS大会 運営デッキ）](https://rensutodamasi.jimdofree.com/レポート/レンスト超超非公認大会/) |
| `blog-jimdo-gao` | [ガオレンジャーデッキ（2021-10-18）](https://rensutodamasi.jimdofree.com/2021/10/18/) |
| `blog-jimdo-kakure-black` | [カクレンジャー＆仮面ライダーBLACK（2022-01-22）](https://rensutodamasi.jimdofree.com/2022/01/22/) |
| `blog-jimdo-shinken` | [シンケンジャーデッキ（2022-01-05）](https://rensutodamasi.jimdofree.com/2022/01/05/) |
| `blog-jimdo-street-black` | [百鬼夜行の黒デッキ（ストリート・ストライカー 運営デッキ）](https://rensutodamasi.jimdofree.com/レポート/レンスト魂vsx/ストリート-ストライカー/) |
| `blog-jimdo-street-blue` | [三位一体の青デッキ（ストリート・ストライカー 運営デッキ）](https://rensutodamasi.jimdofree.com/レポート/レンスト魂vsx/ストリート-ストライカー/) |
| `blog-jimdo-street-green` | [捲土重来の緑デッキ（ストリート・ストライカー 運営デッキ）](https://rensutodamasi.jimdofree.com/レポート/レンスト魂vsx/ストリート-ストライカー/) |
| `blog-jimdo-street-red` | [疾風迅雷の赤デッキ（ストリート・ストライカー 運営デッキ）](https://rensutodamasi.jimdofree.com/レポート/レンスト魂vsx/ストリート-ストライカー/) |
| `blog-jimdo-street-yellow` | [鎧袖一触の黄デッキ（ストリート・ストライカー 運営デッキ）](https://rensutodamasi.jimdofree.com/レポート/レンスト魂vsx/ストリート-ストライカー/) |
| `blog-rabbit-10092956` | [青単速攻ハイパークロス（2008-11-08）](https://rabbitroar.exblog.jp/10092956/) |
| `blog-rabbit-10118656` | [黄単五神合体オン・サル・ニン（2008-11-12）](https://rabbitroar.exblog.jp/10118656/) |
| `blog-rabbit-10171998` | [黄単陰陽術速攻（2008-11-20）](https://rabbitroar.exblog.jp/10171998/) |
| `blog-rabbit-10251934` | [青単（タッチ黒）ネバーエンディングチェイス（2008-12-03）](https://rabbitroar.exblog.jp/10251934/) |
| `blog-rabbit-10317803` | [緑単弐式反応炉速攻（2008-12-12）](https://rabbitroar.exblog.jp/10317803/) |
| `blog-rabbit-11026231` | [赤青ゼクトロン（ライダー限定）（2009-03-05）](https://rabbitroar.exblog.jp/11026231/) |
| `blog-rabbit-11729931` | [青単機動忍者青影（2009-06-11）](https://rabbitroar.exblog.jp/11729931/) |
| `blog-rabbit-11751055` | [青単強烈王（2009-06-14）](https://rabbitroar.exblog.jp/11751055/) |
| `blog-rabbit-12247430` | [赤単激気ビートダウン（大阪大会仕様）（2009-09-02）](https://rabbitroar.exblog.jp/12247430/) |
| `blog-rabbit-12992214` | [青単デカウイングウィニー（2009-11-18）](https://rabbitroar.exblog.jp/12992214/) |
| `blog-rabbit-13832892` | [黄単ラージビート（2010-02-27）](https://rabbitroar.exblog.jp/13832892/) |
| `blog-rabbit-14043080` | [青単頑張王（コマンダー：ダップ）（2010-03-28）](https://rabbitroar.exblog.jp/14043080/) |
| `blog-rabbit-14051380` | [赤単(タッチ青黄)激気（コマンダー：ドン・ホラー）（2010-03-29（原文43枚））](https://rabbitroar.exblog.jp/14051380/) |
| `blog-rabbit-14561114` | [赤単タッチ青黄マックスハーレー（2010-06-10）](https://rabbitroar.exblog.jp/14561114/) |
| `blog-rabbit-14579819` | [赤単タッチ青黄激気（4〜5月）（2010-06-13）](https://rabbitroar.exblog.jp/14579819/) |
| `blog-rabbit-14610577` | [青単ドルギランビートダウン（2010-06-18）](https://rabbitroar.exblog.jp/14610577/) |
| `blog-rabbit-14787476` | [赤単タッチ青黄激気シュート（2010-07-17）](https://rabbitroar.exblog.jp/14787476/) |
| `blog-rabbit-15181408` | [青緑ファイブロボ（2010-09-25）](https://rabbitroar.exblog.jp/15181408/) |
| `blog-rabbit-15186683` | [赤単白況王子（2010-09-26）](https://rabbitroar.exblog.jp/15186683/) |
| `blog-rabbit-15797403` | [黒単タッチ黄緑速攻戒律（2011-01-21）](https://rabbitroar.exblog.jp/15797403/) |
| `blog-rabbit-29646947` | [緑単（タッチ青黄）バジンオルゴール（2018-07-22（原文37枚））](https://rabbitroar.exblog.jp/29646947/) |
| `blog-rabbit-9303419` | [青単ビートダウン（2008-07-26 近畿レンスト友の会 勝率8割）](https://rabbitroar.exblog.jp/9303419/) |
| `blog-rabbit-9320797` | [青単エンジンオー（2008-07-29）](https://rabbitroar.exblog.jp/9320797/) |
| `blog-rabbit-9353113` | [青単アグレッシブメインボード（ライダー限定）（2008-08-02）](https://rabbitroar.exblog.jp/9353113/) |
| `blog-rabbit-9424766` | [青単クライマックスＶＲＶ（2008-08-11 名古屋大会44pt（原文39枚））](https://rabbitroar.exblog.jp/9424766/) |
| `blog-rabbit-9452131` | [青単速攻（2008-08-15）](https://rabbitroar.exblog.jp/9452131/) |
| `blog-rabbit-9492173` | [黄単レジストビートダウン（ライダー）（2008-08-19）](https://rabbitroar.exblog.jp/9492173/) |
| `blog-rabbit-9564953` | [青単ギャバンバルカン（2008-08-28）](https://rabbitroar.exblog.jp/9564953/) |
| `blog-rabbit-9672185` | [緑単アメリカンテクター（2008-09-09）](https://rabbitroar.exblog.jp/9672185/) |
| `blog-rabbit-9679317` | [緑単トリプルダンス（2008-09-10）](https://rabbitroar.exblog.jp/9679317/) |
| `blog-rabbit-9696905` | [黄単黒麒麟（2008-09-13）](https://rabbitroar.exblog.jp/9696905/) |
| `blog-rabbit-9735456` | [赤単トリックガッツゲキウルフ（2008-09-18）](https://rabbitroar.exblog.jp/9735456/) |
| `blog-rabbit-9790429` | [黄単無敵将軍（2008-09-25）](https://rabbitroar.exblog.jp/9790429/) |
| `blog-rabbit-9984932` | [青単クライマックスタイムロボ（2008-10-23）](https://rabbitroar.exblog.jp/9984932/) |
| `blog-tocage-1236482570` | [花嫁の航空機 黄黒（2009-03-08 混合3戦3勝）](https://tocage.jp/blog/387/1236482570.html) |
| `blog-tocage-1236483116` | [鯖ブロン 赤緑タッチ黄（2009-03-08 ライダー単2戦2勝）](https://tocage.jp/blog/387/1236483116.html) |
| `blog-tocage-1237385936` | [火焔トード 黄黒（2009-03-18）](https://tocage.jp/blog/387/1237385936.html) |
| `blog-tocage-1237386869` | [ガンバルオー 黄青（2009-03-18）](https://tocage.jp/blog/387/1237386869.html) |
| `blog-tocage-1238894321` | [シンケンオー 黄単（2009-04-05 混合3戦2勝）](https://tocage.jp/blog/387/1238894321.html) |
| `blog-tocage-1239022005` | [キリンディスク 黄単（2009-04-06）](https://tocage.jp/blog/387/1239022005.html) |
| `blog-tocage-1239111037` | [ピヨベリオン 赤黄（2009-04-07）](https://tocage.jp/blog/387/1239111037.html) |
| `blog-tocage-1240237188` | [バキケロフォーザ 赤黒（2009-04-20 混合3戦2勝）](https://tocage.jp/blog/387/1240237188.html) |
| `blog-tocage-1240238774` | [デカ翼 青緑黄（2009-04-20）](https://tocage.jp/blog/387/1240238774.html) |
| `blog-tocage-1241354476` | [ファルサモオーディン改 赤単（2009-05-03）](https://tocage.jp/blog/387/1241354476.html) |
| `blog-tocage-1241455357` | [デルタチューボ 緑黒（2009-05-05）](https://tocage.jp/blog/387/1241455357.html) |
| `blog-tocage-1244472647` | [ジェットイカラス 緑黒（2009-06-08）](https://tocage.jp/blog/387/1244472647.html) |
| `blog-tocage-1246119428` | [ディケーイド！ 赤黄青緑（2009-06-28 混合2戦2勝（原文41枚））](https://tocage.jp/blog/387/1246119428.html) |
| `blog-tocage-1247063897` | [500デカバト 青緑（2009-07-08 混合2戦2勝）](https://tocage.jp/blog/387/1247063897.html) |
| `blog-tocage-1247065137` | [アメリカロック 赤緑タッチ青（2009-07-08 3大ヒーロー2戦2勝（原文41枚））](https://tocage.jp/blog/387/1247065137.html) |
| `blog-tocage-1249741457` | [火焔トード改 黄黒（2009-08-08 混合2戦2勝）](https://tocage.jp/blog/387/1249741457.html) |
| `blog-tocage-1250517968` | [ヘル獣奏剣 黒タッチ赤（2009-08-17）](https://tocage.jp/blog/387/1250517968.html) |
| `blog-tocage-1253027648` | [Wカブト 赤黄（2009-09-16 3大ヒーロー3戦3勝）](https://tocage.jp/blog/387/1253027648.html) |
| `blog-tocage-1255186236` | [ディケCF 黄青（2009-10-10 混合2戦2勝）](https://tocage.jp/blog/387/1255186236.html) |
| `blog-tocage-1255278827` | [スーパー１ 緑タッチマルチ（2009-10-12 混合2戦2勝）](https://tocage.jp/blog/387/1255278827.html) |
| `blog-tocage-1256736013` | [グレートイカラス 緑黒青（2009-10-28）](https://tocage.jp/blog/387/1256736013.html) |
| `blog-tocage-1256737195` | [ガオハンジャスティス 赤単（2009-10-28）](https://tocage.jp/blog/387/1256737195.html) |
| `blog-tocage-1260101909` | [アギト 黄単（2009-12-06）](https://tocage.jp/blog/387/1260101909.html) |
| `blog-tocage-1260103438` | [フルブラ 青単（2009-12-06）](https://tocage.jp/blog/387/1260103438.html) |
| `blog-tocage-1260798311` | [マッスルキング 赤単（2009-12-14）](https://tocage.jp/blog/387/1260798311.html) |
| `blog-tocage-1261293883` | [メレスラ 赤黒（2009-12-20 混合2戦2勝（原文41枚））](https://tocage.jp/blog/387/1261293883.html) |
| `blog-tocage-1261314421` | [牙大王 黄青（2009-12-20）](https://tocage.jp/blog/387/1261314421.html) |
| `blog-tocage-1262105409` | [イカダイモーフ 黄緑（2009-12-30（原文41枚））](https://tocage.jp/blog/387/1262105409.html) |
| `blog-tocage-1262106124` | [14キャストオフ 青黄（2009-12-30）](https://tocage.jp/blog/387/1262106124.html) |
| `blog-tocage-1264952489` | [ブッカー凍鬼 黄青（2010-02-01 ライダー単2戦2勝）](https://tocage.jp/blog/387/1264952489.html) |
| `blog-tocage-1265210314` | [捨て札 緑タッチデモスト（2010-02-04）](https://tocage.jp/blog/387/1265210314.html) |
| `blog-tocage-1267454969` | [バイオロボ（2010-03-01 混合2戦2勝）](https://tocage.jp/blog/387/1267454969.html) |
| `blog-tocage-1268664722` | [ライプニサイクロ 青黒（2010-03-15）](https://tocage.jp/blog/387/1268664722.html) |
| `blog-tocage-1271951009` | [侍バスター（2010-04-23）](https://tocage.jp/blog/387/1271951009.html) |
| `blog-tocage-1274024496` | [兄弟 青単（2010-05-17 混合3戦3勝）](https://tocage.jp/blog/387/1274024496.html) |
| `blog-tocage-1275400625` | [マックスビクトリー 緑黒（2010-06-01）](https://tocage.jp/blog/387/1275400625.html) |
| `blog-tocage-1275402089` | [ゴリ押し 赤単（2010-06-01 混合3戦2勝）](https://tocage.jp/blog/387/1275402089.html) |

どのデッキも、Lv2 同士で最後まで対局できることを確かめています（ブログのデッキは 1 デッキ 2 局ずつ。`blog-rabbit-9984932` の 1 局だけ、両者がクライマックス刑事でパワーを山札に戻し続けて 6,000 手で決着しませんでした）。
