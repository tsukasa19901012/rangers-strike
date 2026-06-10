import type { CardDocument, RushAdditionalCondition } from "../dsl/types";

const CATEGORY_CODES = new Set(["ET", "WB", "OT", "MA", "DA"]);

export const CATEGORY_MAP: Record<string, CardDocument["category"]> = {
  アーステクノロジー: "ET",
  ワイルドビースト: "WB",
  オーバーテクノロジー: "OT",
  ミスティックアームズ: "MA",
  ダークアライアンス: "DA",
};

/** Wiki カテゴリ行 / atwiki ステータスから CardDefinition 用カテゴリを推論。 */
export function inferCategoryFromWikiLabels(
  ...labels: (string | undefined)[]
): CardDocument["category"] {
  const codes: Array<NonNullable<CardDocument["category"]> & string> = [];
  for (const label of labels) {
    if (!label) continue;
    for (const part of label.split(/[/／]/).map((s) => s.trim()).filter(Boolean)) {
      if (CATEGORY_CODES.has(part)) {
        codes.push(part as NonNullable<CardDocument["category"]> & string);
      } else if (CATEGORY_MAP[part]) {
        codes.push(CATEGORY_MAP[part] as NonNullable<CardDocument["category"]> & string);
      }
    }
  }
  const unique = [...new Set(codes)];
  if (unique.length === 0) return "OT";
  if (unique.length === 1) return unique[0];
  return unique as CardDocument["category"];
}

export const SIZE_MAP: Record<string, NonNullable<CardDocument["size"]>> = {
  Sユニット: "S",
  Mユニット: "M",
  Lユニット: "L",
  XLユニット: "XL",
  SCユニット: "SC",
};

export const EXPANSION_FROM_SET: Record<string, CardDocument["expansion"]> = {
  英雄の再誕: "legend1",
  伝説の継承: "legend2",
  轟け雷鳴: "legend3",
};

export function parseSp(raw?: string): CardDocument["sp"] {
  if (!raw || raw === "なし" || raw === "－" || raw === "-") return null;
  if (raw === "！" || raw === "!") return "special";
  const n = Number(raw.replace(/[^\d]/g, ""));
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

export function inferRushAdditionalCondition(
  addCond: string | undefined,
  powerCost: CardDocument["powerCost"],
): RushAdditionalCondition | undefined {
  if (!addCond || addCond === "なし") return undefined;
  if (!String(powerCost).includes("+")) return undefined;
  if (addCond.includes("合体ユニット")) {
    return { conditionId: "discard_fusion_unit", text: addCond };
  }
  const countMatch = addCond.match(/(\d+)体/);
  const unitCount = countMatch ? Number(countMatch[1]) : 1;
  if (addCond.includes("コマンドゾーンに送るか捨札")) {
    return {
      conditionId: "send_s_unit_to_command_or_discard",
      text: addCond,
      unitCount,
    };
  }
  if (addCond.includes("捨札") && addCond.includes("Sユニット")) {
    return { conditionId: "send_s_unit_to_discard", text: addCond, unitCount };
  }
  if (addCond.includes("パワーゾーン")) {
    return { conditionId: "send_s_unit_to_power", text: addCond, unitCount };
  }
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
  const KNOWN: Record<string, string> = {
    未来予知: "future_sight",
    ティラノロッド: "grant_sp1",
    クルマジックパワー: "place_in_power",
  };
  if (KNOWN[name]) return KNOWN[name];
  const ascii = name
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (ascii.length >= 2) return sanitizeEffectId(ascii);
  return `named_${hashEffectText(name)}`;
}

export function noteEffectIdFromBody(body: string): string {
  return sanitizeEffectId(`note_${hashEffectText(body)}`);
}

export function aliasKeywordFromText(body: string): string {
  const alias = body.match(/「([^」]+)」/)?.[1] ?? "alias";
  const mapped = ALIAS_KEYWORDS[alias];
  return mapped ? `alias_${mapped}` : `alias_${slugifyEffectId(alias)}`;
}
