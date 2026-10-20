/**
 * RS-359 デンジ犬アイシー【最後の手段】（手札からのラッシュ）
 * 「これが自軍ラッシュエリアにある間、自分がOTのLユニットをラッシュするとき、これを捨札にして次の効果を発動できる⇒
 *  自軍山札から、そのLユニットの追加条件を満たすために必要なユニットのカードを1枚選び捨札にすれば、
 *  必要なユニットの1体を捨札にしたことにできる。その後、山札をシャッフルする。」（atwiki/page-549）
 *
 * - 2体あればそれぞれ使える（grnrngr/faq-card-6 RS-359 Q1: アイシー2体でバイオジェット1号・2号を1枚ずつ）。
 * - ラッシュエリアから捨札にするのと同じユニットのカードを山札から選んでも、足りないユニットは補えない（同 Q2）。
 * - 効果でラッシュするとき（RS-249 Vコマンダー等）は rules/effectRush.ts で扱う。
 *
 * 実装: 追加条件（「自軍「X」1体を捨札にする」・合体ユニットを捨札にする）を満たす手続きの間だけ、山札の候補のカードを
 * ラッシュエリアに置いた状態（icyPhantomDeckIndex 付き）で通常の追加条件の手続き（素材の選択・支払い・ラッシュ）を行う。
 * 手続きが終わったら（settleIcyPhantoms）、素材として捨札になった候補1枚につきアイシーを1体捨札にして山札をシャッフルし、
 * 選ばれなかった候補は山札の元の位置に戻す。
 */
import { getZordCondition, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { GameAction } from "../../types/actions";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { cardCategories, getDefinition, unitSizeOf } from "../../core/catalog";
import { updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import { shuffleCards } from "../errataCardEffects";
import { hasAllRequiredFusionMaterials, isValidZordUpMaterial, requiresAllFusionPartners } from "../zord";

const ICY_CARD_ID = "RS-359";
const ICY_CONDITIONS = new Set(["discard_named_unit", "discard_fusion_unit"]);

function isPhantom(card: CardInstance): boolean {
  return card.icyPhantomDeckIndex !== undefined;
}

function icyIds(player: PlayerState): string[] {
  return player.rush.filter((c) => c.cardId === ICY_CARD_ID && !isPhantom(c)).map((c) => c.instanceId);
}

/** 手札のこのカードのラッシュに【最後の手段】を使えるか（OT の L ユニットで、追加条件が「捨札にする」ユニット）。 */
function icyRushApplies(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const def = getDefinition(state.definitions, card.cardId);
  if (!def || def.type !== "unit" || unitSizeOf(state.definitions, card) !== "L" || !cardCategories(def).includes("OT")) return false;
  const conditionId = resolveRushAdditionalCondition(card.cardId, def)?.conditionId ?? getZordCondition(card.cardId);
  if (!conditionId || !ICY_CONDITIONS.has(conditionId)) return false;
  return icyIds(state.players[playerId]).length > 0;
}

function withPhantoms(player: PlayerState, deckIndexes: number[]): PlayerState {
  const set = new Set(deckIndexes);
  const phantoms = deckIndexes.map((i) => ({ ...player.deck[i]!, icyPhantomDeckIndex: i }));
  return {
    ...player,
    deck: player.deck.filter((_, i) => !set.has(i)),
    rush: [...player.rush, ...phantoms],
  };
}

function combinations(items: number[], k: number, limit = 200): number[][] {
  const out: number[][] = [];
  const walk = (start: number, acc: number[]) => {
    if (out.length >= limit) return;
    if (acc.length === k) {
      out.push(acc);
      return;
    }
    for (let i = start; i < items.length; i += 1) walk(i + 1, [...acc, items[i]!]);
  };
  walk(0, []);
  return out;
}

/**
 * 【最後の手段】を使うときの状態（山札の候補をラッシュエリアに置いた状態）。使えなければ null。
 * - 「自軍「X」1体」: 候補のカード（同じカードは1枚）をすべて置く（素材として選べるのは1枚）。
 * - 合体ユニット: アイシーの数まで、合体ユニットがそろう最少の組み合わせを置く（場のユニットを優先）。
 */
export function withIcyPhantoms(state: GameState, playerId: PlayerId, zordInstanceId: string): GameState | null {
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === zordInstanceId);
  if (!card || !icyRushApplies(state, playerId, card)) return null;
  if (player.rush.some(isPhantom)) return null;
  const seen = new Set<string>();
  const candidates: number[] = [];
  player.deck.forEach((c, i) => {
    if (seen.has(c.cardId)) return;
    if (!isValidZordUpMaterial(state.definitions, card.cardId, card.instanceId, c)) return;
    seen.add(c.cardId);
    candidates.push(i);
  });
  if (candidates.length === 0) return null;
  const icyCount = icyIds(player).length;
  let chosen: number[] | null = null;
  if (requiresAllFusionPartners(card.cardId)) {
    for (let k = 1; k <= Math.min(icyCount, candidates.length) && !chosen; k += 1) {
      for (const combo of combinations(candidates, k)) {
        const virtual = withPhantoms(player, combo);
        if (hasAllRequiredFusionMaterials(virtual, state.definitions, card.cardId, card.instanceId)) {
          chosen = combo;
          break;
        }
      }
    }
  } else {
    chosen = candidates;
  }
  if (!chosen) return null;
  return { ...state, ...updatePlayer(state, playerId, withPhantoms(player, chosen)) };
}

/** 手札のユニットのラッシュを始めるアクションの対象（begin_zord_setup・カテゴリの支払い・rush）。 */
function rushStartTarget(action: GameAction): string | null {
  if (action.type === "begin_zord_setup") return action.zordInstanceId;
  if (action.type === "initiate_command_payment" && action.kind === "category_use") return action.sourceInstanceId;
  if (action.type === "rush") return action.instanceId;
  return null;
}

/**
 * このアクションを【最後の手段】を使う状態で行うなら、その状態を返す。
 * begin_zord_setup は（場の素材でもラッシュできるときも）候補を加えた状態で始める（素材の選択でアイシーを使うか選べる）。
 * それ以外は、そのままでは行えず候補を加えれば行えるときだけ。
 */
export function icyStateForAction(
  state: GameState,
  action: GameAction,
  isLegal: (s: GameState, a: GameAction) => boolean,
): GameState | null {
  if (state.phase !== "rush" || state.pendingZordSetup || state.pendingCommandPayment) return null;
  const target = rushStartTarget(action);
  if (!target) return null;
  const virtual = withIcyPhantoms(state, action.playerId, target);
  if (!virtual || !isLegal(virtual, action)) return null;
  if (action.type !== "begin_zord_setup" && isLegal(state, action)) return null;
  return virtual;
}

/**
 * 【最後の手段】で置いた候補のアクションを、通常の合法手に加える（同じアクションがなければ）。
 * collect は与えた状態の、そのカードのラッシュを始める合法手を返す。
 */
export function appendIcyRushActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  collect: (s: GameState) => GameAction[],
): void {
  if (state.phase !== "rush" || state.pendingZordSetup || state.pendingCommandPayment) return;
  const player = state.players[playerId];
  if (icyIds(player).length === 0) return;
  const key = (a: GameAction) => JSON.stringify(a);
  const existing = new Set(actions.map(key));
  for (const card of player.hand) {
    const virtual = withIcyPhantoms(state, playerId, card.instanceId);
    if (!virtual) continue;
    for (const a of collect(virtual)) {
      if (rushStartTarget(a) !== card.instanceId || a.playerId !== playerId) continue;
      const k = key(a);
      if (existing.has(k)) continue;
      existing.add(k);
      actions.push(a);
    }
  }
}

