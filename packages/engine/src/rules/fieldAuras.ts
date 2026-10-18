import type { Category } from "@rangers-strike/cards";
import { set9AFieldBpBonus } from "./legend1/set9NamedEffectsA";
import { changePowerBpBonus } from "./legend1/set6NamedEffects348";
import { hellSaturnGrantCount } from "./hellSaturn";
import { activeNamedEffect } from "./ncGatedEffects";
import { countActiveFieldKeyword } from "../dsl/fieldKeywords";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, cardName } from "../core/catalog";
import { opponent } from "../core/helpers";
import { legend2FieldBpBonus } from "./legend2/fieldEffects";
import { legend3FieldBpBonus } from "./legend3/fieldEffects";
import { rkPassiveBpBonus } from "./rkFieldPassives";
import { set5AFieldBpBonus } from "./legend1/set5NamedEffectsA";
import { set6BFieldBpBonus } from "./legend1/set6NamedEffectsB";
import { femaleUnitCountBothSides } from "./legend1/set7NamedEffectsD";
import { set8DFieldBpBonus } from "./legend1/set8NamedEffectsD";
import { set9CFieldBpBonus } from "./legend1/set9NamedEffectsC";
import { set9DFieldBpBonus } from "./legend1/set9NamedEffectsD";
import { rk1FieldBpBonus } from "./rk/rk1NamedEffects";
import { rk2FieldBpBonus } from "./rk/rk2UnitEffects";
import { rk9FieldBpBonus } from "./rk/rk9Fields";
import { rk12FieldBpBonus } from "./rk/rk12Fields";
import { rk14FieldBpBonus } from "./rk/rk14Fields";
import { rk15FieldBpBonus } from "./rk/rk15Fields";
import { rk16FieldBpBonus } from "./rk/rk16Fields";
import { rk14ActsAsVehicle } from "./rk/rk14Fields";
import { unitFeatures } from "./addedFeatures";
import { rk5FieldBpBonus } from "./rk/rk5Fields";
import { rk6FieldBpBonus } from "./rk/rk6Fields";
import { anyOtherBaseLargeUnit } from "./legend1/set8NamedEffectsB";
import { set7AFieldBpBonus } from "./legend1/set7NamedEffectsA";
import { set8AFieldBpBonus } from "./legend1/set8NamedEffectsA";
import { rs560BeastMBpBonus } from "./rs/rsCatchallField";
import { commandCategoriesNow } from "./legend3/battleEffects";

const CATEGORY_ABBR: Record<string, Category> = {
  OT: "OT",
  ET: "ET",
  MA: "MA",
  WB: "WB",
  DA: "DA",
  オーバーテクノロジー: "OT",
  アーステクノロジー: "ET",
  ミスティックアームズ: "MA",
  ワイルドビースト: "WB",
  ダークアライアンス: "DA",
};

const PER_NON_CATEGORY_COMMAND_RE =
  /このユニットは、自分と相手のコマンドゾーンにある「([^」]+)」以外のコマンド1つにつき「?BP[-－ー](\d+)」?され/;

/**
 * 「※このユニットは、自分と相手のコマンドゾーンにある「X」以外のコマンド1つにつき「BP-N」され、BP0以下のとき撃破される。」
 * （RS-266〜270 フラッシュマン）。本文の文言から計算する。
 * 「X以外」は「X ではないカテゴリを持つ」（マルチカテゴリの X/WB も数える。faq-card-5 RS-266 Q1）。
 * ホールド状態のコマンドのカテゴリが【プリズムブーツ】で変わっていればそれに従う（commandCategoriesNow）。
 * BP0 以下での撃破はルール（R-BP-02）による撃破として applyAction 側で処理される。
 */
