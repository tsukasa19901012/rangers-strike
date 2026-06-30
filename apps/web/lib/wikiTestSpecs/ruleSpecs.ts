import type { WikiRuleCompleteSpec } from "./types";

/**
 * 完成版ルール E2E テスト仕様 — docs/wiki/*.md 各セクションに対応。
 * 実装: packages/engine/src/wikiRulesComplete.test.ts
 */
export const WIKI_RULE_COMPLETE_SPECS: WikiRuleCompleteSpec[] = [
  // core-rules.md
  {
    ruleId: "RULE-CORE-01",
    wikiRef: "docs/wiki/core-rules.md#ゲーム概要",
    title: "先攻1ターン目はスタート省略・チャージから開始",
    assertions: [
      "createGame 後 firstPlayer の phase は charge",
      "turn は 1、activePlayer は firstPlayer",
    ],
  },
  {
    ruleId: "RULE-CORE-02",
    wikiRef: "docs/wiki/core-rules.md#勝利条件",
    title: "7ダメージまたは必須ドロー失敗で勝敗",
    assertions: [
      "damage が 7 で winner 確定",
      "スタートフェイズで山札0の必須ドロー失敗で敗北",
      "山札0のみでは即敗北しない",
    ],
    fixtureCardIds: ["RS-053"],
  },
  {
    ruleId: "RULE-CORE-03",
    wikiRef: "docs/wiki/core-rules.md#デッキ構築",
    title: "デッキ40枚以上・同名3枚まで",
    assertions: [
      "DECK_MIN_SIZE = 40",
      "DECK_NAME_COPY_LIMIT = 3（例外カード除く）",
    ],
  },
  {
    ruleId: "RULE-CORE-04",
    wikiRef: "docs/wiki/core-rules.md#ゾーン定義",
    title: "コマンドゾーン最大5枚・超過は捨札",
    assertions: [
      "command ゾーンが5枚を超えると捨札へ",
      "パワーは枚数無制限・裏向きはダメージマーカー",
    ],
    fixtureCardIds: ["RS-030", "RS-064"],
  },
  // phases.md
  {
    ruleId: "RULE-PHASE-01",
    wikiRef: "docs/wiki/phases.md#1-スタートフェイズ",
    title: "スタート3行程を好きな順に実行",
    assertions: [
      "release_all_commands でホールド解除",
      "return_all_battle_to_rush でバトル→ラッシュ",
      "draw_start で1枚ドロー",
      "各サブステップは1ターン1回",
    ],
  },
  {
    ruleId: "RULE-PHASE-02",
    wikiRef: "docs/wiki/phases.md#2-チャージフェイズ",
    title: "チャージ1ターン1枚・スキップ可",
    assertions: [
      "charge で手札→power/command（オモテ）",
      "hasChargedThisTurn で2回目不可",
    ],
  },
  {
    ruleId: "RULE-PHASE-03",
    wikiRef: "docs/wiki/phases.md#3-ラッシュフェイズ",
    title: "ラッシュ手順: パワー→追加条件→ホールド→実行→ラッシュ",
    assertions: [
      "必要パワー未達ではラッシュ不可",
      "コマンドホールド後に追加条件実行",
      "ラッシュ後 pendingRush で相手応答窓",
    ],
    fixtureCardIds: ["RS-050", "RS-051"],
  },
  {
    ruleId: "RULE-PHASE-04",
    wikiRef: "docs/wiki/phases.md#4-バトルフェイズ",
    title: "バトル進入後アタック/ストライク/パス選択",
    assertions: [
      "move_to_battle 後 pendingBattleEntry",
      "左詰め配置・NC 判定",
      "必須バトル進入未完了時 end_phase 不可",
    ],
    fixtureCardIds: ["RS-054", "RS-022"],
  },
  {
    ruleId: "RULE-PHASE-05",
    wikiRef: "docs/wiki/phases.md#5-エンドフェイズ",
    title: "ターン終了時 TurnModifiers クリア",
    assertions: [
      "end_phase で相手ターンへ",
      "bpModifier/spModifier/battleActed リセット",
      "ターン終了効果は end フェイズで解決",
    ],
  },
  // rush.md
  {
    ruleId: "RULE-RUSH-01",
    wikiRef: "docs/wiki/rush.md#基本ラッシュ",
    title: "効果ラッシュは特記なき限りコマンド不要",
    assertions: [
      "効果による recruit は initiate_command_payment 不要",
      "ラッシュされたとき以外の効果は有効",
    ],
  },
  {
    ruleId: "RULE-RUSH-02",
    wikiRef: "docs/wiki/rush.md#ゾードアップ",
    title: "ゾードアップは全融合パートナー必要",
    assertions: [
      "融合パートナー未揃いではラッシュ不可",
      "zord_setup pending で配置選択",
    ],
    fixtureCardIds: ["RS-050", "RS-051", "RS-052"],
  },
  // battle.md
  {
    ruleId: "RULE-BATTLE-01",
    wikiRef: "docs/wiki/battle.md#アタック（バトル）",
    title: "低BP撃破・同BP相討ち",
    assertions: [
      "attack で BP 比較",
      "同BPは両者 PendingLeave",
      "相手バトル空ではアタック不可（ウイング例外）",
    ],
    fixtureCardIds: ["RS-053"],
  },
  {
    ruleId: "RULE-BATTLE-02",
    wikiRef: "docs/wiki/battle.md#相打ち",
    title: "相討ちは同時撃破・レジストは個別選択可",
    assertions: [
      "同BPバトルで両者 leave",
      "片方のみレジスト選択可",
    ],
  },
  {
    ruleId: "RULE-BATTLE-03",
    wikiRef: "docs/wiki/battle.md#ナンバーコンビネーション（NC）",
    title: "バトル左からN番目で comboNumber=N 発動",
    assertions: [
      "battlePosition 左1始まり",
      "欠番詰め後も右端は1番扱い",
      "1ターン1回 per NC",
    ],
    fixtureCardIds: ["RS-001", "RS-002", "RS-015"],
  },
  {
    ruleId: "RULE-BATTLE-04",
    wikiRef: "docs/wiki/battle.md#レジスト",
    title: "バトル撃破時のみレジスト可",
    assertions: [
      "PendingRegister で use_register / pass_register",
      "効果撃破ではレジスト不可",
      "registerHeld でホールド留場",
    ],
  },
  {
    ruleId: "RULE-BATTLE-05",
    wikiRef: "docs/wiki/battle.md#ウイング",
    title: "ラッシュからホールドアタック・当ターンBA/ストライク不可",
    assertions: [
      "canWingAttackFromRush でラッシュからアタック",
      "ウイングターンは move_to_battle 不可",
      "SP1以上でもウイングターンはストライク不可",
    ],
  },
  {
    ruleId: "RULE-BATTLE-06",
    wikiRef: "docs/wiki/battle.md#代用・バトルキャンセル",
    title: "カウンターによるバトル形状変更",
    assertions: [
      "RS-006: アタック対象ラッシュ戻しでバトル不成立",
      "RS-018: 代用バトルで対象変更",
    ],
    fixtureCardIds: ["RS-006", "RS-018"],
  },
  // damage.md
  {
    ruleId: "RULE-DMG-01",
    wikiRef: "docs/wiki/damage.md#ストライクダメージ",
    title: "ストライク1ダメージ・pendingStrike 窓",
    assertions: [
      "strike → PendingStrike",
      "SP要件 canStrikeUnit",
      "noAttackOrStrikeTurnRushed 制約",
    ],
    fixtureCardIds: ["RS-014"],
  },
  {
    ruleId: "RULE-DMG-02",
    wikiRef: "docs/wiki/damage.md#ダメージ支払い",
    title: "パワー裏返しでダメージ支払い",
    assertions: [
      "pendingDamagePayment で支払い選択",
      "faceDown power と damage 同期",
    ],
  },
  // timing.md
  {
    ruleId: "RULE-TIME-01",
    wikiRef: "docs/wiki/timing.md#効果スタック優先度",
    title: "反応窓優先度: 離場→レジスト→ストライク→バトル→ラッシュ",
    assertions: [
      "buildEffectStack の priority 順",
      "hasOpenReactionWindow 中はフェイズ行動制限",
    ],
  },
  {
    ruleId: "RULE-TIME-02",
    wikiRef: "docs/wiki/timing.md#効果の解決",
    title: "空撃ち可・強制効果は対象あれば必ず選択",
    assertions: [
      "対象なし効果はスキップ",
      "同一タイミングはターンプレイヤーが順序決定",
    ],
  },
  // keywords.md
  {
    ruleId: "RULE-KW-01",
    wikiRef: "docs/wiki/keywords.md#カテゴリ",
    title: "マルチカテゴリ: 全カテゴリコマンド存在+いずれかホールド",
    assertions: [
      "cardCategories() で複数カテゴリ参照",
      "敵コマンドに置いたマルチ1枚=敵パワー+1",
    ],
  },
  {
    ruleId: "RULE-KW-02",
    wikiRef: "docs/wiki/keywords.md#常駐オペレーション",
    title: "常駐は各プレイヤー1枚・上書き可",
    assertions: [
      "operation ゾーンに配置",
      "新常駐で旧常駐捨札",
      "非常駐オペ使用では既存常駐残る",
    ],
    fixtureCardIds: ["RK-001", "RS-072"],
  },
  {
    ruleId: "RULE-KW-03",
    wikiRef: "docs/wiki/keywords.md#カウンター",
    title: "カウンターは敵軍ターン中のみ",
    assertions: [
      "isHandCounterCard で手札判定",
      "相手リリースコマンドなしでは不可",
      "play_counter + category payment",
    ],
    fixtureCardIds: ["RK-004", "RK-008"],
  },
  {
    ruleId: "RULE-KW-04",
    wikiRef: "docs/wiki/keywords.md#チェイス",
    title: "ライド中ユニット離場時ビークル切替",
    assertions: [
      "ユニットでなくなる時にライド先ビークル捨て",
      "別ビークルへライド可能（RC付与なし）",
    ],
    fixtureCardIds: ["RK-017"],
  },
  {
    ruleId: "RULE-KW-05",
    wikiRef: "docs/wiki/keywords.md#ウイング",
    title: "ウイング完全動作（複数回・BA戻り再ウイング含む）",
    assertions: [
      "BA出場→ラッシュ戻り→同一ターン再ウイング可",
      "リリース手段で同一ユニット複数回ウイング可",
    ],
  },
  {
    ruleId: "RULE-KW-06",
    wikiRef: "docs/wiki/keywords.md#スクラム",
    title: "右隣CNが自CN+1の間アタックされない",
    assertions: [
      "scrumBlocksAttack: 右隣 comboNumber === 自CN + 1",
    ],
  },
  {
    ruleId: "RULE-KW-07",
    wikiRef: "docs/wiki/keywords.md#否定優先・リファレンス",
    title: "できない > 可能なら〜",
    assertions: [
      "cannotEnterBattle 等の否定が優先",
      "相反テキストは否定文優先（RK-021×RS-018 FAQ）",
    ],
    fixtureCardIds: ["RK-021", "RS-018"],
  },
  {
    ruleId: "RULE-KW-08",
    wikiRef: "docs/wiki/glossary/ride.md",
    title: "ライド: ビークル上にユニット配置",
    assertions: [
      "ライド中BP修飾子適用",
      "ライドオフはチェイス/RC効果で制御",
    ],
    fixtureCardIds: ["RK-024", "RK-027", "RK-030"],
  },
  {
    ruleId: "RULE-KW-09",
    wikiRef: "docs/wiki/glossary/p1294.md",
    title: "敵ラッシュ時に特徴一致でモーフ置換",
    assertions: [
      "emitUnitRushed 後 pendingMorph / morph_replacement",
      "置換先は hand/rush/power/command のオモテユニット",
      "モーフキーワード持ちのラッシュには反応不可",
      "複数モーフ時はターンプレイヤーが順序決定",
      "pass_morph_reaction でスキップ可",
    ],
  },
  {
    ruleId: "RULE-KW-10",
    wikiRef: "docs/wiki/glossary/p266.md",
    title: "L/Rナンバーはバトル進入時に隣接LサイズとJC発動",
    assertions: [
      "Lは右隣Lサイズに効果付与",
      "Rは左隣Lサイズから自己発動",
      "カードテキストでS/M等の非Lパートナー可（RK-147）",
      "並び確定後のtailでNCの次に解決",
      "無関係な進入では既存JCを再発動しない（RS-172）",
    ],
  },
];
