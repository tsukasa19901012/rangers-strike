import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { WIN_DAMAGE } from "../types/game";
import { effectiveBp } from "../core/catalog";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { opponent, rushReactorId } from "../core/helpers";
import { damagePaymentChoosingPlayer } from "../rules/damagePayment";
import { strikeDamageFor } from "../rules/combo";
import {
  actionsOfType,
  affordableRushes,
  endPhase,
  pickBestCounter,
  pickBestOperation,
  pickBestRushByScore,
  pickBestStrike,
  scoreRushAction,
  pickChargeAction,
  pickCommandPaymentResolve,
  pickDamagePayment,
  pickDeckStackChoice,
  pickEffectChoice,
  pickBeginZordSetup,
  pickZordSetupStep,
  pickFavorableBattle,
  pickHoldBeforeBattle,
  pickHoldBeforeRush,
  handHasRushUnits,
  pickRushCategoryPayment,
  pickMandatoryBattleMove,
  pickBestBattleEntry,
  pickBestChase,
  pickRideOffChoice,
  pickCpuFallbackAction,
  cpuWouldCancelProcedure,
  chargeCandidates,
  pickSimpleReaction,
  pickStrikeReaction,
  pickWinningBattle,
} from "./helpers";
import { planComboEntry } from "./comboOrder";
import { deckProfile } from "./deckProfile";
import { pickMirrorWorldActivation, pickMirrorWorldChoice } from "./mirrorWorld";
import { dedupeActions, pickBestByRollout, pickBestBySearch, pickBestByTurnPlan, scoreAction, type SearchOptions } from "./simulation";

export type PickCpuActionOptions = {
  /** false のとき相手応答シミュレーションをスキップ（再帰回避の内部用）。 */
  enableSearch?: boolean;
  maxCandidates?: number;
  maxResponseDepth?: number;
  simulationDepth?: number;
  searchPly?: number;
  rolloutTopK?: number;
  /** 0 より大きいと、チャージ・ラッシュ・バトル進入の決定を先まで進めて比べる（その試行回数）。 */
  planSamples?: number;
  /** 先まで進めて比べる決定（省略ですべて）。 */
  planPhases?: Array<"charge" | "rush" | "entry">;
  /** 先まで進める長さ（ターン数。1=このターンの終わり、2=相手の次のターンの終わり（既定）、3=自分の次のターンまで）。 */
  planTurns?: number;
  /** チャージの先読みで比べる、パワー・コマンドそれぞれの上位カード数（省略で全カード）。 */
  planChargeTop?: number;
  /** 先読みで進める最大の手数。 */
  planMaxSteps?: number;
  /** バトルフェイズで NC が成立する順番に出す（1: 今成立する手、2: 先出しも）。 */
  comboOrder?: number;
  /** 山札がこの枚数以下で相手より少ないとき、追加ドローをしない。 */
  deckGuard?: number;
  /** チャージの先読みで、デッキの中身から決めた方針（パワーの上限・最初のコマンド）を守る。 */
  deckAwareCharge?: boolean;
  /**
   * 0 より大きいと、自分のラッシュ・バトルフェイズの決定を、候補ごとにターンの終わりまで指し進めて比べる
   * （ターン単位の読み。1 回の決定で指し進める手の数の合計の上限）。
   */
  turnPlanSteps?: number;
};

/** ターン単位の読みで、自分の残りの手を指す CPU（Lv2 相当。読みの中なので先読みはしない）。 */
const TURN_PLAN_POLICY: PickCpuActionOptions = {
  enableSearch: true,
  maxCandidates: 28,
  maxResponseDepth: 10,
  searchPly: 1,
  comboOrder: 2,
  simulationDepth: 1,
};

function tacticalSearchOptions(
  state: GameState,
  options: PickCpuActionOptions,
): SearchOptions | undefined {
  const base = searchOptions(options);
  if (!base) return undefined;

  const tactical =
    state.phase === "battle" ||
    state.pendingBattleEntry !== undefined ||
    state.pendingStrike !== undefined ||
    state.pendingBattle !== undefined;

  if (!tactical && (base.searchPly ?? 1) > 1) {
    return { ...base, searchPly: 1 };
  }
  return base;
}