/**
 * ラッシュの手続きが終わったら（追加条件の手続き・支払いの途中でなければ）、候補を片付ける:
 * 素材として捨札になった候補1枚につきアイシーを1体捨札にし、山札をシャッフルする。選ばれなかった候補は山札の元の位置に戻す。
 */
export function settleIcyPhantoms(state: GameState): GameState {
  if (state.pendingZordSetup || state.pendingCommandPayment) return state;
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    const player = next.players[pid];
    const zones = ["rush", "battle", "discard", "command", "power", "hand"] as const;
    if (!zones.some((z) => player[z].some(isPhantom))) continue;
    const strip = (c: CardInstance): CardInstance => {
      const { icyPhantomDeckIndex: _i, ...rest } = c;
      return rest as CardInstance;
    };
    // 選ばれなかった候補（ラッシュエリアに残ったもの）を山札の元の位置に戻す。
    const unused = [...player.rush, ...player.battle].filter(isPhantom).sort((a, b) => a.icyPhantomDeckIndex! - b.icyPhantomDeckIndex!);
    const deck = [...player.deck];
    for (const c of unused) deck.splice(Math.min(c.icyPhantomDeckIndex!, deck.length), 0, strip(c));
    // 素材として場を離れた候補（捨札にしたことにした）。
    const used = (["discard", "command", "power", "hand"] as const).reduce((n, z) => n + player[z].filter(isPhantom).length, 0);
    let rush = player.rush.filter((c) => !isPhantom(c));
    const discard = player.discard.map((c) => (isPhantom(c) ? strip(c) : c));
    const icys = rush.filter((c) => c.cardId === ICY_CARD_ID).slice(0, used);
    const icySet = new Set(icys.map((c) => c.instanceId));
    rush = rush.filter((c) => !icySet.has(c.instanceId));
    const updated: PlayerState = {
      ...player,
      rush,
      battle: player.battle.filter((c) => !isPhantom(c)),
      deck: used > 0 ? shuffleCards(deck) : deck,
      discard: [...discard, ...icys.map(strip)],
      command: player.command.map((c) => (isPhantom(c) ? strip(c) : c)),
      power: player.power.map((c) => (isPhantom(c) ? strip(c) : c)),
      hand: player.hand.map((c) => (isPhantom(c) ? strip(c) : c)),
    };
    next = { ...next, ...updatePlayer(next, pid, updated) };
    if (used > 0) {
      next = { ...next, log: [...next.log, buildLogEntry(pid, "named_effect", ICY_CARD_ID, next.definitions, `last_resort:${used}`)] };
    }
  }
  return next;
}

/** 【最後の手段】の手続き中の候補（効果ラッシュ等の「新しく場に出た」扱いから外す）。 */
export function isIcyPhantom(card: CardInstance): boolean {
  return isPhantom(card);
}