export function perNonCategoryCommandBpPenalty(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const def = getDefinition(state.definitions, instance.cardId);
  const m = def?.text ? PER_NON_CATEGORY_COMMAND_RE.exec(def.text.normalize("NFKC")) : null;
  if (!m) return 0;
  const player = state.players[playerId];
  const inField =
    player.rush.some((c) => c.instanceId === instance.instanceId) ||
    player.battle.some((c) => c.instanceId === instance.instanceId);
  if (!inField) return 0;
  const excluded = CATEGORY_ABBR[m[1]!] ?? m[1];
  const amount = Number(m[2]);
  let count = 0;
  for (const pid of ["player1", "player2"] as const) {
    for (const cmd of state.players[pid].command) {
      const cats = commandCategoriesNow(state, cmd);
      if (cats.some((c) => c !== excluded)) count += 1;
    }
  }
  return count * amount;
}

function categoriesInclude(
  categories: Category | Category[],
  target: Category,
): boolean {
  const list = Array.isArray(categories) ? categories : [categories];
  return list.includes(target);
}

function playerHasInRush(state: GameState, playerId: PlayerId, cardId: string): boolean {
  return state.players[playerId].rush.some((c) => c.cardId === cardId);
}

function playerHasInBattle(state: GameState, playerId: PlayerId, cardId: string): boolean {
  return state.players[playerId].battle.some((c) => c.cardId === cardId);
}

/** note_other_* nc キーワードによる恒常的BPボーナス。effectiveBp 経由で "general" ロールのみ算入。 */
function noteOtherNcBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const cardId = instance.cardId;
  const enemyId = opponent(playerId);
  const own = state.players[playerId];
  const enemy = state.players[enemyId];
  let bonus = 0;

  // RK-127 の※（相手の手札1枚につき BP+2000）は rules/rkFieldPassives.ts の文言の解析で数える（ここでも足すと2重になる）。

  // RK-292: BP+3000 per copy of itself in own discard
  if (cardId === "RK-292") {
    bonus += own.discard.filter((c) => c.cardId === "RK-292").length * 3000;
  }

  // RK-332 の※（特徴「ドラゴン」を持つ自軍ユニット1体につき BP+1000。ゾーンでもオモテ向きなら有効。rules/rk/rk16Fields.ts）。
  bonus += rk16FieldBpBonus(state, playerId, instance, unitFeatures, rk14ActsAsVehicle);

  // RS-421: BP+1000 per own command with feature レッド
  if (cardId === "RS-421") {
    bonus += own.command.filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.features?.includes("レッド");
    }).length * 1000;
  }

  // RS-440: ナンバーに L／R を持つ自軍ユニット1体につき BP+1000 は rules/legend1/set7NamedEffectsA.ts（set7AFieldBpBonus）。

  // RS-501 エレハン・キンポー ※「これは特徴「女」を持つユニット1体につきBP＋1000される。」— 自軍・敵軍の限定はない
  // （atwiki/page-742。rules/legend1/set7NamedEffectsD.ts）。
  if (cardId === "RS-501") {
    bonus += femaleUnitCountBothSides(state) * 1000;
  }

  // XG1-020: BP+1000 per own command with 2+ categories
  if (cardId === "XG1-020") {
    bonus += own.command.filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (!def) return false;
      const cats = Array.isArray(def.category) ? def.category : [def.category];
      return cats.length >= 2;
    }).length * 1000;
  }

  // RS-558 (ガンマジン): BP+4000 if any L-unit on field (own or enemy)
  if (cardId === "RS-558") {
    // L ユニットには【再生巨大化能力】（RS-539）等で L になったユニットも含む（rules/legend1/set8NamedEffectsB.ts）。
    const anyL = anyOtherBaseLargeUnit(state, instance);
    if (anyL) bonus += 4000;
  }

  // RS-672 (ゴローダーGT): BP+2000 if any L-unit on field (own or enemy)
  if (cardId === "RS-672") {
    // L ユニットには【再生巨大化能力】（RS-539）等で L になったユニットも含む（rules/legend1/set8NamedEffectsB.ts）。
    const anyL = anyOtherBaseLargeUnit(state, instance);
    if (anyL) bonus += 2000;
  }

  // XG3-003 (ラジエッカーロボ): BP+3000 if any L-unit on field (own or enemy)
  if (cardId === "XG3-003") {
    // L ユニットには【再生巨大化能力】（RS-539）等で L になったユニットも含む（rules/legend1/set8NamedEffectsB.ts）。
    const anyL = anyOtherBaseLargeUnit(state, instance);
    if (anyL) bonus += 3000;
  }

  // XG3-013 (ガオポーラー): BP+3000 if own ガオベアー in rush or battle
  if (cardId === "XG3-013") {
    const hasGaoBear = [...own.rush, ...own.battle].some(
      (c) => cardName(state.definitions, c.cardId) === "ガオベアー",
    );
    if (hasGaoBear) bonus += 3000;
  }

  // XG3-015 (ガオベアー): BP+3000 if own ガオポーラー in rush or battle
  if (cardId === "XG3-015") {
    const hasGaoPolar = [...own.rush, ...own.battle].some(
      (c) => cardName(state.definitions, c.cardId) === "ガオポーラー",
    );
    if (hasGaoPolar) bonus += 3000;
  }

  return bonus;
}

