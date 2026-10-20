// Text view model of the board, built from GameState. Renderers only draw the
// returned lines; nothing here depends on screen size except the wrap width.
import type { EngineApi, GameState, PlayerId } from "../engineApi";
import { CPU, HUMAN } from "../engineApi";
import { PHASE_LABELS, PLAYER_LABELS, cardName, indexInstances, instanceName } from "../text/labels";
import { wrapText, type WrapOptions } from "../text/wrap";

export type ZoneLine = { label: string; text: string };

export type PlayerBoardView = {
  playerId: PlayerId;
  title: string;
  summary: string;
  zones: ZoneLine[];
};

export type BoardView = {
  header: string;
  players: PlayerBoardView[];
};

function unitLabel(engine: EngineApi, state: GameState, playerId: PlayerId, card: GameState["players"][PlayerId]["battle"][number]): string {
  const def = state.definitions[card.cardId];
  const name = def?.name ?? card.cardId;
  if (def?.type === "unit") {
    let bp: number | string = "?";
    try {
      bp = engine.effectiveBp(state, playerId, card);
    } catch {
      bp = def.bp ?? "?";
    }
    return `${name}(${bp})`;
  }
  return name;
}

export function buildPlayerBoard(
  engine: EngineApi,
  state: GameState,
  playerId: PlayerId,
  revealHand: boolean,
): PlayerBoardView {
  const p = state.players[playerId];
  const faceDown = p.power.filter((c) => c.faceDown).length;
  const faceUp = p.power.length - faceDown;
  const list = (cards: typeof p.battle, units = true) =>
    cards.length === 0
      ? "-"
      : cards.map((c) => (units ? unitLabel(engine, state, playerId, c) : cardName(state, c.cardId))).join("、");
  const zones: ZoneLine[] = [
    { label: "バトル", text: list(p.battle) },
    { label: "ラッシュ", text: list(p.rush) },
    {
      label: "コマンド",
      text:
        p.command.length === 0
          ? "-"
          : p.command.map((c) => `${cardName(state, c.cardId)}${c.commandHeld ? "[H]" : ""}`).join("、"),
    },
    { label: "パワー", text: `${p.power.length}枚（表${faceUp}・裏${faceDown}）` },
  ];
  if (p.operation.length > 0) zones.push({ label: "オペ", text: list(p.operation, false) });
  if (revealHand) zones.push({ label: "手札", text: list(p.hand, false) });
  return {
    playerId,
    title: PLAYER_LABELS[playerId],
    summary: `ダメージ${p.damage}/${engine.WIN_DAMAGE} 手札${p.hand.length} 山札${p.deck.length} 捨札${p.discard.length}`,
    zones,
  };
}

export function buildBoardView(engine: EngineApi, state: GameState): BoardView {
  const phase = PHASE_LABELS[state.phase] ?? state.phase;
  const header = state.winner
    ? `決着: ${PLAYER_LABELS[state.winner]}の勝利`
    : `ターン${state.turn} ${PLAYER_LABELS[state.activePlayer]}の${phase}フェイズ`;
  return {
    header,
    players: [buildPlayerBoard(engine, state, CPU, false), buildPlayerBoard(engine, state, HUMAN, true)],
  };
}

/** Flattens the board into wrapped text lines for a pane. */
export function boardLines(board: BoardView, wrap: WrapOptions): string[] {
  const lines: string[] = [];
  for (const player of board.players) {
    lines.push(...wrapText(`【${player.title}】${player.summary}`, wrap));
    for (const zone of player.zones) {
      lines.push(...wrapText(`${zone.label}: ${zone.text}`, wrap));
    }
  }
  return lines;
}

export type PendingView = {
  /** Who must answer: "あなた" / "CPU". */
  actor: string;
  title: string;
  /** Source card name and its effect/card text (wrap per pane). */
  source?: string;
  detail?: string;
};

