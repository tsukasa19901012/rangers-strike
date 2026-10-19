/**
 * カード別スペック: 効果で敵軍のユニットを持ち主のコマンドゾーンに置くときのチェイス（R-KW-CHASE-01）。
 *
 * R-KW-CHASE-01（docs/rules/07-keywords.md。atwiki/page-1292）:「これがライド中にユニットでなくなる時、代わりにこれがライドしているビークルを
 * 捨札にしてから、ライドされていない自軍ビークルにライドさせてもよい」。本文「バトルでの撃破のみならず、パワー送りやコマンド送りなどにも
 * 対応できる」。チェイスを使うかは、そのユニットの持ち主が選ぶ。
 * 以前は RM-044・RM-047・RM-048・RM-050 等がコマンドゾーンへ直接移し、チェイスの機会を出していなかった
 * （docs/verification/rm-bk-judgments.md RM-043〜062 の 🔴【2026-10-19 訂正】）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  cardIn,
  deckCards,
  heldN,
  inst,
  legal,
  mount,
  ncEnter,
  pick,
  resolveAll,
  rideOff,
  ridingPair,
  settle,
  st,
  sUnit,
  vehicleCard,
  zoneOf,
  PLAIN_VEHICLE,
} from "./RM3-043-062.helpers";

const CHASE_TEXT =
  "※チェイス（これがライド中にユニットでなくなる時、代わりにこれがライドしているビークルを捨札にしてから、ライドされていない自軍ビークルにライドさせてもよい）";
/** RC・チェイスを持つ敵軍の S ユニット（DA。特徴「男」「女」なし）。 */
const CHASER_S = sUnit("SPEC-CHASER-S", { category: "DA", bp: 1000, comboNumber: "RC", text: CHASE_TEXT, features: ["メカ"] });
/** RC・チェイスを持つ敵軍の M ユニット（DA）。 */
const CHASER_M = sUnit("SPEC-CHASER-M", { category: "DA", bp: 3000, size: "M", comboNumber: "RC", text: CHASE_TEXT, features: ["メカ"] });
const PLAIN_S = sUnit("SPEC-PLAIN-S", { category: "DA", bp: 1000, features: ["メカ"] });
const M_VEHICLE = vehicleCard("SPEC-MV", { size: "M" });
const EXTRA = [CHASER_S, CHASER_M, PLAIN_S, M_VEHICLE, PLAIN_VEHICLE];

const chaseOffered = (s: GameState) => legal(s).some((a) => a.type === "resolve_chase" && a.playerId === "player2");
const resolveChase = (s: GameState, vehicle: string) => act(s, { type: "resolve_chase", playerId: "player2", newVehicleInstanceId: vehicle });
const passChase = (s: GameState) => act(s, { type: "pass_chase", playerId: "player2" });

/** 敵軍: ライド中のチェイス持ち S（SPEC-VEHICLE:ev に乗る）・ラッシュエリアにライドされていないビークル。 */
const RIDING_S = { battle: ridingPair("SPEC-CHASER-S", "c", "SPEC-VEHICLE", "ev"), rush: [inst("SPEC-VEHICLE", "spare")] };

describe("RM-048 隊員コード153 ショウ【フレイムスローワー】× チェイス（R-KW-CHASE-01）", () => {
  // 本文「敵軍バトルエリアから、DAまたはOTを持つSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。」（atwiki/page-886）
  const chosen = (p2: Partial<GameState["players"]["player2"]> = RIDING_S) => settle(pick(ncEnter("RM-048:sh", 0, {}, { deck: deckCards(5, "e"), ...p2 }, EXTRA), "SPEC-CHASER-S:c"));

  it("RM-048: ライド中のチェイス持ちを選ぶと、持ち主（相手）にチェイスの機会が出る（出典: R-KW-CHASE-01「コマンド送りなどにも対応できる」・atwiki/page-886「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = chosen();
    expect(chaseOffered(s)).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-CHASER-S:c")).toBe("battle");
  });

  it("RM-048: チェイスを使えば、ビークルを捨札にして別のビークルに乗り換え、コマンドゾーンには置かれない（出典: R-KW-CHASE-01 規定文）", () => {
    const s = resolveAll(resolveChase(chosen(), "SPEC-VEHICLE:spare"));
    expect(zoneOf(s, "player2", "SPEC-CHASER-S:c")).toBe("rush");
    expect(cardIn(s, "player2", "SPEC-CHASER-S:c")?.mountedOnInstanceId).toBe("SPEC-VEHICLE:spare");
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:ev")).toBe("discard");
    expect(s.players.player2.command.some((c) => c.instanceId === "SPEC-CHASER-S:c")).toBe(false);
  });

  it("RM-048: チェイスを使わなければ、ユニットはホールド状態でコマンドゾーンに置かれ、ライドしていたビークルはその場に残る（出典: R-KW-CHASE-01「…ライドさせてもよい」・atwiki/page-886）", () => {
    const s = resolveAll(passChase(chosen()));
    expect(zoneOf(s, "player2", "SPEC-CHASER-S:c")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-CHASER-S:c")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "SPEC-CHASER-S:c")?.mountedOnInstanceId).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:ev")).toBe("battle");
  });

  it("RM-048: ライドされていない自軍ビークルがなければチェイスの機会は出ず、そのままコマンドゾーンに置かれる（出典: R-KW-CHASE-01 本文「ライドされていないビークルが無ければ当然使えない」）", () => {
    const s = chosen({ battle: RIDING_S.battle });
    expect(chaseOffered(s)).toBe(false);
    expect(zoneOf(s, "player2", "SPEC-CHASER-S:c")).toBe("command");
  });
});

