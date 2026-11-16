// 対人戦のロビー: 部屋を作って相手を待つ・招待 URL から参加する・前の対戦に戻る。
// 状態は Solid の signal で、画面（OnlineView）はそれを描くだけ。待っている間の問い合わせは app の
// 毎フレームから frame() で進める（2 秒ごと）。対戦が始まったら onStart に部屋と最初の表示を渡す。
import { createSignal } from "solid-js";
import type { RemoteMatchView } from "@rangers-strike/client-core";
import { qrBits, type QrBits } from "./qr";
import {
  cancelRoom,
  copyText,
  createRoom,
  errorText,
  fetchRoom,
  inviteUrl,
  joinRoom,
  saveRoom,
  type DeckSpec,
  type FirstChoice,
  type SavedRoom,
} from "./online";

export type LobbyState =
  | { kind: "closed" }
  | { kind: "menu"; first: FirstChoice; busy: boolean; error?: string }
  | { kind: "waiting"; room: SavedRoom; url: string; qr: QrBits; note?: string }
  | { kind: "join"; id: string; busy: boolean; error?: string }
  | { kind: "resuming" };

const WAIT_POLL_MS = 2_000;

export class Lobby {
  readonly state: () => LobbyState;
  private readonly set: (s: LobbyState) => void;
  private nextPoll = 0;
  private polling = false;

  constructor(
    /** The match started (or is going on): play it. */
    private readonly onStart: (room: SavedRoom, view: RemoteMatchView) => void,
    private readonly now: () => number = () => Date.now(),
  ) {
    const [state, set] = createSignal<LobbyState>({ kind: "closed" }, { equals: false });
    this.state = state;
    this.set = set;
  }

  open(): void {
    this.set({ kind: "menu", first: "random", busy: false });
  }

  close(): void {
    const s = this.state();
    if (s.kind === "waiting") {
      saveRoom(null);
      void cancelRoom(s.room).catch(() => {});
    }
    this.set({ kind: "closed" });
  }

  setFirst(first: FirstChoice): void {
    const s = this.state();
    if (s.kind === "menu") this.set({ ...s, first });
  }

  /** Makes a room with the deck and waits for the other player. */
  create(deck: DeckSpec | { error: string }): void {
    const s = this.state();
    if (s.kind !== "menu" || s.busy) return;
    if ("error" in deck) return this.set({ ...s, error: deck.error });
    this.set({ ...s, busy: true, error: undefined });
    createRoom(deck, s.first).then(
      ({ id, token }) => {
        const room = { id, token };
        saveRoom(room);
        const url = inviteUrl(id);
        this.set({ kind: "waiting", room, url, qr: qrBits(url) });
        this.nextPoll = this.now() + WAIT_POLL_MS;
      },
      (error) => this.set({ ...s, busy: false, error: errorText(error) }),
    );
  }

  /** Opened from an invite URL: asks which deck to join with. */
  openJoin(id: string): void {
    this.set({ kind: "join", id, busy: false });
  }

  join(deck: DeckSpec | { error: string }): void {
    const s = this.state();
    if (s.kind !== "join" || s.busy) return;
    if ("error" in deck) return this.set({ ...s, error: deck.error });
    this.set({ ...s, busy: true, error: undefined });
    joinRoom(s.id, deck).then(
      ({ token, view }) => {
        const room = { id: s.id, token };
        saveRoom(room);
        this.set({ kind: "closed" });
        this.onStart(room, view);
      },
      (error) => this.set({ ...s, busy: false, error: errorText(error) }),
    );
  }

  /** A reload: goes back to the room this browser was in (the match, or the wait for the other player). */
  resume(room: SavedRoom): void {
    this.set({ kind: "resuming" });
    fetchRoom(room).then(
      (out) => {
        const view = out.view!;
        if (view.status === "playing") {
          this.set({ kind: "closed" });
          this.onStart(room, view);
        } else if (view.status === "waiting" && view.you === "player1") {
          const url = inviteUrl(room.id);
          this.set({ kind: "waiting", room, url, qr: qrBits(url) });
          this.nextPoll = this.now() + WAIT_POLL_MS;
        } else {
          saveRoom(null);
          this.set({ kind: "closed" });
        }
      },
      () => {
        saveRoom(null);
        this.set({ kind: "closed" });
      },
    );
  }

  copyInvite(): void {
    const s = this.state();
    if (s.kind !== "waiting") return;
    void copyText(s.url).then((copied) => {
      const now = this.state();
      if (now.kind === "waiting") this.set({ ...now, note: copied ? "URL をコピーしました" : "URL を表示しました" });
    });
  }

  /** Call every frame: while waiting, asks every 2 s whether the other player has joined. */
  frame(): void {
    const s = this.state();
    if (s.kind !== "waiting" || this.polling || this.now() < this.nextPoll) return;
    this.polling = true;
    const room = s.room;
    fetchRoom(room).then(
      (out) => {
        const view = out.view!;
        this.polling = false;
        this.nextPoll = this.now() + WAIT_POLL_MS;
        const current = this.state();
        if (current.kind !== "waiting" || current.room.id !== room.id) return;
        if (view.status === "playing") {
          this.set({ kind: "closed" });
          this.onStart(room, view);
        }
      },
      () => {
        this.polling = false;
        this.nextPoll = this.now() + WAIT_POLL_MS * 2;
      },
    );
  }
}
