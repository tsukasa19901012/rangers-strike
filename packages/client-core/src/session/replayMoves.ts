// Cards an effect of the other side moved, found from the board before and after its move (no log line names
// them): the person's units it destroyed, sent back or turned into power, the person's commands it held, and the
// other side's own units that came onto the field from elsewhere or left it. Built from the screen's state only,
// so in 対人戦 a card that turns hidden (into the other side's hand or deck) is followed by what pile grew.
import type { CardInstance, GameState, PlayerId } from "../engineApi";

/** Where a moved card went. */
export type MoveDest = "hand" | "deck" | "discard" | "power" | "powerDown" | "command" | "held" | "free" | "exile" | "battle" | "rush" | "stack" | "gone";

export type ReplayMove = {
  /** Whose card it is (player1: the person). */
  owner: PlayerId;
  cardId: string;
  dest: MoveDest;
  /** 「撃破した」「手札に戻した」… (the toast puts the card's name in front). */
  verb: string;
  /** Where it stood on a board row before (a card that left the row is drawn there once more). */
  from?: { row: string; slot: number };
  /** The card's tile now, when it is still (or newly) on a row. */
  instanceId?: string;
  /** The zone it came from (「deck」「power」「command」…), for how the line reads. */
  fromZone?: string;
  /** Several cards moved the same way at once (「山札の上から3枚を捨札にした」). */
  count?: number;
  /** A card the person may not see (into the other side's hand): only how many is said, `cardId` is 「?」. */
  hidden?: boolean;
};

type Place = { player: PlayerId; zone: string; flag: "" | "up" | "down" | "held" | "free"; index: number; card: CardInstance };

const ZONES = ["deck", "hand", "discard", "power", "command", "rush", "battle", "operation", "exile"] as const;
const FIELD = new Set(["rush", "battle"]);
/** Rows the screen draws card by card (a card that left one is drawn at its old place). */
const ROW_ZONES: Readonly<Record<PlayerId, readonly string[]>> = { player1: ["battle", "rush", "command", "hand"], player2: ["battle", "rush"] };

function cards(state: GameState, player: PlayerId, zone: string): CardInstance[] {
  const list = (state.players[player] as unknown as Record<string, unknown>)?.[zone];
  return Array.isArray(list) ? (list as CardInstance[]) : [];
}

function places(state: GameState): Map<string, Place> {
  const map = new Map<string, Place>();
  for (const player of ["player1", "player2"] as const) {
    for (const zone of ZONES) {
      cards(state, player, zone).forEach((card, index) => {
        const flag = zone === "power" ? (card.faceDown ? "down" : "up") : zone === "command" ? (card.commandHeld ? "held" : "free") : "";
        map.set(card.instanceId, { player, zone, flag, index, card });
      });
    }
  }
  return map;
}

const known = (state: GameState, cardId: string) => cardId !== "?" && !!state.definitions[cardId];

function destOf(p: Place): MoveDest {
  if (p.zone === "power") return p.flag === "down" ? "powerDown" : "power";
  if (p.zone === "command") return p.flag === "held" ? "held" : "command";
  if (p.zone === "operation") return "stack";
  return p.zone as MoveDest;
}

/** 「撃破した」 for a unit sent to the discard pile, and so on. */
function verbOf(fromZone: string, dest: MoveDest, fromFlag: string): string {
  const field = FIELD.has(fromZone);
  switch (dest) {
    case "discard":
      return field ? "撃破した" : fromZone === "hand" ? "捨てさせた" : "捨札にした";
    case "hand":
      return field ? "手札に戻した" : fromZone === "deck" ? "手札に加えた" : "手札に戻した";
    case "deck":
      return "山札に戻した";
    case "power":
      return fromZone === "power" ? "オモテにした" : "パワーにした";
    case "powerDown":
      return fromZone === "power" ? "裏にした" : "裏向きのパワーにした";
    case "held":
      return fromZone === "command" ? "ホールドした" : "ホールド状態でコマンドに置いた";
    case "command":
      return fromZone === "command" && fromFlag === "held" ? "リリースした" : "コマンドに置いた";
    case "exile":
      return "除外した";
    case "battle":
      return field ? "バトルエリアに移した" : "バトルエリアに出した";
    case "rush":
      return field ? "ラッシュエリアに戻した" : "ラッシュエリアに出した";
    case "stack":
      return "カードの下に重ねた";
    default:
      return "場を離れた";
  }
}

