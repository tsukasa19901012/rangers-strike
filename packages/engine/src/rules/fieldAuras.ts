import type { Category } from "@rangers-strike/cards";
import { playerHasActiveFieldKeyword } from "../dsl/fieldKeywords";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, cardName, isLargeUnit } from "../core/catalog";
import { opponent } from "../core/helpers";
import { legend2FieldBpBonus } from "./legend2/fieldEffects";
import { legend3FieldBpBonus } from "./legend3/fieldEffects";

function categoriesInclude(
  categories: Category | Category[],
  target: Category,
): boolean {
  const list = Array.isArray(categories) ? categories : [categories];
  return list.includes(target);
}

function playerHasInRush(state: GameState, playerId: PlayerId, cardId: string): boolean {
  return state.players[playerId].rush.some((c) => c.cardId === cardId);
}

function playerHasInBattle(state: GameState, playerId: PlayerId, cardId: string): boolean {
  return state.players[playerId].battle.some((c) => c.cardId === cardId);
}

/** note_other_* nc キーワードによる恒常的BPボーナス。effectiveBp 経由で "general" ロールのみ算入。 */
function noteOtherNcBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const cardId = instance.cardId;
  const enemyId = opponent(playerId);
  const own = state.players[playerId];
  const enemy = state.players[enemyId];
  let bonus = 0;

  // RK-117: BP+1000 per held enemy unit (command zone, commandHeld=true)
  if (cardId === "RK-117") {
    bonus += enemy.command.filter((c) => c.commandHeld).length * 1000;
  }

  // RK-127: BP+2000 per enemy hand card
  if (cardId === "RK-127") {
    bonus += enemy.hand.length * 2000;
  }

  // RK-292: BP+3000 per copy of itself in own discard
  if (cardId === "RK-292") {
    bonus += own.discard.filter((c) => c.cardId === "RK-292").length * 3000;
  }

  // RK-332: BP+1000 per own ドラゴン unit in rush or battle
  if (cardId === "RK-332") {
    const dragonCount = [...own.rush, ...own.battle].filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.features?.includes("ドラゴン");
    }).length;
    bonus += dragonCount * 1000;
  }

  // RS-421: BP+1000 per own command with feature レッド
  if (cardId === "RS-421") {
    bonus += own.command.filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.features?.includes("レッド");
    }).length * 1000;
  }

  // RS-440: BP+1000 per own unit with number containing L or R (e.g. 1L, 2R)
  // Deferred — number parsing needed. Skip for now.

  // RS-501: BP+1000 per own 女 unit in rush or battle
  if (cardId === "RS-501") {
    bonus += [...own.rush, ...own.battle].filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.features?.includes("女");
    }).length * 1000;
  }

  // XG1-020: BP+1000 per own command with 2+ categories
  if (cardId === "XG1-020") {
    bonus += own.command.filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (!def) return false;
      const cats = Array.isArray(def.category) ? def.category : [def.category];
      return cats.length >= 2;
    }).length * 1000;
  }

  // RS-558 (ガンマジン): BP+4000 if any L-unit on field (own or enemy)
  if (cardId === "RS-558") {
    const anyL = [...own.rush, ...own.battle, ...enemy.rush, ...enemy.battle].some(
      (c) => c.instanceId !== instance.instanceId && isLargeUnit(state.definitions, c.cardId),
    );
    if (anyL) bonus += 4000;
  }

  // RS-672 (ゴローダーGT): BP+2000 if any L-unit on field (own or enemy)
  if (cardId === "RS-672") {
    const anyL = [...own.rush, ...own.battle, ...enemy.rush, ...enemy.battle].some(
      (c) => c.instanceId !== instance.instanceId && isLargeUnit(state.definitions, c.cardId),
    );
    if (anyL) bonus += 2000;
  }

  // XG3-003 (ラジエッカーロボ): BP+3000 if any L-unit on field (own or enemy)
  if (cardId === "XG3-003") {
    const anyL = [...own.rush, ...own.battle, ...enemy.rush, ...enemy.battle].some(
      (c) => c.instanceId !== instance.instanceId && isLargeUnit(state.definitions, c.cardId),
    );
    if (anyL) bonus += 3000;
  }

  // XG3-013 (ガオポーラー): BP+3000 if own ガオベアー in rush or battle
  if (cardId === "XG3-013") {
    const hasGaoBear = [...own.rush, ...own.battle].some(
      (c) => cardName(state.definitions, c.cardId) === "ガオベアー",
    );
    if (hasGaoBear) bonus += 3000;
  }

  // XG3-015 (ガオベアー): BP+3000 if own ガオポーラー in rush or battle
  if (cardId === "XG3-015") {
    const hasGaoPolar = [...own.rush, ...own.battle].some(
      (c) => cardName(state.definitions, c.cardId) === "ガオポーラー",
    );
    if (hasGaoPolar) bonus += 3000;
  }

  return bonus;
}

/** RS-034 / RS-045 / RS-037 パッシブBPオーラ。 */
export function passiveNamedFieldBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  role: "general" | "attacking" | "defending",
): number {
  const def = state.definitions[instance.cardId];
  if (!def || def.type !== "unit") return 0;

  let bonus = 0;

  if (
    playerHasInBattle(state, playerId, "RS-034") &&
    instance.cardId !== "RS-034" &&
    categoriesInclude(def.category, "WB")
  ) {
    bonus += 2000;
  }

  if (role === "defending" && def.size === "M" && categoriesInclude(def.category, "OT")) {
    if (
      playerHasInRush(state, playerId, "RS-045") ||
      playerHasActiveFieldKeyword(state, playerId, "over_technology_m_bp_plus_on_attacked", ["rush"])
    ) {
      bonus += 1000;
    }
  }

  if (role === "attacking" && def.size === "M" && categoriesInclude(def.category, "WB")) {
    if (playerHasInRush(state, playerId, "RS-037")) {
      bonus += 1000;
    }
  }

  bonus += legend2FieldBpBonus(state, playerId, instance, role);
  bonus += legend3FieldBpBonus(state, playerId, instance, role);

  // nc note_other_* BP bonuses — counted only once via effectiveBp's "general" call
  if (role === "general") {
    bonus += noteOtherNcBpBonus(state, playerId, instance);
  }

  return bonus;
}
