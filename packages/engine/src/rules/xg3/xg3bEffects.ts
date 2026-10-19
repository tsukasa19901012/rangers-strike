/**
 * クロスギャザー ザ・Wインパクト XG3-022〜XG3-041（アバレッド〜仮面ライダーディケイドCF）のカード固有の効果（cardSpec XG3-022-041 の監査）。
 * 入口は rules/xg3/xg3Effects.ts、登録簿は rules/xg3/xg3Registry.ts。選択の組み立ては rules/rm/rm1Effects.ts の共通の部品を使う。
 * 継続効果（XG3-023 の BP、XG3-029 ※・【ウルサーベル】の BP/SP、XG3-031 の SP、XG3-037 の無効）は rules/xg3/xg3Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { getDefinition, parsePowerCost, unitSizeOf, effectiveBp } from "../../core/catalog";
import { drawOne, opponent } from "../../core/helpers";
import { tryResolveDslNcEffects } from "../../dsl/triggerResolver";
import { patchPlayer } from "../playerPatches";
import { startEffectRush } from "../effectRush";
import { unitFeatures } from "../addedFeatures";
import { applyDamageToPlayer } from "../damagePayment";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { base, close, ctxBase, destroyAll, fieldUnits, findField, isUnitCard, logFor, moveFieldUnit, openAfter, openNext, pendingBase, proceed, selectableEnemy, shuffleDeck, stripForZone } from "../rm/rm1Effects";
import { CHOICE_RESOLVERS, CHOICE_SKIPPERS, ENTER_BATTLE_HOOKS, FIELD_ABILITIES, HOLD_COMPLETERS, KEYWORDS, ZONE_ACTIVATIONS } from "./xg3Registry";
import { fieldCategories, holdCommands, holdThen, nameIs, printedCategories, printedFeatures, releasedCommandIds, skipThen } from "./xg3Common";

/** 継続効果・別の入口で処理するカードのキーワード（DSL の grant_keyword から呼ばれても何もしない）。 */
for (const key of ["XG3-023::max_field", "XG3-028::araburu", "XG3-029::urzard_note", "XG3-033::nanashi", "XG3-024::torinoid", "XG3-025::giganoid", "XG3-041::toorisugari"]) {
  KEYWORDS[key] = (state) => ({ state, detail: `${key}:static` });
}

function isOwnTurn(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

/** カードを自軍ラッシュエリアに出す（ラッシュではない「出す」。コマンド・パワーは要らない。rules/keywordGapRuntime.ts と同じ）。 */
function putIntoRush(state: GameState, playerId: PlayerId, zone: "hand" | "power" | "command", instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p[zone].find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, [zone]: p[zone].filter((c) => c.instanceId !== instanceId), rush: [...p.rush, { ...stripForZone(card), rushedThisTurn: true }] };
  });
}

/** 手札のカードを捨札にする。 */
function discardFromHand(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), discard: [...p.discard, stripForZone(card)] };
  });
}

/** 選択を開く（ほかの選択の途中ならその後に。resumeChoice を引き継ぐ）。 */
function openFollow(state: GameState, pending: PendingEffectChoice, next: PendingEffectChoice): GameState {
  return state.pendingEffectChoice ? openAfter(state, { ...next, resumeChoice: pending.resumeChoice }) : openNext(state, pending, next);
}

// ---------------------------------------------------------------------------
// XG3-022 アバレッド【アバレイザー】（NC。atwiki/page-1898）
// 「「SP1」特徴「恐竜」を持つ自軍ユニットの数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破してもよい。」
// 「SP1」は DSL のまま。数えるのは自軍エリアの（いまの特徴で）「恐竜」を持つユニット。敵軍ユニットはエリア・サイズを問わない（カード評価）。
// 必要パワーの数字は印刷の数字（「2+」は2）。

const ABAREIZER_EFFECT_ID = "xg3022_abareizer";

