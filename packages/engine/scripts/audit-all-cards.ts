import {
  listImplementedOperations,
  IMPLEMENTED_ON_RUSH_EFFECT_IDS,
  IMPLEMENTED_CONDITIONAL_EFFECT_IDS,
  IMPLEMENTED_ON_ATTACK_EFFECT_IDS,
  IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS,
  IMPLEMENTED_PASSIVE_EFFECT_IDS,
  ENGINE_IMPLEMENTED_CATCHALL_CARD_IDS,
} from "@rangers-strike/cards";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DSL_DIR = path.join(__dirname, "../../../packages/cards/src/generated/dsl-stubs");
const stubFiles = fs.readdirSync(DSL_DIR).filter(f => f.endsWith(".dsl.json") && !f.startsWith("manifest") && !f.startsWith("stubs") && !f.startsWith("corestubs"));

const opsSet = new Set(listImplementedOperations().map(o => o.effectId));
const onRushSet = new Set(IMPLEMENTED_ON_RUSH_EFFECT_IDS);
const conditionalSet = new Set(IMPLEMENTED_CONDITIONAL_EFFECT_IDS);
const onAttackSet = new Set(IMPLEMENTED_ON_ATTACK_EFFECT_IDS);
const enterBattleSet = new Set(IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS);
const passiveSet = new Set(IMPLEMENTED_PASSIVE_EFFECT_IDS);

const byEffect = new Map<string, string[]>();
let totalCards = 0;

for (const f of stubFiles) {
  const raw = JSON.parse(fs.readFileSync(path.join(DSL_DIR, f), "utf8"));
  const cardId = raw.cardId ?? f.replace(".dsl.json", "");
  const effects: Array<{trigger?: string; effectId?: string}> = raw.effects ?? [];
  if (effects.length === 0) continue;
  totalCards++;
  
  for (const eff of effects) {
    const effectId = eff.effectId;
    if (!effectId) continue;
    const trigger = eff.trigger ?? "?";
    const isImpl = onRushSet.has(effectId) || conditionalSet.has(effectId) ||
      onAttackSet.has(effectId) || enterBattleSet.has(effectId) ||
      passiveSet.has(effectId) || opsSet.has(effectId) ||
      ENGINE_IMPLEMENTED_CATCHALL_CARD_IDS.has(cardId);
    if (!isImpl) {
      const key = `${trigger}:${effectId}`;
      if (!byEffect.has(key)) byEffect.set(key, []);
      byEffect.get(key)!.push(cardId);
    }
  }
}

const sorted = [...byEffect.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`Cards with effects: ${totalCards}`);
console.log(`Distinct unimplemented effectIds: ${byEffect.size}`);
for (const [k, cards] of sorted) {
  console.log(`  ${k}: ${cards.length} cards [${cards.slice(0,4).join(", ")}${cards.length>4?"...":""}]`);
}
