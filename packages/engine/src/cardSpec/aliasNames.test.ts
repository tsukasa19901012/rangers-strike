/**
 * 「※これは「X」としてつかえる」カード（XG1-070 ディケイド カブトRF 等 43枚）が、「X」を名指しするラッシュの追加条件・合体の素材になるか。
 * 出典: atwiki/page-1668 Q1「「これは「○○○○（カード名）」として使える。」とあるカードは、山札、手札、エリア、ゾーン、常駐置き場、捨札などの
 * 全ての場にあるとき常に有効であり、特定のカード名を指定する効果の対象として選ぶことが出来ます」。
 * 組み合わせはカタログから「としてつかえる」の名前を追加条件・合体―行に含むカードを洗い出したもの（名前違いの部分一致「キバEF」「クウガRM」は除く）。
 * XG6-003（キラーオー（または A＋B））・XG3-005 は cardSpec/XG6-001-022.c・XG3-002-021.a で確かめている。
 * カード固有の効果（音角・V3・新サイクロン号・レッドアイ・クウガゴウラム・超ドリル進化 等）は各 cardSpec に置く。
 */
import { describe, expect, it } from "vitest";
import { inst, powerCards, releasedCat, resolveAll, rushBoard, rushFromHand, rushVia, zoneOf } from "./XG2-062-081.helpers";

/** [ラッシュするカード, としてつかえるカード, 追加条件, 必要パワー, ほかの合体ユニット, 行き先] */
const CASES: [string, string, string, number, string[], ("command" | "discard")?][] = [
  ["PK-012", "XG1-065", "zord_down_discard_named", 10, []],
  ["PK-012", "XG7-036", "zord_down_discard_named", 10, []],
  ["RK-203", "XG1-066", "zord_down_discard_named", 7, []],
  ["RK-203", "XG4-083", "zord_down_discard_named", 7, []],
  ["RK-206", "XG1-066", "zord_down_discard_named", 7, []],
  ["RK-206", "XG4-083", "zord_down_discard_named", 7, []],
  ["RK-211", "XG1-067", "zord_down_discard_named", 7, []],
  ["RK-222", "XG1-069", "zord_down_discard_named", 7, []],
  ["RK-279", "XG7-036", "zord_down_discard_named", 10, []],
  ["RK-313", "XG1-072", "zord_down_discard_named", 7, []],
  ["RK-333", "XG1-065", "zord_down_discard_named", 10, []],
  ["RK-333", "XG7-036", "zord_down_discard_named", 10, []],
  ["RS-050", "XG7-012", "fusion", 7, ["RS-052", "RS-053"]],
  ["RS-113", "RS-057", "fusion", 6, ["RS-114"]],
  ["RS-113", "RS-577", "fusion", 6, ["RS-114"]],
  ["RS-113", "XG7-014", "fusion", 6, ["RS-114"]],
  ["RS-151", "XG7-010", "fusion", 6, ["RS-153", "RS-154", "RS-155", "RS-156"]],
  ["RS-226", "XG6-018", "fusion", 6, []],
  ["RS-382", "XG3-006", "fusion", 7, ["RS-383", "RS-385"]],
  ["RS-573", "RS-057", "fusion", 5, ["RS-114"]],
  ["RS-573", "RS-577", "fusion", 5, ["RS-114"]],
  ["RS-573", "XG7-014", "fusion", 5, ["RS-114"]],
  ["RS-574", "RS-057", "fusion", 4, ["RS-575"]],
  ["RS-574", "RS-577", "fusion", 4, ["RS-575"]],
  ["RS-574", "XG7-014", "fusion", 4, ["RS-575"]],
  ["SR-001", "XG7-010", "fusion", 6, ["RS-153", "RS-154", "RS-155", "RS-156"]],
  ["SX-001", "XG1-071", "send_s_unit_to_power", 5, []],
  ["XG1-028", "XG7-012", "fusion", 5, ["RS-052"]],
  ["XG1-052", "XG1-064", "zord_down_discard_named", 7, []],
  ["XG1-059", "XG1-067", "discard_named_unit", 6, []],
  ["XG2-056", "XG1-066", "discard_named_unit", 4, []],
  ["XG2-056", "XG1-066", "discard_named_unit", 4, [], "command"],
  ["XG2-056", "XG4-083", "discard_named_unit", 4, []],
  ["XG2-056", "XG4-083", "discard_named_unit", 4, [], "command"],
  ["XG2-062", "XG1-069", "discard_named_unit", 6, []],
  ["XG2-065", "XG1-070", "send_s_unit_to_power", 7, []],
  ["XG2-065", "XG4-079", "send_s_unit_to_power", 7, []],
  ["XG2-074", "XG7-042", "return_named_to_hand", 5, []],
  ["XG2-080", "XG1-065", "return_named_to_hand", 5, []],
  ["XG2-080", "XG7-036", "return_named_to_hand", 5, []],
  ["XG3-057", "XG1-069", "return_named_to_hand", 2, []],
  ["XG3-075", "XG7-042", "fusion", 7, ["RK-187"]],
  ["XG6-005", "RS-057", "fusion", 4, ["RS-575"]],
  ["XG6-005", "RS-577", "fusion", 4, ["RS-575"]],
  ["XG6-005", "XG7-014", "fusion", 4, ["RS-575"]],
  ["XG6-025", "XG6-024", "fusion", 5, ["XG6-027", "XG6-028"]],
  ["RS-056", "XG7-022", "fusion", 6, ["RS-058", "RS-061"]],
  ["RS-070", "XG7-022", "fusion", 8, ["RS-057", "RS-058", "RS-061"]],
  ["RS-070", "RS-059", "fusion", 8, ["RS-057", "RS-058", "RS-060", "RS-061"]],
  ["RS-084", "RS-085", "fusion", 8, ["RS-086", "RS-087", "RS-088", "RS-089"]],
  ["RS-513", "RS-455", "fusion", 8, ["RS-456", "RS-457", "RS-458", "RS-459"]],
];

