// The automatic-move settings (自動進行, the start phase and its step order),
// opened from the title screen and from the match screen. Drawn at fixed
// rectangles; the app hit-tests clicks against them (settingsHit), so it works
// the same over the match, whose input is not focus-based.
import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { START_ORDERS, START_STEP_LABELS, startOrder, type AppController, type Settings, type StartStep } from "@rangers-strike/client-core";
import { at, inside, type Box } from "./ui";

export type SettingsAction = { type: "assist" } | { type: "start" } | { type: "order"; order: readonly StartStep[] } | { type: "close" };

type Row = { rect: Box; label: string; note?: string; on?: boolean; selected?: boolean; dimmed?: boolean; action: SettingsAction };

export type SettingsLayout = { frame: Box; title: Box; orderTitle: Box; rows: Row[]; close: Box };

const TOGGLE_H = 48;
const ORDER_H = 38;

export function settingsLayout(width: number, height: number, settings: Readonly<Settings>): SettingsLayout {
  const w = Math.min(520, width - 24);
  const h = 16 + 30 + (TOGGLE_H + 8) * 2 + 30 + START_ORDERS.length * (ORDER_H + 4) + 12 + 40 + 16;
  const frame: Box = { x: Math.round((width - w) / 2), y: Math.max(8, Math.round((height - h) / 2)), w, h };
  const x = frame.x + 16;
  const iw = w - 32;
  let y = frame.y + 16;
  const title: Box = { x, y, w: iw, h: 26 };
  y += 30;
  const assist = settings.autoAssist ?? true;
  const start = settings.autoStart ?? true;
  const current = startOrder(settings.startOrder);
  const rows: Row[] = [
    { rect: { x, y, w: iw, h: TOGGLE_H }, label: "自動進行", note: "何もないフェイズ・1通りの支払いを自動で", on: assist, action: { type: "assist" } },
    {
      rect: { x, y: y + TOGGLE_H + 8, w: iw, h: TOGGLE_H },
      label: "スタートフェイズ自動",
      note: assist ? "リリース・戻す・ドローを自動で" : "自動進行が OFF のため使われません",
      on: assist && start,
      dimmed: !assist,
      action: { type: "start" },
    },
  ];
  y += (TOGGLE_H + 8) * 2;
  const orderTitle: Box = { x, y, w: iw, h: 26 };
  y += 30;
  START_ORDERS.forEach((order, i) => {
    rows.push({
      rect: { x, y: y + i * (ORDER_H + 4), w: iw, h: ORDER_H },
      label: order.map((step) => START_STEP_LABELS[step]).join(" → "),
      selected: order === current,
      dimmed: !(assist && start),
      action: { type: "order", order },
    });
  });
  y += START_ORDERS.length * (ORDER_H + 4) + 12;
  const close: Box = { x: frame.x + Math.round((w - 160) / 2), y, w: 160, h: 40 };
  return { frame, title, orderTitle, rows, close };
}

/** What a click at `p` does: a row, the close button, or (outside the panel) closing it. */
export function settingsHit(layout: SettingsLayout, p: { x: number; y: number }): SettingsAction | null {
  if (inside(layout.close, p) || !inside(layout.frame, p)) return { type: "close" };
  return layout.rows.find((row) => inside(row.rect, p))?.action ?? null;
}

/** Applies a row's change (the controller saves it and updates a running match). */
export function applySettingsAction(controller: AppController, action: SettingsAction): void {
  const s = controller.matchSettings;
  if (action.type === "assist") controller.updateSettings({ autoAssist: !(s.autoAssist ?? true) });
  else if (action.type === "start") controller.updateSettings({ autoStart: !(s.autoStart ?? true) });
  else if (action.type === "order") controller.updateSettings({ startOrder: [...action.order] });
}

export function SettingsPanel(props: { layout: SettingsLayout; width: number; height: number; hot: number }) {
  const l = () => props.layout;
  return (
    <>
      <View class="absolute bg-[#020617d0]" style={at({ x: 0, y: 0, w: props.width, h: props.height })} />
      <View class="absolute rounded-[16] bg-[#111a2e] border-[2] border-sky-500 shadow-lg" style={at(l().frame)} />
      <View class="absolute flex-row items-center" style={at(l().title)}>
        <Text class="text-base text-sky-300 font-bold">自動進行の設定</Text>
      </View>
      <View class="absolute flex-row items-center" style={at(l().orderTitle)}>
        <Text class="text-sm text-slate-300 font-bold">スタートフェイズの順番</Text>
      </View>
      <Index each={l().rows}>
        {(row, i) => (
          <View
            class={
              row().selected
                ? "absolute flex-row items-center justify-between px-[14] rounded-[10] bg-gradient-to-r from-sky-600 to-blue-700 border border-sky-300"
                : props.hot === i
                  ? "absolute flex-row items-center justify-between px-[14] rounded-[10] bg-[#13203a] border border-sky-400"
                  : "absolute flex-row items-center justify-between px-[14] rounded-[10] bg-[#0b1220] border border-[#334155]"
            }
            style={at(row().rect)}
          >
            <View class="flex-col">
              <Text class={row().dimmed && !row().selected ? "text-sm text-slate-500" : "text-sm text-white"}>{row().label}</Text>
              <Show when={row().note}>{(note) => <Text class="text-xs text-slate-400">{note()}</Text>}</Show>
            </View>
            <Show when={row().on !== undefined}>
              <Text class={row().on ? "text-sm text-sky-300 font-bold" : "text-sm text-slate-500 font-bold"}>{row().on ? "ON" : "OFF"}</Text>
            </Show>
            <Show when={row().selected}>
              <Text class="text-sm text-white font-bold">選択中</Text>
            </Show>
          </View>
        )}
      </Index>
      <View
        class={props.hot === -2 ? "absolute flex-row items-center justify-center rounded-[10] bg-slate-600 border border-slate-400" : "absolute flex-row items-center justify-center rounded-[10] bg-[#1e293b] border border-[#334155]"}
        style={at(l().close)}
      >
        <Text class="text-sm text-slate-100">閉じる</Text>
      </View>
    </>
  );
}
