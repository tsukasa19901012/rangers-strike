/**
 * XG6-037 仮面ライダーアクセル【振り切るぜ】（cardSpec XG6-023-044.c の監査）。
 *
 * 「自軍バトルフェイズ中、これが自軍ラッシュエリアでライドしていなければ、Sビークルを1体選んでもよい。そうしたとき、このターン、これは本来のテキストを
 *  もたないSビークルとして扱い、選んだビークルの効果名を持つテキストと、次のテキストが追加される。→「これは、ライドされていなくてもバトルエリアに
 *  出ることができる」「自軍バトルフェイズ終了時、これにライドしているユニットをライドオフさせて自軍ラッシュエリアに置く」」（atwiki/page-2318）
 *
 * - 起動（activate_field_unit_ability。rules/fieldActivatedAbilities.ts から rules/xg6/xg6dFields.ts の XG6_FURIKIRU_ACTIVATION 経由）: 自軍バトルフェイズ中、自軍ラッシュエリアのライドしていないこれ。
 *   選べるのは両軍の場（ラッシュエリア・バトルエリア）の S ビークル（ライド中も）。M・L ビークルとこれ自身は選べない（利用者の決定 2026-10-20・U-30）。
 *   選ばなくてもよい（見送れる）。
 * - 選んだら、このターンの間、これを S ビークルの定義（`<cardId>@xg6-037:<選んだビークル>`。テキストは選んだビークルの効果名を持つテキストと
 *   追加の2文。本来の名前・カテゴリ・特徴・必要パワー。ビークルなので BP・SP はない）として扱う（XG2-019 知恵の樹モークの逆向き）。
 * - 「ライドされていなくてもバトルエリアに出ることができる」: rules/vehicleRules.ts（xg6IsFurikiruVehicle）。
 * - 選んだビークルの効果名を持つ「これがバトルエリアに出たとき」の効果: これがバトルエリアに出たとき（ライドされて一緒に出たときも）、自軍ターン中なら
 *   選んだビークルの DSL の名前つきの enter_battle の効果を、これを発生源として発動する。ライドしたユニットと一緒に出たときに
 *   ビークル側の処理で発動する RK-179【体当たり攻撃】・RK-189【地空人の精霊パワー】は、その処理を直接呼ぶ（rules/rk/rk9UnitEffects.ts）。
 * - それ以外の選んだビークルの効果名を持つテキスト（ライドしているユニットへの能力・コンビネーション・手札が捨札に置かれたとき・ラッシュエリアに
 *   戻るとき等）: 各ビークルの処理が、ビークルの判定に rules/xg6/xg6dFields.ts isSameVehicleTextIdentity を使い、これを選んだビークルとして扱う
 *   （利用者の依頼 2026-10-20・XG6-037_写せるSビークル効果.md の A）。カード名・※の判定はそのまま（これのカード名は本来のまま）。
 * - 「自軍バトルフェイズ終了時、…ライドオフさせて自軍ラッシュエリアに置く」: 自軍バトルフェイズを終えるとき（XG2 の battlePhaseEnd の列）。
 *   ライドしていたユニットをラッシュエリアへ戻す（RC は発動しない。atwiki コメント欄）。
 * - ターンが変わるか場を離れたら元のカードに戻す（ライドしているユニットがいればライドを外す。rules/xg6/xg6Hooks.ts の後処理）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { cardName, getDefinition, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { openEffectChoice } from "../pendingChoices";
import { patchPlayer } from "../playerPatches";
import { openRk9JCrosser, openRk9Jungler } from "../rk/rk9UnitEffects";
import { xg2Hook } from "../xg2/xg2Core";
import { CHOICE_RESOLVERS, CHOICE_SKIPPERS, finish, skipped } from "./xg6Common";
import { addXg6Mark, hasXg6Mark } from "./xg6Fields";
import { XG6_FURIKIRU_ACTIVATION, XG6_FURIKIRU_MARK, xg6FurikiruCopiedCardId, xg6FurikiruOriginalCardId, xg6IsFurikiruVehicle } from "./xg6dFields";
import { choice } from "./xg6aEffects";

const CARD_ID = "XG6-037";
export const XG6_FURIKIRU_EFFECT_ID = "xg6037_furikiru";
const FURIKIRU_MARK_KEY = "XG6-037:furikiru";
const ADDED_TEXT = "「これは、ライドされていなくてもバトルエリアに出ることができる」「自軍バトルフェイズ終了時、これにライドしているユニットをライドオフさせて自軍ラッシュエリアに置く」";

function fieldOf(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  return [...state.players[playerId].rush, ...state.players[playerId].battle];
}

function isSmallVehicle(state: GameState, card: CardInstance): boolean {
  return getDefinition(state.definitions, card.cardId)?.type === "vehicle" && unitSizeOf(state.definitions, card) === "S";
}

/** 【振り切るぜ】で選べる S ビークル（両軍の場。ライド中も。これ自身は除く。U-30）。 */
function furikiruCandidates(state: GameState, playerId: PlayerId, selfId: string): string[] {
  const enemyId = opponent(playerId);
  return [
    ...fieldOf(state, playerId).filter((c) => c.instanceId !== selfId && isSmallVehicle(state, c)),
    ...fieldOf(state, enemyId).filter((c) => isSmallVehicle(state, c) && isSelectableByOpponentEffect(state, playerId, c.instanceId, CARD_ID, playerId)),
  ].map((c) => c.instanceId);
}

