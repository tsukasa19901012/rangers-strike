/**
 * 対人戦（サーバー判定）で、1人のプレイヤーに渡す「自分から見える盤面」を作る。
 *
 * 仕様: 対人戦（C案）仕様書「見える情報の切り分け（viewFor）」。サーバーだけが本物の盤面・シード・乱数の状態を持ち、
 * ブラウザにはこの関数の結果だけを渡す。
 *  - カードの ID（instanceId は「RS-024-17」のようにカード番号を含む）は、プレイヤーごとの意味のない別 ID に振り直す。
 *    対応表（IdAliasTable）はサーバーが持ち、操作を受け取るときに resolveViewAction で本物の ID に戻す。
 *  - 見えないカード（相手の手札・お互いの山札・ウラ向きのカード）は、中身も ID も持たない裏面（HIDDEN_CARD_ID）にする。
 *    山札と相手の手札は、効果で見えているカードがあっても並びは見せず、見えるカードは revealedCards に カード番号順で並べる。
 *    見えなくなったカード（山札に戻った・相手の手札に入った・ウラ向きになった）の別 ID は忘れ、次に見えたときは
 *    新しい別 ID にする（一度見たカードを追跡されないように）。対戦の進行側は、viewFor を呼ばない手の後にも
 *    forgetHiddenAliases を呼んで、短い間だけ見えなくなったカードも振り替える。
 *  - 乱数の状態（rngState）は渡さない。カード定義は、見えるカードの分だけ渡す。
 *  - ログは viewFor では作らない（その時点で見えたかで決まるので、対戦の進行側が redactNewLogLines で1行ずつ伏せて貯める）。
 */
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import { isDenjiRevealAudience } from "../rules/denjiMachine";
import { isShironRevealAudience } from "../rules/shironLight";
import { revealNotices } from "../rules/revealNotice";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId, PlayerState } from "../types/game";

/** 見えないカードのカード番号（裏面）。 */
export const HIDDEN_CARD_ID = "?";
/** 見えないカードを指す ID（どのカードかは分からない）。 */
export const HIDDEN_INSTANCE_ID = "?";
/** 別 ID の頭（本物の ID やカード番号と混ざらない）。 */
export const ALIAS_PREFIX = "~";

/** プレイヤー1人分の、本物の instanceId と別 ID の対応表（サーバーが対戦ごとに保存する）。 */
export type IdAliasTable = { toAlias: Record<string, string>; fromAlias: Record<string, string> };

export function createIdAliasTable(): IdAliasTable {
  return { toAlias: {}, fromAlias: {} };
}

export type ViewOptions = {
  /** このプレイヤーの対応表（新しく見えたカードの別 ID が書き足される）。 */
  aliases: IdAliasTable;
  /** 新しい別 ID の本体（英数字だけ。推測できない乱数で、サーバーは crypto の乱数を使う）。ALIAS_PREFIX は付けなくてよい。 */
  newAliasBody: () => string;
  /** このプレイヤー用に伏せ済みのログ（redactNewLogLines で貯めたもの）。省略時は空。 */
  log?: string[];
};

export type PlayerView = {
  viewer: PlayerId;
  /** 伏せた盤面。カードの ID は別 ID、見えないカードは裏面。 */
  state: GameState;
  /** 山札・相手の手札にあるが、このプレイヤーに見えているカード（「山札を見て」の中身など）。カード番号順。 */
  revealedCards: CardInstance[];
  /** revealedCards の各カードがどのプレイヤーの山札・手札にあるか（同じ順。山札の中の位置は渡さない）。 */
  revealedFrom: Array<{ player: PlayerId; zone: "deck" | "hand" }>;
  /** 今の操作番のプレイヤー。 */
  actionPlayerId: PlayerId;
  /** このプレイヤーが今できる操作（別 ID）。操作番でなければ空。 */
  legalActions: GameAction[];
};

const PUBLIC_ZONES = ["rush", "battle", "command", "operation", "discard", "exile", "commander", "power"] as const;
const INSTANCE_ID_PATTERN = /^[A-Za-z]{1,4}\d?-\d{3}-\d+$/;

function isCardInstance(value: unknown): value is CardInstance {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CardInstance).instanceId === "string" &&
    typeof (value as CardInstance).cardId === "string"
  );
}

/** 盤面のどこかにあるカード（instanceId → カード）を全部集める。 */
export function collectInstances(state: GameState): Map<string, CardInstance> {
  const found = new Map<string, CardInstance>();
  const seen = new Set<object>();
  const walk = (value: unknown, depth: number) => {
    if (typeof value !== "object" || value === null || seen.has(value) || depth > 64) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (isCardInstance(value) && !found.has(value.instanceId)) found.set(value.instanceId, value);
    for (const [key, item] of Object.entries(value)) {
      if (key === "definitions" || key === "log") continue;
      walk(item, depth + 1);
    }
  };
  walk(state, 0);
  return found;
}

