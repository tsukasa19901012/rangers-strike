import { getEffectLabel } from "@rangers-strike/cards";

/** `named_effect|choice:effectId` — hide interim notice; show resolve with targets instead. */
export const SUPPRESSED_CHOICE_NOTICE_EFFECT_IDS = new Set([
  "armor_attack",
  "tyranno_sonic",
  "moss_blizzard",
  "ptera_beam",
  "karakuri_great_tsunami",
  "air_transport",
  "judgment_sword",
  "justice_flasher",
  "super_drill",
  "ghost_absorption",
  "shift_up",
  "precious_guardian",
  "rescue_activity",
]);

const IGNORED_RESOLVE_TARGETS = new Set(["skipped", "draw", "none", "own_only"]);

/** effectId → text after quoted target name(s). */
const EFFECT_TARGET_SUFFIX: Record<string, string> = {
  armor_attack: "をパワーへ",
  tyranno_sonic: "を撃破",
  ptera_beam: "を捨札",
  moss_blizzard: "をホールド",
  pink_storm: "を山札の上へ",
  destroy_enemy_bp4000: "を撃破",
  ghost_absorption: "を手札へ回収",
  super_drill: "を捨札",
  precious_guardian: "とバトル交代",
  shift_up: "をホールド",
  karakuri_great_tsunami: "を手札へ",
  air_transport: "をラッシュへ",
  green_ground: "を手札へ",
  life_rescue: "を手札へ回収",
  super_ninpo_water_transform: "を手札へ",
  green_crush: "をバトルへ",
  backup_request: "を手札へ回収",
  tricera_lance: "をホールド",
  ptera_arrow: "を捨札",
  dark_dual_blade: "を捨札",
  dark_dual_blade_command: "を捨札",
  moss_breaker: "をホールド",
  judgment_sword: "をパワーコストに",
  justice_flasher: "をパワーコストに",
  radial_hammer: "を山札に残す",
  pit_in_dive: "のバトル進入順を決定",
  juu_kun_do: "を撃破",
  rescue_activity: "を手札へ回収",
  ruin_excavation: "をラッシュへ",
  earth_force: "を維持コストに",
};

export const RESOLVE_EFFECT_TARGET_NOTICE_IDS = new Set([
  ...SUPPRESSED_CHOICE_NOTICE_EFFECT_IDS,
  "pink_storm",
  "green_ground",
  "destroy_enemy_bp4000",
  "tricera_lance",
  "ptera_arrow",
  "life_rescue",
  "super_ninpo_water_transform",
  "dark_dual_blade",
  "dark_dual_blade_command",
  "green_crush",
  "backup_request",
  "moss_breaker",
  "radial_hammer",
  "pit_in_dive",
  "juu_kun_do",
  "rescue_activity",
  "ruin_excavation",
  "earth_force",
]);

export function quoteChoiceTargets(targets: string): string {
  const parts = targets.includes("、")
    ? targets.split("、")
    : targets.includes(",")
      ? targets.split(",").map((s) => s.trim())
      : [targets];
  return parts.map((name) => `「${name}」`).join("");
}

export function isNoteworthyResolveEffectChoice(detail: string | undefined): boolean {
  if (!detail) return false;
  const colon = detail.indexOf(":");
  if (colon <= 0) return false;
  const effectId = detail.slice(0, colon);
  const target = detail.slice(colon + 1);
  if (!target || IGNORED_RESOLVE_TARGETS.has(target)) return false;
  if (/^\d+$/.test(target)) return false;
  return RESOLVE_EFFECT_TARGET_NOTICE_IDS.has(effectId);
}

export function formatResolveEffectChoiceNotice(
  player: string,
  sourceCardName: string,
  detail: string,
): string {
  const colon = detail.indexOf(":");
  const effectId = detail.slice(0, colon);
  const target = detail.slice(colon + 1);
  const quoted = quoteChoiceTargets(target);
  const suffix = EFFECT_TARGET_SUFFIX[effectId];
  const label = getEffectLabel(effectId);
  if (suffix) {
    return `${player}の「${sourceCardName}」が${label}を発動 → ${quoted}${suffix}`;
  }
  return `${player}の「${sourceCardName}」が${label}を発動 → ${quoted}`;
}

export function shouldSuppressChoiceNoticeEffect(effectId: string): boolean {
  return SUPPRESSED_CHOICE_NOTICE_EFFECT_IDS.has(effectId);
}