/** RS-034 / RS-045 / RS-037 パッシブBPオーラ。 */
export function passiveNamedFieldBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  role: "general" | "attacking" | "defending",
): number {
  const def = state.definitions[instance.cardId];
  if (!def || def.type !== "unit") return 0;

  let bonus = 0;

  // RS-364 ヘルサターン総統【黒き太陽神への忠誠】: 自軍ユニットがすべて DA なら、総統以外の自軍 S ユニットは BP+3000（重複する）。
  if (role === "general") bonus += 3000 * hellSaturnGrantCount(state, playerId, instance);

  // RS-034 大獣神【守護獣の神】（RS-286 同）: これ以外の「ワイルドビースト」のユニットすべては BP+2000。
  // 敵軍の WB ユニットにも適用される（faq-card-1 RS-034 Q）。複数あれば重複する（R-CONT-01）。
  if (categoriesInclude(def.category, "WB")) {
    const gods = (["player1", "player2"] as const).reduce(
      (sum, pid) =>
        sum +
        state.players[pid].battle.filter(
          (c) =>
            (c.cardId === "RS-034" || c.cardId === "RS-286") && c.instanceId !== instance.instanceId,
        ).length,
      0,
    );
    bonus += 2000 * gods;
  }

  // ルール: R-CONT-01 同じ継続効果は枚数分重複する（RS-045 / RS-037 は体数分 BP+1000）
  if (role === "defending" && def.size === "M" && categoriesInclude(def.category, "OT")) {
    bonus +=
      1000 *
      countActiveFieldKeyword(state, playerId, "over_technology_m_bp_plus_on_attacked", ["rush"]);
  }

  if (role === "attacking" && def.size === "M" && categoriesInclude(def.category, "WB")) {
    bonus += 1000 * state.players[playerId].rush.filter((c) => c.cardId === "RS-037").length;
  }

  // RK-046【バスターホイール】: これが自軍バトルエリアにある間、敵軍バトルエリアのすべての S ユニットは BP-500。
  // ルール: R-CONT-01（体数分重複）、R-BP-02（BP0 以下はルールで撃破）
  if (
    role === "general" &&
    def.size === "S" &&
    state.players[playerId].battle.some((c) => c.instanceId === instance.instanceId)
  ) {
    bonus -= 500 * state.players[opponent(playerId)].battle.filter((c) => c.cardId === "RK-046").length;
  }

  // RS-303【シティガーディアンズ隊長】・RS-255 巨大化爆弾を重ねたユニット。
  if (role === "general") bonus += set5AFieldBpBonus(state, playerId, instance);
  // 第6弾 RS-409【フレンジー・スピア・クラッシュ】・RS-415【飛竜剣法・散弾月】・RS-431【剛勇吼波】。
  if (role === "general") bonus += set6BFieldBpBonus(state, playerId, instance);
  // 第7弾 RS-440 ※（L／R ナンバー1体につき）・RS-442【スパニッシュダンス】（rules/legend1/set7NamedEffectsA.ts）。
  if (role === "general") bonus += set7AFieldBpBonus(state, playerId, instance);
  // 第8弾 RS-527【反バイオ粒子砲】（rules/legend1/set8NamedEffectsA.ts）。
  if (role === "general") bonus += set8AFieldBpBonus(state, playerId, instance);
  // 第8弾 RS-584【闇を振り払う心】（rules/legend1/set8NamedEffectsD.ts）。
  if (role === "general") bonus += set8DFieldBpBonus(state, playerId, instance);
  // 第9弾 RS-650【強蹴一閃ライノシュート】・RS-661【破天攻】（rules/legend1/set9NamedEffectsC.ts）。
  if (role === "general") bonus += set9CFieldBpBonus(state, playerId, instance);
  // 第9弾 RS-618【ジェットランサー】（rules/legend1/set9NamedEffectsA.ts）。
  if (role === "general") bonus += set9AFieldBpBonus(state, playerId, instance);
  // 第9弾 RS-689【バードブラスター】（rules/legend1/set9NamedEffectsD.ts）。
  if (role === "general") bonus += set9DFieldBpBonus(state, playerId, instance);
  // RK-010 ハイブリッドエネルギー（rules/rk/rk1NamedEffects.ts）。
  if (role === "general") bonus += rk1FieldBpBonus(state, playerId, instance);
  // RK-027 ※（ライド中）・RK-029【マイティキック】・RK-034【ドラグブレス】（rules/rk/rk2UnitEffects.ts）。
  bonus += rk2FieldBpBonus(state, playerId, instance, role);
  // RK-099【怪人の監視権限】・RK-103【ブラストペガサス】・RK-105 ※（ライド中）（rules/rk/rk5Fields.ts）。
  if (role === "general") bonus += rk5FieldBpBonus(state, playerId, instance);
  // RK-107【硬化装甲】・RK-117 ※（ホールド状態の敵軍ユニット1体につき）・RK-121【エクザップバスター】（rules/rk/rk6Fields.ts）。
  if (role === "general") bonus += rk6FieldBpBonus(state, playerId, instance);
  // RK-173 鬼の鎧を重ねたユニット（rules/rk/rk9Fields.ts）。
  if (role === "general") bonus += rk9FieldBpBonus(state, playerId, instance);
  // RK-250 サバイブを重ねたユニット（BP+1500。rules/rk/rk12Fields.ts）。
  if (role === "general") bonus += rk12FieldBpBonus(instance);
  // RK-288【デルタムーバー】（このターン、敵軍バトルエリアの S ユニットは BP-500。rules/rk/rk14Fields.ts）。
  if (role === "general") bonus += rk14FieldBpBonus(state, playerId, instance);
  // RK-295【頂点に立つ男】（NC が成立したターン、パワーゾーンの枚数の差1枚につき BP+1000。rules/rk/rk15Fields.ts）。
  if (role === "general") bonus += rk15FieldBpBonus(state, playerId, instance);
  bonus += legend2FieldBpBonus(state, playerId, instance, role);
  bonus += legend3FieldBpBonus(state, playerId, instance, role);

  // nc note_other_* BP bonuses — counted only once via effectiveBp's "general" call
  if (role === "general") {
    bonus += noteOtherNcBpBonus(state, playerId, instance);
    bonus += rkPassiveBpBonus(state, playerId, instance);
    bonus += rs560BeastMBpBonus(state, playerId, instance.cardId);
    bonus += kakuhengeDamageBpBonus(state, playerId, instance);
    // RS-372 X1マスク【チェンジパワー】: 自軍ダメージ1点につき BP+1000。
    bonus += changePowerBpBonus(state, playerId, instance);
    bonus -= perNonCategoryCommandBpPenalty(state, playerId, instance);
  }

  return bonus;
}

/** RS-310 ゴウライビートル【カラクリ忍法・角変化】: 自分と相手のダメージ1点につき BP+1000。 */
function kakuhengeDamageBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  if (!activeNamedEffect(instance, "karakuri_ninpo_tsuno")) return 0;
  const player = state.players[playerId];
  const inField =
    player.rush.some((c) => c.instanceId === instance.instanceId) ||
    player.battle.some((c) => c.instanceId === instance.instanceId);
  if (!inField) return 0;
  return (player.damage + state.players[opponent(playerId)].damage) * 1000;
}
