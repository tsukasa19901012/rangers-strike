/**
 * クロスギャザー ザ・ファーストエンカウント XG1-001〜XG1-020（バトルジャパン〜ターボロボ）のカード固有の効果（cardSpec XG1-001-020 の監査）。
 *
 * - DSL の `xg1::XG1-NNN::name` から呼ばれる NC の効果（XG1-001・002・003・004・005・006・008・009・010）。
 * - `xg1aAfterBattle`: XG1-003【新飛羽返し】（バトルで撃破したとき。rules/operationCounters.ts resolveBattlePendingCore）。
 * - `openXg1aStrikeReplacement`: XG1-009【マスキークラッシュ】（ストライクのダメージの置きかえ。core/applyAction.ts completeStrike）。
 * - XG1-012【ボクシングスタイル】・XG1-014【キングスティック】の起動（rules/fieldActivatedAbilities.ts）。
 * 継続効果（XG1-011・012・020 の SP、XG1-015・017・018・019・013）は rules/xg1/xg1Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PendingStrike, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { effectiveCommandCategories, getDefinition, unitSizeOf } from "../../core/catalog";
import { drawOne, opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { prepareWingUnitReturnedToRush } from "../../keywords/battleKeywords";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { hasBattleNcEffect, markBattleNcEffect } from "../namedUnitEffects";
import { patchPlayer } from "../playerPatches";
import { openEffectChoice } from "../pendingChoices";
import { rk1IsSmallNow } from "../rk/rk1Features";
import {
  type BaseCtx,
  base,
  close,
  ctxBase,
  destroyAll,
  fieldUnits,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  proceed,
  selectableEnemy,
  simpleSkip,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import { XG1_KEYWORDS, XG1_RESOLVERS, XG1_SKIPPERS, noop } from "./xg1Core";
import { xg1bAfterBattle } from "./xg1bEffects";
import { xg1cAfterBattle } from "./xg1cEffects";
import { xg1eAfterBattle } from "./xg1eEffects";
import { costNumber, enemySUnits, fieldUnitToCommandReleased, holdThen, isUnitDef, registerHold, releasedCommands, residentZoneCards, residentsGuarded, unitCatsNow } from "./xg1Shared";

const CATEGORIES = ["WB", "MA", "OT", "ET", "DA"];

function pickOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

/** NC の効果を発動したユニットに目印を付ける（「NC が成立したとき」の効果の判定に使う）。 */
function markNc(state: GameState, ctx: GrantKeywordContext, effectId: string): GameState {
  return ctx.triggerSourceInstanceId ? markBattleNcEffect(state, ctx.playerId, ctx.triggerSourceInstanceId, effectId) : state;
}

// ---------------------------------------------------------------------------
// XG1-001 バトルジャパン【空手技】（NC）
// 「「SP1」レジストを持つ敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-1544）
// エリアを問わない（カード評価「ラッシュエリアに届くのが強み」）。レジストはカードの持つキーワード（※レジスト）。

const KARATE_EFFECT_ID = "xg1_001_karate";

XG1_KEYWORDS["XG1-001::karate"] = (state, ctx) => {
  const ids = enemySUnits(state, ctx.playerId, "XG1-001", (c) => cardHasKeyword(state.definitions, c.cardId, "register", { state, playerId: opponent(ctx.playerId) }));
  if (ids.length === 0) return { state, detail: "xg1_001:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-001", KARATE_EFFECT_ID, ids, false)), detail: KARATE_EFFECT_ID };
};

