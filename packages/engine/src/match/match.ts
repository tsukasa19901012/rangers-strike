/**
 * 対人戦（サーバー判定）の対戦進行。Vercel も Upstash も知らない純粋な処理で、API（api/match.js）や将来の
 * 常時接続の対戦サーバー（E案）はこれを呼んで、結果の MatchState を保存するだけにする。
 *
 * 仕様: 対人戦（C案）仕様書「対戦の流れ」「同時操作・再送・バージョン違い」「時間切れ・切断・再接続」。
 *  - 部屋は waiting → playing → finished。ホストが player1、ゲストが player2。
 *  - 操作は「版番号（version）」と「操作番号（seq）」を付けて送る。同じ seq の再送は適用せずに成功を返し、
 *    版番号がずれた操作・操作番でない人の操作・合法でない操作は、盤面を変えずに理由を返す。
 *  - 持ち時間はターン制: 1ターン3分（ターンが変わると戻る）。相手ターン中の選択は1回ごとに30秒で、その間は
 *    ターン側の3分を止める。期限は操作や poll のときに確かめる（matchTick）。時間切れはサーバーが自動で進め
 *    （自分のターンならターンを終え、選択は pickCpuFallbackAction）、対戦を通して3回目の時間切れで負け。
 *  - 盤面（GameState）はメモリ上だけ。保存は serializeMatch（カード定義を除く）で、読み込み時に作り直す。
 *    エンジンの版が変わっていたら、シードと操作の記録から最初から再生し、再生できなければ無効試合にする。
 *
 * 時刻・乱数（別 ID・シード）はすべて引数（MatchDeps）で受け取るので、テストで差し替えられる。
 * 関数は渡した MatchState を書き換える（呼ぶ側は書き換えた後のものを保存する）。
 */
import {
  buildStarterDeck,
  getFullPlayableCardById,
  starterDecks,
  type CardDefinition,
  type StarterDeckId,
} from "@rangers-strike/cards";
import { pickCpuFallbackAction } from "../ai/helpers";
import { pickCpuAction } from "../ai/index";
import { applyAction } from "../core/applyAction";
import { createGame } from "../core/createGame";
import { turnPlayerOf } from "../core/helpers";
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import {
  createIdAliasTable,
  forgetHiddenAliases,
  redactNewLogLines,
  resolveViewAction,
  viewFor,
  type IdAliasTable,
  type PlayerView,
} from "../view/viewFor";

/** 保存形式の版（形を変えたら上げ、古い形は読み込みで弾く）。 */
export const MATCH_STATE_VERSION = 1;
/** ブラウザに返す表示の形式の版（合わなければ「ページを再読み込みしてください」）。 */
export const MATCH_VIEW_FORMAT = 1;
/** 1ターンの持ち時間。 */
export const TURN_TIME_MS = 180_000;
/** 相手ターン中の選択1回の持ち時間。 */
export const CHOICE_TIME_MS = 30_000;
/** この回数目の時間切れで負け。 */
export const MAX_TIMEOUTS = 3;
/** 1回の時間切れで自動で進める操作の上限（超えたら止まった・ループしたとみなし無効試合）。 */
export const MAX_AUTO_STEPS = 400;
/** デッキの枚数の上限（ルールの検査ではなく、極端な入力を弾くためだけ）。 */
export const MAX_DECK_CARDS = 200;
/** 時間切れの自動進行をログに残す行の種類（`player|match_timeout_auto|N回目`）。 */
export const TIMEOUT_LOG_KIND = "match_timeout_auto";

const PLAYERS: readonly PlayerId[] = ["player1", "player2"];
const other = (p: PlayerId): PlayerId => (p === "player1" ? "player2" : "player1");

/** デッキの指定。スターターの id か、カード番号の並び（同じ番号を枚数分）。 */
export type DeckSpec = { starter: string } | { cards: string[] };
/** 先攻の決め方（ホストが部屋を作るときに選ぶ）。 */
export type FirstPlayerChoice = "host" | "guest" | "random";
export type MatchStatus = "waiting" | "playing" | "finished";
export type MatchEndReason = "win" | "resign" | "timeout" | "void";

