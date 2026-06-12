# 完成版ルールテストケース一覧

出典: [core-rules.md](../core-rules.md) / [phases.md](../phases.md) / [rush.md](../rush.md) / [battle.md](../battle.md) / [damage.md](../damage.md) / [timing.md](../timing.md) / [keywords.md](../keywords.md)

実装:
- 仕様データ: `apps/web/lib/wikiTestSpecs/ruleSpecs.ts`
- エンジン E2E: `packages/engine/src/wikiRulesComplete.test.ts`

## コアルール（core-rules.md）

| ID | タイトル | 検証内容 |
|----|----------|----------|
| RULE-CORE-01 | 先攻1ターン目スタート省略 | `phase=charge`, `turn=1` |
| RULE-CORE-02 | 勝利条件 | 7ダメージ / 必須ドロー失敗 |
| RULE-CORE-03 | デッキ構築 | 40枚以上・同名3枚まで |
| RULE-CORE-04 | ゾーン定義 | コマンド5枚上限・パワー裏=ダメージ |

## フェイズ（phases.md）

| ID | タイトル | 検証内容 |
|----|----------|----------|
| RULE-PHASE-01 | スタートフェイズ | リリース / BA→ラッシュ / ドロー（任意順） |
| RULE-PHASE-02 | チャージフェイズ | 1ターン1枚・スキップ可 |
| RULE-PHASE-03 | ラッシュフェイズ | パワー→追加条件→ホールド→ラッシュ |
| RULE-PHASE-04 | バトルフェイズ | 進入→NC→アタック/ストライク/パス |
| RULE-PHASE-05 | エンドフェイズ | TurnModifiers クリア・ターン交代 |

## ラッシュ（rush.md）

| ID | タイトル | 検証内容 |
|----|----------|----------|
| RULE-RUSH-01 | 基本ラッシュ | 効果ラッシュはコマンド不要（特記なき限り） |
| RULE-RUSH-02 | ゾードアップ | 全融合パートナー必要・zord_setup |

## バトル（battle.md）

| ID | タイトル | 検証内容 |
|----|----------|----------|
| RULE-BATTLE-01 | アタック | BP比較・相討ち・空バトル不可 |
| RULE-BATTLE-02 | 相打ち | 同時撃破・レジスト個別 |
| RULE-BATTLE-03 | NC | 左詰め位置・comboNumber 一致 |
| RULE-BATTLE-04 | レジスト | バトル撃破時のみ・registerHeld |
| RULE-BATTLE-05 | ウイング | ラッシュアタック・BA/ストライク制限 |
| RULE-BATTLE-06 | 代用・キャンセル | RS-006 / RS-018 カウンター |

## ダメージ（damage.md）

| ID | タイトル | 検証内容 |
|----|----------|----------|
| RULE-DMG-01 | ストライク | SP要件・pendingStrike |
| RULE-DMG-02 | ダメージ支払い | パワー裏返し・damage 同期 |

## タイミング（timing.md）

| ID | タイトル | 検証内容 |
|----|----------|----------|
| RULE-TIME-01 | 効果スタック優先度 | 離場→レジスト→ストライク→… |
| RULE-TIME-02 | 効果の解決 | 空撃ち可・強制効果・順序選択 |

## キーワード（keywords.md / glossary）

| ID | タイトル | 検証内容 |
|----|----------|----------|
| RULE-KW-01 | マルチカテゴリ | 全カテゴリコマンド+ホールド・敵パワー+1 |
| RULE-KW-02 | 常駐オペ | 各1枚・上書き・非常駐では残る |
| RULE-KW-03 | カウンター | 敵軍ターンのみ・リリースコマンド必要 |
| RULE-KW-04 | チェイス | ライド離場時ビークル切替 |
| RULE-KW-05 | ウイング（完全） | 複数回・BA戻り再ウイング |
| RULE-KW-06 | スクラム | 右隣 CN = 自CN+1 でアタック不可 |
| RULE-KW-07 | 否定優先 | できない > 可能なら〜 |
| RULE-KW-08 | ライド | BP修飾・ライドオフ/チェイス |

## スコープ外（テスト対象外）

| 項目 | 理由 |
|------|------|
| タッグストライク | 4人ルール・意図的未実装 |
| XG ブラスト | 商品拡張・コアルール外 |
