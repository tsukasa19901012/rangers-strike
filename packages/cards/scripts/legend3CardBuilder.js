const CAT_MAP = {
  アーステクノロジー: "ET",
  ワイルドビースト: "WB",
  オーバーテクノロジー: "OT",
  ミスティックアームズ: "MA",
  ダークアライアンス: "DA",
};

const SIZE_MAP = {
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

function parseSp(raw) {
  if (!raw || raw === "なし" || raw === "－" || raw === "-") return null;
  if (raw === "！" || raw === "!") return "special";
  const normalized = raw.trim().replace(/^SP/i, "");
  const fraction = normalized.match(/^(\d+)\s*[\/／]\s*(\d+)$/);
  if (fraction) return `${fraction[1]}/${fraction[2]}`;
  const n = Number(normalized.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseComboNumber(raw) {
  if (!raw || raw === "なし") return null;
  if (raw === "L" || raw === "R" || raw === "RC") return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parsePowerCost(raw) {
  if (!raw) return 0;
  const normalized = raw.replace(/[＋+]/g, "+").replace(/[－-]/g, "-").trim();
  if (normalized.endsWith("+") || normalized.endsWith("-")) return normalized;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : normalized;
}

function inferRushAdditionalCondition(addCond, powerCost) {
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

export function buildLegend3Card(id, name, typeHint, rarity, meta, text) {
  const category = CAT_MAP[meta["カテゴリ"]] ?? "ET";
  const cardType =
    meta["種類"] === "オペレーション" ? "operation" : typeHint === "unit" ? "unit" : typeHint;
  const powerCost = parsePowerCost(meta["必要パワー"]);
  const card = {
    id,
    name,
    type: cardType,
    category,
    rarity,
    expansion: "legend3",
    powerCost,
  };

  if (cardType === "unit") {
    card.size = SIZE_MAP[meta["種類"]] ?? "S";
    const bp = Number(meta["BP"]);
    if (Number.isFinite(bp)) card.bp = bp;
    const sp = parseSp(meta["SP"]);
    if (sp !== null) card.sp = sp;
    const combo = parseComboNumber(meta["CN"]);
    if (combo !== null) card.comboNumber = combo;
    if (meta["特徴"] && meta["特徴"] !== "なし") {
      card.features = meta["特徴"].split(/[／/]/).map((s) => s.trim()).filter(Boolean);
    }
    const rush = inferRushAdditionalCondition(meta["追加条件"], powerCost);
    if (rush) card.rushAdditionalCondition = rush;
  }

  if (text) card.text = text;
  return card;
}
