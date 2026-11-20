// The other side's moves played back one by one over the board (client-core ReplayPlayer): the card glows, a
// rushed card drops into its slot, an attacker flies into the unit it attacks, a striker is slammed onto the
// field, a counter / operation card shows big in the middle, a power card turned face down by damage flips over.
// A toast says what happened (not for the person's own attack and strike). Drawn only: input never stops for it.
import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { fitLine, isPortrait, tileRect, wrapText, type GuiView, type ReplayEvent, type ReplayKind, type ReplaySlot, type ReplayView } from "@rangers-strike/client-core";
import { CardFace, type Box } from "./ui";

/** Seconds since the step started (the core counts frames at 60 a second). */
const seconds = (r: ReplayView) => r.frame / 60;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

// Class literals must be complete strings (PocketJS bakes them at build time).
const GLOW: Record<ReplayKind | "own", string> = {
  rush: "absolute rounded-[8] border-[3] border-amber-300 shadow-lg",
  attack: "absolute rounded-[8] border-[3] border-amber-300 shadow-lg",
  strike: "absolute rounded-[8] border-[3] border-amber-300 shadow-lg",
  nc: "absolute rounded-[8] border-[3] border-cyan-300 shadow-lg",
  counter: "absolute rounded-[8] border-[3] border-violet-400 shadow-lg",
  operation: "absolute rounded-[8] border-[3] border-emerald-300 shadow-lg",
  effect: "absolute rounded-[8] border-[3] border-sky-300 shadow-lg",
  flip: "absolute rounded-[8] border-[3] border-rose-300 shadow-lg",
  own: "absolute rounded-[8] border-[3] border-sky-300 shadow-lg",
};
const CHIP: Record<ReplayKind, string> = {
  rush: "flex-row items-center px-[6] rounded-[6] bg-amber-300",
  attack: "flex-row items-center px-[6] rounded-[6] bg-amber-300",
  strike: "flex-row items-center px-[6] rounded-[6] bg-amber-300",
  nc: "flex-row items-center px-[6] rounded-[6] bg-cyan-300",
  counter: "flex-row items-center px-[6] rounded-[6] bg-violet-400",
  operation: "flex-row items-center px-[6] rounded-[6] bg-emerald-300",
  effect: "flex-row items-center px-[6] rounded-[6] bg-sky-300",
  flip: "flex-row items-center px-[6] rounded-[6] bg-rose-300",
};
const EDGE: Record<ReplayKind, string> = {
  rush: "absolute rounded-[3] bg-amber-300",
  attack: "absolute rounded-[3] bg-amber-300",
  strike: "absolute rounded-[3] bg-amber-300",
  nc: "absolute rounded-[3] bg-cyan-300",
  counter: "absolute rounded-[3] bg-violet-400",
  operation: "absolute rounded-[3] bg-emerald-300",
  effect: "absolute rounded-[3] bg-sky-300",
  flip: "absolute rounded-[3] bg-rose-300",
};
const LABEL: Record<ReplayKind, string> = {
  rush: "ラッシュ",
  attack: "アタック",
  strike: "ストライク",
  nc: "NC",
  counter: "カウンター",
  operation: "オペレーション",
  effect: "効果",
  flip: "ダメージ",
};

/** Where a card instance is drawn on the board now (null when it is not on a visible tile). */
export function tileOf(view: GuiView, instanceId: string | undefined): Box | null {
  if (!instanceId) return null;
  for (const row of view.rows) for (const tile of row.tiles) if (tile.instanceId === instanceId) return tile.rect;
  return null;
}

/** Where a card that the move took off the board stood (its row's slot, as the row scrolls now). */
export function slotRect(view: GuiView, at: ReplaySlot | undefined): Box | null {
  if (!at) return null;
  const index = view.rows.findIndex((row) => row.key === at.row);
  const row = view.rows[index];
  if (!row) return null;
  const slot = at.slot - row.moreLeft;
  if (slot < 0) return null;
  const r = tileRect(view.geometry, index, slot);
  return r.x + r.w <= row.rect.x + row.rect.w + 1 ? r : null;
}

/** The person's own move, or none: the board takes input. The other side's move holds input until it has been shown. */
export function replayHoldsInput(r: ReplayView | null): boolean {
  return !!r?.event && !r.event.own;
}

