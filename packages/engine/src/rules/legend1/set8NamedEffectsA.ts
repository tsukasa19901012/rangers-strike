/**
 * 第8弾「究極の八神」（legend1）RS-516〜RS-537 のカード固有の効果（cardSpec RS8-516-537 の既知の不具合の修正）。
 *
 * - NC の効果: `trySet8ANumberCombo`（rules/numberComboEffects.ts applyNumberComboEffect から呼ぶ）
 * - 「これはアタックされない」（RS-517 バードニック反応炉）: `set8ADefenderBlocksAttack`（rules/legend3/restrictions.ts）
 * - applyAction の後処理（RS-533【フェニックスファイヤー】のドロー）: `applySet8AAfterAction`（core/applyAction.ts）
 * - 選択の解決: `tryResolveSet8AChoice` / `trySkipSet8AChoice` / `tryConfirmSet8AChoice`（rules/pendingChoices.ts）
 * 構成は rules/legend1/set7NamedEffectsA.ts と同じ。出典は各節のコメント（atwiki/page-N）。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardName, effectiveBp, getDefinition, parsePowerCost, unitEffectiveCategories } from "../../core/catalog";
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

function redHoldCandidates(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush]
    .filter((c) => !c.commandHeld && isUnitCard(state, c.cardId) && unitFeatures(state, playerId, c).includes("レッド"))
    .map((c) => c.instanceId);
}

function openSentaiSoul(state: GameState, playerId: PlayerId, entered: CardInstance): GameState {
  const residents = state.players[playerId].operation.filter((c) => c.cardId === "RS-521");
  if (residents.length === 0) return state;
  if (!unitFeatures(state, playerId, entered).includes("レッド")) return state;
  const candidates = redHoldCandidates(state, playerId);
  if (candidates.length === 0) return state;
  const number = getDefinition(state.definitions, entered.cardId)?.comboNumber;
  let choice: PendingEffectChoice | undefined;
  for (const op of [...residents].reverse()) {
    choice = {
      playerId,
      effectId: SENTAI_SOUL_HOLD_EFFECT_ID,
      sourceCardId: "RS-521",
      sourceInstanceId: op.instanceId,
      kind: "select_unit",
      phasePlayerId: playerId,
      validInstanceIds: candidates,
      selectCount: 1,
      optional: true,
      // 出たユニットのナンバー（数字でなければ手札から出せるユニットはない）。
      maxPowerCost: typeof number === "number" ? number : -1,
      ...(choice ? { resumeChoice: choice } : {}),
    };
  }
  return openEffectChoice(state, choice!);
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
    const limit = pending.maxPowerCost ?? -1;
    const ids = held.players[playerId].hand
      .filter((c) => {
        const def = getDefinition(held.definitions, c.cardId);
        return def?.type === "unit" && def.size === "S" && typeof def.comboNumber === "number" && def.comboNumber <= limit;
      })
      .map((c) => c.instanceId);
    const log = logFor(state, playerId, "RS-521", `${SENTAI_SOUL_HOLD_EFFECT_ID}:${cardName(state.definitions, found.card.cardId)}`);
    if (ids.length === 0) return { state: finish(held, pending), log };
    return {
      state: reopen(held, pending, {
        playerId,
        effectId: SENTAI_SOUL_DEPLOY_EFFECT_ID,
        sourceCardId: "RS-521",
        sourceInstanceId: pending.sourceInstanceId,
        kind: "select_hand",
        phasePlayerId: pending.phasePlayerId,
        validInstanceIds: ids,
        selectCount: 1,
        optional: true,
      }),
      log,
    };
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
// applyAction の後処理

export function applySet8AAfterAction(before: GameState, after: GameState, blocked: boolean): GameState {
  let next = queuePhoenixFire(before, after);
  if (!blocked && next.set8aDrawQueue?.length && !next.winner) next = openPhoenixFireIfReady(next);
  return next;
}

