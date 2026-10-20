import { xg4GrantsResist } from "./xg4/xg4Fields";
import { rm3GrantsResist } from "./rm/rm3Fields";
import { rk14GrantsRegister } from "./rk/rk14Fields";
import type { CardDefinition } from "@rangers-strike/cards";
import { hasResist } from "@rangers-strike/cards";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { cardHasRegisterKeyword } from "../keywords/registerReaction";
import type {
  CardInstance,
  GameState,
  PendingLeave,
  PendingRegister,
  PlayerId,
} from "../types/game";
import { findInZone, updatePlayer } from "../core/helpers";
import { activeSearchCache } from "../core/searchCache";
import type { LeaveIntent } from "./operationCounters";
import { finalizeLeavePending } from "./operationCounters";
import { resolveDestroyedFactEffects } from "./leaveEffects";
import { riddenVehicleGrantsResist } from "./legend1/set7NamedEffectsB";
import { set8BGrantsResist } from "./legend1/set8NamedEffectsB";
import { stackOntoLargeGrantsKeyword } from "./stackOntoLargeGrants";
import { rk9EnemyKeywordsNullified } from "./rk/rk9Fields";
import { rk10AntlordGrantsResist } from "./rk/rk10Fields";

export function canOfferRegister(
  state: GameState,
  pending: Pick<
    PendingLeave,
    "toZone" | "fromZone" | "leavingCardId" | "skipRegister" | "registerEligible"
  > &
    Partial<Pick<PendingLeave, "ownerPlayerId" | "instanceId">>,
): boolean {
  if (pending.skipRegister) return false;
  if (pending.registerEligible !== true) return false;
  // RK-175 新1号【ライダーキック】: このターン、敵軍ユニットのレジストは無効（rules/rk/rk9Fields.ts）。
  if (pending.ownerPlayerId && rk9EnemyKeywordsNullified(state, pending.ownerPlayerId)) return false;
  if (pending.toZone !== "discard" || pending.fromZone !== "battle") return false;
  // ルール: R-KW-RESIST-04 — リリース状態でなければ使えない（レジストでホールド中のユニットは再レジスト不可）。
  if (pending.ownerPlayerId && pending.instanceId) {
    const card = state.players[pending.ownerPlayerId].battle.find(
      (c) => c.instanceId === pending.instanceId,
    );
    if (card?.commandHeld) return false;
  }
  if (cardHasRegisterKeyword(state, pending.leavingCardId)) return true;
  // RK-278 仮面ライダーナイト（2nd）の※（自軍捨札に「女」のユニットカードがあればレジスト。rules/rk/rk14Fields.ts）。
  if (pending.ownerPlayerId && rk14GrantsRegister(state, pending.ownerPlayerId, pending.leavingCardId)) return true;
  // RS-466 ギンガレオン【炎の星獣】: ライドしている S ユニットはレジストを得る（rules/legend1/set7NamedEffectsB.ts）。
  if (!pending.ownerPlayerId || !pending.instanceId) return false;
  if (riddenVehicleGrantsResist(state, pending.ownerPlayerId, pending.instanceId)) return true;
  // RS-547【守護獣の使徒】: WB を持つ自軍 M ユニットはレジストを得る（rules/legend1/set8NamedEffectsB.ts）。
  if (set8BGrantsResist(state, pending.ownerPlayerId, pending.instanceId)) return true;
  // RM-051 メガヘラクレス【メガビートフォーメーション】（自軍エリアに「レッドジャイロ」があればレジスト。rules/rm/rm3Fields.ts）。
  if (rm3GrantsResist(state, pending.ownerPlayerId, pending.instanceId)) return true;
  // RK-197 アントロード【女王の僕】: 特徴「女」を持つ自軍ユニットはレジストを得る（自軍だけ。rules/rk/rk10Fields.ts）。
  if (rk10AntlordGrantsResist(state, pending.ownerPlayerId, { cardId: pending.leavingCardId })) return true;
  // XG4-099 ホバリアン【バリア】: ライドしている「メカ」のユニットはレジストを得る（rules/xg4/xg4Fields.ts）。
  if (xg4GrantsResist(state, pending.ownerPlayerId, pending.instanceId)) return true;
  // RS-647 ピヨちゃん【ソウルバード】「このカードに重ねたユニットは、次の能力を得る⇒※レジスト」（rules/stackOntoLargeUnit.ts）。
  const host = state.players[pending.ownerPlayerId].battle.find((c) => c.instanceId === pending.instanceId);
  return !!host && stackOntoLargeGrantsKeyword(host, "register");
}

