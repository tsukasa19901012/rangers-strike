# 対戦台用のデッキ（スターター以外）

`scripts/cpu-arena.ts --decks` に、ここにある `<id>.json` の id（ファイル名から `.json` を除いたもの）を渡せます。スターターの id と混ぜても使えます。形はスターターのデッキと同じ（`entries` にカード番号と枚数）です。

スターターはお試し用のデッキで、勝つために組まれたものではありません。CPU の強さは、勝つために組まれたデッキでも測るために置いています。

## 大会のデッキ（レシピそのまま、3 個）

[atwiki のデッキサンプル](https://w.atwiki.jp/renst/pages/225.html)のうち、カード名と枚数がそろっていたもの。カード番号は載っていないので、名前から直しました。同じ名前で効果の違うカード（疾風流超忍法 RS-026 と RS-247 など）は、そのデッキが使われた時期の版を選んでいます。

| id | デッキ | 時期 |
|---|---|---|
| `zero-one` | 01デッキ | 2007 秋 フェスティバル ガンスリンガー |
| `night-fever` | ナイトフィーバー | 2008 春 フェスティバル ガンスリンガー（上位の半数以上が使用） |
| `blue-yellow-rush` | 青黄速攻 | 2008 夏 ツアーフェスティバル チャンピオン大会 優勝 |

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

組めなかったもの（候補のカードが少なく 40 枚に届かない）: 01FFR（39 枚）、緑単ゴレンジャー（30 枚）、黄緑カラクリボール（39 枚）、ガトリングガイン（33 枚）、緑黄RCビート（36 枚）、赤単ミラワゼール（6 枚）、黒緑車両ン・マデッキ（36 枚）、緑黒ビッグワンパー（18 枚）、黄青アギトデッキ（12 枚）、緑赤コマ埋めビート（21 枚）、颯爽登場！！！三神合体！！！（39 枚）、緑黒ライオシンドローム（39 枚）。

どのデッキも、Lv2 同士で最後まで対局できることを確かめています。
