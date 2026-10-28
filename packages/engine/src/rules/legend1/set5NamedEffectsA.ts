/**
 * 第5弾「五龍の逆鱗」（legend1）RS-243〜RS-305 のカード固有の名前付き効果。
 *
 * - `trySet5ACardEffect`: DSL の grant_keyword（`cardId::effectId`）から呼ばれる起点。
 * - `tryResolveSet5AChoice` / `trySkipSet5AChoice` / `tryConfirmSet5AChoice`: このモジュールが開いた選択の解決。
 * - 継続効果・制限の参照関数（BP/SP 補正、バトル進入・アタック・支払いの制限）。
 * 型・構成は rules/legend1/set4NamedEffects.ts と同じ。
 */
import { filthyAirActive } from "./otherLinesNamedEffects";
import { shuffleCards as shuffleDeckCards } from "../../core/deckShuffle";
import type { Category, CardDefinition } from "@rangers-strike/cards";
import { cardHasCategory } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave, PlayerId, PlayerState } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import {
  cardCategories,
  cardName,
  effectiveBp,
  effectiveCommandCategories,
  getDefinition,
  parsePowerCost,
  unitEffectiveCategories,
} from "../../core/catalog";
import { findInZone, opponent, updatePlayer } from "../../core/helpers";
import { addTurnRuleModifier, hasTurnRuleModifier } from "../../core/scopedModifiers";
import { buildLogEntry } from "../../log/formatLog";
import { hasBattleNcEffect } from "../namedUnitEffects";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyUnitLeave, openEffectChoice, type ChoiceOutcome } from "../pendingChoices";
import { sendFieldCardsToCommandOrDiscard } from "../fieldLeaveQueue";
import { findCardInField } from "../fieldLookup";
import { startEffectRush } from "../effectRush";
import { finalizeLeaveReaction, tryLeaveField } from "../operationCounters";
import { openOptionalEffectConfirm, registerOptionalEffect } from "../optionalEffects";
import { deckOrderChoice } from "../deckOrder";
import { gateReveal } from "../revealGate";

// ---------------------------------------------------------------------------
// 共通

/** RS-265【ラウンドレーダー】の選択。 */
export const ROUND_RADAR_EFFECT_ID = "round_radar_discard_power";
/** RS-256 闇の戒律: スタートフェイズに捨札から重ねるカードの選択。 */
export const DARK_LAW_STACK_EFFECT_ID = "dark_law_stack";
/** RS-303【シティガーディアンズ隊長】: かわりに捨札にする「戦闘員」の選択。 */
export const CITY_GUARDIANS_EFFECT_ID = "city_guardians_substitute";

function clearPending(state: GameState, phasePlayerId: PlayerId): GameState {
  return { ...state, pendingEffectChoice: undefined, activePlayer: phasePlayerId };
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

/** 選択を閉じる。割り込まれていた選択（resumeChoice）があれば再開し、無ければ保留中のバトル進入を続ける。 */
function finish(state: GameState, phasePlayerId: PlayerId, before?: GameState): GameState {
  const resume = (before ?? state).pendingEffectChoice?.resumeChoice;
  const cleared = clearPending(state, phasePlayerId);
  if (resume) {
    const prev = before ?? state;
    const valid = resume.validInstanceIds.filter((id) => {
      const was = findCardInField(prev, id);
      const now = findCardInField(cleared, id);
      return !!was && !!now && was.playerId === now.playerId && was.zone === now.zone;
    });
    if (valid.length > 0) return openEffectChoice(cleared, { ...resume, validInstanceIds: valid });
  }
  return promoteDeferredBattleEntry(cleared);
}

/** 選択を開いたオペレーションは、選択を開いた時点で捨札に置く（set4NamedEffects と同じ）。 */
function discardUsedOperation(state: GameState, ctx: GrantKeywordContext): GameState {
  if (!ctx.operationInstanceId) return state;
  const player = state.players[ctx.playerId];
  if (player.discard.some((c) => c.instanceId === ctx.operationInstanceId)) return state;
  const card: CardInstance = { instanceId: ctx.operationInstanceId, cardId: ctx.sourceCardId };
  return { ...state, ...updatePlayer(state, ctx.playerId, { ...player, discard: [...player.discard, card] }) };
}

function defOf(state: Pick<GameState, "definitions">, cardId: string): CardDefinition | undefined {
  return getDefinition(state.definitions, cardId);
}

function hasFeature(state: Pick<GameState, "definitions">, cardId: string, feature: string): boolean {
  return defOf(state, cardId)?.features?.includes(feature) ?? false;
}

function fieldUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function shuffled<T>(cards: T[]): T[] {
  return shuffleDeckCards(cards);
}

function patchPlayer(state: GameState, playerId: PlayerId, patch: (p: PlayerState) => PlayerState): GameState {
  return { ...state, ...updatePlayer(state, playerId, patch(state.players[playerId])) };
}

/** 敵軍パワーゾーンからカードを捨札にする（ダメージならダメージも減る）。 */
function discardFromPower(state: GameState, ownerId: PlayerId, instanceIds: string[]): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const moved = p.power.filter((c) => instanceIds.includes(c.instanceId));
    const faceDown = moved.filter((c) => c.faceDown).length;
    return {
      ...p,
      power: p.power.filter((c) => !instanceIds.includes(c.instanceId)),
      discard: [...p.discard, ...moved.map(({ faceDown: _fd, ...c }) => c)],
      damage: Math.max(0, p.damage - faceDown),
    };
  });
}

/** 山札・手札などからパワーゾーンにダメージ（ウラ向き）として置く。 */
function withDamageCard(p: PlayerState, card: CardInstance): PlayerState {
  const { commandHeld: _h, ...clean } = card;
  return { ...p, power: [...p.power, { ...clean, faceDown: true }], damage: p.damage + 1 };
}

// ---------------------------------------------------------------------------
// RS-243 獣奏剣
// 「このターン、すべての自軍ユニットは、「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と
//  書かれていても、そのテキストは無効になる。」

const BEAST_SWORD_RULE = "rs243_beast_sword_ignore_entry_hold";

/** RS-243: このターン、自軍ユニットの「1つホールドしなければ出られない」が無効か。 */
export function beastSwordIgnoresEntryHold(state: Pick<GameState, "players">, playerId: PlayerId): boolean {
  return hasTurnRuleModifier(state.players[playerId], BEAST_SWORD_RULE);
}

// ---------------------------------------------------------------------------
// RS-290 気伝武人龍星王【飛竜棍・大風車】
// 「これが自軍バトルエリアにある間、「DA」の敵軍Sユニットはバトルエリアに出られない。」
// カテゴリを含むもの（マルチカテゴリ・闇のヤイバで追加された DA）も対象（faq-card-5 RS-290 Q1）。

export function set5ABlocksBattleEntry(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  const enemy = state.players[opponent(playerId)];
  if (!enemy.battle.some((c) => c.cardId === "RS-290")) return false;
  const def = defOf(state, unit.cardId);
  if (!def || def.type !== "unit" || def.size !== "S") return false;
  const zone = state.players[playerId].battle.some((c) => c.instanceId === unit.instanceId) ? "battle" : "rush";
  return unitEffectiveCategories(state, playerId, unit, zone).includes("DA");
}

// ---------------------------------------------------------------------------
// RS-297 タコンパス【変形】
// 「自軍コマンドがすべてリリース状態なら、これは特徴「航空機」を持たないユニットにアタックされない。」

export function set5ADefenderBlocksAttack(
  state: GameState,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const defender = state.players[defenderPlayerId];
  const target = [...defender.battle, ...defender.rush].find((c) => c.instanceId === defenderInstanceId);
  if (!target || target.cardId !== "RS-297") return false;
  if (defender.command.some((c) => c.commandHeld)) return false;
  return !hasFeature(state, attacker.cardId, "航空機");
}