function battleHasCombatOptions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): boolean {
  return (
    actionsOfType(actions, "strike").length > 0 ||
    actionsOfType(actions, "battle").length > 0 ||
    actionsOfType(actions, "move_to_battle").length > 0 ||
    actionsOfType(actions, "mount_ride").length > 0 ||
    state.pendingBattleEntry !== undefined ||
    state.pendingStrike !== undefined ||
    state.pendingBattle !== undefined
  );
}

function deepSearchOptions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  options: PickCpuActionOptions,
): SearchOptions | undefined {
  const base = tacticalSearchOptions(state, options);
  if (!base || (base.searchPly ?? 1) <= 1) return base;
  if (state.phase === "battle" && !battleHasCombatOptions(state, playerId, actions)) {
    return { ...base, searchPly: 1 };
  }
  return base;
}

function searchOptions(options: PickCpuActionOptions): SearchOptions | undefined {
  if (
    options.maxCandidates === undefined &&
    options.maxResponseDepth === undefined &&
    options.simulationDepth === undefined &&
    options.searchPly === undefined &&
    options.rolloutTopK === undefined
  ) {
    return undefined;
  }
  return {
    maxCandidates: options.maxCandidates,
    maxResponseDepth: options.maxResponseDepth,
    simulationDepth: options.simulationDepth,
    searchPly: options.searchPly,
    rolloutTopK: options.rolloutTopK,
  };
}

function pickReactionAction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  passType: GameAction["type"],
  enableSearch: boolean,
  options: PickCpuActionOptions,
): GameAction | null {
  if (!enableSearch) {
    return pickSimpleReaction(state, playerId, actions, passType);
  }

  const pass = actions.find((a) => a.type === passType);
  const sim = deepSearchOptions(state, playerId, actions, options);

  if (passType === "pass_strike_reaction") {
    const strikeCandidates = dedupeActions([
      ...actionsOfType(actions, "five_tech_intercept"),
      ...actionsOfType(actions, "use_plasma_energy"),
      ...actionsOfType(actions, "play_counter"),
      ...(pass ? [pass] : []),
    ]);
    const searched = pickBestBySearch(state, playerId, strikeCandidates, sim);
    return (
      searched ??
      pickStrikeReaction(state, playerId, actions) ??
      pickBestCounter(state, playerId, actions, passType) ??
      pass ??
      null
    );
  }

  const heuristic = pickBestCounter(state, playerId, actions, passType);
  const candidates = actions.filter((a) => a.type !== passType);
  if (pass) candidates.push(pass);

  return pickBestBySearch(state, playerId, candidates, sim) ?? heuristic ?? pass ?? null;
}

/**
 * 残りの合法手として足さない手。途中の手続きの取り消し（取り消すなら最初から始めなければよい）と、
 * フェイズを終える・見送る手（いつ終えるかは決めた順の候補の側で決めている。足すと、ラッシュできるのに
 * ラッシュフェイズを終える・出せるのにバトルエリアへの登場を見送る、を選んで大きく弱くなった）。
 */
const NOT_CANDIDATE_TYPES = new Set<GameAction["type"]>(["cancel_command_payment", "cancel_zord_setup", "cancel_wing_hold", "end_phase"]);

/**
 * 決めた順の候補（collectRushCandidates など）に入っていない合法手。手の種類を列挙して候補を作っていたので、
 * 列挙に無い手（常駐の起動、場のユニットの起動効果、ゾーンからのラッシュ など）は一度も選ばれなかった。
 * 支払いやゾード・セットアップを始める手は、CPU が最後まで払えずに取り消すもの（cpuWouldCancelProcedure）を除く。
 */
function remainingActions(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
  actions: GameAction[],
): GameAction[] {
  const taken = new Set(candidates.map((a) => JSON.stringify(a)));
  return dedupeActions(
    actions.filter((a) => {
      if (NOT_CANDIDATE_TYPES.has(a.type) || a.type.startsWith("pass_") || taken.has(JSON.stringify(a))) return false;
      if (a.type === "begin_zord_setup" || a.type === "initiate_command_payment") return !cpuWouldCancelProcedure(state, playerId, a);
      if ((a.type === "activate_resident_operation" || a.type === "activate_field_unit_ability") && activatedThisPhase(state, a)) return false;
      return true;
    }),
  );
}

/**
 * 同じカード（カード番号）の起動を、このフェイズにもうしているか。CPU は 1 フェイズに 1 回までにする。
 * XG5-066 仮面ライダーベルデ【コピーベント】は、場のベルデとパワーゾーンのもう 1 枚のベルデを入れ替えると、
 * 入れ替わったベルデがまた起動でき、入れ替えを永久に繰り返していた（インスタンスが変わるので、同じカードの
 * 1 ターン 1 回の印にもかからない。読むたびに相手の手札の配り直しが変わり、評価の揺れで「良い手」に見える）。
 */
