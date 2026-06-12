# 完成版カードテストマトリクス

`full-playable` 全 **1849** 枚を wiki 準拠で検証。

生成: `npx tsx apps/web/scripts/generate-wiki-complete-specs.ts`  
データ: `apps/web/lib/wikiTestSpecs/generated/all-specs.json`

## プレフィックス別

| プレフィックス | 枚数 | 主な種別 | wiki 出典 |
|----------------|------|----------|-----------|
| RS | 690 | unit / operation | Legend 1–3 コア |
| RK | 335 | unit / operation / vehicle | マスクドライダー EXP 等 |
| XG1–XG7 | 637 | unit / commander | X-Gather 各弾 |
| RM | 62 | unit | — |
| XP | 32 | operation | エクスパンション |
| PR | 27 | operation | プロモ |
| BK | 19 | operation | ブースター |
| PK | 14 | operation | — |
| その他 | 17 | mixed | SR/SX/SK/XC/PM/SM |

## 種別別テスト観点

| 種別 | 枚数 | カタログ | DSL | UI | 追加 |
|------|------|----------|-----|-----|------|
| operation | 242 | ○ | ○ | promoted-ui + 経路 | effect kind / drop route |
| unit | 1507 | ○ | ○ | promoted-ui | bp / sp / size |
| vehicle | 83 | ○ | ○ | promoted-ui | bp / ride キーワード |
| commander | 17 | ○ | ○ | promoted-ui | — |

## RK 手動バッチ（オペレーション詳細）

| バッチ | ID 帯 | 枚数 | ドキュメント |
|--------|-------|------|--------------|
| 01 | RK-001〜010 | 10 | [rk-batch-01.md](./rk-batch-01.md) |
| 02 | RK-011〜020 | 10 | [rk-batch-02.md](./rk-batch-02.md) |
| 03 | RK-021〜030 | 10（全種別） | [rk-batch-03.md](./rk-batch-03.md) |

RK オペレーション全51枚は `all-specs.json` の `cardType=operation` + `RK-` プレフィックスで網羅。

## 代表 E2E シナリオ（カード×ルール）

| シナリオ | カード | ルール ID |
|----------|--------|-----------|
| NC コンボ | RS-001, RS-002 | RULE-BATTLE-03 |
| バトルキャンセル | RS-006 | RULE-BATTLE-06 |
| ゾードアップ | RS-050〜052 | RULE-RUSH-02 |
| 常駐上書き | RK-001 | RULE-KW-02 |
| クロックアップ×隠流 | RK-021, RS-018 | RULE-KW-07 |
| チェイス/RC | RK-017 | RULE-KW-04 |
| ライド BP | RK-024, RK-030 | RULE-KW-08 |
