import { tryLeaveField } from "./operationCounters";
import { liveCommentaryStayAvailable } from "./legend1/set7NamedEffectsA";
import { kuugaStayCandidates } from "./legend1/otherLinesNamedEffects";
import { isSameCardIdentity } from "@rangers-strike/cards";
/**
 * 「自軍ラッシュフェイズ中、この〇〇を捨札にして（捨札にしてもよい）…」型の起動効果。
 *
 * 合法手は `activate_field_unit_ability`（unitInstanceId = 場のこのカード）。
 * - RK-043 ライドシューター【突入】
 * - XG4-102 ケンローダー【ギンクロン発進】
 * - RS-446 ダイジュピター【スクランブル】
 * - XG1-028 アバレンオージ【アバレンオーになりかけだから…】
 */
import { isZordUpCost } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { findInZone, removeAt, updatePlayer } from "../core/helpers";
import { cardCategories, getDefinition, parsePowerCost } from "../core/catalog";
import { sameCardName } from "../core/cardNames";
import { countAvailablePower, rushEffectivePowerCost } from "../core/power";
import { getPlayerModifiers } from "../core/scopedModifiers";
import { collectPowerIds, openEffectChoice, startSelectPowerChoice } from "./pendingChoices";
import { getConditionalNamedEffect } from "@rangers-strike/cards";
import { beginAbarenohFromHand } from "./errataCardEffects";
import { canActivateMagRepair, openMagRepair } from "./legend1/set5NamedEffectsA";
import { beginAllAboard, canActivateAllAboard } from "./legend1/set6NamedEffects348";
import { beginHoldToActivate, canActivateHoldToActivate, isHoldToActivateNc } from "./holdToActivate";
import { activateHoldReturnSelf, canActivateHoldReturnSelf, holdReturnSelfCount } from "./legend1/set7NamedEffectsA";
import { beginFusionCall, canActivateFusionCall } from "./legend1/set8NamedEffectsC";
import { beginRhinoShoot, canActivateRhinoShoot } from "./legend1/set9NamedEffectsC";
import { beginSoulBird, canActivateSoulBird } from "./legend1/set9NamedEffectsB";

type FieldZone = "rush" | "battle";

type FieldActivatedAbility = {
  cardId: string;
  effectId: string;
  /** 起動できる場（「このユニット／ビークル」が置かれている自軍エリア）。 */
  zones: FieldZone[];
  /** 起動できるフェイズ（自軍ターン）。省略時はラッシュフェイズ。 */
  phase?: "start" | "rush" | "battle";
  /** コストとしてこのカードを捨札にするか（省略時 true）。 */
  discardSelf?: boolean;
  /** 同じターンに同じカードで何度でも起動できる（コストを払えるかぎり。RS-440【武器換装】faq-card-7 RS-440 Q）。 */
  repeatable?: boolean;
  /** カードを特定する述語（省略時は cardId 一致）。同効果の再録カードにも適用するため。 */
  matches?: (cardId: string) => boolean;
  canActivate?: (state: GameState, playerId: PlayerId, card: CardInstance) => boolean;
  /** コスト（このカードを捨札にする）の後の処理。 */
  resolve: (state: GameState, playerId: PlayerId, card: CardInstance) => GameState;
};

// ---------------------------------------------------------------------------
// RK-043 ライドシューター【突入】

const RIDE_SHOOTER_RULE = "ride_shooter_next_mirror_rider";

/**
 * ルール: R-ERR-RK043 — 【突入】で捨札にしたターン中、次にラッシュする特徴「ミラーライダー」を持つ
 * ユニットカードは必要パワー−3・コマンドのホールドなしでラッシュできる（重複しない）。
 */
export function hasRideShooterRushRule(player: PlayerState): boolean {
  return getPlayerModifiers(player).some(
    (m) => m.kind === "rule" && m.ruleId === RIDE_SHOOTER_RULE && m.scope === "turn",
  );
}

function addRideShooterRushRule(player: PlayerState): PlayerState {
  if (hasRideShooterRushRule(player)) return player;
  return {
    ...player,
    modifiers: [
      ...getPlayerModifiers(player),
      { kind: "rule", ruleId: RIDE_SHOOTER_RULE, scope: "turn", sourceCardId: "RK-043" },
    ],
  };
}

/** 【突入】の対象（特徴「ミラーライダー」を持つユニットカード）か。 */
export function isRideShooterRushTarget(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  cardId: string,
): boolean {
  if (!hasRideShooterRushRule(state.players[playerId])) return false;
  const def = getDefinition(state.definitions, cardId);
  return def?.type === "unit" && (def.features ?? []).includes("ミラーライダー");
}

