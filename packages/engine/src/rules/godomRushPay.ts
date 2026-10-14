import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { cardCategories, getDefinition, parsePowerCost, rushPowerCost } from "../core/catalog";
import { countAvailablePower, effectivePowerCost } from "../core/power";
import { darkDealRushPowerBudget } from "./legend3/restrictions";
import { unitFeatures } from "./addedFeatures";
import { namedTextNegated } from "./legend1/set6NamedEffects348";
import { turnPlayerOf } from "./legend1/set6NamedEffectsB";

/**
 * RS-586 巨神ゴードム【魔神に不足する物】
 * 「これが自軍エリアにある間、自軍ラッシュフェイズ中、自分の手札からDAを持つユニットカードをラッシュするとき、そのパワーを満たすために
 *  次のようにしてもよい⇒必要パワーに足りない数だけ、特徴「戦闘員」を持つユニットを捨札にする。」（atwiki/page-1221）
 * 捨札にするのは場（自軍エリア）の「戦闘員」のユニット（捨札の「戦闘員」のカードはユニットではない）。足りない数ちょうどを捨札にする
 * （効果での撃破ではない）。どのユニットを捨札にするかはプレイヤーが選ぶ（ラッシュの宣言 rush / initiate_command_payment /
 * begin_zord_setup の godomDiscardInstanceIds。候補がちょうど足りない数なら選ぶ余地はない）。「してもよい」なので、
 * アブレラ【闇の取引】等の別の手段で満たせるなら使わないこともできる（godomDiscardInstanceIds: []）。
 */
function godomActive(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== "rush" || turnPlayerOf(state) !== playerId) return false;
  const player = state.players[playerId];
  return [...player.rush, ...player.battle].some(
    (card) => card.cardId === "RS-586" && !namedTextNegated(state, playerId, card),
  );
}

/** 捨札にできる「戦闘員」のユニット（自軍ラッシュエリア・バトルエリアの順）。 */
function fieldGrunts(state: GameState, playerId: PlayerId, player: PlayerState): CardInstance[] {
  return [...player.rush, ...player.battle].filter((card) => {
    const def = getDefinition(state.definitions, card.cardId);
    return def?.type === "unit" && unitFeatures(state, playerId, card).includes("戦闘員");
  });
}

/** 【魔神に不足する物】で捨札にできる「戦闘員」のユニット（使えなければ空）。 */
export function godomDiscardCandidates(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unitDefinition: CardDefinition,
): string[] {
  if (!appliesTo(state, playerId, unitDefinition)) return [];
  return fieldGrunts(state, playerId, player).map((c) => c.instanceId);
}

function appliesTo(state: GameState, playerId: PlayerId, unitDefinition: CardDefinition): boolean {
  return unitDefinition.type === "unit" && cardCategories(unitDefinition).includes("DA") && godomActive(state, playerId);
}

/** 旧来の「捨札の戦闘員をパワーに数える」加算は行わない（core/power.ts から呼ぶ。常に 0）。 */
export function godomDiscardPowerBonus(_state: GameState, _playerId: PlayerId): number {
  return 0;
}

export function godomRushPowerBudget(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unitDefinition: CardDefinition,
): number {
  const budget = countAvailablePower(state, playerId);
  const cost = effectivePowerCost(state, playerId, parsePowerCost(unitDefinition.powerCost));
  if (budget >= cost) return budget;
  if (!appliesTo(state, playerId, unitDefinition)) return budget;
  return budget + fieldGrunts(state, playerId, player).length;
}

/**
 * 足りない必要パワー（shortage）の数だけ「戦闘員」のユニットを捨札にする。
 * - chosen: プレイヤーが選んだユニット（ちょうど shortage 体）。[] なら使わない（null）。
 *   省略時は、候補がちょうど shortage 体のときだけ（選ぶ余地がないので）それを捨札にし、多ければ選択が必要（error）。
 * - 使えない・足りない・選んだユニットが不正なら null（error のときは選び直しが必要）。
 */
export function applyGodomSenshoDiscardPay(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unitDefinition: CardDefinition,
  shortage: number,
  chosen?: string[],
): { player: PlayerState; covered: number } | { error: string } | null {
  if (shortage <= 0) return { player, covered: 0 };
  if (!appliesTo(state, playerId, unitDefinition)) return null;
  if (chosen && chosen.length === 0) return null;
  const candidates = fieldGrunts(state, playerId, player);
  if (candidates.length < shortage) return null;
  let grunts: CardInstance[];
  if (!chosen) {
    if (candidates.length !== shortage) return { error: "godom_discard_choice_required" };
    grunts = candidates;
  } else {
    const ids = new Set(chosen);
    grunts = candidates.filter((c) => ids.has(c.instanceId));
    if (ids.size !== chosen.length || grunts.length !== chosen.length || chosen.length !== shortage) {
      return { error: "invalid_godom_discard" };
    }
  }
  const ids = new Set(grunts.map((c) => c.instanceId));
  return {
    player: {
      ...player,
      rush: player.rush.filter((c) => !ids.has(c.instanceId)),
      battle: player.battle.filter((c) => !ids.has(c.instanceId)),
      discard: [...player.discard, ...grunts.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
    },
    covered: shortage,
  };
}

/**
 * 手札からのラッシュの宣言（rush / initiate_command_payment / begin_zord_setup）の godomDiscardInstanceIds を確かめる。
 * 問題なければ null。必要パワーの不足は宣言の時点のパワーで数える（R-RUSH-11）。
 */
export function godomDeclarationError(
  state: GameState,
  playerId: PlayerId,
  handInstanceId: string,
  chosen: string[] | undefined,
  zordMaterialIds: string[] = [],
): string | null {
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === handInstanceId);
  const def = card ? getDefinition(state.definitions, card.cardId) : undefined;
  if (!card || !def || def.type !== "unit") return chosen && chosen.length > 0 ? "invalid_godom_discard" : null;
  const cost = effectivePowerCost(state, playerId, rushPowerCost(state, playerId, def, { zordMaterialInstanceIds: zordMaterialIds }));
  const shortage = cost - countAvailablePower(state, playerId);
  const materials = new Set(zordMaterialIds);
  const candidates = shortage > 0 ? godomDiscardCandidates(state, playerId, player, def).filter((id) => !materials.has(id)) : [];
  if (chosen === undefined) {
    // 選ぶ余地があるのに選んでいない（アブレラ等の別の手段で満たせるなら、ゴードムを使わずにラッシュできる）。
    if (candidates.length > shortage && shortage > 0 && darkDealRushPowerBudget(state, playerId, player, def) < cost) {
      return "godom_discard_choice_required";
    }
    return null;
  }
  if (chosen.length === 0) return null;
  if (shortage <= 0 || chosen.length !== shortage || new Set(chosen).size !== chosen.length) return "invalid_godom_discard";
  return chosen.every((id) => candidates.includes(id)) ? null : "invalid_godom_discard";
}
