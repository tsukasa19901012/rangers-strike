// Result screen after a match.
import { For, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { HUMAN, RemoteSession, fitLine, type AppController } from "@rangers-strike/client-core";
import { engine } from "./engine";
import type { PostGameRoom } from "./postGame";

/** How a 対人戦 ended, for the line under 勝利／敗北. */
function onlineReason(session: RemoteSession, won: boolean): string {
  const result = session.match.result;
  if (!result) return "";
  if (result.reason === "resign") return won ? "相手が投了しました" : "投了しました";
  if (result.reason === "timeout") return won ? "相手の時間切れ3回" : "時間切れ3回";
  if (result.reason === "void") return "無効試合になりました（サーバーの問題で対戦を続けられませんでした）";
  return "";
}

/** A revealed deck as 「×枚数 名前」 lines (the count first, so a cut-off long name keeps it), in deck order. */
function deckLines(ids: readonly string[]): string[] {
  const names = new Map(engine.deckApi.cards.map((c) => [c.id, c.name]));
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => `×${n} ${names.get(id) ?? id}`);
}

function ResultButton(props: { label: string; width: number; disabled?: boolean; onPress: () => void }) {
  return (
    <View
      focusable={!props.disabled}
      onPress={() => !props.disabled && props.onPress()}
      class={
        props.disabled
          ? "flex-row items-center justify-center h-[44] rounded-[22] bg-[#1e293b] border border-[#334155]"
          : "flex-row items-center justify-center h-[44] rounded-[22] bg-[#1e293b] border border-sky-500 focus:bg-[#2b3a55] focus:border-white"
      }
      style={{ width: props.width }}
    >
      <Text class={props.disabled ? "text-sm text-slate-400" : "text-sm text-sky-100"}>{fitLine(props.label, { fontPx: 14, maxWidthPx: props.width - 24 })}</Text>
    </View>
  );
}

export function ResultView(props: { controller: AppController; width: number; onBack: () => void; postGame?: PostGameRoom }) {
  const session = () => props.controller.session;
  const won = () => session()?.winner === HUMAN;
  const remote = () => {
    const s = session();
    return s instanceof RemoteSession ? s : null;
  };
  const voided = () => remote()?.match.result?.reason === "void";
  return (
    <View class="w-full h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#0f1b33] to-[#04070d]">
      <View
        class={
          won()
            ? "flex-col items-center gap-3 p-[32] rounded-[20] bg-gradient-to-b from-[#3b2a07] to-[#111a2e] border-[2] border-amber-400 shadow-lg"
            : "flex-col items-center gap-3 p-[32] rounded-[20] bg-gradient-to-b from-[#2a0b12] to-[#111a2e] border-[2] border-rose-500 shadow-lg"
        }
        style={{ width: Math.min(520, props.width - 32) }}
      >
        <Text class={won() ? "text-xl text-amber-300 font-bold" : "text-xl text-rose-300 font-bold"}>{voided() ? "無効試合" : won() ? "勝利！" : "敗北…"}</Text>
        <Show when={session()}>
          {(s) => (
            <>
              <Text class="text-sm text-slate-300">{`${s().state.turn}ターンで決着`}</Text>
              <Show
                when={remote()}
                fallback={<Text class="text-xs text-slate-400">{`CPU思考 平均${s().metrics.avgThinkMs.toFixed(1)}ms / ${s().metrics.moves}手`}</Text>}
              >
                {(r) => <Text class="text-sm text-slate-300">{onlineReason(r(), won())}</Text>}
              </Show>
            </>
          )}
        </Show>
        <Show when={remote() && props.postGame ? props.postGame : null}>
          {(pg) => {
            const post = () => pg().state().post;
            const revealLabel = () => {
              const r = post()?.reveal;
              if (r?.you) return "公開に同意しました（相手の同意待ち）";
              return r?.them ? "相手がデッキの公開に同意しています。公開する" : "お互いのデッキを公開する";
            };
            const deck = () => post()?.reveal.deck;
            const lines = () => {
              const d = deck();
              return d ? deckLines(d) : [];
            };
            const MAX_ROWS = 20;
            const columns = (): string[][] => {
              const all = lines();
              if (all.length <= 12) return [all];
              const rows = Math.min(MAX_ROWS, Math.ceil(all.length / 2));
              const shown = all.slice(0, rows * 2);
              if (all.length > shown.length) shown[shown.length - 1] = `…ほか${all.length - shown.length + 1}種`;
              return [shown.slice(0, rows), shown.slice(rows)];
            };
            const columnWidth = () => {
              const w = Math.min(456, props.width - 96);
              return columns().length > 1 ? Math.floor((w - 8) / 2) : w;
            };
            return (
              <>
                {/* 再戦（API の op:"rematch"、postGame.rematch）は初版では画面に出さない（2026-11-17 ユーザー判断）。 */}
                <Show
                  when={deck()}
                  fallback={<ResultButton label={revealLabel()} width={280} disabled={!!post()?.reveal.you || pg().state().busy} onPress={() => pg().reveal()} />}
                >
                  <View class="flex-col gap-1" style={{ width: Math.min(456, props.width - 96) }}>
                    <Text class="text-sm text-sky-300 font-bold">{`相手のデッキ（${deck()!.length}枚）`}</Text>
                    {/* Over 12 kinds the list goes into two columns (a 40-kind custom deck still fits the screen). */}
                    <View class="flex-row gap-2">
                      <For each={columns()}>
                        {(column) => (
                          <View class="flex-col" style={{ width: columnWidth() }}>
                            <For each={column}>{(line) => <Text class="text-xs text-slate-200">{fitLine(line, { fontPx: 12, maxWidthPx: columnWidth() })}</Text>}</For>
                          </View>
                        )}
                      </For>
                    </View>
                  </View>
                </Show>
                <Show when={pg().state().error}>
                  <Text class="text-sm text-amber-300">{pg().state().error}</Text>
                </Show>
              </>
            );
          }}
        </Show>
        <View
          focusable
          onPress={props.onBack}
          class="flex-row items-center justify-center h-[48] rounded-[24] bg-gradient-to-b from-sky-400 to-blue-700 border-[2] border-sky-300 focus:border-white"
          style={{ width: 280 }}
        >
          <Text class="text-base text-white font-bold">タイトルへ戻る</Text>
        </View>
      </View>
    </View>
  );
}
