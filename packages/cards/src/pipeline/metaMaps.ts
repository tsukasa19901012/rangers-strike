import type { CardDocument, Category, RushAdditionalCondition } from "../dsl/types";
import { effectIdFromName } from "./effectNameIds";
import { slugifyJapaneseEffectName } from "./japaneseEffectSlug";

const CATEGORY_CODES = new Set(["ET", "WB", "OT", "MA", "DA"]);

export const CATEGORY_MAP: Record<string, CardDocument["category"]> = {
  アーステクノロジー: "ET",
  ワイルドビースト: "WB",
  オーバーテクノロジー: "OT",
  ミスティックアームズ: "MA",
  /** atwiki 旧表記（L49 八神セット等） */
  ミステックアームズ: "MA",
  ダークアライアンス: "DA",
};

/** Wiki カテゴリ行 / atwiki ステータスから CardDefinition 用カテゴリを推論。 */
export function inferCategoryFromWikiLabels(
  ...labels: (string | undefined)[]
): CardDocument["category"] {
  const codes: Category[] = [];
  for (const label of labels) {
    if (!label) continue;
    for (const part of label.split(/[/／]/).map((s) => s.trim()).filter(Boolean)) {
      if (CATEGORY_CODES.has(part)) {
        codes.push(part as Category);
      } else if (CATEGORY_MAP[part]) {
        codes.push(CATEGORY_MAP[part] as Category);
      }
    }
  }
  const unique = [...new Set(codes)];
  if (unique.length === 0) return "OT";
  if (unique.length === 1) return unique[0]!;
  return unique;
}

export const SIZE_MAP: Record<string, NonNullable<CardDocument["size"]>> = {
  Sユニット: "S",
  Mユニット: "M",
  Lユニット: "L",
  XLユニット: "XL",
  SCユニット: "SC",
  Sビークル: "S",
  Mビークル: "M",
  Lビークル: "L",
  XLビークル: "XL",
  SCビークル: "SC",
};

export const EXPANSION_FROM_SET: Record<string, CardDocument["expansion"]> = {
  英雄の再誕: "legend1",
  伝説の継承: "legend2",
  轟け雷鳴: "legend3",
};

