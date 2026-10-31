/**
 * クロスギャザー ザ・ギガンティックタイタン XG6-045〜XG6-065（テディ〜サブマシーン）のカード固有の効果（cardSpec XG6-045-065 の監査）。
 *
 * DSL の grant_keyword（`xg6::XG6-NNN::name`）から呼ばれる効果と、ほかの処理の場所から呼ばれる効果:
 * - `xg6TeddyComboOnEntry`: XG6-045 の※（テディからコンビネーションする NEW電王SF の RC。rules/battleEntry.ts）。
 * - `openXg6OnHandRush`: XG6-046【ゲキジョウバン】（手札からラッシュしたとき。rules/onRushUnitEffects.ts）。
 * - `applyXg6OnBattleStart`: XG6-051【人間への絶望】（バトルするとき。core/applyAction.ts のアタックの宣言）。
 * - `openXg6OnCharged`: XG6-060 の※（コマンドゾーンに置かれたとき。core/applyAction.ts の charge_command）。
 * - `syncXg6ArkSize`: XG6-053 の※（L ユニットになる。rules/xg6/xg6bEffects.ts の後処理から）。
 * - 起動（rules/xg6/xg6Common.ts の XG6_ACTIVATIONS）: XG6-047（捨札から）・XG6-048【鏡像の戦士】（手札・捨札から）・
 *   XG6-061【ベンダーモード】・XG6-064【要塞能力】。
 * - ターンを終えるとき（XG6_TURN_END）: XG6-046 で出したユニットの捨札・XG6-062【グラビトン攻撃】。
 * - 場を離れたとき（XG6_UNIT_LEFT）: XG6-062 の※。
 * 継続効果（BP・SP・アタックの制限・コマンドのカテゴリ）は rules/xg6/xg6Fields.ts。
 */
import { openDeckLook } from "../deckLook";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { cardCategories, effectiveBp, effectiveCommandCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { countAvailablePower } from "../../core/power";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { applyDamageToPlayer } from "../damagePayment";
import { recordReveal } from "../revealNotice";
import { openEffectChoice } from "../pendingChoices";
import { resolveRidingComboOnRideOff } from "../ridingComboEffects";
import { sendFieldCardsToCommandHeld } from "../fieldLeaveQueue";
import { RIDE_OFF_RC_MARK } from "../legend1/set7NamedEffectsD";
import {
  close,
  confirmChoice,
  ctxBase,
  destroyAll,
  fieldCards,
  fieldUnits,
  findField,
  genericPick,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  proceed,
  selectableEnemy,
  shuffleDeck,
  simpleSkip,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import {
  CHOICE_CONFIRMERS,
  CHOICE_RESOLVERS,
  CHOICE_SKIPPERS,
  XG6_ACTIVATIONS,
  XG6_DONE,
  XG6_KEYWORDS,
  XG6_TURN_END,
  XG6_UNIT_LEFT,
  costNumber,
  finish,
  isCard,
  nextMultiPick,
  noop,
  setHeld,
  skipped,
} from "./xg6Common";
import { XG6_CANDROID_RULE_ID, addXg6Mark, hasXg6Mark, xg6ArkIsLarge, xg6TeddyCombo } from "./xg6Fields";
import { choice, def, isUnitDef, relocateFieldUnit, turnPlayer } from "./xg6aEffects";

type Outcome = { state: GameState; log?: string };

function isSmall(state: GameState, card: CardInstance): boolean {
  return unitSizeOf(state.definitions, card) === "S";
}

function features(state: GameState, cardId: string): string[] {
  return def(state, cardId)?.features ?? [];
}

function cats(state: GameState, cardId: string): string[] {
  return cardCategories(def(state, cardId)) as string[];
}

/** 自軍ラッシュフェイズ中で、ほかの処理が進んでいないとき（起動できるとき）。 */
function ownRushIdle(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== "rush" || state.activePlayer !== playerId || turnPlayer(state) !== playerId) return false;
  return !(state.pendingEffectChoice || state.pendingRush || state.pendingLeave || state.pendingZordSetup || state.pendingCommandPayment || state.pendingBattle);
}

/** 必要パワーの数字の大きい順（同じなら今の並び）。 */
function byCostDesc(state: GameState, cards: CardInstance[]): CardInstance[] {
  return cards.map((c, i) => ({ c, i })).sort((a, b) => costNumber(state, b.c.cardId) - costNumber(state, a.c.cardId) || a.i - b.i).map((x) => x.c);
}

function hasMorph(state: GameState, cardId: string): boolean {
  const d = def(state, cardId);
  return /※モーフ/.test(d?.text ?? "") || ((d as { keywords?: string[] } | undefined)?.keywords ?? []).some((k) => k.toLowerCase() === "morph");
}

function markRc(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, activatedNcEffects: [...(c.activatedNcEffects ?? []), RIDE_OFF_RC_MARK] } : c)),
  }));
}

/** 出したユニットを、ライドオフした直後のユニットとして RC の効果を発動する。 */
function fireRc(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const unit = findField(state, playerId, instanceId);
  if (!unit) return state;
  const rc = resolveRidingComboOnRideOff(state, playerId, unit);
  return { ...rc.state, log: [...rc.state.log, ...rc.logs] };
}

/** 場のユニットを、選んだユニットとその位置で置き換える（XG6-055）。self は手札へ。 */
function replaceFromHand(state: GameState, playerId: PlayerId, selfId: string, pickedId: string, phasePlayerId: PlayerId): GameState | null {
  const zone = zoneOfField(state, playerId, selfId);
  const picked = state.players[playerId].hand.find((c) => c.instanceId === pickedId);
  if (!zone || !picked) return null;
  const index = state.players[playerId][zone].findIndex((c) => c.instanceId === selfId);
  let next = patchPlayer(state, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== pickedId) }));
  next = moveFieldUnit(next, playerId, selfId, phasePlayerId, "hand");
  const entered = stripForZone(picked);
  return patchPlayer(next, playerId, (p) => {
    const cards = [...p[zone]];
    cards.splice(Math.min(index, cards.length), 0, entered);
    return { ...p, [zone]: cards };
  });
}

// ---------------------------------------------------------------------------
// XG6-045 テディ
// ※「このユニットからコンビネーションする「仮面ライダーNEW電王SF」は、ナンバーにRCを持っていればライドオフしなくてもその効果を発動できる。」
//  （BP+2000 は rules/xg6/xg6Fields.ts）。バトルエリアでテディの次に並んだ XG6-044 がライドせずに出たとき RC を発動する
//  （RM-045 ガンギブソンと同じ形。ライドしたままの進入は RC がもともと発動しない並び）。
// 【危険の排除】「これをラッシュしたとき、自軍山札の上から1枚を見て、そのカードを自軍パワーゾーンのオモテ向きのカード1枚と置き換えるか、
//  山札の上に戻す。」（atwiki/page-2305）。置き換えたパワーは山札の上へ。置き換えないことを選べる（見送り＝山札の上に戻す）。