// ---------------------------------------------------------------------------
// RS-292 気伝武人ウォンタイガー【虎の子大秘術】
// 「これが自軍ラッシュエリアにある間、自分が手札からオペレーションカードを使用するためにホールドするコマンドは、
//  使用するカードと同じカテゴリのコマンドでなくてもよい。」

/**
 * 手札のオペレーションを使用するためのホールドで、カテゴリの一致を問わないときは、自軍コマンドゾーンにある
 * すべてのカテゴリを「使用するカードのカテゴリ」として扱う（どのコマンドでも支払える）。
 */
export function operationPaymentCategories(
  state: GameState,
  playerId: PlayerId,
  definition: CardDefinition,
): Category[] {
  const categories = cardCategories(definition);
  if (definition.type !== "operation" || categories.length === 0) return categories;
  const player = state.players[playerId];
  if (!player.rush.some((c) => c.cardId === "RS-292")) return categories;
  const present = new Set<Category>();
  for (const cmd of player.command) {
    for (const cat of effectiveCommandCategories(player, state.definitions, cmd.cardId)) present.add(cat);
  }
  return present.size > 0 ? [...present] : categories;
}

// ---------------------------------------------------------------------------
// BP・SP の継続効果
// RS-303 タイムファイヤー【シティガーディアンズ隊長】: 自軍バトルエリアの「戦闘員」1体につき BP+1000、BP5000 以上で「SP1」。
// RS-255 巨大化爆弾: 重ねたユニットは BP+3000 され、「SP1」「Lユニット」になる。

export const GIANT_BOMB_CARD_ID = "RS-255";

export function hasGiantBomb(instance: CardInstance): boolean {
  return (instance.stackedCards ?? []).some((c) => c.cardId === GIANT_BOMB_CARD_ID);
}

export function set5AFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  if (instance.cardId === "RS-303") {
    const n = state.players[playerId].battle.filter(
      (c) => c.instanceId !== instance.instanceId && hasFeature(state, c.cardId, "戦闘員"),
    ).length;
    bonus += 1000 * n;
  }
  if (hasGiantBomb(instance)) bonus += 3000;
  return bonus;
}

/** SP の下限・置き換え（legend3EffectiveSp から呼ぶ）。 */
export function set5AEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (hasGiantBomb(instance)) return 1;
  if (instance.cardId === "RS-303" && effectiveBp(state, playerId, instance) >= 5000) return Math.max(sp, 1);
  return sp;
}


// ---------------------------------------------------------------------------
// RS-273〜RS-276 ファイブマン（NC）
// 「これがアタックしなかったとき、このユニットの次にコンビネーションするSユニットのBPは、このユニットのBPを「＋」した値になる。」
// 自軍ターンが終わるまで有効（faq-card-5 RS-273 Q1）。バトルダンスで入れ替わった S ユニットも対象（Q2）。

const FIVE_NC: Record<string, string> = {
  "RS-273": "tsuinarei",
  "RS-274": "pawakata",
  "RS-275": "kyuteisakuru",
  "RS-276": "merodeitakuto",
};

export function applyFivemanOnCombo(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
): GameState {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  const left = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!left) return state;
  const nc = FIVE_NC[left.cardId];
  if (!nc || !hasBattleNcEffect(left, nc)) return state;
  const player = state.players[playerId];
  if (player.unitActionsThisTurn?.[left.instanceId]?.attacked) return state;
  const def = defOf(state, card.cardId);
  if (def?.type !== "unit" || def.size !== "S") return state;
  const bonus = effectiveBp(state, playerId, left);
  const battle = player.battle.map((c) =>
    c.instanceId === card.instanceId ? { ...c, bpModifier: (c.bpModifier ?? 0) + bonus } : c,
  );
  const next = { ...state, ...updatePlayer(state, playerId, { ...player, battle }) };
  return { ...next, log: [...next.log, buildLogEntry(playerId, "named_effect", left.cardId, state.definitions, nc)] };
}

// ---------------------------------------------------------------------------
// RS-249 Vコマンダー / RS-251 ブン・ターの特訓（山札から効果ラッシュ。その後、山札をシャッフルする）
// RS-249「特徴「恐竜」を持つユニットカードを1枚選び…追加条件は満たすこと（必要パワーは満たさなくてもよい）」
// RS-251「必要パワーの数字に「－」のあるユニットカードを1枚選び…必要パワーと追加条件は満たすこと」
// 山札の並びは非公開なので、候補を決めてから山札をシャッフルする（出す1枚は instanceId で特定する）。

export const V_COMMANDER_EFFECT_ID = "v_commander_deck_rush";
export const BUNTA_EFFECT_ID = "bunta_deck_rush";

function beginDeckRush(
  state: GameState,
  ctx: GrantKeywordContext,
  effectId: string,
  filter: (def: CardDefinition) => boolean,
  ignorePowerCost: boolean,
): GameState {
  const player = state.players[ctx.playerId];
  const candidates = player.deck
    .filter((c) => {
      const def = defOf(state, c.cardId);
      return !!def && def.type === "unit" && filter(def);
    })
    .map((c) => c.instanceId);
  const shuffledState = patchPlayer(state, ctx.playerId, (p) => ({ ...p, deck: shuffled(p.deck) }));
  if (candidates.length === 0) return shuffledState;
  const next = startEffectRush(shuffledState, {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.operationInstanceId,
    fromZone: "deck",
    candidates,
    maxCount: 1,
    requireConditions: true,
    ignorePowerCost,
    alwaysAsk: true,
  });
  return next.pendingEffectChoice ? discardUsedOperation(next, ctx) : next;
}

// ---------------------------------------------------------------------------
// RS-257 野球仮面【予告ホームラン】（NC）
// 「敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードと同じ必要パワーの数字を持つ自軍コマンドを
//  1つホールドできれば、そのカードを持ち主のパワーゾーンにダメージにして置く。できなければ、そのカードを持ち主の手札に加える。」
// ホールドできてもしなくてよい（faq-card-5 RS-257 Q1）。比べるのは必要パワーどうし（Q2）。

export const HOMERUN_REVEAL_EFFECT_ID = "homerun_reveal";
export const HOMERUN_HOLD_EFFECT_ID = "homerun_hold";

function beginHomerun(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const top = state.players[opponent(ctx.playerId)].deck[0];
  if (!top) return null;
  // オモテにするかを先に聞く（rules/revealGate.ts）。
  return openEffectChoice(state, gateReveal({
    playerId: ctx.playerId,
    effectId: HOMERUN_REVEAL_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "scry_keep_one",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: [top.instanceId],
    viewedInstanceIds: [top.instanceId],
    selectCount: 1,
    optional: true,
  }));
}

function moveEnemyDeckCard(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
  to: "hand" | "damage" | "discard",
): GameState {
  return patchPlayer(state, ownerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const deck = p.deck.filter((c) => c.instanceId !== instanceId);
    if (to === "hand") return { ...p, deck, hand: [...p.hand, card] };
    if (to === "discard") return { ...p, deck, discard: [...p.discard, card] };
    return withDamageCard({ ...p, deck }, card);
  });
}

