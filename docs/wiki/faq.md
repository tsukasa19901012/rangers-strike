# FAQ 整理（公式 Q&A）

出典:
* https://www.grnrngr.com/documents/rangersstrike/faq/
* https://www.grnrngr.com/documents/rangersstrike/faq/errata.html
* docs/wiki/sources/grnrngr/errata.html（取得済）
* https://w.atwiki.jp/renst/pages/1974.html（**補助情報** — コミュニティQ&A）

---

## リファレンス（効果解釈）

| 項目 | 裁定 |
|------|------|
| 否定文 | 最優先 |
| 「可能なら～」 | 「～できない」中は不可能 |
| 「ユニット」 | rush/battle 上のユニットとして扱われるカード |
| 「コマンド」 | コマンドゾーンのコマンドとして扱われるカード |
| 「Sユニットのカード」等 | ゾーン内の該当カード实体 |
| BP参照 | 修正後の値 / 「本来の値」は印刷値 |
| BP+ | 重複加算 |
| BP「～になる」 | 加算ではなく上書き。複数時低い方 |
| 計算順 | 指定値 → + → - |
| 同時発動 | ターンプレイヤーが順序決定 |

confidence: HIGH

---

## 山札・捨札・手札

| Q | A | 実装 |
|---|----|------|
| 山札0で即敗？ | いいえ。引くべき時に引けないと敗北 | checkWinner on draw fail |
| 捨札の置き方 | オモテ公開、順不同可 | discard zone |
| 手札上限 | なし | — |

confidence: HIGH

---

## パワー・コマンド

| Q | A | 実装 |
|---|----|------|
| ダメージ時裏返し選択 | 自由選択 | PendingDamagePayment |
| パワー並べ替え | ルール違反ではない、マナー | — |
| パワー上限 | なし | — |
| 裏パワー確認 | 不可（非公開） | faceDown |
| コマンド5満杯時入替 | 効果以外不可 | COMMAND_ZONE_MAX |
| コマンド上限 | 5枚、超過は捨札 | enforced |

confidence: HIGH

---

## バトル・NC

| Q | A | 実装 |
|---|----|------|
| スタート戻し順 | 任意 | return_all_battle_to_rush |
| 進入後必須アタック？ | いいえ、パス可 | pass_battle_entry |
| NC必須？ | 条件満たせば必須。「～してもよい」のみ任意 | combo resolver |
| カテゴリ混在NC | 可 | — |
| サイズ混在NC | 可 | battlePosition |
| 1番離脱後2番 | 2番は1番扱い、CN2不可 | position recalc |
| 撃破後再度CN2 | 可 | — |
| 並び変化のみ | NC再発動しない | enter-only trigger |

confidence: HIGH

---

## ラッシュ・ゾード

| Q | A | 実装 |
|---|----|------|
| 同名複数 | 可 | — |
| 合体捨て元 | rush/battle のユニットのみ | zord validation |
| ラッシュ手順 | パワー→追加可否→ホールド→追加実行→ラッシュ | documented in rush.md |
| 追加条件でパワー満たす | 不可 | — |
| S→command | リリースで置く | — |
| 捨て/コマンド選択 | 空きがあっても捨て選択可 | zord destination |

confidence: HIGH

---

## レジスト

| Q | A | 実装 |
|---|----|------|
| 相討ちでレジスト | 可 | PendingRegister |
| 「バトル」の意味 | BP比較処理。効果撃破では不可 | resist.ts |
| 勝っても撃破 vs レジスト | レジスト不可 | win_but_destroyed rule |

confidence: HIGH

---

## オペレーション

| Q | A | 実装 |
|---|----|------|
| 対象なしオペ | コスト目的で使用可、効果不発で捨札 | legal play |
| 常駐上書き（コスト目的） | 可 | operation replace |
| 非常駐使用で常駐消える？ | いいえ | — |

confidence: HIGH

---

## その他

| Q | A | 実装 |
|---|----|------|
| 追加ドロー | 1回のみ | startPhase |
| フェイズ内順序 | 自由 | legalActions |
| 先攻選択 | 不可、ジャンケン勝者が先攻 | createGame |
| 対戦中メモ | 公認大会不可 | — |

confidence: HIGH

---

## 公式エラッタ（grnrngr errata.html）

出典: https://www.grnrngr.com/documents/rangersstrike/faq/errata.html

| カード | 修正要点 |
|--------|----------|
| RS-052 | 超シールド進化: 「これを」→「このユニットを」 |
| RS-009 | 合体戻し: 「そうしたとき」→「そうして撃破したLが捨札になったとき」 |
| RS-065 | 一点突破: ストライク可能撃破 → SP1以上/SP!ユニット撃破 |
| RS-003 | バトルダンス: 「2つホールドするごとに」→「2つホールドして」（1回） |
| RS-058 | イエローサンダー: 「アタックするとき」明記 |
| RS-018 | 隠流忍術: 代用対象はアタッカー以外に限定 |

リポジトリ `errata.ts` の ERRATA_EFFECT_TEXT は RS-009/018/030/067 を収録。RS-003/052/058/065 は cards.json / wikiReference 側で要確認。

confidence: HIGH

---

## エラッタ（リポジトリ管理・wikiwiki未取得分）

出典:
* packages/cards/src/errata.ts
* https://wikiwiki.jp/renst/エラッタ（403 — grnrngr で代替）

| カード | 内容 |
|--------|------|
| RS-030 | ターン終了時ホールド→手札 |
| RS-067 | ストライクカウンター |
| RS-026 | ラッシュ誘発 vs カウンター順（wikiwiki Q&A） |

confidence: HIGH（リポジトリ内）/ MEDIUM（wikiwiki 原文未再取得）

---

## 補助情報: atwiki ルール質問所（1974）

**公式FAQではない。** 実装判断には grnrngr FAQ を優先。

| トピック | コミュニティ回答要点 |
|----------|---------------------|
| 「かわりに」効果 | 読み替えがない場合、前提不可でも発動可 |
| ウイング+撃破効果 | バトル敗北でも相手の on-destroy 効果は発動。ただし「撃破した」扱いは相打ち時のみ双方 |
| トリプルマルチ | 手札使用時は3カテゴリ全コマンド必要 |
| レジスト | アタック経由でなくても BP比較バトルなら可 |
| ラッシュ処理順 | 選定→ラッシュ処理→ラッシュした/された時（割り込みで条件変化は巻き戻し議論あり） |

confidence: LOW（補助情報）

---

## 補助情報: atwiki ルール質問所（1974）

出典:
* https://w.atwiki.jp/renst/pages/1974.html

**注意:** コミュニティ回答。公式FAQと矛盾する場合は grnrngr FAQ を優先。

| トピック | コミュニティ見解 | エンジン照合 |
|----------|------------------|--------------|
| 「～するかわりに」 | 読み替えがなければ「かわりに」以前が不可能でも発動可 | 要カード別 |
| ウイング+SP条件撃破 | バトル敗北でも効果撃破は起きうるが、バトル撃破扱いにならない場合あり | 未実装（ウイング） |
| 相打ち vs 効果撃破 | 相打ちは双方バトル撃破。効果自壊は別 | battle.ts 相打ち実装済 |
| トリプルマルチ使用 | 全カテゴリコマンド必要（コマンド置きは敵パワー+1） | 敵パワー加算未実装 |
| レジスト「バトル」 | アタック経由でなくてもBP比較バトルならレジスト可 | resist.ts 準拠 |
| ラッシュ処理順 | ラッシュする時→されるとき→ラッシュ→出るとき→出た時 | timing.md 参照 |

confidence: LOW（補助情報）
