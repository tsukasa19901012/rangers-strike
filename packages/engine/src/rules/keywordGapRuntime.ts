import { hasScopedRestriction } from "../core/scopedModifiers";
import { sameCardName } from "../core/cardNames";
/**
 * 監査で検出された「付与のみで未消費」キーワードのランタイム実装。
 *
 * 各キーワードの意味は wiki カードテキスト準拠（docs/wiki/cards/*.md）。
 */
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { grantKeywordActiveOnCard } from "./ncGatedEffects";
import { getDefinition, isSmallUnit, unitEffectiveCategories } from "../core/catalog";
import { rk1IsSmallNow } from "./rk/rk1Features";
import { updatePlayer } from "../core/helpers";
import { cardHasGrantKeyword, listCardGrantKeywords } from "../dsl/promotedKeywordBridge";
import { applyUnitLeave, openEffectChoice } from "./pendingChoices";
import { countLogicalBattleSlots } from "./battleLine";
import { buildLogEntry } from "../log/formatLog";
import { bounceToHand } from "./bounce";

/**
 * ターン終了時のキーワード効果:
 * - discard_on_end_turn_battle: バトルエリアにあれば捨札（XG2-087 / XG6-048）
 * - self_destroy_low_damage_remaining: 残りライフ3点以下なら自壊（RS-289 / XP-023）
 * - end_turn_return_hand_wrong_number: バトルの並び順が本来のナンバーと違えば手札へ（RS-280〜284）
 */
export function applyKeywordTurnEndEffects(
  state: GameState,
  endingPlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  let nextState = state;
  const logs: string[] = [];
  const player = () => nextState.players[endingPlayerId];

  // discard_on_end_turn_battle
  for (const card of [...player().battle]) {
    if (!cardHasGrantKeyword(card.cardId, "discard_on_end_turn_battle")) continue;
    const left = applyUnitLeave(nextState, card.instanceId, "discard", endingPlayerId);
    if (!("error" in left)) {
      nextState = left.state;
      logs.push(
        buildLogEntry(endingPlayerId, "named_effect", card.cardId, state.definitions, "ターン終了時に捨札"),
      );
    }
  }

  // self_destroy_low_damage_remaining（負けるまで残り3点以下 = ダメージ4点以上）
  if (player().damage >= 4) {
    for (const zone of ["battle", "rush"] as const) {
      for (const card of [...player()[zone]]) {
        if (!cardHasGrantKeyword(card.cardId, "self_destroy_low_damage_remaining")) continue;
        const left = applyUnitLeave(nextState, card.instanceId, "discard", endingPlayerId);
        if (!("error" in left)) {
          nextState = left.state;
          logs.push(
            buildLogEntry(endingPlayerId, "named_effect", card.cardId, state.definitions, "残りライフ3点以下のため撃破"),
          );
        }
      }
    }
  }

  // end_turn_return_hand_wrong_number
  // ルール: R-TIME-07 — 並び順は「自軍バトルフェイズを終えるとき」の瞬間だけを参照する
  // （ターン終了時に前のユニットが手札に戻って並びが変わっても再判定しない）。
  const battleAtStart = state.players[endingPlayerId].battle;
  const recordedPositions = state.players[endingPlayerId].battlePositionsAtBattleEnd;
  for (const card of [...player().battle]) {
    if (!cardHasGrantKeyword(card.cardId, "end_turn_return_hand_wrong_number")) continue;
    const def = getDefinition(nextState.definitions, card.cardId);
    const printed = typeof def?.comboNumber === "number" ? def.comboNumber : null;
    if (printed === null) continue;
    const startIndex = battleAtStart.findIndex((c) => c.instanceId === card.instanceId);
    const position =
      recordedPositions?.[card.instanceId] ??
      (startIndex >= 0 ? countLogicalBattleSlots(battleAtStart.slice(0, startIndex)) + 1 : undefined);
    if (position === undefined || position === printed) continue;
    const bounced = bounceToHand(nextState, {
      playerId: endingPlayerId,
      instanceId: card.instanceId,
      fromZone: "battle",
    });
    if (bounced.bounced) {
      nextState = bounced.state;
      logs.push(
        buildLogEntry(endingPlayerId, "named_effect", card.cardId, state.definitions, "並び順がナンバーと違うため手札へ"),
      );
    }
  }

  return { state: nextState, logs };
}

/**
 * damage_gate_battle_entry（RS-289 / XP-023）:
 * 「ダメージを受けた敵軍ターンの次の自軍ターンにしかバトルエリアに出られない」
 * PlayerState.damagedOnEnemyTurn フラグは被ダメージ時に立て、自軍ターン終了時に消す。
 */