export function parseSp(raw?: string): CardDocument["sp"] {
  if (!raw || raw === "なし" || raw === "－" || raw === "-") return null;
  if (raw === "！" || raw === "!") return "special";
  const normalized = raw.trim().replace(/^SP/i, "");
  const fraction = normalized.match(/^(\d+)\s*[\/／]\s*(\d+)$/);
  if (fraction) {
    return `${fraction[1]}/${fraction[2]}` as CardDocument["sp"];
  }
  const n = Number(normalized.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseComboNumber(raw?: string): CardDocument["comboNumber"] {
  if (!raw || raw === "なし") return null;
  if (raw === "L" || raw === "R" || raw === "RC") return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parsePowerCost(raw?: string): CardDocument["powerCost"] {
  if (!raw) return 0;
  const normalized = raw.replace(/[＋+]/g, "+").replace(/[－-]/g, "-").trim();
  if (normalized.endsWith("+") || normalized.endsWith("-")) return normalized;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : normalized;
}

function parseUnitCount(addCond: string, fallback = 1): number {
  const countMatch = addCond.match(/(\d+)体/) ?? addCond.match(/(\d+)枚/);
  return countMatch ? Number(countMatch[1]) : fallback;
}

function inferZordUpAdditionalCondition(addCond: string): RushAdditionalCondition | undefined {
  const unitCount = parseUnitCount(addCond);

  if (addCond.includes("合体ユニット")) {
    return { conditionId: "discard_fusion_unit", text: addCond };
  }
  if (addCond.includes("合体ビークル")) {
    return { conditionId: "discard_fusion_vehicle", text: addCond };
  }
  if (addCond.includes("相手に1枚ドロー")) {
    return { conditionId: "opponent_draw", text: addCond };
  }
  if (
    addCond.includes("オモテ向きの自軍パワー全て") ||
    addCond.includes("オモテ向きの自軍パワーを全て")
  ) {
    return { conditionId: "discard_all_face_up_power", text: addCond };
  }
  if (
    addCond.includes("自分の手札を全て") ||
    addCond.includes("自分の手札をすべて")
  ) {
    return { conditionId: "discard_all_hand", text: addCond };
  }
  if (addCond.includes("手札を1枚選び捨")) {
    return { conditionId: "discard_hand_card", text: addCond, unitCount: 1 };
  }
  if (addCond.includes("自軍コマンド") && addCond.includes("捨")) {
    return { conditionId: "discard_command_card", text: addCond, unitCount };
  }
  if (addCond.includes("自軍ビークル") && addCond.includes("捨")) {
    return { conditionId: "discard_vehicle_unit", text: addCond, unitCount };
  }
  if (addCond.includes("常駐置き場") && addCond.includes("捨")) {
    return { conditionId: "discard_operation_cards", text: addCond, unitCount };
  }
  if (addCond.includes("追加で自軍コマンド") && addCond.includes("ホールド")) {
    return { conditionId: "hold_extra_command", text: addCond, unitCount };
  }
  if (addCond.includes("手札に戻す")) {
    const partnerName = extractQuotedName(addCond);
    if (partnerName) {
      return { conditionId: "return_named_to_hand", text: addCond, partnerName, unitCount };
    }
  }
  if (addCond.includes("カード名に") && addCond.includes("捨")) {
    const nameContains = addCond.match(/カード名に[「｢]([^」｣]+)[」｣]/)?.[1];
    if (nameContains) {
      return {
        conditionId: "discard_name_contains_unit",
        text: addCond,
        nameContains,
        unitCount,
      };
    }
  }
  if (addCond.includes("Lユニット") && addCond.includes("捨")) {
    const categoryMatch = addCond.match(/([^を]+)を持つ自軍Lユニット/);
    return {
      conditionId: "discard_category_l_unit",
      text: addCond,
      requiredCategory: categoryMatch?.[1]?.trim(),
      unitCount,
    };
  }
  const featureMatch = addCond.match(/特徴[「｢]([^」｣]+)[」｣]を持つ自軍ユニット/);
  if (featureMatch && addCond.includes("捨")) {
    return {
      conditionId: "discard_feature_unit",
      text: addCond,
      requiredFeature: featureMatch[1],
      unitCount,
    };
  }
  const namedDiscardMatch = addCond.match(/自軍[「｢]([^」｣]+)[」｣](\d+)体を捨札にする/);
  if (namedDiscardMatch) {
    return {
      conditionId: "discard_named_unit",
      text: addCond,
      partnerName: namedDiscardMatch[1],
      unitCount: Number(namedDiscardMatch[2]),
    };
  }
  const namedDiscardAlt = addCond.match(/自軍[「｢]([^」｣]+)[」｣]を(\d+)体捨札にする/);
  if (namedDiscardAlt) {
    return {
      conditionId: "discard_named_unit",
      text: addCond,
      partnerName: namedDiscardAlt[1],
      unitCount: Number(namedDiscardAlt[2]),
    };
  }
  const looseNamed = extractQuotedName(addCond);
  if (looseNamed && addCond.includes("捨") && !addCond.includes("必要パワー0")) {
    return {
      conditionId: "discard_named_unit",
      text: addCond,
      partnerName: looseNamed,
      unitCount,
    };
  }
  if (
    addCond.includes("自軍ユニット") &&
    (addCond.includes("捨札") || addCond.includes("捨て札")) &&
    !addCond.includes("Sユニット") &&
    !addCond.includes("合体")
  ) {
    return { conditionId: "discard_generic_unit", text: addCond, unitCount };
  }
  if (addCond.includes("自軍ゾーンに送る")) {
    return { conditionId: "send_s_units_to_zones", text: addCond, unitCount };
  }
  if (addCond.includes("コマンドゾーンに送るか捨札") || addCond.includes("コマンドゾーンに送るか捨て札")) {
    return {
      conditionId: "send_s_unit_to_command_or_discard",
      text: addCond,
      unitCount,
    };
  }
  if (
    (addCond.includes("捨札") || addCond.includes("捨て札")) &&
    addCond.includes("Sユニット")
  ) {
    return { conditionId: "send_s_unit_to_discard", text: addCond, unitCount };
  }
  if (addCond.includes("パワーゾーン")) {
    return { conditionId: "send_s_unit_to_power", text: addCond, unitCount };
  }
  if (
    addCond.includes("以上ある") ||
    addCond.includes("以上の") ||
    addCond.includes("がある")
  ) {
    return { conditionId: "state_gate", text: addCond };
  }
  return undefined;
}

function extractQuotedName(addCond: string): string | undefined {
  const match = addCond.match(/[「｢]([^」｣]+)[」｣]/);
  return match?.[1];
}

function inferZordDownAdditionalCondition(
  addCond: string,
): RushAdditionalCondition | undefined {
  if (!addCond.includes("必要パワー0")) return undefined;
  const normalized = addCond.replace(/必要パワー0になる/g, "必要パワー0");

  if (addCond.includes("合体ユニット")) {
    return { conditionId: "zord_down_discard_fusion", text: addCond };
  }

  const powerCardsMatch = addCond.match(
    /必要パワーの数字が(\d+)以上の自軍パワーを(\d+)枚捨札にすれば必要パワー0/,
  );
  if (powerCardsMatch) {
    return {
      conditionId: "zord_down_discard_power_cards",
      text: addCond,
      minPrintedPowerCost: Number(powerCardsMatch[1]),
      unitCount: Number(powerCardsMatch[2]),
    };
  }

  const featureMatch = addCond.match(
    /特徴「([^」]+)」を持つ自軍ユニット(\d+)体を捨札にすれば必要パワー0/,
  );
  if (featureMatch) {
    return {
      conditionId: "zord_down_discard_feature",
      text: addCond,
      requiredFeature: featureMatch[1],
      unitCount: Number(featureMatch[2]),
    };
  }

  const sendPowerMatch = normalized.match(
    /自軍[「｢]([^」｣]+)[」｣](\d+)(?:体|枚)をパワーゾーンに送れば必要パワー0/,
  );
  if (sendPowerMatch) {
    return {
      conditionId: "zord_down_send_to_power",
      text: addCond,
      partnerName: sendPowerMatch[1],
      unitCount: Number(sendPowerMatch[2]),
    };
  }

  const cmdOrDiscardMatch = addCond.match(
    /自軍[「｢]([^」｣]+)[」｣](\d+)体をコマンドゾーンに送るか捨札にすれば必要パワー0/,
  );
  if (cmdOrDiscardMatch) {
    return {
      conditionId: "zord_down_send_to_command_or_discard",
      text: addCond,
      partnerName: cmdOrDiscardMatch[1],
      unitCount: Number(cmdOrDiscardMatch[2]),
    };
  }

  const namedDiscardMatch = addCond.match(
    /自軍[「｢]([^」｣]+)[」｣](\d+)体を捨札にすれば必要パワー0/,
  );
  if (namedDiscardMatch) {
    return {
      conditionId: "zord_down_discard_named",
      text: addCond,
      partnerName: namedDiscardMatch[1],
      unitCount: Number(namedDiscardMatch[2]),
    };
  }

  const altNamedMatch = addCond.match(
    /自軍[「｢]([^」｣]+)[」｣]を(\d+)体捨札にすれば必要パワー0/,
  );
  if (altNamedMatch) {
    return {
      conditionId: "zord_down_discard_named",
      text: addCond,
      partnerName: altNamedMatch[1],
      unitCount: Number(altNamedMatch[2]),
    };
  }

  const looseNamed = extractQuotedName(addCond);
  if (looseNamed && addCond.includes("捨") && addCond.includes("必要パワー0")) {
    return {
      conditionId: "zord_down_discard_named",
      text: addCond,
      partnerName: looseNamed,
      unitCount: parseUnitCount(addCond),
    };
  }

  return undefined;
}

export function inferRushAdditionalCondition(
  addCond: string | undefined,
  powerCost: CardDocument["powerCost"],
): RushAdditionalCondition | undefined {
  if (!addCond || addCond === "なし") return undefined;
  const pc = String(powerCost);
  if (pc.endsWith("+")) return inferZordUpAdditionalCondition(addCond);
  if (pc.endsWith("-")) return inferZordDownAdditionalCondition(addCond);
  return undefined;
}

const ALIAS_KEYWORDS: Record<string, string> = {
  マジマーメイド: "magimermaid",
  ティラノロッド: "tyrannorod",
};

export function sanitizeEffectId(id: string): string {
  if (/^[a-z][a-z0-9_]*$/.test(id)) return id;
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (/^[a-z]/.test(cleaned)) return cleaned;
  return `fx_${cleaned || "unknown"}`;
}

/** 日本語テキストの effect ID 衝突を避けるための安定ハッシュ（M20）。 */
export function hashEffectText(text: string): string {
  return Buffer.from(text.normalize("NFKC"), "utf8").toString("hex").slice(0, 24);
}

export function slugifyEffectId(name: string): string {
  const mapped = effectIdFromName(name);
  if (mapped) return mapped;
  return slugifyJapaneseEffectName(name);
}

export function noteEffectIdFromBody(body: string): string {
  return sanitizeEffectId(`note_${hashEffectText(body)}`);
}

export function aliasKeywordFromText(body: string): string {
  const alias = body.match(/「([^」]+)」/)?.[1] ?? "alias";
  const mapped = ALIAS_KEYWORDS[alias];
  return mapped ? `alias_${mapped}` : `alias_${slugifyEffectId(alias)}`;
}
