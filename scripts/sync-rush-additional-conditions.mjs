/**
 * Populate rushAdditionalCondition on cards.json and unitEffects.json
 * for every card in ZORD_CONDITIONS (packages/cards/src/zord.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Keep in sync with packages/cards/src/zord.ts ZORD_CONDITIONS */
const ZORD_CONDITIONS = {
  "RS-034": "discard_fusion_unit",
  "RS-042": "discard_fusion_unit",
  "RS-043": "send_s_unit_to_power",
  "RS-044": "send_s_unit_to_power",
  "RS-045": "send_s_unit_to_power",
  "RS-046": "send_s_unit_to_power",
  "RS-047": "send_s_unit_to_power",
  "RS-050": "discard_fusion_unit",
  "RS-056": "discard_fusion_unit",
  "RS-070": "discard_fusion_unit",
  "RS-073": "discard_fusion_unit",
  "RS-074": "send_s_unit_to_command_or_discard",
  "RS-075": "send_s_unit_to_command_or_discard",
  "RS-084": "discard_fusion_unit",
  "RS-085": "send_s_unit_to_power",
  "RS-086": "send_s_unit_to_power",
  "RS-087": "send_s_unit_to_power",
  "RS-088": "send_s_unit_to_power",
  "RS-089": "send_s_unit_to_power",
  "RS-094": "send_s_unit_to_power",
  "RS-095": "discard_fusion_unit",
  "RS-096": "send_s_unit_to_discard",
  "RS-097": "send_s_unit_to_discard",
  "RS-098": "send_s_unit_to_discard",
  "RS-111": "discard_fusion_unit",
  "RS-112": "discard_fusion_unit",
  "RS-113": "discard_fusion_unit",
  "RS-117": "discard_fusion_unit",
  "RS-118": "send_s_unit_to_command_or_discard",
  "RS-119": "send_s_unit_to_command_or_discard",
  "RS-120": "send_s_unit_to_command_or_discard",
  "RS-121": "send_s_unit_to_command_or_discard",
  "RS-122": "send_s_unit_to_command_or_discard",
};

function buildRushAdditionalCondition(conditionId) {
  if (conditionId === "discard_fusion_unit") {
    return { conditionId, text: "自軍合体ユニットを捨札にする" };
  }
  const unitCount = 1;
  if (conditionId === "send_s_unit_to_command_or_discard") {
    return {
      conditionId,
      text: `自軍Sユニットを${unitCount}体コマンドゾーンに送るか捨札にする`,
      unitCount,
    };
  }
  if (conditionId === "send_s_unit_to_discard") {
    return {
      conditionId,
      text: `自軍Sユニットを${unitCount}体捨札にする`,
      unitCount,
    };
  }
  return {
    conditionId,
    text: `自軍Sユニットを${unitCount}体パワーゾーンに送る`,
    unitCount,
  };
}

function reorderCard(card) {
  const rush = card.rushAdditionalCondition;
  if (!rush) return card;
  const { rushAdditionalCondition: _r, ...rest } = card;
  const ordered = {};
  for (const key of Object.keys(rest)) {
    ordered[key] = rest[key];
    if (key === "powerCost") ordered.rushAdditionalCondition = rush;
  }
  if (!ordered.rushAdditionalCondition) ordered.rushAdditionalCondition = rush;
  return ordered;
}

function reorderUnitBlock(block) {
  const rush = block.rushAdditionalCondition;
  if (!rush) return block;
  const { rushAdditionalCondition: _r, ...rest } = block;
  return { rushAdditionalCondition: rush, ...rest };
}

function syncCardsJson(relPath) {
  const filePath = path.join(root, relPath);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let changed = 0;
  for (const card of data.cards) {
    const conditionId = ZORD_CONDITIONS[card.id];
    if (!conditionId) continue;
    const rush = buildRushAdditionalCondition(conditionId);
    const prev = JSON.stringify(card.rushAdditionalCondition);
    const next = JSON.stringify(rush);
    if (prev !== next) changed += 1;
    card.rushAdditionalCondition = rush;
    const idx = data.cards.indexOf(card);
    data.cards[idx] = reorderCard(card);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  return changed;
}

function syncUnitEffectsJson(relPath) {
  const filePath = path.join(root, relPath);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let changed = 0;
  for (const [cardId, conditionId] of Object.entries(ZORD_CONDITIONS)) {
    const block = data[cardId];
    if (!block || typeof block !== "object") continue;
    const rush = buildRushAdditionalCondition(conditionId);
    const prev = JSON.stringify(block.rushAdditionalCondition);
    const next = JSON.stringify(rush);
    if (prev !== next) changed += 1;
    data[cardId] = reorderUnitBlock({ ...block, rushAdditionalCondition: rush });
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  return changed;
}

const cardFiles = [
  "packages/cards/src/legend1/cards.json",
  "packages/cards/src/legend2/cards.json",
];
const unitFiles = [
  "packages/cards/src/legend1/unitEffects.json",
  "packages/cards/src/legend2/unitEffects.json",
];

let total = 0;
for (const f of cardFiles) {
  const n = syncCardsJson(f);
  console.log(`${f}: ${n} cards updated`);
  total += n;
}
for (const f of unitFiles) {
  const n = syncUnitEffectsJson(f);
  console.log(`${f}: ${n} blocks updated`);
  total += n;
}
console.log(`done (${Object.keys(ZORD_CONDITIONS).length} zord-up cards)`);
