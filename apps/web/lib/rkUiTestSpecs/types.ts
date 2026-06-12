import type { CardEffectMeta } from "@rangers-strike/cards";
import type { WebUiMechanism } from "../webUiEffectCoverage";
import type { OperationDropRoute } from "../webUiOperationRouting";

export type RkUiTestSpec = {
  cardId: string;
  /** docs/wiki/cards/RK-xxx.md */
  wikiRef: string;
  name: string;
  kind: CardEffectMeta["kind"];
  powerCost: number;
  category: string;
  /** catalog.text に含まれるべき文言（wiki atwiki 効果文由来） */
  textSnippets: string[];
  expectedMechanisms: WebUiMechanism[];
  /** instant のみ。permanent / counter は n/a */
  expectedDropRoute?: OperationDropRoute["kind"] | "n/a";
  /** DSL grant_keyword で期待するキーワード */
  expectedDslKeywords?: string[];
  /** エンジン / DSL 側の既知ギャップ（テストはドキュメント用に記録） */
  engineGaps?: string[];
};
