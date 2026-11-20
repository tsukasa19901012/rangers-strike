// What the other side just did, one step at a time (対人戦 and CPU matches alike).
// A move of the other side, or a poll in 対人戦, can change the board a lot at once: the board already shows the
// result, and these events replay how it got there (ラッシュ, NC, アタック, ストライク, カウンター, オペレーション,
// 効果, the power card turned face down by damage). The person's own attack and strike are kept too, so they play
// the same animation, but without the toast (they made the move themselves).
// Built only from what the screen already has (the log lines and the board before and after), so 対人戦 shows
// nothing the person's view does not carry.
import type { CardInstance, EngineApi, GameState, PlayerId } from "../engineApi";

export type ReplayKind = "rush" | "nc" | "attack" | "strike" | "counter" | "operation" | "effect" | "flip";

export type ReplayEvent = {
  kind: ReplayKind;
  /** Whose move it is (the screen's players: player1 is the person). */
  actor: PlayerId;
  cardId: string;
  /** The card on the board (rush / nc / attack / strike / effect), when it is there. */
  instanceId?: string;
  /** The attacked unit. */
  targetId?: string;
  targetCardId?: string;
  /**
   * Where the card and the attacked unit were before the move, for a unit the move took off the board
   * (destroyed in the battle): the screen draws it there once more.
   */
  from?: ReplaySlot;
  to?: ReplaySlot;
  /** The side that takes a strike's damage, and how much (0: an effect cancelled it). */
  targetPlayer?: PlayerId;
  damage?: number;
  /** 「マジイエロー をラッシュ」 */
  title: string;
  /** The effect, the target or the damage, one or two lines. */
  detail: string;
  /** The person's own move: animation only, no toast. */
  own?: boolean;
};

/** A card's place on a board row: the row (「player2:battle」) and its index among that zone's cards. */
export type ReplaySlot = { row: string; slot: number };

/** Where `instanceId` lies on the battle / rush row of `player` in `state`. */
export function slotOf(state: GameState, player: PlayerId, instanceId: string | undefined): ReplaySlot | undefined {
  if (!instanceId) return undefined;
  for (const zone of BOARD_ZONES) {
    const slot = zoneCards(state, player, zone).findIndex((c) => c.instanceId === instanceId);
    if (slot >= 0) return { row: `${player}:${zone}`, slot };
  }
  return undefined;
}

/** Frames (60 per second) each kind plays for: long enough to read the toast, short enough not to hold the game up. */
export const REPLAY_FRAMES: Readonly<Record<ReplayKind, number>> = {
  rush: 96,
  nc: 108,
  attack: 96,
  strike: 108,
  counter: 120,
  operation: 108,
  effect: 96,
  flip: 96,
};
/** The person's own attack / strike (no toast to read). */
export const OWN_REPLAY_FRAMES: Readonly<Partial<Record<ReplayKind, number>>> = { attack: 42, strike: 54 };

const other = (p: PlayerId): PlayerId => (p === "player1" ? "player2" : "player1");

const BOARD_ZONES = ["battle", "rush"] as const;

function zoneCards(state: GameState, player: PlayerId, zone: string): CardInstance[] {
  const cards = (state.players[player] as unknown as Record<string, unknown>)?.[zone];
  return Array.isArray(cards) ? (cards as CardInstance[]) : [];
}

/** The instance of `cardId` on `player`'s battle / rush row (the newest one when there are several). */
function findOnBoard(state: GameState, player: PlayerId, cardId: string, zones: readonly string[] = BOARD_ZONES): string | undefined {
  for (const zone of zones) {
    const hit = zoneCards(state, player, zone).filter((c) => c.cardId === cardId);
    if (hit.length) return hit[hit.length - 1]!.instanceId;
  }
  return undefined;
}

function cardOf(state: GameState, instanceId: string): string | undefined {
  for (const player of ["player1", "player2"] as const) {
    for (const zone of BOARD_ZONES) {
      const card = zoneCards(state, player, zone).find((c) => c.instanceId === instanceId);
      if (card) return card.cardId;
    }
  }
  return undefined;
}

function findByName(state: GameState, player: PlayerId, name: string): string | undefined {
  for (const zone of BOARD_ZONES) {
    const hit = zoneCards(state, player, zone).find((c) => state.definitions[c.cardId]?.name === name);
    if (hit) return hit.instanceId;
  }
  return undefined;
}

/** 「【ピンクストーム】BP3000以下の…」: the card's effect named `name` (or its first named effect), from its text. */
export function effectSnippet(text: string | undefined, name?: string): string {
  if (!text) return "";
  const flat = text.replace(/\s+/g, " ");
  const parts = flat.split(/(?=【)/).filter((p) => p.startsWith("【"));
  const part = (name && parts.find((p) => p.startsWith(`【${name}】`))) || parts[0];
  return part ?? "";
}