export function xg6TeddyComboOnEntry(state: GameState, playerId: PlayerId, instanceId: string): GameState | null {
  const unit = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  if (!unit || def(state, unit.cardId)?.comboNumber !== "RC") return null;
  if ((unit.activatedNcEffects ?? []).includes(RIDE_OFF_RC_MARK)) return null;
  if (!xg6TeddyCombo(state, playerId, instanceId)) return null;
  return fireRc(markRc(state, playerId, instanceId), playerId, instanceId);
}

const DANGER = "xg6045_danger";

function applyDanger(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const top = state.players[ctx.playerId].deck[0];
  if (!top) return { state, detail: "xg6045:empty_deck" };
  const ids = state.players[ctx.playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6045:no_power" };
  return { state: openAfter(state, { ...choice(ctxBase(ctx), "XG6-045", DANGER, "select_power", ids, true), xg6Meta: { ids: [top.instanceId] } }), detail: DANGER };
}

CHOICE_RESOLVERS[DANGER] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const topId = pending.xg6Meta?.ids?.[0];
  return finish(state, pending, `swap:${instanceId}`, (s) =>
    patchPlayer(s, playerId, (p) => {
      const top = p.deck[0];
      const power = p.power.find((c) => c.instanceId === instanceId);
      if (!top || top.instanceId !== topId || !power) return p;
      return {
        ...p,
        deck: [stripForZone(power), ...p.deck.slice(1)],
        power: p.power.map((c) => (c.instanceId === instanceId ? stripForZone(top) : c)),
      };
    }),
  );
};
CHOICE_SKIPPERS[DANGER] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-046 仮面ライダーディエンドCF【ゲキジョウバン】
// 「これを手札からラッシュした時、自軍山札の上から8枚までオモテにして､その中から特徴｢仮面ライダー｣を持つDAのユニットカードを自軍ラッシュエリアに
//  出してもよい。ただし、同名のカードは2枚以上出せない。その後、残りのカードを山札に戻してシャッフルする。この効果で出したユニットは、このターン、
//  ストライクできず、このターンを終えるとき、自軍エリアにあれば捨札になる。」（atwiki/page-2314）
// 「8枚まで」は8枚（山札が少なければすべて）。出すカードを1枚ずつ選び、選び終える。出すのはラッシュではない。

const GEKIJOUBAN = "xg6046_gekijouban";

function gekijoubanCandidates(state: GameState, playerId: PlayerId, shownIds: string[], picked: string[]): string[] {
  const deck = state.players[playerId].deck;
  const pickedNames = picked.map((id) => def(state, deck.find((c) => c.instanceId === id)?.cardId ?? "")?.name);
  return deck
    .filter((c) => shownIds.includes(c.instanceId) && !picked.includes(c.instanceId))
    .filter((c) => isUnitDef(state, c.cardId) && features(state, c.cardId).includes("仮面ライダー") && cats(state, c.cardId).includes("DA"))
    .filter((c) => !pickedNames.includes(def(state, c.cardId)?.name))
    .map((c) => c.instanceId);
}

export function openXg6OnHandRush(state: GameState, playerId: PlayerId, instanceId: string, phasePlayerId: PlayerId): GameState {
  const self = findField(state, playerId, instanceId);
  if (!self || !isCard(self.cardId, "XG6-046")) return state;
  const shown = state.players[playerId].deck.slice(0, 8);
  if (shown.length === 0) return state;
  let next = recordReveal(state, { playerId, ownerId: playerId, sourceCardId: "XG6-046", effectLabel: "ゲキジョウバン", cards: shown.map(stripForZone) } as never);
  const shownIds = shown.map((c) => c.instanceId);
  const ids = gekijoubanCandidates(next, playerId, shownIds, []);
  if (ids.length === 0) return shuffleDeck(next, playerId);
  next = openAfter(next, { ...choice({ playerId, phasePlayerId, sourceInstanceId: instanceId }, "XG6-046", GEKIJOUBAN, "select_hand", ids, true), xg6Meta: { ids: shownIds } });
  return next;
}

function finishGekijouban(state: GameState, pending: PendingEffectChoice, picked: string[]): Outcome {
  const playerId = pending.playerId;
  return finish(state, pending, `rush:${picked.length}`, (s) => {
    let next = patchPlayer(s, playerId, (p) => ({
      ...p,
      deck: p.deck.filter((c) => !picked.includes(c.instanceId)),
      rush: [...p.rush, ...p.deck.filter((c) => picked.includes(c.instanceId)).map(stripForZone)],
    }));
    for (const id of picked) next = addXg6Mark(next, { key: "XG6-046:summoned", playerId, instanceId: id });
    return shuffleDeck(next, playerId);
  });
}

CHOICE_RESOLVERS[GEKIJOUBAN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const picked = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = gekijoubanCandidates(state, playerId, pending.xg6Meta?.ids ?? [], picked);
  if (rest.length === 0) return finishGekijouban(state, pending, picked);
  return {
    state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: picked, validInstanceIds: [XG6_DONE, ...rest], optional: true, mayConfirm: true } },
    log: logFor(state, playerId, "XG6-046", `${GEKIJOUBAN}:${instanceId}`),
  };
};
CHOICE_CONFIRMERS[GEKIJOUBAN] = (state) => finishGekijouban(state, state.pendingEffectChoice!, state.pendingEffectChoice!.selectedInstanceIds ?? []);
CHOICE_SKIPPERS[GEKIJOUBAN] = (state) => finishGekijouban(state, state.pendingEffectChoice!, state.pendingEffectChoice!.selectedInstanceIds ?? []);

/** XG6-046 で出したユニット（このターン、ストライクできない）。 */
export function xg6SummonedNoStrike(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return hasXg6Mark(state, "XG6-046:summoned", playerId, instanceId);
}

XG6_TURN_END.push({
  collect: (state, endingPlayerId) =>
    (state.xg6?.marks ?? [])
      .filter((m) => m.key === "XG6-046:summoned" && m.turn === state.turn && m.instanceId && findField(state, m.playerId, m.instanceId))
      .map((m) => `gekijouban:${m.playerId}:${m.instanceId}`)
      .concat(fieldUnits(state, endingPlayerId).filter((c) => isCard(c.cardId, "XG6-062")).map((c) => `graviton:${endingPlayerId}:${c.instanceId}`)),
  open: (state, endingPlayerId, entry) => {
    const [kind, owner, ...rest] = entry.split(":");
    const id = rest.join(":");
    const ownerId = owner as PlayerId;
    if (kind === "gekijouban") {
      if (!findField(state, ownerId, id)) return state;
      return moveFieldUnit(state, ownerId, id, endingPlayerId, "discard");
    }
    if (kind === "graviton") return openGraviton(state, ownerId, id, endingPlayerId);
    return null;
  },
});