describe("RM-044 ジャンパーソン【ジャンデジック】× チェイス（R-KW-CHASE-01）", () => {
  // 本文「敵軍バトルエリアにある、特徴「男」または「女」を持たないSユニットを、すべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-878）
  const rc = (p2: Partial<GameState["players"]["player2"]>) =>
    settle(
      resolveAll(
        rideOff(
          mount(st({ player1: { deck: deckCards(5), rush: [inst("RM-044", "jp"), inst("SPEC-VEHICLE", "v")] }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA), "RM-044:jp", "SPEC-VEHICLE:v"),
          true,
        ),
      ),
    );
  const ENEMY = { battle: [...ridingPair("SPEC-CHASER-S", "c", "SPEC-VEHICLE", "ev"), inst("SPEC-PLAIN-S", "p")], rush: [inst("SPEC-VEHICLE", "spare")] };

  it("RM-044: 置くユニットのうちライド中のチェイス持ちには、チェイスの機会が出る（出典: R-KW-CHASE-01・atwiki/page-878「すべて持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = rc(ENEMY);
    expect(chaseOffered(s)).toBe(true);
  });

  it("RM-044: チェイスで乗り換えたユニットは場に残り、ほかのユニットはその後コマンドゾーンに置かれる（出典: R-KW-CHASE-01・atwiki/page-878）", () => {
    const s = resolveAll(resolveChase(rc(ENEMY), "SPEC-VEHICLE:spare"));
    expect(zoneOf(s, "player2", "SPEC-CHASER-S:c")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-PLAIN-S:p")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-PLAIN-S:p")?.commandHeld).toBe(true);
  });

  it("RM-044: チェイスを使わなければ、両方ともコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-878）", () => {
    const s = resolveAll(passChase(rc(ENEMY)));
    expect(zoneOf(s, "player2", "SPEC-CHASER-S:c")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-PLAIN-S:p")).toBe("command");
  });

  it("RM-044: コマンドゾーンが5枚なら、チェイスを使わないユニットは捨札にする（出典: atwiki/page-878「置けなければ捨札にする」・R-KW-CHASE-01）", () => {
    const s = resolveAll(passChase(rc({ ...ENEMY, command: heldN(5) })));
    expect(zoneOf(s, "player2", "SPEC-CHASER-S:c")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-PLAIN-S:p")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:ev")).toBe("battle");
  });
});

describe("RM-050 隊員コード071 シグ【ミサイルランチャー】× チェイス（R-KW-CHASE-01）", () => {
  // 本文「DAまたはOTを持つ敵軍Mユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-859）
  const ENEMY = { battle: ridingPair("SPEC-CHASER-M", "c", "SPEC-MV", "ev"), rush: [inst("SPEC-MV", "spare")] };
  const chosen = () => settle(pick(ncEnter("RM-050:sg", 2, {}, { deck: deckCards(5, "e"), ...ENEMY }, EXTRA), "SPEC-CHASER-M:c"));

  it("RM-050: ライド中のチェイス持ちの M ユニットを選ぶと、チェイスの機会が出て、使えば乗り換えて場に残る（出典: R-KW-CHASE-01・atwiki/page-859）", () => {
    const s0 = chosen();
    expect(chaseOffered(s0)).toBe(true);
    const s = resolveAll(resolveChase(s0, "SPEC-MV:spare"));
    expect(zoneOf(s, "player2", "SPEC-CHASER-M:c")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-MV:ev")).toBe("discard");
  });
});
