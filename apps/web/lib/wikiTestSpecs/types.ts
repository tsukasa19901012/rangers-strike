import type { CardEffectMeta } from "@rangers-strike/cards";
import type { WebUiMechanism } from "../webUiEffectCoverage";
import type { OperationDropRoute } from "../webUiOperationRouting";

/** 完成版（wiki 準拠）カード単体テスト仕様 — full-playable 全カード対象。 */
export type WikiCardCompleteSpec = {
  cardId: string;
  wikiRef: string;
  name: string;
  cardType: "operation" | "unit" | "vehicle" | "commander";
  powerCost: number | string;
  category: string | string[];
  /** unit / vehicle のみ */
  bp?: number;
  sp?: string | number | null;
  size?: string;
  /** operation のみ */
  operationKind?: CardEffectMeta["kind"];
  /** catalog.text に含まれるべき文言（wiki atwiki 効果文由来） */
  textSnippets: string[];
  /** operation のみ */
  expectedMechanisms?: WebUiMechanism[];
  expectedDropRoute?: OperationDropRoute["kind"] | "n/a";
  /** DSL grant_keyword で期待するキーワード */
  expectedDslKeywords?: string[];
};

/** 完成版ルール E2E テスト仕様。 */
export type WikiRuleCompleteSpec = {
  ruleId: string;
  wikiRef: string;
  title: string;
  /** 検証観点の要約 */
  assertions: string[];
  /** 代表カード ID（シナリオ構築用、任意） */
  fixtureCardIds?: string[];
};