function resolveHomerunReveal(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const top = state.players[enemyId].deck.find((c) => c.instanceId === instanceId);
  if (!top) return { error: "invalid_target" };
  const cost = parsePowerCost(defOf(state, top.cardId)?.powerCost);
  const matching = state.players[playerId].command
    .filter((c) => !c.commandHeld && parsePowerCost(defOf(state, c.cardId)?.powerCost) === cost)
    .map((c) => c.instanceId);
  const log = logFor(state, playerId, "RS-257", `${HOMERUN_REVEAL_EFFECT_ID}:${cardName(state.definitions, top.cardId)}`);
  if (matching.length === 0) {
    const next = moveEnemyDeckCard(state, enemyId, instanceId, "hand");
    return { state: finish(next, pending.phasePlayerId, state), log };
  }
  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        effectId: HOMERUN_HOLD_EFFECT_ID,
        kind: "select_command",
        validInstanceIds: matching,
        viewedInstanceIds: [instanceId],
        selectedInstanceIds: [],
        optional: true,
      },
    },
    log,
  };
}

function resolveHomerunHold(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const topId = pending.viewedInstanceIds?.[0];
  if (!topId) return { error: "invalid_target" };
  let next = patchPlayer(state, playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
  }));
  next = moveEnemyDeckCard(next, opponent(playerId), topId, "damage");
  return { state: finish(next, pending.phasePlayerId, state), log: logFor(state, playerId, "RS-257", `${HOMERUN_HOLD_EFFECT_ID}:damage`) };
}

/** ホールドしない（できない）: オモテにしたカードは持ち主の手札に加える。 */
function skipHomerunHold(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const topId = pending.viewedInstanceIds?.[0];
  const next = topId ? moveEnemyDeckCard(state, opponent(playerId), topId, "hand") : state;
  return { state: finish(next, pending.phasePlayerId, state), log: logFor(state, playerId, "RS-257", `${HOMERUN_HOLD_EFFECT_ID}:hand`) };
}

// ---------------------------------------------------------------------------
// RS-262 フラッシュキング【スーパーコズモフラッシュ】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンにあるダメージ以外のカードから、「OT」以外のカードを2枚選び
//  捨札にしてもよい。そうしたとき、このターン、これは「SP2」になる。」OT を含むマルチカテゴリは選べない（atwiki/page-452 Q1）。

export const COSMO_FLASH_EFFECT_ID = "super_cosmo_flash";

function cosmoFlashCandidates(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power
    .filter((c) => {
      if (c.faceDown) return false;
      const def = defOf(state, c.cardId);
      return !!def && !cardHasCategory(def, "OT");
    })
    .map((c) => c.instanceId);
}

function beginCosmoFlash(state: GameState, ctx: GrantKeywordContext): GameState | null {
  if (state.activePlayer !== ctx.playerId || !ctx.triggerSourceInstanceId) return null;
  const ids = cosmoFlashCandidates(state, ctx.playerId);
  if (ids.length < 2) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: COSMO_FLASH_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_power",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 2,
    selectedInstanceIds: [],
    optional: true,
  });
}

function resolveCosmoFlash(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 2) {
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          selectedInstanceIds: selected,
          validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId),
        },
      },
    };
  }
  let next = discardFromPower(state, playerId, selected);
  const sourceId = pending.sourceInstanceId;
  next = patchPlayer(next, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === sourceId ? { ...c, spOverride: 2 } : c)),
  }));
  return { state: finish(next, pending.phasePlayerId, state), log: logFor(state, playerId, "RS-262", `${COSMO_FLASH_EFFECT_ID}:sp2`) };
}

// ---------------------------------------------------------------------------
// RS-291 気伝獣龍星王【大火炎】
// 「これが特徴「レッド」を持つユニットからコンビネーションするとき、敵軍バトルエリアから特徴「メカ」を持たないBP5000以下の
//  ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。」（CN を持たないので位置ではなく左隣で判定する）

export const DAIKAEN_EFFECT_ID = "daikaen_enemy_to_damage";

function daikaenTargets(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => !hasFeature(state, c.cardId, "メカ") && effectiveBp(state, enemyId, c) <= 5000)
    .map((c) => c.instanceId);
}

/** バトルエリアに出たとき（DSL の enter_battle の直後）に呼ぶ。コンビネーションで発動する効果。 */
export function trySet5AOnComboEnter(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battleBeforeEnter: CardInstance[],
): GameState {
  if (state.pendingEffectChoice || state.phase !== "battle" || state.activePlayer !== playerId) return state;
  if (card.cardId !== "RS-291") return state;
  const left = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!left || !hasFeature(state, left.cardId, "レッド")) return state;
  const ids = daikaenTargets(state, playerId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: DAIKAEN_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_unit",
    unitDestination: "power",
    phasePlayerId: playerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

function placeEnemyUnitAsDamage(state: GameState, enemyId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, enemyId, (p) => {
    const card = [...p.battle, ...p.rush].find((c) => c.instanceId === instanceId);
    if (!card) return p;
    const base: CardInstance = { instanceId: card.instanceId, cardId: card.cardId };
    return withDamageCard(
      {
        ...p,
        battle: p.battle.filter((c) => c.instanceId !== instanceId),
        rush: p.rush.filter((c) => c.instanceId !== instanceId),
        discard: [...p.discard, ...(card.stackedCards ?? []).map(({ faceDown: _f, ...c }) => c)],
      },
      base,
    );
  });
}

function resolveDaikaen(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].battle.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  const next = placeEnemyUnitAsDamage(state, enemyId, instanceId);
  return { state: finish(next, pending.phasePlayerId, state), log: logFor(state, playerId, "RS-291", `${DAIKAEN_EFFECT_ID}:${cardName(state.definitions, card.cardId)}`) };
}

// ---------------------------------------------------------------------------
// RS-293 気伝獣ウォンタイガー【吼新星・大咆哮】
// 「自軍ターン中、これがバトルエリアに出たとき、敵軍山札の上から3枚をオモテにしてもよい。そうしたとき、オモテにしたカードの
//  中から「DA」のカードをすべて捨札にし、それ以外を山札の上に好きな順で戻す。」（DA はマルチカテゴリを含む）

export const ROAR_CONFIRM_EFFECT_ID = "daihoukou_reveal";

registerOptionalEffect(ROAR_CONFIRM_EFFECT_ID, {
  apply: (state, pending) => {
    const enemyId = opponent(pending.playerId);
    const revealed = state.players[enemyId].deck.slice(0, 3);
    if (revealed.length === 0) return promoteDeferredBattleEntry(state);
    const da = revealed.filter((c) => {
      const def = defOf(state, c.cardId);
      return !!def && cardHasCategory(def, "DA");
    });
    const rest = revealed.filter((c) => !da.includes(c));
    let next = patchPlayer(state, enemyId, (p) => ({
      ...p,
      deck: [...rest, ...p.deck.slice(revealed.length)],
      discard: [...p.discard, ...da],
    }));
    next = {
      ...next,
      log: [
        ...next.log,
        buildLogEntry(pending.playerId, "named_effect", "RS-293", state.definitions, `daihoukou:${revealed.map((c) => cardName(state.definitions, c.cardId)).join(",")}`),
      ],
    };
    if (rest.length < 2) return promoteDeferredBattleEntry(next);
    // 残りを山札の上に好きな順で戻す: 番号を付けて順を選ぶ（rules/deckOrder.ts。1番が一番上）。
    const order = deckOrderChoice(
      next,
      { playerId: pending.playerId, phasePlayerId: pending.phasePlayerId, sourceCardId: "RS-293", sourceInstanceId: pending.sourceInstanceId },
      rest.map((c) => c.instanceId),
      "top",
    );
    return order ? openEffectChoice(next, order) : promoteDeferredBattleEntry(next);
  },
});

// ---------------------------------------------------------------------------
// RS-294 キバレンジャー【吼新星・乱れ山彦】（NC）
// 「敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、相手はオモテにしたカードを手札に加えるか、自分自身のパワーゾーンに
//  ダメージにして置くかを選ぶ。相手が手札に加えることを選んだとき、敵軍Sユニットがあれば1体選び撃破する。」
// 相手の選択: オモテにしたカードを選ぶ＝手札に加える、見送る＝ダメージにして置く。

