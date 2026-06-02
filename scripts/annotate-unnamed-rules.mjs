#!/usr/bin/env node
/**
 * Add `rule` (and optional params) to unnamedText notes in unitEffects.json.
 * Idempotent: skips entries that already have `rule`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {Array<{ match: (text: string) => boolean; rule: string; extra?: Record<string, number> }>} */
const RULES = [
  {
    match: (t) => t.includes("ホールドしなければバトルエリアに出られない"),
    rule: "battle_entry_hold",
    extra: { holdCount: 1 },
  },
  {
    match: (t) => t.includes("毎ターン、可能ならバトルエリアに出る"),
    rule: "auto_battle_entry_each_turn",
  },
  {
    match: (t) => t.includes("ラッシュするとき可能ならバトルエリアに置く"),
    rule: "auto_battle_entry_on_rush",
  },
  {
    match: (t) => t.includes("撃破されたとき、1点ダメージを受ける"),
    rule: "destroy_self_damage",
    extra: { damage: 1 },
  },
  {
    match: (t) => t.includes("デッキに3枚以上入れてもよい"),
    rule: "deck_copy_unlimited",
  },
  {
    match: (t) => t.includes("自軍Sユニットがバトルエリアになければ"),
    rule: "needs_ally_s_in_battle",
  },
  {
    match: (t) => t.includes("バトルに勝っても撃破される"),
    rule: "win_but_destroyed_vs_sp1",
  },
  {
    match: (t) => t.includes("敵軍ダメージが6点になったとき"),
    rule: "return_to_hand_at_6_damage",
  },
  {
    match: (t) => t.includes("ラッシュしたターンにバトルエリアに出られない"),
    rule: "no_battle_entry_turn_rushed",
  },
  {
    match: (t) => t.includes("ラッシュしたターンにアタックできない"),
    rule: "no_attack_turn_rushed",
  },
  {
    match: (t) => t.includes("ラッシュしたターンにストライクできない"),
    rule: "no_strike_turn_rushed",
  },
  {
    match: (t) => t === "※これはバトルエリアに出られない。",
    rule: "cannot_enter_battle",
  },
  {
    match: (t) => /としてつかえる/.test(t),
    rule: "fusion_material_alias",
  },
  {
    match: (t) => t.includes("バトルエリアに出たとき、相手は1枚ドロー"),
    rule: "opponent_may_draw_on_enter",
  },
];

function annotateFile(relPath) {
  const filePath = path.join(root, relPath);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let updated = 0;
  let unmatched = [];

  for (const [cardId, block] of Object.entries(data)) {
    for (const entry of block.unnamedText ?? []) {
      if (entry.kind !== "note") continue;
      if (entry.rule) continue;
      const spec = RULES.find((r) => r.match(entry.text));
      if (!spec) {
        unmatched.push({ cardId, text: entry.text });
        continue;
      }
      entry.rule = spec.rule;
      if (spec.extra) Object.assign(entry, spec.extra);
      updated += 1;
    }
  }

  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${relPath}: annotated ${updated} notes`);
  if (unmatched.length) {
    console.warn("  unmatched notes:");
    for (const u of unmatched) console.warn(`    ${u.cardId}: ${u.text}`);
  }
}

for (const rel of [
  "packages/cards/src/legend1/unitEffects.json",
  "packages/cards/src/legend2/unitEffects.json",
]) {
  annotateFile(rel);
}