KEYWORDS["XG3-022::abareizer"] = (state, ctx) => {
  const dinos = fieldUnits(state, ctx.playerId).filter((c) => unitFeatures(state, ctx.playerId, c).includes("恐竜")).length;
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const cost = getDefinition(state.definitions, c.cardId)?.powerCost;
      if (cost === undefined) return false;
      const n = parsePowerCost(cost);
      return Number.isFinite(n) && n <= dinos && selectableEnemy(state, ctx.playerId, "XG3-022", c);
    })
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3022:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-022"), effectId: ABAREIZER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: ABAREIZER_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[ABAREIZER_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[ABAREIZER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-022", ABAREIZER_EFFECT_ID, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-022", `${ABAREIZER_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-024 創造の使徒ミケラ【トリノイド創造】（atwiki/page-1899）・XG3-025 無限の使徒ヴォッファ【ギガノイド創造】（atwiki/page-1900）
// 「これが自軍エリアにある間、自軍ラッシュフェイズを行うとき、かわりに次の効果を発動できる⇒DAの自軍コマンドを3つホールドしてから、自軍山札を見て、
//  （024: 特徴が3つ以上でDAを持つSユニット／025: DAを持つLユニット）のカードを自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。
//  その後、山札をシャッフルする。」
// 起動は activate_field_unit_ability（自軍ラッシュフェイズ中、1ターンに1回）。発動したターンは、そのラッシュフェイズのラッシュをもう行わない
// （rules/xg3/xg3Effects.ts filterXg3LegalActions）。リリース状態の DA の自軍コマンドを3つホールドする（ちょうど3つなら選ばない）。
// 山札から出すのは効果のラッシュ（追加条件は満たす。必要パワーは問わない）。山札は選ぶ前にシャッフルする（選んだ1枚を除いた並びは同じく無作為）。

type CreationSpec = { cardId: string; effectId: string; fits: (state: GameState, card: CardInstance) => boolean };

const CREATIONS: CreationSpec[] = [
  {
    cardId: "XG3-024",
    effectId: "xg3024_torinoid",
    fits: (state, c) => unitSizeOf(state.definitions, c) === "S" && printedCategories(state, c.cardId).includes("DA") && printedFeatures(state, c.cardId).length >= 3,
  },
  {
    cardId: "XG3-025",
    effectId: "xg3025_giganoid",
    fits: (state, c) => unitSizeOf(state.definitions, c) === "L" && printedCategories(state, c.cardId).includes("DA"),
  },
];

for (const spec of CREATIONS) {
  const holdId = `${spec.effectId}_hold`;
  FIELD_ABILITIES.push({
    matches: (cardId) => isSameCardIdentity(cardId, spec.cardId),
    canActivate: (state, playerId) => {
      if (state.phase !== "rush" || !isOwnTurn(state, playerId)) return false;
      if (state.pendingEffectChoice || state.pendingEffectRush || state.pendingCommandPayment) return false;
      const replaced = state.xg3?.rushPhaseReplaced;
      if (replaced && replaced.ownerId === playerId && replaced.turn === state.turn) return false;
      return releasedCommandIds(state, playerId, "DA").length >= 3;
    },
    resolve: (state, playerId, card) => {
      const next: GameState = { ...state, xg3: { ...state.xg3, rushPhaseReplaced: { ownerId: playerId, turn: state.turn } } };
      return holdThen(next, { playerId, phasePlayerId: playerId, sourceInstanceId: card.instanceId }, spec.cardId, holdId, releasedCommandIds(next, playerId, "DA"), 3);
    },
  });
  HOLD_COMPLETERS[holdId] = (state, pending) => {
    let next = shuffleDeck(state, pending.playerId);
    const ids = next.players[pending.playerId].deck.filter((c) => isUnitCard(next, c.cardId) && spec.fits(next, c)).map((c) => c.instanceId);
    next = startEffectRush(next, {
      playerId: pending.playerId,
      phasePlayerId: pending.phasePlayerId,
      effectId: spec.effectId,
      sourceCardId: spec.cardId,
      sourceInstanceId: pending.sourceInstanceId,
      fromZone: "deck",
      candidates: ids,
      maxCount: 1,
      requireConditions: true,
      ignorePowerCost: true,
      alwaysAsk: true,
    });
    return proceed(next, pending);
  };
}

// ---------------------------------------------------------------------------
// XG3-026 マックスオージャ【爆竜必殺マックスショルダーアタック】（atwiki/page-1999）
// 「自軍ターン中、これがバトルエリアに出たとき、相手は1点ダメージを受けるか、リリース状態の自軍コマンドが2つ以上あればすべて選びホールドするかを選ぶ。」
// 相手のリリース状態のコマンドが2つ以上なら相手が選ぶ（"xg3026_damage"／"xg3026_hold"）。1つ以下なら1点ダメージ。