export function damageGateBlocksEntry(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  if (!cardHasGrantKeyword(cardId, "damage_gate_battle_entry")) return false;
  return !state.players[playerId].damagedOnEnemyTurn;
}

export function markEnemyTurnDamage(
  state: GameState,
  damagedPlayerId: PlayerId,
): GameState {
  if (state.activePlayer === damagedPlayerId) return state;
  const player = state.players[damagedPlayerId];
  if (player.damagedOnEnemyTurn) return state;
  return {
    ...state,
    ...updatePlayer(state, damagedPlayerId, { ...player, damagedOnEnemyTurn: true }),
  };
}

export function clearEnemyTurnDamageFlag(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  const player = state.players[endingPlayerId];
  if (!player.damagedOnEnemyTurn) return state;
  return {
    ...state,
    ...updatePlayer(state, endingPlayerId, { ...player, damagedOnEnemyTurn: undefined }),
  };
}

/** attack_held_rush_units / attack_rush_if_more_units: 敵軍ラッシュへのアタック許可。 */
export function keywordAllowsAttackIntoRush(
  state: GameState,
  attackerCardId: string,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
  /** アタックするユニット（NC の欄の能力は NC 成立時だけ有効。ncGatedEffects.grantKeywordActiveOnCard）。 */
  attackerCard?: Pick<CardInstance, "cardId" | "activatedNcEffects">,
): boolean {
  const enemy = state.players[defenderPlayerId];
  const defender = enemy.rush.find((c) => c.instanceId === defenderInstanceId);
  if (!defender) return false;

  if (
    (attackerCard ? grantKeywordActiveOnCard(attackerCard, "attack_held_rush_units") : cardHasGrantKeyword(attackerCardId, "attack_held_rush_units")) &&
    defender.commandHeld
  ) {
    return true;
  }
  if (
    (attackerCard ? grantKeywordActiveOnCard(attackerCard, "attack_rush_if_more_units") : cardHasGrantKeyword(attackerCardId, "attack_rush_if_more_units")) &&
    enemy.rush.length > enemy.battle.length
  ) {
    return true;
  }
  return false;
}

/** XG2-008: これがアタックするとき「アタックされたとき発動できる」カウンターを封じる。 */
export function attackerSuppressesAttackedCounters(attackerCardId: string): boolean {
  return cardHasGrantKeyword(attackerCardId, "cannot_named_counter_on_attack");
}

/** rush_from_discard_count_command / _power: コマンド/パワーからの自己ラッシュ条件。 */
export function canSelfRushFromZone(
  state: GameState,
  playerId: PlayerId,
  zone: "command" | "power" | "hand",
  instanceId: string,
): boolean {
  if (state.phase !== "rush" || state.activePlayer !== playerId) return false;
  const player = state.players[playerId];
  const card = player[zone].find((c) => c.instanceId === instanceId);
  if (!card) return false;
  if (zone === "hand") return handDeployConditionMet(state, playerId, card.cardId);
  if (zone === "power" && card.faceDown) return false;
  // RK-320 仮面ライダーライジングイクサの※（必要パワー1・9・3の自軍コマンドがそれぞれあれば。rules/rk/rk16Fields.ts）。
  if (zone === "command" && rk16CanDeployFromCommand(state, playerId, card)) return true;
  // 「これが自軍コマンドゾーンにある間」— リリース／ホールドの状態は問わない（RS-447・XG4-077。atwiki/page-786）。
  const keyword =
    zone === "command" ? "rush_from_discard_count_command" : "rush_from_discard_count_power";
  if (!cardHasGrantKeyword(card.cardId, keyword)) return false;
  const def = getDefinition(state.definitions, card.cardId);
  const cost = typeof def?.powerCost === "number" ? def.powerCost : parseInt(String(def?.powerCost), 10);
  if (!Number.isFinite(cost)) return false;
  return player.discard.length >= cost;
}

/**
 * 「※これが自分の手札にある間、自軍ラッシュフェイズ中、＜条件＞あれば、これを自軍ラッシュエリアに出してもよい。」
 * （DSL の while_in_hand_rush_deploy::*）の条件。本文の文言から判定する（対応している文言だけ）:
 * - 「自軍ダメージの数がこれの必要パワーの数字以上あれば」（RS-455 ニンジャブラック。atwiki/page-800）
 * コマンドのホールドも必要パワーの支払いもない（ラッシュではなく「出す」）。
 */