/** 対象をラッシュしたら効果は終わる（「次にラッシュする」1枚だけ）。 */
export function consumeRideShooterRushRule(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  player: PlayerState,
  cardId: string,
): PlayerState {
  if (!isRideShooterRushTarget(state, playerId, cardId)) return player;
  return {
    ...player,
    modifiers: getPlayerModifiers(player).filter(
      (m) => !(m.kind === "rule" && m.ruleId === RIDE_SHOOTER_RULE),
    ),
  };
}

// ---------------------------------------------------------------------------
// XG4-102 ケンローダー【ギンクロン発進】

function ginkuronTargets(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].deck
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (!def || def.type !== "vehicle" || def.size !== "S") return false;
      if (sameCardName(def.name, "ケンローダー")) return false;
      if (!cardCategories(def).includes("OT")) return false;
      // 「ただし、追加条件は満たすこと」— 追加条件（ゾードアップ等）を持つカードは山札からは満たせないので除外。
      return !isZordUpCost(def.powerCost);
    })
    .map((c) => c.instanceId);
}

// ---------------------------------------------------------------------------
// RS-446 ダイジュピター【スクランブル】

export const SCRAMBLE_EFFECT_ID = "scramble";

function scrambleTargets(state: GameState, playerId: PlayerId): string[] {
  const available = countAvailablePower(state, playerId);
  return state.players[playerId].command
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (!def || def.type !== "unit" || def.size !== "M") return false;
      if (!cardCategories(def).includes("ET")) return false;
      const cost = rushEffectivePowerCost(state, playerId, parsePowerCost(def.powerCost), def.id);
      return available >= cost;
    })
    .map((c) => c.instanceId);
}

function distinctNameCount(state: GameState, playerId: PlayerId, ids: string[]): number {
  const names: string[] = [];
  for (const id of ids) {
    const card = state.players[playerId].command.find((c) => c.instanceId === id);
    const name = card ? getDefinition(state.definitions, card.cardId)?.name : undefined;
    if (name && !names.some((n) => sameCardName(n, name))) names.push(name);
  }
  return names.length;
}

/**
 * ルール: R-ERR-RS446 — 同じカード名のユニットカードを2枚以上選ぶことはできない。
 * 選択済みと同名のカードを候補から外す。
 */
export function filterScrambleRemaining(
  state: GameState,
  playerId: PlayerId,
  selected: string[],
  remaining: string[],
): string[] {
  const command = state.players[playerId].command;
  const nameOf = (id: string) => {
    const card = command.find((c) => c.instanceId === id);
    return card ? getDefinition(state.definitions, card.cardId)?.name : undefined;
  };
  const selectedNames = selected.map(nameOf);
  return remaining.filter((id) => !selectedNames.some((n) => sameCardName(n, nameOf(id))));
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 捨札コストのない起動効果は、同じターンに同じカードで何度も起動（→見送り）を繰り返せないよう1回に限る。

const FIELD_ABILITY_USED_RULE = "field_ability_used";

function fieldAbilityUsedThisTurn(player: PlayerState, instanceId: string): boolean {
  return getPlayerModifiers(player).some(
    (m) =>
      m.kind === "rule" &&
      m.ruleId === FIELD_ABILITY_USED_RULE &&
      m.scope === "turn" &&
      m.payload === instanceId,
  );
}

function markFieldAbilityUsed(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      modifiers: [
        ...getPlayerModifiers(player),
        {
          kind: "rule",
          ruleId: FIELD_ABILITY_USED_RULE,
          scope: "turn",
          payload: card.instanceId,
          sourceCardId: card.cardId,
        },
      ],
    }),
  };
}

// ---------------------------------------------------------------------------
// RS-042 デカレンジャーロボ【ジャスティスフラッシャー】（PR-005 等の同効果カードも）

/**
 * 「自軍パワーゾーンからダメージ以外のカードを5枚選び捨札にしてもよい。そうしたとき、このターン、
 * このユニットは次の能力を得る⇒「SP3」」— 誘発条件のない効果で、出たときだけでなく自軍バトルフェイズ中に
 * 発動できる（grnrngr/faq-card-1 RS-051 Q3「ストライクポイントを得る効果は、自軍バトルフェイズに発動できます」）。
 */
function isJusticeFlasherCard(cardId: string): boolean {
  return getConditionalNamedEffect(cardId)?.effectId === "justice_flasher";
}