const SHOULDER_EFFECT_ID = "xg3026_shoulder";
const SHOULDER_DAMAGE = "xg3026_damage";
const SHOULDER_HOLD = "xg3026_hold";

KEYWORDS["XG3-026::shoulder"] = (state, ctx) => {
  if (!isOwnTurn(state, ctx.playerId)) return { state, detail: "xg3026:enemy_turn" };
  const enemyId = opponent(ctx.playerId);
  if (releasedCommandIds(state, enemyId).length < 2) {
    return { state: applyDamageToPlayer(state, enemyId, 1, { kind: "none", activePlayer: ctx.phasePlayerId }), detail: SHOULDER_DAMAGE };
  }
  return {
    state: openAfter(state, {
      ...base(ctxBase(ctx), "XG3-026"),
      playerId: enemyId,
      effectId: SHOULDER_EFFECT_ID,
      kind: "pick_effect_branch",
      validInstanceIds: [SHOULDER_DAMAGE, SHOULDER_HOLD],
      optional: false,
    }),
    detail: SHOULDER_EFFECT_ID,
  };
};
CHOICE_RESOLVERS[SHOULDER_EFFECT_ID] = (state, playerId, mode) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  if (mode === SHOULDER_HOLD) next = holdCommands(next, playerId, releasedCommandIds(next, playerId));
  else next = applyDamageToPlayer(next, playerId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-026", `${SHOULDER_EFFECT_ID}:${mode}`) };
};

// ---------------------------------------------------------------------------
// XG3-027 スティラコサウルス【ファイヤーボールクラッシュ】（atwiki/page-1901）
// 「これをラッシュしたとき、敵軍バトルエリアからBP3000以下のユニットを3体まで選び撃破してもよい。」
// 1体ずつ選ぶ（最初の選択は見送れる）。2体目からは "confirm" で選び終える。選んだユニットをまとめて撃破する。

const FIREBALL_EFFECT_ID = "xg3027_fireball";
const FIREBALL_CONFIRM = "confirm";

function fireballIds(state: GameState, playerId: PlayerId, picked: string[]): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => !picked.includes(c.instanceId) && isUnitCard(state, c.cardId) && effectiveBp(state, enemyId, c) <= 3000 && selectableEnemy(state, playerId, "XG3-027", c))
    .map((c) => c.instanceId);
}

KEYWORDS["XG3-027::fireball"] = (state, ctx) => {
  const ids = fireballIds(state, ctx.playerId, []);
  if (ids.length === 0) return { state, detail: "xg3027:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-027"), effectId: FIREBALL_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true, xg3Meta: { picked: [] } }),
    detail: FIREBALL_EFFECT_ID,
  };
};
function fireballFinish(state: GameState, pending: PendingEffectChoice, picked: string[]): GameState {
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG3-027", FIREBALL_EFFECT_ID, picked);
  return proceed(next, pending);
}
CHOICE_SKIPPERS[FIREBALL_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: fireballFinish(state, pending, pending.xg3Meta?.picked ?? []), log: logFor(state, playerId, "XG3-027", `${FIREBALL_EFFECT_ID}:skip`) };
};
CHOICE_RESOLVERS[FIREBALL_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const before = pending.xg3Meta?.picked ?? [];
  const log = logFor(state, playerId, "XG3-027", `${FIREBALL_EFFECT_ID}:${instanceId}`);
  if (instanceId === FIREBALL_CONFIRM) return { state: fireballFinish(state, pending, before), log };
  const picked = [...before, instanceId];
  const rest = fireballIds(state, playerId, picked);
  if (picked.length >= 3 || rest.length === 0) return { state: fireballFinish(state, pending, picked), log };
  return {
    state: { ...state, pendingEffectChoice: { ...pending, validInstanceIds: [...rest, FIREBALL_CONFIRM], selectedInstanceIds: picked, xg3Meta: { picked } } },
    log,
  };
};