function activatedThisPhase(state: GameState, action: GameAction): boolean {
  const id = action.type === "activate_resident_operation" ? action.operationInstanceId : action.type === "activate_field_unit_ability" ? action.unitInstanceId : null;
  if (!id) return false;
  const p = state.players[action.playerId];
  const cardId = [...p.operation, ...p.rush, ...p.battle, ...p.hand, ...p.power].find((c) => c.instanceId === id)?.cardId;
  if (!cardId) return false;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const line = state.log[i]!;
    if (line.startsWith("phase:")) return false;
    if (line.startsWith(`${action.playerId}|activate_`) && line.includes(`|${cardId}|`)) return true;
  }
  return false;
}

/** 局面の中身（ログなどを除く）。 */
function positionKey(state: GameState): string {
  return JSON.stringify([state.phase, state.activePlayer, state.players, state.pendingEffectChoice ?? null]);
}

/**
 * その手を打ち、続く自分の選択も CPU が選ぶとおりに進めたとき、局面が元に戻るか。
 * ミラーワールド（RK-016）のように、起動 → 任意の効果を見送る、で何も変わらない手を候補から外す。
 */
function isNoOpForCpu(state: GameState, playerId: PlayerId, action: GameAction, cpuOptions: PickCpuActionOptions): boolean {
  const before = positionKey(state);
  const first = applyAction(state, action);
  if (!first.ok) return true;
  let next = first.state;
  for (let i = 0; i < 8 && !next.winner && next.pendingEffectChoice?.playerId === playerId; i++) {
    const follow = pickCpuActionInner(next, playerId, { ...cpuOptions, simulationDepth: 1 });
    if (!follow) break;
    const r = applyAction(next, follow);
    if (!r.ok) break;
    next = r.state;
  }
  return positionKey(next) === before;
}

/**
 * 決めた順の候補から読みで選んだ手と、残りの合法手（remainingActions）で一番よい手を比べ、残りの手は
 * はっきり良いときだけ選ぶ。ライダーパスの入れ替えのように何度でも使える手が、同じ点のまま選ばれ続けて
 * 入れ替えを繰り返さないようにする（評価が上がる手だけなら、行って戻る繰り返しにはならない）。
 */
function pickBestWithRemaining(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
  actions: GameAction[],
  options: SearchOptions | undefined,
  cpuOptions: PickCpuActionOptions,
): GameAction | null {
  return searchWithRemaining(state, playerId, candidates, actions, options, cpuOptions).pick;
}

/** pickBestWithRemaining の結果と、残りの合法手の中で一番よい手（rest。ターン単位の読みで候補に足す）。 */
function searchWithRemaining(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
  actions: GameAction[],
  options: SearchOptions | undefined,
  cpuOptions: PickCpuActionOptions,
): { pick: GameAction | null; rest: GameAction | null } {
  const best = pickBestBySearch(state, playerId, candidates, options);
  const rest = remainingActions(state, playerId, candidates, actions).filter((a) => !isNoOpForCpu(state, playerId, a, cpuOptions));
  if (rest.length === 0) return { pick: best, rest: null };
  const bestRest = pickBestBySearch(state, playerId, rest, options);
  if (!bestRest) return { pick: best, rest: null };
  if (!best) return { pick: bestRest, rest: bestRest };
  const pick = scoreAction(state, playerId, bestRest, options) > scoreAction(state, playerId, best, options) ? bestRest : best;
  return { pick, rest: bestRest };
}

/**
 * ターン単位の読み（turnPlanSteps）。いつもの読みの一番よい手を先頭に、残りの合法手の一番よい手、決めた順の候補と並べて読む。
 */
function pickByTurnPlan(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
  actions: GameAction[],
  options: SearchOptions | undefined,
  cpuOptions: PickCpuActionOptions,
  steps: number,
): GameAction | null {
  const { pick, rest } = searchWithRemaining(state, playerId, candidates, actions, options, cpuOptions);
  const ordered = [pick, rest, ...candidates].filter((a): a is GameAction => a !== null);
  return pickBestByTurnPlan(state, playerId, ordered, TURN_PLAN_POLICY, steps) ?? pick;
}