export const ECHO_CONFIRM_EFFECT_ID = "midare_yamabiko_reveal";
export const ECHO_OPPONENT_EFFECT_ID = "midare_yamabiko_opponent";
export const ECHO_DESTROY_EFFECT_ID = "midare_yamabiko_destroy";

registerOptionalEffect(ECHO_CONFIRM_EFFECT_ID, {
  apply: (state, pending) => {
    const enemyId = opponent(pending.playerId);
    const top = state.players[enemyId].deck[0];
    if (!top) return promoteDeferredBattleEntry(state);
    return openEffectChoice(state, {
      playerId: enemyId,
      effectId: ECHO_OPPONENT_EFFECT_ID,
      sourceCardId: "RS-294",
      sourceInstanceId: pending.sourceInstanceId,
      kind: "scry_keep_one",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: [top.instanceId],
      viewedInstanceIds: [top.instanceId],
      selectCount: 1,
      optional: true,
    });
  },
});

function echoDestroyTargets(state: GameState, ownerId: PlayerId): string[] {
  return fieldUnits(state, opponent(ownerId))
    .filter((c) => defOf(state, c.cardId)?.size === "S")
    .map((c) => c.instanceId);
}

function resolveEchoOpponent(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = moveEnemyDeckCard(state, playerId, instanceId, "hand");
  const ownerId = opponent(playerId);
  const ids = echoDestroyTargets(next, ownerId);
  const log = logFor(state, playerId, "RS-294", `${ECHO_OPPONENT_EFFECT_ID}:hand`);
  if (ids.length === 0) return { state: finish(next, pending.phasePlayerId, state), log };
  return {
    state: {
      ...next,
      pendingEffectChoice: {
        ...pending,
        playerId: ownerId,
        effectId: ECHO_DESTROY_EFFECT_ID,
        kind: "select_unit",
        validInstanceIds: ids,
        viewedInstanceIds: undefined,
        selectedInstanceIds: [],
        optional: false,
      },
      activePlayer: ownerId,
    },
    log,
  };
}

function skipEchoOpponent(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const topId = pending.validInstanceIds[0];
  const next = topId ? moveEnemyDeckCard(state, playerId, topId, "damage") : state;
  return { state: finish(next, pending.phasePlayerId, state), log: logFor(state, playerId, "RS-294", `${ECHO_OPPONENT_EFFECT_ID}:damage`) };
}

function destroyChosenUnit(state: GameState, pending: PendingEffectChoice, instanceId: string, cardId: string, detail: string): ChoiceOutcome {
  const cleared = clearPending(state, pending.phasePlayerId);
  const left = applyUnitLeave(cleared, instanceId, "discard", pending.phasePlayerId);
  if ("error" in left) return left;
  const next = left.state.pendingEffectChoice || left.state.pendingLeave ? left.state : finish(left.state, pending.phasePlayerId, state);
  return { state: next, log: logFor(state, pending.playerId, cardId, detail) };
}

function resolveEchoDestroy(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return destroyChosenUnit(state, pending, instanceId, "RS-294", ECHO_DESTROY_EFFECT_ID);
}

// ---------------------------------------------------------------------------
// RS-301 Vレックスロボ【リボルバーミサイル】
// 「これがバトルエリアに出たとき、敵軍ユニットを1体選び、敵軍パワーゾーンからカードを1枚選ぶ。そうしたとき、相手はどちらかを
//  選び捨札にする。」両方選べなければ発動しない（faq-card-5 RS-301 Q2）。ダメージも選べる（Q1）。

export const REVOLVER_UNIT_EFFECT_ID = "revolver_missile_unit";
export const REVOLVER_POWER_EFFECT_ID = "revolver_missile_power";
export const REVOLVER_OPPONENT_EFFECT_ID = "revolver_missile_opponent";

function beginRevolver(state: GameState, ctx: GrantKeywordContext): GameState | null {
  // XG1-034【汚い大気】: パワーゾーンからカードが離れる処理を含むため、バトルフェイズ中は発動できない（atwiki/page-1582 Q6）。
  if (filthyAirActive(state)) return null;
  const enemyId = opponent(ctx.playerId);
  const units = fieldUnits(state, enemyId).map((c) => c.instanceId);
  if (units.length === 0 || state.players[enemyId].power.length === 0) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: REVOLVER_UNIT_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: units,
    selectCount: 1,
    optional: false,
  });
}

function resolveRevolver(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  if (pending.effectId === REVOLVER_UNIT_EFFECT_ID) {
    const enemyId = opponent(playerId);
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          effectId: REVOLVER_POWER_EFFECT_ID,
          kind: "select_power",
          validInstanceIds: state.players[enemyId].power.map((c) => c.instanceId),
          selectedInstanceIds: [instanceId],
        },
      },
    };
  }
  if (pending.effectId === REVOLVER_POWER_EFFECT_ID) {
    const enemyId = opponent(playerId);
    const unitId = pending.selectedInstanceIds?.[0];
    if (!unitId) return { error: "invalid_target" };
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          playerId: enemyId,
          effectId: REVOLVER_OPPONENT_EFFECT_ID,
          kind: "select_unit",
          validInstanceIds: [unitId, instanceId],
          selectedInstanceIds: [],
        },
        activePlayer: enemyId,
      },
    };
  }
  // 相手がどちらかを選び捨札にする。
  const unitId = pending.validInstanceIds[0];
  if (instanceId === unitId) {
    const located = findCardInField(state, instanceId);
    return destroyChosenUnit(state, pending, instanceId, "RS-301", `${REVOLVER_OPPONENT_EFFECT_ID}:${cardName(state.definitions, located?.card.cardId ?? instanceId)}`);
  }
  const next = discardFromPower(state, playerId, [instanceId]);
  return { state: finish(next, pending.phasePlayerId, state), log: logFor(state, playerId, "RS-301", `${REVOLVER_OPPONENT_EFFECT_ID}:power`) };
}

// ---------------------------------------------------------------------------
// RS-282 イエローオウル【岩石落とし】（NC）
// 「BP2000以下の敵軍ユニットをすべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」
// 一部しか置けないとき、捨札にするユニットはターンプレイヤー（イエローオウルの持ち主）が選ぶ（faq-card-5 RS-282 Q1）。
// 「選ばれない」ユニットも対象（Q2）。判定は修正後の BP（Q3）。

export const ROCK_DROP_EFFECT_ID = "ganseki_otoshi_discard_pick";

/** 置くユニット・捨札にするユニットを、離場の処理を通して移す（チェイスの機会を出す。R-KW-CHASE-01・rules/fieldLeaveQueue.ts）。 */
function placeUnitsInCommand(state: GameState, ownerId: PlayerId, toCommand: string[], toDiscard: string[], phasePlayerId: PlayerId): GameState {
  return sendFieldCardsToCommandOrDiscard(state, ownerId, toCommand, toDiscard, phasePlayerId);
}

function beginRockDrop(state: GameState, ctx: GrantKeywordContext): GameState {
  const enemyId = opponent(ctx.playerId);
  const targets = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) <= 2000)
    .map((c) => c.instanceId);
  if (targets.length === 0) return state;
  const space = Math.max(0, COMMAND_ZONE_MAX - state.players[enemyId].command.length);
  if (targets.length <= space) return placeUnitsInCommand(state, enemyId, targets, [], ctx.phasePlayerId);
  if (space === 0) return placeUnitsInCommand(state, enemyId, [], targets, ctx.phasePlayerId);
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ROCK_DROP_EFFECT_ID,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    kind: "select_unit",
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: targets,
    viewedInstanceIds: targets,
    selectCount: targets.length - space,
    selectedInstanceIds: [],
    optional: false,
  });
}

