/**
 * Populate rushAdditionalCondition on cards.json and unitEffects.json
 * for every zord-up unit across all expansions.
 *
 * Source of truth:
 * - Legend 1/2 legacy: ZORD_CONDITIONS in packages/cards/src/zord.ts
 * - Legend 3+: unitEffects.json rushAdditionalCondition (already authored)
 *
 * Usage: node scripts/sync-rush-additional-conditions.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const cardsRoot = path.join(root, "packages/cards/src");

/** Parsed from packages/cards/src/zord.ts ZORD_CONDITIONS (Legend 1/2 legacy). */
const ZORD_CONDITIONS = parseZordConditions(
  fs.readFileSync(path.join(cardsRoot, "zord.ts"), "utf8"),
);

const EXPANSIONS = ["legend1", "legend2", "legend3"];

function parseZordConditions(source) {
  const match = source.match(
    /export const ZORD_CONDITIONS[^=]*=\s*\{([\s\S]*?)\};/,
  );
  if (!match) throw new Error("Could not parse ZORD_CONDITIONS from zord.ts");
  const map = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/"([^"]+)":\s*"([^"]+)"/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

function isZordUpCost(powerCost) {
  return typeof powerCost === "string" && powerCost.endsWith("+");
}

function buildRushAdditionalCondition(conditionId, unitCount = 1) {
  if (conditionId === "discard_fusion_unit") {
    return { conditionId, text: "自軍合体ユニットを捨札にする" };
  }
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

function resolveExpectedRush(cardId, unitBlock) {
  if (unitBlock?.rushAdditionalCondition) {
    return unitBlock.rushAdditionalCondition;
  }
  const conditionId = ZORD_CONDITIONS[cardId];
  if (!conditionId) return null;
  const unitCount = unitBlock?.rushAdditionalCondition?.unitCount ?? 1;
  return buildRushAdditionalCondition(conditionId, unitCount);
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

function syncExpansion(expansion) {
  const cardsPath = path.join(cardsRoot, `${expansion}/cards.json`);
  const unitPath = path.join(cardsRoot, `${expansion}/unitEffects.json`);
  const cardsData = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
  const unitData = fs.existsSync(unitPath)
    ? JSON.parse(fs.readFileSync(unitPath, "utf8"))
    : {};

  let cardsChanged = 0;
  let blocksChanged = 0;

  for (const card of cardsData.cards) {
    if (card.type !== "unit" || !isZordUpCost(card.powerCost)) continue;

    const block = unitData[card.id];
    const rush = resolveExpectedRush(card.id, block);
    if (!rush) continue;

    const prevCard = JSON.stringify(card.rushAdditionalCondition);
    const nextCard = JSON.stringify(rush);
    if (prevCard !== nextCard) cardsChanged += 1;
    card.rushAdditionalCondition = rush;
    const idx = cardsData.cards.indexOf(card);
    cardsData.cards[idx] = reorderCard(card);

    if (block && typeof block === "object") {
      const prevBlock = JSON.stringify(block.rushAdditionalCondition);
      const nextBlock = JSON.stringify(rush);
      if (prevBlock !== nextBlock) blocksChanged += 1;
      unitData[card.id] = reorderUnitBlock({ ...block, rushAdditionalCondition: rush });
    } else if (ZORD_CONDITIONS[card.id]) {
      console.warn(`warn: ${card.id} in ZORD_CONDITIONS but missing unitEffects block (${expansion})`);
    }
  }

  fs.writeFileSync(cardsPath, `${JSON.stringify(cardsData, null, 2)}\n`);
  if (fs.existsSync(unitPath)) {
    fs.writeFileSync(unitPath, `${JSON.stringify(unitData, null, 2)}\n`);
  }

  return { cardsChanged, blocksChanged };
}

let totalCards = 0;
let totalBlocks = 0;
for (const expansion of EXPANSIONS) {
  const { cardsChanged, blocksChanged } = syncExpansion(expansion);
  console.log(
    `${expansion}: ${cardsChanged} cards updated, ${blocksChanged} unitEffects blocks updated`,
  );
  totalCards += cardsChanged;
  totalBlocks += blocksChanged;
}
console.log(
  `done (${Object.keys(ZORD_CONDITIONS).length} legacy zord entries, ${totalCards + totalBlocks} fields synced)`,
);
