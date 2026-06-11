# キーワード・用語

## カテゴリ

出典:
* https://w.atwiki.jp/renst/pages/11.html
* https://w.atwiki.jp/renst/pages/70.html
* https://w.atwiki.jp/renst/pages/1559.html
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html

概要:
WB / ET / OT / MA / DA / マルチ等。

ルール（マルチカテゴリ — atwiki 1559）:
* 通常使用: 持つ**全**カテゴリのコマンドが自軍コマンドゾーンに存在し、いずれか1カテゴリをホールド
* 効果ラッシュ/オペ: コマンド参照不要（ゴールドプラチナム等）
* コール/リード: コマンドゾーンに必要カテゴリが揃っている必要あり
* 敵へのデメリット: 自軍が敵コマンドに置いたマルチ1枚 = 敵パワー+1（カテゴリ数に関わらず1）
* 効果参照: 常に全カテゴリを参照（単一カテゴリとして扱えない）

実装仕様:
* `cardCategories()`, マルチ2ホールド — restrictions.ts
* 敵パワー加算 — **未実装**（core-rules.md）

confidence: HIGH

---

## ユニットサイズ S / M / L

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html

概要:
S=レンジャー、M=マシン、L=合体ロボ。ゾードアップの基礎。

ルール:
* NC はサイズ混在可
* ゾードアップで S→M→L 置換・合体

実装仕様:
* `isSmallUnit`, `isMediumUnit`, size in CardDefinition
* fusion / zord in zord.ts

confidence: HIGH

---

## SP（ストライクポイント）

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html

概要:
1以上でストライク可能。NC/効果で付与・変更。

ルール:
* 「SP1」「SP2」等はストライク可否とダメージ数に影響（カードによる）

実装仕様:
* `sp` on CardDefinition, `canStrikeUnit`
* NC による SP 付与

confidence: HIGH

---

## コンビネーションナンバー（CN）

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html

概要:
バトル左から数えた位置と一致で NC 発動。

実装仕様:
* `comboNumber` on CardDefinition

confidence: HIGH

---

## 常駐オペレーション

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html
* https://www.grnrngr.com/documents/rangersstrike/faq/
* https://w.atwiki.jp/renst/pages/1296.html
* https://w.atwiki.jp/renst/pages/149.html

概要:
時計アイコン。各プレイヤー1枚。常駐置き場に配置し離れるまで有効。

ルール:
* 非常駐オペ使用では既存常駐は捨札されない（atwiki Q2 / FAQ）
* 同名常駐をコスト目的で上書き可（atwiki Q1 / FAQ）
* 上書き時は重ね順の並べ替え不可（atwiki Q3）

実装仕様:
* `operation` zone, `hasOperationEffect`
* RS-072: 相手常駐無効

confidence: HIGH

---

## カウンター

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html
* https://w.atwiki.jp/renst/pages/1295.html
* https://w.atwiki.jp/renst/pages/260.html

概要:
逆矢印アイコン。敵軍ターン中のみ使用。自軍ターン中は不可。

ルール:
* 通常オペ同様コマンドホールド必要
* 相手にリリースコマンドがなければカウンター不可
* 発動タイミングはカード文面依存

実装仕様:
* `isHandCounterCard`, `getCounterEffectId`, `operationCounters.ts`

confidence: HIGH

---

## チェイス

出典:
* https://w.atwiki.jp/renst/pages/1292.html

概要:
ライド中ユニットが「ユニットでなくなる時」、ライド中ビークルを捨て、別ビークルへライド可能。

ルール:
* パワー送り・コマンド送り・撃破等（レジストより広い）
* 「撃破された」事実は変わらない
* ライド可能ビークル必須（RC付与はしない）
* ラッシュ上ビークルへ直接ライド → ラッシュ待機可

実装仕様:
* **未実装**（framework 外）

confidence: HIGH（ルール）/ LOW（実装）

---

## タッグストライク

出典:
* https://w.atwiki.jp/renst/pages/750.html
* packages/cards/src/glossaryImplementation.ts

概要:
4人2チーム特別ルール。勝利=相手2人各5ダメージ。本シミュレーター非対象。

ルール:
* 常駐4枚・NC/パワー/コマンド共有
* 禁止: 命の泉、メディテーション、ドラゴンレンジャー 等

実装仕様:
* 未実装（意図的）

confidence: HIGH

---

## コマンドゾーン

出典:
* https://w.atwiki.jp/renst/pages/108.html
* https://w.atwiki.jp/renst/pages/151.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
コマンドカードを置くゾーン。最大5枚。

ルール（atwiki 108）:
* 5枚満杯時の入替は効果以外不可（RS-030, RS-064 等の効果で置換）
* 5枚超過は捨札
* マルチカテゴリ1枚 = 敵パワー+1
* ホールドユニットをコマンドへ送る場合はリリース状態（Q1）

---

## コマンド

出典:
* https://w.atwiki.jp/renst/pages/151.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
コマンドゾーンのカード。使用時に同カテゴリをホールド。

ルール（atwiki 151）:
* マルチカテゴリ使用時は全カテゴリのコマンド存在確認 + いずれかホールド
* スタートで全ホールドリリース
* 最大5枚、種類不問でチャージ可
* コール/リード/護星天使: 特定行動時のみコマンド代用、スタートリリース不可
* 効果によるラッシュ/オペ: 通常ホールド不要（個別例外あり）
* 効果ホールド vs 正規ホールド — 参照効果では区別

confidence: HIGH

---

## レジスト

→ battle.md

confidence: HIGH

---

## ※（バトル進入ホールド）

→ battle.md / unitEffects.json

confidence: HIGH

---

## ブラスト（XG）

出典:
* https://www.grnrngr.com/documents/xgather/information/（**補助情報**）

概要:
XG独自。本リポジトリスコープ外。

confidence: LOW

---

## ウイング

出典:
* https://w.atwiki.jp/renst/pages/1537.html

概要:
ラッシュエリアでホールドし、バトルエリアに出さずラッシュからアタック。

ルール:
* 自軍バトルフェイズ中のみ
* 発動ターンはバトルエリアに出られない
* ラッシュエリア以外からは不可
* バトル進入妨害下でも発動可
* SP1以上でもウイング発動ターンはストライク不可
* バトルエリア出場後にラッシュ戻り→ウイングで同一ターン2回アタック可
* リリース手段があれば同一ユニットで複数回ウイング可

実装仕様:
* `hold_for_wing`, `canWingAttackFromRush`, `WING_TURN_NO_STRIKE`（P0 対応済 2026-06-11）
* 複数回ウイング / BA→rush→wing は P2

confidence: HIGH（ルール）/ **中**（実装）

---

## スクラム

出典:
* https://w.atwiki.jp/renst/pages/1290.html

概要:
「これの CN より 1 多い CN を持つユニットが**次**に並んでいる間、これはアタックされない」

実装仕様:
* `scrumBlocksAttack` — 右隣 CN === 自 CN + 1 のみ（2026-06-11）
* 旧 XG 全体昇順 variant は削除

confidence: HIGH（ルール）/ **高**（実装）

---

## 否定優先・リファレンス

出典:
* https://www.grnrngr.com/documents/rangersstrike/faq/

ルール:
* 「～できない」最優先
* 「可能なら～」は不可能時は不発
* 「ユニット」= rush/battle 上
* 「～のカード」= ゾーン内カード实体

実装仕様:
* restrictions.ts, cannotEnterBattle 等

confidence: HIGH
