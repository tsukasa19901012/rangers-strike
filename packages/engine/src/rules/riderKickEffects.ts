/**
 * 「選択を伴う能動効果」で、テキストパターン照合では受動扱いになり不発だった
 * カードを、cardId::effectId で正確にディスパッチして pendingEffectChoice を開く。
 *
 * 対象（ユーザー報告 + 横展開）:
 *  - hold_N_ot_commands_then_spM : バトル登場時に OT コマンドを N ホールドで SP 付与（RK-065 等）
 *  - rider_slash                 : 必要パワー/ナンバー/SP1 の敵 S を撃破（XG3-066 等）
 *  - rider_kick_send_power        : パワー 1/2/3 が揃うと敵 S をパワー送り（XG3-062 等）
 *  - rider_kick_discard_power_sp1 : パワー 1/2/3 の 1 枚を捨てて自身 SP1（XG2-066 等）
 *  - senko_sosa                   : 数字宣言→山札下公開→一致で手札（RK-135 等）
 *  - extend_rider_drop            : 指定ビークルからのコンビで本来 BP 8000 以下の敵をパワー送り（RK-301 等）
 */
import type { CardInstance, GameState, PlayerId } from "../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../dsl/grantKeyword";
import { cardName, getDefinition, parsePowerCost } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { getCardDslDocument } from "../dsl/effectLookup";
import { openEffectChoice } from "./pendingChoices";

/** 敵軍 S ユニット（バトル + ラッシュ）を列挙。 */
function enemyStackUnits(state: GameState, playerId: PlayerId) {
  const enemy = state.players[opponent(playerId)];
  return [...enemy.battle, ...enemy.rush].filter((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "unit" && d.size === "S";
  });
}

/** 「SP1」を持つ（印刷 SP1 または現在 spOverride/spModifier で SP1 相当）。 */
function hasSp1(state: GameState, cardId: string, instance: { spOverride?: unknown; spModifier?: number }): boolean {
  if (instance.spOverride === 1) return true;
  const d = getDefinition(state.definitions, cardId);
  return d?.sp === 1;
}

/** 自軍オモテ向きパワーで必要パワー数字が 1/2/3 それぞれ存在するか。 */
function hasPowerOneTwoThree(state: GameState, playerId: PlayerId): boolean {
  const faceUp = state.players[playerId].power.filter((c) => !c.faceDown);
  const digits = new Set(
    faceUp.map((c) => parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost)),
  );
  return digits.has(1) && digits.has(2) && digits.has(3);
}

// ---- RK-065 系: OT コマンドを N ホールド → SP 付与 ----

const HOLD_SP_RE = /^hold_(\d+)_ot_commands_then_sp(\d+)$/;

function beginHoldOtCommandsThenSp(
  state: GameState,
  ctx: GrantKeywordContext,
  holdCount: number,
): GameState | null {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId) return null;
  const player = state.players[ctx.playerId];
  const released = player.command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
  if (released.length < holdCount) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "hold_ot_commands_then_sp",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: selfId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_command",
    validInstanceIds: released,
    selectCount: holdCount,
    optional: true,
    commandAction: "hold",
  });
}

// ---- XG3-066 系: ライダースラッシュ ----

function beginRiderSlash(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const targets = enemyStackUnits(state, ctx.playerId).filter((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return (
      parsePowerCost(d?.powerCost) === 1 ||
      d?.comboNumber === 1 ||
      hasSp1(state, c.cardId, c)
    );
  });
  if (targets.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "rider_slash_destroy",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: targets.map((c) => c.instanceId),
    unitDestination: "discard",
    selectCount: 1,
    optional: true,
  });
}

// ---- XG3-062 系: パワー 1/2/3 が揃うと敵 S をパワー送り ----

function beginRiderKickSendPower(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (!hasPowerOneTwoThree(state, ctx.playerId)) return null;
  const enemy = state.players[opponent(ctx.playerId)];
  const targets = enemy.battle.filter((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "unit" && d.size === "S";
  });
  if (targets.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "rider_kick_send_power",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: targets.map((c) => c.instanceId),
    unitDestination: "power",
    selectCount: 1,
    optional: true,
  });
}