XG1_RESOLVERS[KARATE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-001", `${KARATE_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-002 デンジレッド【デンジスティック】（NC）
// 「敵軍常駐置き場にカードが2枚以上あれば、その中から1枚選んでもよい（ウラ向きのカードはウラ向きのまま選ぶ）。そうしたとき、選んだカードを持ち主の
//  パワーゾーンに置く。このとき、選んだカードがウラ向きだったなら、ダメージにして置く。」（atwiki/page-1597）
// 常駐置き場のカードは、置かれた常駐と、常駐に重ねたカード（ウラ向きのものも。カード評価「闇の戒律やゲゲル、クロックアップなど」）。
// 常駐を選べば、それに重ねたカードは捨札になる。

const DENJI_STICK_EFFECT_ID = "xg1_002_denji_stick";

XG1_KEYWORDS["XG1-002::denji_stick"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const cards = residentZoneCards(state, enemyId);
  if (cards.length < 2) return { state, detail: "xg1_002:fewer_than_two" };
  // XG1-081【パコの守護神】: 磁雷神のある相手の常駐置き場のカードは選べない（rules/xg1/xg1Shared.ts）。
  const ids = residentsGuarded(state, enemyId) ? [] : cards.map((e) => e.card.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_002:no_targets" };
  return { state: openAfter(state, { ...pickOne(ctxBase(ctx), "XG1-002", DENJI_STICK_EFFECT_ID, ids, true), kind: "select_unit" }), detail: DENJI_STICK_EFFECT_ID };
};

XG1_RESOLVERS[DENJI_STICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const entry = residentZoneCards(state, enemyId).find((e) => e.card.instanceId === instanceId);
  if (!entry) return { error: "invalid_target" };
  const faceDown = entry.card.faceDown === true;
  const placed: CardInstance = faceDown ? { ...stripForZone(entry.card), faceDown: true } : stripForZone(entry.card);
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const operation = entry.parent
      ? p.operation.map((op) => (op.instanceId === entry.parent ? { ...op, stackedCards: (op.stackedCards ?? []).filter((c) => c.instanceId !== instanceId) } : op))
      : p.operation.filter((op) => op.instanceId !== instanceId);
    const leftover = entry.parent ? [] : (entry.card.stackedCards ?? []).map(stripForZone);
    return { ...p, operation, power: [...p.power, placed], damage: faceDown ? p.damage + 1 : p.damage, discard: [...p.discard, ...leftover] };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-002", `${DENJI_STICK_EFFECT_ID}:${faceDown ? "damage" : "power"}`) };
};
XG1_SKIPPERS[DENJI_STICK_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-003 バルイーグル【新飛羽返し】（NC・ウイング）
// 「SP1 これがバトルで敵軍ユニットを撃破したとき、これが撃破したユニットと同じカード名の敵軍ユニットをすべて撃破する。（この効果はこれがウイングで
//  アタックするときはナンバーに関係なく発動する）」（atwiki/page-1594）
// NC が成立したら目印を付け（SP1 は DSL の SP1）、バトルの解決の後で同じカード名の敵軍ユニット（エリアを問わない）をすべて撃破する。
// ウイングでラッシュエリアからアタックしたときは NC に関係なく発動する（Q1: NC の発動ではない）。

const HIBAGAESHI_MARK = "xg1_003_shin_hibagaeshi";

XG1_KEYWORDS["XG1-003::shin_hibagaeshi"] = (state, ctx) => ({ state: markNc(state, ctx, HIBAGAESHI_MARK), detail: HIBAGAESHI_MARK });

/** バトルの解決の後の続き（rules/operationCounters.ts resolveBattlePendingCore。rm2AfterBattle と同じ形）。 */
export function xg1aAfterBattle(
  state: GameState,
  pending: PendingBattle,
  r: { attacker: CardInstance; defender: CardInstance; defenderOwner: PlayerId; attackerBp: number; defenderBp: number; defenderDestroyed: boolean; attackerDestroyed: boolean },
): ((s: GameState) => GameState) | undefined {
  const sides = [
    { self: r.attacker, selfOwner: pending.attackerPlayerId, enemy: r.defender, enemyOwner: r.defenderOwner, enemyDestroyed: r.defenderDestroyed, attacking: true },
    { self: r.defender, selfOwner: r.defenderOwner, enemy: r.attacker, enemyOwner: pending.attackerPlayerId, enemyDestroyed: r.attackerDestroyed, attacking: false },
  ];
  const hits: Array<{ selfOwner: PlayerId; enemyOwner: PlayerId; name: string | undefined; destroyedId: string; sourceInstanceId: string }> = [];
  for (const s of sides) {
    if (!isSameCardIdentity(s.self.cardId, "XG1-003") || s.selfOwner === s.enemyOwner || !s.enemyDestroyed) continue;
    const wing = s.attacking && zoneOfField(state, s.selfOwner, s.self.instanceId) === "rush";
    if (!wing && !hasBattleNcEffect(s.self, HIBAGAESHI_MARK)) continue;
    hits.push({ selfOwner: s.selfOwner, enemyOwner: s.enemyOwner, name: getDefinition(state.definitions, s.enemy.cardId)?.name, destroyedId: s.enemy.instanceId, sourceInstanceId: s.self.instanceId });
  }
  // XG1-037【虚空からの一撃】（rules/xg1/xg1bEffects.ts）。
  const kokuu = xg1bAfterBattle(state, pending.attackerPlayerId, r.attacker, r.defenderOwner, r.defender, r.defenderDestroyed);
  // XG1-042【吸血】・XG1-053【バーニングライダーパンチ】（rules/xg1/xg1cEffects.ts）。
  const c0 = xg1cAfterBattle(state, pending, r);
  // XG1-095【カブトランサー】（rules/xg1/xg1eEffects.ts）。
  const e = xg1eAfterBattle(state, pending, r);
  const c = c0 && e ? (s: GameState) => e(c0(s)) : (c0 ?? e);
  const before = kokuu && c ? (s: GameState) => c(kokuu(s)) : (kokuu ?? c);
  if (hits.length === 0) return before;
  return (s) => {
    let next = before ? before(s) : s;
    for (const h of hits) {
      const ids = fieldUnits(next, h.enemyOwner)
        .filter((c) => c.instanceId !== h.destroyedId && sameCardName(getDefinition(next.definitions, c.cardId)?.name, h.name))
        .map((c) => c.instanceId);
      next = destroyAll(next, { playerId: h.selfOwner, phasePlayerId: pending.phasePlayerId, sourceInstanceId: h.sourceInstanceId }, "XG1-003", `${HIBAGAESHI_MARK}_destroy`, ids);
    }
    return next;
  };
}

// ---------------------------------------------------------------------------
// XG1-004 ゴーグルレッド【レッドルビームチ】（NC）
// 「敵軍コマンドゾーンからSユニットのカードを1枚選んでもよい。そうしたとき、相手は選ばれたカードをラッシュエリアかバトルエリアに出す。このときバトル
//  エリアに出したなら、相手は自分自身の山札の上から1枚引いて、自分自身のコマンドゾーンに置く。」（atwiki/page-1680）
// どちらに出すかは相手が選ぶ（カード評価）。補充するコマンドはリリース状態（カード評価）。

const RUBEAMCHI_EFFECT_ID = "xg1_004_red_rubeamchi";
const RUBEAMCHI_AREA_EFFECT_ID = "xg1_004_red_rubeamchi_area";

XG1_KEYWORDS["XG1-004::red_rubeamchi"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].command
    .filter((c) => isUnitDef(state, c.cardId) && unitSizeOf(state.definitions, c) === "S")
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_004:no_targets" };
  return { state: openAfter(state, { ...pickOne(ctxBase(ctx), "XG1-004", RUBEAMCHI_EFFECT_ID, ids, true), kind: "select_command" }), detail: RUBEAMCHI_EFFECT_ID };
};

XG1_RESOLVERS[RUBEAMCHI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = openNext(close(state, pending), pending, {
    ...base({ playerId: enemyId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, "XG1-004"),
    effectId: RUBEAMCHI_AREA_EFFECT_ID,
    kind: "confirm",
    validInstanceIds: ["rush", "battle"],
    selectCount: 1,
    optional: false,
    selectedInstanceIds: [instanceId],
  });
  return { state: next, log: logFor(state, playerId, "XG1-004", `${RUBEAMCHI_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[RUBEAMCHI_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[RUBEAMCHI_AREA_EFFECT_ID] = (state, playerId, area) => {
  const pending = state.pendingEffectChoice!;
  const cardId = pending.selectedInstanceIds?.[0];
  const card = state.players[playerId].command.find((c) => c.instanceId === cardId);
  let next = close(state, pending);
  if (card) {
    next = patchPlayer(next, playerId, (p) => {
      const command = p.command.filter((c) => c.instanceId !== card.instanceId);
      const unit = stripForZone(card);
      return area === "battle" ? { ...p, command, battle: [...p.battle, unit] } : { ...p, command, rush: [...p.rush, unit] };
    });
    if (area === "battle") {
      next = patchPlayer(next, playerId, (p) => {
        const top = p.deck[0];
        if (!top || p.command.length >= COMMAND_ZONE_MAX) return p;
        return { ...p, deck: p.deck.slice(1), command: [...p.command, { ...stripForZone(top), commandHeld: false }] };
      });
    }
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-004", `${RUBEAMCHI_AREA_EFFECT_ID}:${area}`) };
};

// ---------------------------------------------------------------------------
// XG1-005 ダイナレッド【ドリームギャラクシー】（NC）
// 「自軍コマンドのカテゴリの数を数えて、その数以下の必要パワーの数字を持つ敵軍Sユニットを１体選び、持ち主のコマンドゾーンにホールド状態で置く。
//  置けなければ捨札にする。」（atwiki/page-1595）
// 数えるのはカテゴリの種類（ホールド状態のコマンドも。マルチカテゴリはそれぞれ）。敵軍 S ユニットはエリアを問わない。

const DREAM_GALAXY_EFFECT_ID = "xg1_005_dream_galaxy";

function commandCategoryKinds(state: GameState, playerId: PlayerId): number {
  const p = state.players[playerId];
  const cats = new Set<string>();
  for (const c of p.command) for (const cat of effectiveCommandCategories(p, state.definitions, c.cardId) as string[]) cats.add(cat);
  return cats.size;
}

XG1_KEYWORDS["XG1-005::dream_galaxy"] = (state, ctx) => {
  const n = commandCategoryKinds(state, ctx.playerId);
  const ids = enemySUnits(state, ctx.playerId, "XG1-005", (c) => costNumber(state, c.cardId) <= n);
  if (ids.length === 0) return { state, detail: "xg1_005:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-005", DREAM_GALAXY_EFFECT_ID, ids, false)), detail: `${DREAM_GALAXY_EFFECT_ID}:${n}` };
};

XG1_RESOLVERS[DREAM_GALAXY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "command_held");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-005", `${DREAM_GALAXY_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-006 レッドワン【バイオソード】・XG1-010 レッドファルコン【ライブラスター】（NC）
// 「カテゴリを1つ宣言してもよい。そうしたとき、宣言したカテゴリを持つSユニットを相手に1体選ばせ、持ち主のパワーゾーンに送る。」（atwiki/page-1598）
// 「…相手に1枚選ばせ、持ち主のコマンドゾーンに置く。置けなければ捨札にする。」（atwiki/page-1599）
// 相手が選ぶのは両軍の S ユニット（自軍のユニットも。コメント欄・カード評価）。コマンドゾーンにはリリース状態で置く。

const DECLARE_EFFECT_ID = "xg1_006_declare_category";
const DECLARE_PICK_EFFECT_ID = "xg1_006_opponent_pick";

function declareKeyword(cardId: string): (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult {
  return (state, ctx) => ({
    state: openAfter(state, { ...base(ctxBase(ctx), cardId), effectId: DECLARE_EFFECT_ID, kind: "confirm", validInstanceIds: [...CATEGORIES], selectCount: 1, optional: true }),
    detail: DECLARE_EFFECT_ID,
  });
}
XG1_KEYWORDS["XG1-006::bio_sword"] = declareKeyword("XG1-006");
XG1_KEYWORDS["XG1-010::live_blaster"] = declareKeyword("XG1-010");

XG1_RESOLVERS[DECLARE_EFFECT_ID] = (state, playerId, cat) => {
  const pending = state.pendingEffectChoice!;
  const cleared = close(state, pending);
  const enemyId = opponent(playerId);
  const ids: string[] = [];
  for (const owner of [playerId, enemyId]) {
    for (const c of fieldUnits(cleared, owner)) {
      if (!rk1IsSmallNow(cleared, c) || !unitCatsNow(cleared, owner, c).includes(cat)) continue;
      if (owner === enemyId && !selectableEnemy(cleared, playerId, pending.sourceCardId, c)) continue;
      ids.push(c.instanceId);
    }
  }
  const log = logFor(state, playerId, pending.sourceCardId, `${DECLARE_EFFECT_ID}:${cat}`);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return {
    state: openNext(cleared, pending, {
      ...base({ playerId: enemyId, phasePlayerId: pending.phasePlayerId, sourceInstanceId: pending.sourceInstanceId }, pending.sourceCardId),
      effectId: DECLARE_PICK_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: ids,
      selectCount: 1,
      optional: false,
    }),
    log,
  };
};
XG1_SKIPPERS[DECLARE_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[DECLARE_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const owner = findField(state, playerId, instanceId) ? playerId : opponent(playerId);
  let next = close(state, pending);
  next = isSameCardIdentity(pending.sourceCardId, "XG1-010")
    ? fieldUnitToCommandReleased(next, owner, instanceId, pending.phasePlayerId)
    : moveFieldUnit(next, owner, instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${DECLARE_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-008 レッドフラッシュ【レッドバル】（NC）
// 「「SP1」自軍パワーゾーンからユニットカードを1枚選び手札に戻してもよい。そうしたとき、そのカードの必要パワーの数字を見て、同じ必要パワーの数字を持つ
//  敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る。」（atwiki/page-1609）
// 戻せるのはオモテ向きのユニットカード（ダメージは選ばない）。敵軍 S ユニットはエリアを問わない。除去は強制（カード評価）。

const RED_BAL_EFFECT_ID = "xg1_008_red_bal";
const RED_BAL_TARGET_EFFECT_ID = "xg1_008_red_bal_target";

XG1_KEYWORDS["XG1-008::red_bal"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].power.filter((c) => !c.faceDown && isUnitDef(state, c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_008:no_unit_card" };
  return { state: openAfter(state, { ...pickOne(ctxBase(ctx), "XG1-008", RED_BAL_EFFECT_ID, ids, true), kind: "select_power" }), detail: RED_BAL_EFFECT_ID };
};

XG1_RESOLVERS[RED_BAL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const cleared = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] }));
  const n = costNumber(state, card.cardId);
  const ids = enemySUnits(cleared, playerId, "XG1-008", (c) => costNumber(cleared, c.cardId) === n);
  const log = logFor(state, playerId, "XG1-008", `${RED_BAL_EFFECT_ID}:${n}`);
  if (ids.length === 0) return { state: proceed(cleared, pending), log };
  return { state: openNext(cleared, pending, pickOne(pendingBase(pending), "XG1-008", RED_BAL_TARGET_EFFECT_ID, ids, false)), log };
};
XG1_SKIPPERS[RED_BAL_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[RED_BAL_TARGET_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-008", `${RED_BAL_TARGET_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-009 レッドマスク【マスキークラッシュ】（NC）
// 「SP1 これがストライクしてダメージを与えるとき、かわりに敵軍捨札を1枚選び持ち主のパワーゾーンにダメージにして置いてもよい。」（atwiki/page-1596）
// NC が成立したら目印を付ける（SP1 は DSL の SP1）。ストライクのダメージを与える直前（反応の後）に、置きかえるかを選ぶ（任意）。
// 置きかえたら、ストライクのダメージは与えない（パワーゾーンのカードはウラ返らない）。選んだカードはウラ向きで置き、1点のダメージになる。

const MASKY_MARK = "xg1_009_masky_crash";
const MASKY_EFFECT_ID = "xg1_009_masky_crash_pick";

XG1_KEYWORDS["XG1-009::masky_crash"] = (state, ctx) => ({ state: markNc(state, ctx, MASKY_MARK), detail: MASKY_MARK });

/**
 * ストライクのダメージを与える直前（core/applyAction.ts completeStrike）。置きかえの選択を開いたら、ストライクは deferredStrike に預けて
 * 選択の後で続ける（core/applyAction.ts continueDeferredStrike）。対象外なら null。
 */
export function openXg1aStrikeReplacement(state: GameState, pending: PendingStrike): GameState | null {
  if (pending.xg1StrikeReplaceOffered || pending.damageCancelled || pending.damageApplied || pending.damage <= 0 || state.winner) return null;
  const striker = state.players[pending.strikerPlayerId].battle.find((c) => c.instanceId === pending.strikerInstanceId);
  if (!striker || !isSameCardIdentity(striker.cardId, "XG1-009") || !hasBattleNcEffect(striker, MASKY_MARK)) return null;
  const enemyId = opponent(pending.strikerPlayerId);
  const ids = state.players[enemyId].discard.map((c) => c.instanceId);
  if (ids.length === 0) return null;
  const parked: GameState = { ...state, pendingStrike: undefined, deferredStrike: { ...pending, xg1StrikeReplaceOffered: true } };
  return openEffectChoice(parked, {
    ...base({ playerId: pending.strikerPlayerId, phasePlayerId: pending.battlePhasePlayer, sourceInstanceId: striker.instanceId }, "XG1-009"),
    effectId: MASKY_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: ids,
    selectCount: 1,
    optional: true,
  });
}

XG1_RESOLVERS[MASKY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].discard.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    power: [...p.power, { ...stripForZone(card), faceDown: true }],
    damage: p.damage + 1,
  }));
  if (next.deferredStrike) next = { ...next, deferredStrike: { ...next.deferredStrike, damageCancelled: true } };
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-009", `${MASKY_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[MASKY_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-012 レッドパンチャー【ボクシングスタイル】（自軍バトルフェイズ中の起動）
// 「自軍バトルフェイズ中、これが自軍バトルエリアにある間、ETを持つ自軍コマンドを3つホールドしてもよい。そうしたとき、これをラッシュエリアに戻す。」
// （atwiki/page-1615）。回数の制限はない（カード評価「コマンドをリリースする手段が有れば何度でも」）。

const BOXING_HOLD_EFFECT_ID = "xg1_012_boxing_style_hold";

export function isXg1aFieldAbilityCard(cardId: string): boolean {
  return isSameCardIdentity(cardId, "XG1-012") || isSameCardIdentity(cardId, "XG1-014");
}

export function canActivateXg1aFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (state.activePlayer !== playerId) return false;
  if (isSameCardIdentity(card.cardId, "XG1-012")) {
    return state.phase === "battle" && zoneOfField(state, playerId, card.instanceId) === "battle" && releasedCommands(state, playerId, "ET").length >= 3;
  }
  if (isSameCardIdentity(card.cardId, "XG1-014")) {
    if (state.phase !== "rush") return false;
    const n = releasedCommands(state, playerId).length;
    return kingStickTargets(state, playerId).some((id) => n >= kingStickCost(state, playerId, id));
  }
  return false;
}

export function activateXg1aFieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const ctx: BaseCtx = { playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId };
  if (isSameCardIdentity(card.cardId, "XG1-012")) return holdThen(state, ctx, "XG1-012", BOXING_HOLD_EFFECT_ID, releasedCommands(state, playerId, "ET"), 3);
  const n = releasedCommands(state, playerId).length;
  const ids = kingStickTargets(state, playerId).filter((id) => n >= kingStickCost(state, playerId, id));
  return openEffectChoice(state, pickOne(ctx, "XG1-014", KING_STICK_EFFECT_ID, ids, true));
}

/** バトルエリアのユニット（ライドの組は組ごと）をラッシュエリアに戻す（ラッシュではない。rules/rm/rm3Effects.ts と同じ）。 */
export function returnBattleUnitToRush(state: GameState, ownerId: PlayerId, instanceId: string): GameState {
  const battle = state.players[ownerId].battle;
  const unit = battle.find((c) => c.instanceId === instanceId);
  if (!unit) return state;
  const group = new Set([instanceId, ...(unit.mountedOnInstanceId ? [unit.mountedOnInstanceId] : []), ...battle.filter((c) => c.mountedOnInstanceId === instanceId).map((c) => c.instanceId)]);
  return patchPlayer(state, ownerId, (p) => ({
    ...p,
    battle: p.battle.filter((c) => !group.has(c.instanceId)),
    rush: [...p.rush, ...p.battle.filter((c) => group.has(c.instanceId)).map((c) => (state.phase === "battle" ? prepareWingUnitReturnedToRush(c) : c))],
  }));
}

registerHold(BOXING_HOLD_EFFECT_ID, (state, pending) => {
  const next = pending.sourceInstanceId ? returnBattleUnitToRush(state, pending.playerId, pending.sourceInstanceId) : state;
  return proceed(next, pending);
});

// ---------------------------------------------------------------------------
// XG1-014 キングレンジャー【キングスティック】（自軍ラッシュフェイズ中の起動）
// 「これが自軍エリアにある間、自軍ラッシュフェイズ中、ホールド状態のDAを持たないSユニットを1体選び、自軍コマンドを2つ（選んだユニットがウイングを
//  持つなら4つ）ホールドしてもよい。そうしたとき、選んだユニットをリリースする。」（atwiki/page-1675）
// ユニットは自軍・敵軍を問わない（カード評価）。コマンドはカテゴリを問わないリリース状態の自軍コマンド。選んだあとで払う。

const KING_STICK_EFFECT_ID = "xg1_014_king_stick";
const KING_STICK_HOLD_EFFECT_ID = "xg1_014_king_stick_hold";

function kingStickTargets(state: GameState, playerId: PlayerId): string[] {
  const ids: string[] = [];
  for (const owner of [playerId, opponent(playerId)]) {
    for (const c of fieldUnits(state, owner)) {
      if (!c.commandHeld || !rk1IsSmallNow(state, c) || unitCatsNow(state, owner, c).includes("DA")) continue;
      if (owner !== playerId && !selectableEnemy(state, playerId, "XG1-014", c)) continue;
      ids.push(c.instanceId);
    }
  }
  return ids;
}

function kingStickCost(state: GameState, playerId: PlayerId, instanceId: string): number {
  const owner = findField(state, playerId, instanceId) ? playerId : opponent(playerId);
  const unit = findField(state, owner, instanceId);
  return unit && cardHasKeyword(state.definitions, unit.cardId, "wing", { state, playerId: owner }) ? 4 : 2;
}

XG1_RESOLVERS[KING_STICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const cost = kingStickCost(state, playerId, instanceId);
  const next = holdThen(close(state, pending), pendingBase(pending), "XG1-014", KING_STICK_HOLD_EFFECT_ID, releasedCommands(state, playerId), cost, {
    selectedInstanceIds: [],
    resumeChoice: pending.resumeChoice,
    xg1Meta: { target: instanceId },
  });
  return { state: next, log: logFor(state, playerId, "XG1-014", `${KING_STICK_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[KING_STICK_EFFECT_ID] = simpleSkip();

registerHold(KING_STICK_HOLD_EFFECT_ID, (state, pending) => {
  const target = pending.xg1Meta?.target;
  let next = state;
  if (target) {
    for (const owner of ["player1", "player2"] as const) {
      next = patchPlayer(next, owner, (p) => {
        const rel = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === target ? { ...c, commandHeld: false } : c));
        return { ...p, rush: rel(p.rush), battle: rel(p.battle) };
      });
    }
  }
  return proceed(next, pending);
});

// ---------------------------------------------------------------------------
// 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない（rules/xg1/xg1Fields.ts）。

XG1_KEYWORDS["XG1-011::space_metal_sword"] = noop("xg1_011:sp_by_ot_face_up");
XG1_KEYWORDS["XG1-012::all_released_sp1"] = noop("xg1_012:sp_by_released_commands");
XG1_KEYWORDS["XG1-012::boxing_style"] = noop("xg1_012:field_ability");
XG1_KEYWORDS["XG1-014::king_stick"] = noop("xg1_014:field_ability");
XG1_KEYWORDS["XG1-020::turbo_crash"] = noop("xg1_020:sp_by_bp");

export { CATEGORIES as XG1_CATEGORIES, pickOne as xg1PickOne, markNc as xg1MarkNc, fieldUnitToCommandReleased };
