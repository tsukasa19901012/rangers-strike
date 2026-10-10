/**
 * 第5弾「五龍の逆鱗」監査で見つかったカード固有の効果の修正（set-5 audit）。
 *
 * - `trySet5AuditCardEffect`: DSL の grant_keyword（`cardId::effectId`）から呼ばれる起点。
 * - `tryResolveSet5AuditChoice` / `trySkipSet5AuditChoice`: このモジュールが開いた選択の解決。
 * - `applySet5StrikeDamageTriggers`: ストライクでダメージを与えたあとの誘発（RS-309）。
 */
import type { CardInstance, GameState, PendingStrike, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { cardName, getDefinition, parsePowerCost } from "../../core/catalog";
import { addTurnRestrictionModifier } from "../../core/scopedModifiers";
import { opponent, performDeckDraws, updatePlayer } from "../../core/helpers";
import type { GameAction } from "../../types/actions";
import { unitFeatures } from "../addedFeatures";
import { shuffleCards } from "../errataCardEffects";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { afterCommandCardsLeft } from "../commandLeaveRefill";
import { applyUnitLeave, openEffectChoice, type ChoiceOutcome } from "../pendingChoices";

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

function clearPending(state: GameState, phasePlayerId: PlayerId): GameState {
  return { ...state, pendingEffectChoice: undefined, activePlayer: phasePlayerId };
}

function finish(state: GameState, phasePlayerId: PlayerId): GameState {
  return promoteDeferredBattleEntry(clearPending(state, phasePlayerId));
}

// ---------------------------------------------------------------------------
// RS-309 轟雷神【ゴウライキャノン】
// 「これがストライクしてダメージを与えたとき、敵軍コマンドゾーンと敵軍パワーゾーンのダメージ以外のカードから、
//  それぞれ1枚ずつ選んでもよい。そうしたとき、選んだカードを持ち主の手札に戻す。」（atwiki/page-479）
// - 片方のゾーンにしか候補がなくても発動できる（faq-card-5 RS-309 Q1/Q2）。
// - 1枚目を選んだゾーンとは別のゾーンから2枚目を選ぶ（選ばなくてもよい）。選び終えたら同時に手札に戻す。

export const GOURAI_CANNON_EFFECT_ID = "gourai_cannon_return_enemy_command_power";

function gouraiCannonCandidates(state: GameState, playerId: PlayerId): { command: string[]; power: string[] } {
  const enemy = state.players[opponent(playerId)];
  return {
    command: enemy.command.map((c) => c.instanceId),
    power: enemy.power.filter((c) => !c.faceDown).map((c) => c.instanceId),
  };
}

/** ストライクでダメージを与えた直後（ダメージの支払い後）の誘発。 */
export function applySet5StrikeDamageTriggers(state: GameState, pending: PendingStrike): GameState {
  if (state.winner || pending.damageCancelled || pending.damage <= 0) return state;
  if (state.pendingEffectChoice) return state;
  const striker = state.players[pending.strikerPlayerId].battle.find(
    (c) => c.instanceId === pending.strikerInstanceId,
  );
  if (!striker || striker.cardId !== "RS-309") return state;
  const cands = gouraiCannonCandidates(state, pending.strikerPlayerId);
  const valid = [...cands.command, ...cands.power];
  if (valid.length === 0) return state;
  return openEffectChoice(state, {
    playerId: pending.strikerPlayerId,
    effectId: GOURAI_CANNON_EFFECT_ID,
    sourceCardId: "RS-309",
    sourceInstanceId: striker.instanceId,
    kind: "select_unit",
    phasePlayerId: pending.battlePhasePlayer,
    validInstanceIds: valid,
    selectedInstanceIds: [],
    optional: true,
  });
}

function finishGouraiCannon(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId, selected: string[]): GameState {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const ids = new Set(selected);
  const fromCommand = enemy.command.filter((c) => ids.has(c.instanceId));
  const fromPower = enemy.power.filter((c) => ids.has(c.instanceId) && !c.faceDown);
  const returning: CardInstance[] = [...fromCommand, ...fromPower].map((c) => ({
    instanceId: c.instanceId,
    cardId: c.cardId,
  }));
  const nextEnemy = {
    ...enemy,
    command: enemy.command.filter((c) => !ids.has(c.instanceId)),
    power: enemy.power.filter((c) => !(ids.has(c.instanceId) && !c.faceDown)),
    hand: [...enemy.hand, ...returning],
  };
  let next: GameState = {
    ...state,
    ...updatePlayer(state, enemyId, nextEnemy),
    log: [
      ...state.log,
      buildLogEntry(
        playerId,
        "named_effect",
        "RS-309",
        state.definitions,
        `gourai_cannon:${returning.map((c) => cardName(state.definitions, c.cardId)).join(",") || "none"}`,
      ),
    ],
  };
  next = finish(next, phasePlayerId);
  if (fromCommand.length > 0) next = afterCommandCardsLeft(next, enemyId, fromCommand.length);
  return next;
}

function resolveGouraiCannon(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const cands = gouraiCannonCandidates(state, playerId);
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const log = buildLogEntry(playerId, "resolve_effect_choice", "RS-309", state.definitions, `gourai_cannon:${instanceId}`);
  if (selected.length < 2) {
    const other = cands.command.includes(instanceId) ? cands.power : cands.command;
    if (other.length > 0) {
      return {
        state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: other, selectedInstanceIds: selected } },
        log,
      };
    }
  }
  return { state: finishGouraiCannon(state, playerId, pending.phasePlayerId, selected), log };
}