// ---- XG2-066 系: パワー 1/2/3 の 1 枚を捨てて自身 SP1 ----

function beginRiderKickDiscardPowerSp1(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const selfId = ctx.triggerSourceInstanceId;
  if (!selfId || !hasPowerOneTwoThree(state, ctx.playerId)) return null;
  const faceUp = state.players[ctx.playerId].power.filter((c) => {
    if (c.faceDown) return false;
    const digit = parsePowerCost(getDefinition(state.definitions, c.cardId)?.powerCost);
    return digit === 1 || digit === 2 || digit === 3;
  });
  if (faceUp.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "rider_kick_discard_power_sp1",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: selfId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_power",
    validInstanceIds: faceUp.map((c) => c.instanceId),
    selectCount: 1,
    optional: true,
  });
}

// ---- RK-135 系: 潜行捜索（数字宣言→山札下公開→一致で手札） ----

function beginSenkoSosa(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (state.players[ctx.playerId].deck.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "senko_sosa_declare",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "declare_number",
    validInstanceIds: Array.from({ length: 13 }, (_, i) => String(i)),
    selectCount: 1,
    optional: true,
  });
}

/** RK-135: 宣言後、山札下から 1 枚公開し、必要パワー一致で手札 / 不一致で山札下へ。 */
export function resolveSenkoSosa(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  declared: number,
): GameState {
  const player = state.players[pending.playerId];
  if (player.deck.length === 0) return state;
  const bottom = player.deck[player.deck.length - 1]!;
  const rest = player.deck.slice(0, player.deck.length - 1);
  const def = getDefinition(state.definitions, bottom.cardId);
  const digit = parsePowerCost(def?.powerCost);
  const revealedName = cardName(state.definitions, bottom.cardId);
  if (digit === declared) {
    return {
      ...state,
      ...updatePlayer(state, pending.playerId, {
        ...player,
        deck: rest,
        hand: [...player.hand, bottom],
      }),
      log: [...state.log, `潜行捜索: ${revealedName} を公開（宣言 ${declared}）→ 手札へ`],
    };
  }
  return {
    ...state,
    ...updatePlayer(state, pending.playerId, { ...player, deck: [bottom, ...rest] }),
    log: [...state.log, `潜行捜索: ${revealedName} を公開（宣言 ${declared}）→ 山札の下へ`],
  };
}

// ---- RK-301 系: 指定ビークルからのコンビで本来 BP 8000 以下の敵をパワー送り ----

const EXTEND_DROP_PARTNER: Record<string, string> = {
  "RK-301": "カブトエクステンダー",
};

function beginExtendRiderDrop(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const partnerName = EXTEND_DROP_PARTNER[ctx.sourceCardId];
  if (partnerName) {
    // ライドされている指定ビークルが自軍フィールドに存在するときのみ。
    const player = state.players[ctx.playerId];
    const hasPartner = [...player.battle, ...player.rush].some(
      (c) =>
        cardName(state.definitions, c.cardId) === partnerName ||
        (c.stackedCards ?? []).some(
          (s) => cardName(state.definitions, s.cardId) === partnerName,
        ),
    );
    if (!hasPartner) return null;
  }
  const enemy = state.players[opponent(ctx.playerId)];
  const targets = [...enemy.battle, ...enemy.rush].filter((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "unit" && typeof d.bp === "number" && d.bp <= 8000;
  });
  if (targets.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: "extend_rider_drop",
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: targets.map((c) => c.instanceId),
    unitDestination: "power",
    selectCount: 1,
    optional: false,
  });
}

/**
 * cardId::effectId 単位でのディスパッチ。applyGrantKeyword の最前段で呼ぶ。
 * 未対応なら null を返し、既存の解決経路にフォールバックさせる。
 */