function resolveRockDrop(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < (pending.selectCount ?? 1)) {
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId) },
      },
    };
  }
  const all = pending.viewedInstanceIds ?? [];
  const log = logFor(state, playerId, "RS-282", ROCK_DROP_EFFECT_ID);
  const next = placeUnitsInCommand(clearPending(state, pending.phasePlayerId), opponent(playerId), all.filter((id) => !selected.includes(id)), selected, pending.phasePlayerId);
  if (next.pendingEffectChoice || next.pendingChase || next.pendingLeave || next.pendingRegister) {
    // 離場の応答（チェイス等）・誘発の選択が開いた: 割り込まれていた選択はその解決後に開く。
    const resume = pending.resumeChoice;
    if (!resume) return { state: next, log };
    return { state: { ...next, deferredDestroyTriggers: [...(next.deferredDestroyTriggers ?? []), { kind: "open_choice", step: "after_discard", pending: resume }] }, log };
  }
  return { state: finish(next, pending.phasePlayerId, state), log };
}

// ---------------------------------------------------------------------------
// RS-271 マグ【修復作業】（起動。rules/fieldActivatedAbilities.ts）
// 「これが自軍ラッシュエリアにある間、自軍スタートフェイズ中、このユニットを捨札にしてもよい。そうしたとき、自軍パワーゾーンから
//  ダメージになっているカードを1枚選びオモテにする。」

export const MAG_REPAIR_EFFECT_ID = "mag_repair_faceup";

export function canActivateMagRepair(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId].power.some((c) => c.faceDown);
}

export function openMagRepair(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const ids = state.players[playerId].power.filter((c) => c.faceDown).map((c) => c.instanceId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: MAG_REPAIR_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    kind: "select_power",
    phasePlayerId: playerId,
    validInstanceIds: ids,
    selectCount: 1,
    optional: false,
  });
}

function resolveMagRepair(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const next = patchPlayer(state, playerId, (p) => ({
    ...p,
    power: p.power.map((c) => (c.instanceId === instanceId ? { ...c, faceDown: false } : c)),
    damage: Math.max(0, p.damage - 1),
  }));
  return { state: clearPending(next, pending.phasePlayerId), log: logFor(state, playerId, "RS-271", MAG_REPAIR_EFFECT_ID) };
}

// ---------------------------------------------------------------------------
// RS-299 VRVマスター【乗ってみないか？】
// 「これが自軍ラッシュエリアにある間、自分がSユニットをラッシュするたび、自軍山札の上から1枚をオモテにする。オモテにしたカードが
//  特徴「メカ」を持つMユニットのカードなら手札に加え、それ以外は山札の上に戻す。」

export function applyVrvMasterOnRush(state: GameState, playerId: PlayerId, rushedInstanceId: string): GameState {
  const player = state.players[playerId];
  const rushed = player.rush.find((c) => c.instanceId === rushedInstanceId);
  if (!rushed || defOf(state, rushed.cardId)?.size !== "S") return state;
  const masters = player.rush.filter((c) => c.cardId === "RS-299" && c.instanceId !== rushedInstanceId);
  let next = state;
  for (let i = 0; i < masters.length; i += 1) {
    const top = next.players[playerId].deck[0];
    if (!top) break;
    const def = defOf(next, top.cardId);
    const take = def?.type === "unit" && def.size === "M" && (def.features?.includes("メカ") ?? false);
    next = {
      ...next,
      log: [...next.log, buildLogEntry(playerId, "named_effect", "RS-299", next.definitions, `nottemiNaika:${cardName(next.definitions, top.cardId)}`)],
    };
    if (!take) break;
    next = patchPlayer(next, playerId, (p) => ({ ...p, deck: p.deck.slice(1), hand: [...p.hand, top] }));
  }
  return next;
}

// ---------------------------------------------------------------------------
// 登録

type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {
  [HOMERUN_REVEAL_EFFECT_ID]: resolveHomerunReveal,
  [HOMERUN_HOLD_EFFECT_ID]: resolveHomerunHold,
  [COSMO_FLASH_EFFECT_ID]: resolveCosmoFlash,
  [DAIKAEN_EFFECT_ID]: resolveDaikaen,
  [ECHO_OPPONENT_EFFECT_ID]: resolveEchoOpponent,
  [ECHO_DESTROY_EFFECT_ID]: resolveEchoDestroy,
  [REVOLVER_UNIT_EFFECT_ID]: resolveRevolver,
  [REVOLVER_POWER_EFFECT_ID]: resolveRevolver,
  [REVOLVER_OPPONENT_EFFECT_ID]: resolveRevolver,
  [ROCK_DROP_EFFECT_ID]: resolveRockDrop,
  [MAG_REPAIR_EFFECT_ID]: resolveMagRepair,
  [ROUND_RADAR_EFFECT_ID]: resolveRoundRadar,
  [DARK_LAW_STACK_EFFECT_ID]: resolveDarkLawStack,
  [CITY_GUARDIANS_EFFECT_ID]: resolveCityGuardians,
};

/** 「好きな数」選んで確定できる選択（confirm_effect_choice を出す）。 */
export function isSet5AConfirmableChoice(pending: PendingEffectChoice): boolean {
  return CONFIRMABLE_CHOICES.has(pending.effectId);
}

const CONFIRMABLE_CHOICES = new Set<string>([ROUND_RADAR_EFFECT_ID]);

export function isSet5AChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** 確定（confirm_effect_choice）。対象外なら null。 */
export function tryConfirmSet5AChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId || !CONFIRMABLE_CHOICES.has(pending.effectId)) return null;
  return finishRoundRadar(state, playerId);
}

/** このモジュールが開いた選択なら解決する。 */
export function tryResolveSet5AChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipSet5AChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId || !(pending.effectId in CHOICE_RESOLVERS)) return null;
  if (!pending.optional) return null;
  if (pending.effectId === HOMERUN_HOLD_EFFECT_ID) return skipHomerunHold(state, playerId);
  if (pending.effectId === ECHO_OPPONENT_EFFECT_ID) return skipEchoOpponent(state, playerId);
  if (pending.effectId === CITY_GUARDIANS_EFFECT_ID) return skipCityGuardians(state, playerId);
  if (pending.effectId === ROUND_RADAR_EFFECT_ID) return finishRoundRadar({ ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: [] } }, playerId);
  return {
    state: finish(state, pending.phasePlayerId),
    log: buildLogEntry(playerId, "skip_effect_choice", pending.sourceCardId, state.definitions, `${pending.effectId}:skipped`),
  };
}

function optionalConfirm(state: GameState, ctx: GrantKeywordContext, effectId: string): GameState {
  return openOptionalEffectConfirm(state, {
    playerId: ctx.playerId,
    effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
  });
}