function addPublicCard(card: CardInstance, visible: Set<string>) {
  if (card.faceDown) return;
  visible.add(card.instanceId);
  for (const stacked of card.stackedCards ?? []) addPublicCard(stacked, visible);
}

function addChoiceIds(choice: PendingEffectChoice | undefined, viewer: PlayerId, visible: Set<string>, depth = 0) {
  if (!choice || depth > 8) return;
  if (choice.playerId === viewer) {
    for (const ids of [choice.validInstanceIds, choice.viewedInstanceIds, choice.deckLookInstanceIds, choice.selectedInstanceIds]) {
      for (const id of ids ?? []) visible.add(id);
    }
  }
  if (isDenjiRevealAudience(choice, viewer)) {
    for (const id of choice.denjiMachineMeta?.revealedInstanceIds ?? []) visible.add(id);
    for (const card of choice.denjiMachineMeta?.revealedCards ?? []) visible.add(card.instanceId);
  }
  if (isShironRevealAudience(choice, viewer) && choice.shironLightMeta?.pickedInstanceId) {
    visible.add(choice.shironLightMeta.pickedInstanceId);
  }
  addChoiceIds(choice.resumeChoice, viewer, visible, depth + 1);
}

/** 文字列・配列・オブジェクトの中にある、本物の instanceId を集める。 */
function collectIdStrings(value: unknown, known: Map<string, CardInstance>, into: Set<string>, depth = 0) {
  if (depth > 32) return;
  if (typeof value === "string") {
    if (known.has(value)) into.add(value);
    else for (const id of value.match(/[A-Za-z]{1,4}\d?-\d{3}-\d+/g) ?? []) if (known.has(id)) into.add(id);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectIdStrings(item, known, into, depth + 1);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (known.has(key)) into.add(key);
    collectIdStrings(item, known, into, depth + 1);
  }
}

/**
 * このプレイヤーに中身が見えるカードの instanceId。
 * 場（ウラ向きは除く）・捨札・除外・自分の手札・公開されたカード・自分が選んでいる選択の候補と、
 * 自分の操作番なら合法手に出てくるカード。
 */
export function visibleInstanceIds(state: GameState, viewer: PlayerId, legal?: GameAction[]): Set<string> {
  const visible = new Set<string>();
  for (const player of Object.values(state.players) as PlayerState[]) {
    for (const zone of PUBLIC_ZONES) {
      for (const card of player[zone] ?? []) addPublicCard(card, visible);
    }
  }
  for (const card of state.players[viewer]?.hand ?? []) {
    visible.add(card.instanceId);
    for (const stacked of card.stackedCards ?? []) visible.add(stacked.instanceId);
  }
  for (const entry of state.resolvingOperations ?? []) addPublicCard(entry.card, visible);
  for (const notice of revealNotices(state)) for (const card of notice.cards) visible.add(card.instanceId);
  addChoiceIds(state.pendingEffectChoice, viewer, visible);
  if (getActionPlayerId(state) === viewer) {
    const known = collectInstances(state);
    collectIdStrings(legal ?? getLegalActions(state), known, visible);
  }
  return visible;
}

/** 見えるカードのカード番号（ログを伏せるときに使う）。 */
export function visibleCardIds(state: GameState, viewer: PlayerId): Set<string> {
  const known = collectInstances(state);
  const cardIds = new Set<string>();
  for (const id of visibleInstanceIds(state, viewer)) {
    const card = known.get(id);
    if (card) cardIds.add(card.cardId);
  }
  for (const notice of revealNotices(state)) for (const card of notice.cards) cardIds.add(card.cardId);
  return cardIds;
}

function aliasOf(table: IdAliasTable, id: string, newAliasBody: () => string): string {
  const existing = table.toAlias[id];
  if (existing) return existing;
  let alias = ALIAS_PREFIX + newAliasBody();
  if (!/^~[0-9A-Za-z]+$/.test(alias)) throw new Error("viewFor: alias bodies must be letters and digits");
  for (let tries = 0; table.fromAlias[alias] !== undefined; tries++) {
    if (tries > 100) throw new Error("viewFor: could not make a new alias");
    alias = ALIAS_PREFIX + newAliasBody();
  }
  table.toAlias[id] = alias;
  table.fromAlias[alias] = id;
  return alias;
}