export type MatchClock = {
  /** ターンの区切り（`${turn}:${ターンプレイヤー}`）。変わったら持ち時間が戻る。 */
  turnKey: string;
  turnPlayer: PlayerId;
  /** ターンプレイヤーの、このターンの残り（相手の選択の間は減らない）。 */
  turnRemainingMs: number;
  /** 今の操作番と、操作番になった時刻（期限はここから数える）。 */
  actor: PlayerId;
  actorSince: number;
  /** このターンはもう時間切れで、ターンプレイヤーの操作は自動で進める。 */
  autoTurn?: boolean;
};

export type MatchResult = { winner: PlayerId | null; reason: MatchEndReason; detail?: string };

export type MatchState = {
  v: typeof MATCH_STATE_VERSION;
  id: string;
  /** 盤面を作ったエンジンの版（変わっていたら読み込み時に再生し直す）。 */
  engineVersion: string;
  status: MatchStatus;
  createdAt: number;
  decks: { player1: DeckSpec; player2?: DeckSpec };
  firstPlayerChoice: FirstPlayerChoice;
  firstPlayer?: PlayerId;
  seed?: number;
  /** 盤面の版番号（変わるたびに 1 増える。poll はこれだけ見て変化を知る）。 */
  version: number;
  /** 適用した本物の操作（時間切れの自動進行も含む）。シードとデッキと合わせて再生できる。 */
  actions: GameAction[];
  /** actions のうち時間切れで自動で進めたものの位置。 */
  autoActions: number[];
  aliases: Record<PlayerId, IdAliasTable>;
  /** プレイヤーごとに伏せ済みのログ。 */
  logs: Record<PlayerId, string[]>;
  clock?: MatchClock;
  timeouts: Record<PlayerId, number>;
  /** 最後に受け付けた操作番号（再送の判定）。 */
  lastSeq: Record<PlayerId, number>;
  result?: MatchResult;
  finishedAt?: number;
  /** 今の盤面（保存しない。serializeMatch が外し、deserializeMatch が作り直す）。 */
  game?: GameState;
};

export type MatchDeps = {
  now: number;
  /** 別 ID の本体（英数字。推測できない乱数）。 */
  newAliasBody: () => string;
  /** 対戦のシード（推測できない乱数）。 */
  randomSeed: () => number;
};

export class MatchError extends Error {
  constructor(readonly code: string, message?: string) {
    super(message ?? code);
  }
}

/** デッキの指定をカード定義の並びにする。実在するカードかだけを確かめ、枚数や同名の上限は確かめない。 */
export function resolveDeck(spec: DeckSpec): CardDefinition[] {
  if (spec && typeof spec === "object" && "starter" in spec && typeof spec.starter === "string") {
    if (!Object.prototype.hasOwnProperty.call(starterDecks, spec.starter)) throw new MatchError("unknown_deck", `unknown starter ${spec.starter}`);
    return buildStarterDeck(spec.starter as StarterDeckId);
  }
  if (spec && typeof spec === "object" && "cards" in spec && Array.isArray(spec.cards)) {
    if (spec.cards.length === 0 || spec.cards.length > MAX_DECK_CARDS) throw new MatchError("bad_deck", "deck size");
    return spec.cards.map((id) => {
      const card = typeof id === "string" ? getFullPlayableCardById(id) : undefined;
      if (!card) throw new MatchError("unknown_card", `unknown card ${String(id)}`);
      return card;
    });
  }
  throw new MatchError("bad_deck", "deck spec");
}

function buildGame(m: MatchState): GameState {
  if (!m.decks.player2 || m.seed === undefined || !m.firstPlayer) throw new MatchError("not_started");
  return createGame({
    player1Deck: resolveDeck(m.decks.player1),
    player2Deck: resolveDeck(m.decks.player2),
    firstPlayer: m.firstPlayer,
    seed: m.seed,
  });
}

export type CreateMatchOptions = {
  id: string;
  engineVersion: string;
  hostDeck: DeckSpec;
  firstPlayer: FirstPlayerChoice;
  now: number;
};

