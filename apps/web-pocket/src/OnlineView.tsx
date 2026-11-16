// 対人戦のロビー（lobby.ts）の画面: タイトルの上に出す。部屋を作る・相手を待つ（招待 URL と QR）・招待から参加する。
import { Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { fitLine } from "@rangers-strike/client-core";
import type { Lobby } from "./lobby";
import type { FirstChoice } from "./online";
import { qrTexture } from "./qr";
import { TextureImage } from "./ui";

const FIRST: [FirstChoice, string][] = [
  ["random", "ランダム"],
  ["host", "自分が先攻"],
  ["guest", "相手が先攻"],
];

function Button(props: { label: string; width: number; primary?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <View
      focusable={!props.disabled}
      onPress={() => !props.disabled && props.onPress()}
      class={
        props.disabled
          ? "flex-row items-center justify-center h-[44] rounded-[22] bg-[#1e293b] border border-[#334155]"
          : props.primary
            ? "flex-row items-center justify-center h-[48] rounded-[24] bg-gradient-to-b from-sky-400 to-blue-700 border-[2] border-sky-300 focus:border-white"
            : "flex-row items-center justify-center h-[44] rounded-[22] bg-[#1e293b] border border-[#334155] focus:bg-[#2b3a55] focus:border-sky-400"
      }
      style={{ width: props.width }}
    >
      <Text class={props.disabled ? "text-sm text-slate-500" : props.primary ? "text-base text-white font-bold" : "text-sm text-slate-100"}>{props.label}</Text>
    </View>
  );
}

export function OnlineView(props: {
  lobby: Lobby;
  deckName: string;
  width: number;
  height: number;
  pickDeck: () => void;
  /** The deck chosen as 「あなたのデッキ」, as the room API takes it. */
  createDeck: () => import("./online").DeckSpec | { error: string };
}) {
  const s = () => props.lobby.state();
  const w = () => Math.min(480, props.width - 24);
  const iw = () => w() - 40;
  const qrSize = () => Math.min(200, iw(), Math.max(120, props.height - 360));
  const fit = (text: string, px = 14) => fitLine(text, { fontPx: px, maxWidthPx: iw() });
  return (
    <View class="absolute flex-col items-center justify-center bg-[#020617e0]" style={{ insetL: 0, insetT: 0, width: props.width, height: props.height }}>
      <View class="flex-col gap-3 p-[20] rounded-[16] bg-[#111a2e] border-[2] border-sky-500 shadow-lg" style={{ width: w() }}>
        <Text class="text-base text-sky-300 font-bold">対人戦（オンライン）</Text>

        <Show when={s().kind === "menu" ? (s() as Extract<ReturnType<typeof s>, { kind: "menu" }>) : null}>
          {(m) => (
            <>
              <Text class="text-xs text-slate-400">あなたのデッキ</Text>
              <View
                focusable
                onPress={props.pickDeck}
                class="flex-row items-center justify-between px-[14] h-[44] rounded-[10] bg-[#0b1220] border border-[#334155] focus:bg-[#13203a] focus:border-sky-400"
                style={{ width: iw() }}
              >
                <Text class="text-sm text-white">{fit(props.deckName)}</Text>
                <Text class="text-xs text-slate-400">▼</Text>
              </View>
              <Text class="text-xs text-slate-400">先攻・後攻</Text>
              <View class="flex-row gap-2">
                {FIRST.map(([choice, label]) => (
                  <View
                    focusable
                    onPress={() => props.lobby.setFirst(choice)}
                    class={
                      m().first === choice
                        ? "flex-row items-center justify-center h-[40] rounded-[10] bg-gradient-to-b from-sky-500 to-blue-700 border border-sky-300"
                        : "flex-row items-center justify-center h-[40] rounded-[10] bg-[#0b1220] border border-[#334155] focus:bg-[#13203a] focus:border-sky-400"
                    }
                    style={{ width: Math.floor((iw() - 16) / 3) }}
                  >
                    <Text class={m().first === choice ? "text-sm text-white font-bold" : "text-sm text-slate-300"}>{label}</Text>
                  </View>
                ))}
              </View>
              <Text class="text-xs text-slate-400">{fit("部屋を作ると招待 URL ができます。相手が開くと対戦開始です。", 12)}</Text>
              <Show when={m().error}>
                <Text class="text-sm text-amber-300">{fit(m().error ?? "")}</Text>
              </Show>
              <Button label={m().busy ? "作成中…" : "部屋を作る"} width={iw()} primary disabled={m().busy} onPress={() => props.lobby.create(props.createDeck())} />
              <Button label="閉じる" width={iw()} onPress={() => props.lobby.close()} />
            </>
          )}
        </Show>

        <Show when={s().kind === "waiting" ? (s() as Extract<ReturnType<typeof s>, { kind: "waiting" }>) : null}>
          {(m) => (
            <>
              <Text class="text-sm text-white">相手の参加を待っています…</Text>
              <View class="flex-row justify-center" style={{ width: iw() }}>
                <View class="overflow-hidden rounded-[6] bg-white" style={{ width: qrSize(), height: qrSize() }}>
                  <Show when={qrTexture(m().qr) >= 0} fallback={<Text class="text-sm text-slate-500">QR</Text>}>
                    <TextureImage texture={qrTexture(m().qr)} style={{ posType: 1, insetL: 0, insetT: 0, width: qrSize(), height: qrSize() }} />
                  </Show>
                </View>
              </View>
              <Text class="text-sm text-sky-200">{fit(m().url)}</Text>
              <Text class="text-xs text-slate-400">{fit("この URL か QR を相手に送ってください（このページは開いたままに）", 12)}</Text>
              <Show when={m().note}>
                <Text class="text-sm text-emerald-300">{m().note}</Text>
              </Show>
              <Button label="URLをコピー" width={iw()} primary onPress={() => props.lobby.copyInvite()} />
              <Button label="やめる" width={iw()} onPress={() => props.lobby.close()} />
            </>
          )}
        </Show>

        <Show when={s().kind === "join" ? (s() as Extract<ReturnType<typeof s>, { kind: "join" }>) : null}>
          {(m) => (
            <>
              <Text class="text-sm text-white">対戦に招待されました</Text>
              <Text class="text-xs text-slate-400">あなたのデッキ</Text>
              <View
                focusable
                onPress={props.pickDeck}
                class="flex-row items-center justify-between px-[14] h-[44] rounded-[10] bg-[#0b1220] border border-[#334155] focus:bg-[#13203a] focus:border-sky-400"
                style={{ width: iw() }}
              >
                <Text class="text-sm text-white">{fit(props.deckName)}</Text>
                <Text class="text-xs text-slate-400">▼</Text>
              </View>
              <Show when={m().error}>
                <Text class="text-sm text-amber-300">{fit(m().error ?? "")}</Text>
              </Show>
              <Button label={m().busy ? "参加中…" : "このデッキで参加する"} width={iw()} primary disabled={m().busy} onPress={() => props.lobby.join(props.createDeck())} />
              <Button label="やめる" width={iw()} onPress={() => props.lobby.close()} />
            </>
          )}
        </Show>

        <Show when={s().kind === "resuming"}>
          <Text class="text-sm text-white">前の対戦に戻っています…</Text>
        </Show>
      </View>
    </View>
  );
}
