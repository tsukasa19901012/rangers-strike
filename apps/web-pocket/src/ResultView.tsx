// Result screen after a match.
import { Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { HUMAN, RemoteSession, type AppController } from "@rangers-strike/client-core";

/** How a 対人戦 ended, for the line under 勝利／敗北. */
function onlineReason(session: RemoteSession, won: boolean): string {
  const result = session.match.result;
  if (!result) return "";
  if (result.reason === "resign") return won ? "相手が投了しました" : "投了しました";
  if (result.reason === "timeout") return won ? "相手の時間切れ3回" : "時間切れ3回";
  if (result.reason === "void") return "無効試合になりました（サーバーの問題で対戦を続けられませんでした）";
  return "";
}

export function ResultView(props: { controller: AppController; width: number; onBack: () => void }) {
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
