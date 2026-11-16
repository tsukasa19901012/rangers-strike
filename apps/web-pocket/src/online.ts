// 対人戦（オンライン）: the room API (api/match.js) over fetch, the lobby (create a room and wait, or join
// one from an invite URL ?m=<id>), and the transport a RemoteSession plays through.
// The room's id and this player's token are kept in localStorage, so a reload goes back into the match.
import type { GameAction, MatchTransport, RemoteActResult, RemoteMatchView } from "@rangers-strike/client-core";

type BrowserGlobals = {
  fetch?: typeof fetch;
  location?: { origin: string; pathname: string; search: string; hash: string };
  history?: { replaceState(data: unknown, unused: string, url: string): void };
  localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
  navigator?: { clipboard?: { writeText(text: string): Promise<void> } };
  prompt?: (message: string, value?: string) => string | null;
};
const g = globalThis as unknown as BrowserGlobals;

export type DeckSpec = { starter: string } | { cards: string[] };
export type FirstChoice = "host" | "guest" | "random";
export type SavedRoom = { id: string; token: string };

const ROOM_KEY = "rs.online.v1";
const ID_PATTERN = /^[A-Za-z0-9]{8}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9]{24}$/;

/** The room this browser is in (a reload goes back to it), or null. */
export function savedRoom(): SavedRoom | null {
  try {
    const raw = g.localStorage?.getItem(ROOM_KEY);
    if (!raw) return null;
    const room = JSON.parse(raw) as SavedRoom;
    return ID_PATTERN.test(room?.id) && TOKEN_PATTERN.test(room?.token) ? room : null;
  } catch {
    return null;
  }
}

export function saveRoom(room: SavedRoom | null): void {
  try {
    if (room) g.localStorage?.setItem(ROOM_KEY, JSON.stringify(room));
    else g.localStorage?.removeItem(ROOM_KEY);
  } catch {
    // private mode: a reload loses the room, nothing else
  }
}

/** The room id of an invite URL (?m=<id>), taken out of the address bar so a reload does not join again. */
export function inviteFromLocation(): string | null {
  const loc = g.location;
  if (!loc) return null;
  const id = new URLSearchParams(loc.search).get("m");
  if (!id || !ID_PATTERN.test(id)) return null;
  try {
    g.history?.replaceState(null, "", loc.pathname);
  } catch {
    // the id still works for this load
  }
  return id;
}

export function inviteUrl(id: string): string {
  return `${g.location?.origin ?? ""}/?m=${id}`;
}

/** Copies the text; shows it in a prompt when the browser does not allow the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await g.navigator!.clipboard!.writeText(text);
    return true;
  } catch {
    g.prompt?.("この URL を相手に送ってください", text);
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

/** Server time minus this device's time (the clock's deadlines are the server's). */
let clockOffset = 0;

export function serverNow(): number {
  return Date.now() + clockOffset;
}

async function call<T>(method: "GET" | "POST", query: string, body?: unknown): Promise<T> {
  const sent = Date.now();
  const res = await g.fetch!(`/api/match${query}`, {
    method,
    cache: "no-store",
    ...(body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; now?: number } & T;
  if (!res.ok) throw new ApiError(res.status, data.error ?? "error");
  if (typeof data.now === "number") clockOffset = data.now - (sent + Date.now()) / 2;
  return data;
}

export function createRoom(deck: DeckSpec, first: FirstChoice): Promise<{ id: string; token: string; view: RemoteMatchView }> {
  return call("POST", "", { op: "create", deck, first });
}

export function joinRoom(id: string, deck: DeckSpec): Promise<{ token: string; view: RemoteMatchView }> {
  return call("POST", "", { op: "join", id, deck });
}

export function fetchRoom(room: SavedRoom): Promise<{ view: RemoteMatchView }> {
  return call("GET", `?id=${room.id}&t=${room.token}`);
}

/** The transport a RemoteSession plays through. Polls ask "anything newer than my version?". */
export function fetchTransport(room: SavedRoom, first: RemoteMatchView): MatchTransport {
  let last = first;
  const keep = (view: RemoteMatchView | undefined) => {
    if (view && view.version >= last.version) last = view;
    return view;
  };
  return {
    async fetchView() {
      const out = await call<{ view?: RemoteMatchView; unchanged?: boolean }>("GET", `?id=${room.id}&t=${room.token}&v=${last.version}`);
      return out.unchanged ? last : keep(out.view) ?? last;
    },
    async act(request: { seq: number; version: number; action: GameAction }) {
      const out = await call<{ result: RemoteActResult; view?: RemoteMatchView }>("POST", "", { op: "act", id: room.id, t: room.token, ...request });
      keep(out.view);
      return out;
    },
    async resign() {
      const out = await call<{ view?: RemoteMatchView }>("POST", "", { op: "resign", id: room.id, t: room.token });
      return keep(out.view);
    },
  };
}

/** What went wrong, for the person. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "not_found") return "部屋が見つかりません（期限切れか、URL が違います）";
    if (error.code === "taken") return "この部屋はもう対戦が始まっています";
    if (error.code === "bad_deck") return "このデッキでは対戦できません";
    if (error.code === "no_store") return "対人戦のサーバーが使えません";
    if (error.code === "bad_token") return "この部屋に入れません";
    return `通信エラー（${error.status}）`;
  }
  return "通信できませんでした";
}

export function cancelRoom(room: SavedRoom): Promise<unknown> {
  return call("POST", "", { op: "cancel", id: room.id, t: room.token });
}
