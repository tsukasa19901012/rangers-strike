/**
 * クロスギャザー XG5 XG5-041〜XG5-060（ゴセイイエロー〜仮面ライダーワイルドカリス）のカード固有の効果（cardSpec XG5-041-060 の監査）。
 * 登録先は rules/xg5/xg5Core.ts。継続効果の判定（XG5-041・049・050・051・054・059 の BP・SP・選ばれない・可能なら出る／アタックする）は
 * rules/xg5/xg5Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import { effectiveBp } from "../../core/catalog";
import { patchPlayer } from "../playerPatches";
import { startEffectRush, filterEffectRushCandidates } from "../effectRush";
import { applyDamageToPlayer } from "../damagePayment";
import { requestDrawFromDeck } from "../drawFromDeck";
import { moveToExile } from "../exile";
import { applyUnitLeave } from "../pendingChoices";
import { isPermanentOperationCard, placePermanentOperation } from "../permanentOperation";
import { strikeDamageFor } from "../combo";
import { tryOpenEndTurnEffectsMenu } from "../legend3/endTurnEffects";
import {
  close,
  ctxBase,
  fieldCards,
  fieldUnits,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  printedBp,
  proceed,
  selectableEnemy,
  simpleSkip,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import {
  AFTER_ACTION_HOOKS,
  ATTACK_WIN_HOOKS,
  ATTACKED_HOOKS,
  CHOICE_CONFIRMERS,
  CHOICE_RESOLVERS,
  CHOICE_SKIPPERS,
  HAND_ACTIVATIONS,
  WATCH_HANDLERS,
  XG5_KEYWORDS,
  noop,
} from "./xg5Core";
import { XG5_KATARU, printedCostNumber, xg5CostNumber, xg5Flags, xg5TurnPlayer } from "./xg5Fields";
import { multiChoice, registerMulti } from "./xg5bEffects";
import {
  addFlag,
  addWatch,
  cmdHeldPut,
  defOf,
  isNamed,
  opp,
  patchXg5,
  printedCategories,
  printedFeatures,
  selectOne,
  setFieldHeld,
  sizeOf,
  xg5Busy,
} from "./xg5Shared";

const PLAYERS: PlayerId[] = ["player1", "player2"];

function isUnit(state: GameState, c: CardInstance): boolean {
  return defOf(state, c.cardId)?.type === "unit";
}
function isSUnit(state: GameState, c: CardInstance): boolean {
  return isUnit(state, c) && sizeOf(state, c) === "S";
}

/** ラッシュフェイズを終えたアクションか（rush から次のフェイズに進んだ）。終えたプレイヤーを返す。 */
function rushPhaseEnded(before: GameState, after: GameState): PlayerId | null {
  if (before.phase !== "rush" || after.phase === "rush" || after.turn !== before.turn) return null;
  return before.activePlayer;
}

// ---------------------------------------------------------------------------
// XG5-041 ゴセイイエロー【兄妹の絆】（NC）
// 「これは次の相手ターン終了時まで、次の能力を得る⇒「BP+3000｣「スクラム」（自分の手札が1枚以下なら、追加で次の能力を得る⇒これはアタックされる以外では
//  相手に選ばれない）」（atwiki/page-2232）。flags の xg5-041（turn は次の相手ターン）。BP・スクラム・選ばれないは rules/xg5/xg5Fields.ts。
// 手札の枚数は NC の効果を処理したときに見る。

XG5_KEYWORDS["XG5-041::sibling_bond"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  if (!self) return { state, detail: "xg5_041:no_source" };
  const n = state.players[ctx.playerId].hand.length <= 1 ? 1 : 0;
  return { state: addFlag(state, { kind: "xg5-041", playerId: ctx.playerId, turn: state.turn + 1, target: self, n }), detail: "xg5_041:sibling_bond" };
};

// ---------------------------------------------------------------------------
// XG5-042 ゴセイマシン【天装合体】
// 「自軍ラッシュフェイズ中、このユニットを捨札にしてもよい。そうしたとき、自分の手札から「ゴセイグレート」のカードを1枚選び、自軍ラッシュエリアに出してもよい。」
// （atwiki/page-2204）。合法手は activate_field_unit_ability（場のこのカード）。出すのは効果のラッシュで、必要パワー・追加条件は問わない（本文に「満たすこと」がない）。

