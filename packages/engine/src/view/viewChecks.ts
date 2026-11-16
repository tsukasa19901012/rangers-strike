/**
 * viewFor の結果に、そのプレイヤーに見えてはいけない情報が入っていないかを調べる（テスト用）。
 * 問題があれば、どこに何が出ていたかの説明を返す（なければ空）。
 */
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import {
  collectInstances,
  HIDDEN_CARD_ID,
  resolveViewAction,
  visibleCardIds,
  visibleInstanceIds,
  type IdAliasTable,
  type PlayerView,
} from "./viewFor";

/**
 * カードに付いていない、カード番号だけの文字列が出てよい場所（効果の発生源・使用を宣言したカードなど、
 * 宣言した時点で公開されるもの）。ここにない場所に見えないカードの番号が出たらテストが落ちるので、
 * 新しい場所が出たら、公開してよい情報かを確かめてから足す。
 * modifiers.#.payload.cardId は「このターン撃破した・ホールドした・使ったカード」の記録（RK-258・RK-242・RK-248・
 * rk12_unit_held・XG6-060）で、どれも場で表になっていたカードなので、その後に山札や手札へ移っても公開済み。
 */
export const PUBLIC_CARD_ID_KEYS = /(?:^|\.)(?:sourceCardId|zordCardId|zordMaterialCardId|leavingCardId|xg6Offered\.#|modifiers\.#\.payload\.cardId)$/;

const REAL_ID = /[A-Za-z]{1,4}\d?-\d{3}-\d+/;

export function checkView(state: GameState, viewer: PlayerId, view: PlayerView, aliases: IdAliasTable, legal?: GameAction[]): string[] {
  const problems: string[] = [];
  const { definitions: _definitions, ...body } = view.state;
  const json = JSON.stringify([body, view.revealedCards, view.legalActions]);
  const real = json.match(REAL_ID);
  if (real) problems.push(`real instance id ${real[0]} in the view`);
  if ("rngState" in view.state) problems.push("rngState in the view");

  const visible = visibleInstanceIds(state, viewer);
  const visibleCards = visibleCardIds(state, viewer);
  const known = collectInstances(state);
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (state.definitions[value] && !visibleCards.has(value) && !PUBLIC_CARD_ID_KEYS.test(path)) {
        problems.push(`hidden card id ${value} at ${path}`);
      }
      return;
    }
    if (typeof value !== "object" || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, `${path}.#`));
      return;
    }
    const record = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(record)) {
      if (key === "cardId" && typeof record.instanceId === "string") {
        if (item === HIDDEN_CARD_ID) continue;
        const realId = aliases.fromAlias[record.instanceId];
        if (!realId || !visible.has(realId)) problems.push(`card ${String(item)} (${record.instanceId}) is shown but not visible, at ${path}`);
        else if (known.get(realId)?.cardId !== item) problems.push(`card ${record.instanceId} shows ${String(item)}, really ${known.get(realId)?.cardId}`);
        continue;
      }
      walk(item, path ? `${path}.${key}` : key);
    }
  };
  walk(body, "state");
  walk(view.revealedCards, "revealedCards");

  for (const card of view.state.players[viewer === "player1" ? "player2" : "player1"].hand) {
    if (card.cardId !== HIDDEN_CARD_ID) problems.push(`opponent hand card ${card.cardId} shown`);
  }
  for (const player of Object.values(view.state.players)) {
    for (const card of player.deck) if (card.cardId !== HIDDEN_CARD_ID) problems.push(`deck card ${card.cardId} shown in place`);
  }

  // 見えなくなったカードの別 ID が残っていると、山札に戻ったカードを追跡できてしまう。
  for (const real of Object.keys(aliases.toAlias)) {
    if (!visible.has(real)) problems.push(`alias kept for a card that is not visible: ${aliases.toAlias[real]}`);
  }

  if (legal) {
    view.legalActions.forEach((action, i) => {
      const back = resolveViewAction(action, aliases);
      if (JSON.stringify(back) !== JSON.stringify(legal[i])) problems.push(`legal action ${i} does not resolve back: ${JSON.stringify(action).slice(0, 160)}`);
    });
  }
  return problems;
}