function canActivateJusticeFlasher(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  // すでに「SP3」を得ていれば、再発動しても何も変わらない。
  if (card.spOverride === 3) return false;
  if (fieldAbilityUsedThisTurn(state.players[playerId], card.instanceId)) return false;
  return collectPowerIds(state, playerId).length >= 5;
}

// ---------------------------------------------------------------------------
// RS-094 龍冥王サラマンデス【幽魔吸収】

/**
 * 「自軍バトルフェイズに次の効果を発動できる。敵軍捨札からSユニットのカードを1枚選んで持ち主の手札に戻す。…」
 * — 誘発条件はないので、バトルエリアに出たときだけでなく自軍バトルフェイズ中に発動できる（出典: atwiki/page-329）。
 */
function isGhostAbsorptionCard(cardId: string): boolean {
  return getConditionalNamedEffect(cardId)?.effectId === "ghost_absorption";
}

function ghostAbsorptionTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId: PlayerId = playerId === "player1" ? "player2" : "player1";
  return state.players[enemyId].discard
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "S";
    })
    .map((c) => c.instanceId);
}

function canActivateGhostAbsorption(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  // このターンすでに吸収済み（SP1 になっている）なら繰り返さない。
  if (card.spOverride === 1) return false;
  if (fieldAbilityUsedThisTurn(state.players[playerId], card.instanceId)) return false;
  return ghostAbsorptionTargets(state, playerId).length > 0;
}

const ABILITIES: FieldActivatedAbility[] = [
  {
    // RS-366 グランギズモ【総員搭乗】: 自軍ラッシュフェイズ中、「戦闘員」の自軍ユニットを1体捨札にして山札の DA の M ユニットを出す。
    cardId: "RS-366",
    effectId: "all_aboard",
    zones: ["rush"],
    discardSelf: false,
    canActivate: (state, playerId, card) => canActivateAllAboard(state, playerId, card),
    resolve: (state, playerId, card) => beginAllAboard(state, playerId, card),
  },
  {
    // RS-271 マグ【修復作業】: 自軍スタートフェイズ中、ラッシュエリアのこれを捨札にして、ダメージ1枚をオモテにする。
    cardId: "RS-271",
    effectId: "mag_repair",
    zones: ["rush"],
    phase: "start",
    canActivate: (state, playerId) => canActivateMagRepair(state, playerId),
    resolve: (state, playerId, card) => openMagRepair(state, playerId, card),
  },
  {
    cardId: "RS-094",
    effectId: "ghost_absorption",
    zones: ["battle"],
    phase: "battle",
    discardSelf: false,
    matches: isGhostAbsorptionCard,
    canActivate: canActivateGhostAbsorption,
    resolve: (state, playerId, card) =>
      openEffectChoice(state, {
        playerId,
        effectId: "ghost_absorption",
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        kind: "select_unit",
        validInstanceIds: ghostAbsorptionTargets(state, playerId),
        unitDestination: "hand_from_discard",
        selectCount: 1,
        optional: true,
      }),
  },
  {
    cardId: "RS-042",
    effectId: "justice_flasher",
    zones: ["battle"],
    phase: "battle",
    discardSelf: false,
    matches: isJusticeFlasherCard,
    canActivate: canActivateJusticeFlasher,
    resolve: (state, playerId, card) =>
      startSelectPowerChoice(state, {
        playerId,
        effectId: "justice_flasher",
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        selectCount: 5,
        optional: true,
      }) ?? state,
  },
  {
    // XG1-028 アバレンオージ【アバレンオーになりかけだから…】（E7、出典: atwiki/page-1665）
    cardId: "XG1-028",
    effectId: "abarenoh_from_hand",
    zones: ["rush", "battle"],
    resolve: (state, playerId, card) => beginAbarenohFromHand(state, playerId, card),
  },
  {
    cardId: "RK-043",
    effectId: "ride_shooter_charge",
    zones: ["rush", "battle"],
    resolve: (state, playerId) => {
      const player = state.players[playerId];
      return { ...state, ...updatePlayer(state, playerId, addRideShooterRushRule(player)) };
    },
  },
  {
    cardId: "XG4-102",
    effectId: "ginkuron_launch",
    zones: ["rush", "battle"],
    resolve: (state, playerId, card) => {
      const valid = ginkuronTargets(state, playerId);
      if (valid.length === 0) return state;
      // ルール: R-ERR-XG4-102 — 山札を見てケンローダー以外の OT S ビークルを1枚ラッシュエリアに出し、山札をシャッフル。
      return openEffectChoice(state, {
        playerId,
        effectId: "ginkuron_launch",
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        kind: "scry_keep_one",
        validInstanceIds: valid,
        viewedInstanceIds: valid,
        unitDestination: "rush",
        selectCount: 1,
      });
    },
  },
  {
    cardId: "RS-446",
    effectId: SCRAMBLE_EFFECT_ID,
    zones: ["rush", "battle"],
    resolve: (state, playerId, card) => {
      const valid = scrambleTargets(state, playerId);
      if (valid.length === 0) return state;
      const count = Math.min(3, distinctNameCount(state, playerId, valid));
      return openEffectChoice(state, {
        playerId,
        effectId: SCRAMBLE_EFFECT_ID,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        kind: "select_commands",
        validInstanceIds: valid,
        selectCount: count,
        commandFilter: "any",
        commandAction: "rush",
      });
    },
  },
];

