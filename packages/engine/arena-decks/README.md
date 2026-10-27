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

## livedoor「letsrenst」のデッキ（373 個）

livedoor ブログ blog.livedoor.jp/letsrenst の全 380 記事（2009-05〜2026-03）から、カード名と枚数の一覧が載っていたデッキを集めたもの（2026-10-27）。355 記事に 388 デッキあり、中身がまったく同じ 15 デッキを除いて 373 個。id は `blog-livedoor-letsrenst-<記事>`、1 記事に複数あるときは `-<番号>` を付けています。`--decks livedoor` でこれだけを選べます（`blog`・`arena` にも入ります）。

- 大会レポートの使用デッキが中心で、2009〜2012 年の記事が 7 割強です。当時の 50 枚以上のデッキもそのままの枚数で入れています（40 枚以上ならよいので）。
- 略称や表記ゆれ（「デモスト」「ゴーオンシルバー×ゴールド」「DCDカブト」「[RK031]…」など）は、カタログの名前の末尾・部分一致、×の各部分の一致、記事内のカード番号で対応付けました。9,397 行のうち合わなかったのは 23 行です。
- カタログにないカード（オーデイン、ギンクロン、ギガンテスヘブン、ピロバイダーベース、キングイライナー、ドル、「仮面ライダーキバ響鬼」、「電王2nd」）は抜き、40 枚に足りなくなったデッキは 2 枚以下のカードを 1 枚ずつ増やしました。
- 同名 4 枚以上になったもの（記事の重複行）は 3 枚にそろえました。戦闘員（ゾロー兵など）は枚数制限がないので記事どおりです。
- 記事に書かれた合計枚数と一覧の合計が合わないデッキが 37 個あり、一覧のほうを使っています（確かめた範囲では記事側の数え間違い）。