// ---------------------------------------------------------------------------
// XG6-047 仮面ライダーG4
// ※「これが自軍捨札にある間、自軍ラッシュフェイズ中、自軍コマンドを1つゲームから除外してから、これを自軍ラッシュエリアに出してもよい。」
//  （捨札のこれから起動する。出すのはラッシュではない）
// 【ギガント】「これをラッシュしたとき、特徴「仮面ライダー」を持つ敵軍ユニットを1体選び撃破する。」（エリアを問わない。atwiki/page-2290）

const G4_EXILE = "xg6047_exile_command";
const GIGANTO = "xg6047_giganto";

XG6_ACTIVATIONS.push({
  list: (state, playerId) => {
    if (!ownRushIdle(state, playerId) || state.players[playerId].command.length === 0) return [];
    return state.players[playerId].discard.filter((c) => isCard(c.cardId, "XG6-047")).map((c) => c.instanceId);
  },
  activate: (state, playerId, instanceId) => {
    const ids = state.players[playerId].command.map((c) => c.instanceId);
    return openEffectChoice(state, choice({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG6-047", G4_EXILE, "select_command", ids, false));
  },
});

CHOICE_RESOLVERS[G4_EXILE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  return finish(state, pending, instanceId, (s) =>
    patchPlayer(s, playerId, (p) => {
      const cmd = p.command.find((c) => c.instanceId === instanceId);
      const self = p.discard.find((c) => c.instanceId === selfId);
      if (!cmd || !self) return p;
      return {
        ...p,
        command: p.command.filter((c) => c !== cmd),
        exile: [...(p.exile ?? []), stripForZone(cmd)],
        discard: p.discard.filter((c) => c !== self),
        rush: [...p.rush, stripForZone(self)],
      };
    }),
  );
};

function applyGiganto(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => unitFeatures(state, enemyId, c).includes("仮面ライダー") && selectableEnemy(state, ctx.playerId, "XG6-047", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6047:no_target" };
  return { state: openAfter(state, genericPick(ctxBase(ctx), "XG6-047", GIGANTO, ids, false, "discard")), detail: GIGANTO };
}

// ---------------------------------------------------------------------------
// XG6-048 仮面ライダーリュウガ【鏡像の戦士】
// 「これが自分の手札か自軍捨札にある間、自軍ラッシュフェイズごとに1度だけ、自軍常駐置き場にあるカードを1枚選び捨札にしてよい。そうしたとき、
//  これを自軍ラッシュエリアに出す。」（atwiki/page-2309）。手札・捨札のこれから起動する（このターンの記録で1度だけ）。
// 常駐に重ねたカードも「常駐置き場にあるカード」として選べる（atwiki/page-2340 カード評価「効果のコストに充てるカードは常駐オペレーションそのもので
// なくてもよい」。仮面ライダー凍鬼【音撃殴・一撃怒涛】の数え方と同じ）。常駐オペレーションそのものを選んだら、重ねたカードも一緒に捨札になる。

const MIRROR = "xg6048_mirror";

/** 自軍常駐置き場のカード（常駐オペレーションと、その上に重ねたカード）。 */
function residentZoneIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].operation.flatMap((op) => [op.instanceId, ...(op.stackedCards ?? []).map((c) => c.instanceId)]);
}

XG6_ACTIVATIONS.push({
  list: (state, playerId) => {
    const p = state.players[playerId];
    if (!ownRushIdle(state, playerId) || p.operation.length === 0) return [];
    return [...p.hand, ...p.discard].filter((c) => isCard(c.cardId, "XG6-048") && !hasXg6Mark(state, "XG6-048:used", playerId, c.instanceId)).map((c) => c.instanceId);
  },
  activate: (state, playerId, instanceId) => {
    const ids = residentZoneIds(state, playerId);
    const marked = addXg6Mark(state, { key: "XG6-048:used", playerId, instanceId });
    return openEffectChoice(marked, choice({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG6-048", MIRROR, "select_hand", ids, true));
  },
});

CHOICE_RESOLVERS[MIRROR] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  return finish(state, pending, instanceId, (s) =>
    patchPlayer(s, playerId, (p) => {
      const self = [...p.hand, ...p.discard].find((c) => c.instanceId === selfId);
      if (!self) return p;
      const res = p.operation.find((c) => c.instanceId === instanceId);
      // 常駐オペレーションそのもの: 重ねたカードも捨札へ。重ねたカード: その1枚だけを捨札へ。
      const host = res ? undefined : p.operation.find((op) => (op.stackedCards ?? []).some((c) => c.instanceId === instanceId));
      if (!res && !host) return p;
      const toDiscard = res ? [res, ...(res.stackedCards ?? [])] : (host!.stackedCards ?? []).filter((c) => c.instanceId === instanceId);
      const operation = res
        ? p.operation.filter((c) => c !== res)
        : p.operation.map((op) => (op === host ? { ...op, stackedCards: (op.stackedCards ?? []).filter((c) => c.instanceId !== instanceId) } : op));
      return {
        ...p,
        operation,
        hand: p.hand.filter((c) => c !== self),
        discard: [...p.discard.filter((c) => c !== self), ...toDiscard.map(stripForZone)],
        rush: [...p.rush, stripForZone(self)],
      };
    }),
  );
};
CHOICE_SKIPPERS[MIRROR] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-049 仮面ライダーオーガ NC【オルフェノクの帝王】
// 「自分の手札を1枚選び自軍コマンドゾーンにホールド状態で置いてもよい。そうしたとき、そのカードの必要パワーの数字以下の必要パワーを持つ敵軍
//  バトルエリアのSユニットを好きな数選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-2307）
// 自軍コマンドゾーンに空きがなければ手札を置けない。敵軍ユニットは必要パワーの数字の大きい順に並べる。

const ORPHNOCH_HAND = "xg6049_orphnoch_hand";
const ORPHNOCH_TARGET = "xg6049_orphnoch_target";

function applyOrphnoch(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const p = state.players[ctx.playerId];
  if (p.hand.length === 0 || p.command.length >= COMMAND_ZONE_MAX) return { state, detail: "xg6049:no_hand" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-049", ORPHNOCH_HAND, "select_hand", p.hand.map((c) => c.instanceId), true)), detail: ORPHNOCH_HAND };
}

function orphnochTargets(state: GameState, playerId: PlayerId, limit: number, picked: string[]): string[] {
  const enemyId = opponent(playerId);
  return byCostDesc(
    state,
    state.players[enemyId].battle.filter(
      (c) => isUnitDef(state, c.cardId) && isSmall(state, c) && costNumber(state, c.cardId) <= limit && !picked.includes(c.instanceId) && selectableEnemy(state, playerId, "XG6-049", c),
    ),
  ).map((c) => c.instanceId);
}

CHOICE_RESOLVERS[ORPHNOCH_HAND] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId)!;
  const limit = costNumber(state, card.cardId);
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    command: [...p.command, { ...stripForZone(card), commandHeld: true }],
  }));
  const log = logFor(state, playerId, "XG6-049", `${ORPHNOCH_HAND}:${instanceId}`);
  const ids = orphnochTargets(next, playerId, limit, []);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, { ...choice(pendingBase(pending), "XG6-049", ORPHNOCH_TARGET, "select_unit", ids, true), xg6Meta: { limit } }), log };
};
CHOICE_SKIPPERS[ORPHNOCH_HAND] = simpleSkip();