/** An effect's name; effects without one (only an internal id such as "rs518_beast_rod") take their card's name. */
function effectLabel(engine: EngineApi, state: GameState, effectId: string, sourceCardId: string | undefined): string {
  const label = engine.getEffectLabel(effectId);
  if (label !== effectId && !/^[a-z0-9_]+$/.test(label)) return label;
  return (sourceCardId && cardName(state, sourceCardId)) || label;
}

/** Describes the pending choice or reaction window, if any. */
export function buildPendingView(engine: EngineApi, state: GameState): PendingView | null {
  const index = indexInstances(state);
  const who = (p: PlayerId | undefined) => (p ? PLAYER_LABELS[p] : "?");
  const sourceText = (cardId: string | undefined) => (cardId ? state.definitions[cardId]?.text : undefined);
  const morph = state.pendingMorph;
  const choice = state.pendingEffectChoice;
  if (morph && choice) {
    const unitId = morph.activeMorphUnitInstanceId ?? morph.morphUnitInstanceIds[0];
    return {
      actor: who(choice.playerId),
      title: `モーフ: ${who(morph.rusherPlayerId)}が「${instanceName(state, morph.rushedInstanceId, index)}」をラッシュ。「${unitId ? instanceName(state, unitId, index) : "?"}」と置き換えるカードを選ぶ（任意）`,
      source: cardName(state, choice.sourceCardId),
      detail: sourceText(choice.sourceCardId),
    };
  }
  if (choice) {
    const selected = choice.selectedInstanceIds?.length ?? 0;
    const count = choice.selectCount ? ` ${selected}/${choice.selectCount}` : "";
    return {
      actor: who(choice.playerId),
      title: `効果の選択「${effectLabel(engine, state, choice.effectId, choice.sourceCardId)}」${count}${choice.optional ? "（任意）" : ""}`,
      source: cardName(state, choice.sourceCardId),
      detail: sourceText(choice.sourceCardId),
    };
  }
  const payment = state.pendingCommandPayment;
  if (payment) {
    const cats = payment.categories?.length ? ` カテゴリ:${payment.categories.join("/")}` : "";
    return {
      actor: who(payment.playerId),
      title: `コマンド支払い: ${payment.totalNeeded}枚ホールド${cats}`,
      source: cardName(state, payment.sourceCardId),
      detail: sourceText(payment.sourceCardId),
    };
  }
  const damage = state.pendingDamagePayment;
  if (damage) {
    return {
      actor: who(damage.choosingPlayerId ?? damage.playerId),
      title: `ダメージ支払い: あと${damage.remainingFlips}枚を裏返す（計${damage.totalDamage}）`,
    };
  }
  const zord = state.pendingZordSetup;
  if (zord) {
    return {
      actor: who(zord.playerId),
      title: "ゾードラッシュの素材を選択",
      source: instanceName(state, zord.zordInstanceId, index),
    };
  }
  if (state.pendingStrike) return { actor: "", title: "ストライクへの反応" };
  const battle = state.pendingBattle;
  if (battle) {
    return {
      actor: "",
      title: `アタックへの反応: 「${instanceName(state, battle.attackerInstanceId, index)}」→「${instanceName(state, battle.defenderInstanceId, index)}」`,
    };
  }
  if (state.pendingRush) return { actor: "", title: "ラッシュへの反応" };
  if (state.pendingLeave) return { actor: who(state.pendingLeave.ownerPlayerId), title: "離れるユニットへの反応" };
  if (state.pendingBattleEntry) {
    return {
      actor: who(state.pendingBattleEntry.playerId),
      title: "バトル進入中: アタック・ストライク・パスを選択",
      source: instanceName(state, state.pendingBattleEntry.instanceId, index),
    };
  }
  return null;
}

export function pendingLines(view: PendingView | null, wrap: WrapOptions, maxDetailLines = 3): string[] {
  if (!view) return [];
  const lines = wrapText(`${view.actor ? `[${view.actor}] ` : ""}${view.title}`, wrap);
  if (view.source) lines.push(...wrapText(`カード: ${view.source}`, wrap));
  if (view.detail) lines.push(...wrapText(view.detail, { ...wrap, maxLines: maxDetailLines }));
  return lines;
}
