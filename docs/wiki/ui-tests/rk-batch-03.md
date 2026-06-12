# RK UI テスト — バッチ 03（RK-021〜RK-030）

出典: [docs/wiki/cards/RK-021.md](../cards/RK-021.md) 〜 [RK-030.md](../cards/RK-030.md)

完成版スイート: `apps/web/lib/wikiComplete.test.ts`（`generated/all-specs.json` に含まれる）

共通観点は [rk-batch-01.md](./rk-batch-01.md) と同じ。本バッチは ID 帯ごとの wiki 仕様メモ。

## カード別仕様

| ID | 名前 | 種別 | power | cat | wiki 要点 | DSL keyword |
|----|------|------|-------|-----|-----------|-------------|
| RK-021 | クロックアップ | permanent | 4 | OT | ※常駐、加速ユニット被アタックでバトル不成立 | resident |
| RK-022 | ライダーパス | permanent | 0 | OT | ※常駐、DEN-O 4枚重ね・ラッシュフェイズ置換 | resident |
| RK-023 | 仮面ライダー1号 | unit S | 0 | ET | SP1、CN=RC | SP1 |
| RK-024 | サイクロン号 | vehicle S | 0 | ET | ライド BP+1000 | ride_bp_boost_1000 |
| RK-025 | 電波人間タックル | unit S | 0 | ET | 【電波投げ】敵山札2枚公開→男ユニットを敵コマンドへ | reveal_enemy_deck_hold_2 |
| RK-026 | がんがんじい | unit S | 0 | ET | 敵Sからアタック不可、仮面ライダーをラッシュへ | no_attack_from_enemy_s_bp2000, return_kamen_to_rush |
| RK-027 | 仮面ライダーBLACK | unit S | 0 | ET | ライド BP+1000 | ride_bp_boost_1000 |
| RK-028 | バトルホッパー | vehicle S | 0 | ET | ライドなしでバトル進入可 | can_enter_battle_without_ride |
| RK-029 | 仮面ライダークウガMF | unit S | 4 | MA | ライド中敵Sからアタック不可、【マイティキック】BP+1000 | no_attack_while_riding_enemy_s, per_ally_named_* |
| RK-030 | トライチェイサー | vehicle S | 1 | ET | ライド BP+1000、【無線通信】山札1枚見て戻す | ride_bp_boost_1000, deck_scry_one |

## ルール連携テスト（完成版）

| ケース | 関連カード | ルール |
|--------|------------|--------|
| RK-021×RS-018 否定優先 | RK-021, RS-018 | RULE-KW-07（バトル不成立が優先） |
| RK-028 ライドなし進入 | RK-028 | RULE-BATTLE-01（※バトル進入例外） |
| RK-024/027/030 ライド BP | RK-024, RK-027, RK-030 | RULE-KW-08 |