function finishOrphnoch(state: GameState, pending: PendingEffectChoice, ids: string[]): Outcome {
  return finish(state, pending, `command:${ids.length}`, (s) => (ids.length > 0 ? sendFieldCardsToCommandHeld(s, opponent(pending.playerId), ids, pending.phasePlayerId) : s));
}

CHOICE_RESOLVERS[ORPHNOCH_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const picked = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = orphnochTargets(state, playerId, pending.xg6Meta?.limit ?? 0, picked);
  if (rest.length === 0) return finishOrphnoch(state, pending, picked);
  return {
    state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: picked, validInstanceIds: [XG6_DONE, ...rest], optional: true, mayConfirm: true } },
    log: logFor(state, playerId, "XG6-049", `${ORPHNOCH_TARGET}:${instanceId}`),
  };
};
CHOICE_CONFIRMERS[ORPHNOCH_TARGET] = (state) => finishOrphnoch(state, state.pendingEffectChoice!, state.pendingEffectChoice!.selectedInstanceIds ?? []);
CHOICE_SKIPPERS[ORPHNOCH_TARGET] = (state) => finishOrphnoch(state, state.pendingEffectChoice!, state.pendingEffectChoice!.selectedInstanceIds ?? []);

// ---------------------------------------------------------------------------
// XG6-050 仮面ライダーグレイブ NC【試させてもらいますよ】
// 「「SP1」お互いの手札が1枚以上あれば、次の効果を発動できる⇒自分の手札を1～3枚選び相手に見せてから、その必要パワーの数字を合計する。そうしたとき、
//  相手も同じようにして、合計した数字が低い方に1点ダメージを与える。」（atwiki/page-2312）。同じ合計ならどちらにも与えない。

const TRY_CONFIRM = "xg6050_try";
const TRY_PICK = "xg6050_try_pick";

function applyTry(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  if (state.players[ctx.playerId].hand.length === 0 || state.players[enemyId].hand.length === 0) return { state, detail: "xg6050:no_hand" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG6-050", TRY_CONFIRM)), detail: TRY_CONFIRM };
}

function tryPick(state: GameState, pending: PendingEffectChoice, chooser: PlayerId, ownerSum?: number): PendingEffectChoice {
  return {
    ...choice({ ...pendingBase(pending), playerId: chooser }, "XG6-050", TRY_PICK, "select_hand", state.players[chooser].hand.map((c) => c.instanceId), false),
    selectedInstanceIds: [],
    xg6Meta: { targetPlayerId: pending.playerId, limit: ownerSum, step: ownerSum === undefined ? "owner" : "opponent" },
  };
}

CHOICE_RESOLVERS[TRY_CONFIRM] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[TRY_CONFIRM] = simpleSkip();
CHOICE_CONFIRMERS[TRY_CONFIRM] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: openNext(close(state, pending), pending, tryPick(state, pending, playerId)), log: logFor(state, playerId, "XG6-050", `${TRY_CONFIRM}:yes`) };
};

function finishTryPick(state: GameState, pending: PendingEffectChoice, ids: string[]): Outcome {
  const chooser = pending.playerId;
  const owner = pending.xg6Meta?.targetPlayerId ?? chooser;
  const shown = state.players[chooser].hand.filter((c) => ids.includes(c.instanceId));
  const sum = shown.reduce((n, c) => n + costNumber(state, c.cardId), 0);
  let next = recordReveal(close(state, pending), { playerId: chooser, ownerId: chooser, sourceCardId: "XG6-050", effectLabel: "試させてもらいますよ", cards: shown.map(stripForZone) } as never);
  const log = logFor(state, chooser, "XG6-050", `${TRY_PICK}:sum:${sum}`);
  if (pending.xg6Meta?.step === "owner") {
    return { state: openNext(next, pending, { ...tryPick(next, pending, opponent(owner), sum), playerId: opponent(owner) }), log };
  }
  const ownerSum = pending.xg6Meta?.limit ?? 0;
  if (ownerSum !== sum) {
    const loser = ownerSum < sum ? owner : opponent(owner);
    next = applyDamageToPlayer(next, loser, 1, { kind: "none", activePlayer: next.activePlayer });
  }
  return { state: proceed({ ...next, activePlayer: pending.phasePlayerId }, pending), log };
}

CHOICE_RESOLVERS[TRY_PICK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const more = nextMultiPick(pending, instanceId, state.players[playerId].hand.map((c) => c.instanceId), 3);
  if (more) return { state: { ...state, pendingEffectChoice: more }, log: logFor(state, playerId, "XG6-050", `${TRY_PICK}:${instanceId}`) };
  return finishTryPick(state, pending, [...(pending.selectedInstanceIds ?? []), instanceId]);
};
CHOICE_CONFIRMERS[TRY_PICK] = (state) => finishTryPick(state, state.pendingEffectChoice!, state.pendingEffectChoice!.selectedInstanceIds ?? []);
CHOICE_SKIPPERS[TRY_PICK] = (state) => finishTryPick(state, state.pendingEffectChoice!, state.pendingEffectChoice!.selectedInstanceIds ?? []);

// ---------------------------------------------------------------------------
// XG6-051 仮面ライダー歌舞鬼【人間への絶望】「これが特徴「男」または「女」を持つ敵軍ユニットとバトルするとき、これをリリースする。」（atwiki/page-2300）
// アタックの宣言（バトルの前）にリリースする（その後のバトルで負ければレジストを使える。カード評価）。

