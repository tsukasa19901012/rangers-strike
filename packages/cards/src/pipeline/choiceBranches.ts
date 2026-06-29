import type { EffectDefinition, EffectPrimitive } from "../dsl/types";
import { isCatchallGrantKeyword } from "./hashGrantKeywords";
import type { ExtractedEffect, WikiEffectSegment } from "./types";
import { noteEffectIdFromBody, slugifyEffectId } from "./metaMaps";

/** 「次の効果から1つ選び発動する⇒ ◎A ◎B」形式の分岐本文を抽出する。 */
export function splitChoiceBranches(body: string): string[] | null {
  const header = body.match(/次の効果から1つ選び発動する(?:⇒|。)?\s*/);
  if (!header || header.index === undefined) return null;
  const rest = body.slice(header.index + header[0].length);
  const branches = rest
    .split(/◎/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^[。、\s]+$/.test(part));
  return branches.length >= 2 ? branches : null;
}

function branchHasCatchallStub(primitives: EffectPrimitive[]): boolean {
  return primitives.some(
    (p) => p.type === "grant_keyword" && isCatchallGrantKeyword(p.keyword),
  );
}

type RematchBuiltEffectFn = (
  body: string,
  options: {
    name?: string;
    kind?: WikiEffectSegment["kind"];
    trigger: EffectDefinition["trigger"];
  },
) => Omit<ExtractedEffect, "segmentIndex" | "needsFallback"> | null;

/** 全分岐が structured primitive に rematch できるとき pick_effect_branch を返す。 */
export function tryBuildPickEffectBranch(
  body: string,
  segment: WikiEffectSegment,
  trigger: EffectDefinition["trigger"],
  rematchBuiltEffect: RematchBuiltEffectFn,
): Omit<ExtractedEffect, "segmentIndex" | "needsFallback"> | null {
  const branches = splitChoiceBranches(body);
  if (!branches) return null;

  const branchEffects: EffectPrimitive[][] = [];
  for (const branch of branches) {
    const built = rematchBuiltEffect(branch, {
      name: segment.name,
      kind: "body",
      trigger,
    });
    if (!built || branchHasCatchallStub(built.effects)) return null;
    branchEffects.push(built.effects);
  }

  return {
    id: segment.name ? slugifyEffectId(segment.name) : noteEffectIdFromBody(body),
    name: segment.name,
    text: body,
    trigger,
    optional: true,
    effects: [
      {
        type: "grant_keyword",
        keyword: "pick_effect_branch",
        duration: "turn",
      },
    ],
    matchedPattern: "pick_one_effect_branch",
  };
}