export function toPendingRegister(intent: LeaveIntent): PendingRegister {
  return {
    ownerPlayerId: intent.ownerPlayerId,
    instanceId: intent.instanceId,
    fromZone: "battle",
    leavingCardId: intent.leavingCardId,
    phasePlayerId: intent.phasePlayerId,
    followUpAttackerLeave: intent.followUpAttackerLeave,
    resumePendingStrike: intent.resumePendingStrike,
    discardAsDamage: intent.discardAsDamage,
  };
}

/** レジストでホールド留場。 */
export function applyRegisterHold(
  state: GameState,
  pending: PendingRegister,
): GameState {
  const owner = state.players[pending.ownerPlayerId];
  const found = findInZone(owner, pending.fromZone, pending.instanceId);
  if (!found) {
    return { ...state, pendingRegister: undefined };
  }

  const zone = owner[pending.fromZone].map((c) =>
    c.instanceId === pending.instanceId
      ? { ...c, registerHeld: true, commandHeld: true, battleActed: true }
      : c,
  );

  let nextState: GameState = {
    ...state,
    pendingRegister: undefined,
    activePlayer: pending.phasePlayerId,
    ...updatePlayer(state, pending.ownerPlayerId, {
      ...owner,
      [pending.fromZone]: zone,
    }),
  };

  if (pending.resumePendingStrike && state.pendingStrike) {
    nextState = {
      ...nextState,
      pendingStrike: state.pendingStrike,
    };
  }

  // ルール: R-KW-RESIST-05, R-DESTROY-02 — レジストで留まっても「撃破された」事実は残る。
  // 「撃破されたとき」は発動し、「撃破されて捨札になったとき」は発動しない。
  const fact = resolveDestroyedFactEffects(nextState, pending.ownerPlayerId, pending.leavingCardId);
  if (fact.logs.length > 0) {
    nextState = { ...fact.state, log: [...fact.state.log, ...fact.logs] };
  }

  return nextState;
}

/** レジストをスキップして通常の離場処理へ。 */
export function finalizeRegisterDiscard(
  state: GameState,
  pending: PendingRegister,
): GameState {
  const leaveIntent: LeaveIntent = {
    ownerPlayerId: pending.ownerPlayerId,
    instanceId: pending.instanceId,
    fromZone: pending.fromZone,
    toZone: "discard",
    leavingCardId: pending.leavingCardId,
    phasePlayerId: pending.phasePlayerId,
    followUpAttackerLeave: pending.followUpAttackerLeave,
    resumePendingStrike: pending.resumePendingStrike,
    discardAsDamage: pending.discardAsDamage,
    skipRegister: true,
  };
  return {
    ...finalizeLeavePending(state, leaveIntent, false),
    pendingRegister: undefined,
  };
}

export function isRegisterHeldUnit(
  definitions: Record<string, CardDefinition>,
  cardId: string,
  instance?: { registerHeld?: boolean },
): boolean {
  return !!instance?.registerHeld && (
    cardHasKeyword(definitions, cardId, "register") || hasResist(definitions, cardId)
  );
}

/**
 * レジストホールド中のアタック／ストライク可否。
 * ルール: R-HOLD-03 — ホールド中のアタック・ストライクの可否は [未確定]。従来どおり不可のまま。
 */
export function registerBlocksBattleAction(
  definitions: Record<string, CardDefinition>,
  cardId: string,
  instance?: { registerHeld?: boolean },
): boolean {
  return isRegisterHeldUnit(definitions, cardId, instance);
}

export function clearRegisterHeldOnRelease(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  for (const zone of ["rush", "battle"] as const) {
    const idx = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (idx < 0) continue;
    const nextZone = player[zone].map((c) =>
      c.instanceId === instanceId
        ? { ...c, registerHeld: false, commandHeld: false }
        : c,
    );
    return {
      ...state,
      ...updatePlayer(state, playerId, { ...player, [zone]: nextZone }),
    };
  }
  return state;
}

/**
 * スタートフェイズでレジストホールド中のバトルユニットがラッシュに戻るときの状態。
 * ルール: R-HOLD-02, R-KW-RESIST-04, R-START-01 — スタートフェイズでリリースされるのはコマンドだけ。
 * ユニットのホールド（registerHeld / commandHeld）はリリース効果がない限り続く。
 * ルール: R-START-02 — バトルエリア⇔ラッシュエリアの移動ではホールド状態は消えない。
 */
export function prepareRegisterUnitReturnedToRush(card: CardInstance): CardInstance {
  if (!card.registerHeld) return card;
  const next = { ...card };
  delete next.battleActed;
  return next;
}

const NON_UNIT_ZONES = ["deck", "hand", "discard", "power", "command", "operation", "exile"] as const;