export function applyXg6OnBattleStart(state: GameState, battle: PendingBattle): GameState {
  let next = state;
  const sides: Array<[PlayerId, string, PlayerId, string]> = [
    [battle.attackerPlayerId, battle.attackerInstanceId, battle.defenderPlayerId, battle.defenderInstanceId],
    [battle.defenderPlayerId, battle.defenderInstanceId, battle.attackerPlayerId, battle.attackerInstanceId],
  ];
  for (const [selfPid, selfId, oppPid, oppId] of sides) {
    const self = findField(next, selfPid, selfId);
    const opp = findField(next, oppPid, oppId);
    if (!self || !opp || !isCard(self.cardId, "XG6-051") || !self.commandHeld) continue;
    const f = unitFeatures(next, oppPid, opp);
    if (f.includes("男") || f.includes("女")) next = setHeld(next, selfPid, selfId, false);
  }
  return next;
}

// ---------------------------------------------------------------------------
// XG6-053 仮面ライダーアーク
// ※「これ以外のユニットがSユニットだけなら、これはLユニットになり、BP+2000される。」（サイズは行動の後に合わせる。BP は rules/xg6/xg6Fields.ts）
// 【ゴー・トゥー・ヘル！】「自軍ターン中、これがバトルエリアに出たとき、これがLユニットなら、次の効果を発動する→敵軍バトルエリアからSユニットを
//  1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-2295）

export function syncXg6ArkSize(state: GameState): GameState {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    for (const c of fieldCards(next, pid).filter((x) => isCard(x.cardId, "XG6-053"))) {
      const large = xg6ArkIsLarge(next, pid, c);
      if (large && c.sizeOverride !== "L") next = patchField(next, pid, c.instanceId, { sizeOverride: "L" });
      else if (!large && c.sizeOverride === "L") next = patchField(next, pid, c.instanceId, { sizeOverride: undefined });
    }
  }
  return next;
}

function patchField(state: GameState, playerId: PlayerId, instanceId: string, patch: Partial<CardInstance>): GameState {
  return patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === instanceId ? { ...c, ...patch } : c)),
    rush: p.rush.map((c) => (c.instanceId === instanceId ? { ...c, ...patch } : c)),
  }));
}

const GO_TO_HELL = "xg6053_go_to_hell";

function applyGoToHell(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const self = ctx.triggerSourceInstanceId ? findField(state, ctx.playerId, ctx.triggerSourceInstanceId) : undefined;
  if (!self || turnPlayer(state) !== ctx.playerId || !xg6ArkIsLarge(state, ctx.playerId, self)) return { state, detail: "xg6053:not_large" };
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle
    .filter((c) => isUnitDef(state, c.cardId) && isSmall(state, c) && selectableEnemy(state, ctx.playerId, "XG6-053", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6053:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-053", GO_TO_HELL, "select_unit", ids, false)), detail: GO_TO_HELL };
}

CHOICE_RESOLVERS[GO_TO_HELL] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, instanceId, (s) => moveFieldUnit(s, opponent(playerId), instanceId, pending.phasePlayerId, "power_damage"));
};

// ---------------------------------------------------------------------------
// XG6-054 仮面ライダースカル RC【帽子が似合う男になれ】
// 「自軍バトルエリアのSユニットを1体選び、ラッシュエリアに戻してもよい。ただし、戻したユニットはこのターン、再びバトルエリアに出ることはできない。
//  そうしたとき、このターン、このユニットのBPに戻したユニットのBPを「+」する。」（atwiki/page-2294）
// これ以外の S ユニットから選ぶ。足す BP は戻したときの BP。戻すのは場を離れることではない。

const HAT = "xg6054_hat";

function applyHat(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return { state, detail: "xg6054:no_source" };
  const ids = state.players[ctx.playerId].battle.filter((c) => c.instanceId !== selfId && isUnitDef(state, c.cardId) && isSmall(state, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6054:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-054", HAT, "select_unit", ids, true)), detail: HAT };
}

CHOICE_RESOLVERS[HAT] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const unit = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  if (!unit) return { error: "invalid_target" };
  const bp = effectiveBp(state, playerId, unit);
  return finish(state, pending, instanceId, (s) => {
    let next = patchPlayer(s, playerId, (p) => ({
      ...p,
      battle: p.battle.filter((c) => c.instanceId !== instanceId).map((c) => (c.mountedOnInstanceId === instanceId ? { ...c, mountedOnInstanceId: undefined } : c)),
      rush: [...p.rush, { ...unit, battleActed: undefined, mountedOnInstanceId: undefined }],
    }));
    next = addXg6Mark(next, { key: "XG6-054:no_entry", playerId, instanceId });
    if (pending.sourceInstanceId) next = addXg6Mark(next, { key: "XG6-054:bp", playerId, instanceId: pending.sourceInstanceId, value: bp });
    return next;
  });
};
CHOICE_SKIPPERS[HAT] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-055 仮面ライダーオーズ・タトバコンボ RC【コンボチェンジ】
// 「カード名に「タトバ」を含まない、モーフと特徴「オーズドライバー」を持つユニットカードを自分の手札から1枚選び、これと置き換えてもよい。このとき
//  出したユニットは、BP+2000され、ライドオフした直後のユニットとして扱い、RCの効果を持っていれば、その効果を発動する。」（atwiki/page-2337）
// 置き換えはモーフと同じ（選んだカードがこれの位置に出て、これは手札へ）。BP+2000 はこのターン。

const COMBO_CHANGE = "xg6055_combo_change";

function applyComboChange(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ctx.triggerSourceInstanceId) return { state, detail: "xg6055:no_source" };
  const ids = state.players[ctx.playerId].hand
    .filter((c) => isUnitDef(state, c.cardId) && !(def(state, c.cardId)?.name ?? "").normalize("NFKC").includes("タトバ") && hasMorph(state, c.cardId) && features(state, c.cardId).includes("オーズドライバー"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6055:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-055", COMBO_CHANGE, "select_hand", ids, true)), detail: COMBO_CHANGE };
}

CHOICE_RESOLVERS[COMBO_CHANGE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  let next = close(state, pending);
  const replaced = selfId ? replaceFromHand(next, playerId, selfId, instanceId, pending.phasePlayerId) : null;
  if (!replaced) return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-055", `${COMBO_CHANGE}:gone`) };
  next = addXg6Mark(replaced, { key: "XG6-055:bp", playerId, instanceId });
  next = fireRc(next, playerId, instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG6-055", `${COMBO_CHANGE}:${instanceId}`) };
};
CHOICE_SKIPPERS[COMBO_CHANGE] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-056 仮面ライダーオーズ・ガタキリバコンボ RC【忍ばせた大鎌】
// 「敵軍Ｓユニットを、ＢＰの合計がこのユニットのＢＰ以下になるように２体まで選んで撃破してもよい。そうしたとき、このターン、これはアタックする
//  ことができない。」（atwiki/page-2344）。敵軍 S ユニットはエリアを問わない。1体ずつ選び、選び終える。

const SCYTHE = "xg6056_scythe";

function scytheTargets(state: GameState, playerId: PlayerId, selfId: string, picked: string[]): string[] {
  const self = findField(state, playerId, selfId);
  if (!self) return [];
  const enemyId = opponent(playerId);
  const enemyUnits = fieldUnits(state, enemyId);
  const used = picked.reduce((n, id) => n + effectiveBp(state, enemyId, enemyUnits.find((c) => c.instanceId === id) ?? { instanceId: id, cardId: "" }), 0);
  const budget = effectiveBp(state, playerId, self) - used;
  return enemyUnits
    .filter((c) => !picked.includes(c.instanceId) && isSmall(state, c) && effectiveBp(state, enemyId, c) <= budget && selectableEnemy(state, playerId, "XG6-056", c))
    .map((c) => c.instanceId);
}

function applyScythe(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return { state, detail: "xg6056:no_source" };
  const ids = scytheTargets(state, ctx.playerId, selfId, []);
  if (ids.length === 0) return { state, detail: "xg6056:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-056", SCYTHE, "select_unit", ids, true)), detail: SCYTHE };
}

function finishScythe(state: GameState, pending: PendingEffectChoice, ids: string[]): Outcome {
  if (ids.length === 0) return skipped(state, pending);
  return finish(state, pending, `destroy:${ids.length}`, (s) => {
    const next = destroyAll(s, pendingBase(pending), "XG6-056", `${SCYTHE}_destroy`, ids);
    return pending.sourceInstanceId ? addXg6Mark(next, { key: "XG6-056:no_attack", playerId: pending.playerId, instanceId: pending.sourceInstanceId }) : next;
  });
}

CHOICE_RESOLVERS[SCYTHE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const picked = [...(pending.selectedInstanceIds ?? []), instanceId];
  const rest = picked.length >= 2 ? [] : scytheTargets(state, playerId, pending.sourceInstanceId ?? "", picked);
  if (rest.length === 0) return finishScythe(state, pending, picked);
  return {
    state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: picked, validInstanceIds: [XG6_DONE, ...rest], optional: true, mayConfirm: true } },
    log: logFor(state, playerId, "XG6-056", `${SCYTHE}:${instanceId}`),
  };
};
CHOICE_CONFIRMERS[SCYTHE] = (state) => finishScythe(state, state.pendingEffectChoice!, state.pendingEffectChoice!.selectedInstanceIds ?? []);
CHOICE_SKIPPERS[SCYTHE] = (state) => finishScythe(state, state.pendingEffectChoice!, state.pendingEffectChoice!.selectedInstanceIds ?? []);