/** DSL grant_keyword（`cardId::effectId`）からの起点。対象外なら null。 */
export function trySet5ACardEffect(state: GameState, ctx: GrantKeywordContext, _keyword: string): GrantKeywordResult | null {
  const id = `${ctx.sourceCardId}::${ctx.effectId}`;
  switch (id) {
    case "RS-243::ken_e78da3":
      return {
        state: patchPlayer(state, ctx.playerId, (p) => addTurnRuleModifier(p, BEAST_SWORD_RULE, { sourceCardId: "RS-243" })),
        detail: BEAST_SWORD_RULE,
      };
    case "RS-249::vkomanda":
      return {
        state: beginDeckRush(state, ctx, V_COMMANDER_EFFECT_ID, (def) => def.features?.includes("恐竜") ?? false, true),
        detail: V_COMMANDER_EFFECT_ID,
      };
    case "RS-251::buntano":
      return {
        state: beginDeckRush(state, ctx, BUNTA_EFFECT_ID, (def) => String(def.powerCost ?? "").includes("-"), false),
        detail: BUNTA_EFFECT_ID,
      };
    case "RS-257::homuran": {
      const next = beginHomerun(state, ctx);
      return next ? { state: next, detail: HOMERUN_REVEAL_EFFECT_ID } : { state, detail: `${HOMERUN_REVEAL_EFFECT_ID}:empty_deck` };
    }
    case "RS-262::supakozumofurashu": {
      const next = beginCosmoFlash(state, ctx);
      return next ? { state: next, detail: COSMO_FLASH_EFFECT_ID } : { state, detail: `${COSMO_FLASH_EFFECT_ID}:unmet` };
    }
    case "RS-282::seki_toshi": {
      const next = beginRockDrop(state, ctx);
      return { state: next, detail: ROCK_DROP_EFFECT_ID };
    }
    case "RS-293::fx_unknown_e590bc":
      if (state.activePlayer !== ctx.playerId || state.players[opponent(ctx.playerId)].deck.length === 0) {
        return { state, detail: `${ROAR_CONFIRM_EFFECT_ID}:unmet` };
      }
      return { state: optionalConfirm(state, ctx, ROAR_CONFIRM_EFFECT_ID), detail: ROAR_CONFIRM_EFFECT_ID };
    case "RS-294::re_e590bc":
      if (state.players[opponent(ctx.playerId)].deck.length === 0) return { state, detail: `${ECHO_CONFIRM_EFFECT_ID}:empty_deck` };
      return { state: optionalConfirm(state, ctx, ECHO_CONFIRM_EFFECT_ID), detail: ECHO_CONFIRM_EFFECT_ID };
    case "RS-301::riborubamisairu": {
      const next = beginRevolver(state, ctx);
      return next ? { state: next, detail: REVOLVER_UNIT_EFFECT_ID } : { state, detail: `${REVOLVER_UNIT_EFFECT_ID}:unmet` };
    }
    // 継続効果・別の契機で処理する効果（ここでは何もしない）。
    case "RS-291::hi_honoo":
    case "RS-297::fx_unknown_e5a489":
    case "RS-303::shiteigadeianzu":
    case "RS-273::tsuinarei":
    case "RS-274::pawakata":
    case "RS-275::kyuteisakuru":
    case "RS-276::merodeitakuto":
      return { state, detail: ctx.effectId };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// RS-265 ジェットシーカー【ラウンドレーダー】
// 「これが自軍ラッシュエリアにある間、相手が手札からオペレーションカードを使用したとき、敵軍パワーゾーンからカードを2枚まで
//  選び捨札にしてもよい。」
// 使用した時点でラッシュエリアにあれば、その効果で撃破されても発動する（faq-card-5 RS-265 Q1・Q4）。ダメージも選べる（Q2）。
// 2体あれば重複する（Q3）。使用したオペレーションの解決が終わってから開く（applyAction の後処理）。


type LooseAction = { type: string; playerId: PlayerId; instanceId?: string };

/** 手札からオペレーション（カウンターを含む）を使用したアクションなら、相手のジェットシーカーの数だけ積む。 */
export function queueRoundRadar(before: GameState, after: GameState, action: LooseAction): GameState {
  if (action.type !== "play_operation" && action.type !== "play_counter") return after;
  if (!action.instanceId) return after;
  const user = action.playerId;
  if (!before.players[user].hand.some((c) => c.instanceId === action.instanceId)) return after;
  if (after.players[user].hand.some((c) => c.instanceId === action.instanceId)) return after;
  const ownerId = opponent(user);
  // XG1-034【汚い大気】: バトルフェイズ中は無効（atwiki/page-1582 Q4・page-455 Q7）。
  if (filthyAirActive(before) || filthyAirActive(after)) return after;
  const jets = before.players[ownerId].rush.filter((c) => c.cardId === "RS-265").length;
  if (jets === 0) return after;
  const phasePlayerId = action.type === "play_counter" ? ownerId : user;
  const entries = Array.from({ length: jets }, () => ({ ownerId, phasePlayerId }));
  return { ...after, roundRadarQueue: [...(after.roundRadarQueue ?? []), ...entries] };
}

function radarBlocked(state: GameState): boolean {
  return !!(
    state.winner ||
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingDamagePayment ||
    state.pendingLeave ||
    state.pendingChase ||
    state.pendingRegister ||
    state.pendingZordSetup ||
    state.pendingEffectRush ||
    state.effectRushTriggerQueue?.length ||
    state.resolvingOperations?.length
  );
}

/** 積まれた【ラウンドレーダー】を、解決中の処理がなくなったら1つ開く。 */
export function openRoundRadarIfReady(state: GameState): GameState {
  let queue = state.roundRadarQueue;
  if (!queue?.length || radarBlocked(state)) return state;
  let next: GameState = state;
  while (queue.length > 0) {
    const [head, ...rest] = queue;
    queue = rest;
    if (filthyAirActive(next)) continue;
    const enemyId = opponent(head!.ownerId);
    const ids = next.players[enemyId].power.map((c) => c.instanceId);
    if (ids.length === 0) continue;
    return openEffectChoice(
      { ...next, roundRadarQueue: queue.length > 0 ? queue : undefined },
      {
        playerId: head!.ownerId,
        effectId: ROUND_RADAR_EFFECT_ID,
        sourceCardId: "RS-265",
        kind: "select_power",
        phasePlayerId: head!.phasePlayerId,
        validInstanceIds: ids,
        selectCount: 2,
        selectedInstanceIds: [],
        optional: true,
      },
    );
  }
  next = { ...next, roundRadarQueue: undefined };
  return next;
}

function finishRoundRadar(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const selected = pending.selectedInstanceIds ?? [];
  const next = selected.length > 0 ? discardFromPower(state, opponent(playerId), selected) : state;
  return {
    state: clearPending(next, pending.phasePlayerId),
    log: logFor(state, playerId, "RS-265", `${ROUND_RADAR_EFFECT_ID}:${selected.length}`),
  };
}

function resolveRoundRadar(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);
  const updated: GameState = {
    ...state,
    pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining },
  };
  if (selected.length >= 2 || remaining.length === 0) return finishRoundRadar(updated, playerId);
  return { state: updated };
}

// ---------------------------------------------------------------------------
// RS-256 闇の戒律（常駐）
// 「自軍スタートフェイズごとに自軍捨札からカードを1枚選び、これにウラ向きに重ねる。（撃破で手札に加える部分は rules/leaveEffects.ts）
//  自軍エンドフェイズに重ねたカードが3枚あれば、自軍ユニットをすべて撃破し、これを捨札にする。
//  これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる。」
// 捨札から選ぶのはドローした後でもよい（faq-card-5 RS-256 Q5）ので、ドローの後に選ぶ。

const DARK_LAW_STACKED_RULE = "rs256_dark_law_stacked";

function darkLawsNeedingStack(state: GameState, playerId: PlayerId): CardInstance[] {
  const player = state.players[playerId];
  if (player.discard.length === 0) return [];
  return player.operation.filter(
    (c) => c.cardId === "RS-256" && !hasTurnRuleModifier(player, `${DARK_LAW_STACKED_RULE}::${c.instanceId}`),
  );
}

/** スタートフェイズを終える前に重ねる処理が残っているか。 */
export function darkLawStackPending(state: GameState, playerId: PlayerId): boolean {
  return state.phase === "start" && state.activePlayer === playerId && darkLawsNeedingStack(state, playerId).length > 0;
}

