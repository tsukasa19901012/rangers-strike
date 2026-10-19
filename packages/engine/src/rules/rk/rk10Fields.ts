/**
 * ザ・マスクドライダーEXP vol.3 RK-190〜RK-210 の継続効果の判定（低い層から呼ぶ小さなモジュール。rules/rk/rk10UnitEffects.ts が記録を書く）。
 *
 * - `rk10UnitHasResist`・`rk10AntlordGrantsResist`: RK-197 アントロード【女王の僕】（rules/resist.ts）と、レジストを持つユニットの判定（RK-192・RK-196）。
 * - `rk10G3xProtects`: RK-194 仮面ライダーG3-X ※（自軍ラッシュエリアの SP が空欄のユニットは相手に選ばれない。keywords/effectTargetability.ts）。
 * - `rk10BlocksBattleEntry`: RK-196 クイーンアントロード ※（rules/restrictions.ts）。
 * - `rk10OmegaIgnoresEntryHold`: RK-199 オメガゼール【ゼール種の統率】（rules/restrictions.ts requiredBattleEntryHolds）。
 * - `rk10ElasmoHoldReduction`: RK-209 エラスモテリウムオルフェノク ※（同上）。
 * - `rk10WolfBlocks`: RK-206 ウルフオルフェノク【望まない争い】（core/legalActions.ts・core/applyAction.ts）。
 * - `RK10_GARAI_SP1_RULE`: RK-191 ガライ【ガライソード】の「このターン、これはSP1になる」の記録。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { cardHasRegisterKeyword } from "../../keywords/registerReaction";

export const RK10_GARAI_SP1_RULE = "rk191_garai_sp1";
/** このターン、そのプレイヤーがアタック／ストライクを行った（RK-206【望まない争い】）。core/applyAction.ts が書く。 */
export const TURN_ATTACKED_RULE = "turn_attacked";
export const TURN_STRUCK_RULE = "turn_struck";

const PLAYERS: PlayerId[] = ["player1", "player2"];

function fieldOf(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function printedFeatures(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return getDefinition(state.definitions, cardId)?.features ?? [];
}

/** このターンの記録（kind "rule"・scope "turn"）の payload。 */
export function rk10TurnPayloads<T>(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string): T[] {
  return getPlayerModifiers(state.players[playerId])
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T);
}

export function rk10HasInstancePayload(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string, instanceId: string): boolean {
  return rk10TurnPayloads<{ instanceId?: string }>(state, playerId, ruleId).some((p) => p?.instanceId === instanceId);
}

/**
 * RK-197 アントロード【女王の僕】「これが自軍バトルエリアにある間、特徴「女」を持つユニットは次の能力を得る⇒レジスト」（atwiki/page-921）。
 * 得るのは自軍（アントロードの持ち主）の「女」のユニットだけ。ownerId はそのユニットの持ち主
 * （ユーザー決定 2026-10-19「自軍だけ」。docs/rules/README.md §5.7 n。カード評価「敵軍も受けてしまう」は採らない）。
 */
export function rk10AntlordGrantsResist(
  state: Pick<GameState, "players" | "definitions">,
  ownerId: PlayerId,
  card: Pick<CardInstance, "cardId">,
): boolean {
  if (getDefinition(state.definitions, card.cardId)?.type !== "unit") return false;
  if (!printedFeatures(state, card.cardId).includes("女")) return false;
  return state.players[ownerId].battle.some((c) => isSameCardIdentity(c.cardId, "RK-197"));
}

/** レジストを持つユニットか（本文のレジスト・アントロードで得たレジスト）。 */
export function rk10UnitHasResist(state: GameState, ownerId: PlayerId, card: CardInstance): boolean {
  if (getDefinition(state.definitions, card.cardId)?.type !== "unit") return false;
  return cardHasRegisterKeyword(state, card.cardId, ownerId) || rk10AntlordGrantsResist(state, ownerId, card);
}