// ---------------------------------------------------------------------------
// XG3-028 魔導馬バリキオン【荒ぶる駿馬】（atwiki/page-1902）
// 「これが自分の手札にある間、自軍ラッシュフェイズ中、「魔導馬バリキオン」以外の特徴「魔法」を持つ自軍ユニットがあれば、これをラッシュエリアに出してもよい。」
// 手札からの起動（self_rush_from_zone, zone hand）。コマンド・パワーは要らない（カード評価「コマンドを無視できる」）。

ZONE_ACTIVATIONS.push({
  zone: "hand",
  matches: (cardId) => isSameCardIdentity(cardId, "XG3-028"),
  canActivate: (state, playerId) => {
    if (state.phase !== "rush" || !isOwnTurn(state, playerId) || state.pendingEffectChoice || state.pendingEffectRush) return false;
    return fieldUnits(state, playerId).some((c) => !nameIs(state, c.cardId, "魔導馬バリキオン") && unitFeatures(state, playerId, c).includes("魔法"));
  },
  activate: (state, playerId, instanceId) => putIntoRush(state, playerId, "hand", instanceId),
});

// ---------------------------------------------------------------------------
// XG3-029 魔導騎士ウルザード【ウルサーベル】（atwiki/page-2016）
// 「自軍ターン中、これがバトルエリアに出たとき、自分の手札を1枚選び捨札にしてもよい。そうしたとき、このターン、これはBP+2000され、「SP1」になる。」
// ※（M ユニット・「人型」）は rules/xg3/xg3Fields.ts。

const URSABER_EFFECT_ID = "xg3029_ursaber";