/**
 * 今このプレイヤーに見えないカードの別 ID を対応表から消す（消した数を返す）。
 * そのカードが次に見えたときは新しい別 ID になり、前の別 ID で送られた操作は戻せなくなる。
 */
export function forgetHiddenAliases(state: GameState, viewer: PlayerId, aliases: IdAliasTable, visible?: Set<string>): number {
  const now = visible ?? visibleInstanceIds(state, viewer);
  let forgotten = 0;
  for (const [real, alias] of Object.entries(aliases.toAlias)) {
    if (now.has(real)) continue;
    delete aliases.toAlias[real];
    // 消した別 ID は使い回さない（fromAlias には印だけ残し、戻せないようにする）。
    aliases.fromAlias[alias] = "";
    forgotten += 1;
  }
  return forgotten;
}

type Ctx = {
  known: Map<string, CardInstance>;
  visible: Set<string>;
  aliases: IdAliasTable;
  newAliasBody: () => string;
  hiddenCount: number;
};

function hiddenCard(ctx: Ctx, card?: CardInstance): CardInstance {
  ctx.hiddenCount += 1;
  return { instanceId: `${HIDDEN_INSTANCE_ID}${ctx.hiddenCount}`, cardId: HIDDEN_CARD_ID, ...(card?.faceDown ? { faceDown: true } : {}) };
}

function isRealId(ctx: Ctx, value: string): boolean {
  return ctx.known.has(value) || INSTANCE_ID_PATTERN.test(value);
}

/** 文字列の中に埋め込まれた ID（「search:XG7-042-42」等）。 */
const EMBEDDED_ID = /[A-Za-z]{1,4}\d?-\d{3}-\d+/g;

function redactString(ctx: Ctx, value: string): string {
  if (isRealId(ctx, value)) return ctx.visible.has(value) ? aliasOf(ctx.aliases, value, ctx.newAliasBody) : HIDDEN_INSTANCE_ID;
  if (!/-\d{3}-\d/.test(value)) return value;
  return value.replace(EMBEDDED_ID, (id) => (ctx.visible.has(id) ? aliasOf(ctx.aliases, id, ctx.newAliasBody) : HIDDEN_INSTANCE_ID));
}

function redact(ctx: Ctx, value: unknown, depth = 0): unknown {
  if (depth > 64) return undefined;
  if (typeof value === "string") return redactString(ctx, value);
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => redact(ctx, item, depth + 1));
  if (isCardInstance(value) && isRealId(ctx, value.instanceId) && !ctx.visible.has(value.instanceId)) return hiddenCard(ctx, value);
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (isRealId(ctx, key)) {
      if (!ctx.visible.has(key)) continue;
      out[aliasOf(ctx.aliases, key, ctx.newAliasBody)] = redact(ctx, item, depth + 1);
      continue;
    }
    const next = redact(ctx, item, depth + 1);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

/** 文字列として出てくるカード番号（定義のキー）と、カードの cardId を集める（渡すカード定義を決める）。 */
function collectCardIds(value: unknown, definitions: GameState["definitions"], into: Set<string>, depth = 0) {
  if (depth > 64) return;
  if (typeof value === "string") {
    if (definitions[value]) into.add(value);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectCardIds(item, definitions, into, depth + 1);
    return;
  }
  for (const item of Object.values(value)) collectCardIds(item, definitions, into, depth + 1);
}

const byCardId = (a: CardInstance, b: CardInstance) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0);