/** The pile of the other side that grew, for its card that turned hidden (its id changes in 対人戦). */
function grownPile(prev: GameState, next: GameState, player: PlayerId): MoveDest {
  const grew = (zone: string, down?: boolean) => {
    const count = (s: GameState) => cards(s, player, zone).filter((c) => down === undefined || !!c.faceDown === down).length;
    return count(next) > count(prev);
  };
  if (grew("hand")) return "hand";
  if (grew("deck")) return "deck";
  if (grew("power", true)) return "powerDown";
  return "gone";
}

export type MoveFilter = {
  /** Units the move's battle already shows (attacker and the unit it attacked). */
  skip?: ReadonlySet<string>;
  /** Cards the move's log names as rushed (their arrival is the rush step itself). */
  rushed?: ReadonlySet<string>;
  /** A rush was made in the move (cards leaving the field then are its materials). */
  rushMade?: boolean;
  /** The move's strike hit the person: their power turned face down is its damage (the strike step shows it). */
  struck?: boolean;
  /** Cards the other side drew in the move by the rules (its draw phase, 追加ドロー): not a search. */
  draws?: number;
  /** The other side released its held commands at the start of its turn (every turn: not shown). */
  startRelease?: boolean;
};

/**
 * The cards a move of player2 moved that the person should see: everything that happened to the person's own
 * cards on the board (units, commands, power, deck top, discard), and player2's units arriving on or leaving the
 * field other than by a rush or a battle.
 */
