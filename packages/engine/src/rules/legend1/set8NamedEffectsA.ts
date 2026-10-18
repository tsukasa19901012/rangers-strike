/**
 * 第8弾「究極の八神」（legend1）RS-516〜RS-537 のカード固有の効果（cardSpec RS8-516-537 の既知の不具合の修正）。
 *
 * - NC の効果: `trySet8ANumberCombo`（rules/numberComboEffects.ts applyNumberComboEffect から呼ぶ）
 * - 「これはアタックされない」（RS-517 バードニック反応炉）: `set8ADefenderBlocksAttack`（rules/legend3/restrictions.ts）
 * - applyAction の後処理（RS-533【フェニックスファイヤー】のドロー）: `applySet8AAfterAction`（core/applyAction.ts）
 * - 選択の解決: `tryResolveSet8AChoice` / `trySkipSet8AChoice` / `tryConfirmSet8AChoice`（rules/pendingChoices.ts）
 * 構成は rules/legend1/set7NamedEffectsA.ts と同じ。出典は各節のコメント（atwiki/page-N）。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId, TagChoiceMeta } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, effectiveCommandCategories, getDefinition, parsePowerCost, unitEffectiveCategories } from "../../core/catalog";
import { finalizeEffectRush } from "../../events/emitUnitRushed";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice, requestDrawFromDeck, type ChoiceOutcome } from "../pendingChoices";
import { applyDamageToPlayer } from "../damagePayment";
import { patchPlayer } from "../playerPatches";
import { findCardInField } from "../fieldLookup";
import { unitFeatures } from "../addedFeatures";
import { markBattleNcEffect } from "../namedUnitEffects";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { isSmallUnitNow } from "./set6NamedEffectsB";
import { bounceAllFromZone } from "../bounce";
import { shuffleCards } from "../errataCardEffects";
import { addSet8Category, addSet8NumberDelta } from "./set8TurnGrants";
import type { ComboOutcome } from "../comboTypes";
import { listZordFusionPartnerIds } from "@rangers-strike/cards";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome | null;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};
/** 解決をこのモジュールで完結させる選択（候補の一覧・確定の合法手をこのモジュールの規則で出す）。 */
const OWN_CHOICES = new Set<string>();

export function isSet8AChoiceEffect(effectId: string): boolean {
  return OWN_CHOICES.has(effectId);
}

export function isSet8AConfirmableChoice(pending: PendingEffectChoice): boolean {
  return pending.effectId in CHOICE_CONFIRMERS;
}

/**
 * 選択の解決。null を返したら、汎用の解決（unitDestination による移動・撃破等）に任せる
 * （RS-518 獣撃棒のホールド状態のユニットの撃破、RS-532【ミサイル発射】の撃破）。
 */
export function tryResolveSet8AChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

export function trySkipSet8AChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