/** エリア（ラッシュ・バトル）にあるユニットだけが持つ付加情報。 */
const AREA_ONLY_FIELDS = [
  "bpModifier",
  "spModifier",
  "spOverride",
  "registerHeld",
  "battleActed",
  "activatedNcEffects",
  "jointComboGrants",
  "mountedOnInstanceId",
] as const;

function stripAreaState(card: CardInstance, zone: (typeof NON_UNIT_ZONES)[number]): CardInstance {
  // 対局中のアクションごとにすべてのゾーンのカードを調べるので、配列のメソッドを使わずに見る（AREA_ONLY_FIELDS と同じ並び）。
  const hasAreaField =
    card.bpModifier !== undefined ||
    card.spModifier !== undefined ||
    card.spOverride !== undefined ||
    card.registerHeld !== undefined ||
    card.battleActed !== undefined ||
    card.activatedNcEffects !== undefined ||
    card.jointComboGrants !== undefined ||
    card.mountedOnInstanceId !== undefined;
  // コマンドゾーン以外ではホールド（横向き）という状態自体がない。
  const staleHold = zone !== "command" && (card.commandHeld || card.mothershipHold || card.paymentHeld);
  // レジストのホールドが残ったままコマンドゾーンへ来たカードはリリース状態で置く（R-ZONE-09）。
  const registerHeldInCommand = zone === "command" && card.registerHeld;
  // リリースされたコマンドには「支払い済み」の印は残らない。
  const releasedPayment = zone === "command" && card.paymentHeld && !card.commandHeld;
  if (!hasAreaField && !staleHold && !registerHeldInCommand && !releasedPayment) return card;
  const cleared = { ...card };
  for (const f of AREA_ONLY_FIELDS) delete cleared[f];
  if (releasedPayment) delete cleared.paymentHeld;
  if (staleHold || registerHeldInCommand) {
    delete cleared.commandHeld;
    delete cleared.mothershipHold;
    delete cleared.paymentHeld;
  }
  return cleared;
}

/**
 * ルール: R-HOLD-02, R-ZONE-04 — ユニットでなくなれば（捨札・コマンド・パワー・手札等）ユニットのホールドは解除され、
 * エリアで得た付加情報（BP/SP修正・ホールド状態等）もすべて消える。
 * 場を離れたカードに残った registerHeld / commandHeld / bpModifier 等をここで消す。
 */
export function clearRegisterHoldOffField(state: GameState): GameState {
  let next = state;
  const cleanZones = activeSearchCache()?.cleanZones;
  for (const pid of ["player1", "player2"] as const) {
    const player = next.players[pid];
    let patch: Partial<typeof player> | undefined;
    // ルール: R-KW-RIDE-05, R-KW-RC-01 — ライドしていたビークルがエリアを離れたら、ユニットはライドしていない状態になる
    // （ライドオフの手順ではないので RC は発動しない）。
    // 場のインスタンス ID の集合は、ライドしているユニットがあるときだけ作る。
    let fieldIds: Set<string> | undefined;
    const isOnField = (instanceId: string): boolean =>
      (fieldIds ??= new Set([...player.rush, ...player.battle].map((c) => c.instanceId))).has(instanceId);
    for (const zone of ["rush", "battle"] as const) {
      const cards = player[zone];
      if (!cards.some((c) => c.mountedOnInstanceId && !isOnField(c.mountedOnInstanceId))) continue;
      patch = {
        ...patch,
        [zone]: cards.map((c) => {
          if (!c.mountedOnInstanceId || isOnField(c.mountedOnInstanceId)) return c;
          const dismounted = { ...c };
          delete dismounted.mountedOnInstanceId;
          return dismounted;
        }),
      };
    }
    for (const zone of NON_UNIT_ZONES) {
      const cards = player[zone];
      if (!cards) continue;
      // CPU の探索の間は、確かめ済みの配列を調べ直さない（core/searchCache.ts）。
      if (cleanZones?.get(cards) === zone) continue;
      // 変わったカードが無ければ配列を作り直さない。
      let mapped: CardInstance[] | undefined;
      for (let i = 0; i < cards.length; i += 1) {
        const c = cards[i]!;
        const n = stripAreaState(c, zone);
        if (mapped) mapped.push(n);
        else if (n !== c) {
          mapped = cards.slice(0, i);
          mapped.push(n);
        }
      }
      if (mapped) patch = { ...patch, [zone]: mapped };
      else cleanZones?.set(cards, zone);
    }
    if (patch) next = { ...next, ...updatePlayer(next, pid, { ...player, ...patch }) };
  }
  return next;
}
