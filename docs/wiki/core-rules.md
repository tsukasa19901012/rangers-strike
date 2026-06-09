# コアルール

## ゲーム概要

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/index.html
* https://w.atwiki.jp/renst/pages/11.html

概要:
2人対戦TCG。先攻・後攻が交互にターンを進行し、相手に7ダメージを与えるか、相手が必須ドローに失敗したとき勝利する。

ルール:
* デッキ40枚以上、同名3枚まで（例外あり）
* 初期手札7枚
* ジャンケン勝者が先攻（先攻/後攻の選択不可）
* 先攻1ターン目はスタートフェイズを省略しチャージフェイズから開始
* ターンは5フェイズ: スタート → チャージ → ラッシュ → バトル → エンド
* 各フェイズ内の行動順序に制限はない（FAQ）

実装仕様:
* `GameState.phase`: start | charge | rush | battle | end
* `GameState.turn`, `activePlayer`, `firstPlayer`
* `createGame`: 先攻は phase=charge, turn=1
* `PHASE_ORDER`, `nextPhase`, `end_phase` アクション

タイミング:
* フェイズ遷移は `end_phase` で次フェイズへ
* バトルフェイズ終了前に必須バトル進入がある場合は `end_phase` 不可

制約:
* ターンプレイヤーのみフェイズ行動（反応窓中は応答プレイヤーが優先）

必要State:
* `GameState.phase`, `GameState.activePlayer`, `GameState.winner`

必要Action:
* `end_phase`, `charge`, `draw_start`, `return_all_battle_to_rush`, `release_all_commands`

必要Event:
* フェイズ開始/終了ログ

依存:
* startPhase.ts, applyAction.ts

不明点:
* エンドフェイズ(5)の公式テキスト詳細は rule_tarn.html#5 が画像主体でテキスト抽出未完了 → UNKNOWN

confidence: HIGH（フェイズ構造・先攻省略・勝敗条件）/ MEDIUM（エンドフェイズ詳細）

---

## デッキ構築

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_preparation.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
40枚1組のデッキ。同名カードは3枚まで。

ルール:
* 2人それぞれ1デッキ
* 戦闘員等は3枚超可（カード文面・FAQ参照）

実装仕様:
* `DECK_MIN_SIZE = 40`, `DECK_NAME_COPY_LIMIT = 3`
* `deckCopyUnlimited(card)` で例外判定

タイミング:
* ゲーム開始前のみ

制約:
* 本シミュレーターは L1/L2/L3 + SR-001 のカードプール

必要State:
* なし（デッキビルダーは localStorage）

必要Action:
* なし

必要Event:
* なし

依存:
* packages/cards/src/deckRules.ts

不明点:
* 禁止カードリスト（atwiki 禁止カード一覧）未照合

confidence: HIGH

---

## ゾーン定義

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_card.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
山札・手札・捨札・パワー・コマンド・ラッシュ・バトル・オペレーション（常駐）等。

ルール:
* パワーゾーン: 枚数無制限。表=チャージ、裏=ダメージマーカー
* コマンドゾーン: 最大5枚ホールド。超過分は捨札
* 手札枚数上限なし
* 捨札は公開情報（オモテ向き）

実装仕様:
* `PlayerState`: deck, hand, discard, power, command, rush, battle, operation
* フレームワーク拡張: exile, commander
* `CardInstance.faceDown`（パワー裏）, `commandHeld`（ホールド）

タイミング:
* チャージで power/command へ
* ダメージで power 裏返し

制約:
* コマンド5枚超は効果による配置時のみ捨札

必要State:
* ZoneName, CardInstance 向きフラグ

必要Action:
* charge, 各種 move / rush / discard

必要Event:
* leave_field, damage_applied

依存:
* helpers.ts, damagePayment.ts

不明点:
* プレイシート上の「コマンダー」公式運用（XG）— 本エンジンは framework のみ

confidence: HIGH

---

## パワー計算

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html#2
* https://www.grnrngr.com/documents/rangersstrike/faq/
* https://w.atwiki.jp/renst/pages/110.html

概要:
パワー = 自軍パワーゾーン枚数 + **敵軍コマンドゾーンのマルチカテゴリカード枚数**。表裏不問。使用後も自軍パワーカードは除去しない。

ルール:
* 「パワーゾーンの枚数」と「パワーの数」は一致しない場合がある（効果参照時は文面確認）
* チャージ1ターン1枚（任意）
* 必要パワーを満たさないカードは使用不可

実装仕様:
* `canAffordPower` / `payPowerCost`: **現状 `player.power.length` のみ** — 敵マルチコマンド未加算
* `parsePowerCost`, `6+` 等の追加条件は別処理

不足:
* 敵 command 上マルチカテゴリ枚数を power 計算に加算

推奨拡張:
* `countAvailablePower(state, playerId)` — power.length + opponent マルチ command 数

リスク:
* マルチコマンド加速デッキとの対戦で過小評価

タイミング:
* ラッシュ・オペ使用直前

制約:
* 追加条件は必要パワー充足後に別途満たす（FAQ）

必要State:
* `players[id].power[]`

必要Action:
* charge

必要Event:
* なし

依存:
* helpers.ts, zordSetup.ts

不明点:
* なし

confidence: HIGH

---

## コマンド・ホールド

出典:
* https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html
* https://www.grnrngr.com/documents/rangersstrike/faq/

概要:
カード1枚使用につきコマンド1枚ホールド。ホールド=横向き、リリース=縦向き。

ルール:
* 使用するカードと同カテゴリのリリース状態コマンドが必要
* スタートフェイズで全ホールドをリリース
* ホールド上限5枚

実装仕様:
* `hasCommandForCardUse`, `PendingCommandPayment`
* `COMMAND_ZONE_MAX = 5`
* カテゴリ支払い: `initiate_command_payment` / `resolve_command_payment`
* RS-010 プリズム等: `prismSubstitute`

タイミング:
* ラッシュ・オペ・カウンター・※バトル進入の直前

制約:
* 5枚満杯時は効果以外で入替不可（FAQ）

必要State:
* `commandHeld`, `battleEntryHoldReady`, `rushCategoryHoldReady`, `counterCategoryHoldReady`

必要Action:
* initiate_command_payment, resolve_command_payment, release_all_commands

必要Event:
* category_hold_resolved

依存:
* commandPayment.ts, restrictions.ts

不明点:
* マルチカテゴリの両方ホールド要件 — カード別（keywords.md）

confidence: HIGH