export function tryReportedRiderEffect(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GrantKeywordResult | null {
  const holdMatch = keyword.match(HOLD_SP_RE);
  if (holdMatch) {
    const withChoice = beginHoldOtCommandsThenSp(state, ctx, Number(holdMatch[1]));
    return withChoice
      ? { state: withChoice, detail: keyword }
      : { state, detail: `${keyword}:no_targets` };
  }

  const id = `${ctx.sourceCardId}::${ctx.effectId}`;
  switch (id) {
    // ライダースラッシュ
    case "XG3-066::raidasurashu": {
      const withChoice = beginRiderSlash(state, ctx);
      return withChoice
        ? { state: withChoice, detail: "rider_slash" }
        : { state, detail: "rider_slash:no_targets" };
    }
    // XG3-062 ライダーキック（敵 S をパワー送り）
    case "XG3-062::raidakiku": {
      const withChoice = beginRiderKickSendPower(state, ctx);
      return withChoice
        ? { state: withChoice, detail: "rider_kick_send_power" }
        : { state, detail: "rider_kick_send_power:unmet" };
    }
    // XG2-066 / XG4-079 ライダーキック（自軍パワー捨て→SP1）
    case "XG2-066::raidakiku":
    case "XG4-079::atakuraido": {
      const withChoice = beginRiderKickDiscardPowerSp1(state, ctx);
      return withChoice
        ? { state: withChoice, detail: "rider_kick_discard_power_sp1" }
        : { state, detail: "rider_kick_discard_power_sp1:unmet" };
    }
    // RK-135 潜行捜索
    case "RK-135::fx_unknown_e6bd9c": {
      const withChoice = beginSenkoSosa(state, ctx);
      return withChoice
        ? { state: withChoice, detail: "senko_sosa" }
        : { state, detail: "senko_sosa:no_deck" };
    }
    // RK-301 エクステンドライダー落とし
    case "RK-301::ekusutendoraidatoshi": {
      const withChoice = beginExtendRiderDrop(state, ctx);
      return withChoice
        ? { state: withChoice, detail: "extend_rider_drop" }
        : { state, detail: "extend_rider_drop:unmet" };
    }
    default:
      return null;
  }
}

/** 直接解決（select_unit）で使う discard/power 送りの effectId 集合。 */
export const RIDER_EFFECT_SELECT_UNIT_IDS = new Set([
  "rider_slash_destroy",
  "rider_kick_send_power",
  "extend_rider_drop",
]);

/** ターン終了時: tempDiscardAtTurnEnd の一時ユニットを自軍エリアから捨札へ。 */
export function applyTempDiscardAtTurnEnd(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const player = state.players[playerId];
  const isTemp = (c: CardInstance) => c.tempDiscardAtTurnEnd === true;
  if (!player.rush.some(isTemp) && !player.battle.some(isTemp)) return state;
  const removed: CardInstance[] = [];
  const keep = (cards: CardInstance[]) =>
    cards.filter((c) => {
      if (isTemp(c)) {
        const { tempDiscardAtTurnEnd: _t, ...clean } = c;
        removed.push(clean);
        return false;
      }
      return true;
    });
  const rush = keep(player.rush);
  const battle = keep(player.battle);
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      rush,
      battle,
      discard: [...player.discard, ...removed],
    }),
  };
}

// ---- RK-142 系: パワーゾーンでオモテ向きの常駐が、味方仮面ライダー進入に反応 ----

const POWER_FACEUP_RAIDA_KEYWORD = "power_faceup_raida_enter_battle";

function cardHasKeyword(cardId: string, keyword: string): boolean {
  const doc = getCardDslDocument(cardId);
  return (
    doc?.effects?.some((effect) =>
      effect.effects.some((p) => p.type === "grant_keyword" && p.keyword === keyword),
    ) ?? false
  );
}

/** 自軍パワーゾーンでオモテ向きの「最初からクライマックスだぜ」系カードの instanceId。 */
function faceUpPowerFaceupRaidaIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power
    .filter((c) => !c.faceDown && cardHasKeyword(c.cardId, POWER_FACEUP_RAIDA_KEYWORD))
    .map((c) => c.instanceId);
}

// ---- XG3-069 系: カメンライド（ラッシュフェイズ起動、パワー→ラッシュ展開） ----

const KAMEN_RIDE_KEYWORD = "effect_card::XG3-069::kamenraido";

