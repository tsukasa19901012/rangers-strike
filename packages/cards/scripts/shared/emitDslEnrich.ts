import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { applyRecommendedReplacementText } from "../../src/cardText";
import type { CardDefinition } from "../../src/schema";

/** DSL スタブから catalog emit 時に上書きする stats フィールド。 */
export function enrichFromDsl(root: string, base: CardDefinition): CardDefinition {
  const dslPath = join(root, "src/generated/dsl-stubs", `${base.id}.dsl.json`);
  if (!existsSync(dslPath)) return base;
  const dsl = JSON.parse(readFileSync(dslPath, "utf8")) as CardDefinition;
  return {
    ...base,
    name: dsl.name ?? base.name,
    category: dsl.category ?? base.category,
    powerCost: dsl.powerCost ?? base.powerCost,
    rushAdditionalCondition:
      dsl.rushAdditionalCondition ?? base.rushAdditionalCondition,
    bp: dsl.bp ?? base.bp,
    size: dsl.size ?? base.size,
    sp: dsl.sp ?? base.sp,
    comboNumber: dsl.comboNumber ?? base.comboNumber,
    text: applyRecommendedReplacementText(dsl.text ?? base.text),
    features: dsl.features ?? base.features,
  };
}