/** How far the board shakes (logical px) at this moment of a strike. */
export function replayShake(r: ReplayView | null): number {
  if (!r?.event || r.event.kind !== "strike") return 0;
  const s = seconds(r) - SLAM_HIT;
  return s > 0 && s < 0.3 ? Math.sin(s * 90) * 5 * (1 - s / 0.3) : 0;
}

/** The strike lifts the card for 0.35 s, slams it down in 0.12 s: the hit is then. */
const SLAM_HIT = 0.47;
/** The attacker reaches its target after this long. */
const CHARGE_HIT = 0.36;

const grow = (r: Box, by: number): Box => ({ x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 });
const place = (r: Box) => ({ insetL: r.x, insetT: r.y, width: r.w, height: r.h });

/** Where the toast goes: over the hand on a phone, between the two sides on a wider screen. */
function toastBox(view: GuiView): Box {
  const g = view.geometry;
  const rowOf = (key: string) => view.rows.find((row) => row.key === key)?.rect;
  if (isPortrait(g)) {
    const hand = rowOf("player1:hand") ?? g.board;
    const w = Math.min(g.width - 12, 380);
    return { x: Math.round((g.width - w) / 2), y: Math.round(hand.y + hand.h / 2 - 38), w, h: 76 };
  }
  const top = rowOf("player2:battle") ?? g.board;
  const bottom = rowOf("player1:battle") ?? g.board;
  const w = Math.min(460, g.board.w - 40);
  const mid = (top.y + top.h + bottom.y) / 2;
  return { x: Math.round(g.board.x + g.board.w - w - 20), y: Math.round(mid - 38), w, h: 76 };
}

function Glow(props: { rect: Box; kind: ReplayKind | "own"; t: number }) {
  // A slow pulse: the frame grows and shrinks by a pixel or two.
  const by = () => 3 + Math.abs(Math.sin(props.t * 4)) * 2;
  return <View class={GLOW[props.kind]} style={place(grow(props.rect, by()))} />;
}

/** A copy of the card drawn over the board (the real tile stays below, darkened while the copy is away). */
function Flying(props: { cardId: string; rect: Box; dx?: number; dy?: number; scale?: number; opacity?: number; kind: ReplayKind | "own" }) {
  return (
    <View class="absolute" style={{ ...place(props.rect), translateX: props.dx ?? 0, translateY: props.dy ?? 0, scale: props.scale ?? 1, opacity: props.opacity ?? 1 }}>
      <CardFace cardId={props.cardId} rect={{ x: 0, y: 0, w: props.rect.w, h: props.rect.h }} />
      <View class={GLOW[props.kind]} style={place({ x: -3, y: -3, w: props.rect.w + 6, h: props.rect.h + 6 })} />
    </View>
  );
}

const Hole = (props: { rect: Box }) => <View class="absolute rounded-[5] bg-[#05080fd8] border border-[#ffffff30]" style={place(props.rect)} />;

/** Rings spreading from a point (an impact). */
function Rings(props: { x: number; y: number; q: number; size: number; tone: "hit" | "slam" | "nc" }) {
  const ring = (k: number) => {
    const r = props.size * (0.3 + props.q * 1.4) * k;
    return { insetL: props.x - r, insetT: props.y - r, width: r * 2, height: r * 2, opacity: clamp(1 - props.q) };
  };
  const cls =
    props.tone === "nc"
      ? "absolute rounded-[999] border-[3] border-cyan-300"
      : props.tone === "slam"
        ? "absolute rounded-[999] border-[4] border-amber-300"
        : "absolute rounded-[999] border-[3] border-white";
  return (
    <Show when={props.q > 0 && props.q < 1}>
      <View class={cls} style={ring(1)} />
      <View class="absolute rounded-[999] border-[2] border-white" style={ring(0.62)} />
    </Show>
  );
}