// ---------------------------------------------------------------------------
// XG6-057 仮面ライダーオーズ・ラトラーターコンボ【トラクロー】
// 「これをラッシュしたとき、必要パワーを満たしていない敵軍ユニットまたは敵軍ビークルを1体選びゲームから除外する。」（atwiki/page-2340）
// 必要パワーの数字が、いまの敵軍パワーより大きいもの。

const TORA_CLAW = "xg6057_tora_claw";

function applyToraClaw(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const power = countAvailablePower(state, enemyId);
  const ids = fieldCards(state, enemyId)
    .filter((c) => {
      const t = def(state, c.cardId)?.type;
      return (t === "unit" || t === "vehicle") && costNumber(state, c.cardId) > power && selectableEnemy(state, ctx.playerId, "XG6-057", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6057:no_target" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-057", TORA_CLAW, "select_unit", ids, false)), detail: TORA_CLAW };
}

CHOICE_RESOLVERS[TORA_CLAW] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, instanceId, (s) => relocateFieldUnit(s, opponent(playerId), instanceId, pending.phasePlayerId, "exile"));
};

// ---------------------------------------------------------------------------
// XG6-058 仮面ライダーオーズ・タカキリバ RC【虚空より狙う鎌】
// 「自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、捨札にしたコマンドと同じカテゴリを持つ敵軍コマンドを1つ選びゲームから除外する。」
//  （atwiki/page-2297）。カテゴリは捨札にする前のコマンドのカテゴリ。

const VOID_OWN = "xg6058_void_own";
const VOID_ENEMY = "xg6058_void_enemy";

function applyVoidScythe(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = state.players[ctx.playerId].command.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6058:no_command" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-058", VOID_OWN, "select_command", ids, true)), detail: VOID_OWN };
}

CHOICE_RESOLVERS[VOID_OWN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const player = state.players[playerId];
  const cmd = player.command.find((c) => c.instanceId === instanceId)!;
  const own = effectiveCommandCategories(player, state.definitions, cmd.cardId) as string[];
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(cmd)] }));
  const enemyId = opponent(playerId);
  const enemy = next.players[enemyId];
  const ids = enemy.command.filter((c) => (effectiveCommandCategories(enemy, next.definitions, c.cardId) as string[]).some((cat) => own.includes(cat))).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG6-058", `${VOID_OWN}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, choice(pendingBase(pending), "XG6-058", VOID_ENEMY, "select_command", ids, false)), log };
};
CHOICE_SKIPPERS[VOID_OWN] = simpleSkip();
CHOICE_RESOLVERS[VOID_ENEMY] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, instanceId, (s) =>
    patchPlayer(s, opponent(playerId), (p) => {
      const cmd = p.command.find((c) => c.instanceId === instanceId);
      return cmd ? { ...p, command: p.command.filter((c) => c !== cmd), exile: [...(p.exile ?? []), stripForZone(cmd)] } : p;
    }),
  );
};

// ---------------------------------------------------------------------------
// XG6-060 タカカンドロイド（オペレーション）
// ※「これが自軍コマンドゾーンに置かれたとき、これを手札に加えてもよい。」（チャージで置いたとき）
// ◎「コマンドを１つ選び、カテゴリを１つ宣言する。そうしたとき、このターン、宣言したカテゴリを選んだコマンドに追加する。」（atwiki/page-2291）
// 両軍のコマンドから選ぶ。追加したカテゴリはコマンドの持ち主のこのターンの記録（rules/xg6/xg6Fields.ts xg6TurnCommandCategories）。

const CANDROID_HAND = "xg6060_to_hand";
const CANDROID_PICK = "xg6060_pick_command";
const CANDROID_CATEGORY = "xg6060_category";
const CATEGORIES = ["WB", "MA", "OT", "ET", "DA"];

export function openXg6OnCharged(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  const card = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  if (!card || !isCard(card.cardId, "XG6-060")) return state;
  return openAfter(state, confirmChoice({ playerId, phasePlayerId: turnPlayer(state), sourceInstanceId: instanceId }, "XG6-060", CANDROID_HAND));
}

CHOICE_RESOLVERS[CANDROID_HAND] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[CANDROID_HAND] = simpleSkip();
CHOICE_CONFIRMERS[CANDROID_HAND] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, "hand", (s) =>
    patchPlayer(s, playerId, (p) => {
      const card = p.command.find((c) => c.instanceId === pending.sourceInstanceId);
      return card ? { ...p, command: p.command.filter((c) => c !== card), hand: [...p.hand, stripForZone(card)] } : p;
    }),
  );
};

