import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";

/**
 * カード保存則（テスト用の不変条件チェック）。
 *
 * ゲーム中のカードは常にいずれかのゾーン（山札・手札・捨札・パワー・コマンド・ラッシュ・バトル・
 * オペレーション・除外・コマンダー。常駐オペレーションやユニットに重ねたカードを含む）にちょうど 1 枚ずつ存在する。
 * 効果の解決途中で一時的にゾーン外に保持されるカード（公開中のデッキカード、DSL の続行データが持つ
 * 使用済みオペレーション等）は、保留中の状態（pending*）が参照している間だけ許容する。
 */

export const CARD_ZONES = [
  "deck",
  "hand",
  "discard",
  "power",
  "command",
  "rush",
  "battle",
  "operation",
  "exile",
  "commander",
] as const;

export type CardZone = (typeof CARD_ZONES)[number];

function collectStacked(card: CardInstance, out: CardInstance[]): void {
  out.push(card);
  for (const stacked of card.stackedCards ?? []) collectStacked(stacked, out);
}

/** プレイヤーのゾーンにあるカード（重ねたカードを含む）。 */
export function cardsInZones(player: PlayerState): CardInstance[] {
  const out: CardInstance[] = [];
  for (const zone of CARD_ZONES) {
    for (const card of player[zone] ?? []) collectStacked(card, out);
  }
  return out;
}

export function countPlayerCards(player: PlayerState): number {
  return cardsInZones(player).length;
}

function isCardInstanceLike(value: unknown): value is CardInstance {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CardInstance).instanceId === "string" &&
    typeof (value as CardInstance).cardId === "string"
  );
}

/** ゾーン外（保留中の効果データ）が保持しているカードの instanceId。 */
export function cardsHeldByPendingState(state: GameState): Set<string> {
  const held = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null || seen.has(value)) return;
    seen.add(value);
    if (isCardInstanceLike(value)) held.add(value.instanceId);
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const item of Object.values(value)) visit(item);
  };
  for (const [key, value] of Object.entries(state)) {
    if (key === "players" || key === "definitions" || key === "log") continue;
    visit(value);
  }
  return held;
}

export type CardConservationBaseline = Record<PlayerId, string[]>;

export function captureCardBaseline(state: GameState): CardConservationBaseline {
  return {
    player1: cardsInZones(state.players.player1).map((c) => c.instanceId),
    player2: cardsInZones(state.players.player2).map((c) => c.instanceId),
  };
}

export type CardConservationViolation =
  | { kind: "missing"; owner: PlayerId; instanceId: string }
  | { kind: "duplicated"; instanceId: string; count: number }
  | { kind: "unknown"; instanceId: string };

/**
 * baseline のカードがすべてゾーンにちょうど 1 枚ずつあるか（保留中の効果が保持している分は許容）を調べる。
 */
export function findCardConservationViolations(
  baseline: CardConservationBaseline,
  state: GameState,
): CardConservationViolation[] {
  const counts = new Map<string, number>();
  for (const pid of ["player1", "player2"] as const) {
    for (const card of cardsInZones(state.players[pid])) {
      counts.set(card.instanceId, (counts.get(card.instanceId) ?? 0) + 1);
    }
  }
  const held = cardsHeldByPendingState(state);
  const known = new Set<string>();
  const violations: CardConservationViolation[] = [];
  for (const owner of ["player1", "player2"] as const) {
    for (const id of baseline[owner]) {
      known.add(id);
      const count = counts.get(id) ?? 0;
      if (count === 0 && !held.has(id)) violations.push({ kind: "missing", owner, instanceId: id });
      if (count > 1) violations.push({ kind: "duplicated", instanceId: id, count });
    }
  }
  for (const id of counts.keys()) {
    if (!known.has(id)) violations.push({ kind: "unknown", instanceId: id });
  }
  return violations;
}

/** 両プレイヤーの（全ゾーン合計の）カード枚数。 */
export function totalCardCount(state: GameState): Record<PlayerId, number> {
  return {
    player1: countPlayerCards(state.players.player1),
    player2: countPlayerCards(state.players.player2),
  };
}