/** 部屋を作る（ホストのデッキだけ。対戦はゲストの参加で始まる）。 */
export function createMatch(options: CreateMatchOptions): MatchState {
  resolveDeck(options.hostDeck);
  if (!["host", "guest", "random"].includes(options.firstPlayer)) throw new MatchError("bad_first_player");
  return {
    v: MATCH_STATE_VERSION,
    id: options.id,
    engineVersion: options.engineVersion,
    status: "waiting",
    createdAt: options.now,
    decks: { player1: options.hostDeck },
    firstPlayerChoice: options.firstPlayer,
    version: 1,
    actions: [],
    autoActions: [],
    aliases: { player1: createIdAliasTable(), player2: createIdAliasTable() },
    logs: { player1: [], player2: [] },
    timeouts: { player1: 0, player2: 0 },
    lastSeq: { player1: 0, player2: 0 },
  };
}

/** ゲストが参加して対戦を始める。 */
export function joinMatch(m: MatchState, guestDeck: DeckSpec, deps: MatchDeps): void {
  if (m.status !== "waiting") throw new MatchError("not_waiting");
  resolveDeck(guestDeck);
  m.decks.player2 = guestDeck;
  m.seed = deps.randomSeed() >>> 0;
  m.firstPlayer =
    m.firstPlayerChoice === "host" ? "player1" : m.firstPlayerChoice === "guest" ? "player2" : (deps.randomSeed() >>> 0) < 0x8000_0000 ? "player1" : "player2";
  m.game = buildGame(m);
  m.status = "playing";
  m.clock = freshClock(m.game, deps.now);
  commit(m, deps);
}

function turnKeyOf(game: GameState): { turnKey: string; turnPlayer: PlayerId } {
  const turnPlayer = turnPlayerOf(game);
  return { turnKey: `${game.turn}:${turnPlayer}`, turnPlayer };
}

function freshClock(game: GameState, now: number): MatchClock {
  return { ...turnKeyOf(game), turnRemainingMs: TURN_TIME_MS, actor: getActionPlayerId(game), actorSince: now };
}

/** 今の操作番の期限（この時刻を過ぎたら時間切れ）。 */
export function deadlineOf(clock: MatchClock): number {
  return clock.actorSince + (clock.actor === clock.turnPlayer ? clock.turnRemainingMs : CHOICE_TIME_MS);
}

/** 操作の後に時計を進める（at はその操作の時刻）。 */
function settleClock(m: MatchState, at: number): void {
  const clock = m.clock!;
  const game = m.game!;
  if (clock.actor === clock.turnPlayer) clock.turnRemainingMs = Math.max(0, clock.turnRemainingMs - Math.max(0, at - clock.actorSince));
  const { turnKey, turnPlayer } = turnKeyOf(game);
  if (turnKey !== clock.turnKey) {
    clock.turnKey = turnKey;
    clock.turnPlayer = turnPlayer;
    clock.turnRemainingMs = TURN_TIME_MS;
    clock.autoTurn = false;
  }
  clock.actor = getActionPlayerId(game);
  clock.actorSince = at;
}

function finish(m: MatchState, result: MatchResult, at: number): void {
  m.status = "finished";
  m.result = result;
  m.finishedAt = at;
}

function pushLog(m: MatchState, line: string): void {
  for (const p of PLAYERS) m.logs[p].push(line);
}

/** 本物の操作を1つ適用する（合法かは呼ぶ側が確かめる）。適用できなければ false。 */
function applyReal(m: MatchState, action: GameAction, at: number, auto: boolean, applied?: GameState): boolean {
  const before = m.game!;
  let after = applied;
  if (!after) {
    const result = applyAction(before, action);
    if (!result.ok) return false;
    after = result.state;
  }
  m.game = after;
  m.actions.push(action);
  if (auto) m.autoActions.push(m.actions.length - 1);
  for (const p of PLAYERS) {
    m.logs[p].push(...redactNewLogLines(before, after, p));
    // viewFor を呼ばないまま次の手に進んでも、見えなくなったカードの別 ID はここで忘れる。
    forgetHiddenAliases(after, p, m.aliases[p]);
  }
  settleClock(m, at);
  if (after.winner) finish(m, { winner: after.winner, reason: "win" }, at);
  return true;
}