export function boardMoves(prev: GameState, next: GameState, filter: MoveFilter = {}): ReplayMove[] {
  const before = places(prev);
  const after = places(next);
  const moves: ReplayMove[] = [];
  const mill: Record<string, ReplayMove> = {};
  const pile = (owner: PlayerId, fromZone: string, dest: MoveDest, cardId: string, verb: string) => {
    const m = (mill[`${owner}:${fromZone}:${dest}`] ??= { owner, cardId, dest, verb, fromZone, count: 0 });
    m.count = (m.count ?? 0) + 1;
  };
  const fromRow = (p: Place) => (ROW_ZONES[p.player].includes(p.zone) ? { row: `${p.player}:${p.zone}`, slot: p.index } : undefined);
  for (const [id, was] of before) {
    if (filter.skip?.has(id)) continue;
    const now = after.get(id);
    if (now && now.player === was.player && now.zone === was.zone && now.flag === was.flag) continue;
    const cardId = was.card.cardId;
    if (!known(prev, cardId)) continue;
    const mine = was.player === "player1";
    const field = FIELD.has(was.zone);
    if (mine) {
      // The person's own draw and charge are not the other side's doing; neither is a power card damage turned
      // face down (the strike shows that) nor moving between their own rows.
      if (was.zone === "deck" && (!now || now.zone === "hand" || (now.zone === "power" && now.flag === "down"))) continue;
      if (was.zone === "hand" && (!now || now.zone !== "discard")) continue;
      if (was.zone === "discard" && !now) continue;
      if (filter.struck && was.zone === "power" && now?.zone === "power" && now.flag === "down") continue;
    } else {
      // The other side's own cards: only units that left the field (not to the other row, not in a battle).
      if (!field) continue;
      if (now && FIELD.has(now.zone) && now.player === was.player) continue;
    }
    let dest: MoveDest = now ? destOf(now) : mine ? "stack" : grownPile(prev, next, "player2");
    if (!now && !mine && dest === "gone" && filter.rushMade) dest = "stack";
    const verb =
      !mine && (dest === "stack" || (dest === "discard" && filter.rushMade))
        ? "合体の素材にした"
        : !mine && dest === "discard"
          ? "捨札にした"
          : verbOf(was.zone, dest, was.flag);
    if (was.zone === "deck" || (was.zone === "discard" && dest === "deck")) {
      // Several deck / discard cards moving together are one line.
      pile(was.player, was.zone, dest, cardId, verb);
      continue;
    }
    moves.push({ owner: was.player, cardId, dest, verb, fromZone: was.zone, from: fromRow(was), ...(now && ROW_ZONES[now.player].includes(now.zone) ? { instanceId: id } : {}) });
  }
  // In 対人戦 the person's deck is hidden to them too: a card that came out of it has an id not seen before.
  for (const [id, now] of after) {
    if (now.player !== "player1" || before.has(id) || now.zone === "hand" || now.zone === "deck" || FIELD.has(now.zone)) continue;
    if (!known(next, now.card.cardId) || cards(next, "player1", "deck").length >= cards(prev, "player1", "deck").length) continue;
    const dest = destOf(now);
    pile("player1", "deck", dest, now.card.cardId, verbOf("deck", dest, ""));
  }
  for (const m of Object.values(mill)) {
    const n = m.count ?? 1;
    moves.push({ ...m, verb: `${m.fromZone === "discard" ? "捨札" : "山札の上"}から${n}枚を${m.verb}` });
  }
  // The other side's units that came onto the field from somewhere other than its hand (a rush shows those).
  for (const [id, now] of after) {
    if (now.player !== "player2" || !FIELD.has(now.zone)) continue;
    const was = before.get(id);
    if (was && FIELD.has(was.zone) && was.player === now.player) continue;
    if (filter.rushed?.has(now.card.cardId) || filter.skip?.has(id)) continue;
    if (!known(next, now.card.cardId)) continue;
    const fromZone = was?.zone;
    if (fromZone === "hand") continue;
    const source = fromZone === "deck" ? "山札から" : fromZone === "discard" ? "捨札から" : fromZone === "power" ? "パワーから" : fromZone === "command" ? "コマンドから" : "";
    moves.push({ owner: "player2", cardId: now.card.cardId, dest: now.zone as MoveDest, verb: `${source}${now.zone === "battle" ? "バトルエリア" : "ラッシュエリア"}に出した`, fromZone, instanceId: id });
  }
  moves.push(...resourceMoves(prev, next, before, after, filter));
  // The person's units the other side moved onto the field (from their own power, deck …) are theirs to see too.
  for (const [id, now] of after) {
    if (now.player !== "player1" || !FIELD.has(now.zone) || before.has(id)) continue;
    if (!known(next, now.card.cardId)) continue;
    moves.push({ owner: "player1", cardId: now.card.cardId, dest: now.zone as MoveDest, verb: `${now.zone === "battle" ? "バトルエリア" : "ラッシュエリア"}に出した`, instanceId: id });
  }
  return moves;
}

/** 「あなたの マジレッド を撃破した」「あなたのコマンド ○○ をホールドした」 */
export function moveLine(move: ReplayMove, name: (cardId: string) => string, labels: Readonly<Record<PlayerId, string>>): string {
  const who = labels[move.owner];
  if (move.hidden) return `${who}が${move.verb}`;
  if (move.count !== undefined) return `${who}の${move.verb}`;
  if (move.dest === "gone") return `${who}の ${name(move.cardId)} が${move.verb}`;
  const where = move.fromZone === "power" ? "パワー" : move.fromZone === "command" ? "コマンド" : move.fromZone === "hand" ? "手札" : move.fromZone === "discard" ? "捨札" : "";
  return `${who}の${where ? `${where} ` : " "}${name(move.cardId)} を${move.verb}`;
}

/** The other side's cards an effect showed from its deck and put into its hand (GameState.lastReveal, newer than prev). */
function shownToHand(prev: GameState, next: GameState): Array<{ cardId: string }> {
  const last = next.lastReveal;
  const seen = prev.lastReveal?.seq ?? 0;
  if (!last || last.seq <= seen) return [];
  const { earlier, ...only } = last;
  return [...(earlier ?? []), only]
    .filter((n) => n.seq > seen && n.from === "deck")
    .flatMap((n) => n.cards.filter((c) => c.destination === "hand" && (c.ownerId ?? n.ownerId) === "player2"));
}

