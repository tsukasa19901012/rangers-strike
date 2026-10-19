import type { CardDefinition } from "@rangers-strike/cards";
import type {
  GameState,
  PlayerId,
  RevealDestination,
  RevealNotice,
} from "@rangers-strike/engine";

const DESTINATION_LABELS: Record<RevealDestination, string> = {
  hand: "手札に加えた",
  deck_top: "山札の上に戻した",
  deck_bottom: "山札の下に戻した",
  discard: "捨札にした",
  rush: "ラッシュエリアに出した",
  power: "パワーゾーンに置いた",
  command: "コマンドゾーンに置いた",
  deck_shuffle: "山札に戻してシャッフルした",
  stay: "そのまま",
};

const FROM_LABELS: Record<RevealNotice["from"], string> = {
  deck_top: "山札の上",
  deck_bottom: "山札の下",
  hand: "手札",
  power: "パワーゾーン",
  discard: "捨札",
};

export type RevealNoticeCardView = {
  instanceId: string;
  cardId: string;
  name: string;
  /** 必要パワー（印刷どおり。無ければ「-」）。 */
  powerCostText: string;
  destinationLabel: string;
};

export type RevealNoticeView = {
  seq: number;
  title: string;
  /** 例: 「相手が山札の下から1枚オモテにしました」 */
  summary: string;
  /** 例: 「宣言した数字: 3 → 一致」。宣言しない効果は undefined。 */
  declaredText?: string;
  cards: RevealNoticeCardView[];
};

/** 前回表示した seq より新しい公開があればそれを返す（無ければ null）。 */
export function pickNewReveal(
  state: Pick<GameState, "lastReveal"> | null | undefined,
  lastShownSeq: number,
): RevealNotice | null {
  const reveal = state?.lastReveal;
  if (!reveal || reveal.seq <= lastShownSeq) return null;
  return reveal;
}

function powerCostText(def: CardDefinition | undefined): string {
  const cost = def?.powerCost;
  if (cost === undefined || cost === null || cost === "") return "-";
  return String(cost);
}

/** 公開カードの表示用データ。両プレイヤーに同じ内容を見せる（公開情報）。 */
export function buildRevealNoticeView(
  reveal: RevealNotice,
  definitions: Record<string, CardDefinition>,
  viewerId: PlayerId,
): RevealNoticeView {
  const actor = reveal.playerId === viewerId ? "自分" : "相手";
  const mutual = reveal.cards.some((c) => c.ownerId !== undefined && c.ownerId !== reveal.ownerId);
  const owner = mutual
    ? "お互いの"
    : reveal.ownerId === reveal.playerId
      ? ""
      : reveal.ownerId === viewerId
        ? "自分の"
        : "相手の";
  const count = reveal.cards.length;
  const summary = `${actor}が${owner}${FROM_LABELS[reveal.from]}から${count}枚オモテにしました`;
  let declaredText: string | undefined;
  if (reveal.declaredNumber !== undefined) {
    const result =
      reveal.matched === undefined ? "" : reveal.matched ? " → 一致" : " → 不一致";
    declaredText = `宣言した数字: ${reveal.declaredNumber}${result}`;
  }
  return {
    seq: reveal.seq,
    title: `【${reveal.effectLabel}】公開`,
    summary,
    declaredText,
    cards: reveal.cards.map((c) => {
      const def = definitions[c.cardId];
      return {
        instanceId: c.instanceId,
        cardId: c.cardId,
        name: def?.name ?? c.cardId,
        powerCostText: powerCostText(def),
        destinationLabel: DESTINATION_LABELS[c.destination] ?? c.destination,
      };
    }),
  };
}