/** 版番号を進め、両者の別 ID を今の盤面に合わせて振っておく（表示を作るときに対応表が変わらないように）。 */
function commit(m: MatchState, deps: Pick<MatchDeps, "newAliasBody">): void {
  m.version += 1;
  if (!m.game) return;
  for (const p of PLAYERS) viewFor(m.game, p, { aliases: m.aliases[p], newAliasBody: deps.newAliasBody });
}

/**
 * 期限を過ぎた時間切れを確定し、自動で進める。期限が続けて過ぎていれば（長く放置された等）、
 * 期限の時刻で順に処理する。変化があれば true（版番号も進む）。
 */
export function matchTick(m: MatchState, deps: MatchDeps): boolean {
  let changed = false;
  for (let guard = 0; m.status === "playing" && guard < MAX_TIMEOUTS * 4 + 8; guard++) {
    const clock = m.clock!;
    const deadline = deadlineOf(clock);
    if (deps.now < deadline) break;
    changed = true;
    const actor = clock.actor;
    m.timeouts[actor] += 1;
    pushLog(m, `${actor}|${TIMEOUT_LOG_KIND}|${m.timeouts[actor]}`);
    if (m.timeouts[actor] >= MAX_TIMEOUTS) {
      finish(m, { winner: other(actor), reason: "timeout" }, deadline);
      break;
    }
    if (actor === clock.turnPlayer) clock.autoTurn = true;
    autoAdvance(m, deadline, actor);
    // 相手の選択を自動で済ませたら、時間切れ中のターンの続きも進める。
    continueAutoTurn(m, deadline);
  }
  if (changed) commit(m, deps);
  return changed;
}

/**
 * 時間切れの操作番を自動で進める。ターンプレイヤーならターンが変わるまで（途中で相手の選択が入ったらそこで止め、
 * 戻ってきたら autoTurn で続ける）、相手の選択なら操作番が移るまで。
 */
function autoAdvance(m: MatchState, at: number, timedOut: PlayerId): void {
  // この自動進行で通った盤面。同じ盤面に戻る手（支払いを始めて取り消す等）は選ばず、ループさせない。
  const seen = new Set<string>([boardKey(m.game!)]);
  for (let step = 0; ; step++) {
    if (m.status !== "playing") return;
    const game = m.game!;
    const clock = m.clock!;
    const actor = getActionPlayerId(game);
    const continuing = actor === timedOut || (clock.autoTurn === true && actor === clock.turnPlayer);
    if (!continuing) return;
    if (step >= MAX_AUTO_STEPS) {
      finish(m, { winner: null, reason: "void", detail: "auto_stuck" }, at);
      return;
    }
    const next = pickAutoAction(game, actor, seen);
    if (!next) {
      finish(m, { winner: null, reason: "void", detail: "auto_no_action" }, at);
      return;
    }
    seen.add(boardKey(next.after));
    applyReal(m, next.action, at, true, next.after);
    // 相手の選択の時間切れは、その選択が終わって操作番が移ったら止める（同じ人の続きの選択も含めて1回と数える）。
    if (timedOut !== m.clock!.turnPlayer && getActionPlayerId(m.game!) !== timedOut) return;
  }
}

/** ログとカード定義を除いた盤面（同じ盤面に戻ったかを見る）。 */
function boardKey(game: GameState): string {
  const { log: _log, definitions: _definitions, ...rest } = game;
  return JSON.stringify(rest);
}

/**
 * 時間切れで自動で選ぶ手。見送り・取り消し・フェイズを終える手を優先し（pickCpuFallbackAction）、次に CPU（Lv1）の手、
 * 残りの合法手の順に試し、この自動進行ですでに通った盤面に戻らない最初の手を選ぶ。どれも戻るなら最初に通る手。
 */
