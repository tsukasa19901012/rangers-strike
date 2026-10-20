/**
 * クロスギャザー XG2-001〜XG2-020（ファイブレッド〜合身獣士・ブルタウラス）のカード固有の効果（cardSpec XG2-001-020 の監査）。
 * 登録は rules/xg2/xg2Core.ts。継続効果の判定（XG2-004・006・007 等）は rules/xg2/xg2Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardName, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import { addTurnRestrictionModifier } from "../../core/scopedModifiers";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { openEffectChoice } from "../pendingChoices";
import { resolveBattlePending, tryLeaveField } from "../operationCounters";
import { patchPlayer } from "../playerPatches";
import { unitFeatures } from "../addedFeatures";
import { recordReveal, revealedCards } from "../revealNotice";
import { hasBattleNcEffect, markBattleNcEffect } from "../namedUnitEffects";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { rk1OngekiMarked } from "../rk/rk1NamedEffects";
import { rk11KyosukeTreatsAsWritten } from "../rk/rk11Fields";
import { rm1ResidentActive } from "../rm/rm1Fields";
import {
  type BaseCtx,
  base,
  close,
  confirmChoice,
  ctxBase,
  destroyAll,
  fieldUnits,
  findField,
  logFor,
  openAfter,
  openNext,
  pendingBase,
  proceed,
  selectableEnemy,
  zoneOfField,
} from "../rm/rm1Effects";
import {
  XG2_NO_STRIKE_RESTRICTION,
  XG2_VEHICLE_UNIT_SUFFIX,
  xg2IsVehicleUnitAlias,
} from "./xg2Fields";
import {
  type ChoiceOutcome,
  costNumber,
  metaOf,
  ownTurn,
  ownerZoneOptions,
  placeInOwnersZone,
  registerXg2Choice,
  registerXg2Keyword,
  returnFieldUnitToDeck,
  simpleSkipXg2,
  xg2Hook,
} from "./xg2Core";

// ---------------------------------------------------------------------------
// 共通

/** 「持ち主のゾーンに置く」の行き先の選択（効果を使った側が選ぶ。questions U-13 (a)。コマンドゾーンが5枚ならパワーゾーン）。 */
const OWNER_ZONE_EFFECT_ID = "xg2_owner_zone";

type OwnerZoneMeta = { ownerId: PlayerId; targetId: string };

/** 選んだ場のカードを持ち主のゾーンに置く（行き先が2つあれば選択を開く）。 */
export function xg2PutInOwnersZone(state: GameState, pending: PendingEffectChoice, ownerId: PlayerId, targetId: string): GameState {
  const cleared = close(state, pending);
  const options = ownerZoneOptions(cleared, ownerId);
  if (options.length === 1) return proceed(placeInOwnersZone(cleared, ownerId, targetId, pending.phasePlayerId, options[0]!), pending);
  return openNext(cleared, pending, {
    ...base(pendingBase(pending), pending.sourceCardId),
    effectId: OWNER_ZONE_EFFECT_ID,
    kind: "confirm",
    validInstanceIds: options,
    selectCount: 1,
    optional: false,
    xg2Meta: { ownerId, targetId } satisfies OwnerZoneMeta,
  });
}