/**
 * RK-194 仮面ライダーG3-X「※これが自軍エリアにある間、自軍ラッシュエリアのSPが空欄のユニットは相手に選ばれない。」（atwiki/page-999）。
 * SP が付与されたユニットは外れる（コメント欄）。
 */
export function rk10G3xProtects(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, card: CardInstance): boolean {
  if (!state.players[ownerId].rush.some((c) => c.instanceId === card.instanceId)) return false;
  if (!fieldOf(state, ownerId).some((c) => isSameCardIdentity(c.cardId, "RK-194"))) return false;
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "unit") return false;
  const sp = card.spOverride ?? def.sp;
  return (sp === undefined || sp === null) && !((card.spModifier ?? 0) > 0);
}

/** RK-196 クイーンアントロード「※レジストを持つ敵軍ユニットがなければ、これはバトルエリアに出られない。」（atwiki/page-920）。 */
export function rk10BlocksBattleEntry(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  if (isSameCardIdentity(unit.cardId, "RK-196")) {
    const enemyId = opponent(playerId);
    return !fieldOf(state, enemyId).some((c) => rk10UnitHasResist(state, enemyId, c));
  }
  return false;
}

/**
 * RK-199 オメガゼール【ゼール種の統率】「これが自軍エリアにある間、…「オメガゼール」以外の特徴「レイヨウ型」を持つ自軍ユニットは
 * 「これはコマンドを1つホールドしなければバトルエリアに出られない」と書かれていても、そのテキストは無効になる。」（atwiki/page-922）
 */
export function rk10OmegaIgnoresEntryHold(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, unit: CardInstance): boolean {
  const def = getDefinition(state.definitions, unit.cardId);
  if (!def || def.name === "オメガゼール") return false;
  if (!printedFeatures(state, unit.cardId).includes("レイヨウ型")) return false;
  return fieldOf(state, playerId).some((c) => c.instanceId !== unit.instanceId && getDefinition(state.definitions, c.cardId)?.name === "オメガゼール");
}

/** RK-209「※これは自軍コマンドを5つホールドしなければバトルエリアに出られない。ただし、ホールドする数は相手の手札1枚につき1少なくなる。」 */
export function rk10ElasmoHoldReduction(state: Pick<GameState, "players">, playerId: PlayerId, unit: CardInstance): number {
  if (!isSameCardIdentity(unit.cardId, "RK-209")) return 0;
  return state.players[opponent(playerId)].hand.length;
}

/**
 * RK-206 ウルフオルフェノク【望まない争い】「これが自軍エリアにある間、自分も相手も次の制限を受ける⇒アタックを1度でも行った場合、
 * そのターン中はアタックすることができない。また、ストライクを1度でも行った場合、そのターン中はストライクすることができない。」（atwiki/page-926）
 */
export function rk10WolfBlocks(state: Pick<GameState, "players">, playerId: PlayerId, action: "attack" | "strike"): boolean {
  if (!PLAYERS.some((pid) => fieldOf(state, pid).some((c) => isSameCardIdentity(c.cardId, "RK-206")))) return false;
  const rule = action === "attack" ? TURN_ATTACKED_RULE : TURN_STRUCK_RULE;
  return getPlayerModifiers(state.players[playerId]).some((m) => m.kind === "rule" && m.ruleId === rule && m.scope === "turn");
}

/** アタック／ストライクを行ったことをこのターンの記録に残す（keywordGapRuntime markUnitBattleAction から呼ぶ）。 */
export function markTurnBattleAct(player: PlayerState, action: "attack" | "strike"): PlayerState {
  const rule = action === "attack" ? TURN_ATTACKED_RULE : TURN_STRUCK_RULE;
  const mods = getPlayerModifiers(player);
  if (mods.some((m) => m.kind === "rule" && m.ruleId === rule && m.scope === "turn")) return player;
  return { ...player, modifiers: [...mods, { kind: "rule", ruleId: rule, scope: "turn" }] };
}
