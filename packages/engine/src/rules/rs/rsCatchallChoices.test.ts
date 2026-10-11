import { describe, expect, it } from "vitest";
import { parseEnemyTargetZone } from "./rsCatchallChoices";

describe("parseEnemyTargetZone（撃破等の候補エリアは対象の表記どおり）", () => {
  it("「これをラッシュしたとき」の「ラッシュ」はエリアの指定ではない — エリアの指定がなければ両方（R-ZONE-03）", () => {
    expect(parseEnemyTargetZone("これをラッシュしたとき、敵軍ユニットを1体選んで撃破してもよい。")).toBe("both");
    expect(parseEnemyTargetZone("自軍ターン中、これがバトルエリアに出たとき、BP8000以下の敵軍ユニットを1体選び撃破する。（この効果は、自軍ラッシュフェイズ中、…）")).toBe("both");
  });

  it("「敵軍ラッシュエリア」「敵軍バトルエリア」はそのエリアだけ、両方の表記なら両方", () => {
    expect(parseEnemyTargetZone("自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからBP4000以下のユニットを1体選び撃破する。")).toBe("rush");
    expect(parseEnemyTargetZone("敵軍バトルエリアから、必要パワーに「+」を持たないユニットを1体選び")).toBe("battle");
    expect(parseEnemyTargetZone("敵軍ラッシュエリアかバトルエリアのユニットを1体選び撃破する。")).toBe("both");
  });
});