// ---------------------------------------------------------------------------
// 「「MA」の自軍コマンドを１つホールドして、次の効果を発動できる⇒…」型の NC 効果（rules/holdToActivate.ts）。
// 文言で判定するので、カードを列挙しない。NC が成立して出た直後の行動ウィンドウで1回だけ起動できる。
ABILITIES.push({
  cardId: "",
  effectId: "hold_to_activate",
  zones: ["battle"],
  phase: "battle",
  discardSelf: false,
  matches: (cardId) => isHoldToActivateNc(cardId),
  canActivate: (state, playerId, card) =>
    !fieldAbilityUsedThisTurn(state.players[playerId], card.instanceId) &&
    canActivateHoldToActivate(state, playerId, card),
  resolve: (state, playerId, card) => beginHoldToActivate(state, playerId, card),
});

// 「これが自軍バトルエリアにある間、自軍バトルフェイズ中、自軍コマンドをNつホールドしてもよい。そうしたとき、
// これをラッシュエリアに戻す。」（RS-440【武器換装】。rules/legend1/set7NamedEffectsA.ts）。文言で判定する。
ABILITIES.push({
  cardId: "",
  effectId: "hold_commands_return_self",
  zones: ["battle"],
  phase: "battle",
  discardSelf: false,
  repeatable: true,
  matches: (cardId) => holdReturnSelfCount(cardId) > 0,
  canActivate: (state, playerId, card) => canActivateHoldReturnSelf(state, playerId, card),
  resolve: (state, playerId, card) => activateHoldReturnSelf(state, playerId, card),
});

// RS-568 風雷丸【各々方、合体で御座る！】: 自軍ラッシュフェイズ中、手札のメカ L を見せ、合体ユニットの M を手札から出す
// （rules/legend1/set8NamedEffectsC.ts）。回数の制限はない（手札のカードを使うかぎり何度でも）。
ABILITIES.push({
  cardId: "RS-568",
  effectId: "rs568_fusion_call",
  zones: ["rush", "battle"],
  phase: "rush",
  discardSelf: false,
  repeatable: true,
  canActivate: (state, playerId, card) => canActivateFusionCall(state, playerId, card),
  resolve: (state, playerId, card) => beginFusionCall(state, playerId, card),
});

// RS-650 ガオライノス【強蹴一閃ライノシュート】: 自軍ラッシュフェイズ中、DA を持たない自軍 L ユニットに重ねる
// （rules/legend1/set9NamedEffectsC.ts）。重ねたらカードとして扱われ場を離れるので、くり返しは起きない。
ABILITIES.push({
  cardId: "RS-650",
  effectId: "rs650_rhino_shoot",
  zones: ["rush", "battle"],
  phase: "rush",
  discardSelf: false,
  repeatable: true,
  canActivate: (state, playerId, card) => canActivateRhinoShoot(state, playerId, card),
  resolve: (state, playerId, card) => beginRhinoShoot(state, playerId, card),
});

// RS-647 ピヨちゃん【ソウルバード】: 自軍ラッシュフェイズ中、DA を持たない自軍 L ユニットを選び、これに重ねる
// （rules/legend1/set9NamedEffectsB.ts）。重ねるとピヨちゃんは場を離れるので、続けては使えない。
ABILITIES.push({
  cardId: "RS-647",
  effectId: "rs647_soul_bird",
  zones: ["rush", "battle"],
  phase: "rush",
  discardSelf: false,
  repeatable: true,
  canActivate: (state, playerId, card) => canActivateSoulBird(state, playerId, card),
  resolve: (state, playerId, card) => beginSoulBird(state, playerId, card),
});

function abilityFor(cardId: string): FieldActivatedAbility | undefined {
  return ABILITIES.find((a) => (a.matches ? a.matches(cardId) : isSameCardIdentity(a.cardId, cardId)));
}