function pickAutoAction(game: GameState, actor: PlayerId, seen: Set<string>): { action: GameAction; after: GameState } | null {
  const legal = getLegalActions(game).filter((a) => a.playerId === actor);
  const candidates: GameAction[] = [];
  const add = (a: GameAction | null | undefined) => {
    if (a && !candidates.some((c) => canonical(c) === canonical(a))) candidates.push(a);
  };
  add(pickCpuFallbackAction(game, actor));
  add(pickCpuAction(game, actor, 1));
  for (const a of legal) add(a);
  let firstOk: { action: GameAction; after: GameState } | null = null;
  for (const action of candidates) {
    const result = applyAction(game, action);
    if (!result.ok) continue;
    const next = { action, after: result.state };
    if (!seen.has(boardKey(result.state))) return next;
    firstOk ??= next;
  }
  return firstOk;
}

/** ターンプレイヤーの手番に戻ってきたとき、このターンがすでに時間切れなら続けて自動で進める。 */
function continueAutoTurn(m: MatchState, at: number): void {
  const clock = m.clock!;
  if (m.status === "playing" && clock.autoTurn && clock.actor === clock.turnPlayer) autoAdvance(m, at, clock.turnPlayer);
}

export type ActRequest = { seq: number; version: number; action: unknown };
export type ActResult =
  | { ok: true; duplicate?: boolean }
  | { ok: false; reason: "finished" | "not_started" | "old_seq" | "stale" | "not_your_turn" | "unknown_card" | "illegal" | "rejected" | "bad_request"; error?: string };

/** キーの順番によらない比較用の文字列。 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** プレイヤーの操作（別 ID）を受け付ける。拒否したときは盤面を変えない（期限切れの確定だけは先に行う）。 */
export function matchAct(m: MatchState, player: PlayerId, request: ActRequest, deps: MatchDeps): ActResult {
  if (!PLAYERS.includes(player) || typeof request !== "object" || request === null) return { ok: false, reason: "bad_request" };
  const { seq, version } = request;
  if (!Number.isSafeInteger(seq) || seq <= 0 || !Number.isSafeInteger(version)) return { ok: false, reason: "bad_request" };
  // 再送は版番号より先に見る（前回が通っていれば版番号は進んでいるため）。
  if (seq === m.lastSeq[player]) return { ok: true, duplicate: true };
  if (seq < m.lastSeq[player]) return { ok: false, reason: "old_seq" };
  matchTick(m, deps);
  if (m.status === "waiting") return { ok: false, reason: "not_started" };
  if (m.status !== "playing") return { ok: false, reason: "finished" };
  if (version !== m.version) return { ok: false, reason: "stale" };
  const game = m.game!;
  if (getActionPlayerId(game) !== player) return { ok: false, reason: "not_your_turn" };
  const resolved = resolveViewAction(request.action, m.aliases[player]);
  if (!resolved) return { ok: false, reason: "unknown_card" };
  const key = canonical(resolved);
  const legal = getLegalActions(game).find((a) => a.playerId === player && canonical(a) === key);
  if (!legal) return { ok: false, reason: "illegal" };
  if (!applyReal(m, legal, deps.now, false)) {
    const error = applyAction(game, legal);
    return { ok: false, reason: "rejected", error: error.ok ? undefined : error.error };
  }
  m.lastSeq[player] = seq;
  continueAutoTurn(m, deps.now);
  commit(m, deps);
  return { ok: true };
}

/** 投了。 */
export function matchResign(m: MatchState, player: PlayerId, deps: MatchDeps): boolean {
  matchTick(m, deps);
  if (m.status !== "playing" || !PLAYERS.includes(player)) return false;
  finish(m, { winner: other(player), reason: "resign" }, deps.now);
  commit(m, deps);
  return true;
}

export type MatchView = {
  format: typeof MATCH_VIEW_FORMAT;
  id: string;
  you: PlayerId;
  status: MatchStatus;
  version: number;
  timeouts: Record<PlayerId, number>;
  /** このプレイヤーが最後に通した操作の通し番号（読み込み直した画面は、この次の番号から送る）。 */
  lastSeq: number;
  result?: MatchResult;
  clock?: { actor: PlayerId; turnPlayer: PlayerId; deadline: number; turnRemainingMs: number; autoTurn: boolean };
  /** 対戦が始まっていれば、自分用の盤面・見えているカード・合法手（view/viewFor.ts）。 */
  view?: PlayerView;
};

