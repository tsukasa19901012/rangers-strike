// 対人戦の結果画面のあと: 再戦の希望とデッキ公開の同意（どちらも両者がそろって成立。api/match.js の rematch / reveal）。
// 結果画面のあいだ app の毎フレームから frame() を呼び、2 秒ごとに部屋を問い合わせて相手の希望を受け取る。
// 再戦が成立したら、新しい部屋（同じトークン）の最初の表示を onStart に渡す。
import { createSignal } from "solid-js";
import type { RemoteMatchView } from "@rangers-strike/client-core";
import { errorText, fetchRoom, requestRematch, requestReveal, saveRoom, type PostGame, type SavedRoom } from "./online";

const POLL_MS = 2_000;

export type PostGameState = {
  post: PostGame | null;
  busy: boolean;
  error?: string;
};

export class PostGameRoom {
  readonly state: () => PostGameState;
  private readonly set: (s: PostGameState) => void;
  private room: SavedRoom | null = null;
  private version = -1;
  private nextPoll = 0;
  private polling = false;
  private starting = false;

  constructor(
    private readonly onStart: (room: SavedRoom, view: RemoteMatchView) => void,
    private readonly now: () => number = () => Date.now(),
  ) {
    const [state, set] = createSignal<PostGameState>({ post: null, busy: false }, { equals: false });
    this.state = state;
    this.set = set;
  }

  /** The finished match's room (null: not a 対人戦 result, nothing to follow). */
  follow(room: SavedRoom | null): void {
    if (room?.id === this.room?.id && room?.token === this.room?.token) return;
    this.room = room;
    this.version = -1;
    this.nextPoll = 0;
    this.starting = false;
    this.set({ post: null, busy: false });
  }

  rematch(): void {
    this.send(requestRematch);
  }

  reveal(): void {
    this.send(requestReveal);
  }

  /** Call every frame while the result screen shows. */
  frame(): void {
    const room = this.room;
    if (!room || this.polling || this.starting || this.now() < this.nextPoll) return;
    this.polling = true;
    fetchRoom(room, this.version >= 0 ? this.version : undefined).then(
      (out) => {
        this.polling = false;
        this.nextPoll = this.now() + POLL_MS;
        if (this.room !== room || out.unchanged) return;
        this.take(room, out.view, out.post);
      },
      () => {
        this.polling = false;
        this.nextPoll = this.now() + POLL_MS * 2;
      },
    );
  }

  private send(op: (room: SavedRoom) => Promise<{ view: RemoteMatchView; post: PostGame }>): void {
    const room = this.room;
    const s = this.state();
    if (!room || s.busy) return;
    this.set({ ...s, busy: true, error: undefined });
    op(room).then(
      (out) => {
        if (this.room !== room) return;
        this.set({ ...this.state(), busy: false });
        this.take(room, out.view, out.post);
      },
      (error) => {
        if (this.room === room) this.set({ ...this.state(), busy: false, error: errorText(error) });
      },
    );
  }

  private take(room: SavedRoom, view: RemoteMatchView | undefined, post: PostGame | undefined): void {
    if (view) this.version = Math.max(this.version, view.version);
    if (!post) return;
    this.set({ ...this.state(), post });
    const next = post.rematch.id;
    if (!next || this.starting) return;
    // Both asked: go into the new room (same token) as soon as its first view is here.
    this.starting = true;
    const nextRoom = { id: next, token: room.token };
    fetchRoom(nextRoom).then(
      (out) => {
        if (this.room !== room || !out.view) {
          this.starting = false;
          return;
        }
        saveRoom(nextRoom);
        this.follow(null);
        this.onStart(nextRoom, out.view);
      },
      (error) => {
        this.starting = false;
        this.nextPoll = this.now() + POLL_MS;
        if (this.room === room) this.set({ ...this.state(), error: errorText(error) });
      },
    );
  }
}