/**
 * The other side's own resources an effect moved: cards it added to its hand from the deck (only how many: the
 * person does not see them) or from the discard pile, its commands released or sent back, its power turned face
 * up or used. Its draw, charge, payment holds and the release at the start of its turn happen every turn: not shown.
 */
function resourceMoves(prev: GameState, next: GameState, before: Map<string, Place>, after: Map<string, Place>, filter: MoveFilter): ReplayMove[] {
  const moves: ReplayMove[] = [];
  const count = (s: GameState, zone: string, down?: boolean) => cards(s, "player2", zone).filter((c) => down === undefined || !!c.faceDown === down).length;
  const handGrew = count(next, "hand") > count(prev, "hand");
  // 山札 → 手札: by id where the screen has them (CPU 戦), by how many otherwise (対人戦 hides both).
  const deckIds = cards(prev, "player2", "deck").filter((c) => c.cardId !== "?");
  let fromDeck = deckIds.length
    ? deckIds.filter((c) => after.get(c.instanceId)?.zone === "hand" && after.get(c.instanceId)?.player === "player2").length
    : handGrew
      ? Math.min(count(prev, "deck") - count(next, "deck"), count(next, "hand") - count(prev, "hand"))
      : 0;
  fromDeck -= filter.draws ?? 0;
  // 「相手に見せてから手札に加える」（RK-146 デネブキャンディー等）: 公開されたカードは名前を出す（対人戦でも公開の記録は見える）。
  const shown = shownToHand(prev, next).filter((c) => known(next, c.cardId));
  for (const c of shown.slice(0, Math.max(0, fromDeck))) moves.push({ owner: "player2", cardId: c.cardId, dest: "hand", verb: "山札から手札に加えた" });
  fromDeck -= shown.length;
  if (fromDeck > 0) moves.push({ owner: "player2", cardId: "?", dest: "hand", verb: `山札から手札に${fromDeck}枚加えた`, fromZone: "deck", count: fromDeck, hidden: true });
  for (const [id, was] of before) {
    if (was.player !== "player2" || !known(prev, was.card.cardId)) continue;
    const now = after.get(id);
    if (now && now.zone === was.zone && now.flag === was.flag) continue;
    const dest: MoveDest = now ? destOf(now) : grownPile(prev, next, "player2");
    const cardId = was.card.cardId;
    if (was.zone === "discard") {
      if (dest !== "hand" || (!now && !handGrew)) continue;
      moves.push({ owner: "player2", cardId, dest, verb: "手札に加えた", fromZone: "discard" });
    } else if (was.zone === "command") {
      // Holding to pay for a rush is every turn's cost; the release at the start of the turn too.
      if (dest === "held" || (dest === "command" && filter.startRelease)) continue;
      moves.push({ owner: "player2", cardId, dest, verb: verbOf("command", dest, was.flag), fromZone: "command" });
    } else if (was.zone === "power" && was.flag === "up") {
      // Turned face down is damage (the flip step shows it); a unit put onto the field is shown as an arrival.
      if (dest === "powerDown" || dest === "battle" || dest === "rush" || dest === "gone") continue;
      moves.push({ owner: "player2", cardId, dest, verb: verbOf("power", dest, was.flag), fromZone: "power" });
    }
  }
  // 裏のパワー → オモテ: the card is seen once it is face up (in 対人戦 it comes with a new id).
  const downBefore = count(prev, "power", true);
  const downAfter = count(next, "power", true);
  if (downAfter < downBefore) {
    const turned = cards(next, "player2", "power").filter((c) => {
      if (c.faceDown || !known(next, c.cardId)) return false;
      const was = before.get(c.instanceId);
      return was ? was.zone === "power" && was.flag === "down" : true;
    });
    for (const c of turned.slice(0, downBefore - downAfter)) moves.push({ owner: "player2", cardId: c.cardId, dest: "power", verb: "オモテにした", fromZone: "power" });
  }
  return moves;
}
