/**
 * Trigger カタログ定義（Wiki 推論 + DSL 型との対応）
 */

export type TriggerCatalogEntry = {
  /** 一覧表示名（camelCase） */
  label: string;
  /** DSL / エンジン内部 ID */
  dslType: string;
  /** 日本語説明 */
  description: string;
  /** Wiki 効果文マッチ（先頭優先・複数可） */
  wikiTests: RegExp[];
  /** operation のとき timing */
  operationTiming?: "rush" | "battle" | "counter" | "resident";
};

/** マッチ優先順（先にマッチしたルールをセグメントの主 Trigger とする） */
export const TRIGGER_CATALOG: TriggerCatalogEntry[] = [
  {
    label: "onCounter",
    dslType: "operation",
    operationTiming: "counter",
    description: "カウンターオペレーション（被アタック時等に発動）",
    wikiTests: [
      /カウンター/,
      /アタックされたとき発動できる/,
      /アタックされたユニットをラッシュエリアに戻す/,
    ],
  },
  {
    label: "onStrike",
    dslType: "on_strike",
    description: "ストライクした／されたとき",
    wikiTests: [/ストライクしたとき/, /ストライクされたとき/],
  },
  {
    label: "onDestroy",
    dslType: "on_destroy",
    description: "撃破されたとき",
    wikiTests: [/撃破されたとき/, /撃破して/],
  },
  {
    label: "onLeave",
    dslType: "on_leave",
    description: "場を離れる／捨札になるとき",
    wikiTests: [/場を離れるとき/, /捨札になるとき/, /離れたとき/],
  },
  {
    label: "onDamage",
    dslType: "on_damage",
    description: "ダメージを受けた／与えたとき",
    wikiTests: [/ダメージを受けたとき/, /点ダメージを受ける/, /点ダメージを与える/],
  },
  {
    label: "onRush",
    dslType: "on_rush",
    description: "ラッシュしたとき発動",
    wikiTests: [/これをラッシュしたとき/, /ラッシュしたとき発動/],
  },
  {
    label: "onBattle",
    dslType: "on_attack",
    description: "アタックした／アタックするとき（バトルフェイズ）",
    wikiTests: [
      /アタックしたとき/,
      /アタックするとき/,
      /アタックするかわりに/,
      /アタックできる/,
    ],
  },
  {
    label: "onEnterBattle",
    dslType: "enter_battle",
    description: "バトルエリアに出たとき",
    wikiTests: [/バトルエリアに出たとき/, /バトルエリアに出て/],
  },
  {
    label: "onTurnEnd",
    dslType: "on_turn_end",
    description: "ターン終了時",
    wikiTests: [/ターン終了時/, /エンドフェイズ/],
  },
  {
    label: "onJointComboL",
    dslType: "joint_combo_l",
    description: "ジョイントコンボ L",
    wikiTests: [/ジョイントコンボ.?L/, /コンビネーションナンバー.?L/],
  },
  {
    label: "onJointComboR",
    dslType: "joint_combo_r",
    description: "ジョイントコンボ R",
    wikiTests: [/ジョイントコンボ.?R/, /コンビネーションナンバー.?R/],
  },
  {
    label: "onRidingCombo",
    dslType: "riding_combo",
    description: "ライディングコンボ",
    wikiTests: [/ライディングコンボ/],
  },
  {
    label: "onComboFrom",
    dslType: "nc_or_combo_from",
    description: "特定カードからコンビネーションするとき",
    wikiTests: [/からコンビネーションするとき/],
  },
  {
    label: "onConditional",
    dslType: "conditional",
    description: "バトル投入時など任意コスト支払い型",
    wikiTests: [/発動できる。.*選んで/, /超シールド進化/, /進化を発動/],
  },
  {
    label: "onGameStart",
    dslType: "game_start",
    description: "ゲーム開始時（コマンダー等）",
    wikiTests: [/ゲーム開始時/],
  },
  {
    label: "onOperationRush",
    dslType: "operation",
    operationTiming: "rush",
    description: "ラッシュフェイズ即時オペレーション（インスタント）",
    wikiTests: [],
  },
  {
    label: "onOperationResident",
    dslType: "operation",
    operationTiming: "resident",
    description: "常駐オペレーション",
    wikiTests: [/常駐置き場/, /常駐のオペレーション/, /常駐オペ/],
  },
  {
    label: "whileInField",
    dslType: "while_in_field",
    description: "常時効果・※注釈ルール",
    wikiTests: [
      /^※これは毎ターン/,
      /^※これは「.+」としてつかえる/,
      /^※これは自軍コマンド/,
      /^※これが撃破されたとき/,
      /としてつかえる/,
    ],
  },
  {
    label: "onNc",
    dslType: "nc",
    description: "ナンバーコンビネーション（NC）／【名前】効果",
    wikiTests: [/【[^】]+】/, /^「SP\d+」/],
  },
];

export function inferWikiTrigger(body: string): TriggerCatalogEntry | null {
  for (const entry of TRIGGER_CATALOG) {
    if (entry.wikiTests.some((re) => re.test(body))) return entry;
  }
  return null;
}

export function triggerKey(entry: TriggerCatalogEntry): string {
  if (entry.dslType === "operation" && entry.operationTiming) {
    return `operation:${entry.operationTiming}`;
  }
  return entry.dslType;
}