function collectRushCandidates(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction[] {
  const candidates: GameAction[] = [];
  const rushes = affordableRushes(state, playerId, actions);

  const rankedRushes = [...rushes].sort(
    (a, b) => scoreRushAction(state, b) - scoreRushAction(state, a),
  );

  for (const rush of rankedRushes) {
    const hold = pickHoldBeforeRush(state, playerId, actions, rush);
    if (hold) candidates.push(hold);
    candidates.push(rush);
  }

  if (rankedRushes.length === 0) {
    const categoryPay = pickRushCategoryPayment(state, playerId, actions);
    if (categoryPay) {
      candidates.push(categoryPay);
    } else if (!handHasRushUnits(state, playerId)) {
      const bestOp = pickBestOperation(state, actions);
      if (bestOp) {
        candidates.push(bestOp);
      } else {
        candidates.push(...actionsOfType(actions, "play_operation").slice(0, 4));
      }
    }
  }

  candidates.push(
    ...actionsOfType(actions, "begin_zord_setup").filter((a) => !cpuWouldCancelProcedure(state, playerId, a)),
  );
  candidates.push(...actionsOfType(actions, "play_operation").slice(0, 3));
  // RS-325【マジチケット】: コマンドゾーンのオペレーションの発動。
  candidates.push(...actionsOfType(actions, "use_magi_ticket").slice(0, 3));
  candidates.push(
    ...actionsOfType(actions, "initiate_command_payment")
      .filter((a) => !cpuWouldCancelProcedure(state, playerId, a))
      .slice(0, 4),
  );

  const end = endPhase(actions);
  if (end) candidates.push(end);

  return candidates;
}

/** 追加ドローで山札切れが早まるか。山札が少なく、相手より先に尽きそうなら引かない。 */
function avoidBonusDraw(state: GameState, playerId: PlayerId, threshold: number): boolean {
  const own = state.players[playerId].deck.length;
  const enemy = state.players[playerId === "player1" ? "player2" : "player1"].deck.length;
  return own <= threshold && own <= enemy + 1;
}

/** 手札の同じカードを置く手は結果が同じなので1つずつにする（読みの手間を減らす）。 */
function sameCardOnce(state: GameState, playerId: PlayerId, actions: GameAction[]): GameAction[] {
  const seen = new Set<string>();
  const hand = state.players[playerId].hand;
  return actions.filter((a) => {
    if (a.type !== "charge_power" && a.type !== "charge_command") return true;
    const cardId = hand.find((c) => c.instanceId === a.instanceId)?.cardId ?? a.instanceId;
    const key = `${a.type}:${cardId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function battleActionDelta(
  state: GameState,
  action: Extract<GameAction, { type: "battle" }>,
): number {
  const player = state.players[action.playerId];
  const enemy = state.players[opponent(action.playerId)];
  const attacker = player.battle.find((c) => c.instanceId === action.attackerInstanceId);
  const defender =
    enemy.battle.find((c) => c.instanceId === action.defenderInstanceId) ??
    enemy.rush.find((c) => c.instanceId === action.defenderInstanceId);
  if (!attacker || !defender) return Number.NEGATIVE_INFINITY;
  return (
    effectiveBp(state, action.playerId, attacker) -
    effectiveBp(state, opponent(action.playerId), defender)
  );
}

/** 呼び出し側（pickCpuActionInner のバトルフェイズ）で、出なければならないユニットが無いと確かめてから呼ぶ。 */
function collectBattleCandidates(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction[] {
  const candidates: GameAction[] = [
    ...actionsOfType(actions, "strike"),
    ...actionsOfType(actions, "battle")
      .sort((a, b) => battleActionDelta(state, b) - battleActionDelta(state, a))
      .slice(0, 20),
    ...actionsOfType(actions, "move_to_battle")
      .sort((a, b) => {
        const player = state.players[playerId];
        const cardA =
          player.rush.find((c) => c.instanceId === a.instanceId) ??
          player.hand.find((c) => c.instanceId === a.instanceId);
        const cardB =
          player.rush.find((c) => c.instanceId === b.instanceId) ??
          player.hand.find((c) => c.instanceId === b.instanceId);
        const bpA = cardA ? effectiveBp(state, playerId, cardA) : 0;
        const bpB = cardB ? effectiveBp(state, playerId, cardB) : 0;
        return bpB - bpA;
      })
      .slice(0, 12),
    ...actionsOfType(actions, "mount_ride").slice(0, 12),
    ...actionsOfType(actions, "play_operation").slice(0, 4),
    ...actionsOfType(actions, "hold_for_wing").slice(0, 3),
  ];

  const end = endPhase(actions);
  if (end) candidates.push(end);

  return candidates;
}

/**
 * レベル1 CPU: ヒューリスティックと主要局面での相手応答シミュレーション。
 */
export function pickCpuAction(
  state: GameState,
  playerId: PlayerId = state.activePlayer,
  options: PickCpuActionOptions = {},
): GameAction | null {
  return (
    pickCpuActionInner(state, playerId, options) ??
    pickCpuFallbackAction(state, playerId)
  );
}

function pickCpuActionInner(
  state: GameState,
  playerId: PlayerId = state.activePlayer,
  options: PickCpuActionOptions = {},
): GameAction | null {
  const enableSearch = options.enableSearch ?? (options.maxCandidates ?? 0) > 0;
  // 読みの中（simulationDepth が入る）では行わない。
  const planning = options.simulationDepth ? 0 : (options.planSamples ?? 0);
  const turnPlan = options.simulationDepth ? 0 : (options.turnPlanSteps ?? 0);
  const plans = (kind: "charge" | "rush" | "entry") => (planning > 0 && (!options.planPhases || options.planPhases.includes(kind)) ? planning : 0);
  const simShallow = (): SearchOptions | undefined => tacticalSearchOptions(state, options);
  const simTactical = (actions: GameAction[]): SearchOptions | undefined =>
    deepSearchOptions(state, playerId, actions, options) ?? tacticalSearchOptions(state, options);

  if (state.winner) return null;

  const payment = pickCommandPaymentResolve(state, playerId);
  if (payment) return payment;

  const damagePay = pickDamagePayment(state, playerId);
  if (damagePay) return damagePay;

  const zordStep = pickZordSetupStep(state, playerId);
  if (zordStep) return zordStep;

  if (state.pendingLeave) {
    if (playerId !== state.pendingLeave.ownerPlayerId) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_leave_reaction", enableSearch, options);
  }

  // RS-255 巨大化爆弾の使用の窓（使うか見送るか）。
  if (state.pendingGiantBomb) {
    if (playerId !== state.pendingGiantBomb.ownerId) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_leave_reaction", enableSearch, options);
  }

  if (state.pendingRegister) {
    if (playerId !== state.pendingRegister.ownerPlayerId) return null;
    const actions = getLegalActions(state);
    const useRegister = actions.find((a) => a.type === "use_register");
    if (useRegister) return useRegister;
    return actions.find((a) => a.type === "pass_register") ?? null;
  }

  if (state.pendingChase) {
    if (playerId !== state.pendingChase.chaserPlayerId) return null;
    const actions = getLegalActions(state);
    return (
      pickBestChase(state, playerId, actions) ??
      actions.find((a) => a.type === "pass_chase") ??
      null
    );
  }

  if (state.pendingRideOffChoice) {
    if (playerId !== state.pendingRideOffChoice.playerId) return null;
    const actions = getLegalActions(state);
    if (enableSearch) {
      const choices = actions.filter((a) => a.type === "resolve_ride_off_choice");
      const searched = pickBestBySearch(state, playerId, choices, simShallow());
      if (searched) return searched;
    }
    return pickRideOffChoice(state, playerId, actions);
  }

  if (state.pendingEffectChoice) {
    if (playerId !== state.pendingEffectChoice.playerId) return null;
    const actions = getLegalActions(state);
    const pending = state.pendingEffectChoice;

    // 配置するときに山札から重ねる選択（ライダーパス等）は読まずに上限まで重ねる（盤面評価では重ねない方が良く見える）。
    const deckStack = pickDeckStackChoice(state, pending, actions);
    if (deckStack) return deckStack;
    const mirrorStack = pickMirrorWorldChoice(state, playerId);
    if (mirrorStack) return mirrorStack;

    if (enableSearch && pending.kind === "deck_top_or_bottom") {
      const placements = actionsOfType(actions, "resolve_ruin_survey");
      if (placements.length > 0) {
        return pickBestBySearch(state, playerId, placements, simShallow()) ?? pickEffectChoice(state, pending, actions);
      }
    }

    if (pending.kind === "denji_machine") {
      return pickEffectChoice(state, pending, actions);
    }

    if (pending.kind === "seabed_draw") {
      const placements = actionsOfType(actions, "resolve_seabed_draw");
      if (placements.length > 0) {
        return pickBestBySearch(state, playerId, placements, simShallow()) ?? placements[0] ?? null;
      }
    }

    if (enableSearch && pending.effectId === "earth_force" && pending.optional) {
      const pay = actions.find((a) => a.type === "resolve_effect_choice");
      const skip = actions.find((a) => a.type === "skip_effect_choice");
      if (pay && skip) {
        return pickBestBySearch(state, playerId, [pay, skip], simShallow());
      }
    }

    if (enableSearch && (pending.optional || pending.mayConfirm) && pending.kind !== "scry_keep_one") {
      // 「～してもよい」の確認（confirm_effect_choice）も「行う」の手として比べる（以前は候補に無く、一度も選ばれなかった）。
      const pay = actions.filter((a) => a.type === "resolve_effect_choice" || a.type === "confirm_effect_choice");
      const skip = actions.find((a) => a.type === "skip_effect_choice");
      if (pay.length > 0 && skip) {
        const searched = pickBestBySearch(state, playerId, [...pay, skip], simShallow());
        if (searched) return searched;
      }
    }

    return pickEffectChoice(state, pending, actions);
  }

  if (state.pendingRush) {
    if (playerId !== rushReactorId(state.pendingRush)) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_rush_reaction", enableSearch, options);
  }

  if (state.pendingBattle) {
    if (playerId !== state.pendingBattle.defenderPlayerId) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_battle_reaction", enableSearch, options);
  }

  if (state.pendingStrike) {
    if (playerId !== opponent(state.pendingStrike.strikerPlayerId)) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_strike_reaction", enableSearch, options);
  }

  if (state.pendingBattleEntry) {
    if (playerId !== state.pendingBattleEntry.playerId) return null;
    const actions = getLegalActions(state);
    const lethal = pickBestStrike(state, playerId, actions);
    if (lethal) return lethal;
    // 出た直後に起動できる NC 効果（「「MA」の自軍コマンドを１つホールドして、次の効果を発動できる」等）は、
    // アタック・ストライクの前に使う（1ターンに1回）。
    const entryActivation = actions.find(
      (a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === state.pendingBattleEntry!.instanceId,
    );
    if (entryActivation) return entryActivation;

    if (plans("entry")) {
      const planned = pickBestByRollout(state, playerId, [
        ...actionsOfType(actions, "strike"),
        ...actionsOfType(actions, "battle"),
        ...actions.filter((a) => a.type === "pass_battle_entry"),
      ], plans("entry"), options.planTurns);
      if (planned) return planned;
    }

    if (enableSearch) {
      const candidates = [
        ...actionsOfType(actions, "strike"),
        ...actionsOfType(actions, "battle"),
        ...actions.filter((a) => a.type === "pass_battle_entry"),
      ];
      const searched = pickBestBySearch(state, playerId, candidates, simTactical(actions));
      if (turnPlan > 0) return pickBestByTurnPlan(state, playerId, searched ? [searched, ...candidates] : candidates, TURN_PLAN_POLICY, turnPlan) ?? searched;
      if (searched) return searched;
    }

    return (
      pickWinningBattle(state, actions) ??
      pickFavorableBattle(state, actions) ??
      actions.find((a) => a.type === "pass_battle_entry") ??
      null
    );
  }

  if (state.activePlayer !== playerId) return null;

  const actions = getLegalActions(state);
  if (actions.length === 0) return null;

  switch (state.phase) {
    case "start": {
      // スタートフェイズに使える起動効果（場のユニットの起動など）は、いつもの進め方と読み比べる。
      const activations = actions.filter((a) => a.type === "activate_field_unit_ability" || a.type === "activate_resident_operation");
      if (enableSearch && activations.length > 0) {
        const usual = pickStartPhaseAction(state, playerId, actions, options);
        const best = pickBestBySearch(state, playerId, usual ? [...activations, usual] : activations, simShallow());
        if (best) return best;
      }
      return pickStartPhaseAction(state, playerId, actions, options);
    }

    case "charge": {
      const heuristicCharge = pickChargeAction(state, playerId, actions) ?? endPhase(actions);
      if (plans("charge")) {
        const choices = options.planChargeTop
          ? chargeCandidates(state, playerId, actions, options.planChargeTop)
          : sameCardOnce(state, playerId, actions.filter((a) => a.type === "charge_power" || a.type === "charge_command" || a.type === "end_phase"));
        if (options.deckAwareCharge) {
          const self = state.players[playerId];
          // コマンドが 1 枚もないのに簡易判断がコマンドを置くなら従う（先読みはパワーを選びがちで、
          // コマンドが無いままラッシュできずに何ターンも過ごしていた。XG1 スターターC など）。
          if (self.command.length === 0 && heuristicCharge?.type === "charge_command") return heuristicCharge;
          // デッキで一番重いカードの必要パワーに届いたら、先読みせず簡易判断に従う。先読みは手札を減らす手を
          // 好み、使い道のないパワーを 10 枚以上溜めたり、後でラッシュできるユニットをコマンドに置いたりしていた。
          if (self.power.length >= deckProfile(state, playerId).maxPowerCost) return heuristicCharge;
        }
        const planned = pickBestByRollout(
          state,
          playerId,
          choices,
          plans("charge"),
          options.planTurns,
          options.planMaxSteps,
        );
        if (planned) return planned;
      }
      return heuristicCharge;
    }

    case "rush": {
      const mirror = pickMirrorWorldActivation(state, playerId, actions);
      if (mirror) return mirror;
      const beginZord = pickBeginZordSetup(state, playerId, actions);
      if (beginZord && !enableSearch) return beginZord;

      const affordable = affordableRushes(state, playerId, actions);
      if (plans("rush")) {
        const candidates = collectRushCandidates(state, playerId, actions);
        if (beginZord) candidates.unshift(beginZord);
        candidates.push(...remainingActions(state, playerId, candidates, actions).filter((a) => !isNoOpForCpu(state, playerId, a, options)));
        const planned = pickBestByRollout(state, playerId, candidates, plans("rush"), options.planTurns);
        if (planned) return planned;
      }
      if (enableSearch) {
        let candidates = collectRushCandidates(state, playerId, actions);
        if (beginZord) candidates.unshift(beginZord);
        if (
          affordable.length > 0 ||
          handHasRushUnits(state, playerId)
        ) {
          candidates = candidates.filter((a) => a.type !== "end_phase");
        }
        candidates = dedupeActions(candidates);
        if (turnPlan > 0) return pickByTurnPlan(state, playerId, candidates, actions, simShallow(), options, turnPlan);
        const best = pickBestWithRemaining(state, playerId, candidates, actions, simShallow(), options);
        if (best) return best;
      }

      if (beginZord) return beginZord;

      const rush = pickBestRushByScore(state, affordable);
      if (rush) {
        const hold = pickHoldBeforeRush(state, playerId, actions, rush);
        return hold ?? rush;
      }

      const categoryPay = pickRushCategoryPayment(state, playerId, actions);
      if (categoryPay) return categoryPay;

      const bestOp = pickBestOperation(state, actions);
      if (bestOp) return bestOp;

      return endPhase(actions);
    }

    case "battle": {
      const hold = pickHoldBeforeBattle(state, playerId, actions);
      if (hold) return hold;

      const lethalStrike = pickBestStrike(state, playerId, actions);
      if (lethalStrike?.type === "strike") {
        const enemy = state.players[opponent(playerId)];
        const card = state.players[playerId].battle.find(
          (c) => c.instanceId === lethalStrike.instanceId,
        );
        if (card) {
          const damage = strikeDamageFor(state.definitions, card, state, playerId);
          if (enemy.damage + damage >= WIN_DAMAGE) return lethalStrike;
        }
      }

      // NC が成立する並べ方の最初の 1 体（comboOrder: 1 = 今成立する手だけ、2 = 後の NC のための先出しも）。
      // 「毎ターン、可能ならバトルエリアに出る」ユニットより先に見る。出る順番までは決まっていない（出ないまま
      // バトルフェイズを終えられないだけ）のに、先に出して NC の位置をふさいでいた（7弾スターターC の
      // ゴーオンレッド等。同デッキ同士の Lv2 対戦で 96% 勝つようになった、2026-10-21）。
      if (options.comboOrder) {
        const plan = planComboEntry(state, playerId, actions);
        if (plan && (plan.triggersNow || options.comboOrder >= 2)) return plan.move;
      }

      const mandatory = pickMandatoryBattleMove(state, playerId, actions);
      if (mandatory) return mandatory;

      if (enableSearch) {
        // 出なければならないユニットは上の pickMandatoryBattleMove で見て無かった（同じ状態・同じ合法手なので調べ直さない）。
        let candidates = collectBattleCandidates(state, playerId, actions);
        const hasRushUnits = state.players[playerId].rush.length > 0;
        const hasCombat =
          actionsOfType(actions, "strike").length > 0 ||
          actionsOfType(actions, "battle").length > 0;
        if (hasRushUnits || hasCombat) {
          candidates = candidates.filter((a) => a.type !== "end_phase");
        }
        if (turnPlan > 0) return pickByTurnPlan(state, playerId, candidates, actions, simTactical(actions), options, turnPlan);
        const best = pickBestWithRemaining(state, playerId, candidates, actions, simTactical(actions), options);
        if (best) return best;
      }

      const moveToBattle = actionsOfType(actions, "move_to_battle");
      // ストライクで点を取るには、出せるユニットはすべて出す（以前はバトルエリアが空のときだけで、
      // 1ターンに1体しか出ず NC が成立しないまま山札切れで終わっていた）。
      if (moveToBattle.length > 0) {
        return pickBestBattleEntry(state, playerId, actions);
      }

      const battle =
        pickWinningBattle(state, actions) ??
        pickFavorableBattle(state, actions);
      if (battle) return battle;
      return pickBestStrike(state, playerId, actions) ?? endPhase(actions);
    }

    case "end":
      return endPhase(actions);

    default:
      return endPhase(actions);
  }
}

/** スタートフェイズのいつもの進め方（コマンドを戻す → バトルエリアを戻す → ドロー → 追加ドロー）。 */
function pickStartPhaseAction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  options: PickCpuActionOptions,
): GameAction | null {
  const release = actions.find((action) => action.type === "release_start_commands");
  if (release) return release;
  // 既定は並び順で1体ずつすべて戻す（instanceId なし）。
  const returnBattle = actions.find(
    (action) => action.type === "return_all_battle_to_rush" && !action.instanceId,
  );
  if (returnBattle) return returnBattle;
  const draw = actions.find((action) => action.type === "draw");
  if (draw) return draw;
  const upkeep = actions.find((action) => action.type === "resolve_effect_choice");
  if (upkeep) return upkeep;
  const bonus = actions.find((action) => action.type === "bonus_draw");
  if (bonus && !(options.deckGuard && avoidBonusDraw(state, playerId, options.deckGuard))) return bonus;
  return actions.find((action) => action.type === "skip_bonus_draw") ?? bonus ?? null;
}

export function isCpuTurn(state: GameState, cpuPlayer: PlayerId = "player2"): boolean {
  if (state.winner) return false;
  if (state.pendingCommandPayment) {
    return state.pendingCommandPayment.playerId === cpuPlayer;
  }
  if (state.pendingZordSetup) {
    return state.pendingZordSetup.playerId === cpuPlayer;
  }
  if (state.pendingDamagePayment) {
    return damagePaymentChoosingPlayer(state.pendingDamagePayment) === cpuPlayer;
  }
  if (state.pendingEffectChoice) {
    return state.pendingEffectChoice.playerId === cpuPlayer;
  }
  if (state.pendingLeave) {
    return state.pendingLeave.ownerPlayerId === cpuPlayer;
  }
  if (state.pendingGiantBomb) {
    return state.pendingGiantBomb.ownerId === cpuPlayer;
  }
  if (state.pendingRegister) {
    return state.pendingRegister.ownerPlayerId === cpuPlayer;
  }
  if (state.pendingChase) {
    return state.pendingChase.chaserPlayerId === cpuPlayer;
  }
  if (state.pendingRideOffChoice) {
    return state.pendingRideOffChoice.playerId === cpuPlayer;
  }
  if (state.pendingRush) {
    const defenderId = rushReactorId(state.pendingRush);
    return state.activePlayer === defenderId && defenderId === cpuPlayer;
  }
  if (state.pendingBattle) {
    const defenderId = state.pendingBattle.defenderPlayerId;
    return state.activePlayer === defenderId && defenderId === cpuPlayer;
  }
  if (state.pendingStrike) {
    const defenderId = opponent(state.pendingStrike.strikerPlayerId);
    return state.activePlayer === defenderId && defenderId === cpuPlayer;
  }
  if (state.pendingBattleEntry) {
    return state.pendingBattleEntry.playerId === cpuPlayer;
  }
  return state.activePlayer === cpuPlayer;
}
