export type CpuLevel = 1 | 2 | 3 | 4 | 5;

export const CPU_LEVELS: CpuLevel[] = [1, 2, 3, 4, 5];

export type CpuLevelConfig = {
  enableSearch: boolean;
  maxCandidates: number;
  maxResponseDepth: number;
  /** 1=手応答のみ、2+=相手の次手まで読む negamax 深さ */
  searchPly: number;
  /** ルートの上位何手を、相手の次のターンの終わりまで進めて評価し直すか（0で行わない）。 */
  rolloutTopK?: number;
  /** チャージ・ラッシュ・バトル進入の決定を先まで進めて比べる試行回数（0／省略で行わない）。 */
  planSamples?: number;
  planPhases?: Array<"charge" | "rush" | "entry">;
  planTurns?: number;
  planChargeTop?: number;
  planMaxSteps?: number;
  comboOrder?: number;
  /** 山札がこの枚数以下で相手より少ないとき、追加ドローをしない（山札切れの負けを遅らせる）。 */
  deckGuard?: number;
  /** チャージの先読みで、デッキの中身から決めた方針（パワーの上限・最初のコマンド）を守る。 */
  deckAwareCharge?: boolean;
  /** 盤面の評価に、同梱の価値ネットワーク（ai/weights）の評価をこの倍率で足す（0／省略で手書きの評価だけ）。 */
  valueNetBlend?: number;
  /** 読みの前に相手の手札を山札と混ぜて配り直す（相手の手札を覗かない）。 */
  hideOpponentHand?: boolean;
  /** 自分のラッシュ・バトルフェイズの決定を、候補ごとにターンの終わりまで指し進めて比べる（1 回の決定で指し進める手の数の上限。0／省略で行わない）。 */
  turnPlanSteps?: number;
};

let overrides: Partial<Record<CpuLevel, Partial<CpuLevelConfig>>> = {};
/** 対戦台（scripts/cpu-arena.ts）でレベルの設定を試しに変える。 */
export function setCpuLevelOverrides(next: Partial<Record<CpuLevel, Partial<CpuLevelConfig>>>): void {
  overrides = next;
}

const LEVEL_CONFIG: Record<CpuLevel, CpuLevelConfig> = {
  1: { enableSearch: false, maxCandidates: 0, maxResponseDepth: 0, searchPly: 0 },
  // comboOrder: バトルフェイズで NC が成立する並べ方を先に読んで出す。deckGuard: 山札が少なく相手より先に尽きそうなら追加ドローをしない。
  2: { enableSearch: true, maxCandidates: 28, maxResponseDepth: 10, searchPly: 1, comboOrder: 2, deckGuard: 10 },
  // Lv3 以上はチャージの判断を、探索なしの CPU で相手の次のターンの終わりまで進めて比べる。
  // 探索の広さ・深さだけを増やした以前の Lv3〜5 は、Lv2 と同じ手しか選ばなかった（2026-10-20 scripts/cpu-arena.ts、
  // 340 局面で差 0）。対 旧Lv2（comboOrder・deckGuard なし、各 400 局、席入れ替え、2026-10-20）:
  // Lv2 57.3%、Lv4 61.3%、Lv5 62.3%。バトル進入の先読み（"entry"）は効果が見えなかったので外した。
  // deckAwareCharge: デッキの一番重いカードの必要パワーに届いたら先読みしない等（ai/deckProfile.ts）。先読みが逆効果だった
  // XG1-C・ライダーEXP1-C などで勝ち数が戻り（32 局で 7→12・10→17）、全体では同等で考える時間が 3 割減（2026-10-21）。
  3: { enableSearch: true, maxCandidates: 44, maxResponseDepth: 14, searchPly: 1, planSamples: 1, planPhases: ["charge"], planChargeTop: 2, comboOrder: 2, deckGuard: 10, deckAwareCharge: true },
  4: { enableSearch: true, maxCandidates: 56, maxResponseDepth: 20, searchPly: 2, planSamples: 1, planPhases: ["charge"], comboOrder: 2, deckGuard: 10, deckAwareCharge: true },
  // hideOpponentHand: 読みの前に相手の手札を山札と混ぜて配り直し、相手の手札を覗かない（強さは同等、1,104 局で 50.1%）。
  // turnPlanSteps: ラッシュ・バトルフェイズの決定を、候補ごとに自分のターンの終わりまで指し進めて比べる（ターン単位の読み）。
  // 前の Lv5 に、同デッキ 1,840 試合で 57.4%・違うデッキ 1,104 試合で 55.8%。1 手の平均の思考は約 20 ms → 約 40 ms（2026-10-23）。
  5: { enableSearch: true, maxCandidates: 64, maxResponseDepth: 28, searchPly: 2, planSamples: 2, planPhases: ["charge"], comboOrder: 2, deckGuard: 10, deckAwareCharge: true, valueNetBlend: 0.5, hideOpponentHand: true, turnPlanSteps: 60 },
};

export function getCpuLevelConfig(level: CpuLevel): CpuLevelConfig {
  const extra = overrides[level];
  return extra ? { ...LEVEL_CONFIG[level], ...extra } : LEVEL_CONFIG[level];
}
