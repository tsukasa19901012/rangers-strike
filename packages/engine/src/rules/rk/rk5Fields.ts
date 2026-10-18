/**
 * ザ・マスクドライダーEXP vol.2 RK-085〜RK-105 の継続効果（BP・SP・カテゴリ・アタック先・イマジンの撃破テキスト）。
 * core/catalog.ts・rules/fieldAuras.ts・rules/legend3/*.ts 等の低い層から呼ぶ小さなモジュール。カードの効果の起点は rules/rk/rk5UnitEffects.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { Category } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { unitFeatures } from "../addedFeatures";
import { rk1IsSmallNow } from "./rk1Features";

type FieldState = Pick<GameState, "players" | "definitions">;

function fieldCards(state: FieldState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function hasFieldCard(state: FieldState, playerId: PlayerId, cardId: string): boolean {
  // BP・特徴の計算のたびに呼ばれるので、場の配列を作らずに見る。
  const p = state.players[playerId];
  return p.battle.some((c) => isSameCardIdentity(c.cardId, cardId)) || p.rush.some((c) => isSameCardIdentity(c.cardId, cardId));
}

function countFieldCard(state: FieldState, playerId: PlayerId, cardId: string): number {
  const p = state.players[playerId];
  let n = 0;
  for (const c of p.battle) if (isSameCardIdentity(c.cardId, cardId)) n += 1;
  for (const c of p.rush) if (isSameCardIdentity(c.cardId, cardId)) n += 1;
  return n;
}

function isUnitCard(state: FieldState, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function ownerOf(state: FieldState, instanceId: string): PlayerId | undefined {
  for (const pid of ["player1", "player2"] as const) {
    if (fieldCards(state, pid).some((c) => c.instanceId === instanceId)) return pid;
  }
  return undefined;
}

/** このターンの記録（instanceId 付き）があるか。 */
export function rk5HasTurnPayload(state: FieldState, playerId: PlayerId, ruleId: string, instanceId: string): boolean {
  return getPlayerModifiers(state.players[playerId]).some(
    (m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn" && (m as { payload?: { instanceId?: string } }).payload?.instanceId === instanceId,
  );
}

// ---------------------------------------------------------------------------
// RK-091 ゾル大佐【戦闘員の統率】
// 「これが自軍エリアにある間、自軍バトルエリアにある特徴「戦闘員」を持つ自軍SユニットのBPは、自軍バトルエリアにある特徴「戦闘員」を持つ
//  自軍Sユニットの本来のBPをすべて「＋」した値になる。また、特徴「戦闘員」を持つ自軍Sユニットは、BP3000のとき「SP1」になる。」（atwiki/page-699）
// 「～になる」なので、ビークル等の増減は計算しない（R-BP-01）。特徴は今の特徴（RS-203 デウス遺伝子で追加された「戦闘員」を含む。grnrngr/faq-rider-2 RK-091 Q）。

export const ZOL_CARD_ID = "RK-091";

function isGruntS(state: FieldState, playerId: PlayerId, card: CardInstance): boolean {
  return isUnitCard(state, card.cardId) && rk1IsSmallNow(state, card) && unitFeatures(state as GameState, playerId, card).includes("戦闘員");
}

/** 「BP は…の値になる」の値（対象でなければ undefined。core/catalog.ts bpSetValueOf から呼ぶ）。 */
export function rk5BpSetValue(state: FieldState, playerId: PlayerId, instance: CardInstance): number | undefined {
  if (!hasFieldCard(state, playerId, ZOL_CARD_ID)) return undefined;
  const battle = state.players[playerId].battle;
  if (!battle.some((c) => c.instanceId === instance.instanceId)) return undefined;
  if (!isGruntS(state, playerId, instance)) return undefined;
  let sum = 0;
  for (const c of battle) {
    if (!isGruntS(state, playerId, c)) continue;
    const bp = getDefinition(state.definitions, c.cardId)?.bp;
    sum += typeof bp === "number" ? bp : 0;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// RK-092 狼男【狼作戦】「これが自軍エリアにある間、特徴「男」を持つ自軍SユニットはカテゴリにWBが追加される。」（atwiki/page-697）
// 既に持っているカテゴリは重ねて追加しない（atwiki/page-697 コメント欄）。

/** 追加されるカテゴリ（core/catalog.ts unitEffectiveCategories から呼ぶ）。 */
export function rk5AddedCategories(state: FieldState, playerId: PlayerId, instance: CardInstance): Category[] {
  if (!hasFieldCard(state, playerId, "RK-092")) return [];
  if (!isUnitCard(state, instance.cardId) || !rk1IsSmallNow(state, instance)) return [];
  if (!fieldCards(state, playerId).some((c) => c.instanceId === instance.instanceId)) return [];
  return unitFeatures(state as GameState, playerId, instance).includes("男") ? ["WB"] : [];
}

// ---------------------------------------------------------------------------
// BP の増減（rules/fieldAuras.ts passiveNamedFieldBpBonus から呼ぶ。"general" のときだけ）。
// - RK-099 アポロガイスト【怪人の監視権限】「これが自軍エリアにある間、特徴「怪人」を持つ自軍ユニットはBP+1000される。」（体数分重複する）
// - RK-103 仮面ライダークウガPF【ブラストペガサス】「これは、特徴「警察」を持つ自軍ユニットからコンビネーションするときBP+3000され…」
// - RK-105 仮面ライダーアギトSF「※これはライド中、BP+1000される。」

export const BLAST_PEGASUS_RULE = "rk103_blast_pegasus_active";

export function rk5FieldBpBonus(state: FieldState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  const apollo = countFieldCard(state, playerId, "RK-099");
  if (apollo > 0 && isUnitCard(state, instance.cardId) && ownerOf(state, instance.instanceId) === playerId) {
    if (unitFeatures(state as GameState, playerId, instance).includes("怪人")) bonus += 1000 * apollo;
  }
  if (isSameCardIdentity(instance.cardId, "RK-103") && rk5HasTurnPayload(state, playerId, BLAST_PEGASUS_RULE, instance.instanceId)) bonus += 3000;
  if (isSameCardIdentity(instance.cardId, "RK-105") && instance.mountedOnInstanceId) bonus += 1000;
  return bonus;
}

// ---------------------------------------------------------------------------
// SP（rules/legend3/fieldEffects.ts legend3EffectiveSp から呼ぶ）。
// - RK-091 ゾル大佐「特徴「戦闘員」を持つ自軍Sユニットは、BP3000のとき「SP1」になる。」（BP が 3000 ちょうどのとき）
// - RK-099 アポロガイスト「そうしたとき、このターン、これは「SP1」になる。」

export const APOLLO_SP_RULE = "rk099_apollo_sp1";

export function rk5EffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number, bp: (s: GameState, p: PlayerId, c: CardInstance) => number): number {
  let next = sp;
  if (hasFieldCard(state, playerId, ZOL_CARD_ID) && ownerOf(state, instance.instanceId) === playerId && isGruntS(state, playerId, instance) && bp(state, playerId, instance) === 3000) {
    next = Math.max(next, 1);
  }
  if (isSameCardIdentity(instance.cardId, "RK-099") && rk5HasTurnPayload(state, playerId, APOLLO_SP_RULE, instance.instanceId)) next = Math.max(next, 1);
  return next;
}

// ---------------------------------------------------------------------------
// RK-103【ブラストペガサス】「…敵軍ラッシュエリアのユニットにアタックできる。」（rules/legend3/restrictions.ts canAttackDefender から呼ぶ）

export function rk5AttackerCanAttackRush(state: FieldState, playerId: PlayerId, attacker: CardInstance): boolean {
  return isSameCardIdentity(attacker.cardId, "RK-103") && rk5HasTurnPayload(state, playerId, BLAST_PEGASUS_RULE, attacker.instanceId);
}

// ---------------------------------------------------------------------------
// RK-088 イマジンとの契約「重ねたユニットが自軍エリアにある間、特徴「イマジン」を持つ自軍ユニットは、「これはバトルエリアに出たとき撃破される」と
//  書かれていても、そのテキストは無効になる。」（atwiki/page-710。rules/destroyOnEnterBattle.ts から呼ぶ）

export const IMAGIN_CONTRACT_CARD_ID = "RK-088";

export function rk5ImaginContractSuppresses(state: FieldState, playerId: PlayerId, instance: CardInstance): boolean {
  const contracted = fieldCards(state, playerId).some((c) => (c.stackedCards ?? []).some((s) => isSameCardIdentity(s.cardId, IMAGIN_CONTRACT_CARD_ID)));
  if (!contracted) return false;
  return unitFeatures(state as GameState, playerId, instance).includes("イマジン");
}
