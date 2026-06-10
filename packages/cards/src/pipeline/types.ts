import type { CardDocument, EffectDefinition, ValidationResult } from "../dsl/types";

export type WikiSegmentKind = "named" | "note" | "body";

export type WikiEffectSegment = {
  kind: WikiSegmentKind;
  name?: string;
  body: string;
};

export type WikiStatus = {
  種類?: string;
  カテゴリ?: string;
  BP?: string;
  SP?: string;
  必要パワー?: string;
  追加条件?: string;
  CN?: string;
  特徴?: string;
  収録?: string;
  作品?: string;
};

export type WikiParseResult = {
  cardId: string;
  name: string;
  categoryLabel?: string;
  featuresLabel?: string;
  expansionLabel?: string;
  effectTexts: string[];
  segments: WikiEffectSegment[];
  status: WikiStatus;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  sourcePath: string;
};

export type CardAnalysis = {
  cardId: string;
  cardType: "unit" | "operation" | "vehicle" | "commander";
  grade: "A" | "B" | "C" | "D" | "E";
  gradeReasons: string[];
  segmentCount: number;
  hasNamedEffects: boolean;
  hasNotes: boolean;
  pipelineReady: boolean;
  warnings: string[];
};

export type ExtractedTrigger = {
  segmentIndex: number;
  trigger: EffectDefinition["trigger"];
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type ExtractedEffect = {
  segmentIndex: number;
  id: string;
  name?: string;
  text: string;
  trigger: EffectDefinition["trigger"];
  condition?: EffectDefinition["condition"];
  optional?: boolean;
  effects: EffectDefinition["effects"];
  matchedPattern?: string;
  needsFallback: boolean;
};

export type PipelineStep =
  | "parse"
  | "analyze"
  | "extract_triggers"
  | "extract_effects"
  | "generate_dsl"
  | "validate"
  | "generate_tests";

export type PipelineReport = {
  cardId: string;
  completedSteps: PipelineStep[];
  parse: WikiParseResult;
  analysis: CardAnalysis;
  triggers: ExtractedTrigger[];
  extractedEffects: ExtractedEffect[];
  card: CardDocument;
  validation: ValidationResult;
  testFile: string;
  warnings: string[];
};

export type PipelineOutputPaths = {
  cardJson: string;
  testFile: string;
  reportJson: string;
};