function Toast(props: { view: GuiView; replay: ReplayView; event: ReplayEvent | null; text?: string }) {
  const box = () => toastBox(props.view);
  const fade = () => {
    const r = props.replay;
    if (!props.event) return 1;
    const s = seconds(r);
    const end = r.frames / 60;
    return Math.min(easeOut(s / 0.2), clamp((end - s) / 0.2));
  };
  const textW = () => box().w - (props.event ? 78 : 24);
  const title = () => fitLine(props.event?.title ?? props.text ?? "", { fontPx: 15, maxWidthPx: textW() });
  const detail = () => (props.event?.detail ? wrapText(props.event.detail, { fontPx: 11, maxWidthPx: textW() }).slice(0, 2) : []);
  const detailLines = () => {
    const lines = detail();
    if (lines.length === 2 && wrapText(props.event!.detail, { fontPx: 11, maxWidthPx: textW() }).length > 2) lines[1] = fitLine(`${lines[1]}…`, { fontPx: 11, maxWidthPx: textW() });
    return lines;
  };
  const who = () => (props.event?.actor === "player1" ? "あなた" : props.view.topBar.includes("CPU") ? "CPU" : "相手");
  return (
    <View class="absolute" style={{ ...place(box()), opacity: fade(), translateY: (1 - fade()) * 16 }}>
      <View class="absolute rounded-[12] bg-[#121622f5] border border-[#ffffff40] shadow-lg" style={place({ x: 0, y: 0, w: box().w, h: box().h })} />
      <Show when={props.event}>
        {(event) => (
          <>
            <View class={EDGE[event().kind]} style={place({ x: 0, y: 6, w: 5, h: box().h - 12 })} />
            <CardFace cardId={event().cardId} rect={{ x: 12, y: 8, w: 43, h: 60 }} />
            <View class="absolute flex-row items-center" style={place({ x: 66, y: 7, w: textW(), h: 16 })}>
              <View class={CHIP[event().kind]}>
                <Text class="text-xs text-slate-950 font-bold">{LABEL[event().kind]}</Text>
              </View>
              <Text class="text-xs text-rose-300 font-bold">{`  ${who()}の操作${props.replay.queued ? `（あと${props.replay.queued}）` : ""}`}</Text>
            </View>
          </>
        )}
      </Show>
      <View class="absolute flex-row items-center" style={place({ x: props.event ? 66 : 14, y: props.event ? 24 : 20, w: textW(), h: 20 })}>
        <Text class="text-sm text-white font-bold">{title()}</Text>
      </View>
      <Index each={detailLines()}>
        {(line, i) => (
          <View class="absolute flex-row items-center" style={place({ x: 66, y: 45 + i * 14, w: textW(), h: 14 })}>
            <Text class="text-xs text-slate-300">{line()}</Text>
          </View>
        )}
      </Index>
    </View>
  );
}

/** The middle of the board, where a counter / operation / flipped card shows big. */
function centre(view: GuiView): { x: number; y: number } {
  const g = view.geometry;
  const top = view.rows.find((row) => row.key === "player2:battle")?.rect ?? g.board;
  const bottom = view.rows.find((row) => row.key === "player1:battle")?.rect ?? g.board;
  return { x: g.board.x + g.board.w / 2, y: (top.y + top.h + bottom.y) / 2 };
}

function BigCard(props: { view: GuiView; event: ReplayEvent; t: number; banner: string | null; flip?: boolean }) {
  const c = () => centre(props.view);
  const baseW = () => (isPortrait(props.view.geometry) ? 120 : 150);
  // Pops in, stays, then shrinks away (a flip turns it over halfway instead).
  const pop = () => easeOut(props.t / 0.3);
  const out = () => clamp((props.t - 1.2) / 0.3);
  const flipQ = () => clamp((props.t - 0.5) / 0.5);
  const w = () => {
    const base = baseW() * (0.6 + 0.4 * pop()) * (1 - 0.5 * out());
    return props.flip ? Math.max(2, base * Math.abs(1 - 2 * flipQ())) : base;
  };
  const h = () => baseW() * (0.6 + 0.4 * pop()) * (1 - 0.5 * out()) * 1.4;
  const rect = () => ({ x: c().x - w() / 2, y: c().y - h() / 2, w: w(), h: h() });
  return (
    <Show when={out() < 1}>
      <View class="absolute" style={{ ...place(rect()), opacity: 1 - out() }}>
        <CardFace cardId={props.event.cardId} hidden={props.flip && flipQ() >= 0.5} rect={{ x: 0, y: 0, w: rect().w, h: rect().h }} />
        <View class={GLOW[props.event.kind]} style={place({ x: -4, y: -4, w: rect().w + 8, h: rect().h + 8 })} />
      </View>
      <Show when={props.banner}>
        <View
          class={props.event.kind === "counter" ? "absolute flex-row items-center justify-center rounded-[12] bg-violet-500" : "absolute flex-row items-center justify-center rounded-[12] bg-emerald-600"}
          style={{ ...place({ x: c().x - 70, y: c().y - h() / 2 - 32, w: 140, h: 26 }), opacity: 1 - out() }}
        >
          <Text class="text-sm text-white font-bold">{props.banner}</Text>
        </View>
      </Show>
    </Show>
  );
}

