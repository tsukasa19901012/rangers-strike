// Title screen: pick both decks and the CPU level, start a match or open the
// deck builder. Built from flex layout and focusable views: the framework's
// desktop pointer gives hover (focus) and click (onPress) to every button.
import { createSignal, For, Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { START_STEP_LABELS, startOrder, type AppController, type DeckChoice, type ScreenView, type Settings } from "@rangers-strike/client-core";
import { engine } from "./engine";

const PICKER_PAGE = 12;

type Props = {
  controller: AppController;
  /** Read to re-render when the controller changed. */
  view: () => ScreenView;
  refresh: () => void;
  width: number;
  height: number;
  /** Opens the automatic-move settings (SettingsPanel). */
  openSettings: () => void;
};

function SelectButton(props: { label: string; value: string; width: number; onPress: () => void }) {
  return (
    <View class="flex-col gap-1">
      <Text class="text-xs text-slate-400">{props.label}</Text>
      <View
        focusable
        onPress={props.onPress}
        class="flex-row items-center justify-between px-[14] h-[44] rounded-[10] bg-[#0b1220] border border-[#334155] focus:bg-[#13203a] focus:border-sky-400"
        style={{ width: props.width }}
      >
        <Text class="text-sm text-white">{props.value}</Text>
        <Text class="text-xs text-slate-400">▼</Text>
      </View>
    </View>
  );
}

/** One line on the automatic-move settings for the title screen. */
function assistSummary(s: Readonly<Settings>): string {
  if (!(s.autoAssist ?? true)) return "自動進行 OFF";
  if (!(s.autoStart ?? true)) return "自動進行 ON / スタートフェイズは手動";
  return `自動進行 ON / スタート: ${startOrder(s.startOrder).map((step) => START_STEP_LABELS[step]).join("→")}`;
}

export function TitleView(props: Props) {
  const c = props.controller;
  const [picking, setPicking] = createSignal<"humanDeck" | "cpuDeck" | null>(null);
  const [page, setPage] = createSignal(0);
  const settings = () => (props.view(), c.matchSettings);
  const choices = () => (props.view(), c.deckChoices());
  const nameOf = (id: string) => choices().find((d) => d.id === id)?.name ?? id;
  const pages = () => Math.max(1, Math.ceil(choices().length / PICKER_PAGE));
  const records = () => (props.view(), c.matchRecords().slice(0, 4));
  // Fixed widths for a desktop window, narrowed to fit a phone held upright.
  const panelW = () => Math.min(480, props.width - 32);
  const pickerW = () => Math.min(760, props.width - 24);
  const deckW = () => (pickerW() < 600 ? pickerW() - 40 : 356);

  const openPicker = (which: "humanDeck" | "cpuDeck") => {
    const index = choices().findIndex((d) => d.id === settings()[which]);
    setPage(Math.max(0, Math.floor(index / PICKER_PAGE)));
    setPicking(which);
  };
  const pick = (deck: DeckChoice) => {
    const which = picking();
    if (which) c.updateSettings({ [which]: deck.id });
    setPicking(null);
    props.refresh();
  };

  return (
    <View class="w-full h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#0f1b33] to-[#04070d]">
      <Text class="text-xl text-sky-300 font-bold">レンジャーズストライク</Text>
      <Text class="text-sm text-slate-400">{`全カード（${engine.deckApi.cards.length}枚）— CPU対戦（Lv1〜5）`}</Text>

      <View class="flex-col gap-4 p-[20] rounded-[16] bg-[#111a2e] border border-[#25324d] shadow-lg" style={{ width: panelW() }}>
        <Text class="text-xs text-slate-400 font-bold">対戦設定</Text>
        <SelectButton label="あなたのデッキ" width={panelW() - 40} value={nameOf(settings().humanDeck)} onPress={() => openPicker("humanDeck")} />
        <SelectButton label="CPUのデッキ" width={panelW() - 40} value={nameOf(settings().cpuDeck)} onPress={() => openPicker("cpuDeck")} />
        <View class="flex-col gap-1">
          <Text class="text-xs text-slate-400">CPUレベル</Text>
          <View class="flex-row gap-2">
            <Index each={[1, 2, 3, 4, 5]}>
              {(level) => (
                <View
                  focusable
                  onPress={() => {
                    c.updateSettings({ cpuLevel: level() });
                    props.refresh();
                  }}
                  class={
                    settings().cpuLevel === level()
                      ? "flex-row items-center justify-center h-[40] rounded-[10] bg-gradient-to-b from-sky-500 to-blue-700 border border-sky-300"
                      : "flex-row items-center justify-center h-[40] rounded-[10] bg-[#0b1220] border border-[#334155] focus:bg-[#13203a] focus:border-sky-400"
                  }
                  style={{ width: Math.floor((panelW() - 40 - 4 * 8) / 5) }}
                >
                  <Text class={settings().cpuLevel === level() ? "text-sm text-white font-bold" : "text-sm text-slate-300"}>{`Lv${level()}`}</Text>
                </View>
              )}
            </Index>
          </View>
        </View>
        <View
          focusable
          onPress={props.openSettings}
          class="flex-row items-center justify-between px-[14] h-[48] rounded-[10] bg-[#0b1220] border border-[#334155] focus:bg-[#13203a] focus:border-sky-400"
          style={{ width: panelW() - 40 }}
        >
          <View class="flex-col">
            <Text class="text-sm text-white">自動進行の設定</Text>
            <Text class="text-xs text-slate-400">{assistSummary(settings())}</Text>
          </View>
          <Text class="text-xs text-slate-400">▶</Text>
        </View>
      </View>

      <View class="flex-col gap-3 items-center" style={{ width: panelW() }}>
        <View
          focusable
          onPress={() => {
            c.startMatch();
            props.refresh();
          }}
          class="flex-row items-center justify-center h-[52] rounded-[26] bg-gradient-to-b from-sky-400 to-blue-700 border-[2] border-sky-300 shadow-lg focus:border-white"
          style={{ width: panelW() }}
        >
          <Text class="text-base text-white font-bold">ゲーム開始</Text>
        </View>
        <View
          focusable
          onPress={() => {
            c.openDeckBuilder();
            props.refresh();
          }}
          class="flex-row items-center justify-center h-[44] rounded-[22] bg-[#1e293b] border border-[#334155] focus:bg-[#2b3a55] focus:border-sky-400"
          style={{ width: panelW() }}
        >
          <Text class="text-sm text-slate-100">デッキを作る</Text>
        </View>
        <Show when={c.notice}>
          <Text class="text-sm text-amber-300">{(props.view(), c.notice)}</Text>
        </Show>
      </View>

      <Show when={records().length > 0}>
        <View class="flex-col gap-1 items-center" style={{ width: panelW() }}>
          <Text class="text-xs text-slate-500 font-bold">最近の対戦</Text>
          <For each={records()}>
            {(r) => (
              <Text class="text-xs text-slate-400">
                {`${r.winner === "player1" ? "勝ち" : r.winner ? "負け" : "-"}  ${nameOf(r.humanDeck)} vs ${nameOf(r.cpuDeck)}  ${r.turns}ターン`}
              </Text>
            )}
          </For>
        </View>
      </Show>

      {/* deck picker */}
      <Show when={picking()}>
        <View class="absolute flex-col items-center justify-center bg-[#020617d0]" style={{ insetL: 0, insetT: 0, width: props.width, height: props.height }}>
          <View class="flex-col gap-3 p-[20] rounded-[16] bg-[#111a2e] border-[2] border-sky-500 shadow-lg" style={{ width: pickerW() }}>
            <View class="flex-row items-center justify-between">
              <Text class="text-base text-sky-300 font-bold">{picking() === "humanDeck" ? "あなたのデッキを選ぶ" : "CPUのデッキを選ぶ"}</Text>
              <View
                focusable
                onPress={() => setPicking(null)}
                class="flex-row items-center justify-center h-[32] rounded-[8] bg-[#1e293b] border border-[#334155] focus:border-sky-400"
                style={{ width: 96 }}
              >
                <Text class="text-sm text-slate-200">閉じる</Text>
              </View>
            </View>
            <View class="flex-row flex-wrap gap-2">
              <For each={choices().slice(page() * PICKER_PAGE, (page() + 1) * PICKER_PAGE)}>
                {(deck) => {
                  const current = () => picking() !== null && settings()[picking()!] === deck.id;
                  return (
                    <View
                      focusable
                      onPress={() => pick(deck)}
                      class={
                        current()
                          ? "flex-row items-center gap-2 px-[12] h-[44] rounded-[10] bg-gradient-to-r from-sky-600 to-blue-700 border border-sky-300"
                          : "flex-row items-center gap-2 px-[12] h-[44] rounded-[10] bg-[#0b1220] border border-[#334155] focus:bg-[#13203a] focus:border-sky-400"
                      }
                      style={{ width: deckW() }}
                    >
                      <Show when={deck.custom}>
                        <View class="flex-row items-center px-[6] h-[20] rounded-[4] bg-amber-500">
                          <Text class="text-xs text-slate-950 font-bold">自作</Text>
                        </View>
                      </Show>
                      <Text class={current() ? "text-sm text-white font-bold" : "text-sm text-slate-100"}>{deck.custom ? deck.name.replace(/^自作: /, "") : deck.name}</Text>
                    </View>
                  );
                }}
              </For>
            </View>
            <View class="flex-row items-center justify-between">
              <View
                focusable
                onPress={() => setPage(Math.max(0, page() - 1))}
                class="flex-row items-center justify-center h-[32] rounded-[8] bg-[#1e293b] border border-[#334155] focus:border-sky-400"
                style={{ width: 120 }}
              >
                <Text class="text-sm text-slate-200">‹ 前へ</Text>
              </View>
              <Text class="text-sm text-slate-400">{`${page() + 1} / ${pages()}`}</Text>
              <View
                focusable
                onPress={() => setPage(Math.min(pages() - 1, page() + 1))}
                class="flex-row items-center justify-center h-[32] rounded-[8] bg-[#1e293b] border border-[#334155] focus:border-sky-400"
                style={{ width: 120 }}
              >
                <Text class="text-sm text-slate-200">次へ ›</Text>
              </View>
            </View>
          </View>
        </View>
      </Show>
    </View>
  );
}