/** 1人のプレイヤーに返す表示。commit の後なら対応表は変わらない（poll で保存し直さなくてよい）。 */
export function matchView(m: MatchState, player: PlayerId, deps: Pick<MatchDeps, "newAliasBody">): MatchView {
  const clock = m.clock;
  return {
    format: MATCH_VIEW_FORMAT,
    id: m.id,
    you: player,
    status: m.status,
    version: m.version,
    timeouts: { ...m.timeouts },
    lastSeq: m.lastSeq[player],
    ...(m.result ? { result: { ...m.result } } : {}),
    ...(clock && m.status === "playing"
      ? {
          clock: {
            actor: clock.actor,
            turnPlayer: clock.turnPlayer,
            deadline: deadlineOf(clock),
            turnRemainingMs: clock.turnRemainingMs,
            autoTurn: clock.autoTurn === true,
          },
        }
      : {}),
    ...(m.game ? { view: viewFor(m.game, player, { aliases: m.aliases[player], newAliasBody: deps.newAliasBody, log: m.logs[player] }) } : {}),
  };
}

/** 保存用の JSON（盤面のカード定義は除く。読み込み時にデッキから作り直す）。 */
export function serializeMatch(m: MatchState): string {
  const { game, ...rest } = m;
  if (!game) return JSON.stringify(rest);
  const { definitions: _definitions, ...board } = game;
  return JSON.stringify({ ...rest, board });
}

/** シードと操作の記録から盤面を作り直す（エンジンの版が変わったとき）。できなければ null。 */
export function replayMatch(m: Pick<MatchState, "decks" | "seed" | "firstPlayer" | "actions">): GameState | null {
  let game: GameState;
  try {
    game = buildGame(m as MatchState);
  } catch {
    return null;
  }
  for (const action of m.actions) {
    if (game.winner) return null;
    const result = applyAction(game, action);
    if (!result.ok) return null;
    game = result.state;
  }
  return game;
}

/**
 * 保存した JSON から読み込む。engineVersion が保存時と違うか盤面が保存されていなければ、操作の記録を最初から再生して盤面を作り直し、
 * 再生できなければ無効試合にする（版番号が進むので、呼ぶ側は保存し直す）。
 */
export function deserializeMatch(json: string, engineVersion: string, deps: MatchDeps): MatchState {
  const raw = JSON.parse(json) as MatchState & { board?: Omit<GameState, "definitions"> };
  if (raw.v !== MATCH_STATE_VERSION) throw new MatchError("bad_state_version");
  const { board, ...m } = raw;
  const match = m as MatchState;
  if (match.status === "waiting" || match.seed === undefined) {
    match.engineVersion = engineVersion;
    return match;
  }
  // 盤面が保存されていなければ（操作の記録だけ）、エンジンの版によらず再生する。
  if (board && match.engineVersion === engineVersion) {
    match.game = { ...(board as GameState), definitions: buildGame(match).definitions };
    return match;
  }
  match.engineVersion = engineVersion;
  const replayed = replayMatch(match);
  if (!replayed) {
    const fresh = buildGame(match);
    match.game = board ? { ...(board as GameState), definitions: fresh.definitions } : fresh;
    if (match.status === "playing") {
      finish(match, { winner: null, reason: "void", detail: "engine_update" }, deps.now);
      commit(match, deps);
    }
    return match;
  }
  match.game = replayed;
  if (match.status === "playing") {
    if (replayed.winner) finish(match, { winner: replayed.winner, reason: "win" }, deps.now);
    else {
      // 再生で操作番が変わっていることもあるので、時計の操作番だけ合わせる（残り時間はそのまま）。
      const clock = match.clock!;
      const { turnKey, turnPlayer } = turnKeyOf(replayed);
      if (turnKey !== clock.turnKey) Object.assign(clock, { turnKey, turnPlayer, turnRemainingMs: TURN_TIME_MS, autoTurn: false });
      clock.actor = getActionPlayerId(replayed);
    }
  }
  commit(match, deps);
  return match;
}