/** 起動できる場のカード（instanceId）。自軍ターンの、能力ごとに決まったフェイズ中のみ。 */
export function listFieldActivatedAbilityCards(state: GameState, playerId: PlayerId): string[] {
  if (state.activePlayer !== playerId) return [];
  if (state.phase !== "start" && state.phase !== "rush" && state.phase !== "battle") return [];
  if (state.pendingEffectChoice) return [];
  const player = state.players[playerId];
  const ids: string[] = [];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      const ability = abilityFor(card.cardId);
      if (!ability || !ability.zones.includes(zone)) continue;
      if ((ability.phase ?? "rush") !== state.phase) continue;
      if (ability.canActivate && !ability.canActivate(state, playerId, card)) continue;
      ids.push(card.instanceId);
    }
  }
  return ids;
}

/** このカードを捨札にして（コスト）効果を発動する。対象外なら null。 */
export function activateFieldAbility(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState | null {
  if (!listFieldActivatedAbilityCards(state, playerId).includes(instanceId)) return null;
  const player = state.players[playerId];
  const zone: FieldZone | null = findInZone(player, "rush", instanceId)
    ? "rush"
    : findInZone(player, "battle", instanceId)
      ? "battle"
      : null;
  if (!zone) return null;
  const found = findInZone(player, zone, instanceId)!;
  const ability = abilityFor(found.card.cardId);
  if (!ability) return null;
  if (ability.discardSelf === false) {
    if (ability.repeatable) return ability.resolve(state, playerId, found.card);
    return ability.resolve(markFieldAbilityUsed(state, playerId, found.card), playerId, found.card);
  }

  // 場のユニットを捨札にするコストで「ユニットでなくなるとき」の応答（その場に留まる）があるときは、離場の処理に任せる。
  // 留まったなら「捨札にする」を満たせないので、その後の処理は無効（atwiki/page-1665 Q1 アバレンオージと白熱する実況）。
  if (unitHasStayResponse(state, playerId, found.card)) {
    const leave = tryLeaveField(state, {
      ownerPlayerId: playerId,
      instanceId,
      fromZone: zone,
      toZone: "discard",
      leavingCardId: found.card.cardId,
      phasePlayerId: playerId,
      notDestruction: true,
    });
    const marker = { playerId, instanceId, cardId: found.card.cardId };
    if (leave.deferred || hasBlockingAfterLeave(leave.state)) {
      return { ...leave.state, pendingFieldAbilityAfterLeave: marker };
    }
    return continueFieldAbilityAfterLeave({ ...leave.state, pendingFieldAbilityAfterLeave: marker });
  }

  const [, rest] = removeAt(player[zone], found.index);
  const unmount = (c: CardInstance) => {
    if (c.mountedOnInstanceId !== instanceId) return c;
    const { mountedOnInstanceId: _m, ...restCard } = c;
    return restCard as CardInstance;
  };
  const { mountedOnInstanceId: _own, ...discarded } = found.card;
  const nextPlayer: PlayerState = {
    ...player,
    rush: (zone === "rush" ? rest : player.rush).map(unmount),
    battle: (zone === "battle" ? rest : player.battle).map(unmount),
    discard: [...player.discard, discarded as CardInstance],
  };
  const afterCost = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
  return ability.resolve(afterCost, playerId, found.card);
}

function unitHasStayResponse(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (getDefinition(state.definitions, card.cardId)?.type !== "unit") return false;
  return liveCommentaryStayAvailable(state, playerId, card) || kuugaStayCandidates(state, playerId, card).length > 0;
}

function hasBlockingAfterLeave(state: GameState): boolean {
  return !!(state.pendingEffectChoice || state.pendingLeave || state.pendingRegister || state.pendingChase);
}

/**
 * 捨札にするコストの応答が終わった後の続き（core/applyAction.ts の後処理から呼ぶ）。捨札になっていれば効果の続きを解決し、
 * その場に留まっていれば続きは無効。
 */
export function continueFieldAbilityAfterLeave(state: GameState): GameState {
  const marker = state.pendingFieldAbilityAfterLeave;
  if (!marker || hasBlockingAfterLeave(state)) return state;
  const cleared: GameState = { ...state, pendingFieldAbilityAfterLeave: undefined };
  const discarded = cleared.players[marker.playerId].discard.find((c) => c.instanceId === marker.instanceId);
  if (!discarded) return cleared;
  const ability = abilityFor(marker.cardId);
  if (!ability) return cleared;
  return ability.resolve(cleared, marker.playerId, { instanceId: marker.instanceId, cardId: marker.cardId });
}

export function isFieldActivatedAbilityCard(cardId: string): boolean {
  return !!abilityFor(cardId);
}