function skipGouraiCannon(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  const log = buildLogEntry(playerId, "skip_effect_choice", "RS-309", state.definitions, "gourai_cannon:skipped");
  if (selected.length === 0) return { state: finish(state, pending.phasePlayerId), log };
  return { state: finishGouraiCannon(state, playerId, pending.phasePlayerId, selected), log };
}

// ---------------------------------------------------------------------------
// RS-326 魔法猫スモーキー【究極奥義・猫だまし】（NC）
// 「自分の手札からBP16000以下のLユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。この効果で出したユニットは、
//  アタックもストライクもできず、自分がターンを終えるとき捨札になる。」（atwiki/page-487）

export const NEKO_DAMASHI_EFFECT_ID = "neko_damashi_hand_l_to_rush";
/** 【猫だまし】で出したユニット: このターン、アタックもストライクもできない。 */
export const NEKO_DAMASHI_RESTRICTION = "neko_damashi_no_attack_strike";

function nekoDamashiCandidates(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "L" && typeof def.bp === "number" && def.bp <= 16000;
    })
    .map((c) => c.instanceId);
}

function beginNekoDamashi(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const valid = nekoDamashiCandidates(state, ctx.playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: NEKO_DAMASHI_EFFECT_ID,
    sourceCardId: "RS-326",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_hand",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: valid,
    optional: true,
  });
}

function resolveNekoDamashi(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const nextPlayer = addTurnRestrictionModifier(
    {
      ...player,
      hand: player.hand.filter((c) => c.instanceId !== instanceId),
      rush: [...player.rush, { ...card, tempDiscardAtTurnEnd: true }],
    },
    instanceId,
    NEKO_DAMASHI_RESTRICTION,
  );
  const next: GameState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
  return {
    state: finish(next, pending.phasePlayerId),
    log: buildLogEntry(playerId, "resolve_effect_choice", "RS-326", state.definitions, `neko_damashi:${cardName(state.definitions, card.cardId)}`),
  };
}