export function tryConfirmSet8AChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const confirmer = CHOICE_CONFIRMERS[pending.effectId];
  return confirmer ? confirmer(state, playerId) : null;
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function skipLog(state: GameState, playerId: PlayerId, cardId: string, effectId: string): string {
  return buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${effectId}:skipped`);
}

/** 選択を閉じる。割り込まれていた選択（resumeChoice）があれば再開し、無ければ保留中のバトル進入を続ける。 */
function finish(state: GameState, pending: PendingEffectChoice): GameState {
  const stillOpen = state.pendingEffectChoice === pending;
  const cleared: GameState = stillOpen
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
  if (cleared.pendingLeave || cleared.pendingEffectChoice) {
    if (pending.resumeChoice && cleared.pendingEffectChoice && cleared.pendingEffectChoice !== pending) {
      return {
        ...cleared,
        pendingEffectChoice: { ...cleared.pendingEffectChoice, resumeChoice: cleared.pendingEffectChoice.resumeChoice ?? pending.resumeChoice },
      };
    }
    return cleared;
  }
  if (pending.resumeChoice) return openEffectChoice(cleared, pending.resumeChoice);
  return promoteDeferredBattleEntry(cleared);
}

/** 次の選択を開く（元の選択の resumeChoice を引き継ぐ）。 */
function reopen(state: GameState, pending: PendingEffectChoice, next: PendingEffectChoice): GameState {
  return openEffectChoice(
    { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId },
    { ...next, resumeChoice: pending.resumeChoice },
  );
}

function simpleSkip(cardId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending), log: skipLog(state, playerId, cardId, pending.effectId) };
  };
}

function register(effectId: string, resolver: ChoiceResolver, skipper?: ChoiceSkipper, own = true): void {
  CHOICE_RESOLVERS[effectId] = resolver;
  if (skipper) CHOICE_SKIPPERS[effectId] = skipper;
  if (own) OWN_CHOICES.add(effectId);
}

function categoriesOf(state: GameState, cardId: string): string[] {
  const c = getDefinition(state.definitions, cardId)?.category as unknown;
  return Array.isArray(c) ? (c as string[]) : typeof c === "string" ? [c] : [];
}

function isUnitCard(state: GameState, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

/** 必要パワーの数字（「7+」「5-」は 7・5）。 */
function powerCostNumber(state: GameState, cardId: string): number {
  return parsePowerCost(getDefinition(state.definitions, cardId)?.powerCost);
}

function ncLog(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "number_combo", cardId, state.definitions, detail);
}

function selectableEnemy(state: GameState, playerId: PlayerId, card: CardInstance, sourceCardId: string): boolean {
  return isSelectableByOpponentEffect(state, playerId, card.instanceId, sourceCardId);
}

// ---------------------------------------------------------------------------
// NC の効果（rules/numberComboEffects.ts applyNumberComboEffect から）

const NC_EFFECT_IDS: Record<string, string> = {
  "RS-530": "rezabimu",
  "RS-531": "misairu_e5afbe",
  "RS-532": "misairu_e3839f",
  "RS-533": "fuenikusufuaiya",
  "RS-535": "doragonataku",
  "RS-536": "gurifuonmagumagyarakushii",
  "RS-537": "mameidotaifunuebu",
};

/** このモジュールが NC の効果を処理するカード。 */
export function isSet8ANcCard(cardId: string): boolean {
  return cardId in NC_EFFECT_IDS;
}

export function trySet8ANumberCombo(state: GameState, playerId: PlayerId, card: CardInstance): ComboOutcome | null {
  const effectId = NC_EFFECT_IDS[card.cardId];
  if (!effectId) return null;
  const established = markBattleNcEffect(state, playerId, card.instanceId, effectId);
  const logs = [ncLog(state, playerId, card.cardId, effectId)];
  switch (card.cardId) {
    case "RS-530":
      return { state: openLaserBeam(established, playerId, card), logs };
    case "RS-531":
      return { state: openGroundMissile(established, playerId, card), logs };
    case "RS-532":
      return { state: openMissileLaunch(established, playerId, card), logs };
    case "RS-533":
      return { state: startPhoenixFire(established, playerId, card), logs };
    case "RS-535":
      return { state: openDragonAttack(established, playerId, card), logs };
    case "RS-536":
      return { state: openGriffonMagma(established, playerId, card), logs };
    case "RS-537":
      return { state: openMermaidTyphoon(established, playerId, card), logs };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// RS-530 ジェットチェンジャー1【レーザービーム砲】
// 「敵軍バトルエリアから、必要パワーに「+」を持たないユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。
//  置けなければこの効果は発動できない。」（atwiki/page-1157）— 選択は見送れない。

export const LASER_BEAM_EFFECT_ID = "rs530_laser_beam";

function hasPlusPowerCost(state: GameState, cardId: string): boolean {
  const cost = getDefinition(state.definitions, cardId)?.powerCost;
  return typeof cost === "string" && /[+＋]/.test(cost);
}

function openLaserBeam(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const enemyId = opponent(playerId);
  if (state.players[enemyId].command.length >= COMMAND_ZONE_MAX) return state;
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitCard(state, c.cardId) && !hasPlusPowerCost(state, c.cardId) && selectableEnemy(state, playerId, c, card.cardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: LASER_BEAM_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: ids,
    unitDestination: "enemy_command",
    selectCount: 1,
    optional: false,
  });
}
// 置き方は汎用の unitDestination "enemy_command"（持ち主のコマンドゾーンにホールド状態）で処理する。

// ---------------------------------------------------------------------------
// RS-531 ヘリチェンジャー2【対地ミサイル】
// 「敵軍捨札からカードを1枚選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければこの効果は発動できない。」
// （atwiki/page-1158）

export const GROUND_MISSILE_EFFECT_ID = "rs531_ground_missile";

function openGroundMissile(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const enemy = state.players[opponent(playerId)];
  if (enemy.command.length >= COMMAND_ZONE_MAX || enemy.discard.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: GROUND_MISSILE_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: enemy.discard.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

register(
  GROUND_MISSILE_EFFECT_ID,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const enemy = state.players[enemyId];
    const picked = enemy.discard.find((c) => c.instanceId === instanceId);
    if (!picked || enemy.command.length >= COMMAND_ZONE_MAX) return { error: "invalid_target" };
    const next = patchPlayer(state, enemyId, (p) => ({
      ...p,
      discard: p.discard.filter((c) => c.instanceId !== instanceId),
      command: [...p.command, { instanceId: picked.instanceId, cardId: picked.cardId, commandHeld: true }],
    }));
    return {
      state: finish(next, pending),
      log: logFor(state, playerId, "RS-531", `${GROUND_MISSILE_EFFECT_ID}:${cardName(state.definitions, picked.cardId)}`),
    };
  },
  simpleSkip("RS-531"),
);

// ---------------------------------------------------------------------------
// RS-532 ランドチェンジャー3【ミサイル発射】
// 「合体の必要な敵軍ユニットを1体選び撃破する。ただし、選んだユニットの合体に必要なユニットカードのうち、どれか1枚でも
//  敵軍捨札にあれば、そのユニットは撃破できない。」（atwiki/page-1159）— エリアの指定なし（ラッシュエリアも可）。
// Q&A: 素材のうちビークル（魔導馬バリキオン）は「ユニットカード」ではない（grnrngr/faq-card-8 RS-532）。

export const MISSILE_LAUNCH_EFFECT_ID = "rs532_missile_launch";

function requiresFusion(state: GameState, cardId: string): boolean {
  if (listZordFusionPartnerIds(cardId).length > 0) return true;
  return /^合体[―ー-]/.test(getDefinition(state.definitions, cardId)?.text ?? "");
}

/** 合体に必要なユニットカード（ビークル等のユニットカードでない素材は除く）のどれかが敵軍捨札にあるか。 */
function fusionUnitMaterialInDiscard(state: GameState, ownerId: PlayerId, cardId: string): boolean {
  const partners = listZordFusionPartnerIds(cardId).filter((id) => isUnitCard(state, id));
  const names = new Set(partners.map((id) => getDefinition(state.definitions, id)?.name).filter((n): n is string => !!n));
  return state.players[ownerId].discard.some((c) => {
    if (!isUnitCard(state, c.cardId)) return false;
    if (partners.includes(c.cardId)) return true;
    const name = getDefinition(state.definitions, c.cardId)?.name;
    return name !== undefined && names.has(name);
  });
}

function openMissileLaunch(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const enemy = state.players[opponent(playerId)];
  const ids = [...enemy.battle, ...enemy.rush]
    .filter((c) => isUnitCard(state, c.cardId) && requiresFusion(state, c.cardId) && selectableEnemy(state, playerId, c, card.cardId))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: MISSILE_LAUNCH_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: ids,
    unitDestination: "discard",
    selectCount: 1,
    optional: false,
  });
}

// 素材が敵軍捨札にあれば撃破できない（選んだだけで終わる）。そうでなければ汎用の撃破（R-TIME-01 の段階処理を含む）。
register(
  MISSILE_LAUNCH_EFFECT_ID,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const found = findCardInField(state, instanceId);
    if (!found) return { error: "invalid_target" };
    if (!fusionUnitMaterialInDiscard(state, found.playerId, found.card.cardId)) return null;
    return {
      state: finish(state, pending),
      log: logFor(state, playerId, "RS-532", `${MISSILE_LAUNCH_EFFECT_ID}:cannot_destroy:${cardName(state.definitions, found.card.cardId)}`),
    };
  },
  undefined,
  false,
);

// ---------------------------------------------------------------------------
// RS-533 チェンジフェニックス【フェニックスファイヤー】
// 「このターン、敵軍ユニットを持ち主のパワーゾーンにダメージにして置くたび、自分は1枚ドローしてもよい。」（atwiki/page-1160）
// 自身は敵軍ユニットを動かさない。どの効果で置いても（冥府神トード【魂のコレクション】等。grnrngr/faq-card-8 RS-533 Q）、
// applyAction の後処理で、場から持ち主のパワーゾーンにウラ向きで置かれた敵軍ユニットを数える。

export const PHOENIX_FIRE_RULE = "rs533_phoenix_fire";
export const PHOENIX_FIRE_DRAW_EFFECT_ID = "rs533_phoenix_fire_draw";

function startPhoenixFire(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  return patchPlayer(state, playerId, (p) =>
    addTurnRuleModifier(p, PHOENIX_FIRE_RULE, { sourceCardId: card.cardId, payload: { instanceId: card.instanceId } }),
  );
}

function phoenixFireSources(state: GameState, playerId: PlayerId): string[] {
  return getPlayerModifiers(state.players[playerId])
    .filter((m) => m.kind === "rule" && m.ruleId === PHOENIX_FIRE_RULE && m.scope === "turn")
    .map((m) => (m.kind === "rule" ? ((m.payload as { instanceId?: string } | undefined)?.instanceId ?? "RS-533") : "RS-533"));
}

/** 1アクションの間に、場（ラッシュエリア・バトルエリア）から持ち主のパワーゾーンにウラ向きで置かれたユニットの数。 */
function unitsPlacedAsDamage(before: GameState, after: GameState, ownerId: PlayerId): number {
  const wasField = new Set([...before.players[ownerId].rush, ...before.players[ownerId].battle].map((c) => c.instanceId));
  const wasPower = new Set(before.players[ownerId].power.map((c) => c.instanceId));
  return after.players[ownerId].power.filter((c) => c.faceDown && wasField.has(c.instanceId) && !wasPower.has(c.instanceId)).length;
}

function queuePhoenixFire(before: GameState, after: GameState): GameState {
  let queue = after.set8aDrawQueue ?? [];
  for (const pid of ["player1", "player2"] as const) {
    const sources = phoenixFireSources(after, pid);
    if (sources.length === 0) continue;
    const placed = unitsPlacedAsDamage(before, after, opponent(pid));
    for (let i = 0; i < placed; i += 1) {
      queue = [...queue, ...sources.map((sourceInstanceId) => ({ playerId: pid, sourceInstanceId }))];
    }
  }
  return queue === (after.set8aDrawQueue ?? []) ? after : { ...after, set8aDrawQueue: queue };
}

function openPhoenixFireIfReady(state: GameState): GameState {
  const queue = state.set8aDrawQueue ?? [];
  const head = queue[0];
  if (!head) return state;
  const rest = queue.slice(1);
  const next: GameState = { ...state, set8aDrawQueue: rest.length > 0 ? rest : undefined };
  if (next.players[head.playerId].deck.length === 0) return openPhoenixFireIfReady(next);
  return openEffectChoice(next, {
    playerId: head.playerId,
    effectId: PHOENIX_FIRE_DRAW_EFFECT_ID,
    sourceCardId: "RS-533",
    sourceInstanceId: head.sourceInstanceId,
    kind: "confirm",
    phasePlayerId: turnPlayerOf(next),
    // 「ドローする」を選ぶ1つだけの候補（発動元）。見送ればドローしない。
    validInstanceIds: [head.sourceInstanceId],
    selectCount: 1,
    optional: true,
  });
}

function turnPlayerOf(state: GameState): PlayerId {
  return state.pendingEffectChoice?.phasePlayerId ?? state.activePlayer;
}

register(
  PHOENIX_FIRE_DRAW_EFFECT_ID,
  (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
    const drawn = requestDrawFromDeck(cleared, playerId, pending.phasePlayerId, { sourceCardId: "RS-533" });
    const next = drawn.pending ? drawn.state : finish(drawn.state, { ...pending });
    return { state: next, log: logFor(state, playerId, "RS-533", `${PHOENIX_FIRE_DRAW_EFFECT_ID}:draw`) };
  },
  simpleSkip("RS-533"),
);

// ---------------------------------------------------------------------------
// RS-535 チェンジドラゴン【ドラゴンアタック】
// 「特徴「ドラゴン」を持つ自軍ユニットが1体以上あれば、その数と同じ必要パワーの数字を持つ敵軍ユニットを1体選び、
//  持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1222）— これ自身も自軍バトルエリアでは「ドラゴン」
// （rules/addedFeatures.ts battleAreaAddedFeatures）。

export const DRAGON_ATTACK_EFFECT_ID = "rs535_dragon_attack";

function openDragonAttack(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const me = state.players[playerId];
  const count = [...me.battle, ...me.rush].filter((c) => unitFeatures(state, playerId, c).includes("ドラゴン")).length;
  if (count < 1) return state;
  const enemy = state.players[opponent(playerId)];
  const ids = [...enemy.battle, ...enemy.rush]
    .filter((c) => isUnitCard(state, c.cardId) && powerCostNumber(state, c.cardId) === count && selectableEnemy(state, playerId, c, card.cardId))
    .map((c) => c.instanceId);
  return openPowerDamageChoice(state, playerId, card, DRAGON_ATTACK_EFFECT_ID, ids);
}

function openPowerDamageChoice(state: GameState, playerId: PlayerId, card: CardInstance, effectId: string, ids: string[]): GameState {
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: ids,
    unitDestination: "power",
    placeAsDamage: true,
    selectCount: 1,
    optional: true,
  });
}

// ---------------------------------------------------------------------------
// RS-536 チェンジグリフォン【グリフォンマグマギャラクシィ】
// 「自分の手札が1枚以上あれば、その枚数と同じ数の必要パワーの数字を持つ敵軍バトルエリアのSユニットを1体選び、
//  持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1162）

export const GRIFFON_MAGMA_EFFECT_ID = "rs536_griffon_magma_galaxy";

function openGriffonMagma(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const handCount = state.players[playerId].hand.length;
  if (handCount < 1) return state;
  const enemyId = opponent(playerId);
  const ids = state.players[enemyId].battle
    .filter(
      (c) =>
        isUnitCard(state, c.cardId) &&
        isSmallUnitNow(state, enemyId, c) &&
        powerCostNumber(state, c.cardId) === handCount &&
        selectableEnemy(state, playerId, c, card.cardId),
    )
    .map((c) => c.instanceId);
  return openPowerDamageChoice(state, playerId, card, GRIFFON_MAGMA_EFFECT_ID, ids);
}

// ---------------------------------------------------------------------------
// RS-537 チェンジマーメイド【マーメイドタイフーンウェーブ】
// 「ホールド状態のSユニットをすべて持ち主の手札に戻してもよい。」（atwiki/page-1163）— 自軍・敵軍、ラッシュエリア・バトルエリア。

export const MERMAID_TYPHOON_EFFECT_ID = "rs537_mermaid_typhoon_wave";

function heldSmallUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.rush, ...p.battle].filter((c) => c.commandHeld && isUnitCard(state, c.cardId) && isSmallUnitNow(state, playerId, c));
}

function openMermaidTyphoon(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (heldSmallUnits(state, "player1").length + heldSmallUnits(state, "player2").length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: MERMAID_TYPHOON_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "confirm",
    phasePlayerId: playerId,
    // 「戻す」を選ぶ1つだけの候補（発動元）。見送れば何も戻らない。
    validInstanceIds: [card.instanceId],
    selectCount: 1,
    optional: true,
  });
}

register(
  MERMAID_TYPHOON_EFFECT_ID,
  (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    let next = state;
    let count = 0;
    for (const pid of ["player1", "player2"] as const) {
      const ids = new Set(heldSmallUnits(next, pid).map((c) => c.instanceId));
      count += ids.size;
      for (const zone of ["rush", "battle"] as const) {
        next = bounceAllFromZone(next, pid, zone, (c) => ids.has(c.instanceId)).state;
      }
    }
    return { state: finish(next, pending), log: logFor(state, playerId, "RS-537", `${MERMAID_TYPHOON_EFFECT_ID}:${count}`) };
  },
  simpleSkip("RS-537"),
);

// ---------------------------------------------------------------------------
// RS-517 バードニック反応炉
// 「※常駐 自軍コマンドゾーンにスクラムを持つユニットカードがあれば、そのカードと同じＣＮを持つBP2000以下の自軍Sユニットは
//  次の能力を得る⇒これはアタックされない。」（atwiki/page-1234）

const SCRUM_TEXT_RE = /※スクラム/;

export function set8ADefenderBlocksAttack(state: GameState, defenderPlayerId: PlayerId, defender: CardInstance): boolean {
  const owner = state.players[defenderPlayerId];
  if (!owner.operation.some((c) => c.cardId === "RS-517")) return false;
  const def = getDefinition(state.definitions, defender.cardId);
  if (def?.type !== "unit" || typeof def.comboNumber !== "number") return false;
  if (!isSmallUnitNow(state, defenderPlayerId, defender)) return false;
  if (effectiveBp(state, defenderPlayerId, defender) > 2000) return false;
  return owner.command.some((c) => {
    const cmd = getDefinition(state.definitions, c.cardId);
    return cmd?.type === "unit" && SCRUM_TEXT_RE.test(cmd.text ?? "") && cmd.comboNumber === def.comboNumber;
  });
}

// ---------------------------------------------------------------------------
// RS-518 獣撃棒
// 「敵軍Sユニットを1体選ぶ。選んだユニットがホールド状態なら撃破し、リリース状態ならホールドする。」（atwiki/page-1147）
// 選ぶのは使用者。コマンドゾーンの S ユニットのカードは「ユニット」ではない（R-ZONE-03）。

export const BEAST_ROD_EFFECT_ID = "rs518_beast_rod";

export function openBeastRod(state: GameState, playerId: PlayerId, operationInstanceId: string, phasePlayerId: PlayerId): GameState {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const ids = [...enemy.battle, ...enemy.rush]
    .filter((c) => isUnitCard(state, c.cardId) && isSmallUnitNow(state, enemyId, c) && selectableEnemy(state, playerId, c, "RS-518"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: BEAST_ROD_EFFECT_ID,
    sourceCardId: "RS-518",
    sourceInstanceId: operationInstanceId,
    kind: "select_unit",
    phasePlayerId,
    validInstanceIds: ids,
    // ホールド状態のユニットは汎用の撃破（unitDestination "discard"）。リリース状態ならこのモジュールでホールドする。
    unitDestination: "discard",
    selectCount: 1,
    optional: false,
  });
}

register(
  BEAST_ROD_EFFECT_ID,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const found = findCardInField(state, instanceId);
    if (!found) return { error: "invalid_target" };
    if (found.card.commandHeld) return null;
    const next = patchPlayer(state, found.playerId, (p) => ({
      ...p,
      [found.zone]: p[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
    }));
    return {
      state: finish(next, pending),
      log: logFor(state, playerId, "RS-518", `${BEAST_ROD_EFFECT_ID}:hold:${cardName(state.definitions, found.card.cardId)}`),
    };
  },
  undefined,
  false,
);

// ---------------------------------------------------------------------------
// RS-527 バルジオン（2nd）【反バイオ粒子砲】
// 「これにライドしているユニットは「Lユニット」になり、OTを持つ敵軍コマンド1つにつき、「BP+1000」される。
//  また、これにライドしているユニットは、「バイオハンター・シルバ」なら「SP1」になる。」（atwiki/page-1156）

function ridingVehicleCardId(state: GameState, playerId: PlayerId, instance: CardInstance): string | undefined {
  const p = state.players[playerId];
  const self = [...p.battle, ...p.rush].find((c) => c.instanceId === instance.instanceId);
  const vehicleId = self?.mountedOnInstanceId;
  if (!vehicleId) return undefined;
  return [...p.battle, ...p.rush].find((c) => c.instanceId === vehicleId)?.cardId;
}

/** BP の継続効果（rules/fieldAuras.ts から呼ぶ）。 */
export function set8AFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  if (ridingVehicleCardId(state, playerId, instance) !== "RS-527") return 0;
  const otCommands = state.players[opponent(playerId)].command.filter((c) => categoriesOf(state, c.cardId).includes("OT")).length;
  return 1000 * otCommands;
}

/** 「SP1」になる継続効果（rules/legend3/fieldEffects.ts から呼ぶ）。 */
export function set8AEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (sp >= 1) return sp;
  if (ridingVehicleCardId(state, playerId, instance) !== "RS-527") return sp;
  return sameCardName(getDefinition(state.definitions, instance.cardId)?.name, "バイオハンター・シルバ") ? 1 : sp;
}

// ---------------------------------------------------------------------------
// RS-529 チェンジロボ【電撃剣スーパーサンダーボルト】
// 「これがアタックまたはストライクしたとき、MAを持つ自軍コマンドの必要パワーの数字を順番に見て、その数字と同じ必要パワーの
//  数字を持つ敵軍コマンドがあれば、すべて持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1226）
// アタックしたとき: core/applyAction.ts（アタック宣言後の「アタックしたとき」）。ストライクしたとき:
// events/listeners/strikeDeclaredListener.ts。DSL の on_strike（grant_keyword）からは二重に処理しない。

export function applyThunderboltSword(state: GameState, playerId: PlayerId, sourceCardId: string): GameState {
  if (sourceCardId !== "RS-529") return state;
  const numbers: number[] = [];
  for (const c of state.players[playerId].command) {
    if (!categoriesOf(state, c.cardId).includes("MA")) continue;
    const n = powerCostNumber(state, c.cardId);
    if (!numbers.includes(n)) numbers.push(n);
  }
  if (numbers.length === 0) return state;
  const enemyId = opponent(playerId);
  let next = state;
  let moved = 0;
  for (const n of numbers) {
    const targets = next.players[enemyId].command.filter((c) => powerCostNumber(next, c.cardId) === n);
    if (targets.length === 0) continue;
    const ids = new Set(targets.map((c) => c.instanceId));
    moved += targets.length;
    next = patchPlayer(next, enemyId, (p) => ({
      ...p,
      command: p.command.filter((c) => !ids.has(c.instanceId)),
      power: [...p.power, ...targets.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, faceDown: true }))],
      damage: p.damage + targets.length,
    }));
  }
  if (moved === 0) return state;
  return {
    ...next,
    log: [...next.log, buildLogEntry(playerId, "strike_effect", "RS-529", next.definitions, `rs529_thunderbolt_sword:${moved}`)],
  };
}

function drawToCommandOrHand(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  const top = player.deck[0];
  // 引くべきときに引けなければ敗北（公式FAQ RS-027 Q4。rules/pendingChoices.ts requestDrawFromDeck と同じ）。
  if (!top) return patchPlayer(state, playerId, (p) => ({ ...p, deckedOut: true }));
  const toCommand = player.command.length < COMMAND_ZONE_MAX;
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    deck: p.deck.slice(1),
    ...(toCommand
      ? { command: [...p.command, { instanceId: top.instanceId, cardId: top.cardId, commandHeld: false }] }
      : { hand: [...p.hand, { instanceId: top.instanceId, cardId: top.cardId }] }),
  }));
}

type Set8ACardEffectContext = {
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  sourceCardId: string;
  operationInstanceId?: string;
  triggerSourceInstanceId?: string;
};

// ---------------------------------------------------------------------------
// RS-526 スーパーハイウェイバスター
// 「自軍山札を見て、特徴「炎神」を持つMユニットのカードを1枚選び、自軍パワーゾーンに置いてもよい。そうしたとき、山札を
//  シャッフルした後で、置いたユニットカードのBP以下の敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る。」（atwiki/page-1142）
// DSL は grant_keyword `set8a::RS-526::super_highway_buster`。送るのはオモテ向き（「ダメージにして」ではない）。

export const SUPER_HIGHWAY_BUSTER_EFFECT_ID = "rs526_super_highway_buster";
export const SUPER_HIGHWAY_BUSTER_SEND_EFFECT_ID = "rs526_super_highway_buster_send";

function openSuperHighwayBuster(state: GameState, ctx: Set8ACardEffectContext): GameState {
  const ids = state.players[ctx.playerId].deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "M" && (def.features ?? []).includes("炎神");
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) {
    // 見たうえで選ばなかった扱い（山札は見ただけ。シャッフルは「そうしたとき」の後半なので行わない）。
    return state;
  }
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: SUPER_HIGHWAY_BUSTER_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

register(
  SUPER_HIGHWAY_BUSTER_EFFECT_ID,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const picked = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
    if (!picked) return { error: "invalid_target" };
    const placed = patchPlayer(state, playerId, (p) => ({
      ...p,
      deck: shuffleCards(p.deck.filter((c) => c.instanceId !== instanceId)),
      power: [...p.power, { instanceId: picked.instanceId, cardId: picked.cardId }],
    }));
    const maxBp = getDefinition(state.definitions, picked.cardId)?.bp ?? 0;
    const enemyId = opponent(playerId);
    const targets = [...placed.players[enemyId].battle, ...placed.players[enemyId].rush]
      .filter(
        (c) =>
          isUnitCard(placed, c.cardId) &&
          isSmallUnitNow(placed, enemyId, c) &&
          effectiveBp(placed, enemyId, c) <= maxBp &&
          selectableEnemy(placed, playerId, c, "RS-526"),
      )
      .map((c) => c.instanceId);
    const log = logFor(state, playerId, "RS-526", `${SUPER_HIGHWAY_BUSTER_EFFECT_ID}:${cardName(state.definitions, picked.cardId)}`);
    if (targets.length === 0) return { state: finish(placed, pending), log };
    return {
      state: reopen(placed, pending, {
        playerId,
        effectId: SUPER_HIGHWAY_BUSTER_SEND_EFFECT_ID,
        sourceCardId: "RS-526",
        sourceInstanceId: pending.sourceInstanceId,
        kind: "select_unit",
        phasePlayerId: pending.phasePlayerId,
        validInstanceIds: targets,
        unitDestination: "power",
        selectCount: 1,
        optional: false,
      }),
      log,
    };
  },
  simpleSkip("RS-526"),
);
// 後半（持ち主のパワーゾーンに送る）は汎用の unitDestination "power"（オモテ向き）で処理する。

// ---------------------------------------------------------------------------
// RS-523 臨気
// 「本来のSPが1以上のDAを持つ自軍ユニットを1体選ぶ。このターンのバトルフェイズ中、選んだユニットは次の能力を得る⇒
//  バトルエリアに出たとき、相手に1点ダメージを与える。ただし、ストライクすることはできない。」（atwiki/page-1150）
// 「本来の」は SP だけにかかる（grnrngr/faq-card-8 RS-523 Q）— DA は効果で追加されたカテゴリでもよい。サイズは問わない。
// 使っただけではダメージを与えない。能力はこのターンのバトルフェイズ中だけ（turn の規則として記録し、バトルフェイズで判定）。

export const RINKI_EFFECT_ID = "rs523_rinki";
export const RINKI_RULE = "rs523_rinki_granted";

function rinkiCandidates(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  const out: string[] = [];
  for (const zone of ["battle", "rush"] as const) {
    for (const c of p[zone]) {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || typeof def.sp !== "number" || def.sp < 1) continue;
      if (!unitEffectiveCategories(state, playerId, c, zone).includes("DA")) continue;
      out.push(c.instanceId);
    }
  }
  return out;
}

function openRinki(state: GameState, ctx: Set8ACardEffectContext): GameState {
  const ids = rinkiCandidates(state, ctx.playerId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: RINKI_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

register(RINKI_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const found = findCardInField(state, instanceId);
  if (!found || found.playerId !== playerId) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) =>
    addTurnRuleModifier(p, RINKI_RULE, { sourceCardId: "RS-523", payload: { instanceId } }),
  );
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-523", `${RINKI_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`) };
});

function rinkiGranted(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  if (state.phase !== "battle") return false;
  return getPlayerModifiers(state.players[playerId]).some(
    (m) =>
      m.kind === "rule" &&
      m.ruleId === RINKI_RULE &&
      m.scope === "turn" &&
      (m.payload as { instanceId?: string } | undefined)?.instanceId === instanceId,
  );
}

/** ストライクの制限（rules/combo.ts canStrikeUnit から呼ぶ）。RS-523 臨気で能力を得たユニット。 */
export function set8ABlocksStrike(state: GameState, playerId: PlayerId, instance: CardInstance): boolean {
  return rinkiGranted(state, playerId, instance.instanceId);
}

// ---------------------------------------------------------------------------
// RS-521 スーパー戦隊魂
// 「※常駐 ※タッグ 自軍バトルフェイズ中、特徴「レッド」を持つ自軍ユニットがバトルエリアに出たとき、『特徴｢レッド｣を持つ
//  自軍ユニットを1体選びホールドする』を実行してもよい。そうしたとき、バトルエリアに出たユニットのナンバーの数字を見て、
//  その数字以下のナンバーの数字を持つSユニットを自分の手札から1枚選び、自軍ラッシュエリアに出してもよい。」（atwiki/page-1154）
// ナンバーは並び順確定前（出たときのナンバー。atwiki/page-1154 Q1）。

export const SENTAI_SOUL_HOLD_EFFECT_ID = "rs521_sentai_soul_hold";
export const SENTAI_SOUL_DEPLOY_EFFECT_ID = "rs521_sentai_soul_deploy";


function openSentaiSoul(state: GameState, playerId: PlayerId, entered: CardInstance): GameState {
  const residents = state.players[playerId].operation.filter((c) => c.cardId === "RS-521");
  if (residents.length === 0) return state;
  if (!unitFeatures(state, playerId, entered).includes("レッド")) return state;
  const number = getDefinition(state.definitions, entered.cardId)?.comboNumber;
  let choice: PendingEffectChoice | undefined;
  for (const op of [...residents].reverse()) {
    // ※タッグ: 太字部分（レッドのユニットのホールド）のかわりに、他の自軍常駐の太字部分を実行できる（R-KW-TAG-01）。
    const entry = tagEntryChoice(state, playerId, op, {
      hostCardId: "RS-521",
      hostOpId: op.instanceId,
      // 出たユニットのナンバー（数字でなければ手札から出せるユニットはない）。並び順確定前の数字（atwiki/page-1154 Q1）。
      number: typeof number === "number" ? number : -1,
    });
    if (!entry) continue;
    choice = { ...entry, optional: true, ...(choice ? { resumeChoice: choice } : {}) };
  }
  return choice ? openEffectChoice(state, choice) : state;
}

/** 【スーパー戦隊魂】の太字部分を実行した後（そうしたとき）: 手札からナンバーが出たユニットの数字以下の S ユニットを出してもよい。 */
function afterSentaiBold(state: GameState, playerId: PlayerId, pending: PendingEffectChoice, log?: string): ChoiceOutcome {
  const limit = pending.tagMeta?.number ?? pending.maxPowerCost ?? -1;
  const ids = state.players[playerId].hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "S" && typeof def.comboNumber === "number" && def.comboNumber <= limit;
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state: finish(state, pending), log };
  return {
    state: reopen(state, pending, {
      playerId,
      effectId: SENTAI_SOUL_DEPLOY_EFFECT_ID,
      sourceCardId: "RS-521",
      sourceInstanceId: pending.tagMeta?.hostOpId ?? pending.sourceInstanceId,
      kind: "select_hand",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: ids,
      selectCount: 1,
      optional: true,
    }),
    log,
  };
}

register(
  SENTAI_SOUL_HOLD_EFFECT_ID,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const found = findCardInField(state, instanceId);
    if (!found || found.playerId !== playerId || found.card.commandHeld) return { error: "invalid_target" };
    const held = patchPlayer(state, playerId, (p) => ({
      ...p,
      [found.zone]: p[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
    }));
    const log = logFor(state, playerId, "RS-521", `${SENTAI_SOUL_HOLD_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`);
    return afterSentaiBold({ ...held, pendingEffectChoice: pending }, playerId, pending, log);
  },
  simpleSkip("RS-521"),
);

register(
  SENTAI_SOUL_DEPLOY_EFFECT_ID,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
    if (!card) return { error: "invalid_target" };
    const moved = patchPlayer(state, playerId, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== instanceId),
      rush: [...p.rush, { instanceId: card.instanceId, cardId: card.cardId }],
    }));
    const closed = finish(moved, pending);
    // 効果でラッシュエリアに出したユニットの「ラッシュしたとき」「ラッシュされたとき」（R-RUSH-22）。
    const rushed = finalizeEffectRush(closed, playerId, [instanceId], pending.phasePlayerId);
    return {
      state: rushed.logs.length > 0 ? { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] } : rushed.state,
      log: logFor(state, playerId, "RS-521", `${SENTAI_SOUL_DEPLOY_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`),
    };
  },
  simpleSkip("RS-521"),
);

// ---------------------------------------------------------------------------
// バトルエリアに出たとき（rules/combo.ts の進入処理から）

export function trySet8AOnEnterBattle(state: GameState, playerId: PlayerId, entered: CardInstance, ownBattlePhase: boolean): GameState {
  let next = state;
  // RS-523 臨気で得た能力「バトルエリアに出たとき、相手に1点ダメージを与える。」
  if (rinkiGranted(next, playerId, entered.instanceId)) {
    next = applyDamageToPlayer(next, opponent(playerId), 1, { kind: "none", activePlayer: next.activePlayer });
    next = { ...next, log: [...next.log, buildLogEntry(playerId, "enter_battle", "RS-523", next.definitions, "rs523_rinki_damage")] };
  }
  if (ownBattlePhase && !next.pendingEffectChoice && !next.pendingDamagePayment) {
    next = openSentaiSoul(next, playerId, entered);
  }
  return next;
}

/** DSL grant_keyword からの起点（RS-529 の on_strike は上の起点で処理済みなので何もしない）。 */
export function trySet8ACardEffect(
  state: GameState,
  ctx: Set8ACardEffectContext,
  keyword: string,
): { state: GameState; detail?: string } | null {
  // RS-520 スコープショット「自軍山札から1枚ひいて、そのカードを自軍コマンドゾーンに置く。置けなければ手札に加える。」
  // （atwiki/page-1148）— コマンドゾーンへはリリース状態（02-zones-cards「特に指定がなければリリース状態」）。
  if (keyword === "draw_deck_to_command_or_hand") {
    return { state: drawToCommandOrHand(state, ctx.playerId), detail: keyword };
  }
  if (keyword === "set8a::RS-523::rinki") {
    return { state: openRinki(state, ctx), detail: keyword };
  }
  if (keyword === "set8a::RS-526::super_highway_buster") {
    return { state: openSuperHighwayBuster(state, ctx), detail: keyword };
  }
  if (ctx.sourceCardId === "RS-529" && keyword.startsWith("enemy_power_damage_koregaatakumatahasutoraiku")) {
    return { state, detail: "rs529_thunderbolt_sword:handled_on_declare" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// RS-528 バイオハンター・シルバ（2nd）【バイオ粒子反応アリ！】
// 「これが自軍エリアにある間、OTを持つ敵軍ユニットがラッシュされたとき、これをリリースしてもよい。そうしたとき、相手は
//  ラッシュしたユニットを撃破するか、1点ダメージを受けるかを選ぶ。ダメージを受けることを選んだ場合、OTを持つ自軍ユニットが
//  あれば、自分も1点ダメージを受ける。」（atwiki/page-1232）
// 「ラッシュされたとき」の誘発（rules/onRushUnitEffects.ts applyPassiveRushTriggers から）。リリースできる（ホールド状態の）
// シルバごとに確認を開く。相手の選択は「ラッシュしたユニット（撃破）」か「1点ダメージ」。

export const BIO_PARTICLE_EFFECT_ID = "rs528_bio_particle";
export const BIO_PARTICLE_ANSWER_EFFECT_ID = "rs528_bio_particle_answer";
/** 相手の選択で「1点ダメージを受ける」を表す候補。 */
export const BIO_PARTICLE_TAKE_DAMAGE = "rs528_take_damage";

function appendResume(choice: PendingEffectChoice, next: PendingEffectChoice): PendingEffectChoice {
  return choice.resumeChoice ? { ...choice, resumeChoice: appendResume(choice.resumeChoice, next) } : { ...choice, resumeChoice: next };
}

export function openBioParticleOnEnemyRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const ownerId = opponent(rusherPlayerId);
  const rushed = state.players[rusherPlayerId].rush.find((c) => c.instanceId === rushedInstanceId);
  if (!rushed || !categoriesOf(state, rushed.cardId).includes("OT")) return state;
  const owner = state.players[ownerId];
  const silvas = [...owner.battle, ...owner.rush].filter((c) => c.cardId === "RS-528" && c.commandHeld);
  if (silvas.length === 0) return state;
  let choice: PendingEffectChoice | undefined;
  for (const silva of [...silvas].reverse()) {
    choice = {
      playerId: ownerId,
      effectId: BIO_PARTICLE_EFFECT_ID,
      sourceCardId: "RS-528",
      sourceInstanceId: silva.instanceId,
      kind: "confirm",
      phasePlayerId,
      validInstanceIds: [silva.instanceId],
      selectedInstanceIds: [rushedInstanceId],
      optional: true,
      ...(choice ? { resumeChoice: choice } : {}),
    };
  }
  if (state.pendingEffectChoice) {
    return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice!) };
  }
  return { ...state, pendingEffectChoice: choice, activePlayer: ownerId };
}

register(
  BIO_PARTICLE_EFFECT_ID,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const silva = findCardInField(state, instanceId);
    if (!silva || silva.playerId !== playerId || !silva.card.commandHeld) return { error: "invalid_target" };
    const released = patchPlayer(state, playerId, (p) => ({
      ...p,
      [silva.zone]: p[silva.zone].map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: false } : c)),
    }));
    const rusherId = opponent(playerId);
    const rushedId = pending.selectedInstanceIds?.[0];
    const rushedOnField = rushedId ? findCardInField(released, rushedId) : null;
    const options = [
      ...(rushedOnField && rushedOnField.playerId === rusherId ? [rushedId!] : []),
      BIO_PARTICLE_TAKE_DAMAGE,
    ];
    return {
      state: reopen(released, pending, {
        playerId: rusherId,
        effectId: BIO_PARTICLE_ANSWER_EFFECT_ID,
        sourceCardId: "RS-528",
        sourceInstanceId: instanceId,
        // 「ラッシュしたユニット（撃破）」か「1点ダメージ」の二択（apps/web confirmOptionLabel で表示）。
        kind: "confirm",
        phasePlayerId: pending.phasePlayerId,
        validInstanceIds: options,
        selectCount: 1,
        optional: false,
      }),
      log: logFor(state, playerId, "RS-528", `${BIO_PARTICLE_EFFECT_ID}:release`),
    };
  },
  simpleSkip("RS-528"),
);

register(BIO_PARTICLE_ANSWER_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const silvaOwnerId = opponent(playerId);
  const cleared: GameState = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  if (instanceId !== BIO_PARTICLE_TAKE_DAMAGE) {
    const destroyed = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
    if ("error" in destroyed) return destroyed;
    return {
      state: finish({ ...destroyed.state, pendingEffectChoice: destroyed.state.pendingEffectChoice }, pending),
      log: logFor(state, playerId, "RS-528", `${BIO_PARTICLE_ANSWER_EFFECT_ID}:destroy`),
    };
  }
  // 相手が1点。OT を持つ自軍ユニット（シルバの持ち主側）があれば、シルバの持ち主も1点。
  const resume = { kind: "none" as const, activePlayer: pending.phasePlayerId };
  let next = applyDamageToPlayer(cleared, playerId, 1, resume);
  const silvaOwner = next.players[silvaOwnerId];
  if ([...silvaOwner.battle, ...silvaOwner.rush].some((c) => categoriesOf(next, c.cardId).includes("OT"))) {
    next = applyDamageToPlayer(next, silvaOwnerId, 1, resume);
  }
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-528", `${BIO_PARTICLE_ANSWER_EFFECT_ID}:damage`) };
});

// ---------------------------------------------------------------------------
// 常駐の太字部分の起動（activate_resident_operation。rules/permanentOperation.ts・core/legalActions.ts から）
// - RS-519 インフェルシアの花嫁（自軍ラッシュフェイズ中に1度だけ。atwiki/page-1155）
// - RS-522 ボウケンスピリッツ（自軍ラッシュフェイズ中に1度だけ。atwiki/page-1152）
// - RS-524 呉越同舟（自軍バトルフェイズ中に1度だけ。atwiki/page-1151）
// - RS-525 頼もしい相棒（自軍ラッシュフェイズ中に1度だけ。atwiki/page-1153）
// 「実行してもよい」は起動するかどうかの選択（起動しなければ何も起きない）。「1度だけ」はターンの記録で数える。
// 同名のタッグを2枚常駐させても、太字部分の効果は1度だけ（grnrngr/faq-rider_3 RK-240「１度のラッシュフェイズの間に太字部分の
// 効果は１度だけしか発動することはできません」）なので、同名の常駐のどれかを使えば使用済み。
//
// ※タッグ（R-KW-TAG-01）「太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる」:
// 太字部分（『』の中）を実行する時点で、他の自軍のタッグの常駐の太字部分のうち実行できるものがあれば、どれを実行するかを選ぶ
// （tagEntryChoice・TAG_PICK_EFFECT_ID）。入れ替えは2枚ともタッグを持つときだけ（atwiki/page-1297）。他の常駐の太字部分を実行したら、
// 使っている常駐の「そうしたとき」以降を実行する（tagResidents()[...].after）。他の常駐を「使った」ことにはならない。

const SET8A_RESIDENT_PHASE: Record<string, "rush" | "battle"> = {
  "RS-519": "rush",
  "RS-522": "rush",
  "RS-524": "battle",
  "RS-525": "rush",
  // ライダーのタッグの常駐（自軍ラッシュフェイズごとに1度だけ）。太字部分と「そうしたとき」は rules/rk/rk12UnitEffects.ts の registerTagResident。
  "RK-242": "rush",
  "RK-244": "rush",
  "RK-248": "rush",
};
const RESIDENT_USED_RULE = "set8a_resident_bold_used";

export function isSet8AResident(cardId: string): boolean {
  return cardId in SET8A_RESIDENT_PHASE;
}

/** このターン、この常駐（または同名の常駐）の太字部分の効果を使ったか。 */
function residentUsedThisTurn(state: GameState, playerId: PlayerId, op: CardInstance): boolean {
  return getPlayerModifiers(state.players[playerId]).some(
    (m) =>
      m.kind === "rule" &&
      m.ruleId === RESIDENT_USED_RULE &&
      m.scope === "turn" &&
      ((m.payload as { instanceId?: string } | undefined)?.instanceId === op.instanceId ||
        (!!m.sourceCardId && sameCardName(cardName(state.definitions, m.sourceCardId), cardName(state.definitions, op.cardId)))),
  );
}

function ownSmallWithFeature(state: GameState, playerId: PlayerId, feature: string, exclude?: string): string[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush]
    .filter(
      (c) =>
        c.instanceId !== exclude &&
        isUnitCard(state, c.cardId) &&
        isSmallUnitNow(state, playerId, c) &&
        unitFeatures(state, playerId, c).includes(feature),
    )
    .map((c) => c.instanceId);
}

function malesWithFemalePartner(state: GameState, playerId: PlayerId): string[] {
  return ownSmallWithFeature(state, playerId, "男").filter((m) => ownSmallWithFeature(state, playerId, "女", m).length > 0);
}

function fusionLCardsInHand(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "L" && requiresFusion(state, c.cardId);
    })
    .map((c) => c.instanceId);
}

function faceUpPower(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
}

function redHoldCandidates(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush]
    .filter((c) => !c.commandHeld && isUnitCard(state, c.cardId) && unitFeatures(state, playerId, c).includes("レッド"))
    .map((c) => c.instanceId);
}

function releasedWbCommands(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return player.command
    .filter((c) => !c.commandHeld && effectiveCommandCategories(player, state.definitions, c.cardId).includes("WB"))
    .map((c) => c.instanceId);
}

function rushAreaSmallUnits(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].rush.filter((c) => isSmallUnitNow(state, playerId, c)).map((c) => c.instanceId);
}

// --- タッグの常駐の登録 -------------------------------------------------------------------

/** タッグの常駐ごとの太字部分（『』の中）と、そうしたとき以降。 */
export type TagResident = {
  /** 太字部分を実行できるか。 */
  boldAvailable: (state: GameState, playerId: PlayerId) => boolean;
  /** 自分の太字部分の選択を開く（frame は使っている常駐の選択の枠。frame の resumeChoice を引き継ぐ）。 */
  ownBold: (state: GameState, playerId: PlayerId, frame: PendingEffectChoice) => GameState;
  /** 太字部分を実行した後（「そうしたとき」以降）。state の pendingEffectChoice は frame。 */
  after: (state: GameState, playerId: PlayerId, frame: PendingEffectChoice) => ChoiceOutcome;
};

/**
 * 登録先（関数の宣言は初期化前でも使えるので、循環 import で他のモジュールが先に評価されても登録できる）。
 */
function tagResidents(): Record<string, TagResident> {
  const holder = tagResidents as unknown as { store?: Record<string, TagResident> };
  return (holder.store ??= {});
}

/** タッグの常駐を登録する（第9弾 RS-608・RS-609 は rules/legend1/set9NamedEffectsA.ts から）。 */
export function registerTagResident(cardId: string, resident: TagResident): void {
  tagResidents()[cardId] = resident;
}

export const TAG_PICK_EFFECT_ID = "tag_bold_pick";
const TAG_BOLD_RS519_MALE = "tag_bold_rs519_male";
const TAG_BOLD_RS519_FEMALE = "tag_bold_rs519_female";
const TAG_BOLD_RS521 = "tag_bold_rs521";
const TAG_BOLD_RS522 = "tag_bold_rs522";
const TAG_BOLD_RS524 = "tag_bold_rs524";
const TAG_BOLD_RS525 = "tag_bold_rs525";
const TAG_BOLD_RS608 = "tag_bold_rs608";
const TAG_BOLD_RS609 = "tag_bold_rs609";
const TAG_BOLD_RS609_DEST = "tag_bold_rs609_destination";
const TAG_BOLD_RK170 = "tag_bold_rk170";
const TAG_BOLD_RK239 = "tag_bold_rk239";
const TAG_BOLD_RK242 = "tag_bold_rk242";
const TAG_BOLD_RK244 = "tag_bold_rk244";
const TAG_BOLD_RK248 = "tag_bold_rk248";

/**
 * 太字部分だけを貸すタッグの常駐（ライダー。その常駐自身の効果はこのモジュールでは扱わない）。
 * - RK-170 プロジェクトG4『MAを持つ自軍コマンドを1つホールドする』
 * - RK-239 ウエイクアップ！『自軍Sユニットを1体選びホールドする』
 * - RK-242 クライマックス刑事『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』
 * - RK-244 ミッシングエース『自分の手札から1枚選び捨札にする』
 * - RK-248 パラダイス・ロスト『敵軍捨札から1枚選び、持ち主の手札に加える』
 * （RK-253 親子の絆『相手は1枚ドローしてから…』は相手が選ぶ太字部分で、まだ貸せない。）
 */
const LENDING_BOLDS: Record<string, { effectId: string; kind: PendingEffectChoice["kind"]; candidates: (state: GameState, playerId: PlayerId) => string[] }> = {
  "RK-170": {
    effectId: TAG_BOLD_RK170,
    kind: "select_command",
    candidates: (state, playerId) => {
      const player = state.players[playerId];
      return player.command
        .filter((c) => !c.commandHeld && effectiveCommandCategories(player, state.definitions, c.cardId).includes("MA"))
        .map((c) => c.instanceId);
    },
  },
  "RK-239": {
    effectId: TAG_BOLD_RK239,
    kind: "select_unit",
    candidates: (state, playerId) =>
      [...state.players[playerId].battle, ...state.players[playerId].rush]
        .filter((c) => !c.commandHeld && isUnitCard(state, c.cardId) && isSmallUnitNow(state, playerId, c))
        .map((c) => c.instanceId),
  },
  "RK-242": { effectId: TAG_BOLD_RK242, kind: "select_power", candidates: (state, playerId) => faceUpPower(state, playerId) },
  "RK-244": { effectId: TAG_BOLD_RK244, kind: "select_hand", candidates: (state, playerId) => state.players[playerId].hand.map((c) => c.instanceId) },
  "RK-248": {
    effectId: TAG_BOLD_RK248,
    kind: "select_unit",
    candidates: (state, playerId) => state.players[opponent(playerId)].discard.map((c) => c.instanceId),
  },
};

/** 太字部分を入れ替えられる他の自軍のタッグの常駐（太字部分を実行できるもの）。 */
function tagSwapOptions(state: GameState, playerId: PlayerId, hostOpId: string): string[] {
  return state.players[playerId].operation
    .filter(
      (op) =>
        op.instanceId !== hostOpId &&
        (tagResidents()[op.cardId]?.boldAvailable(state, playerId) || (LENDING_BOLDS[op.cardId]?.candidates(state, playerId).length ?? 0) > 0),
    )
    .map((op) => op.instanceId);
}

/** 常駐 op の太字部分（自分の、または入れ替えた他の常駐の）を実行できるか。 */
export function tagBoldExecutable(state: GameState, playerId: PlayerId, op: CardInstance): boolean {
  const own = tagResidents()[op.cardId];
  if (!own) return false;
  return own.boldAvailable(state, playerId) || tagSwapOptions(state, playerId, op.instanceId).length > 0;
}

function frameFor(state: GameState, playerId: PlayerId, op: CardInstance, meta: TagChoiceMeta): PendingEffectChoice {
  return {
    playerId,
    effectId: TAG_PICK_EFFECT_ID,
    sourceCardId: op.cardId,
    sourceInstanceId: op.instanceId,
    phasePlayerId: playerId,
    kind: "confirm",
    validInstanceIds: [],
    selectCount: 1,
    optional: false,
    tagMeta: meta,
  };
}

/**
 * 太字部分を実行するときの最初の選択（開かずに返す）。入れ替えられる他の常駐があれば、どの常駐の太字部分を実行するかを選ぶ。
 * なければ自分の太字部分の選択。どちらも実行できなければ undefined。
 */
export function tagEntryChoice(state: GameState, playerId: PlayerId, op: CardInstance, meta: TagChoiceMeta): PendingEffectChoice | undefined {
  const own = tagResidents()[op.cardId];
  if (!own) return undefined;
  const ownOk = own.boldAvailable(state, playerId);
  const others = tagSwapOptions(state, playerId, op.instanceId);
  const frame = frameFor(state, playerId, op, meta);
  if (others.length === 0) {
    if (!ownOk) return undefined;
    // 自分の太字部分の選択（開いた状態から取り出す）。
    return own.ownBold({ ...state, pendingEffectChoice: undefined }, playerId, frame).pendingEffectChoice;
  }
  return { ...frame, validInstanceIds: [...(ownOk ? [op.instanceId] : []), ...others] };
}

/** 太字部分の実行を始める（選択を開く）。 */
export function beginTagBold(state: GameState, playerId: PlayerId, op: CardInstance, meta: TagChoiceMeta, resume?: PendingEffectChoice): GameState {
  const entry = tagEntryChoice(state, playerId, op, meta);
  if (!entry) return state;
  return openEffectChoice({ ...state, pendingEffectChoice: undefined }, { ...entry, resumeChoice: resume });
}

/** 他の常駐の太字部分の実行を終えた: 使っている常駐の「そうしたとき」以降へ。 */
function afterForeignBold(state: GameState, playerId: PlayerId, pending: PendingEffectChoice, log?: string): ChoiceOutcome {
  const meta = pending.tagMeta!;
  const frame: PendingEffectChoice = {
    ...pending,
    effectId: TAG_PICK_EFFECT_ID,
    sourceCardId: meta.hostCardId,
    sourceInstanceId: meta.hostOpId,
    kind: "confirm",
    validInstanceIds: [],
    selectedInstanceIds: [],
    tagMeta: { ...meta, picked: undefined },
  };
  const outcome = tagResidents()[meta.hostCardId]!.after({ ...state, pendingEffectChoice: frame }, playerId, frame);
  if ("error" in outcome) return outcome;
  return { state: outcome.state, log: [log, outcome.log].filter(Boolean).join("\n") || undefined };
}

function foreignLog(state: GameState, playerId: PlayerId, pending: PendingEffectChoice, detail: string): string {
  return logFor(state, playerId, pending.tagMeta?.boldCardId ?? pending.sourceCardId, `tag_bold:${detail}`);
}

register(
  TAG_PICK_EFFECT_ID,
  (state, playerId, opId) => {
    const pending = state.pendingEffectChoice!;
    const meta = pending.tagMeta!;
    const op = state.players[playerId].operation.find((c) => c.instanceId === opId);
    if (!op) return { error: "invalid_target" };
    const log = logFor(state, playerId, meta.hostCardId, `${TAG_PICK_EFFECT_ID}:${cardName(state.definitions, op.cardId)}`);
    if (opId === meta.hostOpId) {
      return { state: tagResidents()[meta.hostCardId]!.ownBold(state, playerId, pending), log };
    }
    const next: PendingEffectChoice = { ...pending, sourceCardId: op.cardId, sourceInstanceId: op.instanceId, tagMeta: { ...meta, boldCardId: op.cardId, boldOpId: op.instanceId } };
    const base = { ...next, selectCount: 1, optional: false, selectedInstanceIds: [] as string[] };
    switch (op.cardId) {
      case "RS-519":
        return { state: reopen(state, pending, { ...base, effectId: TAG_BOLD_RS519_MALE, kind: "select_unit", validInstanceIds: malesWithFemalePartner(state, playerId) }), log };
      case "RS-521":
        return { state: reopen(state, pending, { ...base, effectId: TAG_BOLD_RS521, kind: "select_unit", validInstanceIds: redHoldCandidates(state, playerId) }), log };
      case "RS-522":
        return { state: reopen(state, pending, { ...base, effectId: TAG_BOLD_RS522, kind: "select_command", validInstanceIds: state.players[playerId].command.map((c) => c.instanceId) }), log };
      case "RS-524":
        return { state: reopen(state, pending, { ...base, effectId: TAG_BOLD_RS524, kind: "select_hand", validInstanceIds: state.players[playerId].hand.map((c) => c.instanceId) }), log };
      case "RS-525":
        return { state: reopen(state, pending, { ...base, effectId: TAG_BOLD_RS525, kind: "select_power", selectCount: 2, validInstanceIds: faceUpPower(state, playerId) }), log };
      case "RS-608":
        return { state: reopen(state, pending, { ...base, effectId: TAG_BOLD_RS608, kind: "select_command", validInstanceIds: releasedWbCommands(state, playerId) }), log };
      case "RS-609":
        return { state: reopen(state, pending, { ...base, effectId: TAG_BOLD_RS609, kind: "select_unit", validInstanceIds: rushAreaSmallUnits(state, playerId) }), log };
      default: {
        const lending = LENDING_BOLDS[op.cardId];
        if (!lending) return { error: "invalid_target" };
        return { state: reopen(state, pending, { ...base, effectId: lending.effectId, kind: lending.kind, validInstanceIds: lending.candidates(state, playerId) }), log };
      }
    }
  },
  (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return { state: finish(state, pending), log: skipLog(state, playerId, pending.tagMeta?.hostCardId ?? pending.sourceCardId, pending.effectId) };
  },
);

// 他の常駐の太字部分（入れ替えて実行する）。
register(TAG_BOLD_RS519_MALE, (state, playerId, maleId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: reopen(state, pending, {
      ...pending,
      effectId: TAG_BOLD_RS519_FEMALE,
      validInstanceIds: ownSmallWithFeature(state, playerId, "女", maleId),
      tagMeta: { ...pending.tagMeta!, picked: [maleId] },
    }),
  };
});
register(TAG_BOLD_RS519_FEMALE, (state, playerId, femaleId) => {
  const pending = state.pendingEffectChoice!;
  const male = pending.tagMeta?.picked?.[0];
  if (!male) return { error: "invalid_target" };
  const next = discardFieldUnit(discardFieldUnit(state, male), femaleId);
  return afterForeignBold(next, playerId, pending, foreignLog(state, playerId, pending, "discard_male_female"));
});
register(TAG_BOLD_RS521, (state, playerId, unitId) => {
  const pending = state.pendingEffectChoice!;
  const found = findCardInField(state, unitId);
  if (!found || found.playerId !== playerId || found.card.commandHeld) return { error: "invalid_target" };
  const held = patchPlayer(state, playerId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].map((c) => (c.instanceId === unitId ? { ...c, commandHeld: true } : c)),
  }));
  return afterForeignBold(held, playerId, pending, foreignLog(state, playerId, pending, `hold:${cardName(state.definitions, found.card.cardId)}`));
});
register(TAG_BOLD_RS522, (state, playerId, cmdId) => {
  const pending = state.pendingEffectChoice!;
  const cmd = state.players[playerId].command.find((c) => c.instanceId === cmdId);
  if (!cmd) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== cmdId),
    deck: [{ instanceId: cmd.instanceId, cardId: cmd.cardId }, ...p.deck],
  }));
  return afterForeignBold(next, playerId, pending, foreignLog(state, playerId, pending, `command_to_deck:${cardName(state.definitions, cmd.cardId)}`));
});
register(TAG_BOLD_RS524, (state, playerId, handId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === handId);
  if (!card) return { error: "invalid_target" };
  // 見せたカードは公開情報としてログに残す。
  return afterForeignBold(state, playerId, pending, foreignLog(state, playerId, pending, `reveal:${cardName(state.definitions, card.cardId)}`));
});
register(TAG_BOLD_RS525, (state, playerId, powerId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), powerId];
  if (selected.length < 2) {
    return {
      state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== powerId) } },
    };
  }
  const ids = new Set(selected);
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => !ids.has(c.instanceId)),
    discard: [...p.discard, ...p.power.filter((c) => ids.has(c.instanceId)).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
  }));
  return afterForeignBold(next, playerId, pending, foreignLog(state, playerId, pending, "discard_power"));
});
register(TAG_BOLD_RS608, (state, playerId, cmdId) => {
  const pending = state.pendingEffectChoice!;
  if (!releasedWbCommands(state, playerId).includes(cmdId)) return { error: "invalid_target" };
  const held = patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === cmdId ? { ...c, commandHeld: true } : c)),
  }));
  return afterForeignBold(held, playerId, pending, foreignLog(state, playerId, pending, "hold_wb"));
});
register(TAG_BOLD_RS609, (state, playerId, unitId) => {
  const pending = state.pendingEffectChoice!;
  if (state.players[playerId].command.length >= COMMAND_ZONE_MAX) {
    return afterForeignBold(moveRushUnitAway(state, playerId, unitId, "discard"), playerId, pending, foreignLog(state, playerId, pending, "discard"));
  }
  return {
    state: reopen(state, pending, {
      ...pending,
      effectId: TAG_BOLD_RS609_DEST,
      kind: "confirm",
      validInstanceIds: ["command", "discard"],
      tagMeta: { ...pending.tagMeta!, picked: [unitId] },
    }),
  };
});
register(TAG_BOLD_RS609_DEST, (state, playerId, dest) => {
  const pending = state.pendingEffectChoice!;
  const unitId = pending.tagMeta?.picked?.[0];
  if (!unitId || (dest !== "command" && dest !== "discard")) return { error: "invalid_target" };
  return afterForeignBold(moveRushUnitAway(state, playerId, unitId, dest), playerId, pending, foreignLog(state, playerId, pending, dest));
});

register(TAG_BOLD_RK170, (state, playerId, cmdId) => {
  const pending = state.pendingEffectChoice!;
  const held = patchPlayer(state, playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === cmdId ? { ...c, commandHeld: true } : c)) }));
  return afterForeignBold(held, playerId, pending, foreignLog(state, playerId, pending, "hold_ma"));
});
register(TAG_BOLD_RK239, (state, playerId, unitId) => {
  const pending = state.pendingEffectChoice!;
  const found = findCardInField(state, unitId);
  if (!found || found.playerId !== playerId || found.card.commandHeld) return { error: "invalid_target" };
  const held = patchPlayer(state, playerId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].map((c) => (c.instanceId === unitId ? { ...c, commandHeld: true } : c)),
  }));
  return afterForeignBold(held, playerId, pending, foreignLog(state, playerId, pending, `hold:${cardName(state.definitions, found.card.cardId)}`));
});
register(TAG_BOLD_RK242, (state, playerId, powerId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === powerId && !c.faceDown);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => c.instanceId !== powerId),
    deck: [{ instanceId: card.instanceId, cardId: card.cardId }, ...p.deck],
  }));
  return afterForeignBold(next, playerId, pending, foreignLog(state, playerId, pending, "power_to_deck"));
});
register(TAG_BOLD_RK244, (state, playerId, handId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === handId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== handId), discard: [...p.discard, card] }));
  return afterForeignBold(next, playerId, pending, foreignLog(state, playerId, pending, `discard_hand:${cardName(state.definitions, card.cardId)}`));
});
register(TAG_BOLD_RK248, (state, playerId, cardId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].discard.find((c) => c.instanceId === cardId);
  if (!card) return { error: "invalid_target" };
  const next = patchPlayer(state, enemyId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== cardId), hand: [...p.hand, card] }));
  return afterForeignBold(next, playerId, pending, foreignLog(state, playerId, pending, `enemy_discard_to_hand:${cardName(state.definitions, card.cardId)}`));
});

/** 自軍ラッシュエリアのユニットをコマンドゾーンに送るか捨札にする（RS-609 の太字部分）。重ねたカードは捨札。 */
function moveRushUnitAway(state: GameState, playerId: PlayerId, instanceId: string, dest: "command" | "discard"): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.rush.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const stacked = (card.stackedCards ?? []).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }));
    const strip = { instanceId: card.instanceId, cardId: card.cardId };
    const toCommand = dest === "command" && p.command.length < COMMAND_ZONE_MAX;
    return {
      ...p,
      rush: p.rush.filter((c) => c.instanceId !== instanceId),
      command: toCommand ? [...p.command, strip] : p.command,
      discard: toCommand ? [...p.discard, ...stacked] : [...p.discard, strip, ...stacked],
    };
  });
}

// --- 第8弾のタッグの常駐 -------------------------------------------------------------------

registerTagResident("RS-519", {
  boldAvailable: (state, playerId) => malesWithFemalePartner(state, playerId).length > 0,
  ownBold: (state, playerId, frame) =>
    reopen(state, frame, { ...frame, effectId: BRIDE_MALE_EFFECT_ID, kind: "select_unit", validInstanceIds: malesWithFemalePartner(state, playerId) }),
  after: (state, playerId, frame) => afterBrideBold(state, playerId, frame),
});
registerTagResident("RS-521", {
  boldAvailable: (state, playerId) => redHoldCandidates(state, playerId).length > 0,
  ownBold: (state, playerId, frame) =>
    reopen(state, frame, {
      ...frame,
      effectId: SENTAI_SOUL_HOLD_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: redHoldCandidates(state, playerId),
      optional: true,
      maxPowerCost: frame.tagMeta?.number ?? -1,
    }),
  after: (state, playerId, frame) => afterSentaiBold(state, playerId, frame),
});
registerTagResident("RS-522", {
  boldAvailable: (state, playerId) => state.players[playerId].command.length > 0,
  ownBold: (state, playerId, frame) =>
    reopen(state, frame, { ...frame, effectId: BOUKEN_COMMAND_EFFECT_ID, kind: "select_command", validInstanceIds: state.players[playerId].command.map((c) => c.instanceId) }),
  after: (state, playerId, frame) => afterBoukenBold(state, playerId, frame),
});
registerTagResident("RS-524", {
  boldAvailable: (state, playerId) => state.players[playerId].hand.length > 0,
  ownBold: (state, playerId, frame) =>
    reopen(state, frame, { ...frame, effectId: GOETSU_HAND_EFFECT_ID, kind: "select_hand", validInstanceIds: state.players[playerId].hand.map((c) => c.instanceId) }),
  after: (state, playerId, frame) => afterGoetsuBold(state, playerId, frame),
});
registerTagResident("RS-525", {
  boldAvailable: (state, playerId) => faceUpPower(state, playerId).length >= 2,
  ownBold: (state, playerId, frame) =>
    reopen(state, frame, {
      ...frame,
      effectId: PARTNER_POWER_EFFECT_ID,
      kind: "select_power",
      validInstanceIds: faceUpPower(state, playerId),
      selectCount: 2,
      // 先に見せた L ユニットのカード（その合体に必要な M ユニットを探す）。
      viewedInstanceIds: frame.tagMeta?.revealedLId ? [frame.tagMeta.revealedLId] : frame.viewedInstanceIds,
      selectedInstanceIds: [],
    }),
  after: (state, playerId, frame) => afterPartnerBold(state, playerId, frame),
});

/**
 * このモジュールの常駐なら起動できるか（それ以外は null）。
 */
export function canActivateSet8AResident(state: GameState, playerId: PlayerId, operationInstanceId: string): boolean | null {
  const op = state.players[playerId].operation.find((c) => c.instanceId === operationInstanceId);
  if (!op || !isSet8AResident(op.cardId)) return null;
  if (state.phase !== SET8A_RESIDENT_PHASE[op.cardId] || state.activePlayer !== playerId) return false;
  if (state.pendingEffectChoice || state.pendingCommandPayment || state.pendingZordSetup || state.pendingBattle || state.pendingStrike) {
    return false;
  }
  if (residentUsedThisTurn(state, playerId, op)) return false;
  // RS-525: 太字部分の前の「手札から合体を必要とするLユニットのカードを1枚選び、相手に見せて」は入れ替えられない。
  if (op.cardId === "RS-525" && fusionLCardsInHand(state, playerId).length === 0) return false;
  return tagBoldExecutable(state, playerId, op);
}

export function activateSet8AResident(state: GameState, playerId: PlayerId, operationInstanceId: string): GameState {
  const op = state.players[playerId].operation.find((c) => c.instanceId === operationInstanceId)!;
  const used = patchPlayer(state, playerId, (p) =>
    addTurnRuleModifier(p, RESIDENT_USED_RULE, { sourceCardId: op.cardId, payload: { instanceId: op.instanceId } }),
  );
  if (op.cardId === "RS-525") {
    return openEffectChoice(used, {
      playerId,
      sourceCardId: op.cardId,
      sourceInstanceId: op.instanceId,
      phasePlayerId: playerId,
      selectCount: 1,
      optional: false,
      effectId: PARTNER_L_EFFECT_ID,
      kind: "select_hand",
      validInstanceIds: fusionLCardsInHand(used, playerId),
    });
  }
  return beginTagBold(used, playerId, op, { hostCardId: op.cardId, hostOpId: op.instanceId });
}

/** 場のユニットを（撃破ではなく）コストとして捨札にする。 */
function discardFieldUnit(state: GameState, instanceId: string): GameState {
  const found = findCardInField(state, instanceId);
  if (!found) return state;
  return patchPlayer(state, found.playerId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, { instanceId: found.card.instanceId, cardId: found.card.cardId }],
  }));
}

// RS-519 インフェルシアの花嫁
// 「『特徴「男」を持つ自軍Sユニットと特徴「女」を持つ自軍Sユニットをそれぞれ1体ずつ選び捨札にする』を実行してもよい。
//  そうしたとき、自軍山札を見て、特徴「戦闘員」を持つユニットカードを3枚まで選び、自軍ラッシュエリアに出す。その後、山札をシャッフルする。」

export const BRIDE_MALE_EFFECT_ID = "rs519_bride_male";
export const BRIDE_FEMALE_EFFECT_ID = "rs519_bride_female";
export const BRIDE_GRUNTS_EFFECT_ID = "rs519_bride_grunts";

register(BRIDE_MALE_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: reopen(state, pending, {
      ...pending,
      effectId: BRIDE_FEMALE_EFFECT_ID,
      validInstanceIds: ownSmallWithFeature(state, playerId, "女", instanceId),
      selectedInstanceIds: [instanceId],
    }),
    log: logFor(state, playerId, "RS-519", `${BRIDE_MALE_EFFECT_ID}:${cardName(state.definitions, findCardInField(state, instanceId)?.card.cardId ?? instanceId)}`),
  };
});

register(BRIDE_FEMALE_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const male = pending.selectedInstanceIds?.[0];
  if (!male) return { error: "invalid_target" };
  const next = discardFieldUnit(discardFieldUnit(state, male), instanceId);
  const outcome = afterBrideBold(next, playerId, pending);
  if ("error" in outcome) return outcome;
  return { state: outcome.state, log: logFor(state, playerId, "RS-519", `${BRIDE_FEMALE_EFFECT_ID}:discarded`) };
});

/** 【インフェルシアの花嫁】そうしたとき: 山札から「戦闘員」のユニットカードを3枚まで選び、自軍ラッシュエリアに出す。 */
function afterBrideBold(state: GameState, playerId: PlayerId, pending: PendingEffectChoice): ChoiceOutcome {
  const grunts = state.players[playerId].deck
    .filter((c) => isUnitCard(state, c.cardId) && (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("戦闘員"))
    .map((c) => c.instanceId);
  if (grunts.length === 0) {
    const shuffled = patchPlayer(state, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
    return { state: finish(shuffled, pending) };
  }
  return {
    state: reopen(state, pending, {
      ...pending,
      effectId: BRIDE_GRUNTS_EFFECT_ID,
      sourceCardId: "RS-519",
      kind: "select_unit",
      validInstanceIds: grunts,
      selectedInstanceIds: [],
      selectCount: 3,
      // 「3枚まで」— 0〜3枚（見送り・確定で少なくてもよい）。
      optional: true,
    }),
  };
}

function finishBrideGrunts(state: GameState, playerId: PlayerId, selected: string[]): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const ids = new Set(selected);
  const picked = state.players[playerId].deck.filter((c) => ids.has(c.instanceId));
  const moved = patchPlayer(state, playerId, (p) => ({
    ...p,
    deck: shuffleCards(p.deck.filter((c) => !ids.has(c.instanceId))),
    rush: [...p.rush, ...picked.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
  }));
  const closed = finish(moved, pending);
  const rushed = picked.length > 0 ? finalizeEffectRush(closed, playerId, picked.map((c) => c.instanceId), pending.phasePlayerId) : { state: closed, logs: [] };
  return {
    state: rushed.logs.length > 0 ? { ...rushed.state, log: [...rushed.state.log, ...rushed.logs] } : rushed.state,
    log: logFor(state, playerId, "RS-519", `${BRIDE_GRUNTS_EFFECT_ID}:${picked.length}`),
  };
}

register(
  BRIDE_GRUNTS_EFFECT_ID,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
    if (selected.length < (pending.selectCount ?? 3) && remaining.length > 0) {
      return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining } } };
    }
    return finishBrideGrunts(state, playerId, selected);
  },
  (state, playerId) => finishBrideGrunts(state, playerId, state.pendingEffectChoice?.selectedInstanceIds ?? []),
);
CHOICE_CONFIRMERS[BRIDE_GRUNTS_EFFECT_ID] = (state, playerId) =>
  finishBrideGrunts(state, playerId, state.pendingEffectChoice?.selectedInstanceIds ?? []);

// RS-522 ボウケンスピリッツ
// 「『自軍コマンドを1つ選び山札の上に戻す』を実行してもよい。そうしたとき、ナンバーに数字を持つ自軍Sユニットを1体選ぶ。
//  このターン、選んだユニットのナンバーの数字は1増える。」

export const BOUKEN_COMMAND_EFFECT_ID = "rs522_bouken_command";
export const BOUKEN_UNIT_EFFECT_ID = "rs522_bouken_unit";

register(BOUKEN_COMMAND_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cmd = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  if (!cmd) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== instanceId),
    deck: [{ instanceId: cmd.instanceId, cardId: cmd.cardId }, ...p.deck],
  }));
  const outcome = afterBoukenBold(next, playerId, pending);
  if ("error" in outcome) return outcome;
  return { state: outcome.state, log: logFor(state, playerId, "RS-522", `${BOUKEN_COMMAND_EFFECT_ID}:${cardName(state.definitions, cmd.cardId)}`) };
});

/** 【ボウケンスピリッツ】そうしたとき: ナンバーに数字を持つ自軍 S ユニットを1体選ぶ。 */
function afterBoukenBold(state: GameState, playerId: PlayerId, pending: PendingEffectChoice): ChoiceOutcome {
  const p = state.players[playerId];
  const units = [...p.battle, ...p.rush]
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && typeof def.comboNumber === "number" && isSmallUnitNow(state, playerId, c);
    })
    .map((c) => c.instanceId);
  if (units.length === 0) return { state: finish(state, pending) };
  return { state: reopen(state, pending, { ...pending, effectId: BOUKEN_UNIT_EFFECT_ID, sourceCardId: "RS-522", kind: "select_unit", validInstanceIds: units, selectCount: 1, optional: false }) };
}

register(BOUKEN_UNIT_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = patchPlayer(state, playerId, (p) => addSet8NumberDelta(p, instanceId, 1, "RS-522"));
  return {
    state: finish(next, pending),
    log: logFor(state, playerId, "RS-522", `${BOUKEN_UNIT_EFFECT_ID}:${cardName(state.definitions, findCardInField(state, instanceId)?.card.cardId ?? instanceId)}`),
  };
});

// RS-524 呉越同舟
// 「『自分の手札を1枚選び相手に見せる』を実行してもよい。そうしたとき、自軍ユニットを1体選び、カテゴリを1つ宣言する。
//  このターン、宣言したカテゴリを選んだユニットに追加する。」

export const GOETSU_HAND_EFFECT_ID = "rs524_goetsu_reveal";
export const GOETSU_UNIT_EFFECT_ID = "rs524_goetsu_unit";
export const GOETSU_CATEGORY_EFFECT_ID = "rs524_goetsu_category";
const CATEGORIES = ["WB", "OT", "ET", "MA", "DA"] as const;

register(GOETSU_HAND_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  // 見せたカードは公開情報としてログに残す。
  const log = logFor(state, playerId, "RS-524", `${GOETSU_HAND_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const outcome = afterGoetsuBold(state, playerId, pending);
  if ("error" in outcome) return outcome;
  return { state: outcome.state, log };
});

/** 【呉越同舟】そうしたとき: 自軍ユニットを1体選び、カテゴリを1つ宣言する。 */
function afterGoetsuBold(state: GameState, playerId: PlayerId, pending: PendingEffectChoice): ChoiceOutcome {
  const p = state.players[playerId];
  const units = [...p.battle, ...p.rush].filter((c) => isUnitCard(state, c.cardId)).map((c) => c.instanceId);
  if (units.length === 0) return { state: finish(state, pending) };
  return { state: reopen(state, pending, { ...pending, effectId: GOETSU_UNIT_EFFECT_ID, sourceCardId: "RS-524", kind: "select_unit", validInstanceIds: units, selectCount: 1, optional: false }) };
}

register(GOETSU_UNIT_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return {
    state: reopen(state, pending, {
      ...pending,
      effectId: GOETSU_CATEGORY_EFFECT_ID,
      // カテゴリの宣言（数字・名前のボタンで選ぶ）。
      kind: "declare_number",
      validInstanceIds: [...CATEGORIES],
      selectedInstanceIds: [instanceId],
    }),
    log: logFor(state, playerId, "RS-524", `${GOETSU_UNIT_EFFECT_ID}:${cardName(state.definitions, findCardInField(state, instanceId)?.card.cardId ?? instanceId)}`),
  };
});

register(GOETSU_CATEGORY_EFFECT_ID, (state, playerId, category) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.selectedInstanceIds?.[0];
  if (!target || !findCardInField(state, target)) return { state: finish(state, pending) };
  const next = patchPlayer(state, playerId, (p) => addSet8Category(p, target, category as (typeof CATEGORIES)[number], "RS-524"));
  return { state: finish(next, pending), log: logFor(state, playerId, "RS-524", `${GOETSU_CATEGORY_EFFECT_ID}:${category}`) };
});

// RS-525 頼もしい相棒
// 「自分の手札から合体を必要とするLユニットのカードを1枚選び、相手に見せてから『オモテ向きの自軍パワーを2枚選び捨札にする』を
//  実行してもよい。そうしたとき、自軍山札を見て、その合体に必要なMユニットのカードを1枚選び、相手に見せてから自分の手札に
//  加えてもよい。その後、山札をシャッフルする。」
// 太字部分は『オモテ向きの自軍パワーを2枚選び捨札にする』だけ。L ユニットのカードを見せるのは入れ替えられない
// （呉越同舟の太字部分に読み替えるとき、見せた L ユニットのカードを見せるカードに選べる。grnrngr/faq-card-8 RS-524 Q2）。

export const PARTNER_L_EFFECT_ID = "rs525_partner_reveal_l";
export const PARTNER_POWER_EFFECT_ID = "rs525_partner_power";
export const PARTNER_SEARCH_EFFECT_ID = "rs525_partner_search";

register(PARTNER_L_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId);
  const op = state.players[playerId].operation.find((c) => c.instanceId === pending.sourceInstanceId);
  if (!card || !op) return { error: "invalid_target" };
  const log = logFor(state, playerId, "RS-525", `${PARTNER_L_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`);
  const cleared = { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId };
  const opened = beginTagBold(cleared, playerId, op, { hostCardId: "RS-525", hostOpId: op.instanceId, revealedLId: instanceId }, pending.resumeChoice);
  if (!opened.pendingEffectChoice) return { state: finish(state, pending), log };
  return { state: opened, log };
});

