import type { WikiRuleCompleteSpec } from "./types";

/**
 * 完成版ルール E2E テスト仕様 — docs/rules/ 準拠。ruleRef は docs/rules/*.md のルールID（例: "R-WIN-01"、複数は ", " 区切り）。
 * 実装: packages/engine/src/wikiRulesComplete.test.ts
 */
export const WIKI_RULE_COMPLETE_SPECS: WikiRuleCompleteSpec[] = [
  {
    ruleId: "RULE-CORE-01",
    ruleRef: "R-SETUP-07, R-TURN-03",
    title: "先攻1ターン目はスタート省略・チャージから開始",
    assertions: [
      "createGame 後 firstPlayer の phase は charge",
      "turn は 1、activePlayer は firstPlayer",
    ],
  },
  {
    ruleId: "RULE-CORE-02",
    ruleRef: "R-WIN-01, R-WIN-03, R-START-05",
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
    ruleRef: "R-DECK-01, R-DECK-02, R-DECK-03",
    title: "デッキ40枚以上・同名3枚まで",
    assertions: [
      "DECK_MIN_SIZE = 40",
      "DECK_NAME_COPY_LIMIT = 3（例外カード除く）",
    ],
  },
  {
    ruleId: "RULE-CORE-04",
    ruleRef: "R-ZONE-08, R-ZONE-07, R-DMG-01",
    title: "コマンドゾーン最大5枚・超過は捨札",
    assertions: [
      "command ゾーンが5枚を超えると捨札へ",
      "パワーは枚数無制限・裏向きはダメージマーカー",
    ],
    fixtureCardIds: ["RS-030", "RS-064"],
  },
  {
    ruleId: "RULE-PHASE-01",
    ruleRef: "R-START-01",
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
    ruleRef: "R-CHARGE-01, R-CHARGE-02",
    title: "チャージ1ターン1枚・スキップ可",
    assertions: [
      "charge で手札→power/command（オモテ）",
      "hasChargedThisTurn で2回目不可",
    ],
  },
  {
    ruleId: "RULE-PHASE-03",
    ruleRef: "R-RUSH-11, R-POW-02, R-RUSH-30",
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
    ruleRef: "R-BATTLEPH-01, R-BA-02, R-BA-04, R-CN-02",
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
    ruleRef: "R-END-01, R-TURN-04",
    title: "ターン終了時 TurnModifiers クリア",
    assertions: [
      "end_phase で相手ターンへ",
      "bpModifier/spModifier/battleActed リセット",
      "ターン終了効果は end フェイズで解決",
    ],
  },
  {
    ruleId: "RULE-RUSH-01",
    ruleRef: "R-RUSH-20, R-CMD-02, R-RUSH-22",
    title: "効果ラッシュは特記なき限りコマンド不要",
    assertions: [
      "効果による recruit は initiate_command_payment 不要",
      "ラッシュされたとき以外の効果は有効",
    ],
  },
  {
    ruleId: "RULE-RUSH-02",
    // ルール: R-ADD-06（ゾードアップ固有の項目は未収載。最も近い章: docs/rules/04-rush.md）
    ruleRef: "R-ADD-06",
    title: "ゾードアップは全融合パートナー必要",
    assertions: [
      "融合パートナー未揃いではラッシュ不可",
      "zord_setup pending で配置選択",
    ],
    fixtureCardIds: ["RS-050", "RS-051", "RS-052"],
  },
  {
    ruleId: "RULE-BATTLE-01",
    ruleRef: "R-BTL-01, R-BTL-02, R-ATK-01",
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
    ruleRef: "R-BTL-02, R-KW-RESIST-02",
    title: "相討ちは同時撃破・レジストは個別選択可",
    assertions: [
      "同BPバトルで両者 leave",
      "片方のみレジスト選択可",
    ],
  },
  {
    ruleId: "RULE-BATTLE-03",
    ruleRef: "R-CN-01, R-CN-02, R-CN-03, R-BA-02",
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
    ruleRef: "R-KW-RESIST-01, R-KW-RESIST-02, R-KW-RESIST-04",
    title: "バトル撃破時のみレジスト可",
    assertions: [
      "PendingRegister で use_register / pass_register",
      "効果撃破ではレジスト不可",
      "registerHeld でホールド留場",
    ],
  },
  {
    ruleId: "RULE-BATTLE-05",
    ruleRef: "R-KW-WING-01, R-KW-WING-02",
    title: "ラッシュからホールドアタック・当ターンBA/ストライク不可",
    assertions: [
      "canWingAttackFromRush でラッシュからアタック",
      "ウイングターンは move_to_battle 不可",
      "SP1以上でもウイングターンはストライク不可",
    ],
  },
  {
    ruleId: "RULE-BATTLE-06",
    // ルール: R-ATK-04, R-ERR-RS018（RS-006 のバトル不成立は個別ルールなし。最も近い章: docs/rules/05-battle-strike-damage.md）
    ruleRef: "R-ATK-04, R-ERR-RS018",
    title: "カウンターによるバトル形状変更",
    assertions: [
      "RS-006: アタック対象ラッシュ戻しでバトル不成立",
      "RS-018: 代用バトルで対象変更",
    ],
    fixtureCardIds: ["RS-006", "RS-018"],
  },
  {
    ruleId: "RULE-DMG-01",
    // ルール: R-STK-01 ではダメージ量は SP の値（タイトルの「1ダメージ」は SP1 の場合）。
    ruleRef: "R-STK-01, R-STK-05",
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
    ruleRef: "R-DMG-01, R-DMG-02",
    title: "パワー裏返しでダメージ支払い",
    assertions: [
      "pendingDamagePayment で支払い選択",
      "faceDown power と damage 同期",
    ],
  },
  {
    ruleId: "RULE-TIME-01",
    // ルール: R-PRI-02 — 種類別の固定優先順位はない。同時に開いた反応窓はターンプレイヤーが順番を選び、
    // それ以外は入れ子（R-TIME-04）の順に解決する。
    ruleRef: "R-PRI-02, R-SIM-01, R-TIME-04",
    title: "反応窓の順序: 同時ならターンプレイヤーが選択、それ以外は入れ子順",
    assertions: [
      "buildEffectStack は reactionResolutionOrder（ターンプレイヤーの選択）→入れ子順",
      "hasOpenReactionWindow 中はフェイズ行動制限",
    ],
  },
  {
    ruleId: "RULE-TIME-02",
    ruleRef: "R-RES-04, R-SIM-01",
    title: "空撃ち可・強制効果は対象あれば必ず選択",
    assertions: [
      "対象なし効果はスキップ",
      "同一タイミングはターンプレイヤーが順序決定",
    ],
  },
  {
    ruleId: "RULE-KW-01",
    ruleRef: "R-CAT-02",
    title: "マルチカテゴリ: 全カテゴリコマンド存在+いずれかホールド",
    assertions: [
      "cardCategories() で複数カテゴリ参照",
      "敵コマンドに置いたマルチ1枚=敵パワー+1",
    ],
  },
  {
    ruleId: "RULE-KW-02",
    ruleRef: "R-KW-PERM-01, R-ZONE-12",
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
    ruleRef: "R-CTR-01, R-RUSH-30",
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
    ruleRef: "R-KW-CHASE-01, R-KW-CHASE-02",
    title: "ライド中ユニット離場時ビークル切替",
    assertions: [
      "ユニットでなくなる時にライド先ビークル捨て",
      "別ビークルへライド可能（RC付与なし）",
    ],
    fixtureCardIds: ["RK-017"],
  },
  {
    ruleId: "RULE-KW-05",
    ruleRef: "R-KW-WING-03, R-KW-WING-04",
    title: "ウイング完全動作（複数回・BA戻り再ウイング含む）",
    assertions: [
      "BA出場→ラッシュ戻り→同一ターン再ウイング可",
      "リリース手段で同一ユニット複数回ウイング可",
    ],
  },
  {
    ruleId: "RULE-KW-06",
    ruleRef: "R-KW-SCRUM-01",
    title: "右隣CNが自CN+1の間アタックされない",
    assertions: [
      "scrumBlocksAttack: 右隣 comboNumber === 自CN + 1",
    ],
  },
  {
    ruleId: "RULE-KW-07",
    ruleRef: "R-PRI-01",
    title: "できない > 可能なら〜",
    assertions: [
      "cannotEnterBattle 等の否定が優先",
      "相反テキストは否定文優先（RK-021×RS-018 FAQ）",
    ],
    fixtureCardIds: ["RK-021", "RS-018"],
  },
  {
    ruleId: "RULE-KW-08",
    ruleRef: "R-KW-RIDE-01, R-KW-RIDE-05, R-KW-RC-01",
    title: "ライド: ビークル上にユニット配置",
    assertions: [
      "ライド中BP修飾子適用",
      "ライドオフはチェイス/RC効果で制御",
    ],
    fixtureCardIds: ["RK-024", "RK-027", "RK-030"],
  },
  {
    ruleId: "RULE-KW-09",
    // ルール: R-KW-MORPH-01（判定はラッシュの手段）、R-KW-MORPH-02（置き換え先はコマンド・パワーゾーンのみ、状態と位置を引き継ぐ）
    ruleRef: "R-KW-MORPH-01, R-KW-MORPH-02, R-KW-MORPH-03",
    title: "敵ラッシュ時に特徴一致でモーフ置換",
    assertions: [
      "emitUnitRushed 後 pendingMorph / morph_replacement",
      "置換先は自軍コマンドゾーン・パワーゾーンのオモテ向きユニットカードのみ（手札・ラッシュは不可）",
      "モーフ以外の手段でのラッシュに反応（ラッシュされたカードがモーフ持ちでも反応可）",
      "置き換えでホールド／リリース状態と位置を引き継ぐ",
      "複数モーフ時はターンプレイヤーが順序決定",
      "pass_morph_reaction でスキップ可",
    ],
  },
  {
    ruleId: "RULE-KW-10",
    // ルール: R-CN-01, R-CN-05（ジョイントコンビネーション専用の項目は未収載。最も近い章: docs/rules/05-battle-strike-damage.md）
    ruleRef: "R-CN-01, R-CN-05",
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