function skipSimple(cardId: string): ChoiceSkipper {
  return (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    return {
      state: finish(state, pending.phasePlayerId),
      log: buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${pending.effectId}:skipped`),
    };
  };
}

// ---------------------------------------------------------------------------
// RS-327 天空聖者ブレイジェル【フェイタルブレイドの伝授】
// 「これが自軍ラッシュエリアにある間、特徴「レッド」を持つ自軍ユニットが敵軍ユニットを撃破するたび、自分は1枚ドローする。」
// （atwiki/page-488）。バトルでの撃破（バトルの相手）と、効果での撃破（解決中の効果の発生源のユニット）を数える。
// applyAction の後処理で、1アクションの前後の場から撃破された敵軍ユニットを数える。

function fieldUnit(state: GameState, playerId: PlayerId, instanceId: string | undefined): CardInstance | undefined {
  if (!instanceId) return undefined;
  const p = state.players[playerId];
  return p.battle.find((c) => c.instanceId === instanceId) ?? p.rush.find((c) => c.instanceId === instanceId);
}

function isRedUnit(state: GameState, playerId: PlayerId, card: CardInstance | undefined): boolean {
  return !!card && unitFeatures(state, playerId, card).includes("レッド");
}

export function applyFatalBladeDraws(before: GameState, after: GameState, action: GameAction): GameState {
  if (after.winner) return after;
  let next = after;
  for (const pid of ["player1", "player2"] as const) {
    const hasBrazier = (s: GameState) => s.players[pid].rush.some((c) => c.cardId === "RS-327");
    const braziers = Math.max(
      before.players[pid].rush.filter((c) => c.cardId === "RS-327").length,
      after.players[pid].rush.filter((c) => c.cardId === "RS-327").length,
    );
    if (braziers === 0 || (!hasBrazier(before) && !hasBrazier(after))) continue;
    const enemyId = opponent(pid);
    const enemyBefore = [...before.players[enemyId].battle, ...before.players[enemyId].rush];
    const enemyAfter = after.players[enemyId];
    const destroyed = enemyBefore.filter(
      (c) =>
        enemyAfter.discard.some((d) => d.instanceId === c.instanceId) &&
        !enemyAfter.battle.some((d) => d.instanceId === c.instanceId) &&
        !enemyAfter.rush.some((d) => d.instanceId === c.instanceId),
    );
    if (destroyed.length === 0) continue;
    // バトルの相手（アタック宣言・バトルの解決）。
    const battle =
      action.type === "battle"
        ? { attacker: action.attackerInstanceId, defender: action.defenderInstanceId }
        : before.pendingBattle
          ? { attacker: before.pendingBattle.attackerInstanceId, defender: before.pendingBattle.defenderInstanceId }
          : undefined;
    // 効果の発生源（解決中の選択・バトルエリアに出たときの NC）。
    const effectSource =
      before.pendingEffectChoice?.playerId === pid
        ? before.pendingEffectChoice.sourceInstanceId
        : action.type === "move_to_battle" && action.playerId === pid
          ? action.instanceId
          : undefined;
    let count = 0;
    for (const victim of destroyed) {
      let destroyer: string | undefined;
      if (battle && victim.instanceId === battle.defender) destroyer = battle.attacker;
      else if (battle && victim.instanceId === battle.attacker) destroyer = battle.defender;
      else destroyer = effectSource;
      if (isRedUnit(before, pid, fieldUnit(before, pid, destroyer))) count += 1;
    }
    if (count === 0) continue;
    const player = next.players[pid];
    next = {
      ...next,
      ...updatePlayer(next, pid, performDeckDraws(player, count * braziers, "top")),
      log: [...next.log, buildLogEntry(pid, "named_effect", "RS-327", next.definitions, `fatal_blade_draw:${count * braziers}`)],
    };
  }
  return next;
}

// ---------------------------------------------------------------------------
// RS-330 マジレジェンド【ファイヤートルネード】
// 「これをラッシュしたとき、敵軍ユニットと敵軍コマンドゾーンのカードを、すべて持ち主の山札に戻してシャッフルする。」
// （atwiki/page-491）。敵軍ユニットはラッシュエリア・バトルエリアの両方。

function applyFireTornado(state: GameState, ctx: GrantKeywordContext): GameState {
  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  const moving = [...enemy.rush, ...enemy.battle, ...enemy.command];
  if (moving.length === 0) return state;
  const clean = moving.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }));
  const nextEnemy = { ...enemy, rush: [], battle: [], command: [], deck: shuffleCards([...enemy.deck, ...clean]) };
  return {
    ...state,
    ...updatePlayer(state, enemyId, nextEnemy),
    log: [...state.log, buildLogEntry(ctx.playerId, "named_effect", "RS-330", state.definitions, `fire_tornado:${moving.length}`)],
  };
}

// ---------------------------------------------------------------------------
// RK-048 仮面ライダー斬鬼【音撃斬・雷電斬震】（NC）
// 「敵軍バトルエリアからユニットを1体選ぶ。そして、選んだユニットの必要パワーの数字より1つ多い数だけ自軍コマンドを
//  リリースしてもよい。そうしたとき、選んだユニットを撃破する。このとき、これはアタックすることができない。」
// - リリースはホールド状態の自軍コマンドから1枚ずつ選ぶ（数が足りなければリリースできず、撃破もしない）。
// - リリースしてから撃破する。CN が同じコマンドをリリースしても、発動した NC はそのまま実行する
//   （atwiki/page-453 Q5（2010/02/08 修正）。faq-rider_1 RK-048 の回答より優先 — docs/rules/README.md §1.2 例外2）。

export const ZANKI_TARGET_EFFECT_ID = "zanki_raiden_target";
export const ZANKI_RELEASE_EFFECT_ID = "zanki_raiden_release";
/** このターン、アタックできない（RK-048 で撃破したとき）。 */
export const NO_ATTACK_THIS_TURN_RESTRICTION = "no_attack_this_turn";

function beginZanki(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const valid = state.players[opponent(ctx.playerId)].battle.map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ZANKI_TARGET_EFFECT_ID,
    sourceCardId: "RK-048",
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: valid,
    optional: false,
  });
}

function resolveZankiTarget(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const target = state.players[opponent(playerId)].battle.find((c) => c.instanceId === instanceId);
  if (!target) return { error: "invalid_target" };
  const need = parsePowerCost(getDefinition(state.definitions, target.cardId)?.powerCost) + 1;
  const held = state.players[playerId].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  const log = buildLogEntry(playerId, "resolve_effect_choice", "RK-048", state.definitions, `zanki_target:${cardName(state.definitions, target.cardId)}`);
  if (held.length < need) return { state: finish(state, pending.phasePlayerId), log };
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: ZANKI_RELEASE_EFFECT_ID,
        kind: "select_command",
        validInstanceIds: held,
        selectedInstanceIds: [],
        selectCount: need,
        processedInstanceIds: [instanceId],
        optional: true,
      },
    },
    log,
  };
}

function resolveZankiRelease(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const need = pending.selectCount ?? 1;
  const log = buildLogEntry(playerId, "resolve_effect_choice", "RK-048", state.definitions, `zanki_release:${instanceId}`);
  if (selected.length < need) {
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
          selectedInstanceIds: selected,
        },
      },
      log,
    };
  }
  const ids = new Set(selected);
  const player = state.players[playerId];
  let next: GameState = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      command: player.command.map((c) => (ids.has(c.instanceId) ? { ...c, commandHeld: false } : c)),
    }),
  };
  if (pending.sourceInstanceId) {
    next = {
      ...next,
      ...updatePlayer(
        next,
        playerId,
        addTurnRestrictionModifier(next.players[playerId], pending.sourceInstanceId, NO_ATTACK_THIS_TURN_RESTRICTION),
      ),
    };
  }
  next = clearPending(next, pending.phasePlayerId);
  const targetId = pending.processedInstanceIds?.[0];
  if (targetId) {
    const leave = applyUnitLeave(next, targetId, "discard", pending.phasePlayerId);
    if (!("error" in leave)) next = leave.state;
  }
  if (!next.pendingEffectChoice && !next.pendingLeave) next = promoteDeferredBattleEntry(next);
  return { state: next, log };
}

// ---------------------------------------------------------------------------
// 共通の入口


const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {
  [GOURAI_CANNON_EFFECT_ID]: resolveGouraiCannon,
  [NEKO_DAMASHI_EFFECT_ID]: resolveNekoDamashi,
  [ZANKI_TARGET_EFFECT_ID]: resolveZankiTarget,
  [ZANKI_RELEASE_EFFECT_ID]: resolveZankiRelease,
};

const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {
  [GOURAI_CANNON_EFFECT_ID]: skipGouraiCannon,
  [NEKO_DAMASHI_EFFECT_ID]: skipSimple("RS-326"),
  [ZANKI_RELEASE_EFFECT_ID]: skipSimple("RK-048"),
};

export function isSet5AuditChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

export function tryResolveSet5AuditChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  return resolver ? resolver(state, playerId, instanceId) : null;
}

export function trySkipSet5AuditChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper || !pending.optional) return null;
  return skipper(state, playerId);
}

/** DSL grant_keyword（`cardId::effectId`）からの起点。対象外なら null。 */
export function trySet5AuditCardEffect(
  state: GameState,
  ctx: GrantKeywordContext,
  _keyword: string,
): GrantKeywordResult | null {
  switch (`${ctx.sourceCardId}::${ctx.effectId}`) {
    // RS-309【ゴウライキャノン】: ストライクを宣言した時点では何もしない（ダメージを与えたあと applySet5StrikeDamageTriggers）。
    case "RS-309::gouraikyanon":
      return { state, detail: ctx.effectId };
    case "RS-326::damashi": {
      const next = beginNekoDamashi(state, ctx);
      return next ? { state: next, detail: NEKO_DAMASHI_EFFECT_ID } : { state, detail: `${NEKO_DAMASHI_EFFECT_ID}:no_targets` };
    }
    case "RS-330::fuaiyatorunedo":
      return { state: applyFireTornado(state, ctx), detail: ctx.effectId };
    case "RK-048::geki_zan_kami_zan": {
      const next = beginZanki(state, ctx);
      return next ? { state: next, detail: ZANKI_TARGET_EFFECT_ID } : { state, detail: `${ZANKI_TARGET_EFFECT_ID}:no_targets` };
    }
    default:
      return null;
  }
}