/** カメンライド起動可能な自軍フィールドユニット（未使用のもの）。 */
export function listKamenRideAbilityUnits(state: GameState, playerId: PlayerId): string[] {
  if (state.phase !== "rush") return [];
  const player = state.players[playerId];
  const used = new Set(player.fieldAbilityUsedThisRush ?? []);
  return [...player.rush, ...player.battle]
    .filter((c) => !used.has(c.instanceId) && cardHasKeyword(c.cardId, KAMEN_RIDE_KEYWORD))
    .filter(() => kamenRideDeployTargets(state, playerId).length > 0)
    .map((c) => c.instanceId);
}

/** パワーゾーンでオモテ向き・特徴「仮面ライダー」・追加条件なしのユニットカード。 */
function kamenRideDeployTargets(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power
    .filter((c) => {
      if (c.faceDown) return false;
      const d = getDefinition(state.definitions, c.cardId);
      if (!d || d.type !== "unit") return false;
      if (!(d.features ?? []).includes("仮面ライダー")) return false;
      // 追加条件（ライド等）を持つユニットは対象外。
      const text = d.text ?? "";
      if (/追加条件|ライド|RC|RM/.test(text) && /追加/.test(text)) return false;
      return true;
    })
    .map((c) => c.instanceId);
}

/** カメンライド起動: パワー→ラッシュへ最大2枚展開する選択を開く。 */
export function beginKamenRideDeploy(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
): GameState | null {
  const targets = kamenRideDeployTargets(state, playerId);
  if (targets.length === 0) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: "kamen_ride_deploy",
    sourceCardId: "XG3-069",
    sourceInstanceId: unitInstanceId,
    phasePlayerId: playerId,
    kind: "select_unit",
    validInstanceIds: targets,
    selectCount: Math.min(2, targets.length),
    unitDestination: "rush",
    optional: true,
  });
}

/** カメンライドで選ばれたパワーカードをラッシュ展開（一時ユニット扱い）。 */
export function applyKamenRideDeploy(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  selectedIds: string[],
): GameState {
  const player = state.players[pending.playerId];
  const chosen = player.power.filter((c) => selectedIds.includes(c.instanceId));
  if (chosen.length === 0) return state;
  const deployed = chosen.map((c) => ({
    ...c,
    faceDown: false,
    battleActed: true, // このターン、アタックもストライクもできない
    tempDiscardAtTurnEnd: true, // ターン終了時、自軍エリアにあれば捨札
  }));
  const usedIds = new Set([...(player.fieldAbilityUsedThisRush ?? [])]);
  if (pending.sourceInstanceId) usedIds.add(pending.sourceInstanceId);
  return {
    ...state,
    ...updatePlayer(state, pending.playerId, {
      ...player,
      power: player.power.filter((c) => !selectedIds.includes(c.instanceId)),
      rush: [...player.rush, ...deployed],
      fieldAbilityUsedThisRush: [...usedIds],
    }),
    log: [
      ...state.log,
      `カメンライド: ${deployed
        .map((c) => cardName(state.definitions, c.cardId))
        .join("・")} をラッシュに展開`,
    ],
  };
}

/**
 * RK-142: 自軍パワーゾーンでオモテ向きの常駐があり、特徴「仮面ライダー」を持つ
 * 自軍ユニットがバトルエリアに出たとき、常駐を捨てて進入ユニットを SP1 にできる。
 * combo.ts の enter_battle テールから呼ぶ（味方進入リアクティブ）。
 */
export function tryPowerFaceupRaidaOnAllyEnter(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
  phasePlayerId: PlayerId,
): GameState {
  const def = getDefinition(state.definitions, entering.cardId);
  if (!def || def.type !== "unit") return state;
  if (!(def.features ?? []).includes("仮面ライダー")) return state;

  const powerIds = faceUpPowerFaceupRaidaIds(state, playerId);
  if (powerIds.length === 0) return state;

  return (
    openEffectChoice(state, {
      playerId,
      effectId: "power_faceup_sp1_grant",
      sourceCardId: "RK-142",
      sourceInstanceId: entering.instanceId,
      phasePlayerId,
      kind: "select_power",
      validInstanceIds: powerIds,
      selectCount: 1,
      optional: true,
    }) ?? state
  );
}