/** ドローの後（スタートフェイズ中、他に選択がないとき）に重ねるカードの選択を開く。 */
export function openDarkLawStackIfNeeded(state: GameState, playerId: PlayerId): GameState {
  if (state.pendingEffectChoice || state.phase !== "start" || state.activePlayer !== playerId) return state;
  if (!state.players[playerId].hasDrawnThisStart) return state;
  const law = darkLawsNeedingStack(state, playerId)[0];
  if (!law) return state;
  return openEffectChoice(state, {
    playerId,
    effectId: DARK_LAW_STACK_EFFECT_ID,
    sourceCardId: "RS-256",
    sourceInstanceId: law.instanceId,
    kind: "select_unit",
    phasePlayerId: playerId,
    validInstanceIds: state.players[playerId].discard.map((c) => c.instanceId),
    selectCount: 1,
    optional: false,
  });
}

function resolveDarkLawStack(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const lawId = pending.sourceInstanceId ?? "";
  let next = patchPlayer(state, playerId, (p) => {
    const card = p.discard.find((c) => c.instanceId === instanceId);
    if (!card) return p;
    return addTurnRuleModifier(
      {
        ...p,
        discard: p.discard.filter((c) => c.instanceId !== instanceId),
        operation: p.operation.map((c) =>
          c.instanceId === lawId ? { ...c, stackedCards: [...(c.stackedCards ?? []), { ...card, faceDown: true }] } : c,
        ),
      },
      `${DARK_LAW_STACKED_RULE}::${lawId}`,
      { sourceCardId: "RS-256" },
    );
  });
  next = clearPending(next, pending.phasePlayerId);
  next = openDarkLawStackIfNeeded(next, playerId);
  return { state: next, log: logFor(state, playerId, "RS-256", DARK_LAW_STACK_EFFECT_ID) };
}

/** 自軍エンドフェイズ（ターンを終えるとき）: 重ねたカードが3枚あれば自軍ユニットをすべて撃破し、これを捨札にする。 */
export function applyDarkLawTurnEnd(state: GameState, endingPlayerId: PlayerId): GameState {
  const laws = state.players[endingPlayerId].operation.filter(
    (c) => c.cardId === "RS-256" && (c.stackedCards?.length ?? 0) >= 3,
  );
  if (laws.length === 0) return state;
  let next = state;
  for (const id of fieldUnits(next, endingPlayerId).map((c) => c.instanceId)) {
    if (!fieldUnits(next, endingPlayerId).some((c) => c.instanceId === id)) continue;
    const left = applyUnitLeave(next, id, "discard", endingPlayerId);
    if (!("error" in left)) next = left.state;
  }
  for (const law of laws) {
    next = patchPlayer(next, endingPlayerId, (p) => {
      const current = p.operation.find((c) => c.instanceId === law.instanceId);
      if (!current) return p;
      const { stackedCards, ...base } = current;
      return {
        ...p,
        operation: p.operation.filter((c) => c.instanceId !== law.instanceId),
        discard: [...p.discard, base, ...(stackedCards ?? []).map(({ faceDown: _f, ...c }) => c)],
      };
    });
  }
  return {
    ...next,
    log: [...next.log, buildLogEntry(endingPlayerId, "named_effect", "RS-256", state.definitions, "dark_law_wipe")],
  };
}

/** 常駐置き場以外に移った闇の戒律に重なっているカードを、持ち主の捨札に置く（applyAction の後処理）。 */
export function settleDarkLawStacks(state: GameState): GameState {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    const player = next.players[pid];
    const zones = ["power", "discard", "hand", "deck", "command", "rush", "battle"] as const;
    let changed = false;
    const freed: CardInstance[] = [];
    const patched: Partial<PlayerState> = {};
    for (const zone of zones) {
      const cards = player[zone];
      if (!cards.some((c) => c.cardId === "RS-256" && (c.stackedCards?.length ?? 0) > 0)) continue;
      changed = true;
      patched[zone] = cards.map((c) => {
        if (c.cardId !== "RS-256" || !c.stackedCards?.length) return c;
        freed.push(...c.stackedCards.map(({ faceDown: _f, ...s }) => s));
        const { stackedCards: _s, ...rest } = c;
        return rest;
      });
    }
    if (!changed) continue;
    next = { ...next, ...updatePlayer(next, pid, { ...player, ...patched, discard: [...(patched.discard ?? player.discard), ...freed] }) };
  }
  return next;
}

// ---------------------------------------------------------------------------
// RS-255 巨大化爆弾（カウンター）
// 「敵軍ターン中、特徴「怪人」を持つ自軍ユニットが撃破されて捨札になったとき発動できる⇒そのユニットカードを、このカードに重ねて
//  ラッシュエリアに出す。このカードに重ねたユニットはBP＋3000され、「SP1」「Lユニット」になる。重ねたユニットがユニットで
//  なくなるとき、このカードは捨札になる。」
// 捨札になった時点で反応窓（pendingGiantBomb）を開き、使うかどうかを選ぶ（見送りは pass_leave_reaction）。
// 出したユニットは新たにラッシュされた扱い（atwiki/page-37 Q7）。重ねた状態はユニットの stackedCards に巨大化爆弾を持つ形で表す。

function giantBombWindowBlocked(state: GameState): boolean {
  return radarBlocked(state) || !!(state.pendingBattle || state.pendingStrike || state.pendingRush || state.pendingMorph || state.pendingGiantBomb);
}

/** applyAction の後処理: 敵軍ターン中に「怪人」の自軍ユニットが捨札になり、手札に巨大化爆弾があれば窓を開く。 */
export function openGiantBombWindow(before: GameState, after: GameState): GameState {
  if (after.winner) return after;
  // 同時に誘発した効果の選択（例: RK-206 ウルフオルフェノク ※の「仮面ライダーファイズ」を選ぶ）が開いていると activePlayer は選ぶプレイヤー
  // なので、ターンのプレイヤーはその選択の phasePlayerId から得る（atwiki/page-207 Q1「発動タイミングは同じ」）。
  const turnPlayer = after.pendingEffectChoice?.phasePlayerId ?? after.activePlayer;
  const ownerId = opponent(turnPlayer);
  const owner = after.players[ownerId];
  const prevField = fieldUnits(before, ownerId);
  const fresh = owner.hand.some((c) => c.cardId === GIANT_BOMB_CARD_ID) && turnPlayer !== ownerId
    ? owner.discard
        .filter((c) => hasFeature(after, c.cardId, "怪人"))
        .filter((c) => prevField.some((p) => p.instanceId === c.instanceId))
        .map((c) => c.instanceId)
    : [];
  const deferred = after.deferredGiantBomb;
  const deferredIds = deferred
    ? deferred.unitInstanceIds.filter((id) => after.players[deferred.ownerId].discard.some((c) => c.instanceId === id))
    : [];
  if (giantBombWindowBlocked(after)) {
    // 選択などが開いていて窓を開けない — 終わってから開く（atwiki/page-207 Q1: 巨大化爆弾とウルフオルフェノクの※は同じタイミング）。
    if (fresh.length === 0 || after.pendingGiantBomb) return after;
    const ids = deferred?.ownerId === ownerId ? [...new Set([...deferredIds, ...fresh])] : fresh;
    return { ...after, deferredGiantBomb: { ownerId, unitInstanceIds: ids, phasePlayerId: turnPlayer } };
  }
  const cleared: GameState = deferred ? { ...after, deferredGiantBomb: undefined } : after;
  if (deferred && deferredIds.length > 0 && cleared.players[deferred.ownerId].hand.some((c) => c.cardId === GIANT_BOMB_CARD_ID)) {
    const ids = deferred.ownerId === ownerId ? [...new Set([...deferredIds, ...fresh])] : deferredIds;
    return { ...cleared, pendingGiantBomb: { ownerId: deferred.ownerId, unitInstanceIds: ids, phasePlayerId: deferred.phasePlayerId }, activePlayer: deferred.ownerId };
  }
  if (fresh.length === 0) return cleared;
  return { ...cleared, pendingGiantBomb: { ownerId, unitInstanceIds: fresh, phasePlayerId: turnPlayer }, activePlayer: ownerId };
}

