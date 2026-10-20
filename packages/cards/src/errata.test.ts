import { describe, expect, it } from "vitest";
import { getCardEffect } from "./effects";
import {
  hasBattleEntryHoldNote,
  listBattleEntryHoldCardIds,
  requiredHeldCommandsForMBattle,
} from "./errata";
import { getBattleEntryHoldCount, getUnitEffectBlock } from "./unitEffects";
import { getCardById } from "./catalog";
import { getNumberComboEffect } from "./comboEffects";
import { loadCardById } from "./dsl/loader";

describe("errata", () => {
  it("applies RS-018 errata text (exclude attacker from substitute)", () => {
    const effect = getCardEffect("RS-018");
    expect(effect?.text).toContain("アタックしてきたユニット以外");
  });

  it("RS-067 is permanent with discard-on-use text", () => {
    const effect = getCardEffect("RS-067");
    expect(effect?.kind).toBe("permanent");
    expect(effect?.text).toContain("捨札にする");
  });

  it("RS-010 uses official prism power text", () => {
    const effect = getCardEffect("RS-010");
    expect(effect?.kind).toBe("permanent");
    expect(effect?.text).toContain("自分がカードを使用するとき発動できる");
    expect(effect?.text).toContain("自軍コマンドを2つホールドすることで");
    expect(effect?.text).toContain("必要なカテゴリのコマンドを1つホールドしたことにできる");
  });

  it("stacks RS-051 battle entry hold with lightning gravity (Q3)", () => {
    expect(getBattleEntryHoldCount("RS-051")).toBe(1);
    expect(requiredHeldCommandsForMBattle(1, "RS-051")).toBe(2);
    expect(requiredHeldCommandsForMBattle(2, "RS-053")).toBe(3);
  });

  it("lists all battle entry hold cards from unit effect notes", () => {
    const ids = listBattleEntryHoldCardIds();
    // レジェンド1のゾード合体パートナー
    for (const id of [
      "RS-035",
      "RS-036",
      "RS-037",
      "RS-038",
      "RS-039",
      "RS-051",
      "RS-052",
      "RS-053",
      "RS-152",
      "RS-153",
      "RS-154",
      "RS-155",
      "RS-156",
      "RS-157",
      "RS-158",
      "RS-159",
      "RS-167",
      "RS-168",
    ]) {
      expect(ids, id).toContain(id);
    }
    // core 昇格した RK / 4弾以降 / エラッタで注記が復元されたカード
    for (const id of ["RK-034", "RS-227", "RM-051"]) {
      expect(ids, id).toContain(id);
    }
    // 全件が hold 注記を持つ
    for (const id of ids) {
      expect(getBattleEntryHoldCount(id), id).toBeGreaterThan(0);
    }
  });

  it.each([
    "RS-035",
    "RS-036",
    "RS-037",
    "RS-038",
    "RS-039",
    "RS-051",
    "RS-052",
    "RS-053",
  ] as const)("detects battle entry hold from card note (%s)", (cardId) => {
    expect(hasBattleEntryHoldNote(cardId)).toBe(true);
    expect(getBattleEntryHoldCount(cardId)).toBe(1);
  });
});

/** E14: 公式エラッタ・読み替えの修正後テキスト（docs/rules/08-errata.md）がカタログと効果文に入っている。 */
describe("E14: エラッタ修正後テキスト", () => {
  const cases: Array<[rule: string, cardId: string, mustContain: string, mustNotContain: string]> = [
    ["R-ERR-RS003", "RS-003", "自軍コマンドを2つホールドして、", "ホールドするごとに"],
    ["R-ERR-RS043", "RS-043", "【ジャッジメントソード】自軍ターン中、これがバトルエリアに出たとき、", "捨て札"],
    ["R-ERR-RS051", "RS-051", "【超ドリル進化】自軍ターン中、これがバトルエリアに出たとき、", "「爆竜ティラノサウルス」を1枚"],
    ["R-ERR-RS052", "RS-052", "このユニットをかわりに捨札にしてもよい", "これをかわりに"],
    ["R-ERR-RS058", "RS-058", "これはアタックするとき、敵軍ラッシュエリアのユニットにアタックできる", "「SP1」これは敵軍"],
    ["R-ERR-RS065", "RS-065", "これが「SP1」以上または「SP！」のあるユニットを撃破したとき", "ストライクできるユニット"],
    ["R-ERR-RS106", "RS-106", "これが敵軍ユニットにアタックできるとき、次の効果を発動できる。", "アタックするかわりに"],
    ["R-ERR-RS118", "RS-118", "（Sユニットの下に重ねたカードは、そのSユニットに重ねたまま置きかえる）", "\u0000"],
  ];

  it.each(cases)("%s: %s のカタログ本文が修正後", (_rule, cardId, mustContain, mustNotContain) => {
    const text = getCardById(cardId)?.text ?? "";
    expect(text).toContain(mustContain);
    expect(text).not.toContain(mustNotContain);
    expect(loadCardById(cardId).text).toBe(text);
  });

  it.each(cases.filter(([, id]) => id !== "RS-003"))(
    "%s: %s の効果文（UI・エンジン参照）も修正後",
    (_rule, cardId, mustContain) => {
      const block = getUnitEffectBlock(cardId);
      const joined = block?.namedEffects.map((e) => e.text).join("\n") ?? "";
      expect(joined).toContain(mustContain.replace(/^【[^】]+】/, ""));
    },
  );

  it("R-ERR-RS003: バトルダンスの効果文は「2つホールドして」", () => {
    expect(getCardEffect("RS-003")?.text).toContain("自軍コマンドを2つホールドして、");
  });

  it("R-ERR-RS036: 【モスブリザード】はリリース状態のコマンドを2つ（1つなら1つ）", () => {
    expect(getCardById("RS-036")?.text).toContain("リリース状態のコマンドを2つ選びホールドする。1つしかなければ1つ選びホールドする。");
  });

  it("R-ERR-RS365: 追加条件は「これ以外の自分の手札を全て捨札にする」", () => {
    expect(getCardById("RS-365")?.rushAdditionalCondition?.text).toBe("これ以外の自分の手札を全て捨札にする");
    expect(getCardById("RS-365")?.rushAdditionalCondition?.conditionId).toBe("discard_all_hand");
  });

  it("R-ERR-RK043: 【突入】は「このターン、」次にラッシュするミラーライダー", () => {
    const doc = loadCardById("RK-043");
    expect(doc.text).toContain("そうしたとき、このターン、次にラッシュする特徴「ミラーライダー」");
    expect(doc.effects?.find((e) => e.name === "突入")?.text).toContain("このターン、次にラッシュする");
  });

  it("R-ERR-RK125: wiki の注記が本文・効果に混入していない", () => {
    const doc = loadCardById("RK-125");
    expect(doc.text).not.toContain("赤文字");
    expect(doc.effects?.some((e) => e.text?.includes("赤文字"))).toBe(false);
    expect(doc.text).toContain("自分の手札を3枚選び");
  });

  it("R-ERR-RS065: 【一点突破】は NC 効果", () => {
    expect(getNumberComboEffect("RS-065")).toBe("focused_breakthrough");
  });
});