describe("「※これは「X」としてつかえる」を「X」を名指しする追加条件・合体の素材にする", () => {
  for (const [rusher, alias, kind, power, others, dest = "discard"] of CASES) {
    it(`${rusher}: ${kind} — ${alias} を素材にしてラッシュできる（${dest}）（出典: atwiki/page-1668 Q1）`, () => {
      // コマンドゾーンは4枚（コマンドゾーンに送る行き先の空きを残す）。
      const command = [...releasedCat("WB", 1), ...releasedCat("MA", 1), ...releasedCat("OT", 1), ...releasedCat("ET", 1)];
      // ゾードダウン（「…捨札にすれば必要パワー0になる」）はパワーなしで確かめる。
      const s = rushBoard({
        hand: [inst(rusher, "x")],
        rush: [inst(alias, "a"), ...others.map((o, i) => inst(o, `o${i}`))],
        power: powerCards(kind.startsWith("zord_down") ? 0 : power),
        command,
      });
      const material = `${alias}:a`;
      const viaAction = kind.startsWith("zord_down") || kind === "return_named_to_hand";
      const r = viaAction
        ? rushVia(s, "player1", `${rusher}:x`, (a) => JSON.stringify(a).includes(material))
        : rushFromHand(s, "player1", `${rusher}:x`, { materials: [material], destination: dest });
      expect(r.ok, r.error).toBe(true);
      const t = viaAction ? resolveAll(r.state) : r.state;
      expect(zoneOf(t, "player1", `${rusher}:x`)).toMatch(/rush|battle/);
      const expected = kind === "return_named_to_hand" ? "hand" : kind === "send_s_unit_to_power" ? "power" : dest;
      expect(zoneOf(t, "player1", material)).toBe(expected);
    });
  }
});