KEYWORDS["XG3-029::ursaber"] = (state, ctx) => {
  if (!isOwnTurn(state, ctx.playerId)) return { state, detail: "xg3029:enemy_turn" };
  const ids = state.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3029:no_hand" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-029"), effectId: URSABER_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: URSABER_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[URSABER_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[URSABER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = discardFromHand(close(state, pending), playerId, instanceId);
  const self = pending.sourceInstanceId;
  if (self && findField(next, playerId, self)) {
    next = { ...next, xg3: { ...next.xg3, turnBuffs: [...(next.xg3?.turnBuffs ?? []).filter((b) => b.turn === next.turn), { instanceId: self, turn: next.turn, bp: 2000, sp: 1 }] } };
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-029", `${URSABER_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-031 ゲキブルー【宙宙斬】（NC。atwiki/page-1904）
// 「このターン、自軍バトルエリアの2番目に並ぶ、特徴「激気」を持つMユニットは次の能力を得る⇒「SP1」」。SP は rules/xg3/xg3Fields.ts。

KEYWORDS["XG3-031::chuchuzan"] = (state, ctx) => {
  const list = (state.xg3?.gekiBlue ?? []).filter((g) => g.turn === state.turn);
  return { state: { ...state, xg3: { ...state.xg3, gekiBlue: [...list, { ownerId: ctx.playerId, turn: state.turn }] } }, detail: "xg3031_chuchuzan" };
};

// ---------------------------------------------------------------------------
// XG3-032 ゲキイエロー【弾弾丸】（NC。atwiki/page-1905）
// 「「SP1」 自分の手札から、特徴「激気」を持つMユニットのカードを1枚選び捨札にしてもよい。そうしたとき、敵軍ラッシュエリアにSユニットがあれば
//  1体選び撃破する。その後、自分は1枚ドローする。」（「SP1」は DSL のまま）

const DANDAN_EFFECT_ID = "xg3032_dandan";
const DANDAN_PICK_EFFECT_ID = "xg3032_dandan_pick";

KEYWORDS["XG3-032::dandan"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].hand
    .filter((c) => isUnitCard(state, c.cardId) && unitSizeOf(state.definitions, c) === "M" && printedFeatures(state, c.cardId).includes("激気"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3032:no_hand" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-032"), effectId: DANDAN_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: DANDAN_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[DANDAN_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[DANDAN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = discardFromHand(close(state, pending), playerId, instanceId);
  const log = logFor(state, playerId, "XG3-032", `${DANDAN_EFFECT_ID}:${instanceId}`);
  const enemyId = opponent(playerId);
  const ids = next.players[enemyId].rush.filter((c) => isUnitCard(next, c.cardId) && rk1IsSmallNow(next, c) && selectableEnemy(next, playerId, "XG3-032", c)).map((c) => c.instanceId);
  if (ids.length === 0) {
    next = patchPlayer(next, playerId, drawOne);
    return { state: proceed(next, pending), log };
  }
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-032"), effectId: DANDAN_PICK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[DANDAN_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = destroyAll(close(state, pending), pendingBase(pending), "XG3-032", DANDAN_PICK_EFFECT_ID, [instanceId]);
  next = patchPlayer(next, playerId, drawOne);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-032", `${DANDAN_PICK_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-033 ナナシ連中【隙間より這い出す者達】（atwiki/page-1906）
// 「これが自軍ゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、これを自軍ラッシュエリアに出してもよい。（この効果でラッシュできる
//  「ナナシ連中」の数は、1ターンにつき2体までとする）」
// 自軍パワーゾーン（オモテ向き）・コマンドゾーン（リリース／ホールドを問わない）から起動する（self_rush_from_zone）。コマンド・パワーは要らない
// （コメント欄「表記のないコストは全部踏み倒せる」）。1ターンに2体まで（state.xg3.nanashi）。

function nanashiCount(state: GameState, playerId: PlayerId): number {
  return (state.xg3?.nanashi ?? []).find((n) => n.ownerId === playerId && n.turn === state.turn)?.count ?? 0;
}

for (const zone of ["power", "command"] as const) {
  ZONE_ACTIVATIONS.push({
    zone,
    matches: (cardId) => isSameCardIdentity(cardId, "XG3-033"),
    canActivate: (state, playerId, instanceId) => {
      if (state.phase !== "rush" || !isOwnTurn(state, playerId) || state.pendingEffectChoice || state.pendingEffectRush) return false;
      const card = state.players[playerId][zone].find((c) => c.instanceId === instanceId);
      if (!card || card.faceDown) return false;
      return nanashiCount(state, playerId) < 2;
    },
    activate: (state, playerId, instanceId) => {
      const count = nanashiCount(state, playerId);
      const others = (state.xg3?.nanashi ?? []).filter((n) => n.turn === state.turn && n.ownerId !== playerId);
      const next = putIntoRush(state, playerId, zone, instanceId);
      return { ...next, xg3: { ...next.xg3, nanashi: [...others, { ownerId: playerId, turn: state.turn, count: count + 1 }] } };
    },
  });
}

// ---------------------------------------------------------------------------
// XG3-035 海老折神【太巻き光輪】（atwiki/page-1908）
// 「これをラッシュしたとき、相手の手札が1枚以上あれば、次の効果を発動できる⇒敵軍コマンドゾーンのカードを1枚選び、相手の手札を見ないで1枚選ぶ。
//  そうしたとき、選んだ2枚を置き換える。」
// 敵軍コマンドを選ぶことが発動の宣言（見送れる）。手札は見ないで選ぶ（強制）。置き換え（R-REPL-04）: 手札のカードがそのコマンドの位置
// （リリース／ホールドの状態のまま）に入り、コマンドのカードは相手の手札へ。

const FUTOMAKI_EFFECT_ID = "xg3035_futomaki";
const FUTOMAKI_HAND_EFFECT_ID = "xg3035_futomaki_hand";

KEYWORDS["XG3-035::futomaki"] = (state, ctx) => {
  const enemy = state.players[opponent(ctx.playerId)];
  if (enemy.hand.length === 0 || enemy.command.length === 0) return { state, detail: "xg3035:not_met" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-035"), effectId: FUTOMAKI_EFFECT_ID, kind: "select_unit", validInstanceIds: enemy.command.map((c) => c.instanceId), selectCount: 1, optional: true }),
    detail: FUTOMAKI_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[FUTOMAKI_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[FUTOMAKI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const hand = next.players[opponent(playerId)].hand.map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG3-035", `${FUTOMAKI_EFFECT_ID}:${instanceId}`);
  if (hand.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openNext(next, pending, { ...base(pendingBase(pending), "XG3-035"), effectId: FUTOMAKI_HAND_EFFECT_ID, kind: "select_unit", validInstanceIds: hand, selectCount: 1, optional: false, xg3Meta: { targetInstanceId: instanceId } }),
    log,
  };
};
CHOICE_RESOLVERS[FUTOMAKI_HAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const commandId = pending.xg3Meta?.targetInstanceId;
  const next = patchPlayer(close(state, pending), opponent(playerId), (p) => {
    const cmd = p.command.find((c) => c.instanceId === commandId);
    const card = p.hand.find((c) => c.instanceId === instanceId);
    if (!cmd || !card) return p;
    return {
      ...p,
      command: p.command.map((c) => (c.instanceId === commandId ? { ...stripForZone(card), ...(cmd.commandHeld ? { commandHeld: true } : {}) } : c)),
      hand: [...p.hand.filter((c) => c.instanceId !== instanceId), stripForZone(cmd)],
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-035", `${FUTOMAKI_HAND_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-037 烏賊折神【烏賊墨砲】（atwiki/page-1909）
// 「これをラッシュしたとき、テキストに「アタックされない」と書かれた敵軍ユニットを1体選んでもよい。そうしたとき、このターン、そのユニットの持つ
//  「アタックされない」という記述のあるテキストは無効になる。」
// 候補は本文に「アタックされない」と書かれた敵軍ユニット（エリアを問わない）。無効は rules/xg3/xg3Fields.ts xg3NoAttackTextDisabled。

const IKASUMI_EFFECT_ID = "xg3037_ikasumi";

KEYWORDS["XG3-037::ikasumi"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.text ?? "").includes("アタックされない") && selectableEnemy(state, ctx.playerId, "XG3-037", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3037:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-037"), effectId: IKASUMI_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: IKASUMI_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[IKASUMI_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[IKASUMI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = close(state, pending);
  const list = (next.xg3?.noAttackTextDisabled ?? []).filter((d) => d.turn === next.turn);
  const done: GameState = { ...next, xg3: { ...next.xg3, noAttackTextDisabled: [...list, { instanceId, turn: next.turn }] } };
  return { state: proceed(done, pending), log: logFor(state, playerId, "XG3-037", `${IKASUMI_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-038 イカダイカイオー【槍烏賊突貫】（atwiki/page-1881）
// 「これをラッシュしたとき、BP5000以下の敵軍ユニットを1体選び、持ち主の手札に戻してもよい。そうしたとき、相手は自分自身の手札を1枚選び捨札にする。」
// 敵軍ユニットはエリアを問わない。戻したら、相手が自分の手札（戻したカードを含む）から1枚選んで捨札にする（強制）。

const YARIIKA_EFFECT_ID = "xg3038_yariika";
const YARIIKA_DISCARD_EFFECT_ID = "xg3038_yariika_discard";

KEYWORDS["XG3-038::yariika"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId).filter((c) => effectiveBp(state, enemyId, c) <= 5000 && selectableEnemy(state, ctx.playerId, "XG3-038", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3038:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-038"), effectId: YARIIKA_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: YARIIKA_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[YARIIKA_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[YARIIKA_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const next = moveFieldUnit(close(state, pending), enemyId, instanceId, pending.phasePlayerId, "hand");
  const log = logFor(state, playerId, "XG3-038", `${YARIIKA_EFFECT_ID}:${instanceId}`);
  const hand = next.players[enemyId].hand.map((c) => c.instanceId);
  if (hand.length === 0) return { state: proceed(next, pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-038"), playerId: enemyId, effectId: YARIIKA_DISCARD_EFFECT_ID, kind: "select_unit", validInstanceIds: hand, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[YARIIKA_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = discardFromHand(close(state, pending), playerId, instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-038", `${YARIIKA_DISCARD_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-039 ダイゴヨウ【秘伝ディスク乱れ撃ち】（atwiki/page-1910）
// 「これをラッシュしたとき、自分の手札からオペレーションカードを1枚選び捨札にしてもよい。そうしたとき、相手は自分自身の手札を1枚選び山札に戻して
//  シャッフルする。」

const DISK_EFFECT_ID = "xg3039_disk";
const DISK_RETURN_EFFECT_ID = "xg3039_disk_return";

KEYWORDS["XG3-039::disk"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].hand.filter((c) => getDefinition(state.definitions, c.cardId)?.type === "operation").map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3039:no_operation" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-039"), effectId: DISK_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: true }),
    detail: DISK_EFFECT_ID,
  };
};
CHOICE_SKIPPERS[DISK_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[DISK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = discardFromHand(close(state, pending), playerId, instanceId);
  const log = logFor(state, playerId, "XG3-039", `${DISK_EFFECT_ID}:${instanceId}`);
  const enemyId = opponent(playerId);
  const hand = next.players[enemyId].hand.map((c) => c.instanceId);
  if (hand.length === 0) return { state: proceed(next, pending), log };
  return { state: openFollow(next, pending, { ...base(pendingBase(pending), "XG3-039"), playerId: enemyId, effectId: DISK_RETURN_EFFECT_ID, kind: "select_unit", validInstanceIds: hand, selectCount: 1, optional: false }), log };
};
CHOICE_RESOLVERS[DISK_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => {
    const card = p.hand.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return { ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), deck: [...p.deck, stripForZone(card)] };
  });
  next = shuffleDeck(next, playerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-039", `${DISK_RETURN_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-040 シンケンレッド【シンケンマル】（NC。atwiki/page-2006）
// 「カテゴリにDAを持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」
// 敵軍 S ユニット（エリアを問わない。いまのカテゴリに DA を含む。マルチカテゴリも）から1体選ぶ（強制）。ウラ向きでパワーゾーンへ（ダメージ+1）。

const SHINKENMARU_EFFECT_ID = "xg3040_shinkenmaru";

KEYWORDS["XG3-040::shinkenmaru"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => rk1IsSmallNow(state, c) && fieldCategories(state, enemyId, c).includes("DA") && selectableEnemy(state, ctx.playerId, "XG3-040", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg3040:no_targets" };
  return {
    state: openAfter(state, { ...base(ctxBase(ctx), "XG3-040"), effectId: SHINKENMARU_EFFECT_ID, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional: false }),
    detail: SHINKENMARU_EFFECT_ID,
  };
};
CHOICE_RESOLVERS[SHINKENMARU_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG3-040", `${SHINKENMARU_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG3-041 仮面ライダーディケイドCF【通りすがりの仮面ライダー】（atwiki/page-2007）
// 「このターン中にNCまたはRCの効果を発動した、カテゴリにDA以外を持つSユニットからコンビネーションするとき、次の効果を発動できる⇒
//  コンビネーションするユニットのNCまたはRCの効果を、このユニットの効果として発動する。」
// これがバトルエリアに出たとき、直前に並ぶユニットが、このターンに NC を成立させた（activatedNcEffects）S ユニットで、いまのカテゴリに DA 以外を
// 持つなら、発動するか選ぶ（任意）。発動したら、そのユニットの NC の効果を、これを発動元として解決する（「SP1」等はこれが得る）。

export const DECADE_CF_CARD_ID = "XG3-041";
const DECADE_EFFECT_ID = "xg3041_toorisugari";

ENTER_BATTLE_HOOKS.push((state, playerId, card, battleBeforeEnter) => {
  if (!isSameCardIdentity(card.cardId, DECADE_CF_CARD_ID)) return state;
  const left = battleBeforeEnter[battleBeforeEnter.length - 1];
  if (!left || (left.activatedNcEffects ?? []).length === 0) return state;
  if (!rk1IsSmallNow(state, left)) return state;
  const cats = fieldCategories(state, playerId, left);
  if (!cats.some((c) => c !== "DA")) return state;
  return openAfter(state, {
    ...base({ playerId, phasePlayerId: state.activePlayer, sourceInstanceId: card.instanceId }, DECADE_CF_CARD_ID),
    effectId: DECADE_EFFECT_ID,
    kind: "confirm",
    validInstanceIds: ["accept"],
    optional: true,
    xg3Meta: { targetInstanceId: left.instanceId, picked: [left.cardId] },
  });
});
CHOICE_SKIPPERS[DECADE_EFFECT_ID] = skipThen();
CHOICE_RESOLVERS[DECADE_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const leftCardId = pending.xg3Meta?.picked?.[0];
  const self = pending.sourceInstanceId;
  let next = close(state, pending);
  const logs: string[] = [];
  if (leftCardId && self && findField(next, playerId, self)) {
    const r = tryResolveDslNcEffects({ state: next, cardId: leftCardId, instanceId: self, playerId, phasePlayerId: pending.phasePlayerId });
    next = r.state;
    logs.push(...r.logs);
  }
  const done = proceed(next, pending);
  return { state: { ...done, log: [...done.log, ...logs] }, log: logFor(state, playerId, DECADE_CF_CARD_ID, `${DECADE_EFFECT_ID}:${leftCardId ?? ""}`) };
};