HAND_ACTIVATIONS.push({
  list: (state, playerId) => {
    if (state.phase !== "rush" || state.activePlayer !== playerId || xg5Busy(state)) return [];
    return fieldCards(state, playerId).filter((c) => isSameCardIdentity(c.cardId, "XG5-042")).map((c) => c.instanceId);
  },
  activate: (state, playerId, instanceId) => {
    if (!findField(state, playerId, instanceId)) return null;
    let next = moveFieldUnit(state, playerId, instanceId, playerId, "discard");
    const ids = next.players[playerId].hand.filter((c) => isNamed(next, c.cardId, "ゴセイグレート")).map((c) => c.instanceId);
    const ok = filterEffectRushCandidates(next, playerId, "hand", ids, false, true);
    if (ok.length === 0) return next;
    next = startEffectRush(next, {
      playerId,
      phasePlayerId: playerId,
      effectId: "xg5_042_tenso_gattai",
      sourceCardId: "XG5-042",
      sourceInstanceId: instanceId,
      fromZone: "hand",
      candidates: ok,
      maxCount: 1,
      requireConditions: false,
      ignorePowerCost: true,
      alwaysAsk: true,
    });
    return next;
  },
});

// ---------------------------------------------------------------------------
// XG5-043 シーイックゴセイグレート・XG5-044 ランディックゴセイグレート・XG5-045 スカイックゴセイグレート
// 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動する⇒自軍捨札にある○○を持つカードの枚数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを
//  1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-2242・2176・2275）。○○はタクス・レジスト・ウイング（本文の「※○○」で数える）。
// 敵軍ユニットはエリアを問わない。見送れない。