/** 起動できるか（自軍バトルフェイズ中、自軍ラッシュエリアでライドしていないこれ）。 */
export function canActivateXg6Furikiru(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return false;
  if (state.pendingEffectChoice || state.pendingBattle || state.pendingStrike || state.pendingLeave || state.pendingCommandPayment || state.pendingRegister) return false;
  if (!isSameCardIdentity(card.cardId, CARD_ID) || card.mountedOnInstanceId) return false;
  if (!state.players[playerId].rush.some((c) => c.instanceId === card.instanceId)) return false;
  return furikiruCandidates(state, playerId, card.instanceId).length > 0;
}

export function activateXg6Furikiru(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  return openEffectChoice(
    state,
    choice({ playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, CARD_ID, XG6_FURIKIRU_EFFECT_ID, "select_unit", furikiruCandidates(state, playerId, card.instanceId), true),
  );
}

XG6_FURIKIRU_ACTIVATION.canActivate = canActivateXg6Furikiru;
XG6_FURIKIRU_ACTIVATION.activate = activateXg6Furikiru;

/** 効果名を持つテキスト（【名前】から次の【 か ※ の手前まで）。 */
function namedTexts(text: string | undefined): string {
  return (text ?? "").match(/【[^】]+】[^【※]*/g)?.map((t) => t.trim()).join(" ") ?? "";
}

function furikiruDefinition(own: CardDefinition, copied: CardDefinition | undefined, aliasId: string): CardDefinition {
  const named = namedTexts(copied?.text);
  return {
    id: aliasId,
    name: own.name,
    type: "vehicle",
    category: own.category,
    rarity: own.rarity,
    expansion: own.expansion,
    powerCost: own.powerCost,
    size: "S",
    features: own.features,
    text: named ? `${named} ${ADDED_TEXT}` : ADDED_TEXT,
  } as CardDefinition;
}

CHOICE_RESOLVERS[XG6_FURIKIRU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const self = selfId ? state.players[playerId].rush.find((c) => c.instanceId === selfId) : undefined;
  const chosen = [...fieldOf(state, playerId), ...fieldOf(state, opponent(playerId))].find((c) => c.instanceId === instanceId);
  if (!chosen) return { error: "invalid_target" };
  // 選んだビークルの持ち主（両軍の場のどこか）。ライドしていないこれがラッシュエリアに残っていなければ、何もしない。
  if (!self || self.mountedOnInstanceId || !isSameCardIdentity(self.cardId, CARD_ID)) return finish(state, pending, "self_gone");
  const ownDef = getDefinition(state.definitions, self.cardId);
  if (!ownDef) return { error: "invalid_target" };
  const copiedCardId = xg6FurikiruCopiedCardId(chosen.cardId) ?? chosen.cardId;
  const aliasId = `${self.cardId}${XG6_FURIKIRU_MARK}${copiedCardId}`;
  return finish(state, pending, cardName(state.definitions, chosen.cardId), (s) => {
    let next: GameState = { ...s, definitions: { ...s.definitions, [aliasId]: furikiruDefinition(ownDef, getDefinition(s.definitions, copiedCardId), aliasId) } };
    next = patchPlayer(next, playerId, (p) => ({ ...p, rush: p.rush.map((c) => (c.instanceId === self.instanceId ? { ...c, cardId: aliasId } : c)) }));
    return addXg6Mark(next, { key: FURIKIRU_MARK_KEY, playerId, instanceId: self.instanceId, ref: copiedCardId });
  });
};
CHOICE_SKIPPERS[XG6_FURIKIRU_EFFECT_ID] = (state) => skipped(state, state.pendingEffectChoice!);

/**
 * これがバトルエリアに出たとき（ライドしたユニットと一緒に出たときも）、選んだビークルの効果名を持つ「これがバトルエリアに出たとき」の効果を発動する
 * （rules/combo.ts の進入の処理から。rules/xg6/xg6Hooks.ts tryXg6OnEnterBattle）。
 */
export function tryXg6FurikiruOnEnterBattle(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (state.activePlayer !== playerId) return state;
  const battle = state.players[playerId].battle;
  let vehicle: CardInstance | undefined;
  if (xg6IsFurikiruVehicle(card.cardId)) {
    // ライドされて一緒に出たときは、ライドしたユニットの進入で扱う（二重に発動しない）。
    if (fieldOf(state, playerId).some((c) => c.mountedOnInstanceId === card.instanceId)) return state;
    vehicle = battle.find((c) => c.instanceId === card.instanceId);
  } else if (card.mountedOnInstanceId) {
    vehicle = battle.find((c) => c.instanceId === card.mountedOnInstanceId && xg6IsFurikiruVehicle(c.cardId));
  }
  const copied = vehicle ? xg6FurikiruCopiedCardId(vehicle.cardId) : undefined;
  if (!vehicle || !copied) return state;
  const fx = tryResolveDslTriggeredEffects({
    state,
    cardId: copied,
    instanceId: vehicle.instanceId,
    playerId,
    phasePlayerId: playerId,
    triggerType: "enter_battle",
    logAction: "enter_battle",
    effectFilter: (e) => !!e.name,
  });
  let next = fx.logs.length > 0 ? { ...fx.state, log: [...fx.state.log, ...fx.logs] } : fx.state;
  // ライドしたユニットと一緒に出たときにビークル側の処理で発動する効果（DSL の効果は印だけ）。
  if (isSameCardIdentity(copied, "RK-179")) next = openRk9Jungler(next, playerId, vehicle.instanceId);
  if (isSameCardIdentity(copied, "RK-189")) next = openRk9JCrosser(next, playerId, vehicle.instanceId);
  return next;
}

/** これにライドしているユニットのライドを外す（バトルエリアにいればラッシュエリアに置く）。 */
function rideOffRiders(state: GameState, ownerId: PlayerId, vehicleId: string): GameState {
  const p = state.players[ownerId];
  if (![...p.rush, ...p.battle].some((c) => c.mountedOnInstanceId === vehicleId)) return state;
  return patchPlayer(state, ownerId, (pl) => {
    const unmount = (c: CardInstance): CardInstance => {
      if (c.mountedOnInstanceId !== vehicleId) return c;
      const { mountedOnInstanceId: _m, ...rest } = c;
      return rest as CardInstance;
    };
    const riders = pl.battle.filter((c) => c.mountedOnInstanceId === vehicleId).map(unmount);
    return { ...pl, battle: pl.battle.filter((c) => c.mountedOnInstanceId !== vehicleId), rush: [...pl.rush.map(unmount), ...riders] };
  });
}

/** 「自軍バトルフェイズ終了時、これにライドしているユニットをライドオフさせて自軍ラッシュエリアに置く」。 */
xg2Hook("battlePhaseEnd", (state, endingPlayerId) => {
  let next = state;
  for (const c of fieldOf(state, endingPlayerId)) {
    if (xg6IsFurikiruVehicle(c.cardId)) next = rideOffRiders(next, endingPlayerId, c.instanceId);
  }
  return next;
});

/** ターンが変わったか場を離れた【振り切るぜ】のカードを元のカードに戻す（各アクションの後。rules/xg6/xg6Hooks.ts）。 */
export function restoreXg6Furikiru(state: GameState): GameState {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    const p = next.players[pid];
    const zones = [p.hand, p.deck, p.rush, p.battle, p.power, p.command, p.discard, p.operation];
    for (const card of zones.flat()) {
      if (!xg6IsFurikiruVehicle(card.cardId)) continue;
      const onField = [...p.rush, ...p.battle].some((c) => c.instanceId === card.instanceId);
      if (onField && hasXg6Mark(next, FURIKIRU_MARK_KEY, pid, card.instanceId)) continue;
      const original = xg6FurikiruOriginalCardId(card.cardId);
      next = rideOffRiders(next, pid, card.instanceId);
      next = patchPlayer(next, pid, (pl) => {
        const restore = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === card.instanceId ? { ...c, cardId: original } : c));
        return {
          ...pl,
          hand: restore(pl.hand),
          deck: restore(pl.deck),
          rush: restore(pl.rush),
          battle: restore(pl.battle),
          power: restore(pl.power),
          command: restore(pl.command),
          discard: restore(pl.discard),
          operation: restore(pl.operation),
        };
      });
    }
  }
  return next;
}