register(PARTNER_POWER_EFFECT_ID, (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 2) {
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId) },
      },
    };
  }
  const ids = new Set(selected);
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.filter((c) => !ids.has(c.instanceId)),
    discard: [...p.discard, ...p.power.filter((c) => ids.has(c.instanceId)).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
  }));
  const outcome = afterPartnerBold(next, playerId, pending);
  if ("error" in outcome) return outcome;
  return { state: outcome.state, log: logFor(state, playerId, "RS-525", `${PARTNER_POWER_EFFECT_ID}:discarded`) };
});

/** 【頼もしい相棒】そうしたとき: 見せた L ユニットの合体に必要な M ユニットのカードを山札から1枚選び、手札に加えてもよい。 */
function afterPartnerBold(state: GameState, playerId: PlayerId, pending: PendingEffectChoice): ChoiceOutcome {
  const lInstanceId = pending.tagMeta?.revealedLId ?? pending.viewedInstanceIds?.[0];
  const lCardId = state.players[playerId].hand.find((c) => c.instanceId === lInstanceId)?.cardId;
  const partners = lCardId ? listZordFusionPartnerIds(lCardId) : [];
  const partnerNames = new Set(partners.map((id) => getDefinition(state.definitions, id)?.name).filter((n): n is string => !!n));
  const materials = state.players[playerId].deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || def.size !== "M") return false;
      return partners.includes(c.cardId) || partnerNames.has(def.name);
    })
    .map((c) => c.instanceId);
  if (materials.length === 0) {
    return { state: finish(patchPlayer(state, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) })), pending) };
  }
  return {
    state: reopen(state, pending, {
      ...pending,
      effectId: PARTNER_SEARCH_EFFECT_ID,
      sourceCardId: "RS-525",
      kind: "select_unit",
      validInstanceIds: materials,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: true,
    }),
  };
}

register(
  PARTNER_SEARCH_EFFECT_ID,
  (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const card = state.players[playerId].deck.find((c) => c.instanceId === instanceId);
    if (!card) return { error: "invalid_target" };
    const next = patchPlayer(state, playerId, (p) => ({
      ...p,
      deck: shuffleCards(p.deck.filter((c) => c.instanceId !== instanceId)),
      hand: [...p.hand, { instanceId: card.instanceId, cardId: card.cardId }],
    }));
    return { state: finish(next, pending), log: logFor(state, playerId, "RS-525", `${PARTNER_SEARCH_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
  },
  (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const next = patchPlayer(state, playerId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
    return { state: finish(next, pending), log: skipLog(state, playerId, "RS-525", pending.effectId) };
  },
);

// ---------------------------------------------------------------------------
// applyAction の後処理

export function applySet8AAfterAction(before: GameState, after: GameState, blocked: boolean): GameState {
  let next = queuePhoenixFire(before, after);
  if (!blocked && next.set8aDrawQueue?.length && !next.winner) next = openPhoenixFireIfReady(next);
  return next;
}

