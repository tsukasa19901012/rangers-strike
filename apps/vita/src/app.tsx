// Thin PocketJS view/input layer over @rangers-strike/client-core.
// - input: Vita buttons -> logical inputs (ButtonRepeater), front touch ->
//   TapRecognizer + hitTest. No game logic here.
// - view: draws ScreenView; pane sizes come from the core layout.
import { createSignal, Index } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { BTN, touches } from "@pocketjs/framework/input";
import { getOps } from "@pocketjs/framework/solid";
import {
  AppController,
  ButtonRepeater,
  TapRecognizer,
  hitTest,
  input,
  type ScreenView,
} from "@rangers-strike/client-core";
import { vitaPlatform } from "./platform";

/** Japanese layout: ○ = confirm, × = cancel. D-pad left/right page; L/R switch tabs. */
const BINDINGS = [
  { mask: BTN.UP, input: input.prev, repeat: true },
  { mask: BTN.DOWN, input: input.next, repeat: true },
  { mask: BTN.LEFT, input: input.pagePrev, repeat: true },
  { mask: BTN.RIGHT, input: input.pageNext, repeat: true },
  { mask: BTN.CIRCLE, input: input.confirm },
  { mask: BTN.CROSS, input: input.cancel },
  { mask: BTN.LTRIGGER, input: input.tabPrev },
  { mask: BTN.RTRIGGER, input: input.tabNext },
  { mask: BTN.TRIANGLE, input: input.tabNext },
  { mask: BTN.START, input: input.confirm },
];

// Class literals must be complete strings (PocketJS bakes them at build time).
// The Vita shell pins the core layout to 12px so only two font atlases
// (12px regular/bold) are baked; ~1,170 Japanese glyphs each.
const TEXT = {
  12: { body: "text-xs text-slate-100", dim: "text-xs text-slate-400", accent: "text-xs text-amber-300", head: "text-xs text-white font-bold", sel: "text-xs text-white font-bold", tab: "text-xs text-slate-400", tabOn: "text-xs text-sky-300 font-bold" },
} as const;
const PAD: Record<number, string> = { 3: "flex-col overflow-hidden p-[3]", 6: "flex-col overflow-hidden p-[6]" };

function readViewport(): { width: number; height: number } {
  try {
    const vp = (getOps() as unknown as { __viewport?: { w: number; h: number } }).__viewport;
    if (vp && vp.w > 0 && vp.h > 0) return { width: vp.w, height: vp.h };
  } catch {
    // console hosts: the spec screen is the viewport
  }
  return { width: 480, height: 272 };
}

export default function App() {
  let viewport = readViewport();
  const controller = new AppController({ platform: vitaPlatform, viewport, fontPx: 12, cpuDelayFrames: 10 });
  const [view, setView] = createSignal<ScreenView>(controller.view(), { equals: false });
  const repeater = new ButtonRepeater(BINDINGS);
  const taps = new TapRecognizer();
  let frame = 0;

  onFrame((buttons) => {
    let changed = false;
    for (const event of repeater.frame(buttons)) {
      controller.dispatch(event);
      changed = true;
    }
    const contact = touches()[0];
    const tap = taps.frame(contact ? { x: contact.x, y: contact.y } : null);
    if (tap) {
      const event = hitTest(controller.view(), tap);
      if (event) {
        controller.dispatch(event);
        changed = true;
      }
    }
    if (controller.tick()) changed = true;
    if (++frame % 30 === 0) {
      const next = readViewport();
      if (next.width !== viewport.width || next.height !== viewport.height) {
        viewport = next;
        controller.setViewport(next);
        changed = true;
      }
    }
    if (changed) setView(controller.view());
  });

  const L = () => view().layout;
  const T = () => TEXT[12];
  const line = () => ({ height: L().lineHeight });

  return (
    <View class="w-full h-full flex-col bg-slate-950">
      <View class="flex-row items-center px-[3] bg-slate-800" style={{ width: L().header.w, height: L().header.h }}>
        <Text class={T().head}>{view().header}</Text>
      </View>
      <View class={L().orientation === "landscape" ? "flex-row" : "flex-col"}>
        <View class={PAD[L().padding] ?? PAD[3]!} style={{ width: L().info.w, height: L().info.h }}>
          <View class="flex-row gap-2" style={line()}>
            <Index each={view().tabs}>
              {(tab, i) => <Text class={i === view().activeTab ? T().tabOn : T().tab}>{tab()}</Text>}
            </Index>
          </View>
          <Index each={view().infoLines}>
            {(text) => (
              <View style={line()}>
                <Text class={T().body}>{text()}</Text>
              </View>
            )}
          </Index>
        </View>
        <View class={PAD[L().padding] ?? PAD[3]!} style={{ width: L().side.w, height: L().side.h }}>
          <Index each={view().promptLines}>
            {(text) => (
              <View style={line()}>
                <Text class={T().accent}>{text()}</Text>
              </View>
            )}
          </Index>
          <View style={line()}>
            <Text class={T().dim}>{view().rows.length ? `操作 ${view().rowsCaption}  ○決定 ×パス` : view().busy ? "" : "-"}</Text>
          </View>
          <Index each={view().rows}>
            {(row) => (
              <View class={row().selected ? "flex-row bg-blue-700 rounded-[2px]" : "flex-row"} style={line()}>
                <Text class={row().selected ? T().sel : T().body}>{row().text}</Text>
              </View>
            )}
          </Index>
        </View>
      </View>
      <View class="flex-row items-center px-[3] bg-slate-800" style={{ width: L().footer.w, height: L().footer.h }}>
        <Text class={T().dim}>{view().footer}</Text>
      </View>
    </View>
  );
}
