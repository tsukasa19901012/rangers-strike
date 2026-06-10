import type { CardAnalysis, WikiParseResult } from "./types";
import { SIZE_MAP } from "./metaMaps";

const ENGINE_RE = [
  /ゲーム開始/,
  /コマンダーゾーン/,
  /次の効果から1つ選び/,
  /レジスト/,
  /母艦|モノシップ/,
];

const RULING_RE = [/ウイング/, /チェイス/, /ジョイントコンボ/, /ライディングコンボ/];

const SIMPLE_BODY_RE = [
  /^「SP\d+」$/,
  /^自分は\d+枚ドローする/,
  /このカードを自軍パワーゾーンに置く/,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function isSimpleBody(body: string): boolean {
  return SIMPLE_BODY_RE.some((p) => p.test(body));
}

function isAliasNote(body: string): boolean {
  return /^※これは「.+」としてつかえる。?$/.test(body);
}

function classifyGrade(parse: WikiParseResult): Pick<CardAnalysis, "grade" | "gradeReasons"> {
  const combined = parse.effectTexts.join("\n");
  const cardType = parse.status.種類 ?? "";

  if (/コマンダー/.test(cardType) || /^XC-|^SM-/.test(parse.cardId)) {
    return { grade: "E", gradeReasons: ["commander_or_promo"] };
  }
  if (matchesAny(combined, ENGINE_RE)) {
    return { grade: "E", gradeReasons: ["engine_pattern"] };
  }
  if (parse.effectTexts.length === 0) {
    return { grade: "A", gradeReasons: ["no_effect_text"] };
  }
  if (matchesAny(combined, RULING_RE)) {
    return { grade: "D", gradeReasons: ["ruling_keyword"] };
  }

  const named = parse.segments.filter((s) => s.kind === "named");
  const notes = parse.segments.filter((s) => s.kind === "note");

  const soleNamed = named[0];
  if (named.length === 1 && soleNamed && isSimpleBody(soleNamed.body) && notes.every((n) => isAliasNote(n.body))) {
    return { grade: "B", gradeReasons: ["simple_named_with_alias"] };
  }
  if (named.length === 1 && notes.length === 0 && soleNamed && isSimpleBody(soleNamed.body)) {
    return { grade: "B", gradeReasons: ["simple_named"] };
  }
  const soleSegment = parse.segments[0];
  if (parse.segments.length === 1 && soleSegment?.kind === "body" && isSimpleBody(soleSegment.body)) {
    return { grade: "B", gradeReasons: ["simple_body"] };
  }
  if (notes.length > 0 && named.length === 0 && notes.every((n) => isAliasNote(n.body))) {
    return { grade: "B", gradeReasons: ["alias_only"] };
  }

  return { grade: "C", gradeReasons: ["medium_complexity"] };
}

export function analyzeCard(parse: WikiParseResult): CardAnalysis {
  const { grade, gradeReasons } = classifyGrade(parse);
  const warnings: string[] = [];

  if (parse.confidence === "LOW" || parse.confidence === "UNKNOWN") {
    warnings.push(`wiki confidence is ${parse.confidence}`);
  }
  if (!parse.status.種類) {
    warnings.push("missing atwiki card type — using catalog fallback");
  }

  const cardType = inferCardType(parse);
  const pipelineReady = grade === "A" || grade === "B" || grade === "C";

  return {
    cardId: parse.cardId,
    cardType,
    grade,
    gradeReasons,
    segmentCount: parse.segments.length,
    hasNamedEffects: parse.segments.some((s) => s.kind === "named"),
    hasNotes: parse.segments.some((s) => s.kind === "note"),
    pipelineReady,
    warnings,
  };
}

export function inferCardType(parse: WikiParseResult): CardAnalysis["cardType"] {
  const kind = parse.status.種類 ?? "";
  if (kind.includes("オペレーション")) return "operation";
  if (kind.includes("コマンダー")) return "commander";
  if (kind.includes("ビークル") || kind.includes("バイク")) return "vehicle";
  if (Object.keys(SIZE_MAP).some((k) => kind.includes(k.replace("ユニット", "")))) return "unit";
  return "unit";
}