const GREAT = "xg5_great_strike";
const GREAT_KW: Record<string, RegExp> = { "XG5-043": /※タクス/, "XG5-044": /※レジスト/, "XG5-045": /※ウイング/ };
for (const id of Object.keys(GREAT_KW)) {
  XG5_KEYWORDS[`${id}::great_strike`] = (state, ctx) => {
    const pid = ctx.playerId;
    if (xg5TurnPlayer(state) !== pid) return { state, detail: `${id}:enemy_turn` };
    const kw = GREAT_KW[id]!;
    const count = state.players[pid].discard.filter((c) => kw.test((defOf(state, c.cardId)?.text ?? "").normalize("NFKC"))).length;
    const enemyId = opp(pid);
    const ids = fieldUnits(state, enemyId)
      .filter((c) => xg5CostNumber(state, pid, enemyId, c.cardId) <= count && selectableEnemy(state, pid, id, c))
      .map((c) => c.instanceId);
    if (ids.length === 0) return { state, detail: `${id}:no_targets` };
    return { state: openAfter(state, selectOne(ctxBase(ctx), id, GREAT, ids, false)), detail: GREAT };
  };
}
CHOICE_RESOLVERS[GREAT] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, pending.sourceCardId, `${GREAT}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-046 データス【マスターヘッドの加護】
// 「これが自軍エリアにある間、自軍ラッシュフェイズを終えるとき、次の効果を発動できる⇒自軍エリアにSユニットが5体以上とLユニットが1体以上あれば、自分は1枚ドローする。」
// （atwiki/page-2205）。ラッシュフェイズを終えたら、条件を満たすときだけ、これごとに発動するかを確認する。S ユニットにはこれも含む（カード評価）。

const MASTER_HEAD = "xg5_046_master_head";
AFTER_ACTION_HOOKS.push((before, after) => {
  const pid = rushPhaseEnded(before, after);
  if (!pid) return after;
  const field = fieldCards(after, pid);
  const datas = field.filter((c) => isSameCardIdentity(c.cardId, "XG5-046"));
  if (datas.length === 0) return after;
  const units = field.filter((c) => isUnit(after, c));
  if (units.filter((c) => sizeOf(after, c) === "S").length < 5 || !units.some((c) => sizeOf(after, c) === "L")) return after;
  let next = after;
  for (const d of datas) next = openAfter(next, selectOne({ playerId: pid, phasePlayerId: pid, sourceInstanceId: d.instanceId }, "XG5-046", MASTER_HEAD, [d.instanceId], true));
  return next;
});
CHOICE_SKIPPERS[MASTER_HEAD] = simpleSkip();
CHOICE_RESOLVERS[MASTER_HEAD] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const drawn = requestDrawFromDeck(close(state, pending), playerId, pending.phasePlayerId, { count: 1, sourceCardId: "XG5-046" }).state;
  return { state: proceed(drawn, pending), log: logFor(state, playerId, "XG5-046", `${MASTER_HEAD}:draw`) };
};

// ---------------------------------------------------------------------------
// XG5-047 キューユソウル（オペレーション）
// 「自軍パワーゾーンのダメージ以外のカードをすべて捨札にする。そうしたとき、捨札にしたカードと同じ枚数まで、自軍パワーゾーンからダメージになっているカードを選び、
//  自軍山札の上に好きな順で戻す。」（atwiki/page-2206）。選んだ順に山札の上から並べる（最初に選んだカードがいちばん上）。

const KYUYU = "xg5_047_kyuyu_soul";
XG5_KEYWORDS["XG5-047::kyuyu_soul"] = (state, ctx) => {
  const pid = ctx.playerId;
  const up = state.players[pid].power.filter((c) => !c.faceDown);
  if (up.length === 0) return { state, detail: "xg5_047:no_face_up" };
  const upIds = new Set(up.map((c) => c.instanceId));
  const next = patchPlayer(state, pid, (p) => ({ ...p, power: p.power.filter((c) => !upIds.has(c.instanceId)), discard: [...p.discard, ...up.map(stripForZone)] }));
  const ids = next.players[pid].power.filter((c) => c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return { state: next, detail: "xg5_047:no_damage" };
  return { state: openAfter(next, multiChoice(ctxBase(ctx), "XG5-047", KYUYU, ids, up.length)), detail: KYUYU };
};
registerMulti(KYUYU, (state, pending, ids) =>
  patchPlayer(state, pending.playerId, (p) => {
    const picked = ids.map((id) => p.power.find((c) => c.instanceId === id)).filter((c): c is CardInstance => !!c);
    const set = new Set(picked.map((c) => c.instanceId));
    return { ...p, power: p.power.filter((c) => !set.has(c.instanceId)), deck: [...picked.map(stripForZone), ...p.deck], damage: Math.max(0, p.damage - picked.length) };
  }),
);

// ---------------------------------------------------------------------------
// XG5-048 パーフェクター（オペレーション）
// 「自軍コマンドゾーンから、特徴「改造人間」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。
//  そうしたとき、自軍山札の上か下から1枚ひいて、自軍コマンドゾーンにホールド状態で置く。」（atwiki/page-2207）。
// 出したら「山札の上／山札の下」を選ぶ。コマンドゾーンに空きがなければ、ひいたカードは手札に加える。

const PERFECTER_PLACE = "xg5_048_perfecter_place";
XG5_KEYWORDS["XG5-048::perfecter"] = (state, ctx) => {
  const pid = ctx.playerId;
  const ids = state.players[pid].command.filter((c) => isSUnit(state, c) && printedFeatures(state, c.cardId).includes("改造人間")).map((c) => c.instanceId);
  const ok = filterEffectRushCandidates(state, pid, "command", ids, true);
  if (ok.length === 0) return { state, detail: "xg5_048:no_targets" };
  let next = startEffectRush(state, {
    playerId: pid,
    phasePlayerId: ctx.phasePlayerId,
    effectId: "xg5_048_perfecter",
    sourceCardId: "XG5-048",
    sourceInstanceId: ctx.operationInstanceId ?? ctx.triggerSourceInstanceId,
    fromZone: "command",
    candidates: ok,
    maxCount: 1,
    requireConditions: true,
    alwaysAsk: true,
  });
  next = addWatch(next, { kind: "xg5-048", playerId: pid, phasePlayerId: ctx.phasePlayerId, candidates: ok });
  return { state: next, detail: "xg5_048_perfecter" };
};
WATCH_HANDLERS["xg5-048"] = (state, w, entered) => {
  if (entered.length === 0 || state.players[w.playerId].deck.length === 0) return state;
  return openAfter(state, selectOne({ playerId: w.playerId, phasePlayerId: w.phasePlayerId }, "XG5-048", PERFECTER_PLACE, ["deck_top", "deck_bottom"], false));
};
CHOICE_RESOLVERS[PERFECTER_PLACE] = (state, playerId, where) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const deck = next.players[playerId].deck;
  const card = where === "deck_bottom" ? deck.at(-1) : deck[0];
  if (card) {
    next =
      next.players[playerId].command.length < COMMAND_ZONE_MAX
        ? cmdHeldPut(next, playerId, card, "deck")
        : patchPlayer(next, playerId, (p) => ({ ...p, deck: p.deck.filter((c) => c.instanceId !== card.instanceId), hand: [...p.hand, stripForZone(card)] }));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-048", `${PERFECTER_PLACE}:${where}`) };
};

// ---------------------------------------------------------------------------
// XG5-049 再生アポロガイスト【アポロマグナム】
// 「自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、これは次の相手ターン終了時まで次の能力を得る⇒BP+4000」
// （atwiki/page-2271）。BP は rules/xg5/xg5Fields.ts（flags の xg5-049）。追加条件の「ホールド状態の」は rules/zord.ts。

const APOLLO = "xg5_049_apollo_magnum";
XG5_KEYWORDS["XG5-049::apollo_magnum"] = (state, ctx) => {
  const self = ctx.triggerSourceInstanceId;
  if (xg5TurnPlayer(state) !== ctx.playerId || !self) return { state, detail: "xg5_049:enemy_turn" };
  const card = findField(state, ctx.playerId, self);
  if (!card || card.commandHeld) return { state, detail: "xg5_049:held" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-049", APOLLO, [self], true)), detail: APOLLO };
};
CHOICE_SKIPPERS[APOLLO] = simpleSkip();
CHOICE_RESOLVERS[APOLLO] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const self = pending.sourceInstanceId;
  let next = close(state, pending);
  if (self && findField(next, playerId, self)) {
    next = addFlag(setFieldHeld(next, playerId, self, true), { kind: "xg5-049", playerId, turn: state.turn + 1, target: self });
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-049", `${APOLLO}:held`) };
};

// ---------------------------------------------------------------------------
// XG5-050 仮面ライダー装甲響鬼【語る背中】
// 「これが自軍エリアにある間、自分か相手がラッシュフェイズを終えるとき、「SP1」以上の敵軍ユニットがあれば、そのターン中、これは次の能力を得る。⇒BP+3000され、
//  このターンを終えるときホールド状態なら、リリースしてもよい。」（atwiki/page-2254）。SP はいまの SP。BP は rules/xg5/xg5Fields.ts（flags の xg5-050）。
// ターン終了時の確認は rules/xg5/xg5Fields.ts xg5KataruEndTurnChoice（rules/legend3/endTurnEffects.ts から）。

AFTER_ACTION_HOOKS.push((before, after) => {
  if (!rushPhaseEnded(before, after)) return after;
  let next = after;
  for (const pid of PLAYERS) {
    const enemyId = opp(pid);
    const sp1 = fieldUnits(after, enemyId).some((c) => strikeDamageFor(after.definitions, c, after, enemyId) >= 1);
    if (!sp1) continue;
    for (const c of fieldCards(after, pid)) {
      if (isSameCardIdentity(c.cardId, "XG5-050")) next = addFlag(next, { kind: "xg5-050", playerId: pid, turn: after.turn, target: c.instanceId });
    }
  }
  return next;
});
function continueEndTurn(state: GameState, turnPlayerId: PlayerId): GameState {
  if (state.pendingEffectChoice || state.phase !== "end") return state;
  return tryOpenEndTurnEffectsMenu(state, turnPlayerId) ?? state;
}
CHOICE_RESOLVERS[XG5_KATARU] = () => ({ error: "invalid_target" });
CHOICE_SKIPPERS[XG5_KATARU] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const next = proceed(close(state, pending), pending);
  return { state: continueEndTurn(next, pending.phasePlayerId), log: logFor(state, playerId, "XG5-050", `${XG5_KATARU}:stay`) };
};
CHOICE_CONFIRMERS[XG5_KATARU] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  if (pending.sourceInstanceId) next = setFieldHeld(next, playerId, pending.sourceInstanceId, false);
  return { state: continueEndTurn(proceed(next, pending), pending.phasePlayerId), log: logFor(state, playerId, "XG5-050", `${XG5_KATARU}:release`) };
};

// ---------------------------------------------------------------------------
// XG5-051 仮面ライダーカブトHF【天の道】
// 「これをラッシュしたとき、自軍パワーゾーンのオモテ向きのカードから、OTを持つ常駐オペレーションのカードを1枚選び自軍常駐置き場に配置してもよい。」
// （atwiki/page-2258）。※の SP1 は rules/xg5/xg5Fields.ts。

const TEN_NO_MICHI = "xg5_051_ten_no_michi";
XG5_KEYWORDS["XG5-051::ten_no_michi"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].power
    .filter((c) => !c.faceDown && isPermanentOperationCard(state.definitions, c.cardId) && printedCategories(state, c.cardId).includes("OT"))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_051:no_targets" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-051", TEN_NO_MICHI, ids, true)), detail: TEN_NO_MICHI };
};
CHOICE_RESOLVERS[TEN_NO_MICHI] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  const card = next.players[playerId].power.find((c) => c.instanceId === instanceId);
  if (card) {
    next = patchPlayer(next, playerId, (p) => ({ ...p, power: p.power.filter((c) => c.instanceId !== instanceId) }));
    next = placePermanentOperation(next, playerId, stripForZone(card));
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-051", `${TEN_NO_MICHI}:${instanceId}`) };
};
CHOICE_SKIPPERS[TEN_NO_MICHI] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-052 仮面ライダー電王CF【俺達の必殺技】
// 「自軍ターン中、これがバトルで敵軍ユニットを撃破したとき、撃破したユニットを捨札にするかわりに持ち主のパワーゾーンに送ってもよい。そうしたとき、相手に1点ダメージを
//  与える。」（atwiki/page-2226）。アタックしてバトルで撃破したとき（rules/operationCounters.ts の applyXg5AttackWin）、捨札になったそのカードを送るかを確認する。
// 送ったカードはオモテ向き（ダメージではない）。

const ORETACHI = "xg5_052_oretachi";
ATTACK_WIN_HOOKS.push((state, attackerId, attackerInstanceId, phasePlayerId, defenderInstanceId) => {
  if (phasePlayerId !== attackerId || !defenderInstanceId) return state;
  const self = findField(state, attackerId, attackerInstanceId);
  if (!self || !isSameCardIdentity(self.cardId, "XG5-052")) return state;
  if (!state.players[opp(attackerId)].discard.some((c) => c.instanceId === defenderInstanceId)) return state;
  return openAfter(state, {
    ...selectOne({ playerId: attackerId, phasePlayerId, sourceInstanceId: attackerInstanceId }, "XG5-052", ORETACHI, [defenderInstanceId], true),
    xg5Meta: { target: defenderInstanceId },
  });
});
CHOICE_SKIPPERS[ORETACHI] = simpleSkip();
CHOICE_RESOLVERS[ORETACHI] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opp(playerId);
  const id = pending.xg5Meta?.target;
  let next = close(state, pending);
  const card = next.players[enemyId].discard.find((c) => c.instanceId === id);
  if (!card) return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-052", `${ORETACHI}:gone`) };
  next = patchPlayer(next, enemyId, (p) => ({ ...p, discard: p.discard.filter((c) => c.instanceId !== id), power: [...p.power, { ...stripForZone(card), faceDown: false }] }));
  next = applyDamageToPlayer(next, enemyId, 1, { kind: "none", activePlayer: pending.phasePlayerId });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-052", `${ORETACHI}:to_power`) };
};

// ---------------------------------------------------------------------------
// XG5-053 仮面ライダーキバEF【ファイナルザンバット斬】
// 「自軍ターン中、これがバトルエリアに出たとき、特徴「怪人」を持つ自軍ユニットを1体選びホールドするか、特徴「怪人」を持つ自軍コマンドを1つ選びホールドしてもよい。
//  そうしたとき、BP5000以下の敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」（atwiki/page-2259）。
// 選べるのはリリース状態のもの（本来の特徴）。BP はいまの BP。敵軍ユニットはエリアを問わない。

const ZANBAT = "xg5_053_zanbat";
const ZANBAT_TARGET = "xg5_053_zanbat_target";
XG5_KEYWORDS["XG5-053::zanbat"] = (state, ctx) => {
  const pid = ctx.playerId;
  if (xg5TurnPlayer(state) !== pid) return { state, detail: "xg5_053:enemy_turn" };
  const kaijin = (c: CardInstance) => !c.commandHeld && printedFeatures(state, c.cardId).includes("怪人");
  const ids = [...fieldUnits(state, pid).filter(kaijin), ...state.players[pid].command.filter(kaijin)].map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg5_053:no_kaijin" };
  return { state: openAfter(state, selectOne(ctxBase(ctx), "XG5-053", ZANBAT, ids, true)), detail: ZANBAT };
};
CHOICE_RESOLVERS[ZANBAT] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = setFieldHeld(close(state, pending), playerId, instanceId, true);
  const enemyId = opp(playerId);
  const ids = fieldUnits(next, enemyId).filter((c) => effectiveBp(next, enemyId, c) <= 5000 && selectableEnemy(next, playerId, "XG5-053", c)).map((c) => c.instanceId);
  const log = logFor(state, playerId, "XG5-053", `${ZANBAT}:${instanceId}`);
  if (ids.length === 0) return { state: proceed(next, pending), log };
  return { state: openNext(next, pending, selectOne(pendingBase(pending), "XG5-053", ZANBAT_TARGET, ids, false)), log };
};
CHOICE_SKIPPERS[ZANBAT] = simpleSkip();
CHOICE_RESOLVERS[ZANBAT_TARGET] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveFieldUnit(close(state, pending), opp(playerId), instanceId, pending.phasePlayerId, "power_damage");
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-053", `${ZANBAT_TARGET}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-055 仮面ライダーギャレン【ファイアアッパー】（RC）
// 「自分の手札を2枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードの必要パワーの数字が「3」と「6」なら、
//  敵軍捨札からSユニットのカードを１枚選びゲームから除外する。」（atwiki/page-2173）。見せたカードは手札に残る。ホールドするのはリリース状態の敵軍 S ユニット。