function handDeployConditionMet(state: GameState, playerId: PlayerId, cardId: string): boolean {
  if (!listCardGrantKeywords(cardId).some((k) => k.startsWith("while_in_hand_rush_deploy::"))) return false;
  const def = getDefinition(state.definitions, cardId);
  const text = def?.text ?? "";
  if (/自軍ダメージの数がこれの必要パワーの数字以上あれば/.test(text)) {
    const cost = typeof def?.powerCost === "number" ? def.powerCost : parseInt(String(def?.powerCost), 10);
    if (!Number.isFinite(cost)) return false;
    return state.players[playerId].damage >= cost;
  }
  // 「MAを持つ敵軍Sユニットがあれば」（RK-197 アントロード。atwiki/page-921）— 敵軍エリアに MA を持つ S ユニットがあるとき。
  const catEnemy = text.match(/(WB|MA|ET|DA|OT)を持つ敵軍Sユニットがあれば、これを自軍ラッシュエリアに出してもよい/);
  if (catEnemy?.[1]) {
    const enemyId: PlayerId = playerId === "player1" ? "player2" : "player1";
    const enemy = state.players[enemyId];
    return [...enemy.battle, ...enemy.rush].some((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      if (d?.type !== "unit" || !rk1IsSmallNow(state, c)) return false;
      return unitEffectiveCategories(state, enemyId, c, enemy.battle.some((b) => b.instanceId === c.instanceId) ? "battle" : "rush").includes(catEnemy[1] as never);
    });
  }
  // 「自軍「X」があれば」（RK-180 モグラ獣人「自軍「仮面ライダーアマゾン」があれば」。atwiki/page-910）— 自軍エリアにそのカード名のユニット
  // （「これは「X」として使える」を含む）があるとき。
  const named = text.match(/自軍「([^」]+)」があれば/);
  if (named?.[1]) {
    const want = named[1];
    const p = state.players[playerId];
    return [...p.battle, ...p.rush].some((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      if (d?.type !== "unit") return false;
      if (sameCardName(d.name, want)) return true;
      return [...(d.text ?? "").matchAll(/これは「([^」]+)」として(?:つかえる|使える)/g)].some((m) => sameCardName(m[1], want));
    });
  }
  return false;
}

/** 上記条件を満たす自己ラッシュの実行。 */
export function applySelfRushFromZone(
  state: GameState,
  playerId: PlayerId,
  zone: "command" | "power" | "hand",
  instanceId: string,
): GameState | null {
  if (!canSelfRushFromZone(state, playerId, zone, instanceId)) return null;
  const player = state.players[playerId];
  const card = player[zone].find((c) => c.instanceId === instanceId);
  if (!card) return null;
  const { faceDown: _fd, commandHeld: _ch, ...clean } = card;
  const nextPlayer = {
    ...player,
    [zone]: player[zone].filter((c) => c.instanceId !== instanceId),
    rush: [...player.rush, { ...clean, rushedThisTurn: true }],
  };
  return { ...state, ...updatePlayer(state, playerId, nextPlayer) };
}


/* --- attack_and_strike_once（PR-013 / RS-236 / XG5-063） --- */

import type { PlayerState } from "../types/game";
import { hasBakiBakiExtraAttack } from "./turnModifierBridge";
import { markTurnBattleAct } from "./rk/rk10Fields";
import { rk16CanDeployFromCommand } from "./rk/rk16Fields";

/**
 * battleActed 済みでも「アタックとストライクを1度ずつ」持ちなら
 * まだ行っていない側の行動を許可する。
 */
export function battleActBlocked(
  player: PlayerState,
  card: { cardId: string; instanceId: string; battleActed?: boolean; activatedNcEffects?: string[] },
  action: "attack" | "strike",
): boolean {
  // RS-326【究極奥義・猫だまし】で出したユニットはアタックもストライクもできない（atwiki/page-487）。
  if (hasScopedRestriction(player, card.instanceId, "neko_damashi_no_attack_strike", "turn")) return true;
  // RK-048【音撃斬・雷電斬震】で撃破したとき「これはアタックすることができない」。
  if (action === "attack" && hasScopedRestriction(player, card.instanceId, "no_attack_this_turn", "turn")) return true;
  // RS-167【爆竜必殺バキバキパンチ】で得た「アタックしてバトルに勝つたび、追加でアタックできる」。
  if (action === "attack" && hasBakiBakiExtraAttack(player, card.instanceId)) return false;
  // ルール: R-REPL-03 — 「アタックするかわりに」効果を発動したユニットはアタックする権利を失っている。
  if (action === "attack" && player.unitActionsThisTurn?.[card.instanceId]?.attacked) return true;
  if (!card.battleActed) return false;
  if (!cardHasGrantKeyword(card.cardId, "attack_and_strike_once") && !ncAttackAndStrikeOnce(card)) return true;
  const rec = player.unitActionsThisTurn?.[card.instanceId];
  return action === "attack" ? !!rec?.attacked : !!rec?.struck;
}