| id | デッキ（記事の日付） | 枚数 |
|---|---|---|
| `blog-livedoor-letsrenst-259219` | [黄紫キバ（ライダー単）（2009-05-16）](http://blog.livedoor.jp/letsrenst/archives/259219.html) | 40 |
| `blog-livedoor-letsrenst-259381` | [緑タッチ青RC（ライダー単）（2009-05-15）](http://blog.livedoor.jp/letsrenst/archives/259381.html) | 40 |
| `blog-livedoor-letsrenst-259463` | [紫青Vコマバクレンオー（2009-05-15）](http://blog.livedoor.jp/letsrenst/archives/259463.html) | 40 |
| `blog-livedoor-letsrenst-259609` | [黄単トータスハンマー（2009-05-15）](http://blog.livedoor.jp/letsrenst/archives/259609.html) | 40 |
| `blog-livedoor-letsrenst-265918` | [青赤01速攻（2009-05-16）](http://blog.livedoor.jp/letsrenst/archives/265918.html) | 40 |
| `blog-livedoor-letsrenst-265946` | [青タッチ緑車両ダイデンジン（2009-05-16）](http://blog.livedoor.jp/letsrenst/archives/265946.html) | 40 |
| `blog-livedoor-letsrenst-287767` | [青単テンダー（2009-05-17）](http://blog.livedoor.jp/letsrenst/archives/287767.html) | 40 |
| `blog-livedoor-letsrenst-288678` | [緑タッチ紫ビッグワン＆イクサ（2009-05-18）](http://blog.livedoor.jp/letsrenst/archives/288678.html) | 40 |
| `blog-livedoor-letsrenst-310610` | [青黄ガルーダデッキ（2009-05-19）](http://blog.livedoor.jp/letsrenst/archives/310610.html) | 40 |
| `blog-livedoor-letsrenst-381061` | [青緑テンダー（2009-05-27）](http://blog.livedoor.jp/letsrenst/archives/381061.html) | 40 |
| `blog-livedoor-letsrenst-554427` | [緑赤メガヘラクレス（2009-06-09）](http://blog.livedoor.jp/letsrenst/archives/554427.html) | 41 |
| `blog-livedoor-letsrenst-740542` | [紫青戦闘員（2009-06-21）](http://blog.livedoor.jp/letsrenst/archives/740542.html) | 40 |
| `blog-livedoor-letsrenst-740600` | [青単V炎神（2009-06-21）](http://blog.livedoor.jp/letsrenst/archives/740600.html) | 40 |
| `blog-livedoor-letsrenst-779310` | [紫緑怪人テクター（2009-06-24）](http://blog.livedoor.jp/letsrenst/archives/779310.html) | 40 |
| `blog-livedoor-letsrenst-856363` | [青単警察ダメージ（2009-06-29）](http://blog.livedoor.jp/letsrenst/archives/856363.html) | 46 |
| `blog-livedoor-letsrenst-889390` | [青単警察（2009-07-01）](http://blog.livedoor.jp/letsrenst/archives/889390.html) | 40 |
| `blog-livedoor-letsrenst-890286` | [青黄ディケイドデンジン（2009-07-01）](http://blog.livedoor.jp/letsrenst/archives/890286.html) | 50 |
| `blog-livedoor-letsrenst-903058` | [青黄ディケイドガルーダ（2009-07-02）](http://blog.livedoor.jp/letsrenst/archives/903058.html) | 60 |
| `blog-livedoor-letsrenst-1009713` | [青黄ディケイドガルーダ+α=80枚（2009-07-09）](http://blog.livedoor.jp/letsrenst/archives/1009713.html) | 80 |
| `blog-livedoor-letsrenst-1100903` | [青紫デッキ（2009-07-14）](http://blog.livedoor.jp/letsrenst/archives/1100903.html) | 54 |
| `blog-livedoor-letsrenst-1127198` | [黄緑青レッドたっぷりデッキ（2009-07-16）](http://blog.livedoor.jp/letsrenst/archives/1127198.html) | 78 |
| `blog-livedoor-letsrenst-1187181` | [青紫戒律（RC）（2009-07-22）](http://blog.livedoor.jp/letsrenst/archives/1187181.html) | 60 |
| `blog-livedoor-letsrenst-1256714` | [青タッチ緑車両デンジン（2009-07-28）](http://blog.livedoor.jp/letsrenst/archives/1256714.html) | 60 |
| `blog-livedoor-letsrenst-1267324` | [青紫戒律（2009-07-30）](http://blog.livedoor.jp/letsrenst/archives/1267324.html) | 70 |
| `blog-livedoor-letsrenst-1329677` | [青黄VRVロボ（2009-08-07）](http://blog.livedoor.jp/letsrenst/archives/1329677.html) | 93 |
| `blog-livedoor-letsrenst-1368626-1` | [緑赤タッチ青JPヘラクレス（2009-08-12）](http://blog.livedoor.jp/letsrenst/archives/1368626.html) | 63 |
| `blog-livedoor-letsrenst-1368626-2` | [黄紫タッチ緑シンプルデッキ（2009-08-12）](http://blog.livedoor.jp/letsrenst/archives/1368626.html) | 57 |
| `blog-livedoor-letsrenst-1393666` | [緑黄タッチ青モーフファイヤーBFロボ（2009-08-14）](http://blog.livedoor.jp/letsrenst/archives/1393666.html) | 74 |
| `blog-livedoor-letsrenst-1422482` | [緑赤黄マルチJPターボロボ（2009-08-18）](http://blog.livedoor.jp/letsrenst/archives/1422482.html) | 66 |
| `blog-livedoor-letsrenst-1422776` | [緑黄多重換装BFロボ（2009-08-19）](http://blog.livedoor.jp/letsrenst/archives/1422776.html) | 69 |
| `blog-livedoor-letsrenst-1471210` | [紫青戒律（2009-08-26）](http://blog.livedoor.jp/letsrenst/archives/1471210.html) | 66 |
| `blog-livedoor-letsrenst-1490632` | [青タッチ緑車両デカレンジャーロボ（2009-08-28）](http://blog.livedoor.jp/letsrenst/archives/1490632.html) | 69 |
| `blog-livedoor-letsrenst-1520818` | [青緑電王2ndデンジン（2009-09-02）](http://blog.livedoor.jp/letsrenst/archives/1520818.html) | 64 |
| `blog-livedoor-letsrenst-1549817` | [青紫臨気ギャバン（2009-09-07）](http://blog.livedoor.jp/letsrenst/archives/1549817.html) | 63 |
| `blog-livedoor-letsrenst-1561214` | [青黄ディケイドデンジン（2009-09-09）](http://blog.livedoor.jp/letsrenst/archives/1561214.html) | 58 |
| `blog-livedoor-letsrenst-1598809` | [緑赤メガヘラクレス（2009-09-15）](http://blog.livedoor.jp/letsrenst/archives/1598809.html) | 63 |
| `blog-livedoor-letsrenst-1625526` | [青単タイムシャドウ（2009-09-21）](http://blog.livedoor.jp/letsrenst/archives/1625526.html) | 59 |
| `blog-livedoor-letsrenst-1634134` | [紫青戒律（2009-09-22）](http://blog.livedoor.jp/letsrenst/archives/1634134.html) | 52 |
| `blog-livedoor-letsrenst-1669634` | [緑青テンダー（2009-09-29）](http://blog.livedoor.jp/letsrenst/archives/1669634.html) | 52 |
| `blog-livedoor-letsrenst-1703384` | [青黄コンプリートデンジン（2009-10-06）](http://blog.livedoor.jp/letsrenst/archives/1703384.html) | 56 |
| `blog-livedoor-letsrenst-1713712` | [赤紫ユナイトベント（2009-10-09）](http://blog.livedoor.jp/letsrenst/archives/1713712.html) | 57 |
| `blog-livedoor-letsrenst-1713877` | [黄緑ゴーゴージェット大連王（2009-10-09）](http://blog.livedoor.jp/letsrenst/archives/1713877.html) | 47 |
| `blog-livedoor-letsrenst-1713931` | [青黄パワー＆ドロー加速VRV（2009-10-09）](http://blog.livedoor.jp/letsrenst/archives/1713931.html) | 108 |
| `blog-livedoor-letsrenst-1732292` | [青黄ディケイドCF（2009-10-13）](http://blog.livedoor.jp/letsrenst/archives/1732292.html) | 50 |
| `blog-livedoor-letsrenst-1766063` | [青緑車両デンジン（2009-10-20）](http://blog.livedoor.jp/letsrenst/archives/1766063.html) | 51 |
| `blog-livedoor-letsrenst-1792936` | [青黄ハイパワー（2009-10-26）](http://blog.livedoor.jp/letsrenst/archives/1792936.html) | 116 |
| `blog-livedoor-letsrenst-1798186` | [青黄ディケイドCF（2009-10-27）](http://blog.livedoor.jp/letsrenst/archives/1798186.html) | 54 |
| `blog-livedoor-letsrenst-1889828` | [赤紫獣ユナイト（2009-11-17）](http://blog.livedoor.jp/letsrenst/archives/1889828.html) | 51 |
| `blog-livedoor-letsrenst-1894450` | [紫青ゲゲル（2009-11-19）](http://blog.livedoor.jp/letsrenst/archives/1894450.html) | 60 |
| `blog-livedoor-letsrenst-1918005` | [紫青ゲゲル（2009-11-24）](http://blog.livedoor.jp/letsrenst/archives/1918005.html) | 60 |
| `blog-livedoor-letsrenst-1970374` | [青黄ディケイドCF（2009-12-02）](http://blog.livedoor.jp/letsrenst/archives/1970374.html) | 56 |
| `blog-livedoor-letsrenst-1995914` | [紫青ゲゲル（2009-12-08）](http://blog.livedoor.jp/letsrenst/archives/1995914.html) | 63 |
| `blog-livedoor-letsrenst-2028256-1` | [青タッチ緑車両デンジン（2009-12-15）](http://blog.livedoor.jp/letsrenst/archives/2028256.html) | 52 |
| `blog-livedoor-letsrenst-2028256-2` | [緑青ＲＣ（2009-12-15）](http://blog.livedoor.jp/letsrenst/archives/2028256.html) | 51 |
| `blog-livedoor-letsrenst-2065573` | [青黄タッチ緑赤OVER100デカレンジャーロボ（2009-12-22）](http://blog.livedoor.jp/letsrenst/archives/2065573.html) | 140 |
| `blog-livedoor-letsrenst-2085375` | [紫緑キングダーク（2009-12-27）](http://blog.livedoor.jp/letsrenst/archives/2085375.html) | 51 |
| `blog-livedoor-letsrenst-2085484` | [赤青マックスオージャ（2009-12-27）](http://blog.livedoor.jp/letsrenst/archives/2085484.html) | 53 |
| `blog-livedoor-letsrenst-2085525` | [紫青タッチ黄戒律（2009-12-27）](http://blog.livedoor.jp/letsrenst/archives/2085525.html) | 55 |
| `blog-livedoor-letsrenst-2099732` | [赤青マックスオージャ（2009-12-29）](http://blog.livedoor.jp/letsrenst/archives/2099732.html) | 54 |
| `blog-livedoor-letsrenst-2121660` | [赤単紅白（2010-01-02）](http://blog.livedoor.jp/letsrenst/archives/2121660.html) | 54 |
| `blog-livedoor-letsrenst-2139133` | [青黄タッチ緑赤紫OVER100デカレンジャーロボ（2010-01-05）](http://blog.livedoor.jp/letsrenst/archives/2139133.html) | 154 |
| `blog-livedoor-letsrenst-2148013` | [緑青RC（2010-01-08）](http://blog.livedoor.jp/letsrenst/archives/2148013.html) | 55 |
| `blog-livedoor-letsrenst-2166874` | [紫緑キングダーク（2010-01-12）](http://blog.livedoor.jp/letsrenst/archives/2166874.html) | 53 |
| `blog-livedoor-letsrenst-2184807` | [黄紫（ライダー単）（2010-01-19）](http://blog.livedoor.jp/letsrenst/archives/2184807.html) | 54 |
| `blog-livedoor-letsrenst-2217282` | [黄紫（2010-01-24）](http://blog.livedoor.jp/letsrenst/archives/2217282.html) | 54 |
| `blog-livedoor-letsrenst-2242900` | [緑紫（2010-01-29）](http://blog.livedoor.jp/letsrenst/archives/2242900.html) | 50 |
| `blog-livedoor-letsrenst-2259734` | [赤青マックスオージャ（2010-02-02）](http://blog.livedoor.jp/letsrenst/archives/2259734.html) | 54 |
| `blog-livedoor-letsrenst-2282522` | [青黄対加速（2010-02-06）](http://blog.livedoor.jp/letsrenst/archives/2282522.html) | 56 |
| `blog-livedoor-letsrenst-2294127` | [青紫臨気チェイス（コマンダー：ドギー）（2010-02-09）](http://blog.livedoor.jp/letsrenst/archives/2294127.html) | 60 |
| `blog-livedoor-letsrenst-2308253` | [赤青速攻（2010-02-13）](http://blog.livedoor.jp/letsrenst/archives/2308253.html) | 47 |
| `blog-livedoor-letsrenst-2350428` | [青黄FFR（ライダー単）（2010-02-20）](http://blog.livedoor.jp/letsrenst/archives/2350428.html) | 56 |
| `blog-livedoor-letsrenst-2365663` | [青黄大神龍バトルバース（2010-02-24）](http://blog.livedoor.jp/letsrenst/archives/2365663.html) | 57 |
| `blog-livedoor-letsrenst-2369678` | [青黄FFR（2010-02-26）](http://blog.livedoor.jp/letsrenst/archives/2369678.html) | 56 |
| `blog-livedoor-letsrenst-2441175` | [青紫加速ハイパワー（2010-03-05）](http://blog.livedoor.jp/letsrenst/archives/2441175.html) | 60 |
| `blog-livedoor-letsrenst-2465570` | [紫青タッチ黄FFR戒律（コマンダー：ドギー）（2010-03-09）](http://blog.livedoor.jp/letsrenst/archives/2465570.html) | 52 |
| `blog-livedoor-letsrenst-2479615` | [青紫加速ハイパワー（2010-03-13）](http://blog.livedoor.jp/letsrenst/archives/2479615.html) | 78 |
| `blog-livedoor-letsrenst-2492087` | [青タッチ緑+α車両デンジン（コマンダー：ドギー）（2010-03-16）](http://blog.livedoor.jp/letsrenst/archives/2492087.html) | 55 |
| `blog-livedoor-letsrenst-2511747` | [青黄タッチ緑赤紫ハイパワーデカレンジャーロボ（コ マンダー：ドギー）（2010-03-23）](http://blog.livedoor.jp/letsrenst/archives/2511747.html) | 166 |
| `blog-livedoor-letsrenst-2533384` | [緑黄換装フィーバー（2010-03-30）](http://blog.livedoor.jp/letsrenst/archives/2533384.html) | 54 |
| `blog-livedoor-letsrenst-2533473` | [緑黄天空フィーバー（コマンダー：ドギー）（2010-03-30）](http://blog.livedoor.jp/letsrenst/archives/2533473.html) | 75 |
| `blog-livedoor-letsrenst-2546152` | [デッキ 内容（2010-04-03）](http://blog.livedoor.jp/letsrenst/archives/2546152.html) | 67 |
| `blog-livedoor-letsrenst-2553389` | [赤緑JPカード（2010-04-05）](http://blog.livedoor.jp/letsrenst/archives/2553389.html) | 53 |
| `blog-livedoor-letsrenst-2559020` | [青黄ゴールドガルーダイカイオー（コマンダー：ダップ）（2010-04-06）](http://blog.livedoor.jp/letsrenst/archives/2559020.html) | 69 |
| `blog-livedoor-letsrenst-2570989` | [デッキ 内容（2010-04-10）](http://blog.livedoor.jp/letsrenst/archives/2570989.html) | 67 |
| `blog-livedoor-letsrenst-2591319` | [青タッチ赤宇宙警察（2010-04-17）](http://blog.livedoor.jp/letsrenst/archives/2591319.html) | 73 |
| `blog-livedoor-letsrenst-2611215` | [紫青（2010-04-24）](http://blog.livedoor.jp/letsrenst/archives/2611215.html) | 55 |
| `blog-livedoor-letsrenst-2629430` | [青紫加速ハイパワー（2010-05-01）](http://blog.livedoor.jp/letsrenst/archives/2629430.html) | 80 |
| `blog-livedoor-letsrenst-2634504` | [青黄タッチ赤ガルーダイカイオー（コマンダー：ダップ）（2010-05-03）](http://blog.livedoor.jp/letsrenst/archives/2634504.html) | 87 |
| `blog-livedoor-letsrenst-2639458` | [紫青（コマンダー：ダップ）（2010-05-05）](http://blog.livedoor.jp/letsrenst/archives/2639458.html) | 54 |
| `blog-livedoor-letsrenst-2671831` | [青タッチ緑+α車両デンジン(ver.XG4)（2010-05-16）](http://blog.livedoor.jp/letsrenst/archives/2671831.html) | 55 |
| `blog-livedoor-letsrenst-2671943` | [赤黄ユナイト（2010-05-16）](http://blog.livedoor.jp/letsrenst/archives/2671943.html) | 51 |
| `blog-livedoor-letsrenst-2691047` | [赤紫バクレンオー（2010-05-23）](http://blog.livedoor.jp/letsrenst/archives/2691047.html) | 52 |
| `blog-livedoor-letsrenst-2709400` | [特別ルール（2010-05-30）](http://blog.livedoor.jp/letsrenst/archives/2709400.html) | 54 |
| `blog-livedoor-letsrenst-2727691` | [赤緑メガヘラクレス＆マックスオージャ（コマンダー：向井健三博士）（2010-06-06）](http://blog.livedoor.jp/letsrenst/archives/2727691.html) | 54 |
| `blog-livedoor-letsrenst-2746621` | [青黄ガルーダイカイオー（コマンダー：ダップ）（2010-06-13）](http://blog.livedoor.jp/letsrenst/archives/2746621.html) | 82 |
| `blog-livedoor-letsrenst-2764036` | [青タッチ緑+α車両デンジン（コマンダー：正木本部長）（2010-06-20）](http://blog.livedoor.jp/letsrenst/archives/2764036.html) | 56 |
| `blog-livedoor-letsrenst-2790600` | [青黄タッチ全色OVER100（コマンダー：向井健三博士）（2010-06-27）](http://blog.livedoor.jp/letsrenst/archives/2790600.html) | 167 |
| `blog-livedoor-letsrenst-2808634` | [青黄タッチ全色OVER100（コマンダー：向井健三博士）（2010-07-04）](http://blog.livedoor.jp/letsrenst/archives/2808634.html) | 195 |
| `blog-livedoor-letsrenst-2809637` | [黄青ドロー＆ファイナルフォームライド（コマンダー：向井健三博士）（2010-07-05）](http://blog.livedoor.jp/letsrenst/archives/2809637.html) | 109 |
| `blog-livedoor-letsrenst-2825472` | [緑単BVゴーグルロボ（2010-07-11）](http://blog.livedoor.jp/letsrenst/archives/2825472.html) | 58 |
| `blog-livedoor-letsrenst-2841804` | [緑黄エンドレスフィーバー（2010-07-18）](http://blog.livedoor.jp/letsrenst/archives/2841804.html) | 63 |
| `blog-livedoor-letsrenst-2846820` | [黄青OVER100秘伝ダイカイ大将軍（2010-07-19）](http://blog.livedoor.jp/letsrenst/archives/2846820.html) | 125 |
| `blog-livedoor-letsrenst-2862771-1` | [青黄DCDJF（2010-07-25）](http://blog.livedoor.jp/letsrenst/archives/2862771.html) | 85 |
| `blog-livedoor-letsrenst-2862771-2` | [紫青（2010-07-25）](http://blog.livedoor.jp/letsrenst/archives/2862771.html) | 58 |
| `blog-livedoor-letsrenst-2877550` | [青緑テンダー（2010-08-01）](http://blog.livedoor.jp/letsrenst/archives/2877550.html) | 63 |
| `blog-livedoor-letsrenst-2880144` | [青緑テンダー（2010-08-02）](http://blog.livedoor.jp/letsrenst/archives/2880144.html) | 61 |
| `blog-livedoor-letsrenst-2896710` | [紫緑キングダーク（2010-08-08）](http://blog.livedoor.jp/letsrenst/archives/2896710.html) | 54 |
| `blog-livedoor-letsrenst-2909691` | [紫青タッチ黄緑FFR戒律（2010-08-14）](http://blog.livedoor.jp/letsrenst/archives/2909691.html) | 56 |
| `blog-livedoor-letsrenst-2928626` | [赤黄青マルチランディックゴセイグレート（2010-08-22）](http://blog.livedoor.jp/letsrenst/archives/2928626.html) | 64 |
| `blog-livedoor-letsrenst-2942516` | [紫青（2010-08-29）](http://blog.livedoor.jp/letsrenst/archives/2942516.html) | 60 |
| `blog-livedoor-letsrenst-2944224` | [緑黄エンドレスフィーバー（2010-08-29）](http://blog.livedoor.jp/letsrenst/archives/2944224.html) | 60 |
| `blog-livedoor-letsrenst-2959413` | [青緑ダンスバイクロッサー（2010-09-05）](http://blog.livedoor.jp/letsrenst/archives/2959413.html) | 56 |
| `blog-livedoor-letsrenst-2972406` | [青黄タッチ全色OVER100デカレンジャーロボ（2010-09-12）](http://blog.livedoor.jp/letsrenst/archives/2972406.html) | 133 |
| `blog-livedoor-letsrenst-2972447` | [青黄タッチ全色OVER100デカレンジャーロボ（2010-09-12）](http://blog.livedoor.jp/letsrenst/archives/2972447.html) | 141 |
| `blog-livedoor-letsrenst-2974386` | [青黄タッチ全色OVER100デカレンジャーロボ（2010-09-13）](http://blog.livedoor.jp/letsrenst/archives/2974386.html) | 109 |
| `blog-livedoor-letsrenst-2987452` | [緑紫多重ストライク（2010-09-19）](http://blog.livedoor.jp/letsrenst/archives/2987452.html) | 50 |
| `blog-livedoor-letsrenst-2987908` | [青緑ダンスバイクロッサー（2010-09-19）](http://blog.livedoor.jp/letsrenst/archives/2987908.html) | 58 |
| `blog-livedoor-letsrenst-3000810` | [青黄タッチ緑紫OVER100デカレンジャーロボ（2010-09-26）](http://blog.livedoor.jp/letsrenst/archives/3000810.html) | 105 |
| `blog-livedoor-letsrenst-3002275` | [緑紫ストライクwithサラマンデス（2010-09-26）](http://blog.livedoor.jp/letsrenst/archives/3002275.html) | 52 |
| `blog-livedoor-letsrenst-3015070` | [緑紫多重ストライク（2010-10-03）](http://blog.livedoor.jp/letsrenst/archives/3015070.html) | 50 |
| `blog-livedoor-letsrenst-3016310` | [緑黄大連王（2010-10-03）](http://blog.livedoor.jp/letsrenst/archives/3016310.html) | 55 |
| `blog-livedoor-letsrenst-3028989` | [青黄タッチ紫OVER100VRVロボ（2010-10-10）](http://blog.livedoor.jp/letsrenst/archives/3028989.html) | 119 |
| `blog-livedoor-letsrenst-3030669` | [緑青アルティメットダイボウケン（2010-10-11）](http://blog.livedoor.jp/letsrenst/archives/3030669.html) | 72 |
| `blog-livedoor-letsrenst-3030727` | [青単カブトグレートタイタン（2010-10-11）](http://blog.livedoor.jp/letsrenst/archives/3030727.html) | 60 |
| `blog-livedoor-letsrenst-3030745` | [紫緑ヴォッファ（2010-10-11）](http://blog.livedoor.jp/letsrenst/archives/3030745.html) | 57 |
| `blog-livedoor-letsrenst-3032748` | [青単カブトグレートタイタン（2010-10-12）](http://blog.livedoor.jp/letsrenst/archives/3032748.html) | 83 |
| `blog-livedoor-letsrenst-3041887` | [紫緑ヴォッファ（2010-10-17）](http://blog.livedoor.jp/letsrenst/archives/3041887.html) | 56 |
| `blog-livedoor-letsrenst-3043682` | [青単カブトグレートタイタン（2010-10-18）](http://blog.livedoor.jp/letsrenst/archives/3043682.html) | 77 |
| `blog-livedoor-letsrenst-3043752` | [緑青車両ワンセブン（2010-10-18）](http://blog.livedoor.jp/letsrenst/archives/3043752.html) | 62 |
| `blog-livedoor-letsrenst-3056067` | [緑青車両ワンセブン（2010-10-24）](http://blog.livedoor.jp/letsrenst/archives/3056067.html) | 63 |
| `blog-livedoor-letsrenst-3056935` | [青タッチ緑紫車両デンジン（2010-10-25）](http://blog.livedoor.jp/letsrenst/archives/3056935.html) | 55 |
| `blog-livedoor-letsrenst-3067864` | [緑青アルティメットダイボウケン（2010-10-30）](http://blog.livedoor.jp/letsrenst/archives/3067864.html) | 80 |
| `blog-livedoor-letsrenst-3069894` | [緑黄エンドレスフィーバー（2010-11-01）](http://blog.livedoor.jp/letsrenst/archives/3069894.html) | 55 |
| `blog-livedoor-letsrenst-3069918` | [黄紫タッチ緑赤ゴセイグランド（2010-11-01）](http://blog.livedoor.jp/letsrenst/archives/3069918.html) | 55 |
| `blog-livedoor-letsrenst-3081075` | [黄紫タッチ緑赤ゴセイグランド（2010-11-07）](http://blog.livedoor.jp/letsrenst/archives/3081075.html) | 55 |
| `blog-livedoor-letsrenst-3081105` | [青単カブトグレートタイタン（コマンダー：向井健三博士）（2010-11-07）](http://blog.livedoor.jp/letsrenst/archives/3081105.html) | 66 |
| `blog-livedoor-letsrenst-3093133` | [緑黄大連王（2010-11-13）](http://blog.livedoor.jp/letsrenst/archives/3093133.html) | 56 |
| `blog-livedoor-letsrenst-3097744` | [紫青（2010-11-16）](http://blog.livedoor.jp/letsrenst/archives/3097744.html) | 58 |
| `blog-livedoor-letsrenst-3106797` | [赤青タッチ黄キラーアバレンオー（コマンダー：向井健三博士）（2010-11-21）](http://blog.livedoor.jp/letsrenst/archives/3106797.html) | 57 |
| `blog-livedoor-letsrenst-3108551` | [赤黄青タッチ緑紫ラディックゴセイグレート（2010-11-22）](http://blog.livedoor.jp/letsrenst/archives/3108551.html) | 69 |
| `blog-livedoor-letsrenst-3119200` | [黄紫タッチ緑赤ゴセイグランド（2010-11-28）](http://blog.livedoor.jp/letsrenst/archives/3119200.html) | 55 |
| `blog-livedoor-letsrenst-3119280` | [赤黄青タッチ緑紫ランディックゴセイグレート（コマンダー：向井健三博士）（2010-11-28）](http://blog.livedoor.jp/letsrenst/archives/3119280.html) | 77 |
| `blog-livedoor-letsrenst-3131663` | [赤青タッチ紫キラーアバレンオー（2010-12-05）](http://blog.livedoor.jp/letsrenst/archives/3131663.html) | 62 |
| `blog-livedoor-letsrenst-3133233` | [紫青（2010-12-06）](http://blog.livedoor.jp/letsrenst/archives/3133233.html) | 60 |
| `blog-livedoor-letsrenst-3133255` | [黄青タッチ緑車両侍（コマンダー：向井健三博士）（2010-12-06）](http://blog.livedoor.jp/letsrenst/archives/3133255.html) | 72 |
| `blog-livedoor-letsrenst-3133286` | [緑黄時間返し（2010-12-06）](http://blog.livedoor.jp/letsrenst/archives/3133286.html) | 56 |
| `blog-livedoor-letsrenst-3144822` | [赤黄時間返し（2010-12-12）](http://blog.livedoor.jp/letsrenst/archives/3144822.html) | 53 |
| `blog-livedoor-letsrenst-3144854` | [紫青（2010-12-12）](http://blog.livedoor.jp/letsrenst/archives/3144854.html) | 60 |
| `blog-livedoor-letsrenst-3158372` | [青緑スワットデカウイングロボ（2010-12-19）](http://blog.livedoor.jp/letsrenst/archives/3158372.html) | 62 |
| `blog-livedoor-letsrenst-3158459` | [青緑スワットデカウイングロボ（2010-12-20）](http://blog.livedoor.jp/letsrenst/archives/3158459.html) | 62 |
| `blog-livedoor-letsrenst-3190593` | [青黄モーフデンジン（コマンダー：向井健三博士）（2010-12-26）](http://blog.livedoor.jp/letsrenst/archives/3190593.html) | 64 |
| `blog-livedoor-letsrenst-3192262` | [青紫タッチ黄赤緑FFR戒律（2010-12-26）](http://blog.livedoor.jp/letsrenst/archives/3192262.html) | 54 |
| `blog-livedoor-letsrenst-3224023` | [黄紫ヤイバ戒律（2010-12-31）](http://blog.livedoor.jp/letsrenst/archives/3224023.html) | 54 |
| `blog-livedoor-letsrenst-3277774` | [黄紫ヤイバ戒律（2011-01-06）](http://blog.livedoor.jp/letsrenst/archives/3277774.html) | 56 |
| `blog-livedoor-letsrenst-3286895` | [赤黄ランディックゴセイグレート（コマンダー：向井健三博士）（2011-01-09）](http://blog.livedoor.jp/letsrenst/archives/3286895.html) | 59 |
| `blog-livedoor-letsrenst-3290747` | [赤黄青タッチ緑紫ランディックゴセイグレート（2011-01-09）](http://blog.livedoor.jp/letsrenst/archives/3290747.html) | 88 |
| `blog-livedoor-letsrenst-3317994` | [青緑グランナスカ（2011-01-15）](http://blog.livedoor.jp/letsrenst/archives/3317994.html) | 60 |
| `blog-livedoor-letsrenst-3318206` | [黄緑ダメージ（2011-01-15）](http://blog.livedoor.jp/letsrenst/archives/3318206.html) | 55 |
| `blog-livedoor-letsrenst-3330667` | [緑黄ダメージ（2011-01-17）](http://blog.livedoor.jp/letsrenst/archives/3330667.html) | 56 |
| `blog-livedoor-letsrenst-3368623` | [青緑グランナスカ（コマンダー：向井健三博士）（2011-01-23）](http://blog.livedoor.jp/letsrenst/archives/3368623.html) | 65 |
| `blog-livedoor-letsrenst-3368925` | [青単パワー送り（2011-01-23）](http://blog.livedoor.jp/letsrenst/archives/3368925.html) | 58 |
| `blog-livedoor-letsrenst-3401174` | [青黄ダイカイオー（2011-01-30）](http://blog.livedoor.jp/letsrenst/archives/3401174.html) | 59 |
| `blog-livedoor-letsrenst-3406043` | [青黄タッチ赤紫OVER100VRVロボ（2011-01-31）](http://blog.livedoor.jp/letsrenst/archives/3406043.html) | 118 |
| `blog-livedoor-letsrenst-3439985` | [青黄タッチ赤緑紫OVER100VRVロボ（コマンダー：向井健三博士）（2011-02-06）](http://blog.livedoor.jp/letsrenst/archives/3439985.html) | 124 |
| `blog-livedoor-letsrenst-3440345` | [緑タッチ青ビクトリーロボ（2011-02-07）](http://blog.livedoor.jp/letsrenst/archives/3440345.html) | 61 |
| `blog-livedoor-letsrenst-3469507` | [赤紫ユナイト（2011-02-13）](http://blog.livedoor.jp/letsrenst/archives/3469507.html) | 55 |
| `blog-livedoor-letsrenst-3498665` | [緑青アルティメットダイボウケン（2011-02-20）](http://blog.livedoor.jp/letsrenst/archives/3498665.html) | 74 |
| `blog-livedoor-letsrenst-3539190` | [紫緑ヴォッファ（2011-02-27）](http://blog.livedoor.jp/letsrenst/archives/3539190.html) | 55 |
| `blog-livedoor-letsrenst-3539319` | [赤黄青タッチ緑紫ランディックゴセイグレート（2011-02-27）](http://blog.livedoor.jp/letsrenst/archives/3539319.html) | 90 |
| `blog-livedoor-letsrenst-3566034` | [緑黄エンドレスフィーバー（2011-03-05）](http://blog.livedoor.jp/letsrenst/archives/3566034.html) | 54 |
| `blog-livedoor-letsrenst-3593775` | [赤黄青タッチ緑紫ランディックゴセイグレート（2011-03-12）](http://blog.livedoor.jp/letsrenst/archives/3593775.html) | 91 |
| `blog-livedoor-letsrenst-3618608` | [黄紫タッチ赤緑ヤイバ戒律（2011-03-19）](http://blog.livedoor.jp/letsrenst/archives/3618608.html) | 57 |
| `blog-livedoor-letsrenst-3622662` | [赤青ゴーカイオージャレーダー（2011-03-20）](http://blog.livedoor.jp/letsrenst/archives/3622662.html) | 61 |
| `blog-livedoor-letsrenst-3635889` | [新弾デッキ＆感想（2011-03-25）](http://blog.livedoor.jp/letsrenst/archives/3635889.html) | 51 |
| `blog-livedoor-letsrenst-3645495` | [青黄タッチ赤緑ゴーカイアルティメットレーダー（2011-03-28）](http://blog.livedoor.jp/letsrenst/archives/3645495.html) | 63 |
| `blog-livedoor-letsrenst-3645628` | [青黄タッチ赤緑ゴーカイアルティメットレーダー（2011-03-28）](http://blog.livedoor.jp/letsrenst/archives/3645628.html) | 61 |
| `blog-livedoor-letsrenst-3645738` | [緑黄ゴセイアルティメット（2011-03-31）](http://blog.livedoor.jp/letsrenst/archives/3645738.html) | 71 |
| `blog-livedoor-letsrenst-3657039` | [青単カブトタイタン（2011-04-03）](http://blog.livedoor.jp/letsrenst/archives/3657039.html) | 64 |
| `blog-livedoor-letsrenst-3662117` | [緑赤呉越G4（2011-04-04）](http://blog.livedoor.jp/letsrenst/archives/3662117.html) | 59 |
| `blog-livedoor-letsrenst-3672879` | [青赤ライダー速攻（2011-04-10）](http://blog.livedoor.jp/letsrenst/archives/3672879.html) | 43 |
| `blog-livedoor-letsrenst-3675010` | [青緑メカ警察（2011-04-10）](http://blog.livedoor.jp/letsrenst/archives/3675010.html) | 57 |
| `blog-livedoor-letsrenst-3687103` | [青黄タッチ赤緑ゴーカイアルティメットレーダー（2011-04-16）](http://blog.livedoor.jp/letsrenst/archives/3687103.html) | 64 |
| `blog-livedoor-letsrenst-3697821` | [赤青ゴーカイオージャ／五色SPEED LOVE（2011-04-20）](http://blog.livedoor.jp/letsrenst/archives/3697821.html) | 56 |
| `blog-livedoor-letsrenst-3698056` | [緑青メカ警察（2011-04-21）](http://blog.livedoor.jp/letsrenst/archives/3698056.html) | 55 |
| `blog-livedoor-letsrenst-3704618` | [青単ゴーカイデンジン・クライマックスSPEED LOVE（2011-04-23）](http://blog.livedoor.jp/letsrenst/archives/3704618.html) | 54 |
| `blog-livedoor-letsrenst-3714437` | [緑青メカ警察（2011-04-27）](http://blog.livedoor.jp/letsrenst/archives/3714437.html) | 50 |
| `blog-livedoor-letsrenst-3714561` | [赤黄タッチ緑ゲキファイヤー＆サイダイオー＆ゴセイアルティメット（2011-04-30）](http://blog.livedoor.jp/letsrenst/archives/3714561.html) | 62 |
| `blog-livedoor-letsrenst-3718636` | [赤黄タッチ緑サイダイオー（2011-04-30）](http://blog.livedoor.jp/letsrenst/archives/3718636.html) | 43 |
| `blog-livedoor-letsrenst-3732471` | [青黄ゴーカイダイカイオー（2011-05-08）](http://blog.livedoor.jp/letsrenst/archives/3732471.html) | 55 |
| `blog-livedoor-letsrenst-3734032` | [緑黄ジュピターマジレジェンド（2011-05-09）](http://blog.livedoor.jp/letsrenst/archives/3734032.html) | 53 |
| `blog-livedoor-letsrenst-3745389` | [青単カブトタイタン（2011-05-15）](http://blog.livedoor.jp/letsrenst/archives/3745389.html) | 54 |
| `blog-livedoor-letsrenst-3756419` | [紫タッチ赤緑メカ戒律（2011-05-22）](http://blog.livedoor.jp/letsrenst/archives/3756419.html) | 72 |
| `blog-livedoor-letsrenst-3757959` | [青黄銀河超越ゴーカイレーダー（2011-05-23）](http://blog.livedoor.jp/letsrenst/archives/3757959.html) | 70 |
| `blog-livedoor-letsrenst-3782600` | [赤黄青タッチ紫緑ランディックゴセイグレート（2011-06-05）](http://blog.livedoor.jp/letsrenst/archives/3782600.html) | 123 |
| `blog-livedoor-letsrenst-3788619` | [紫緑ヴォッファ（2011-06-09）](http://blog.livedoor.jp/letsrenst/archives/3788619.html) | 53 |
| `blog-livedoor-letsrenst-3796259` | [青黄タッチ緑ゴーカイレーダー（2011-06-12）](http://blog.livedoor.jp/letsrenst/archives/3796259.html) | 70 |
| `blog-livedoor-letsrenst-3806593` | [青黄タッチ赤緑ゴーカイレーダー（2011-06-19）](http://blog.livedoor.jp/letsrenst/archives/3806593.html) | 74 |
| `blog-livedoor-letsrenst-3841957` | [紫青（2011-07-02）](http://blog.livedoor.jp/letsrenst/archives/3841957.html) | 78 |
| `blog-livedoor-letsrenst-3842101` | [赤青タッチ黄紫ライダー超電子頭脳（2011-07-02）](http://blog.livedoor.jp/letsrenst/archives/3842101.html) | 94 |
| `blog-livedoor-letsrenst-3852824` | [赤青タッチ黄紫緑ライダー超電子頭脳（2011-07-10）](http://blog.livedoor.jp/letsrenst/archives/3852824.html) | 103 |
| `blog-livedoor-letsrenst-3860977` | [青黄タッチ緑ゴーカイアルティメット舵木レーダー（2011-07-17）](http://blog.livedoor.jp/letsrenst/archives/3860977.html) | 77 |
| `blog-livedoor-letsrenst-3860992` | [黄紫タッチ赤ユナイト戒律（2011-07-17）](http://blog.livedoor.jp/letsrenst/archives/3860992.html) | 56 |
| `blog-livedoor-letsrenst-3863177` | [赤黄アルティメット舵木（2011-07-18）](http://blog.livedoor.jp/letsrenst/archives/3863177.html) | 62 |
| `blog-livedoor-letsrenst-3871684` | [赤黄アルティメット舵木（2011-07-24）](http://blog.livedoor.jp/letsrenst/archives/3871684.html) | 63 |
| `blog-livedoor-letsrenst-3881526` | [青単デカウイングキャノンバトルバース（2011-07-31）](http://blog.livedoor.jp/letsrenst/archives/3881526.html) | 60 |
| `blog-livedoor-letsrenst-3881594` | [紫タッチ赤緑戒律（2011-07-31）](http://blog.livedoor.jp/letsrenst/archives/3881594.html) | 54 |
| `blog-livedoor-letsrenst-3890515` | [緑青メカ警察（2011-08-07）](http://blog.livedoor.jp/letsrenst/archives/3890515.html) | 52 |
| `blog-livedoor-letsrenst-3898398` | [青緑パワー送りタイタン（2011-08-14）](http://blog.livedoor.jp/letsrenst/archives/3898398.html) | 57 |
| `blog-livedoor-letsrenst-3899749` | [青黄ゴーカイデンジンレーダー（2011-08-21）](http://blog.livedoor.jp/letsrenst/archives/3899749.html) | 64 |
| `blog-livedoor-letsrenst-3915395` | [赤青タッチ黄緑ライダー超電子頭脳（2011-08-27）](http://blog.livedoor.jp/letsrenst/archives/3915395.html) | 101 |
| `blog-livedoor-letsrenst-3924831` | [赤黄タッチ緑サイダイオー（2011-09-04）](http://blog.livedoor.jp/letsrenst/archives/3924831.html) | 46 |
| `blog-livedoor-letsrenst-3933562` | [緑タッチ黄ダイボウケン（2011-09-11）](http://blog.livedoor.jp/letsrenst/archives/3933562.html) | 50 |
| `blog-livedoor-letsrenst-3947924` | [緑黄アルティメットエンドレスフィーバー（2011-09-25）](http://blog.livedoor.jp/letsrenst/archives/3947924.html) | 56 |
| `blog-livedoor-letsrenst-3948642` | [青黄タッチ赤緑OVER100ゴーカイレーダー（2011-10-01）](http://blog.livedoor.jp/letsrenst/archives/3948642.html) | 108 |
| `blog-livedoor-letsrenst-3955706` | [特殊ルール（2011-10-01）](http://blog.livedoor.jp/letsrenst/archives/3955706.html) | 71 |
| `blog-livedoor-letsrenst-3978318` | [赤青ゴーカイオージャ／五色SPEED LOVE（2011-10-16）](http://blog.livedoor.jp/letsrenst/archives/3978318.html) | 64 |
| `blog-livedoor-letsrenst-3987326` | [赤緑ゴッドホーンオージャ（2011-10-23）](http://blog.livedoor.jp/letsrenst/archives/3987326.html) | 57 |
| `blog-livedoor-letsrenst-3996245` | [赤緑ユナイト（2011-10-30）](http://blog.livedoor.jp/letsrenst/archives/3996245.html) | 58 |
| `blog-livedoor-letsrenst-4004400` | [青緑グランドストライク（2011-11-06）](http://blog.livedoor.jp/letsrenst/archives/4004400.html) | 61 |
| `blog-livedoor-letsrenst-4011848` | [紫青（2011-11-13）](http://blog.livedoor.jp/letsrenst/archives/4011848.html) | 52 |
| `blog-livedoor-letsrenst-4019433` | [緑青黄スーパー戦隊魂（2011-11-20）](http://blog.livedoor.jp/letsrenst/archives/4019433.html) | 56 |
| `blog-livedoor-letsrenst-4027247` | [青単タイムシャドウ（2011-11-27）](http://blog.livedoor.jp/letsrenst/archives/4027247.html) | 56 |
| `blog-livedoor-letsrenst-4035740` | [赤青タッチ緑ライダー超電子頭脳（2011-12-04）](http://blog.livedoor.jp/letsrenst/archives/4035740.html) | 117 |
| `blog-livedoor-letsrenst-4043624` | [緑青黄スーパー戦隊魂（2011-12-17）](http://blog.livedoor.jp/letsrenst/archives/4043624.html) | 55 |
| `blog-livedoor-letsrenst-4049190` | [青タッチ緑紫黄車両デンジン（2011-12-18）](http://blog.livedoor.jp/letsrenst/archives/4049190.html) | 54 |
| `blog-livedoor-letsrenst-4056010` | [赤緑マルチ（2011-12-25）](http://blog.livedoor.jp/letsrenst/archives/4056010.html) | 52 |
| `blog-livedoor-letsrenst-4063259` | [内容（2012-01-01）](http://blog.livedoor.jp/letsrenst/archives/4063259.html) | 60 |
| `blog-livedoor-letsrenst-4070715` | [緑黄（2012-01-08）](http://blog.livedoor.jp/letsrenst/archives/4070715.html) | 56 |
| `blog-livedoor-letsrenst-4077294` | [緑単秘密戦隊ゴレンジャー（2012-01-15）](http://blog.livedoor.jp/letsrenst/archives/4077294.html) | 52 |
| `blog-livedoor-letsrenst-4077398` | [緑単ジャッカー電撃隊（2012-01-15）](http://blog.livedoor.jp/letsrenst/archives/4077398.html) | 52 |
| `blog-livedoor-letsrenst-4084043` | [緑黄タッチ赤バトルフィーバーJ（2012-01-22）](http://blog.livedoor.jp/letsrenst/archives/4084043.html) | 54 |
| `blog-livedoor-letsrenst-4090001` | [青黄電子戦隊デンジマン（2012-01-29）](http://blog.livedoor.jp/letsrenst/archives/4090001.html) | 50 |
| `blog-livedoor-letsrenst-4097206` | [赤緑ゴッドホーンオージャ（2012-02-05）](http://blog.livedoor.jp/letsrenst/archives/4097206.html) | 50 |
| `blog-livedoor-letsrenst-4103559` | [緑赤太陽戦隊サンバルカン（2012-02-12）](http://blog.livedoor.jp/letsrenst/archives/4103559.html) | 50 |
| `blog-livedoor-letsrenst-4116612` | [緑単大戦隊ゴーグル��（2012-02-19）](http://blog.livedoor.jp/letsrenst/archives/4116612.html) | 55 |
| `blog-livedoor-letsrenst-4123400` | [緑黄科学戦隊ダイナマン（2012-02-26）](http://blog.livedoor.jp/letsrenst/archives/4123400.html) | 56 |
| `blog-livedoor-letsrenst-4130056` | [青黄タッチ赤OVER100銀河超越ゴーカイレーダー（2012-03-04）](http://blog.livedoor.jp/letsrenst/archives/4130056.html) | 120 |
| `blog-livedoor-letsrenst-4136262` | [青緑超電子バイオマン（2012-03-11）](http://blog.livedoor.jp/letsrenst/archives/4136262.html) | 64 |
| `blog-livedoor-letsrenst-4144999` | [黄緑電撃戦隊チェンジマン（2012-03-18）](http://blog.livedoor.jp/letsrenst/archives/4144999.html) | 57 |
| `blog-livedoor-letsrenst-4150449` | [青黄タッチ緑（2012-03-25）](http://blog.livedoor.jp/letsrenst/archives/4150449.html) | 40 |
| `blog-livedoor-letsrenst-4150497` | [青タッチ赤黄緑超新星フラッシュマン（2012-03-25）](http://blog.livedoor.jp/letsrenst/archives/4150497.html) | 64 |
| `blog-livedoor-letsrenst-4163691` | [黄青タッチ緑光戦隊マスクマン（2012-04-08）](http://blog.livedoor.jp/letsrenst/archives/4163691.html) | 69 |
| `blog-livedoor-letsrenst-4169668` | [緑単超獣戦隊ライブマン（2012-04-15）](http://blog.livedoor.jp/letsrenst/archives/4169668.html) | 60 |
| `blog-livedoor-letsrenst-4175829` | [緑黄高速戦隊ターボレンジャー（2012-04-29）](http://blog.livedoor.jp/letsrenst/archives/4175829.html) | 54 |
| `blog-livedoor-letsrenst-4187567` | [緑青地球戦隊ファイブマン（2012-05-06）](http://blog.livedoor.jp/letsrenst/archives/4187567.html) | 70 |
| `blog-livedoor-letsrenst-4193468` | [緑青鳥人戦隊ジェットマン（2012-05-13）](http://blog.livedoor.jp/letsrenst/archives/4193468.html) | 60 |
| `blog-livedoor-letsrenst-4199587` | [赤青恐竜戦隊ジュウレンジャー（2012-05-20）](http://blog.livedoor.jp/letsrenst/archives/4199587.html) | 70 |
| `blog-livedoor-letsrenst-4205751` | [黄緑五星戦隊ダイレンジャー（2012-05-27）](http://blog.livedoor.jp/letsrenst/archives/4205751.html) | 65 |
| `blog-livedoor-letsrenst-4211221` | [黄タッチ緑赤紫青忍者戦隊カクレンジャー（2012-06-03）](http://blog.livedoor.jp/letsrenst/archives/4211221.html) | 78 |
| `blog-livedoor-letsrenst-4216796` | [黄青超力戦隊オーレンジャー（2012-06-10）](http://blog.livedoor.jp/letsrenst/archives/4216796.html) | 60 |
| `blog-livedoor-letsrenst-4222348` | [青黄タッチ赤緑激走戦隊カーレンジャー（2012-06-17）](http://blog.livedoor.jp/letsrenst/archives/4222348.html) | 119 |
| `blog-livedoor-letsrenst-4227888` | [緑青電磁戦隊メガレンジャー（2012-06-24）](http://blog.livedoor.jp/letsrenst/archives/4227888.html) | 64 |
| `blog-livedoor-letsrenst-4233573` | [赤黄星獣戦隊ギンガマン（2012-07-01）](http://blog.livedoor.jp/letsrenst/archives/4233573.html) | 60 |
| `blog-livedoor-letsrenst-4241042` | [緑単救急戦隊ゴーゴーファイブ（2012-07-11）](http://blog.livedoor.jp/letsrenst/archives/4241042.html) | 65 |
| `blog-livedoor-letsrenst-4244155` | [青単未来戦隊タイムレンジャー（2012-07-15）](http://blog.livedoor.jp/letsrenst/archives/4244155.html) | 53 |
| `blog-livedoor-letsrenst-4249670` | [赤青百獣戦隊ガオレンジャー（2012-07-22）](http://blog.livedoor.jp/letsrenst/archives/4249670.html) | 60 |
| `blog-livedoor-letsrenst-4257449` | [黄緑忍風戦隊ハリケンジャー（2012-07-29）](http://blog.livedoor.jp/letsrenst/archives/4257449.html) | 66 |
| `blog-livedoor-letsrenst-4262691` | [赤青爆竜戦隊アバレンジャー（2012-08-05）](http://blog.livedoor.jp/letsrenst/archives/4262691.html) | 63 |
| `blog-livedoor-letsrenst-4267735` | [青タッチ緑特捜戦隊デカレンジャー（2012-08-12）](http://blog.livedoor.jp/letsrenst/archives/4267735.html) | 78 |
| `blog-livedoor-letsrenst-4270026` | [青黄タッチ赤緑紫OVER100ゴーカイレーダー（2012-08-19）](http://blog.livedoor.jp/letsrenst/archives/4270026.html) | 134 |
| `blog-livedoor-letsrenst-4283028` | [黄紫タッチ赤緑魔法戦隊マジレンジャー（2012-09-02）](http://blog.livedoor.jp/letsrenst/archives/4283028.html) | 58 |
| `blog-livedoor-letsrenst-4287759` | [緑青轟轟戦隊ボウケンジャー（2012-09-09）](http://blog.livedoor.jp/letsrenst/archives/4287759.html) | 68 |
| `blog-livedoor-letsrenst-4292540` | [赤黄タッチ緑紫獣拳戦隊ゲキレンジャー（2012-09-16）](http://blog.livedoor.jp/letsrenst/archives/4292540.html) | 53 |
| `blog-livedoor-letsrenst-4297522` | [青タッチ緑炎神戦隊ゴーオンジャー（2012-09-23）](http://blog.livedoor.jp/letsrenst/archives/4297522.html) | 58 |
| `blog-livedoor-letsrenst-4303849` | [黄青タッチ緑侍戦隊シンケンジャー（2012-09-30）](http://blog.livedoor.jp/letsrenst/archives/4303849.html) | 65 |
| `blog-livedoor-letsrenst-4309243` | [赤黄青タッチ緑天装戦隊ゴセイジャー（2012-10-07）](http://blog.livedoor.jp/letsrenst/archives/4309243.html) | 130 |
| `blog-livedoor-letsrenst-4313963` | [青黄タッチ緑赤海賊戦隊ゴーカイジャー（2012-10-21）](http://blog.livedoor.jp/letsrenst/archives/4313963.html) | 102 |
| `blog-livedoor-letsrenst-4332565` | [青単カブトHF（XG5)（2012-11-11）](http://blog.livedoor.jp/letsrenst/archives/4332565.html) | 42 |
| `blog-livedoor-letsrenst-4337473` | [青紫タッチ緑7-頭脳カブトジョーカー（2012-11-18）](http://blog.livedoor.jp/letsrenst/archives/4337473.html) | 80 |
| `blog-livedoor-letsrenst-4347527` | [赤タッチ緑ミラーライダー（2012-12-03）](http://blog.livedoor.jp/letsrenst/archives/4347527.html) | 55 |
| `blog-livedoor-letsrenst-4363758` | [赤緑クロス（2012-12-24）](http://blog.livedoor.jp/letsrenst/archives/4363758.html) | 54 |
| `blog-livedoor-letsrenst-4379998` | [緑青赤タッチ黄紫メタルヒーロー（2013-01-16）](http://blog.livedoor.jp/letsrenst/archives/4379998.html) | 66 |
| `blog-livedoor-letsrenst-4388502` | [黄紫キバEF(XG5)（2013-01-29）](http://blog.livedoor.jp/letsrenst/archives/4388502.html) | 52 |
| `blog-livedoor-letsrenst-4420784` | [緑青紫ミスアメリカ（2013-03-17）](http://blog.livedoor.jp/letsrenst/archives/4420784.html) | 54 |
| `blog-livedoor-letsrenst-4466712` | [緑紫戒律555（2013-05-30）](http://blog.livedoor.jp/letsrenst/archives/4466712.html) | 55 |
| `blog-livedoor-letsrenst-4527257` | [青緑紫ナナシマスター航空機（2013-08-31）](http://blog.livedoor.jp/letsrenst/archives/4527257.html) | 44 |
| `blog-livedoor-letsrenst-4564059` | [全色Wトリロジー（2013-10-31）](http://blog.livedoor.jp/letsrenst/archives/4564059.html) | 60 |
| `blog-livedoor-letsrenst-4600296` | [黄紫タッチ緑赤・午（2014-01-01）](http://blog.livedoor.jp/letsrenst/archives/4600296.html) | 61 |
| `blog-livedoor-letsrenst-4600336` | [緑紫W・CAX（2014-01-01）](http://blog.livedoor.jp/letsrenst/archives/4600336.html) | 58 |
| `blog-livedoor-letsrenst-4870579-1` | [赤青タッチ緑ライダー電子頭脳（2015-05-09）](http://blog.livedoor.jp/letsrenst/archives/4870579.html) | 103 |
| `blog-livedoor-letsrenst-4870579-2` | [緑黄ゴセイアルティメット（2015-05-09）](http://blog.livedoor.jp/letsrenst/archives/4870579.html) | 46 |
| `blog-livedoor-letsrenst-4940329-1` | [青黄タッチ全色銀河超越VRVゴーカイレーダー（2015-09-19）](http://blog.livedoor.jp/letsrenst/archives/4940329.html) | 55 |
| `blog-livedoor-letsrenst-4940329-2` | [deck 2（2015-09-19）](http://blog.livedoor.jp/letsrenst/archives/4940329.html) | 135 |
| `blog-livedoor-letsrenst-4943966` | [緑黄シュリケンフィーバー（2015-09-27）](http://blog.livedoor.jp/letsrenst/archives/4943966.html) | 51 |
| `blog-livedoor-letsrenst-5012937` | [赤黄青タッチ緑ランディックゴセイグレート（2016-02-21）](http://blog.livedoor.jp/letsrenst/archives/5012937.html) | 93 |
| `blog-livedoor-letsrenst-5027781` | [緑黄ジュピターレジェンド（2016-03-27）](http://blog.livedoor.jp/letsrenst/archives/5027781.html) | 63 |
| `blog-livedoor-letsrenst-5044062` | [赤青レスキューレーダーオージャ（2016-05-01）](http://blog.livedoor.jp/letsrenst/archives/5044062.html) | 54 |
| `blog-livedoor-letsrenst-5044139` | [緑タッチ紫ビッグワンセブン（2016-05-01）](http://blog.livedoor.jp/letsrenst/archives/5044139.html) | 50 |
| `blog-livedoor-letsrenst-5083874` | [赤青タッチ紫赤緑ゴーカイレーダー（2016-07-31）](http://blog.livedoor.jp/letsrenst/archives/5083874.html) | 126 |
| `blog-livedoor-letsrenst-5153419` | [黄緑タッチ紫ライダー単（2016-12-26）](http://blog.livedoor.jp/letsrenst/archives/5153419.html) | 53 |
| `blog-livedoor-letsrenst-5160449-1` | [青紫闇のドギー（2017-01-09）](http://blog.livedoor.jp/letsrenst/archives/5160449.html) | 53 |
| `blog-livedoor-letsrenst-5160449-2` | [緑黄カジキアルティメット（2017-01-09）](http://blog.livedoor.jp/letsrenst/archives/5160449.html) | 54 |
| `blog-livedoor-letsrenst-5178317` | [・緑黄RC（2017-02-19）](http://blog.livedoor.jp/letsrenst/archives/5178317.html) | 60 |
| `blog-livedoor-letsrenst-5275454` | [緑タッチ青紫運試しライジング（2017-10-04）](http://blog.livedoor.jp/letsrenst/archives/5275454.html) | 40 |
| `blog-livedoor-letsrenst-5441069` | [黄緑鬼火アドベンチャー（2018-12-31）](http://blog.livedoor.jp/letsrenst/archives/5441069.html) | 53 |
| `blog-livedoor-letsrenst-5441083` | [赤青タッチ黄キラアバ（2018-12-31）](http://blog.livedoor.jp/letsrenst/archives/5441083.html) | 56 |
| `blog-livedoor-letsrenst-5441090` | [赤青嫌がらせのレスキューオージャ（2018-12-31）](http://blog.livedoor.jp/letsrenst/archives/5441090.html) | 55 |
| `blog-livedoor-letsrenst-5441119-1` | [青紫パスプニ（2019-01-01）](http://blog.livedoor.jp/letsrenst/archives/5441119.html) | 40 |
| `blog-livedoor-letsrenst-5441119-2` | [青紫パスプニ（2019-01-01）](http://blog.livedoor.jp/letsrenst/archives/5441119.html) | 40 |
| `blog-livedoor-letsrenst-5441124` | [緑黄燃える伝説ダイボイジャー（2019-01-01）](http://blog.livedoor.jp/letsrenst/archives/5441124.html) | 50 |
| `blog-livedoor-letsrenst-5441127` | [黄紫さむらい絶望大帝（2019-01-01）](http://blog.livedoor.jp/letsrenst/archives/5441127.html) | 55 |
| `blog-livedoor-letsrenst-5441130` | [青緑バビロステクター（2019-01-01）](http://blog.livedoor.jp/letsrenst/archives/5441130.html) | 50 |
| `blog-livedoor-letsrenst-5441135` | [緑単ミミーナテクター（2019-01-01）](http://blog.livedoor.jp/letsrenst/archives/5441135.html) | 50 |
| `blog-livedoor-letsrenst-5441139` | [黄青紫謎のバビロスデッキ（2019-01-01）](http://blog.livedoor.jp/letsrenst/archives/5441139.html) | 53 |
| `blog-livedoor-letsrenst-5444702` | [カブトバースキャノン（2019-01-13）](http://blog.livedoor.jp/letsrenst/archives/5444702.html) | 54 |
| `blog-livedoor-letsrenst-5446422` | [青紫タッチ緑黄デカベースロボと巨大化軍団（2019-01-19）](http://blog.livedoor.jp/letsrenst/archives/5446422.html) | 55 |
| `blog-livedoor-letsrenst-5452761` | [レンスト魂ＶＳＸ用・青紫タッチ赤パスプニル（2019-02-09）](http://blog.livedoor.jp/letsrenst/archives/5452761.html) | 42 |
| `blog-livedoor-letsrenst-5457586` | [ゾロージョーカー（2019-02-25）](http://blog.livedoor.jp/letsrenst/archives/5457586.html) | 57 |
| `blog-livedoor-letsrenst-5458509` | [ゾロー戒律（2019-02-28）](http://blog.livedoor.jp/letsrenst/archives/5458509.html) | 60 |
| `blog-livedoor-letsrenst-5458536` | [赤青タッチ緑紫捨札ライダー（2019-02-28）](http://blog.livedoor.jp/letsrenst/archives/5458536.html) | 119 |
| `blog-livedoor-letsrenst-5459131` | [ゾロー戒律（2019-03-02）](http://blog.livedoor.jp/letsrenst/archives/5459131.html) | 61 |
| `blog-livedoor-letsrenst-5460817` | [緑紫パンプストライク（2019-03-08）](http://blog.livedoor.jp/letsrenst/archives/5460817.html) | 53 |
| `blog-livedoor-letsrenst-5460830` | [黄緑紫ヤイバ龍星王（2019-03-08）](http://blog.livedoor.jp/letsrenst/archives/5460830.html) | 50 |
| `blog-livedoor-letsrenst-5460838` | [青緑ダンスバイクロッサー（2019-03-08）](http://blog.livedoor.jp/letsrenst/archives/5460838.html) | 50 |
| `blog-livedoor-letsrenst-5460843` | [巨神ゾロー（2019-03-08）](http://blog.livedoor.jp/letsrenst/archives/5460843.html) | 56 |
| `blog-livedoor-letsrenst-5460850` | [（デッキ案）黄緑紫・坊やを蹴って始が勝者（2019-03-08）](http://blog.livedoor.jp/letsrenst/archives/5460850.html) | 52 |
| `blog-livedoor-letsrenst-5462399` | [赤緑タッチ黄キラアバ（2019-03-13）](http://blog.livedoor.jp/letsrenst/archives/5462399.html) | 54 |
| `blog-livedoor-letsrenst-5462404` | [赤紫・戒律から調達、介錯でかんしゃく（2019-03-13）](http://blog.livedoor.jp/letsrenst/archives/5462404.html) | 46 |
| `blog-livedoor-letsrenst-5462417-1` | [黄青・伸縮自在（2019-03-13）](http://blog.livedoor.jp/letsrenst/archives/5462417.html) | 50 |
| `blog-livedoor-letsrenst-5462417-2` | [戦闘員ファイター（2019-03-13）](http://blog.livedoor.jp/letsrenst/archives/5462417.html) | 53 |
| `blog-livedoor-letsrenst-5462417-3` | [ネコマジン（2019-03-13）](http://blog.livedoor.jp/letsrenst/archives/5462417.html) | 48 |
| `blog-livedoor-letsrenst-5462653` | [青タッチ赤黄・侍合体ムロボ（2019-03-14）](http://blog.livedoor.jp/letsrenst/archives/5462653.html) | 54 |
| `blog-livedoor-letsrenst-5462941` | [黄緑紫エンペラーザード（2019-03-15）](http://blog.livedoor.jp/letsrenst/archives/5462941.html) | 45 |
| `blog-livedoor-letsrenst-5466270` | [緑紫赤ゲキリン（2019-03-26）](http://blog.livedoor.jp/letsrenst/archives/5466270.html) | 44 |
| `blog-livedoor-letsrenst-5469433` | [青紫ディケイド激情態（2019-04-06）](http://blog.livedoor.jp/letsrenst/archives/5469433.html) | 41 |
| `blog-livedoor-letsrenst-5474589` | [メレトロダイボウケン（2019-04-24）](http://blog.livedoor.jp/letsrenst/archives/5474589.html) | 44 |
| `blog-livedoor-letsrenst-5480354-1` | [プロミネンスサポート（2019-05-15）](http://blog.livedoor.jp/letsrenst/archives/5480354.html) | 45 |
| `blog-livedoor-letsrenst-5480354-2` | [赤青黄ワッショイ！（2019-05-15）](http://blog.livedoor.jp/letsrenst/archives/5480354.html) | 68 |
| `blog-livedoor-letsrenst-5480354-3` | [黄緑轟雷神（2019-05-15）](http://blog.livedoor.jp/letsrenst/archives/5480354.html) | 53 |
| `blog-livedoor-letsrenst-5480354-4` | [緑紫CAX（2019-05-15）](http://blog.livedoor.jp/letsrenst/archives/5480354.html) | 42 |
| `blog-livedoor-letsrenst-5480354-5` | [戒律ゴウラム（2019-05-15）](http://blog.livedoor.jp/letsrenst/archives/5480354.html) | 44 |
| `blog-livedoor-letsrenst-5520223-1` | [緑紫青サラマンデス（2019-08-19）](http://blog.livedoor.jp/letsrenst/archives/5520223.html) | 46 |
| `blog-livedoor-letsrenst-5520223-2` | [緑紫RCからエグゾス（2019-08-19）](http://blog.livedoor.jp/letsrenst/archives/5520223.html) | 45 |
| `blog-livedoor-letsrenst-5522903` | [青紫炎神剣（2019-08-26）](http://blog.livedoor.jp/letsrenst/archives/5522903.html) | 41 |
| `blog-livedoor-letsrenst-5543736-1` | [紫単SP1（2019-10-12）](http://blog.livedoor.jp/letsrenst/archives/5543736.html) | 42 |
| `blog-livedoor-letsrenst-5543736-2` | [青紫バラクティカ（2019-10-12）](http://blog.livedoor.jp/letsrenst/archives/5543736.html) | 44 |
| `blog-livedoor-letsrenst-5543736-3` | [赤紫怪人（2019-10-12）](http://blog.livedoor.jp/letsrenst/archives/5543736.html) | 45 |
| `blog-livedoor-letsrenst-5543736-4` | [SP空欄（2019-10-12）](http://blog.livedoor.jp/letsrenst/archives/5543736.html) | 45 |
| `blog-livedoor-letsrenst-5543736-5` | [超変身旋風神（2019-10-12）](http://blog.livedoor.jp/letsrenst/archives/5543736.html) | 50 |
| `blog-livedoor-letsrenst-5543740` | [赤緑変身一発アバレンオー（2019-10-12）](http://blog.livedoor.jp/letsrenst/archives/5543740.html) | 40 |
| `blog-livedoor-letsrenst-5543902` | [青紫タッチ赤パスプニル（2019-10-12）](http://blog.livedoor.jp/letsrenst/archives/5543902.html) | 40 |
| `blog-livedoor-letsrenst-5584430-1` | [赤黄緑FFRメタ（2019-12-30）](http://blog.livedoor.jp/letsrenst/archives/5584430.html) | 40 |
| `blog-livedoor-letsrenst-5584430-2` | [黄青舞獅子送還トルネード（2019-12-30）](http://blog.livedoor.jp/letsrenst/archives/5584430.html) | 40 |
| `blog-livedoor-letsrenst-5584430-3` | [緑紫青サバト（2019-12-30）](http://blog.livedoor.jp/letsrenst/archives/5584430.html) | 66 |
| `blog-livedoor-letsrenst-5584430-4` | [黄緑青アルティメットワンダー（2019-12-30）](http://blog.livedoor.jp/letsrenst/archives/5584430.html) | 42 |
| `blog-livedoor-letsrenst-5603282-1` | [青紫タッチ赤パスプニルフラッシュキング（2020-02-11）](http://blog.livedoor.jp/letsrenst/archives/5603282.html) | 40 |
| `blog-livedoor-letsrenst-5603282-2` | [黄青タッチ緑ゴーカイ車両レーダー（2020-02-11）](http://blog.livedoor.jp/letsrenst/archives/5603282.html) | 100 |
| `blog-livedoor-letsrenst-5642171-1` | [緑タッチ紫（2020-05-19）](http://blog.livedoor.jp/letsrenst/archives/5642171.html) | 45 |
| `blog-livedoor-letsrenst-5642171-2` | [超変身プニル（2020-05-19）](http://blog.livedoor.jp/letsrenst/archives/5642171.html) | 48 |
| `blog-livedoor-letsrenst-5650360-1` | [戒律メレスラ（2020-06-09）](http://blog.livedoor.jp/letsrenst/archives/5650360.html) | 40 |
| `blog-livedoor-letsrenst-5650360-2` | [黄紫キリカゲウィンガー（2020-06-09）](http://blog.livedoor.jp/letsrenst/archives/5650360.html) | 42 |
| `blog-livedoor-letsrenst-5650360-3` | [赤緑メガヘラ（2020-06-09）](http://blog.livedoor.jp/letsrenst/archives/5650360.html) | 40 |
| `blog-livedoor-letsrenst-5652609` | [天空ユナイト（2020-06-15）](http://blog.livedoor.jp/letsrenst/archives/5652609.html) | 45 |
| `blog-livedoor-letsrenst-5877968-1` | [天空ユナイト（2021-12-31）](http://blog.livedoor.jp/letsrenst/archives/5877968.html) | 50 |
| `blog-livedoor-letsrenst-5877968-2` | [青黄パスブースト（2021-12-31）](http://blog.livedoor.jp/letsrenst/archives/5877968.html) | 61 |
| `blog-livedoor-letsrenst-5877968-3` | [青黄ジャスピオン（2021-12-31）](http://blog.livedoor.jp/letsrenst/archives/5877968.html) | 40 |
| `blog-livedoor-letsrenst-5877968-4` | [緑タッチ紫（2021-12-31）](http://blog.livedoor.jp/letsrenst/archives/5877968.html) | 45 |
| `blog-livedoor-letsrenst-6001772-1` | [★青黄赤緑パスプニル（2022-12-31）](http://blog.livedoor.jp/letsrenst/archives/6001772.html) | 40 |
| `blog-livedoor-letsrenst-6001772-2` | [★青黄赤ジャスピオン（2022-12-31）](http://blog.livedoor.jp/letsrenst/archives/6001772.html) | 42 |
| `blog-livedoor-letsrenst-6001772-3` | [★緑紫黄ワンセブン（2022-12-31）](http://blog.livedoor.jp/letsrenst/archives/6001772.html) | 44 |
| `blog-livedoor-letsrenst-6050087` | [青タッチ緑タイムシャドウ（2023-07-01）](http://blog.livedoor.jp/letsrenst/archives/6050087.html) | 44 |
| `blog-livedoor-letsrenst-6050089` | [青黄赤ジャスピオン（2023-07-01）](http://blog.livedoor.jp/letsrenst/archives/6050089.html) | 40 |
| `blog-livedoor-letsrenst-6050091` | [青緑戦士の魂（2023-07-01）](http://blog.livedoor.jp/letsrenst/archives/6050091.html) | 40 |
| `blog-livedoor-letsrenst-6099409-1` | [★青黄赤ジャスピオン（2023-12-31）](http://blog.livedoor.jp/letsrenst/archives/6099409.html) | 42 |
| `blog-livedoor-letsrenst-6099409-2` | [★青タッチ黄緑紫タイムシャドウ（2023-12-31）](http://blog.livedoor.jp/letsrenst/archives/6099409.html) | 47 |
| `blog-livedoor-letsrenst-6099409-3` | [★青緑戦士の魂（2023-12-31）](http://blog.livedoor.jp/letsrenst/archives/6099409.html) | 40 |
| `blog-livedoor-letsrenst-6109130` | [緑単ファイズ（2024-02-05）](http://blog.livedoor.jp/letsrenst/archives/6109130.html) | 40 |
| `blog-livedoor-letsrenst-6170091` | [青タッチ赤紫黄・圧縮ゼロフォーム（2024-10-18）](http://blog.livedoor.jp/letsrenst/archives/6170091.html) | 40 |
| `blog-livedoor-letsrenst-6226671-1` | [青黄パスブースト（2025-12-31）](http://blog.livedoor.jp/letsrenst/archives/6226671.html) | 50 |
| `blog-livedoor-letsrenst-6226671-2` | [ET単大会用（2025-12-31）](http://blog.livedoor.jp/letsrenst/archives/6226671.html) | 86 |
| `blog-livedoor-letsrenst-6233117` | [【制限大会用】緑紫「特徴：女」（2026-02-25）](http://blog.livedoor.jp/letsrenst/archives/6233117.html) | 42 |
| `blog-livedoor-letsrenst-6236827` | [【制限大会用】青単大会用・フルブラストカスタム（2026-03-29）](http://blog.livedoor.jp/letsrenst/archives/6236827.html) | 40 |
| `blog-livedoor-letsrenst-6236868` | [【制限大会用】青単グレートタイタン（2026-03-29）](http://blog.livedoor.jp/letsrenst/archives/6236868.html) | 40 |

どのデッキも、Lv2 同士で最後まで対局できることを確かめています（ブログのデッキは 1 デッキ 2 局ずつ。`blog-rabbit-9984932` の 1 局だけ、両者がクライマックス刑事でパワーを山札に戻し続けて 6,000 手で決着しませんでした）。livedoor「letsrenst」のデッキは Lv2 同士の 810 局（全 373 デッキが 1 局以上）で、すべて決着しました。