/** A formatted log line without the 「あなたの」/「相手が」 in front (the toast already says whose move it is). */
function stripActor(line: string, labels: Readonly<Record<PlayerId, string>>): string {
  for (const label of Object.values(labels)) {
    for (const particle of ["の", "が", "は"]) if (line.startsWith(label + particle)) return line.slice(label.length + particle.length);
  }
  return line;
}

/** The effect name inside 「…が○○を発動」 / 「…（○○）」, when the line has one. */
function namedIn(line: string): string | undefined {
  return /が(.+?)を発動/.exec(line)?.[1] ?? /（(.+?)）$/.exec(line)?.[1];
}

const NC_ACTIONS = new Set(["number_combo", "riding_combo", "joint_combo_l", "joint_combo_r", "xg2_042_number_two"]);
const EFFECT_ACTIONS = new Set(["named_effect", "enter_battle", "destroy_effect", "activate_field_unit_ability", "activate_resident_operation", "strike_effect", "operation_effect"]);

/**
 * The events behind the log lines `entries` (added between `prev` and `next`). Moves of player2 (the other side),
 * plus player1's attacks and strikes; player2's power cards turned face down are found from the boards.
 */
export function replayEvents(
  engine: Pick<EngineApi, "formatGameLog">,
  prev: GameState,
  next: GameState,
  entries: readonly string[],
  labels: Readonly<Record<PlayerId, string>>,
): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  const defs = { ...prev.definitions, ...next.definitions };
  const name = (cardId: string, fallback?: string) => defs[cardId]?.name ?? fallback ?? cardId;
  const line = (entry: string) => stripActor(engine.formatGameLog(entry, defs, labels), labels);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const parts = entry.split("|");
    const actor = parts[0] as PlayerId;
    if (actor !== "player1" && actor !== "player2") continue;
    const action = parts[1] ?? "";
    const cardId = parts[2] ?? "";
    const detail = parts[4];
    const own = actor === "player1";
    if (own && action !== "battle" && action !== "strike") continue;
    if (!cardId || (parts.length < 4 && action !== "strike")) continue;
    if (detail?.startsWith("choice:")) continue;
    const at = () => findOnBoard(next, actor, cardId) ?? findOnBoard(prev, actor, cardId);
    switch (action) {
      case "rush": {
        // Its rush effect, when the same move logged one.
        const effect = entries.slice(i + 1).find((e) => {
          const p = e.split("|");
          return p[0] === actor && p[2] === cardId && (p[1] === "rush_effect" || p[1] === "named_effect") && !p[4]?.startsWith("choice:");
        });
        const snippet = effectSnippet(defs[cardId]?.text);
        events.push({
          kind: "rush",
          actor,
          cardId,
          instanceId: at(),
          title: `${name(cardId, parts[3])} をラッシュ`,
          detail: effect ? line(effect) : /ラッシュしたとき/.test(snippet) ? snippet : "",
        });
        break;
      }
      case "battle": {
        if (!detail || !detail.includes(":")) break;
        const defender = detail.split(":")[0]!;
        const attacker = findOnBoard(prev, actor, cardId, ["battle"]) ?? at();
        const targetId = findByName(prev, other(actor), defender) ?? findByName(next, other(actor), defender);
        events.push({
          kind: "attack",
          actor,
          cardId,
          instanceId: attacker,
          targetId,
          ...(targetId ? { targetCardId: cardOf(prev, targetId) ?? cardOf(next, targetId) } : {}),
          from: slotOf(prev, actor, attacker),
          to: slotOf(prev, other(actor), targetId),
          title: `${name(cardId, parts[3])} でアタック`,
          detail: `→ ${labels[other(actor)]}の ${defender}（${(detail.split(":")[1] ?? "").replace("vs", " 対 ")}）`,
          ...(own ? { own } : {}),
        });
        break;
      }
      case "strike": {
        const damage = Number(detail ?? "1") || 0;
        // The log can name the striker 「unknown」 (it left the battle area before the line was written): the strike
        // waiting before the move still says which unit it was.
        const pending = prev.pendingStrike?.strikerPlayerId === actor ? prev.pendingStrike.strikerInstanceId : undefined;
        const known = defs[cardId] ? cardId : pending ? cardOf(prev, pending) : undefined;
        if (!known) break;
        const striker = (defs[cardId] ? findOnBoard(prev, actor, cardId, ["battle"]) ?? at() : undefined) ?? pending;
        events.push({
          kind: "strike",
          actor,
          cardId: known,
          instanceId: striker,
          from: slotOf(prev, actor, striker),
          targetPlayer: other(actor),
          damage,
          title: `${name(known, parts[3])} でストライク`,
          detail: damage > 0 ? `→ ${labels[other(actor)]}に ${damage}点ダメージ` : `→ ${labels[other(actor)]}へのダメージは無効になった`,
          ...(own ? { own } : {}),
        });
        break;
      }
      case "play_counter":
        events.push({ kind: "counter", actor, cardId, title: `カウンター：${name(cardId, parts[3])}`, detail: effectSnippet(defs[cardId]?.text) || line(entry) });
        break;
      case "play_operation":
        if (detail === "placed") {
          events.push({ kind: "operation", actor, cardId, title: `${name(cardId, parts[3])} を配置`, detail: effectSnippet(defs[cardId]?.text) || line(entry) });
        } else events.push({ kind: "operation", actor, cardId, title: `${name(cardId, parts[3])} を使用`, detail: line(entry) });
        break;
      default: {
        if (NC_ACTIONS.has(action)) {
          const text = line(entry);
          const effect = namedIn(text);
          events.push({
            kind: "nc",
            actor,
            cardId,
            instanceId: findOnBoard(next, actor, cardId, ["battle"]) ?? at(),
            title: `${name(cardId, parts[3])} のNC${effect && !/^(SP\d|NC)$/.test(effect) ? `【${effect}】` : ""}`,
            detail: (effect && effectSnippet(defs[cardId]?.text, effect)) || text,
          });
        } else if (EFFECT_ACTIONS.has(action)) {
          // Markers that only say an effect found nothing to do (「rk039:no_targets」) are not worth a step of their own.
          if (detail && /(^|:)(no_targets?|not_enough|skipped|command_full|own_turn)$/.test(detail)) break;
          const text = line(entry);
          events.push({ kind: "effect", actor, cardId, instanceId: at(), title: `${name(cardId, parts[3])} の効果`, detail: text });
        }
      }
    }
  }
  // Damage: power cards of player2 that were face up and now lie face down (the person's own are their own pick).
  // In 対人戦 a face-down card of the other side comes with a new hidden id, so the cards are matched by what is
  // gone from the face-up ones, as many as the face-down ones grew by.
  const prevPower = zoneCards(prev, "player2", "power");
  const nextPower = zoneCards(next, "player2", "power");
  const grew = nextPower.filter((c) => c.faceDown).length - prevPower.filter((c) => c.faceDown).length;
  if (grew > 0) {
    const stillUp = new Set(nextPower.filter((c) => !c.faceDown).map((c) => c.instanceId));
    const flipped = prevPower.filter((c) => !c.faceDown && !stillUp.has(c.instanceId) && defs[c.cardId]).slice(0, grew);
    for (const card of flipped) {
      events.push({ kind: "flip", actor: "player2", cardId: card.cardId, title: `${name(card.cardId)} を裏返した`, detail: "ダメージでパワーが1枚裏になった" });
    }
  }
  return events;
}

