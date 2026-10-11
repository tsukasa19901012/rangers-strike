/**
 * 「自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられている間
 *  カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒…」
 * の共通処理（RS-623【翼合体】atwiki/page-1460・RS-647【ソウルバード】page-1469・RS-650【強蹴一閃ライノシュート】page-1471、
 * 同じ文言の XG1-035 等【侍武装】・XG3-010【ジークの命】）。
 *
 * - 起動: 自軍ラッシュフェイズ中ならいつでも（「ラッシュしたとき」ではない）。ホールド状態でも使える（page-1460 コメント「どちらもＯＫ」）。
 *   合法手は activate_field_unit_ability（rules/fieldActivatedAbilities.ts）。
 * - 重ねた状態: L ユニットの stackedCards にこのカードを持つ。重ねたカードは場を離れて「カード」になる（ユニットではない）。
 * - 重ねたユニットが得る能力はカードごとの「⇒」の後の文（rules/stackOntoLargeGrants.ts）。重ねた後に L でなくなっても残る
 *   （page-1460 コメント「どちらもＯＫ」）。
 * - 重ねたユニットがユニットでなくなる（場を離れる）とき、重ねたカードは持ち主の捨札になる（settleStackOntoLargeCards）。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId, PlayerState } from "../types/game";
import { getDefinition, unitEffectiveCategories } from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import { openEffectChoice } from "./pendingChoices";
import { namedTextNegated } from "./legend1/set6NamedEffects348";
import { turnPlayerOf } from "./legend1/set6NamedEffectsB";
import { isStackOntoLargeCard } from "./stackOntoLargeGrants";

export const STACK_ONTO_LARGE_EFFECT_ID = "stack_self_onto_l";

function strip(card: Pick<CardInstance, "instanceId" | "cardId">): CardInstance {
  return { instanceId: card.instanceId, cardId: card.cardId };
}

function fieldCard(state: GameState, playerId: PlayerId, instanceId: string): { card: CardInstance; zone: "rush" | "battle" } | null {
  const p = state.players[playerId];
  const rush = p.rush.find((c) => c.instanceId === instanceId);
  if (rush) return { card: rush, zone: "rush" };
  const battle = p.battle.find((c) => c.instanceId === instanceId);
  return battle ? { card: battle, zone: "battle" } : null;
}

/** 重ねられる自軍ユニット: DA を持たない（効果で追加されたカテゴリも見る）L ユニット（自身以外）。 */
export function stackOntoLargeHosts(state: GameState, playerId: PlayerId, selfInstanceId: string): string[] {
  const p = state.players[playerId];
  const hosts: string[] = [];
  for (const zone of ["rush", "battle"] as const) {
    for (const c of p[zone]) {
      if (c.instanceId === selfInstanceId) continue;
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || def.size !== "L") continue;
      if (unitEffectiveCategories(state, playerId, c, zone).includes("DA")) continue;
      hosts.push(c.instanceId);
    }
  }
  return hosts;
}

/** 起動できるか（自軍ラッシュフェイズ中・自軍エリアにある・重ねられるユニットがある）。 */
export function canActivateStackOntoLarge(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (!isStackOntoLargeCard(card.cardId)) return false;
  if (state.phase !== "rush" || turnPlayerOf(state) !== playerId) return false;
  if (state.pendingEffectChoice || state.pendingCommandPayment || state.pendingZordSetup || state.pendingEffectRush || state.pendingRush) {
    return false;
  }
  if (!fieldCard(state, playerId, card.instanceId)) return false;
  if (namedTextNegated(state, playerId, card)) return false;
  return stackOntoLargeHosts(state, playerId, card.instanceId).length > 0;
}

/** 重ねる L ユニットを選ぶ（「重ねてもよい」— 見送れる）。 */
export function beginStackOntoLarge(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const hosts = stackOntoLargeHosts(state, playerId, card.instanceId);
  if (hosts.length === 0) return state;
  const choice: PendingEffectChoice = {
    playerId,
    effectId: STACK_ONTO_LARGE_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    phasePlayerId: playerId,
    kind: "select_unit",
    validInstanceIds: hosts,
    selectCount: 1,
    optional: true,
  };
  return openEffectChoice(state, choice);
}