registerXg2Choice(OWNER_ZONE_EFFECT_ID, {
  resolve: (state, playerId, zone) => {
    const pending = state.pendingEffectChoice!;
    const meta = metaOf<OwnerZoneMeta>(pending);
    const next = placeInOwnersZone(close(state, pending), meta.ownerId, meta.targetId, pending.phasePlayerId, zone);
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${OWNER_ZONE_EFFECT_ID}:${zone}`) };
  },
});

function selectOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

function categoriesNow(state: GameState, ownerId: PlayerId, card: CardInstance): string[] {
  const zone = zoneOfField(state, ownerId, card.instanceId) ?? "battle";
  return unitEffectiveCategories(state, ownerId, card, zone) as string[];
}

/** 敵軍の場の、敵軍の効果で選べるユニット。 */
function enemyUnits(state: GameState, playerId: PlayerId, sourceCardId: string, zones: Array<"battle" | "rush"> = ["battle", "rush"]): CardInstance[] {
  const enemyId = opponent(playerId);
  return fieldUnits(state, enemyId).filter(
    (c) => zones.includes(zoneOfField(state, enemyId, c.instanceId) ?? "battle") && selectableEnemy(state, playerId, sourceCardId, c),
  );
}

/** 場のユニットを撃破する（L ユニットなら、捨札にするかわりに持ち主のパワーゾーンにダメージにして置く）。 */
function destroyMaybeAsDamage(state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId, lAsDamage: boolean): GameState {
  const from = zoneOfField(state, ownerId, instanceId);
  const found = findField(state, ownerId, instanceId);
  if (!from || !found) return state;
  const isL = unitSizeOf(state.definitions, found) === "L";
  return tryLeaveField(state, {
    ownerPlayerId: ownerId,
    instanceId,
    fromZone: from,
    toZone: "discard",
    leavingCardId: found.cardId,
    phasePlayerId,
    ...(lAsDamage && isL ? { discardAsDamage: true } : {}),
  }).state;
}

function addBpThisTurn(state: GameState, ownerId: PlayerId, instanceId: string, amount: number): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const put = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, bpModifier: (c.bpModifier ?? 0) + amount } : c));
    return { ...p, rush: put(p.rush), battle: put(p.battle) };
  });
}

const noop = (detail: string) => (state: GameState): GrantKeywordResult => ({ state, detail });

// ---------------------------------------------------------------------------
// XG2-001 ファイブレッド【ファイブラスター】・XG2-002 ファイブブルー【ツインフリスビー】・XG2-003 ファイブピンク【サークルピュータ】（NC）
// 「「SP1」特徴「メカ」（「獣」または「昆虫」／数字（漢字も含む）を含む特徴）を持つ敵軍Sユニットを1体選び、持ち主のゾーンに置いてもよい。」
// （atwiki/page-1852・1786・1750）。「SP1」は DSL の SP1。敵軍の場（エリアを問わない）の S ユニットを今の特徴で見る。
// 数字は算用数字（全角を含む）と漢数字。カタカナで書いた数は含めない（カード評価）。行き先は xg2PutInOwnersZone。

const KANJI_DIGITS = /[0-9０-９一二三四五六七八九十百千万零〇]/;

const FIVE_SPECS: Record<string, (features: string[]) => boolean> = {
  "XG2-001": (f) => f.includes("メカ"),
  "XG2-002": (f) => f.includes("獣") || f.includes("昆虫"),
  "XG2-003": (f) => f.some((x) => KANJI_DIGITS.test(x)),
};
const FIVE_EFFECT_ID = "xg2_001_five";

function applyFive(cardId: string) {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    const enemyId = opponent(ctx.playerId);
    const test = FIVE_SPECS[cardId]!;
    const ids = enemyUnits(state, ctx.playerId, cardId)
      .filter((c) => rk1IsSmallNow(state, c) && test(unitFeatures(state, enemyId, c)))
      .map((c) => c.instanceId);
    if (ids.length === 0) return { state, detail: `${cardId}:no_targets` };
    return { state: openAfter(state, selectOne(ctxBase(ctx), cardId, FIVE_EFFECT_ID, ids, true)), detail: FIVE_EFFECT_ID };
  };
}

registerXg2Choice(FIVE_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    return { state: xg2PutInOwnersZone(state, pending, opponent(playerId), instanceId), log: logFor(state, playerId, pending.sourceCardId, `${FIVE_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-005 スカイアルファー【アルファーレーザー】（自軍ターン中、バトルエリアに出たとき）
// 「ホールド状態の敵軍コマンドをすべてリリースしてもよい。そうしたとき、リリースした枚数を数えて、その数以下の必要パワーの数字を持つ敵軍ユニットを
//  1体選び持ち主のゾーンに置く。」（atwiki/page-1787）。リリースするかを確かめる（ホールド状態の敵軍コマンドが0枚でも確かめ、0枚をリリースしたら必要パワー0以下のユニットを選ぶ。
// questions U-9 (a)。XG7-012 の判断と同じ）。
// リリースしたら選ぶのは強制。候補は敵軍の場のユニット（サイズ・エリアを問わない。「3+」は3）。

const ALPHA_CONFIRM_EFFECT_ID = "xg2_005_alpha_laser";
const ALPHA_PICK_EFFECT_ID = "xg2_005_alpha_laser_pick";

function applyAlphaLaser(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_005:not_own_turn" };
  return { state: openAfter(state, confirmChoice(ctxBase(ctx), "XG2-005", ALPHA_CONFIRM_EFFECT_ID)), detail: ALPHA_CONFIRM_EFFECT_ID };
}

registerXg2Choice(ALPHA_CONFIRM_EFFECT_ID, {
  skip: simpleSkipXg2(),
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    const count = state.players[enemyId].command.filter((c) => c.commandHeld).length;
    const cleared = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, command: p.command.map((c) => (c.commandHeld ? { ...c, commandHeld: false } : c)) }));
    const ids = enemyUnits(cleared, playerId, "XG2-005")
      .filter((c) => {
        const n = costNumber(cleared, c.cardId);
        return Number.isFinite(n) && n <= count;
      })
      .map((c) => c.instanceId);
    const log = logFor(state, playerId, "XG2-005", `${ALPHA_CONFIRM_EFFECT_ID}:released:${count}`);
    if (ids.length === 0) return { state: proceed(cleared, pending), log };
    return { state: openNext(cleared, pending, selectOne(pendingBase(pending), "XG2-005", ALPHA_PICK_EFFECT_ID, ids, false)), log };
  },
});

