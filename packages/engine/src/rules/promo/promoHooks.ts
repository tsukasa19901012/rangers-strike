/**
 * プロモーションカードの継続効果の登録先のうち、core（core/catalog.ts 等）から呼ぶもの。
 * core からの循環 import を避けるため、このファイルは型以外を import しない（実装は rules/promo/xp*.ts が登録する）。
 */
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";

// 能力の付与（「次の能力を得る⇒※レジスト」「…コマンドとしてホールドできる」等。XP-018 ゴールド寿司・XP-020 護星天使）。
// keyword は DSL の名前（"register"・"lead_MA" 等）。rules/resist.ts canOfferRegister・rules/callLead.ts から呼ぶ。
type KeywordGrant = (state: GameState, ownerId: PlayerId, unit: CardInstance, keyword: string) => boolean;

function keywordGrants(): KeywordGrant[] {
  const holder = keywordGrants as unknown as { s?: KeywordGrant[] };
  return (holder.s ??= []);
}

export function registerPromoKeywordGrant(grant: KeywordGrant): void {
  keywordGrants().push(grant);
}

export function promoGrantsKeyword(state: GameState, ownerId: PlayerId, instanceId: string, keyword: string): boolean {
  const grants = keywordGrants();
  if (grants.length === 0) return false;
  const p = state.players[ownerId];
  const unit = p.battle.find((c) => c.instanceId === instanceId) ?? p.rush.find((c) => c.instanceId === instanceId);
  return !!unit && grants.some((grant) => grant(state, ownerId, unit, keyword));
}

// オペレーションの必要パワーの減少（XP-021 ファイナルカメンアタックフォームライドの※）。rules/operationProcedure.ts・core/applyAction.ts から呼ぶ。
type OperationCostReduction = (state: GameState, playerId: PlayerId, cardId: string) => number;

function operationCostReductions(): OperationCostReduction[] {
  const holder = operationCostReductions as unknown as { s?: OperationCostReduction[] };
  return (holder.s ??= []);
}

export function registerPromoOperationCostReduction(reduction: OperationCostReduction): void {
  operationCostReductions().push(reduction);
}

/** 必要パワーから引く数。 */
export function promoOperationCostReduction(state: GameState, playerId: PlayerId, cardId: string): number {
  let total = 0;
  for (const reduction of operationCostReductions()) total += reduction(state, playerId, cardId);
  return total;
}

// アタックしているユニットのバトルの BP（XP-030 の※）。rules/namedUnitEffects.ts battleAttackerBpBonus から呼ぶ。
type AttackerBpBonus = (state: GameState, battle: PendingBattle) => number;

function attackerBpBonuses(): AttackerBpBonus[] {
  const holder = attackerBpBonuses as unknown as { s?: AttackerBpBonus[] };
  return (holder.s ??= []);
}

export function registerPromoAttackerBpBonus(bonus: AttackerBpBonus): void {
  attackerBpBonuses().push(bonus);
}

export function promoAttackerBpBonus(state: GameState, battle: PendingBattle): number {
  let total = 0;
  for (const bonus of attackerBpBonuses()) total += bonus(state, battle);
  return total;
}

type BpBonus = (state: GameState, playerId: PlayerId, unit: CardInstance) => number;

function bpBonuses(): BpBonus[] {
  const holder = bpBonuses as unknown as { s?: BpBonus[] };
  return (holder.s ??= []);
}

/** 場のユニットの BP の増減（XP-020 護星天使 等）を登録する。 */
export function registerPromoBpBonus(bonus: BpBonus): void {
  bpBonuses().push(bonus);
}

/** core/catalog.ts effectiveBp から呼ぶ。 */
export function promoBpBonus(state: GameState, playerId: PlayerId, unit: CardInstance): number {
  let total = 0;
  for (const bonus of bpBonuses()) total += bonus(state, playerId, unit);
  return total;
}

// ---------------------------------------------------------------------------
// 小さな登録先（PROMO2: SX-002・SX-003・SX-005）。
type UnitPredicate = (state: GameState, ownerId: PlayerId, unit: CardInstance) => boolean;
type UnitNumber = (state: GameState, ownerId: PlayerId, unit: CardInstance) => number;

function listOf<T>(key: string): T[] {
  const holder = listOf as unknown as { s?: Record<string, unknown[]> };
  const all = (holder.s ??= {});
  return (all[key] ??= []) as T[];
}

/** 効果名を持たないテキスト（※）が無効な場のユニット（SX-003 W・FJ）。dsl/promotedKeywordBridge.ts・rules/resist.ts から呼ぶ。 */
export function registerPromoUnnamedTextNegation(p: UnitPredicate): void {
  listOf<UnitPredicate>("negate").push(p);
}

export function promoNegatesUnnamedText(state: GameState, ownerId: PlayerId, instanceId: string): boolean {
  const ps = listOf<UnitPredicate>("negate");
  if (ps.length === 0) return false;
  const unit = state.players[ownerId].battle.find((c) => c.instanceId === instanceId);
  return !!unit && ps.some((p) => p(state, ownerId, unit));
}

/** アタックかストライクを選ぶとき、可能ならアタックを選ぶユニット（SX-002 クウガRU）。core/legalActions.ts から呼ぶ。 */
export function registerPromoForcesAttack(p: UnitPredicate): void {
  listOf<UnitPredicate>("forceAttack").push(p);
}

export function promoForcesAttack(state: GameState, ownerId: PlayerId, unit: CardInstance): boolean {
  return listOf<UnitPredicate>("forceAttack").some((p) => p(state, ownerId, unit));
}

/** アタックされたユニットのバトルの BP（SX-003【アーム・ファング】）。rules/namedUnitEffects.ts battleDefenderBp から呼ぶ。 */
export function registerPromoDefenderBpBonus(b: UnitNumber): void {
  listOf<UnitNumber>("defBp").push(b);
}

export function promoDefenderBpBonus(state: GameState, ownerId: PlayerId, unit: CardInstance): number {
  return listOf<UnitNumber>("defBp").reduce((n, b) => n + b(state, ownerId, unit), 0);
}

/** 「SP○になる」の下限（SX-005 の DA）。rules/legend3/fieldEffects.ts から呼ぶ。 */
export function registerPromoSpFloor(b: UnitNumber): void {
  listOf<UnitNumber>("spFloor").push(b);
}

export function promoSpFloor(state: GameState, ownerId: PlayerId, unit: CardInstance): number {
  return listOf<UnitNumber>("spFloor").reduce((n, b) => Math.max(n, b(state, ownerId, unit)), 0);
}
