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
import { cardName, effectiveBp, getDefinition, parsePowerCost } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { openEffectChoice, requestDrawFromDeck, type ChoiceOutcome } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { findCardInField } from "../fieldLookup";
import { unitFeatures } from "../addedFeatures";
import { markBattleNcEffect } from "../namedUnitEffects";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { isSmallUnitNow } from "./set6NamedEffectsB";
import { bounceAllFromZone } from "../bounce";
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
// applyAction の後処理

export function applySet8AAfterAction(before: GameState, after: GameState, blocked: boolean): GameState {
  let next = queuePhoenixFire(before, after);
  if (!blocked && next.set8aDrawQueue?.length && !next.winner) next = openPhoenixFireIfReady(next);
  return next;
}

export { reopen as reopenSet8AChoice, categoriesOf as set8ACategoriesOf };