/** 1人のプレイヤーに渡す盤面・見えているカード・合法手。aliases は書き足される。 */
export function viewFor(state: GameState, viewer: PlayerId, options: ViewOptions): PlayerView {
  const actionPlayerId = getActionPlayerId(state);
  const legal = actionPlayerId === viewer ? getLegalActions(state) : [];
  const visible = visibleInstanceIds(state, viewer, legal);
  forgetHiddenAliases(state, viewer, options.aliases, visible);
  const ctx: Ctx = {
    known: collectInstances(state),
    visible,
    aliases: options.aliases,
    newAliasBody: options.newAliasBody,
    hiddenCount: 0,
  };

  const revealed: Array<{ card: CardInstance; player: PlayerId; zone: "deck" | "hand" }> = [];
  const players = {} as Record<PlayerId, PlayerState>;
  for (const [pid, player] of Object.entries(state.players) as Array<[PlayerId, PlayerState]>) {
    const { deck, hand, ...rest } = player;
    const out = redact(ctx, rest) as PlayerState;
    // 山札と相手の手札は、見えているカードがあっても並びを見せない。
    out.deck = deck.map((card) => hiddenCard(ctx, card));
    for (const card of deck) if (ctx.visible.has(card.instanceId)) revealed.push({ card, player: pid, zone: "deck" });
    if (pid === viewer) {
      out.hand = redact(ctx, hand) as CardInstance[];
    } else {
      out.hand = hand.map((card) => hiddenCard(ctx, card));
      for (const card of hand) if (ctx.visible.has(card.instanceId)) revealed.push({ card, player: pid, zone: "hand" });
    }
    players[pid] = out;
  }

  const { players: _players, definitions, log: _log, rngState: _rng, ...rest } = state;
  const body = redact(ctx, rest) as Partial<GameState>;
  const sortedRevealed = [...revealed].sort((a, b) => byCardId(a.card, b.card));
  const revealedCards = (redact(ctx, sortedRevealed.map((r) => r.card)) as CardInstance[]) ?? [];
  const revealedFrom = sortedRevealed.map(({ player, zone }) => ({ player, zone }));

  const viewState = { ...body, players, definitions: {}, log: options.log ?? [] } as GameState;
  const usedCardIds = new Set<string>();
  collectCardIds(viewState, definitions, usedCardIds);
  collectCardIds(revealedCards, definitions, usedCardIds);
  const legalActions = redact(ctx, legal) as GameAction[];
  collectCardIds(legalActions, definitions, usedCardIds);
  const viewDefinitions: GameState["definitions"] = {};
  for (const id of [...usedCardIds].sort()) viewDefinitions[id] = definitions[id]!;
  viewState.definitions = viewDefinitions;

  return { viewer, state: viewState, revealedCards, revealedFrom, actionPlayerId, legalActions };
}