/**
 * NC の効果として「アタックとストライクを1度ずつ行ってもよい」を持ち、NC が成立しているか。
 * RS-191 ダイナレッド【ダイナ剣・夢の翼】（atwiki/page-393。NC 不成立なら1回だけ — faq-rider-2 RS-191）。
 */
function ncAttackAndStrikeOnce(card: { cardId: string; activatedNcEffects?: string[] }): boolean {
  return card.cardId === "RS-191" && !!card.activatedNcEffects?.includes("daina_ken_no_tsubasa");
}

export function markUnitBattleAction(
  player: PlayerState,
  instanceId: string,
  action: "attack" | "strike",
): PlayerState {
  const prev = player.unitActionsThisTurn ?? {};
  return {
    // RK-206【望まない争い】のため、そのプレイヤーがこのターンにアタック／ストライクを行ったことも記録する（rules/rk/rk10Fields.ts）。
    ...markTurnBattleAct(player, action),
    unitActionsThisTurn: {
      ...prev,
      [instanceId]: { ...prev[instanceId], [action === "attack" ? "attacked" : "struck"]: true },
    },
  };
}

/**
 * alias_* / chase_or_ridden_*_alias キーワードは「〜としてつかえる」テキストを
 * fusionMaterialAliasNames / 各名寄せ経路（ゾード素材・キャストオフ）で解釈済み。
 * ここでの認識は監査（audit-hollow-keywords）用のマーカー。
 */
export function isAliasKeyword(keyword: string): boolean {
  return (
    /^alias_/.test(keyword) ||
    /^dual_name_alias::/.test(keyword) ||
    /^chase_or_ridden_[sl]_vehicle_alias$/.test(keyword)
  );
}

/* --- turn_start_swap_hand_named（XG4-049/050/051） --- */

/**
 * 自軍ターン開始時: 手札の指定名カードとフィールドのこれを置き換えてもよい。
 * スタートフェイズ開始時（3行程より前）に選択を開く（ルール: R-START-06）。
 */
export function beginTurnStartSwaps(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const player = state.players[playerId];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      const keyword = listCardGrantKeywords(card.cardId).find((k) =>
        k.startsWith("turn_start_swap_hand_named::"),
      );
      if (!keyword) continue;
      const names = keyword.split("::")[1]?.split("_") ?? [];
      const handTargets = player.hand.filter((h) => {
        const def = getDefinition(state.definitions, h.cardId);
        return names.some((n) => (def?.name ?? "").includes(n));
      });
      if (handTargets.length === 0) continue;
      const opened = openEffectChoice(state, {
        playerId,
        effectId: "turn_start_swap_hand_named",
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        kind: "select_hand",
        validInstanceIds: handTargets.map((h) => h.instanceId),
        selectCount: 1,
        optional: true,
      });
      if (opened) return opened;
    }
  }
  return state;
}

export function resolveTurnStartSwap(
  state: GameState,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
  handInstanceId: string,
): GameState | null {
  const player = state.players[pending.playerId];
  const handCard = player.hand.find((c) => c.instanceId === handInstanceId);
  const fieldId = pending.sourceInstanceId;
  if (!handCard || !fieldId) return null;
  const zone = player.rush.some((c) => c.instanceId === fieldId)
    ? "rush"
    : player.battle.some((c) => c.instanceId === fieldId)
      ? "battle"
      : null;
  if (!zone) return null;
  const fieldCard = player[zone].find((c) => c.instanceId === fieldId)!;
  const { commandHeld: _ch, battleActed: _ba, mountedOnInstanceId: _m, stackedCards: stacked, ...fieldClean } = fieldCard;
  const nextPlayer = {
    ...player,
    hand: [...player.hand.filter((c) => c.instanceId !== handInstanceId), fieldClean],
    [zone]: [
      ...player[zone].filter((c) => c.instanceId !== fieldId),
      { ...handCard, ...(stacked ? { stackedCards: stacked } : {}) },
    ],
  };
  return { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) };
}