/** 「＋1 ダメージ」 rising from the strip of the side that was struck. */
function DamageText(props: { view: GuiView; player: "player1" | "player2"; t: number; text: string }) {
  const strip = () => props.view.geometry.strips[props.player === "player2" ? 0 : 1];
  const q = () => clamp((props.t - SLAM_HIT) / 1.0);
  return (
    <Show when={props.t > SLAM_HIT && q() < 1}>
      <View class="absolute rounded-[6] border-[3] border-rose-400" style={{ ...place(grow(strip(), 2)), opacity: 1 - q() }} />
      <View class="absolute flex-row items-center justify-center rounded-[8] bg-rose-600" style={{ ...place({ x: strip().x + strip().w / 2 - 60, y: strip().y - 4 - q() * 14, w: 120, h: 26 }), opacity: clamp((1 - q()) * 2) }}>
        <Text class="text-sm text-white font-bold">{props.text}</Text>
      </View>
    </Show>
  );
}

export function ReplayLayer(props: { view: GuiView; replay: ReplayView | null }) {
  const event = () => props.replay?.event ?? null;
  const t = () => (props.replay ? seconds(props.replay) : 0);
  const kind = (e: ReplayEvent): ReplayKind | "own" => (e.own ? "own" : e.kind);
  // A unit the move destroyed is drawn where it stood before.
  const sourceOnBoard = () => tileOf(props.view, event()?.instanceId);
  const source = () => sourceOnBoard() ?? slotRect(props.view, event()?.from);
  const target = () => tileOf(props.view, event()?.targetId) ?? slotRect(props.view, event()?.to);
  return (
    <>
      <Show when={event()}>
        {(e) => (
          <>
            {/* ラッシュ: the card drops into its slot. */}
            <Show when={e().kind === "rush" && source()}>
              {(r) => (
                <>
                  <Glow rect={r()} kind="rush" t={t()} />
                  <Show when={t() < 0.5}>
                    <Flying cardId={e().cardId} rect={r()} dy={-(1 - easeOut(t() / 0.45)) * 46} scale={1.5 - 0.5 * easeOut(t() / 0.45)} opacity={clamp(1.2 - t() / 0.45)} kind="rush" />
                  </Show>
                </>
              )}
            </Show>
            {/* NC / 効果: the card glows (NC: a ring spreads from it). */}
            <Show when={(e().kind === "nc" || e().kind === "effect") && source()}>
              {(r) => (
                <>
                  <Glow rect={r()} kind={e().kind} t={t()} />
                  <Show when={e().kind === "nc"}>
                    <Rings x={r().x + r().w / 2} y={r().y + r().h / 2} q={t() / 0.8} size={r().w} tone="nc" />
                  </Show>
                </>
              )}
            </Show>
            {/* アタック: the attacker flies into its target and comes back. */}
            <Show when={e().kind === "attack" && source()}>
              {(r) => {
                const back = () => (e().own ? 0.25 : 0.4);
                const reach = () => {
                  const to = target();
                  if (!to) return { dx: 0, dy: (e().actor === "player2" ? 1 : -1) * r().h * 0.5 };
                  const dx = to.x - r().x;
                  const dy = to.y - r().y;
                  const dist = Math.hypot(dx, dy) || 1;
                  const k = Math.max(0, dist - Math.min(r().w, r().h) * 0.55) / dist;
                  return { dx: dx * k, dy: dy * k };
                };
                const p = () => {
                  const s = t();
                  if (s < CHARGE_HIT) return Math.pow(clamp(s / CHARGE_HIT), 2.2);
                  if (s < CHARGE_HIT + 0.12) return 1;
                  return 1 - easeOut((s - CHARGE_HIT - 0.12) / back());
                };
                const shake = () => (t() > CHARGE_HIT && t() < CHARGE_HIT + 0.4 ? Math.sin(t() * 60) * 4 * (1 - (t() - CHARGE_HIT) / 0.4) : 0);
                return (
                  <>
                    <Show when={p() > 0.01 && sourceOnBoard()}>
                      <Hole rect={r()} />
                    </Show>
                    {/* A target the battle destroyed is drawn where it stood until the hit. */}
                    <Show when={!tileOf(props.view, e().targetId) && e().targetCardId && target() && t() < CHARGE_HIT + 0.5}>
                      <View class="absolute" style={{ ...place(target()!), opacity: clamp((CHARGE_HIT + 0.5 - t()) / 0.3) }}>
                        <CardFace cardId={e().targetCardId!} rect={{ x: 0, y: 0, w: target()!.w, h: target()!.h }} />
                      </View>
                    </Show>
                    <Show when={target()}>
                      {(to) => (
                        <Show when={t() > CHARGE_HIT && t() < CHARGE_HIT + 0.6}>
                          <View class="absolute rounded-[6] border-[3] border-rose-500 bg-[#ff3b3040]" style={{ ...place(grow(to(), 3)), translateX: shake() }} />
                        </Show>
                      )}
                    </Show>
                    <Flying cardId={e().cardId} rect={r()} dx={reach().dx * p()} dy={reach().dy * p()} scale={1 + 0.12 * Math.sin(clamp(t() / (CHARGE_HIT + 0.12)) * Math.PI)} kind={kind(e())} />
                    <Rings x={r().x + r().w / 2 + reach().dx} y={r().y + r().h / 2 + reach().dy * (target() ? 1.25 : 1)} q={(t() - CHARGE_HIT) / 0.4} size={r().w * 0.5} tone="hit" />
                  </>
                );
              }}
            </Show>
            {/* ストライク: the card is lifted and slammed down where it stands. */}
            <Show when={e().kind === "strike" && source()}>
              {(r) => {
                const lift = () => {
                  const s = t();
                  if (s < 0.35) return easeOut(s / 0.35);
                  if (s < SLAM_HIT) return 1 - Math.pow(clamp((s - 0.35) / (SLAM_HIT - 0.35)), 2);
                  return 0;
                };
                return (
                  <>
                    <Show when={lift() > 0 && sourceOnBoard()}>
                      <Hole rect={r()} />
                    </Show>
                    <Flying cardId={e().cardId} rect={r()} dy={-40 * lift()} scale={1 + 0.45 * lift()} kind={kind(e())} />
                    <Rings x={r().x + r().w / 2} y={r().y + r().h / 2} q={(t() - SLAM_HIT) / 0.55} size={r().w} tone="slam" />
                  </>
                );
              }}
            </Show>
            <Show when={e().kind === "strike" && e().targetPlayer}>
              {(player) => <DamageText view={props.view} player={player()} t={t()} text={e().damage ? `＋${e().damage} ダメージ` : "ダメージ無効"} />}
            </Show>
            {/* カウンター / オペレーション / a card no longer on the board: big in the middle. */}
            <Show when={e().kind === "counter" || e().kind === "operation" || (e().kind === "effect" && !source())}>
              <BigCard view={props.view} event={e()} t={t()} banner={e().kind === "counter" ? "カウンター！" : e().kind === "operation" ? "オペレーション" : null} />
            </Show>
            {/* ダメージ: the power card the other side picked turns face down. */}
            <Show when={e().kind === "flip"}>
              <BigCard view={props.view} event={e()} t={t()} banner={null} flip />
            </Show>
            <Show when={!e().own}>
              <Toast view={props.view} replay={props.replay!} event={e()} />
            </Show>
          </>
        )}
      </Show>
      <Show when={!event() && props.replay?.waiting}>
        {(text) => <Toast view={props.view} replay={props.replay!} event={null} text={text()} />}
      </Show>
    </>
  );
}