function applyCandroid(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = [...state.players.player1.command, ...state.players.player2.command].map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg6060:no_command" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-060", CANDROID_PICK, "select_command", ids, false)), detail: CANDROID_PICK };
}

CHOICE_RESOLVERS[CANDROID_PICK] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner: PlayerId = state.players.player1.command.some((c) => c.instanceId === instanceId) ? "player1" : "player2";
  const next = openNext(close(state, pending), pending, {
    ...choice(pendingBase(pending), "XG6-060", CANDROID_CATEGORY, "pick_effect_branch", CATEGORIES, false),
    xg6Meta: { ids: [instanceId], targetPlayerId: owner },
  });
  return { state: next, log: logFor(state, playerId, "XG6-060", `${CANDROID_PICK}:${instanceId}`) };
};
CHOICE_RESOLVERS[CANDROID_CATEGORY] = (state, playerId, category) => {
  const pending = state.pendingEffectChoice!;
  const owner = pending.xg6Meta?.targetPlayerId ?? playerId;
  const cmdId = pending.xg6Meta?.ids?.[0];
  const cmd = state.players[owner].command.find((c) => c.instanceId === cmdId);
  return finish(state, pending, `${cmdId}:${category}`, (s) =>
    cmd
      ? patchPlayer(s, owner, (p) => ({
          ...p,
          modifiers: [...(p.modifiers ?? []), { kind: "rule", ruleId: XG6_CANDROID_RULE_ID, scope: "turn", sourceCardId: "XG6-060", payload: { cardId: cmd.cardId, instanceId: cmd.instanceId, category } }],
        }))
      : s,
  );
};

// ---------------------------------------------------------------------------
// XG6-061 ライドベンダー【ベンダーモード】
// 「自軍ラッシュフェイズ中、このビークルを捨札にして次の効果を発動できる→自軍山札を見てオペレーションカードを1枚選び、自軍コマンドゾーンにホールド
//  状態で置く（置けなければ自軍コマンドを1つ選び、捨札にしてから置く）。その後、山札をシャッフルする。」（atwiki/page-2289）

const VENDOR = "xg6061_vendor";
const VENDOR_MAKE_ROOM = "xg6061_make_room";

XG6_ACTIVATIONS.push({
  list: (state, playerId) => (ownRushIdle(state, playerId) ? fieldCards(state, playerId).filter((c) => isCard(c.cardId, "XG6-061")).map((c) => c.instanceId) : []),
  activate: (state, playerId, instanceId) => {
    const next = moveFieldUnit(state, playerId, instanceId, playerId, "discard");
    const ids = next.players[playerId].deck.filter((c) => def(next, c.cardId)?.type === "operation").map((c) => c.instanceId);
    // 選べるカードがなくても山札を見る窓を開く（rules/deckLook.ts）。
    if (ids.length === 0) return openDeckLook(shuffleDeck(next, playerId), { playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG6-061");
    return openAfter(next, choice({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG6-061", VENDOR, "select_hand", ids, false));
  },
});

function placeVendorOp(state: GameState, playerId: PlayerId, opId: string): GameState {
  const placed = patchPlayer(state, playerId, (p) => {
    const op = p.deck.find((c) => c.instanceId === opId);
    return op ? { ...p, deck: p.deck.filter((c) => c !== op), command: [...p.command, { ...stripForZone(op), commandHeld: true }] } : p;
  });
  return shuffleDeck(placed, playerId);
}

CHOICE_RESOLVERS[VENDOR] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const command = state.players[playerId].command;
  if (command.length < COMMAND_ZONE_MAX) return finish(state, pending, instanceId, (s) => placeVendorOp(s, playerId, instanceId));
  const next = openNext(close(state, pending), pending, {
    ...choice(pendingBase(pending), "XG6-061", VENDOR_MAKE_ROOM, "select_command", command.map((c) => c.instanceId), false),
    xg6Meta: { ids: [instanceId] },
  });
  return { state: next, log: logFor(state, playerId, "XG6-061", `${VENDOR}:${instanceId}`) };
};
CHOICE_RESOLVERS[VENDOR_MAKE_ROOM] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const opId = pending.xg6Meta?.ids?.[0] ?? "";
  return finish(state, pending, instanceId, (s) => {
    const room = patchPlayer(s, playerId, (p) => {
      const cmd = p.command.find((c) => c.instanceId === instanceId);
      return cmd ? { ...p, command: p.command.filter((c) => c !== cmd), discard: [...p.discard, stripForZone(cmd)] } : p;
    });
    return placeVendorOp(room, playerId, opId);
  });
};

// ---------------------------------------------------------------------------
// XG6-062 戦闘ワンセブン
// ※「これがユニットでなくなったとき、自軍捨札から「要塞ワンセブン」のカードを１枚選び、自軍ラッシュエリアに出す。」（出すのはラッシュではない）
// 【グラビトン攻撃】「これが自軍エリアにある間、自分がターンを終えるとき、このユニットのBP以下のBPを持つ敵軍ユニットを１体選び撃破してもよい。
//  そうしたとき、このユニットを捨札にする。」（atwiki/page-2311）。敵軍ユニットはエリア・サイズを問わない。

const FORTRESS_CALL = "xg6062_fortress_call";
const GRAVITON = "xg6062_graviton";

XG6_UNIT_LEFT.push((state, event) => {
  if (!isCard(event.cardId, "XG6-062") || (event.fromZone !== "battle" && event.fromZone !== "rush")) return state;
  if (event.toZone === "battle" || event.toZone === "rush") return state;
  const owner = event.ownerPlayerId;
  const ids = state.players[owner].discard.filter((c) => def(state, c.cardId)?.name === "要塞ワンセブン").map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, choice({ playerId: owner, phasePlayerId: event.phasePlayerId ?? turnPlayer(state), sourceInstanceId: event.instanceId }, "XG6-062", FORTRESS_CALL, "select_hand", ids, false));
});

CHOICE_RESOLVERS[FORTRESS_CALL] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, instanceId, (s) =>
    patchPlayer(s, playerId, (p) => {
      const card = p.discard.find((c) => c.instanceId === instanceId);
      return card ? { ...p, discard: p.discard.filter((c) => c !== card), rush: [...p.rush, stripForZone(card)] } : p;
    }),
  );
};

function openGraviton(state: GameState, ownerId: PlayerId, instanceId: string, endingPlayerId: PlayerId): GameState {
  const self = findField(state, ownerId, instanceId);
  if (!self) return state;
  const bp = effectiveBp(state, ownerId, self);
  const enemyId = opponent(ownerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) <= bp && selectableEnemy(state, ownerId, "XG6-062", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, choice({ playerId: ownerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId }, "XG6-062", GRAVITON, "select_unit", ids, true));
}