/** 別 ID で届いた操作を、本物の ID の操作に戻す。知らない別 ID や見えないカードを指していたら null。 */
export function resolveViewAction(action: unknown, aliases: IdAliasTable): GameAction | null {
  let ok = true;
  const back = (value: unknown, depth: number): unknown => {
    if (depth > 32) {
      ok = false;
      return undefined;
    }
    if (typeof value === "string") {
      if (value.startsWith(ALIAS_PREFIX)) {
        const id = aliases.fromAlias[value];
        if (!id) ok = false;
        return id;
      }
      if (value === HIDDEN_INSTANCE_ID || INSTANCE_ID_PATTERN.test(value) || EMBEDDED_ID_TEST.test(value)) ok = false;
      if (!value.includes(ALIAS_PREFIX)) return value;
      return value.replace(EMBEDDED_ALIAS, (alias) => {
        const id = aliases.fromAlias[alias];
        if (!id) ok = false;
        return id ?? alias;
      });
    }
    if (typeof value !== "object" || value === null) return value;
    if (Array.isArray(value)) return value.map((item) => back(item, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const realKey = key.startsWith(ALIAS_PREFIX) ? aliases.fromAlias[key] : key;
      if (!realKey) ok = false;
      out[realKey ?? key] = back(item, depth + 1);
    }
    return out;
  };
  const result = back(action, 0);
  if (!ok || typeof result !== "object" || result === null || typeof (result as { type?: unknown }).type !== "string") return null;
  return result as GameAction;
}

const EMBEDDED_ID_TEST = /[A-Za-z]{1,4}\d?-\d{3}-\d+/;
const EMBEDDED_ALIAS = new RegExp(`${ALIAS_PREFIX}[0-9A-Za-z]+`, "g");

const CARD_ID_IN_TEXT = /[A-Za-z]{1,4}\d?-\d{3}(?:-\d+)?/g;

/** カードの置き場所（プレイヤー・ゾーン・何番目）。並びが変わったかも見る。 */
function locations(state: GameState): Map<string, string> {
  const out = new Map<string, string>();
  for (const [pid, player] of Object.entries(state.players) as Array<[PlayerId, PlayerState]>) {
    for (const [zone, cards] of Object.entries(player as unknown as Record<string, unknown>)) {
      if (!Array.isArray(cards)) continue;
      cards.forEach((card, i) => {
        if (isCardInstance(card)) out.set(card.instanceId, `${pid}:${zone}:${i}`);
      });
    }
  }
  return out;
}

/** 文字列の中の `names`（長い順）を「？」にする。`keep` の名前（見えるカードの名前）の中に含まれる部分は伏せない。 */
function hideNames(text: string, names: Set<string>, keep: readonly string[]): string {
  if (names.size === 0) return text;
  const masks: string[] = [];
  let out = text;
  for (const name of keep) {
    if (names.has(name) || !out.includes(name)) continue;
    out = out.split(name).join(`\u0001${masks.length}\u0002`);
    masks.push(name);
  }
  for (const name of [...names].sort((a, b) => b.length - a.length)) out = out.split(name).join("？");
  return out.replace(/\u0001(\d+)\u0002/g, (_, i: string) => masks[Number(i)]!);
}

/**
 * 1回の applyAction で増えたログの行を、このプレイヤー向けに伏せる。
 *  - 行に出てくるカード番号（またはカードの ID）が、操作の前にも後にもこのプレイヤーに見えていなかったら、
 *    そのカード番号と名前を「？」にする。見えるカードの本物の ID（RS-024-17）は、通し番号を外してカード番号にする。
 *  - 行の後ろの詳しい部分（`player|種類|カード番号|名前|…` の5つ目から。「未来予知で引いたカード」「山札の上の並び」など）は、
 *    このプレイヤーに見えないカードのうち、この操作で動いたか相手には見えているカードの名前と番号も伏せる。同じ名前の
 *    カードが場にあっても伏せる（場の1枚を見て、引いたカードの名前が分からないように）。
 *  - 見えるカードの名前の一部に伏せる名前が含まれていても（「マジピンク×マジブルー」の「マジブルー」）、見える名前は残す。
 */
export function redactNewLogLines(before: GameState, after: GameState, viewer: PlayerId, newLines?: string[]): string[] {
  const lines = newLines ?? after.log.slice(before.log.length);
  if (lines.length === 0) return [];
  const definitions = after.definitions;
  const seen = new Set<string>([...visibleCardIds(before, viewer), ...visibleCardIds(after, viewer)]);
  const opponent: PlayerId = viewer === "player1" ? "player2" : "player1";
  const mine = new Set<string>([...visibleInstanceIds(before, viewer), ...visibleInstanceIds(after, viewer)]);
  const theirs = new Set<string>([...visibleInstanceIds(before, opponent), ...visibleInstanceIds(after, opponent)]);
  const from = locations(before);
  const to = locations(after);
  const cards = new Map<string, CardInstance>([...collectInstances(before), ...collectInstances(after)]);
  // この操作で、このプレイヤーに見えないまま動いた・相手だけが見ているカード（詳しい部分では同名のカードが見えていても伏せる）。
  // ただし相手が持っているだけ（動いていない）のカードは、自分が同じカードを動かしたとき（自分で引いた・見た）は伏せない。
  const sensitive = new Set<string>();
  const heldByThem = new Set<string>();
  const movedByMe = new Set<string>();
  const unseenNames = new Set<string>();
  for (const [id, card] of cards) {
    if (!definitions[card.cardId]) continue;
    const moved = from.get(id) !== to.get(id);
    if (mine.has(id)) {
      if (moved) movedByMe.add(card.cardId);
      continue;
    }
    const name = definitions[card.cardId]!.name;
    if (!seen.has(card.cardId) && name && name.length >= 2) unseenNames.add(name);
    if (moved) sensitive.add(card.cardId);
    else if (theirs.has(id)) heldByThem.add(card.cardId);
  }
  for (const cardId of heldByThem) if (!movedByMe.has(cardId)) sensitive.add(cardId);
  const sensitiveNames = new Set<string>([...sensitive].map((id) => definitions[id]?.name ?? "").filter((n) => n.length >= 2));
  const visibleNames = [...new Set([...seen].map((id) => definitions[id]?.name ?? "").filter(Boolean))].sort((a, b) => b.length - a.length);

  const redactIds = (text: string, strict: boolean, hidden: Set<string>) =>
    text.replace(CARD_ID_IN_TEXT, (token) => {
      const base = token.replace(/-\d+$/, "");
      const cardId = base.length < token.length && definitions[base] ? base : token;
      if (!definitions[cardId]) return token;
      // 見えるカードでも、本物の ID（後ろの通し番号）は出さずカード番号にする。
      if (seen.has(cardId) && !(strict && sensitive.has(cardId))) return cardId;
      const name = definitions[cardId]?.name;
      if (name) hidden.add(name);
      return HIDDEN_CARD_ID;
    });

  return lines.map((line) => {
    const parts = line.split("|");
    const hidden = new Set<string>(unseenNames);
    const head = redactIds(parts.slice(0, 4).join("|"), false, hidden);
    if (parts.length <= 4) return hideNames(head, hidden, visibleNames);
    const detailHidden = new Set<string>([...hidden, ...sensitiveNames]);
    const detail = redactIds(parts.slice(4).join("|"), true, detailHidden);
    for (const name of hidden) detailHidden.add(name);
    return `${hideNames(head, hidden, visibleNames)}|${hideNames(detail, detailHidden, visibleNames)}`;
  });
}