const FIRE_UPPER = "xg5_055_fire_upper";
const FIRE_UPPER_HOLD = "xg5_055_fire_upper_hold";
const FIRE_UPPER_EXILE = "xg5_055_fire_upper_exile";
XG5_KEYWORDS["XG5-055::fire_upper"] = (state, ctx) => {
  const ids = state.players[ctx.playerId].hand.map((c) => c.instanceId);
  if (ids.length < 2) return { state, detail: "xg5_055:hand_under_2" };
  return { state: openAfter(state, { ...multiChoice(ctxBase(ctx), "XG5-055", FIRE_UPPER, ids, 2), mayConfirm: false }), detail: FIRE_UPPER };
};
registerMulti(FIRE_UPPER, (state, pending, ids) => {
  const costs = ids.map((id) => {
    const c = state.players[pending.playerId].hand.find((x) => x.instanceId === id);
    return c ? printedCostNumber(state, c.cardId) : Number.NaN;
  });
  const both = [...costs].sort((a, b) => a - b).join(",") === "3,6";
  const enemyId = opp(pending.playerId);
  const holdIds = fieldUnits(state, enemyId).filter((c) => !c.commandHeld && isSUnit(state, c) && selectableEnemy(state, pending.playerId, "XG5-055", c)).map((c) => c.instanceId);
  const ctx = pendingBase(pending);
  if (holdIds.length > 0) return openAfter(state, { ...selectOne(ctx, "XG5-055", FIRE_UPPER_HOLD, holdIds, false), xg5Meta: { n: both ? 1 : 0 } });
  return both ? openExile(state, ctx.playerId, ctx.phasePlayerId) : state;
});
function openExile(state: GameState, playerId: PlayerId, phasePlayerId: PlayerId): GameState {
  const ids = state.players[opp(playerId)].discard.filter((c) => isSUnit(state, c)).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openAfter(state, selectOne({ playerId, phasePlayerId }, "XG5-055", FIRE_UPPER_EXILE, ids, false));
}
CHOICE_RESOLVERS[FIRE_UPPER_HOLD] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = setFieldHeld(close(state, pending), opp(playerId), instanceId, true);
  if (pending.xg5Meta?.n === 1) next = openExile(next, playerId, pending.phasePlayerId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-055", `${FIRE_UPPER_HOLD}:${instanceId}`) };
};
CHOICE_RESOLVERS[FIRE_UPPER_EXILE] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveToExile(close(state, pending), opp(playerId), "discard", instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-055", `${FIRE_UPPER_EXILE}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-056 仮面ライダーギャレンJF【捨て身の一撃】
// 「これが敵軍Sユニットにアタックされたとき、このユニットをホールドするか撃破してもよい。そうしたとき、アタックしてきた敵軍Sユニットを撃破する。
//  （このとき、バトルは行われない）」（atwiki/page-2174）。「アタックされたとき」（core/applyAction.ts の ATTACKED_HOOKS）に「ホールドする／撃破する」を選ぶ。
// 選べばアタックの続き（deferredAttack）を取り消し、アタックしてきたユニットを撃破する。見送ればアタックを続ける。ホールドはリリース状態のときだけ選べる。

const SUTEMI = "xg5_056_sutemi";
ATTACKED_HOOKS.push((state, battle, wingAttackFromRush) => {
  if (battle.effectBattle || battle.battleCancelled) return null;
  const defenderId = battle.defenderPlayerId;
  const self = findField(state, defenderId, battle.defenderInstanceId);
  if (!self || !isSameCardIdentity(self.cardId, "XG5-056")) return null;
  const attacker = findField(state, battle.attackerPlayerId, battle.attackerInstanceId);
  if (!attacker || !isSUnit(state, attacker)) return null;
  const key = `${battle.attackerInstanceId}>${battle.defenderInstanceId}`;
  if (xg5Flags(state, "xg5-056-asked").some((f) => f.target === key)) return null;
  const ids = self.commandHeld ? ["destroy"] : ["hold", "destroy"];
  const marked = addFlag(state, { kind: "xg5-056-asked", playerId: defenderId, turn: state.turn, target: key });
  return {
    ...openAfter(
      { ...marked, deferredAttack: { battle, wingAttackFromRush } },
      { ...selectOne({ playerId: defenderId, phasePlayerId: battle.phasePlayerId, sourceInstanceId: self.instanceId }, "XG5-056", SUTEMI, ids, true), xg5Meta: { target: battle.attackerInstanceId, owner: battle.attackerPlayerId } },
    ),
    activePlayer: defenderId,
  };
});
// 尋ねた印は、アタックの続きを処理し終えたら消す（同じユニットの次のアタックでまた尋ねる）。
AFTER_ACTION_HOOKS.push((_before, after) => {
  if (after.deferredAttack || !xg5Flags(after, "xg5-056-asked").length || after.pendingEffectChoice?.effectId === SUTEMI) return after;
  return patchXg5(after, (x) => ({ ...x, flags: (x.flags ?? []).filter((f) => f.kind !== "xg5-056-asked") }));
});
CHOICE_RESOLVERS[SUTEMI] = (state, playerId, choice) => {
  const pending = state.pendingEffectChoice!;
  let next: GameState = { ...close(state, pending), deferredAttack: undefined };
  const self = pending.sourceInstanceId!;
  if (choice === "hold") next = setFieldHeld(next, playerId, self, true);
  else {
    const left = applyUnitLeave(next, self, "discard", pending.phasePlayerId);
    if (!("error" in left)) next = left.state;
  }
  const attackerId = pending.xg5Meta?.target;
  if (attackerId && findField(next, pending.xg5Meta?.owner ?? opp(playerId), attackerId)) {
    const left = applyUnitLeave(next, attackerId, "discard", pending.phasePlayerId);
    if (!("error" in left)) next = left.state;
  }
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-056", `${SUTEMI}:${choice}`) };
};
CHOICE_SKIPPERS[SUTEMI] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-057 レッドランバス【ファイアランバス】（ビークル）
// 「これにライドしたユニットがある間、自分の手札からカードが1枚捨札に置かれるたび、次の効果を発動できる⇒捨札に置かれたカードの必要パワーの数字と同じ必要パワーの
//  数字を持つ敵軍捨札を1枚選びゲームから除外する。」（atwiki/page-2208）。後処理で、手札から捨札に移ったカードごとに選ぶ（見送れば発動しない）。
// 使ったオペレーションも含む（grnrngr/faq-rider-2 RK-129 と同じ書き方）。カードの種類を問わない。必要パワーの数字は印刷された数字。

const FIRE_LAMBUS = "xg5_057_fire_lambus";
AFTER_ACTION_HOOKS.push((before, after) => {
  let next = after;
  for (const pid of PLAYERS) {
    const field = fieldCards(after, pid);
    const ridden = field.filter((v) => isSameCardIdentity(v.cardId, "XG5-057") && field.some((c) => c.mountedOnInstanceId === v.instanceId));
    if (ridden.length === 0) continue;
    const hadInHand = new Set(before.players[pid].hand.map((c) => c.instanceId));
    const hadInDiscard = new Set(before.players[pid].discard.map((c) => c.instanceId));
    const moved = after.players[pid].discard.filter((c) => hadInHand.has(c.instanceId) && !hadInDiscard.has(c.instanceId));
    for (const card of moved) {
      const n = printedCostNumber(after, card.cardId);
      if (!Number.isFinite(n)) continue;
      const ids = after.players[opp(pid)].discard.filter((c) => printedCostNumber(after, c.cardId) === n).map((c) => c.instanceId);
      if (ids.length === 0) continue;
      for (const v of ridden) next = openAfter(next, selectOne({ playerId: pid, phasePlayerId: xg5TurnPlayer(after), sourceInstanceId: v.instanceId }, "XG5-057", FIRE_LAMBUS, ids, true));
    }
  }
  return next;
});
CHOICE_RESOLVERS[FIRE_LAMBUS] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  if (next.players[opp(playerId)].discard.some((c) => c.instanceId === instanceId)) next = moveToExile(next, opp(playerId), "discard", instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-057", `${FIRE_LAMBUS}:${instanceId}`) };
};
CHOICE_SKIPPERS[FIRE_LAMBUS] = simpleSkip();

// ---------------------------------------------------------------------------
// XG5-058 ロイヤルストレートフラッシュ（オペレーション）
// 「自軍山札の上から5枚をオモテにする。そうしたとき、オモテにしたユニットカードのBPの合計以下のBPを持つ敵軍ユニットを1体選び、ゲームから除外する（…）。
//  その後、オモテにしたカードはすべて捨札になる。」（atwiki/page-2262）。BP の合計は本来の BP、敵軍ユニットはいまの BP（エリアを問わない）。
// オモテにしたカードは選ぶ間も山札の上に置いたまま（xg5Meta.ids）。

const ROYAL = "xg5_058_royal_straight_flash";
function discardRevealed(state: GameState, playerId: PlayerId, ids: string[]): GameState {
  const set = new Set(ids);
  return patchPlayer(state, playerId, (p) => ({ ...p, deck: p.deck.filter((c) => !set.has(c.instanceId)), discard: [...p.discard, ...p.deck.filter((c) => set.has(c.instanceId)).map(stripForZone)] }));
}
XG5_KEYWORDS["XG5-058::royal_straight_flash"] = (state, ctx) => {
  const pid = ctx.playerId;
  const top = state.players[pid].deck.slice(0, 5);
  if (top.length === 0) return { state, detail: "xg5_058:empty_deck" };
  const sum = top.filter((c) => isUnit(state, c)).reduce((n, c) => n + (Number.isFinite(printedBp(state, c.cardId)) ? printedBp(state, c.cardId) : 0), 0);
  const enemyId = opp(pid);
  const ids = fieldUnits(state, enemyId).filter((c) => effectiveBp(state, enemyId, c) <= sum && selectableEnemy(state, pid, "XG5-058", c)).map((c) => c.instanceId);
  const revealed = top.map((c) => c.instanceId);
  if (ids.length === 0) return { state: discardRevealed(state, pid, revealed), detail: "xg5_058:no_targets" };
  return { state: openAfter(state, { ...selectOne(ctxBase(ctx), "XG5-058", ROYAL, ids, false), xg5Meta: { ids: revealed } }), detail: ROYAL };
};
CHOICE_RESOLVERS[ROYAL] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opp(playerId);
  let next = close(state, pending);
  const zone = zoneOfField(next, enemyId, instanceId);
  if (zone) next = moveToExile(next, enemyId, zone, instanceId);
  next = discardRevealed(next, playerId, pending.xg5Meta?.ids ?? []);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG5-058", `${ROYAL}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG5-060 仮面ライダーワイルドカリス【ワイルド】
// 「これは、自軍の手札が1枚のとき次の能力を得る⇒自軍ターン中、これがバトルエリアに出たとき、相手に1点ダメージを与える。」（atwiki/page-2171）。
// 手札がちょうど1枚のときだけ（「1枚以下」ではない）。

XG5_KEYWORDS["XG5-060::wild"] = (state, ctx) => {
  if (xg5TurnPlayer(state) !== ctx.playerId || state.players[ctx.playerId].hand.length !== 1) return { state, detail: "xg5_060:no_effect" };
  const next = applyDamageToPlayer(state, opp(ctx.playerId), 1, { kind: "none", activePlayer: ctx.phasePlayerId });
  return { state: next, detail: "xg5_060:damage" };
};

// ---------------------------------------------------------------------------
// 継続効果・ほかの処理の場所から発動する効果（DSL からは何もしない）。
XG5_KEYWORDS["XG5-042::tenso_gattai"] = noop("xg5_042:tenso_gattai");
XG5_KEYWORDS["XG5-046::master_head"] = noop("xg5_046:master_head");
XG5_KEYWORDS["XG5-050::kataru_senaka"] = noop("xg5_050:kataru_senaka");
XG5_KEYWORDS["XG5-051::kabuto_sp"] = noop("xg5_051:kabuto_sp");
XG5_KEYWORDS["XG5-052::oretachi"] = noop("xg5_052:oretachi");
XG5_KEYWORDS["XG5-054::rider_zukan"] = noop("xg5_054:rider_zukan");
XG5_KEYWORDS["XG5-056::sutemi"] = noop("xg5_056:sutemi");
XG5_KEYWORDS["XG5-057::fire_lambus"] = noop("xg5_057:fire_lambus");
XG5_KEYWORDS["XG5-059::bousou"] = noop("xg5_059:bousou");