/** The other side must pick power cards to turn face down (the person's strike hit): 「相手が裏返すパワーを選んでいます」. */
export function opponentPayingDamage(state: GameState): boolean {
  const pay = state.pendingDamagePayment;
  return !!pay && pay.playerId === "player2" && (pay.choosingPlayerId ?? pay.playerId) === "player2";
}

/** What the screen draws for the step being replayed. */
export type ReplayView = {
  event: ReplayEvent | null;
  /** 0..frames of the event. */
  frame: number;
  frames: number;
  /** Steps still to come after this one. */
  queued: number;
  /** Shown while no step plays: the other side is choosing (「相手が裏返すパワーを選んでいます…」). */
  waiting: string | null;
};

/** At most this many steps wait; older ones are dropped when a poll brings a long turn at once. */
const MAX_QUEUED = 8;

/** Plays replay events one after another (call frame() once per frame). */
export class ReplayPlayer {
  private queue: ReplayEvent[] = [];
  private current: ReplayEvent | null = null;
  private frameNo = 0;
  private total = 0;
  waiting: string | null = null;

  push(events: readonly ReplayEvent[]): void {
    this.queue.push(...events);
    if (this.queue.length > MAX_QUEUED) this.queue.splice(0, this.queue.length - MAX_QUEUED);
  }

  /** A step is playing or waiting. */
  get busy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /** Drops everything (a new match, the result screen). */
  clear(): void {
    this.queue = [];
    this.current = null;
    this.waiting = null;
  }

  /** Advances one frame. Returns true when something on screen moves. */
  frame(): boolean {
    if (!this.current) {
      const next = this.queue.shift();
      if (!next) return false;
      this.current = next;
      this.frameNo = 0;
      this.total = (next.own ? OWN_REPLAY_FRAMES[next.kind] : undefined) ?? REPLAY_FRAMES[next.kind];
      return true;
    }
    this.frameNo++;
    // With more waiting, each step plays faster (up to twice as fast) so the screen catches up.
    if (this.queue.length >= 3) this.frameNo++;
    if (this.frameNo >= this.total) this.current = null;
    return true;
  }

  view(): ReplayView {
    return { event: this.current, frame: this.frameNo, frames: this.total, queued: this.queue.length, waiting: this.current ? null : this.waiting };
  }
}