CHOICE_RESOLVERS[GRAVITON] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, instanceId, (s) => {
    const next = destroyAll(s, pendingBase(pending), "XG6-062", `${GRAVITON}_destroy`, [instanceId]);
    const selfId = pending.sourceInstanceId;
    return selfId && findField(next, playerId, selfId) ? moveFieldUnit(next, playerId, selfId, pending.phasePlayerId, "discard") : next;
  });
};
CHOICE_SKIPPERS[GRAVITON] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-063 ワンエイト【全弾発射】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを2つホールドしてもよい。そうしたとき、このターン、これはSP1/5になり、ホールドした
//  コマンドの必要パワーの数字が1と8だったなら、SP1になる。」（atwiki/page-2353）。リリース状態の自軍コマンドを1つずつ2つ選ぶ（1つ目で発動を決める）。

const FULL_FIRE = "xg6063_full_fire";

function applyFullFire(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (turnPlayer(state) !== ctx.playerId || !ctx.triggerSourceInstanceId) return { state, detail: "xg6063:not_own_turn" };
  const ids = state.players[ctx.playerId].command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: "xg6063:not_enough_command" };
  return { state: openAfter(state, choice(ctxBase(ctx), "XG6-063", FULL_FIRE, "select_command", ids, true)), detail: FULL_FIRE };
}

CHOICE_RESOLVERS[FULL_FIRE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const picked = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (picked.length < 2) {
    return {
      state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: picked, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId), optional: false } },
      log: logFor(state, playerId, "XG6-063", `${FULL_FIRE}:${instanceId}`),
    };
  }
  const costs = picked.map((id) => costNumber(state, state.players[playerId].command.find((c) => c.instanceId === id)?.cardId ?? "")).sort((a, b) => a - b);
  return finish(state, pending, picked.join(","), (s) => {
    let next = picked.reduce((acc, id) => setHeld(acc, playerId, id, true), s);
    const selfId = pending.sourceInstanceId;
    if (!selfId || !findField(next, playerId, selfId)) return next;
    next = addXg6Mark(next, { key: "XG6-063:sp1_5", playerId, instanceId: selfId });
    if (costs[0] === 1 && costs[1] === 8) next = addXg6Mark(next, { key: "XG6-063:sp1", playerId, instanceId: selfId });
    return next;
  });
};
CHOICE_SKIPPERS[FULL_FIRE] = simpleSkip();

// ---------------------------------------------------------------------------
// XG6-064 要塞ワンセブン【要塞能力】
// 「これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、自分の手札を1枚捨札にしてもよい。そうしたとき、捨札にしたカードの必要パワーの数字
//  以下の必要パワーの数字を持ち、特徴「メカ」を持つカードを自軍捨札から1枚選び手札に加える。」（atwiki/page-2333）
// 場のこれから起動する（このターンの記録で1度だけ）。手札に加えるカードは、捨札にしたカード以外から選ぶ。

const FORTRESS_DISCARD = "xg6064_fortress_discard";
const FORTRESS_RETURN = "xg6064_fortress_return";

XG6_ACTIVATIONS.push({
  list: (state, playerId) => {
    if (!ownRushIdle(state, playerId) || state.players[playerId].hand.length === 0) return [];
    return fieldCards(state, playerId).filter((c) => isCard(c.cardId, "XG6-064") && !hasXg6Mark(state, "XG6-064:used", playerId, c.instanceId)).map((c) => c.instanceId);
  },
  activate: (state, playerId, instanceId) => {
    const marked = addXg6Mark(state, { key: "XG6-064:used", playerId, instanceId });
    const ids = state.players[playerId].hand.map((c) => c.instanceId);
    return openEffectChoice(marked, choice({ playerId, phasePlayerId: playerId, sourceInstanceId: instanceId }, "XG6-064", FORTRESS_DISCARD, "select_hand", ids, true));
  },
});

CHOICE_RESOLVERS[FORTRESS_DISCARD] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].hand.find((c) => c.instanceId === instanceId)!;
  const limit = costNumber(state, card.cardId);
  const next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c !== card), discard: [...p.discard, stripForZone(card)] }));
  const ids = next.players[playerId].discard
    .filter((c) => c.instanceId !== instanceId && features(next, c.cardId).includes("メカ") && costNumber(next, c.cardId) <= limit)
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG6-064", `${FORTRESS_DISCARD}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, choice(pendingBase(pending), "XG6-064", FORTRESS_RETURN, "select_hand", ids, false)), log };
};
CHOICE_SKIPPERS[FORTRESS_DISCARD] = simpleSkip();
CHOICE_RESOLVERS[FORTRESS_RETURN] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return finish(state, pending, instanceId, (s) =>
    patchPlayer(s, playerId, (p) => {
      const card = p.discard.find((c) => c.instanceId === instanceId);
      return card ? { ...p, discard: p.discard.filter((c) => c !== card), hand: [...p.hand, stripForZone(card)] } : p;
    }),
  );
};


Object.assign(XG6_KEYWORDS, {
  "XG6-045::field": noop("xg6045:field"),
  "XG6-045::danger": applyDanger,
  "XG6-046::field": noop("xg6046:field"),
  "XG6-046::gekijouban": noop("xg6046:hand_rush"),
  "XG6-047::discard_rush": noop("xg6047:activation"),
  "XG6-047::giganto": applyGiganto,
  "XG6-048::mirror": noop("xg6048:activation"),
  "XG6-049::field": noop("xg6049:field"),
  "XG6-049::orphnoch": applyOrphnoch,
  "XG6-050::try": applyTry,
  "XG6-051::despair": noop("xg6051:battle_start"),
  "XG6-052::clock_up": noop("xg6052:field"),
  "XG6-053::field": noop("xg6053:field"),
  "XG6-053::go_to_hell": applyGoToHell,
  "XG6-054::hat": applyHat,
  "XG6-055::combo_change": applyComboChange,
  "XG6-056::scythe": applyScythe,
  "XG6-057::tora_claw": applyToraClaw,
  "XG6-058::void_scythe": applyVoidScythe,
  "XG6-060::candroid": applyCandroid,
  "XG6-061::vendor": noop("xg6061:activation"),
  "XG6-062::fortress": noop("xg6062:unit_left"),
  "XG6-062::graviton": noop("xg6062:turn_end"),
  "XG6-063::field": noop("xg6063:field"),
  "XG6-063::full_fire": applyFullFire,
  "XG6-064::fortress_ability": noop("xg6064:activation"),
  "XG6-065::friendship": noop("xg6065:field"),
});
