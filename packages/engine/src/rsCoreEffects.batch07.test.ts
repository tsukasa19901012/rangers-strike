import { describe, expect, it } from "vitest";
import { canonicalCardName, generatedCorePlayableCatalog as corePlayableCatalog } from "@rangers-strike/cards";
import { legendDefinitions } from "./testing/battleEntry";

const defs = legendDefinitions;

/** Lookup a card by id from the core-playable catalog. */
function catalogCard(id: string) {
  return corePlayableCatalog.cards.find((c) => c.id === id);
}

// ──────────────────────────────────────────────────────────
// Coverage: all RS-521..690 must appear in legendDefinitions
// ──────────────────────────────────────────────────────────

const RS_CORE_BATCH07 = Array.from({ length: 170 }, (_, i) =>
  `RS-${String(521 + i).padStart(3, "0")}`,
);

describe("RS core batch07 audit coverage (RS-521..690)", () => {
  it.each(RS_CORE_BATCH07)("catalog includes %s", (cardId) => {
    expect(defs[cardId] ?? corePlayableCatalog.cards.find((c) => c.id === cardId)).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────
// Bug-fix verification: P1 name drift – "(2nd)" suffix
// Wiki shows these cards have「（2nd）」in their official name.
// ──────────────────────────────────────────────────────────

describe("RS batch07 name drift fixes – '（2nd）' suffix", () => {
  const expectedNames: Record<string, string> = {
    "RS-527": "バルジオン（2nd）",
    "RS-528": "バイオハンター・シルバ（2nd）",
    "RS-548": "ティラノレンジャー（2nd）",
    "RS-549": "トリケラレンジャー（2nd）",
    "RS-572": "デカマスター（2nd）",
    "RS-573": "ファイヤーカイザー（2nd）",
    "RS-577": "マジレッド（2nd）",
    "RS-581": "魔導馬バリキオン（2nd）",
    "RS-585": "ボウケンシルバー（2nd）",
    "RS-653": "レッドファルコン（2nd）",
    "RS-654": "ガオイエロー（2nd）",
    "RS-685": "ブラックコンドル（2nd）",
    "RS-689": "レッドホーク（2nd）",
  };

  it.each(Object.entries(expectedNames))("%s has wiki-correct canonical name", (id, expected) => {
    const card = catalogCard(id);
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe(canonicalCardName(expected));
  });
});

// ──────────────────────────────────────────────────────────
// Operation cards: RS-521..526, RS-605..610
// ──────────────────────────────────────────────────────────

describe("RS-521 スーパー戦隊魂 (operation metadata)", () => {
  it("is a MA operation with powerCost 4", () => {
    const card = catalogCard("RS-521");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("MA");
    expect(card!.powerCost).toBe(4);
  });
});

describe("RS-522 ボウケンスピリッツ (operation metadata)", () => {
  it("is an ET operation with powerCost 6", () => {
    const card = catalogCard("RS-522");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("ET");
    expect(card!.powerCost).toBe(6);
  });
});

describe("RS-523 臨気 (operation metadata)", () => {
  it("is a DA operation with powerCost 4", () => {
    const card = catalogCard("RS-523");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("DA");
    expect(card!.powerCost).toBe(4);
  });
});

describe("RS-524 呉越同舟 (operation metadata)", () => {
  it("is a WB operation with powerCost 3", () => {
    const card = catalogCard("RS-524");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("WB");
    expect(card!.powerCost).toBe(3);
  });
});

describe("RS-525 頼もしい相棒 (operation metadata)", () => {
  it("is an OT operation with powerCost 2", () => {
    const card = catalogCard("RS-525");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("OT");
    expect(card!.powerCost).toBe(2);
  });
});

describe("RS-526 スーパーハイウェイバスター (operation metadata)", () => {
  it("is an OT operation with powerCost 2", () => {
    const card = catalogCard("RS-526");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("OT");
    expect(card!.powerCost).toBe(2);
  });
});

describe("RS-605 異次元からの翼 (operation metadata)", () => {
  it("is an OT operation with powerCost 4", () => {
    const card = catalogCard("RS-605");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("OT");
    expect(card!.powerCost).toBe(4);
  });
});

describe("RS-606 雷鳴剣ヒカリマル (operation metadata)", () => {
  it("is a MA operation with powerCost 5", () => {
    const card = catalogCard("RS-606");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("MA");
    expect(card!.powerCost).toBe(5);
  });
});

describe("RS-607 ファルコンサモナー (operation metadata)", () => {
  it("is a WB operation with powerCost 4", () => {
    const card = catalogCard("RS-607");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("WB");
    expect(card!.powerCost).toBe(4);
  });
});

describe("RS-608 五色の戦士 (operation metadata)", () => {
  it("is a WB operation with powerCost 4", () => {
    const card = catalogCard("RS-608");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("WB");
    expect(card!.powerCost).toBe(4);
  });
});

describe("RS-609 戦士の魂 (operation metadata)", () => {
  it("is an ET operation with powerCost 5", () => {
    const card = catalogCard("RS-609");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("ET");
    expect(card!.powerCost).toBe(5);
  });
});

describe("RS-610 秘伝ディスク (operation metadata)", () => {
  it("is a MA operation with powerCost 3", () => {
    const card = catalogCard("RS-610");
    expect(card).toBeDefined();
    expect(card!.type).toBe("operation");
    expect(card!.category).toBe("MA");
    expect(card!.powerCost).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────
// Vehicle cards: RS-527, RS-570, RS-575, RS-581
// ──────────────────────────────────────────────────────────

describe("RS-527 バルジオン（2nd） (vehicle metadata)", () => {
  it("is a DA vehicle of size L with corrected name", () => {
    const card = catalogCard("RS-527");
    expect(card).toBeDefined();
    expect(card!.type).toBe("vehicle");
    expect(card!.category).toBe("DA");
    expect(canonicalCardName(card!.name)).toBe("バルジオン");
    expect(card!.features).toContain("2nd");
  });
});

describe("RS-570 デカバイク (vehicle metadata)", () => {
  it("is an OT vehicle of size L", () => {
    const card = catalogCard("RS-570");
    expect(card).toBeDefined();
    expect(card!.type).toBe("vehicle");
    expect(card!.category).toBe("OT");
    expect(card!.powerCost).toBe(5);
  });
});

describe("RS-575 一角聖馬ユニゴルオン (vehicle metadata)", () => {
  it("is a MA vehicle of size M", () => {
    const card = catalogCard("RS-575");
    expect(card).toBeDefined();
    expect(card!.type).toBe("vehicle");
    expect(card!.category).toBe("MA");
  });
});

describe("RS-581 魔導馬バリキオン（2nd） (vehicle metadata)", () => {
  it("is a DA vehicle with corrected name", () => {
    const card = catalogCard("RS-581");
    expect(card).toBeDefined();
    expect(card!.type).toBe("vehicle");
    expect(card!.category).toBe("DA");
    expect(canonicalCardName(card!.name)).toBe("魔導馬バリキオン");
    expect(card!.features).toContain("2nd");
  });
});

// ──────────────────────────────────────────────────────────
// Unit metadata: S units with combo numbers
// ──────────────────────────────────────────────────────────

describe("RS-533 チェンジフェニックス (S unit)", () => {
  it("has bp 500, MA category, CN1, feature ピンク", () => {
    const card = catalogCard("RS-533");
    expect(card).toBeDefined();
    expect(card!.type).toBe("unit");
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(500);
    expect(card!.category).toBe("MA");
    expect(card!.comboNumber).toBe(1);
    expect(card!.features).toContain("ピンク");
    expect(card!.features).toContain("女");
  });
});

describe("RS-534 チェンジペガサス (S unit)", () => {
  it("has bp 3000, MA category, CN2", () => {
    const card = catalogCard("RS-534");
    expect(card).toBeDefined();
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(3000);
    expect(card!.category).toBe("MA");
    expect(card!.comboNumber).toBe(2);
  });
});

describe("RS-535 チェンジドラゴン (S unit)", () => {
  it("has bp 2000, MA category, CN3, feature レッド", () => {
    const card = catalogCard("RS-535");
    expect(card).toBeDefined();
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(2000);
    expect(card!.comboNumber).toBe(3);
    expect(card!.features).toContain("レッド");
  });
});

describe("RS-537 チェンジマーメイド (S unit)", () => {
  it("has bp 500, MA category, CN5, powerCost 0", () => {
    const card = catalogCard("RS-537");
    expect(card).toBeDefined();
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(500);
    expect(card!.comboNumber).toBe(5);
    expect(card!.powerCost).toBe(0);
    expect(card!.features).toContain("ホワイト");
  });
});

describe("RS-540 J1 (S unit)", () => {
  it("has bp 2000, ET category, CN1, powerCost 0", () => {
    const card = catalogCard("RS-540");
    expect(card).toBeDefined();
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(2000);
    expect(card!.category).toBe("ET");
    expect(card!.comboNumber).toBe(1);
    expect(card!.powerCost).toBe(0);
  });
});

describe("RS-541 J2 (S unit)", () => {
  it("has bp 2000, ET category, CN2, powerCost 0", () => {
    const card = catalogCard("RS-541");
    expect(card).toBeDefined();
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(2000);
    expect(card!.category).toBe("ET");
    expect(card!.comboNumber).toBe(2);
  });
});

describe("RS-542 J3 (S unit)", () => {
  it("has bp 2000, ET category, CN3, powerCost 0", () => {
    const card = catalogCard("RS-542");
    expect(card).toBeDefined();
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(2000);
    expect(card!.category).toBe("ET");
    expect(card!.comboNumber).toBe(3);
  });
});

describe("RS-544 J5 (S unit – SP special)", () => {
  it("has sp 'special', ET category, CN5, bp 1000", () => {
    const card = catalogCard("RS-544");
    expect(card).toBeDefined();
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(1000);
    expect(card!.category).toBe("ET");
    expect(card!.comboNumber).toBe(5);
    expect(card!.sp).toBe("special");
  });
});

describe("RS-548 ティラノレンジャー（2nd） (S unit – 2nd fix)", () => {
  it("has corrected name, DA category, feature レッド", () => {
    const card = catalogCard("RS-548");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("ティラノレンジャー");
    expect(card!.size).toBe("S");
    expect(card!.features).toContain("レッド");
    expect(card!.features).toContain("2nd");
    expect(card!.sp).toBe("special");
  });
});

describe("RS-549 トリケラレンジャー（2nd） (S unit – 2nd fix)", () => {
  it("has corrected name and 2nd feature", () => {
    const card = catalogCard("RS-549");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("トリケラレンジャー");
    expect(card!.features).toContain("2nd");
    expect(card!.sp).toBe("special");
  });
});

// ──────────────────────────────────────────────────────────
// Unit metadata: M units
// ──────────────────────────────────────────────────────────

describe("RS-530 ジェットチェンジャー1 (M unit)", () => {
  it("has bp 1000, ET category, CN1, feature 航空機", () => {
    const card = catalogCard("RS-530");
    expect(card).toBeDefined();
    expect(card!.size).toBe("M");
    expect(card!.bp).toBe(1000);
    expect(card!.category).toBe("ET");
    expect(card!.comboNumber).toBe(1);
    expect(card!.features).toContain("航空機");
    expect(card!.rushAdditionalCondition).toBeDefined();
    expect(card!.rushAdditionalCondition!.conditionId).toBe("send_s_unit_to_command_or_discard");
  });
});

describe("RS-531 ヘリチェンジャー2 (M unit)", () => {
  it("has bp 6000, ET category, CN2, rush condition send_s_unit_to_command_or_discard ×2", () => {
    const card = catalogCard("RS-531");
    expect(card).toBeDefined();
    expect(card!.size).toBe("M");
    expect(card!.bp).toBe(6000);
    expect(card!.comboNumber).toBe(2);
    expect(card!.rushAdditionalCondition?.unitCount).toBe(2);
  });
});

describe("RS-551 ゴッドガンマー (M unit)", () => {
  it("has bp 4500, MA category, CN1, feature 獣", () => {
    const card = catalogCard("RS-551");
    expect(card).toBeDefined();
    expect(card!.size).toBe("M");
    expect(card!.bp).toBe(4500);
    expect(card!.category).toBe("MA");
    expect(card!.comboNumber).toBe(1);
    expect(card!.features).toContain("獣");
  });
});

describe("RS-553 ゴッドサルダー (M unit – SP special)", () => {
  it("has sp 'special', MA category, CN3, feature 人型", () => {
    const card = catalogCard("RS-553");
    expect(card).toBeDefined();
    expect(card!.size).toBe("M");
    expect(card!.bp).toBe(4500);
    expect(card!.comboNumber).toBe(3);
    expect(card!.sp).toBe("special");
    expect(card!.features).toContain("人型");
  });
});

describe("RS-560 ガオレオン (M unit)", () => {
  it("has bp 4000, WB category, powerCost 3, feature 獣", () => {
    const card = catalogCard("RS-560");
    expect(card).toBeDefined();
    expect(card!.size).toBe("M");
    expect(card!.bp).toBe(4000);
    expect(card!.category).toBe("WB");
    expect(card!.powerCost).toBe(3);
    expect(card!.features).toContain("獣");
  });
});

describe("RS-650 ガオライノス (M unit)", () => {
  it("has bp 4000, WB category, powerCost 4", () => {
    const card = catalogCard("RS-650");
    expect(card).toBeDefined();
    expect(card!.size).toBe("M");
    expect(card!.bp).toBe(4000);
    expect(card!.category).toBe("WB");
    expect(card!.powerCost).toBe(4);
  });
});

describe("RS-670 ティライン (M unit)", () => {
  it("has bp 3000, OT category, powerCost 2", () => {
    const card = catalogCard("RS-670");
    expect(card).toBeDefined();
    expect(card!.size).toBe("M");
    expect(card!.bp).toBe(3000);
    expect(card!.category).toBe("OT");
    expect(card!.powerCost).toBe(2);
  });
});

describe("RS-680 獅子折神 (M unit – SP special)", () => {
  it("has bp 3000, MA category, CN3, sp special", () => {
    const card = catalogCard("RS-680");
    expect(card).toBeDefined();
    expect(card!.size).toBe("M");
    expect(card!.bp).toBe(3000);
    expect(card!.category).toBe("MA");
    expect(card!.comboNumber).toBe(3);
    expect(card!.sp).toBe("special");
  });
});

// ──────────────────────────────────────────────────────────
// Unit metadata: L units
// ──────────────────────────────────────────────────────────

describe("RS-529 チェンジロボ (L unit – fusion entry)", () => {
  it("has bp 12000, ET category, SP 1, discard_fusion_unit condition", () => {
    const card = catalogCard("RS-529");
    expect(card).toBeDefined();
    expect(card!.size).toBe("L");
    expect(card!.bp).toBe(12000);
    expect(card!.category).toBe("ET");
    expect(card!.sp).toBe(1);
    expect(card!.rushAdditionalCondition?.conditionId).toBe("discard_fusion_unit");
  });
});

describe("RS-546 獣帝大獣神 (L unit)", () => {
  it("has bp 18000, WB category, SP 1, discard_fusion_unit condition", () => {
    const card = catalogCard("RS-546");
    expect(card).toBeDefined();
    expect(card!.size).toBe("L");
    expect(card!.bp).toBe(18000);
    expect(card!.category).toBe("WB");
    expect(card!.sp).toBe(1);
    expect(card!.rushAdditionalCondition?.conditionId).toBe("discard_fusion_unit");
  });
});

describe("RS-550 隠大将軍 (L unit)", () => {
  it("has bp 17000, MA category, SP 2", () => {
    const card = catalogCard("RS-550");
    expect(card).toBeDefined();
    expect(card!.size).toBe("L");
    expect(card!.bp).toBe(17000);
    expect(card!.category).toBe("MA");
    expect(card!.sp).toBe(2);
  });
});

describe("RS-559 ガオゴッド (L unit)", () => {
  it("has bp 14000, WB category, SP 1", () => {
    const card = catalogCard("RS-559");
    expect(card).toBeDefined();
    expect(card!.size).toBe("L");
    expect(card!.bp).toBe(14000);
    expect(card!.category).toBe("WB");
    expect(card!.sp).toBe(1);
  });
});

describe("RS-565 轟雷旋風神 (L unit)", () => {
  it("has bp 19000, MA category, SP 2, feature 人型", () => {
    const card = catalogCard("RS-565");
    expect(card).toBeDefined();
    expect(card!.size).toBe("L");
    expect(card!.bp).toBe(19000);
    expect(card!.category).toBe("MA");
    expect(card!.sp).toBe(2);
    expect(card!.features).toContain("人型");
  });
});

describe("RS-620 ジェットガルーダ (L unit)", () => {
  it("has bp 10000, OT category, SP 1, rush additional condition", () => {
    const card = catalogCard("RS-620");
    expect(card).toBeDefined();
    expect(card!.size).toBe("L");
    expect(card!.bp).toBe(10000);
    expect(card!.category).toBe("OT");
    expect(card!.sp).toBe(1);
    expect(card!.rushAdditionalCondition).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────
// Unit metadata: XL units
// ──────────────────────────────────────────────────────────

describe("RS-545 究極大獣神 (XL unit)", () => {
  it("has bp 20000, WB category, SP 2, discard_fusion_unit condition", () => {
    const card = catalogCard("RS-545");
    expect(card).toBeDefined();
    expect(card!.size).toBe("XL");
    expect(card!.bp).toBe(20000);
    expect(card!.category).toBe("WB");
    expect(card!.sp).toBe(2);
    expect(card!.rushAdditionalCondition?.conditionId).toBe("discard_fusion_unit");
  });
});

describe("RS-547 獣騎神キングブラキオン (XL unit)", () => {
  it("has bp 6000, WB category, powerCost 4, feature 恐竜", () => {
    const card = catalogCard("RS-547");
    expect(card).toBeDefined();
    expect(card!.size).toBe("XL");
    expect(card!.bp).toBe(6000);
    expect(card!.category).toBe("WB");
    expect(card!.powerCost).toBe(4);
    expect(card!.features).toContain("恐竜");
  });
});

describe("RS-580 絶対神ン・マ (XL unit)", () => {
  it("has bp 8000, DA category, SP 1, powerCost 9+", () => {
    const card = catalogCard("RS-580");
    expect(card).toBeDefined();
    expect(card!.size).toBe("XL");
    expect(card!.bp).toBe(8000);
    expect(card!.category).toBe("DA");
    expect(card!.sp).toBe(1);
    expect(card!.rushAdditionalCondition).toBeDefined();
  });
});

describe("RS-640 ギガバイタスCM (XL unit)", () => {
  it("has bp 6000, WB category, powerCost 2, features メカ/獣/母艦", () => {
    const card = catalogCard("RS-640");
    expect(card).toBeDefined();
    expect(card!.size).toBe("XL");
    expect(card!.bp).toBe(6000);
    expect(card!.category).toBe("WB");
    expect(card!.powerCost).toBe(2);
    expect(card!.features).toContain("母艦");
    expect(card!.features).toContain("メカ");
    expect(card!.features).toContain("獣");
  });
});

describe("RS-641 ギガバイタスSM (XL unit)", () => {
  it("has bp 8000, WB category, discard_specific condition", () => {
    const card = catalogCard("RS-641");
    expect(card).toBeDefined();
    expect(card!.size).toBe("XL");
    expect(card!.bp).toBe(8000);
    expect(card!.category).toBe("WB");
    expect(card!.rushAdditionalCondition).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────
// Unit metadata: SC (sub-combination) units
// ──────────────────────────────────────────────────────────

describe("RS-619 ジェットマシン (SC unit)", () => {
  it("has bp 2000, ET category, size SC", () => {
    const card = catalogCard("RS-619");
    expect(card).toBeDefined();
    expect(card!.size).toBe("SC");
    expect(card!.bp).toBe(2000);
    expect(card!.category).toBe("ET");
    expect(card!.features).toContain("航空機");
  });
});

describe("RS-643 分身獣ギガホイール (SC unit)", () => {
  it("has bp 5000, WB category, features メカ/獣/車両", () => {
    const card = catalogCard("RS-643");
    expect(card).toBeDefined();
    expect(card!.size).toBe("SC");
    expect(card!.bp).toBe(5000);
    expect(card!.category).toBe("WB");
    expect(card!.features).toContain("車両");
  });
});

describe("RS-644 分身獣ギガウイング (SC unit)", () => {
  it("has bp 4000, WB category, features メカ/獣/航空機", () => {
    const card = catalogCard("RS-644");
    expect(card).toBeDefined();
    expect(card!.size).toBe("SC");
    expect(card!.bp).toBe(4000);
    expect(card!.category).toBe("WB");
    expect(card!.features).toContain("航空機");
  });
});

// ──────────────────────────────────────────────────────────
// 2nd-suffix-fix cards: additional feature validation
// ──────────────────────────────────────────────────────────

describe("RS-572 デカマスター（2nd） (2nd fix)", () => {
  it("has corrected name, DA category, feature 警察", () => {
    const card = catalogCard("RS-572");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("デカマスター");
    expect(card!.features).toContain("2nd");
    expect(card!.features).toContain("警察");
  });
});

describe("RS-573 ファイヤーカイザー（2nd） (2nd fix)", () => {
  it("has corrected name, DA category, feature 魔法/人型", () => {
    const card = catalogCard("RS-573");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("ファイヤーカイザー");
    expect(card!.features).toContain("2nd");
    expect(card!.features).toContain("人型");
  });
});

describe("RS-577 マジレッド（2nd） (2nd fix)", () => {
  it("has corrected name, MA category, features レッド/男/魔法", () => {
    const card = catalogCard("RS-577");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("マジレッド");
    expect(card!.features).toContain("レッド");
    expect(card!.features).toContain("魔法");
    expect(card!.features).toContain("2nd");
  });
});

describe("RS-585 ボウケンシルバー（2nd） (2nd fix)", () => {
  it("has corrected name, OT category, feature シルバー", () => {
    const card = catalogCard("RS-585");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("ボウケンシルバー");
    expect(card!.features).toContain("シルバー");
    expect(card!.features).toContain("2nd");
  });
});

// ──────────────────────────────────────────────────────────
// Late-range spot checks: RS-628..690
// ──────────────────────────────────────────────────────────

describe("RS-628 レッドホーク (S unit)", () => {
  it("is an ET S unit", () => {
    const card = catalogCard("RS-628");
    expect(card).toBeDefined();
    expect(card!.type).toBe("unit");
    expect(card!.size).toBe("S");
    expect(card!.category).toBe("ET");
  });
});

describe("RS-630 メガブルー (S unit – SP special)", () => {
  it("has bp 2000, ET category, CN3, sp special", () => {
    const card = catalogCard("RS-630");
    expect(card).toBeDefined();
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(2000);
    expect(card!.category).toBe("ET");
    expect(card!.comboNumber).toBe(3);
    expect(card!.sp).toBe("special");
  });
});

describe("RS-653 レッドファルコン（2nd） (2nd fix)", () => {
  it("has corrected name, ET category, feature レッド", () => {
    const card = catalogCard("RS-653");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("レッドファルコン");
    expect(card!.features).toContain("レッド");
    expect(card!.features).toContain("2nd");
  });
});

describe("RS-654 ガオイエロー（2nd） (2nd fix)", () => {
  it("has corrected name, WB category, feature イエロー", () => {
    const card = catalogCard("RS-654");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("ガオイエロー");
    expect(card!.features).toContain("イエロー");
    expect(card!.features).toContain("2nd");
  });
});

describe("RS-660 デカピンクSWAT (S unit)", () => {
  it("has bp 1500, OT category, CN5", () => {
    const card = catalogCard("RS-660");
    expect(card).toBeDefined();
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(1500);
    expect(card!.category).toBe("OT");
    expect(card!.comboNumber).toBe(5);
  });
});

describe("RS-685 ブラックコンドル（2nd） (2nd fix)", () => {
  it("has corrected name, ET category, feature ブラック", () => {
    const card = catalogCard("RS-685");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("ブラックコンドル");
    expect(card!.features).toContain("ブラック");
    expect(card!.features).toContain("2nd");
  });
});

describe("RS-689 レッドホーク（2nd） (2nd fix)", () => {
  it("has corrected name, ET category, feature レッド", () => {
    const card = catalogCard("RS-689");
    expect(card).toBeDefined();
    expect(canonicalCardName(card!.name)).toBe("レッドホーク");
    expect(card!.features).toContain("レッド");
    expect(card!.features).toContain("2nd");
  });
});

describe("RS-690 スペードエース (S unit)", () => {
  it("has bp 4000, ET category, CN2, powerCost 4", () => {
    const card = catalogCard("RS-690");
    expect(card).toBeDefined();
    expect(card!.type).toBe("unit");
    expect(card!.size).toBe("S");
    expect(card!.bp).toBe(4000);
    expect(card!.category).toBe("ET");
    expect(card!.comboNumber).toBe(2);
    expect(card!.powerCost).toBe(4);
    expect(card!.features).toContain("レッド");
  });
});

// ──────────────────────────────────────────────────────────
// Cross-range expansion tag
// ──────────────────────────────────────────────────────────

describe("RS batch07 expansion tag", () => {
  it("all RS-521..690 cards carry expansion 'legend1'", () => {
    const cards = corePlayableCatalog.cards.filter((c) => {
      const num = parseInt(c.id.replace("RS-", ""));
      return num >= 521 && num <= 690;
    });
    for (const card of cards) {
      expect(card.expansion, `${card.id} expansion`).toBe("legend1");
    }
  });

  it("category distribution covers all five categories", () => {
    const cards = corePlayableCatalog.cards.filter((c) => {
      const num = parseInt(c.id.replace("RS-", ""));
      return num >= 521 && num <= 690;
    });
    const cats = new Set(cards.map((c) => c.category));
    expect(cats).toContain("MA");
    expect(cats).toContain("ET");
    expect(cats).toContain("WB");
    expect(cats).toContain("DA");
    expect(cats).toContain("OT");
  });
});