/** 窓を閉じる（使わない）。 */
export function closeGiantBombWindow(state: GameState): GameState {
  const pending = state.pendingGiantBomb;
  if (!pending) return state;
  return { ...state, pendingGiantBomb: undefined, activePlayer: pending.phasePlayerId };
}

export function giantBombCounterIds(state: GameState, playerId: PlayerId): string[] {
  const pending = state.pendingGiantBomb;
  if (!pending || pending.ownerId !== playerId) return [];
  return state.players[playerId].hand.filter((c) => c.cardId === GIANT_BOMB_CARD_ID).map((c) => c.instanceId);
}

/** 巨大化爆弾を使う: そのユニットカードを重ねてラッシュエリアに出す。出したユニットの instanceId を返す。 */
export function applyGiantBombCounter(
  state: GameState,
  playerId: PlayerId,
  bombInstanceId: string,
): { state: GameState; unitInstanceId?: string; log: string } {
  const pending = state.pendingGiantBomb!;
  const player = state.players[playerId];
  const bomb = player.hand.find((c) => c.instanceId === bombInstanceId);
  const unit = player.discard.find((c) => pending.unitInstanceIds.includes(c.instanceId));
  const closed = { ...state, pendingGiantBomb: undefined, activePlayer: pending.phasePlayerId };
  if (!bomb) return { state: closed, log: buildLogEntry(playerId, "play_counter", GIANT_BOMB_CARD_ID, state.definitions, "no_card") };
  if (!unit) {
    const next = patchPlayer(closed, playerId, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== bombInstanceId),
      discard: [...p.discard, bomb],
    }));
    return { state: next, log: buildLogEntry(playerId, "play_counter", GIANT_BOMB_CARD_ID, state.definitions, "no_unit") };
  }
  const next = patchPlayer(closed, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== bombInstanceId),
    discard: p.discard.filter((c) => c.instanceId !== unit.instanceId),
    rush: [...p.rush, { instanceId: unit.instanceId, cardId: unit.cardId, stackedCards: [{ instanceId: bomb.instanceId, cardId: bomb.cardId }] }],
  }));
  return {
    state: next,
    unitInstanceId: unit.instanceId,
    log: buildLogEntry(playerId, "play_counter", GIANT_BOMB_CARD_ID, state.definitions, `giant_bomb:${cardName(state.definitions, unit.cardId)}`),
  };
}

/** 重ねたユニットがユニットでなくなった（場を離れた）とき、重ねていた巨大化爆弾を持ち主の捨札に置く。 */
function settleGiantBombStacks(state: GameState): GameState {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    const player = next.players[pid];
    const zones = ["power", "discard", "hand", "deck", "command", "operation"] as const;
    const freed: CardInstance[] = [];
    const patched: Partial<PlayerState> = {};
    for (const zone of zones) {
      const cards = player[zone];
      if (!cards.some((c) => c.cardId !== "RS-256" && hasGiantBomb(c))) continue;
      patched[zone] = cards.map((c) => {
        if (c.cardId === "RS-256" || !hasGiantBomb(c)) return c;
        freed.push(...(c.stackedCards ?? []).map(({ faceDown: _f, ...s }) => s));
        const { stackedCards: _s, ...rest } = c;
        return rest;
      });
    }
    if (freed.length === 0) continue;
    next = { ...next, ...updatePlayer(next, pid, { ...player, ...patched, discard: [...(patched.discard ?? player.discard), ...freed] }) };
  }
  return next;
}

/** applyAction の後処理: 重ねたカードの後始末（RS-256 闇の戒律・RS-255 巨大化爆弾）。 */
export function settleStackedCards(state: GameState): GameState {
  return settleGiantBombStacks(settleDarkLawStacks(state));
}

// ---------------------------------------------------------------------------
// RS-303 タイムファイヤー【シティガーディアンズ隊長】（後半）
// 「これが撃破されたとき、特徴「戦闘員」を持つ自軍ユニットを2体選び、かわりに捨札にしてもよい。」
// 撃破による離場（tryLeaveField）の前に、かわりに捨札にするかを選ぶ（見送れば通常どおり撃破される）。

function cityGuardiansCandidates(state: GameState, ownerId: PlayerId, selfId: string): string[] {
  return fieldUnits(state, ownerId)
    .filter((c) => c.instanceId !== selfId && hasFeature(state, c.cardId, "戦闘員"))
    .map((c) => c.instanceId);
}

export function openCityGuardiansSubstitute(state: GameState, intent: PendingLeave): GameState | null {
  if (intent.cityGuardiansDeclined || intent.leavingCardId !== "RS-303") return null;
  if (intent.toZone !== "discard" || intent.notDestruction) return null;
  if (state.pendingEffectChoice) return null;
  const ids = cityGuardiansCandidates(state, intent.ownerPlayerId, intent.instanceId);
  if (ids.length < 2) return null;
  return openEffectChoice(state, {
    playerId: intent.ownerPlayerId,
    effectId: CITY_GUARDIANS_EFFECT_ID,
    sourceCardId: "RS-303",
    sourceInstanceId: intent.instanceId,
    kind: "select_unit",
    unitDestination: "discard",
    phasePlayerId: intent.phasePlayerId,
    validInstanceIds: ids,
    selectCount: 2,
    selectedInstanceIds: [],
    optional: true,
    leaveIntentMeta: intent,
  });
}

function resolveCityGuardians(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  const intent = pending.leaveIntentMeta;
  if (!intent) return { error: "invalid_target" };
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  if (selected.length < 2) {
    return {
      state: {
        ...state,
        pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => id !== instanceId) },
      },
    };
  }
  // タイムファイヤーはその場に留まり（撃破された事実は残る）、選んだ「戦闘員」2体を捨札にする。
  let next = finalizeLeaveReaction(clearPending(state, pending.phasePlayerId), intent, true);
  next = patchPlayer(next, playerId, (p) => {
    const moved = [...p.battle, ...p.rush].filter((c) => selected.includes(c.instanceId));
    return {
      ...p,
      battle: p.battle.filter((c) => !selected.includes(c.instanceId)),
      rush: p.rush.filter((c) => !selected.includes(c.instanceId)),
      discard: [
        ...p.discard,
        ...moved.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId })),
        ...moved.flatMap((c) => (c.stackedCards ?? []).map(({ faceDown: _f, ...s }) => s)),
      ],
    };
  });
  return { state: finish(next, pending.phasePlayerId), log: logFor(state, playerId, "RS-303", `${CITY_GUARDIANS_EFFECT_ID}:substitute`) };
}

function skipCityGuardians(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice!;
  const intent = pending.leaveIntentMeta;
  const cleared = clearPending(state, pending.phasePlayerId);
  if (!intent) return { state: cleared };
  const left = tryLeaveField(cleared, { ...intent, cityGuardiansDeclined: true });
  const next = left.deferred ? left.state : finish(left.state, pending.phasePlayerId);
  return { state: next, log: logFor(state, playerId, "RS-303", `${CITY_GUARDIANS_EFFECT_ID}:declined`) };
}