/** 選んだ L ユニットにこのカードを重ねる。重ねられなければ null。 */
export function resolveStackOntoLarge(
  state: GameState,
  pending: PendingEffectChoice,
  hostInstanceId: string,
): GameState | null {
  const selfId = pending.sourceInstanceId;
  if (!selfId) return null;
  const playerId = pending.playerId;
  const self = fieldCard(state, playerId, selfId);
  if (!self || !fieldCard(state, playerId, hostInstanceId)) return null;
  if (!stackOntoLargeHosts(state, playerId, selfId).includes(hostInstanceId)) return null;
  const player = state.players[playerId];
  // 重ねたカードは場を離れて「カード」になる（付いていた状態はなくなる。R-ZONE-04）。このカードに重なっていたカードは捨札になる。
  const freed = (self.card.stackedCards ?? []).map(strip);
  const attach = (cards: CardInstance[]): CardInstance[] =>
    cards
      .filter((c) => c.instanceId !== selfId)
      .map((c) => {
        if (c.mountedOnInstanceId === selfId) {
          const { mountedOnInstanceId: _m, ...rest } = c;
          return rest as CardInstance;
        }
        return c.instanceId === hostInstanceId ? { ...c, stackedCards: [...(c.stackedCards ?? []), strip(self.card)] } : c;
      });
  const next: PlayerState = {
    ...player,
    rush: attach(player.rush),
    battle: attach(player.battle),
    discard: freed.length > 0 ? [...player.discard, ...freed] : player.discard,
  };
  return { ...state, ...updatePlayer(state, playerId, next) };
}

const NON_FIELD_ZONES = ["hand", "deck", "discard", "power", "command", "operation"] as const;

function instanceExists(state: GameState, instanceId: string): boolean {
  const contains = (cards: CardInstance[] | undefined): boolean =>
    !!cards?.some((c) => c.instanceId === instanceId || contains(c.stackedCards));
  return (["player1", "player2"] as const).some((pid) => {
    const p = state.players[pid];
    return [p.battle, p.rush, ...NON_FIELD_ZONES.map((z) => p[z] as CardInstance[]), p.exile ?? []].some((cards) => contains(cards));
  });
}

/**
 * applyAction の後処理: 重ねたユニットがユニットでなくなった（場を離れた）ら、重ねていたカードは持ち主の捨札になる。
 * 場を離れたユニットのカードに残っている重なりから外し、どこにも残っていなければ前の状態から持ち主の捨札に置く。
 * レジスト等でユニットのまま場に留まれば重なったまま（page-1469 コメント「レジスト発動後にユニットは残り」）。
 */
export function settleStackOntoLargeCards(before: GameState, after: GameState): GameState {
  const stacked: Array<{ ownerId: PlayerId; card: CardInstance }> = [];
  for (const pid of ["player1", "player2"] as const) {
    for (const host of [...before.players[pid].rush, ...before.players[pid].battle]) {
      for (const s of host.stackedCards ?? []) if (isStackOntoLargeCard(s.cardId)) stacked.push({ ownerId: pid, card: s });
    }
  }
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const p = next.players[pid];
    const freed: CardInstance[] = [];
    const patched: Partial<Record<(typeof NON_FIELD_ZONES)[number], CardInstance[]>> = {};
    for (const zone of NON_FIELD_ZONES) {
      const cards = p[zone] as CardInstance[];
      if (!cards.some((c) => !isStackOntoLargeCard(c.cardId) && c.stackedCards?.some((s) => isStackOntoLargeCard(s.cardId)))) continue;
      patched[zone] = cards.map((c) => {
        if (isStackOntoLargeCard(c.cardId)) return c;
        const mine = (c.stackedCards ?? []).filter((s) => isStackOntoLargeCard(s.cardId));
        if (mine.length === 0) return c;
        freed.push(...mine.map(strip));
        const others = (c.stackedCards ?? []).filter((s) => !isStackOntoLargeCard(s.cardId));
        const { stackedCards: _s, ...rest } = c;
        return others.length > 0 ? { ...rest, stackedCards: others } : (rest as CardInstance);
      });
    }
    if (freed.length === 0) continue;
    next = { ...next, ...updatePlayer(next, pid, { ...p, ...patched, discard: [...(patched.discard ?? p.discard), ...freed] }) };
  }
  for (const { ownerId, card } of stacked) {
    if (instanceExists(next, card.instanceId)) continue;
    const owner = next.players[ownerId];
    next = { ...next, ...updatePlayer(next, ownerId, { ...owner, discard: [...owner.discard, strip(card)] }) };
  }
  return next;
}