registerXg2Choice(ALPHA_PICK_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    return { state: xg2PutInOwnersZone(state, pending, opponent(playerId), instanceId), log: logFor(state, playerId, "XG2-005", `${ALPHA_PICK_EFFECT_ID}:${instanceId}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-009 コンピュータードラゴン【行動予測】
// 「これが自軍バトルエリアにある間、敵軍バトルフェイズ開始時、次の効果を発動できる⇒敵軍Sユニットを1体選び、アタックかストライクのどちらかを宣言する。
//  選んだユニットは、そのターン、宣言した行動を行えない。」（atwiki/page-1753）。敵軍 S ユニットはエリアを問わない。コピーごとに発動できる。
// 制限は敵軍（ユニットの持ち主）のターン限定の制限（アタック: no_attack_this_turn、ストライク: XG2_NO_STRIKE_RESTRICTION。rules/keywordGapRuntime.ts）。

const PREDICT_EFFECT_ID = "xg2_009_predict";
const PREDICT_DECLARE_EFFECT_ID = "xg2_009_predict_declare";
export const XG2_DECLARE_ATTACK = "attack";
export const XG2_DECLARE_STRIKE = "strike";

xg2Hook("battlePhaseStart", (state, phasePlayerId) => {
  const ownerId = opponent(phasePlayerId);
  const dragons = state.players[ownerId].battle.filter((c) => isSameCardIdentity(c.cardId, "XG2-009"));
  let next = state;
  for (const dragon of dragons) {
    const ids = fieldUnits(next, phasePlayerId)
      .filter((c) => rk1IsSmallNow(next, c) && selectableEnemy(next, ownerId, "XG2-009", c))
      .map((c) => c.instanceId);
    if (ids.length === 0) break;
    next = openAfter(next, selectOne({ playerId: ownerId, phasePlayerId, sourceInstanceId: dragon.instanceId }, "XG2-009", PREDICT_EFFECT_ID, ids, true));
  }
  return next;
});

registerXg2Choice(PREDICT_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = openNext(close(state, pending), pending, {
      ...base(pendingBase(pending), "XG2-009"),
      effectId: PREDICT_DECLARE_EFFECT_ID,
      kind: "confirm",
      validInstanceIds: [XG2_DECLARE_ATTACK, XG2_DECLARE_STRIKE],
      selectCount: 1,
      optional: false,
      xg2Meta: { targetId: instanceId },
    });
    return { state: next, log: logFor(state, playerId, "XG2-009", `${PREDICT_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

registerXg2Choice(PREDICT_DECLARE_EFFECT_ID, {
  resolve: (state, playerId, declared) => {
    const pending = state.pendingEffectChoice!;
    const targetId = metaOf<{ targetId: string }>(pending).targetId;
    const enemyId = opponent(playerId);
    const restriction = declared === XG2_DECLARE_ATTACK ? "no_attack_this_turn" : XG2_NO_STRIKE_RESTRICTION;
    const next = patchPlayer(close(state, pending), enemyId, (p) => addTurnRestrictionModifier(p, targetId, restriction));
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-009", `${PREDICT_DECLARE_EFFECT_ID}:${declared}`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-010 気伝武人龍星王【龍星キック】
// 「「SP1」これがDAを持つ敵軍ユニットにアタックするとき、バトルの前にバトル相手のユニットを持ち主の山札の上に戻してもよい。」（atwiki/page-1805）。
// 「SP1」は NC（DSL）。アタックの対象の敵軍ユニットが DA（マルチカテゴリを含む今のカテゴリ）を持つとき、カウンターの窓のあと、バトルの解決の直前に
// 確かめる（Q1: RS-018 隠流忍術でかわったバトル相手を戻す）。戻したらバトルは行わない（アタックはしたことになる）。サイズを問わない。

const KICK_HOOK_ID = "xg2_010";
const KICK_EFFECT_ID = "xg2_010_ryusei_kick";

function battleOpponent(state: GameState, battle: PendingBattle): { ownerId: PlayerId; card: CardInstance } | null {
  const id = battle.substituteInstanceId ?? battle.defenderInstanceId;
  for (const pid of ["player1", "player2"] as const) {
    const card = findField(state, pid, id);
    if (card) return { ownerId: pid, card };
  }
  return null;
}

xg2Hook("beforeBattle", {
  id: KICK_HOOK_ID,
  open: (state, battle) => {
    if (battle.effectBattle) return null;
    const attacker = findField(state, battle.attackerPlayerId, battle.attackerInstanceId);
    if (!attacker || !isSameCardIdentity(attacker.cardId, "XG2-010")) return null;
    const attacked = findField(state, battle.defenderPlayerId, battle.defenderInstanceId);
    if (!attacked || !categoriesNow(state, battle.defenderPlayerId, attacked).includes("DA")) return null;
    if (!battleOpponent(state, battle)) return null;
    return openEffectChoice(
      { ...state, pendingBattle: undefined },
      {
        ...confirmChoice({ playerId: battle.attackerPlayerId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: attacker.instanceId }, "XG2-010", KICK_EFFECT_ID),
        xg2Meta: { battle },
      },
    );
  },
});

function resumeBattle(state: GameState, pending: PendingEffectChoice, battle: PendingBattle): GameState {
  return proceed(resolveBattlePending(close(state, pending), battle).state, pending);
}

registerXg2Choice(KICK_EFFECT_ID, {
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const battle = metaOf<{ battle: PendingBattle }>(pending).battle;
    return { state: resumeBattle(state, pending, battle), log: logFor(state, playerId, "XG2-010", `${KICK_EFFECT_ID}:skipped`) };
  },
  confirm: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    const battle = metaOf<{ battle: PendingBattle }>(pending).battle;
    const opp = battleOpponent(state, battle);
    let next = close(state, pending);
    if (opp) next = returnFieldUnitToDeck(next, opp.ownerId, opp.card.instanceId, battle.phasePlayerId, "deck_top");
    next = resolveBattlePending(next, { ...battle, battleCancelled: true }).state;
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-010", `${KICK_EFFECT_ID}:returned`) };
  },
});

// ---------------------------------------------------------------------------
// XG2-011 気伝武人ウォンタイガー【虎の子大秘術】（NC）
// 「好きなカード名1つを宣言してから、敵軍山札の上から1枚をオモテにしてもよい。オモテにしたカードが宣言したカード名と同名なら、そのカードを持ち主の
//  パワーゾーンにダメージにして置く。それ以外なら山札の上に戻す。」（atwiki/page-1804）。
// 宣言する名前は、ゲームのカード（定義）のカード名から選ぶ（選ぶことが「オモテにする」の宣言。見送れる）。

const TIGER_EFFECT_ID = "xg2_011_tora_no_ko";

function declarableNames(state: GameState): string[] {
  const names = new Set<string>();
  for (const def of Object.values(state.definitions) as CardDefinition[]) {
    if (def?.name && (def.type === "unit" || def.type === "operation" || def.type === "vehicle")) names.add(def.name);
  }
  return [...names].sort();
}

function applyTigerSecret(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (state.players[opponent(ctx.playerId)].deck.length === 0) return { state, detail: "xg2_011:no_deck" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG2-011"), effectId: TIGER_EFFECT_ID, kind: "confirm", validInstanceIds: declarableNames(state), selectCount: 1, optional: true }),
    detail: TIGER_EFFECT_ID,
  };
}

registerXg2Choice(TIGER_EFFECT_ID, {
  resolve: (state, playerId, declared) => {
    const pending = state.pendingEffectChoice!;
    const enemyId = opponent(playerId);
    let next = close(state, pending);
    const top = next.players[enemyId].deck[0];
    if (!top) return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-011", `${TIGER_EFFECT_ID}:no_deck`) };
    const hit = sameCardName(cardName(next.definitions, top.cardId), declared);
    if (hit) {
      next = patchPlayer(next, enemyId, (p) => ({ ...p, deck: p.deck.slice(1), power: [...p.power, { instanceId: top.instanceId, cardId: top.cardId, faceDown: true }], damage: p.damage + 1 }));
    }
    next = recordReveal(next, {
      playerId,
      ownerId: enemyId,
      sourceCardId: "XG2-011",
      effectLabel: "虎の子大秘術",
      from: "deck_top",
      cards: revealedCards([top], () => (hit ? "power" : "deck_top")),
    });
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-011", `${TIGER_EFFECT_ID}:${declared}:${hit ? "hit" : "miss"}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-012 牙大王【飛翔剣・木端微塵】・XG2-017 大連王【大王剣・疾風怒濤】（自軍ターン中、バトルエリアに出たとき）
// 「敵軍ラッシュエリア（大連王: 敵軍バトルエリア）から、DAを持つ敵軍ユニットを1体選び撃破してもよい。そうしたとき、撃破したユニットがLユニット
//  だったなら、捨札にするかわりに持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-1145・1824）。サイズを問わない。今のカテゴリで見る。
// L ユニットは離場の処理の discardAsDamage（その場に留まったら何もしない。XG2-017 Q1）。

const KING_EFFECT_ID = "xg2_012_king_sword";

function applyKingSword(cardId: string, zone: "battle" | "rush") {
  return (state: GameState, ctx: GrantKeywordContext): GrantKeywordResult => {
    if (!ownTurn(state, ctx.playerId)) return { state, detail: `${cardId}:not_own_turn` };
    const enemyId = opponent(ctx.playerId);
    const ids = enemyUnits(state, ctx.playerId, cardId, [zone])
      .filter((c) => categoriesNow(state, enemyId, c).includes("DA"))
      .map((c) => c.instanceId);
    if (ids.length === 0) return { state, detail: `${cardId}:no_targets` };
    return { state: openAfter(state, selectOne(ctxBase(ctx), cardId, KING_EFFECT_ID, ids, true)), detail: KING_EFFECT_ID };
  };
}

registerXg2Choice(KING_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const next = destroyMaybeAsDamage(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, true);
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${KING_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-013 キバレンジャー【白虎真剣】（NC）
// 「「SP1」敵軍バトルエリアから、カテゴリを2つ以上持つSユニットを1体選び、撃破してもよい。」（atwiki/page-1790）。今のカテゴリで見る。

const BYAKKO_EFFECT_ID = "xg2_013_byakko";

function applyByakko(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const ids = enemyUnits(state, ctx.playerId, "XG2-013", ["battle"])
    .filter((c) => rk1IsSmallNow(state, c) && categoriesNow(state, enemyId, c).length >= 2)
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg2_013:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-013", BYAKKO_EFFECT_ID, ids, true)), detail: BYAKKO_EFFECT_ID };
}

function destroyPicked(effectId: string) {
  return (state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome => {
    const pending = state.pendingEffectChoice!;
    const next = destroyAll(close(state, pending), pendingBase(pending), pending.sourceCardId, `${effectId}_destroy`, [instanceId]);
    return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${effectId}:${instanceId}`) };
  };
}

registerXg2Choice(BYAKKO_EFFECT_ID, { resolve: destroyPicked(BYAKKO_EFFECT_ID), skip: simpleSkipXg2() });

// ---------------------------------------------------------------------------
// XG2-015 リュウレンジャー【赤龍双竜剣】（NC）
// 「「SP1」敵軍バトルエリアから、効果名を持たないテキストに「これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」と
//  書かれた敵軍ユニットを1体選び、撃破してもよい。」（atwiki/page-1791）。※ のテキスト（効果名を持たないテキスト）にその文があるユニット
// （句読点・鉤括弧・空白の違いは同じ文とみなす）と、RK-019 音撃・RK-224 京介変身体でその文が書かれているかのように扱うユニット。サイズを問わない。

const DORYU_EFFECT_ID = "xg2_015_sekiryu";
const BIORON_TEXT = "これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される";

function normSentence(text: string): string {
  return text.normalize("NFKC").replace(/[\s「」『』、。,.]/g, "");
}

/** カードのテキストのうち、効果名を持たない部分（※ で始まる文）。 */
function unnamedTexts(text: string | undefined): string[] {
  return (text ?? "")
    .split(/(?=※|【)/)
    .filter((part) => part.startsWith("※"))
    .map((part) => normSentence(part));
}

function applySekiryu(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const enemyId = opponent(ctx.playerId);
  const needle = normSentence(BIORON_TEXT);
  const ids = enemyUnits(state, ctx.playerId, "XG2-015", ["battle"])
    .filter(
      (c) =>
        unnamedTexts(getDefinition(state.definitions, c.cardId)?.text).some((t) => t.includes(needle)) ||
        rk1OngekiMarked(state, ctx.playerId, c.instanceId) ||
        rk11KyosukeTreatsAsWritten(state, enemyId, c.instanceId),
    )
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg2_015:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-015", DORYU_EFFECT_ID, ids, true)), detail: DORYU_EFFECT_ID };
}

registerXg2Choice(DORYU_EFFECT_ID, { resolve: destroyPicked(DORYU_EFFECT_ID), skip: simpleSkipXg2() });

// ---------------------------------------------------------------------------
// XG2-016 天空気殿【天空大風車】
// 「このユニットからコンビネーションする、特徴「人型」を持つMユニットは、次の能力を得る⇒これがストライクしてダメージを与えたとき、DAを持つ敵軍ユニットを
//  1体選び撃破してもよい。」（atwiki/page-1792）。自軍バトルフェイズに、バトルエリアでこれの次に出た（左隣がこれの）「人型」の M ユニットに印を付け
// （activatedNcEffects。ターンの終わりに消える）、そのユニットがストライクでダメージを与えたときに選ぶ。DA の敵軍ユニットはエリア・サイズを問わない。
// ※ の追加条件の変更は rules/rushAdditionalCondition.ts（「カード名に「…」を含む自軍ユニットがある」）。

const TENKU_MARK = "xg2_016_tenku";
const TENKU_EFFECT_ID = "xg2_016_tenku_daifusha";

xg2Hook("comboEnter", (state, playerId, card, battleBeforeEnter) => {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  const left = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!left || !isSameCardIdentity(left.cardId, "XG2-016")) return state;
  if (getDefinition(state.definitions, card.cardId)?.type !== "unit" || unitSizeOf(state.definitions, card) !== "M") return state;
  if (!unitFeatures(state, playerId, card).includes("人型")) return state;
  return markBattleNcEffect(state, playerId, card.instanceId, TENKU_MARK);
});

xg2Hook("strikeDamage", (state, pending) => {
  const striker = state.players[pending.strikerPlayerId].battle.find((c) => c.instanceId === pending.strikerInstanceId);
  if (!striker || !hasBattleNcEffect(striker, TENKU_MARK)) return state;
  const enemyId = opponent(pending.strikerPlayerId);
  const ids = enemyUnits(state, pending.strikerPlayerId, "XG2-016")
    .filter((c) => categoriesNow(state, enemyId, c).includes("DA"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, selectOne({ playerId: pending.strikerPlayerId, phasePlayerId: pending.battlePhasePlayer, sourceInstanceId: striker.instanceId }, "XG2-016", TENKU_EFFECT_ID, ids, true));
});

registerXg2Choice(TENKU_EFFECT_ID, { resolve: destroyPicked(TENKU_EFFECT_ID), skip: simpleSkipXg2() });

// ---------------------------------------------------------------------------
// XG2-018 ゲキタイガー【来来獣】（ラッシュしたとき）
// 「特徴「レッド」を持つ自軍ユニットを1体選びホールドしてもよい。そうしたとき、このターン、これはBP＋3000される。」（atwiki/page-1793）。
// 自軍の場の、リリース状態の「レッド」のユニット（今の特徴）。

const RAIRAI_EFFECT_ID = "xg2_018_rairaiju";

function applyRairai(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const ids = fieldUnits(state, ctx.playerId)
    .filter((c) => c.instanceId !== ctx.triggerSourceInstanceId && !c.commandHeld && unitFeatures(state, ctx.playerId, c).includes("レッド"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg2_018:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG2-018", RAIRAI_EFFECT_ID, ids, true)), detail: RAIRAI_EFFECT_ID };
}

registerXg2Choice(RAIRAI_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    let next = patchPlayer(close(state, pending), playerId, (p) => {
      const hold = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c));
      return { ...p, rush: hold(p.rush), battle: hold(p.battle) };
    });
    if (pending.sourceInstanceId) next = addBpThisTurn(next, playerId, pending.sourceInstanceId, 3000);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-018", `${RAIRAI_EFFECT_ID}:${instanceId}`) };
  },
  skip: simpleSkipXg2(),
});

// ---------------------------------------------------------------------------
// XG2-019 知恵の樹モーク（※常駐）
// 「自軍バトルフェイズ中、自軍ラッシュエリアから、ライドされていない特徴「獣」を持つMビークルを1体選んでもよい。そうしたとき、選んだビークルは、
//  このターン、テキストを持たないMユニットとして扱い、次の情報が追加される⇒「BP3000」「SP空欄」」（atwiki/page-1751）。
// 起動（activate_resident_operation）で選ぶ（見送れる）。1ターンに何度でも使える（利用者の決定 2026-10-20・questions U-14。すでに M ユニットとして
// 扱っているビークルはビークルではないので、もう候補にならない）。選んだビークルは、このターンの間、
// テキストを持たない M ユニットの定義（`<cardId>@xg2-019`。BP3000・SP 空欄・本来の特徴とカテゴリ）として扱う（本来の BP は3000。Q3）。
// 「ラッシュした」ことにはならない（Q1・Q2）。ターンが変わるか、場を離れたら元のカードに戻す（applyAction の後処理）。

const MOKE_EFFECT_ID = "xg2_019_moke";
const MOKE_KEY = "mokeUnits";

type MokeEntry = { ownerId: PlayerId; instanceId: string; originalCardId: string; turn: number };

function mokeEntries(state: GameState): MokeEntry[] {
  return ((state.xg2?.[MOKE_KEY] as MokeEntry[] | undefined) ?? []);
}

function withMokeEntries(state: GameState, entries: MokeEntry[]): GameState {
  const rest = { ...(state.xg2 ?? {}) };
  if (entries.length > 0) rest[MOKE_KEY] = entries;
  else delete rest[MOKE_KEY];
  return { ...state, xg2: Object.keys(rest).length > 0 ? rest : undefined };
}

function mokeCandidates(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  const ridden = new Set([...p.rush, ...p.battle].map((c) => c.mountedOnInstanceId).filter((x): x is string => !!x));
  return p.rush
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "vehicle" && def.size === "M" && !ridden.has(c.instanceId) && unitFeatures(state, playerId, c).includes("獣");
    })
    .map((c) => c.instanceId);
}

xg2Hook("residents", {
  matches: (cardId) => isSameCardIdentity(cardId, "XG2-019"),
  canActivate: (state, playerId) =>
    state.phase === "battle" &&
    state.activePlayer === playerId &&
    !state.pendingBattle &&
    rm1ResidentActive(state, playerId, "XG2-019") &&
    mokeCandidates(state, playerId).length > 0,
  activate: (state, playerId, op) => {
    return openEffectChoice(state, selectOne({ playerId, phasePlayerId: playerId, sourceInstanceId: op.instanceId }, "XG2-019", MOKE_EFFECT_ID, mokeCandidates(state, playerId), true));
  },
});

function mokeDefinition(def: CardDefinition, aliasId: string): CardDefinition {
  return {
    id: aliasId,
    name: def.name,
    type: "unit",
    category: def.category,
    rarity: def.rarity,
    expansion: def.expansion,
    powerCost: def.powerCost,
    size: "M",
    bp: 3000,
    features: def.features,
    text: "",
  } as CardDefinition;
}

registerXg2Choice(MOKE_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const card = state.players[playerId].rush.find((c) => c.instanceId === instanceId);
    const def = card ? getDefinition(state.definitions, card.cardId) : undefined;
    if (!card || !def) return { error: "invalid_target" };
    const aliasId = `${card.cardId}${XG2_VEHICLE_UNIT_SUFFIX}`;
    let next = close(state, pending);
    next = { ...next, definitions: { ...next.definitions, [aliasId]: mokeDefinition(def, aliasId) } };
    next = patchPlayer(next, playerId, (p) => ({ ...p, rush: p.rush.map((c) => (c.instanceId === instanceId ? { ...c, cardId: aliasId } : c)) }));
    next = withMokeEntries(next, [...mokeEntries(next), { ownerId: playerId, instanceId, originalCardId: card.cardId, turn: state.turn }]);
    return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-019", `${MOKE_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
  },
  skip: simpleSkipXg2(),
});

/** ターンが変わったか場を離れたビークルを元のカードに戻す。 */
xg2Hook("afterAction", (_before, after) => {
  const entries = mokeEntries(after);
  if (entries.length === 0) return after;
  let next = after;
  const keep: MokeEntry[] = [];
  for (const e of entries) {
    const p = next.players[e.ownerId];
    const onField = [...p.rush, ...p.battle].some((c) => c.instanceId === e.instanceId && xg2IsVehicleUnitAlias(c.cardId));
    if (onField && e.turn === next.turn) {
      keep.push(e);
      continue;
    }
    next = patchPlayer(next, e.ownerId, (pl) => {
      const restore = (cards: CardInstance[]) => cards.map((c) => (c.instanceId === e.instanceId && xg2IsVehicleUnitAlias(c.cardId) ? { ...c, cardId: e.originalCardId } : c));
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
  return withMokeEntries(next, keep);
});

// ---------------------------------------------------------------------------
// XG2-020 合身獣士・ブルタウラス【野牛鋭断】（自軍ターン中、バトルエリアに出たとき）
// 「敵軍バトルエリアのSユニットを好きな数選び撃破してもよい。ただし選べるユニットの数は、敵軍ダメージの点数と同じ数までとする。」（atwiki/page-1823）。
// 敵軍ダメージが0点なら発動しない。選び終えるか確定したら、選んだユニットをすべて撃破する。

const YAGYU_EFFECT_ID = "xg2_020_yagyu_eidan";

function applyYagyu(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  if (!ownTurn(state, ctx.playerId)) return { state, detail: "xg2_020:not_own_turn" };
  const limit = state.players[opponent(ctx.playerId)].damage;
  if (limit <= 0) return { state, detail: "xg2_020:no_damage" };
  const ids = enemyUnits(state, ctx.playerId, "XG2-020", ["battle"]).filter((c) => rk1IsSmallNow(state, c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg2_020:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG2-020"), effectId: YAGYU_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: limit, optional: true, xg2Meta: { limit } }),
    detail: YAGYU_EFFECT_ID,
  };
}

function yagyuFinish(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG2-020", `${YAGYU_EFFECT_ID}_destroy`, selected);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG2-020", `${YAGYU_EFFECT_ID}:${selected.length}`) };
}

registerXg2Choice(YAGYU_EFFECT_ID, {
  resolve: (state, playerId, instanceId) => {
    const pending = state.pendingEffectChoice!;
    const limit = metaOf<{ limit: number }>(pending).limit;
    const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
    const rest = pending.validInstanceIds.filter((id) => !selected.includes(id));
    const updated: GameState = { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: rest, mayConfirm: true } };
    if (selected.length >= limit || rest.length === 0) return yagyuFinish(updated, playerId);
    return { state: updated, log: logFor(state, playerId, "XG2-020", `${YAGYU_EFFECT_ID}:${instanceId}`) };
  },
  skip: (state, playerId) => {
    const pending = state.pendingEffectChoice!;
    if ((pending.selectedInstanceIds ?? []).length > 0) return yagyuFinish(state, playerId);
    return simpleSkipXg2()(state, playerId);
  },
  confirm: yagyuFinish,
});

// ---------------------------------------------------------------------------
// 起点

registerXg2Keyword("XG2-001::five_blaster", applyFive("XG2-001"));
registerXg2Keyword("XG2-002::twin_frisbee", applyFive("XG2-002"));
registerXg2Keyword("XG2-003::circle_computer", applyFive("XG2-003"));
registerXg2Keyword("XG2-005::alpha_laser", applyAlphaLaser);
registerXg2Keyword("XG2-011::tora_no_ko", applyTigerSecret);
registerXg2Keyword("XG2-012::hisho_ken", applyKingSword("XG2-012", "rush"));
registerXg2Keyword("XG2-013::byakko_shinken", applyByakko);
registerXg2Keyword("XG2-015::sekiryu_soryuken", applySekiryu);
registerXg2Keyword("XG2-017::daiou_ken", applyKingSword("XG2-017", "battle"));
registerXg2Keyword("XG2-018::rairaiju", applyRairai);
registerXg2Keyword("XG2-020::yagyu_eidan", applyYagyu);
// 継続効果・ほかの処理の場所から発動する効果。DSL からは何もしない。
registerXg2Keyword("XG2-004::chojigen_sword", noop("xg2_004:sp2"));
registerXg2Keyword("XG2-006::beta_launcher", noop("xg2_006:restriction"));
registerXg2Keyword("XG2-007::gamma_cannon", noop("xg2_007:defender_bp"));
registerXg2Keyword("XG2-009::kodo_yosoku", noop("xg2_009:battle_phase_start"));
registerXg2Keyword("XG2-010::ryusei_kick", noop("xg2_010:before_battle"));
registerXg2Keyword("XG2-016::tenku_daifusha", noop("xg2_016:combo"));
