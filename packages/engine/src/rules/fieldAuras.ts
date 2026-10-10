import type { Category } from "@rangers-strike/cards";
import { changePowerBpBonus } from "./legend1/set6NamedEffects348";
import { hellSaturnGrantCount } from "./hellSaturn";
import { activeNamedEffect } from "./ncGatedEffects";
import { countActiveFieldKeyword } from "../dsl/fieldKeywords";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, cardName, isLargeUnit } from "../core/catalog";
import { opponent } from "../core/helpers";
import { legend2FieldBpBonus } from "./legend2/fieldEffects";
import { legend3FieldBpBonus } from "./legend3/fieldEffects";
import { rkPassiveBpBonus } from "./rkFieldPassives";
import { set5AFieldBpBonus } from "./legend1/set5NamedEffectsA";
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

  // RK-117: BP+1000 per held enemy unit (command zone, commandHeld=true)
  if (cardId === "RK-117") {
    bonus += enemy.command.filter((c) => c.commandHeld).length * 1000;
  }

  // RK-127: BP+2000 per enemy hand card
  if (cardId === "RK-127") {
    bonus += enemy.hand.length * 2000;
  }

  // RK-292: BP+3000 per copy of itself in own discard
  if (cardId === "RK-292") {
    bonus += own.discard.filter((c) => c.cardId === "RK-292").length * 3000;
  }

  // RK-332: BP+1000 per own ドラゴン unit in rush or battle
  if (cardId === "RK-332") {
    const dragonCount = [...own.rush, ...own.battle].filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.features?.includes("ドラゴン");
    }).length;
    bonus += dragonCount * 1000;
  }

  // RS-421: BP+1000 per own command with feature レッド
  if (cardId === "RS-421") {
    bonus += own.command.filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.features?.includes("レッド");
    }).length * 1000;
  }

  // RS-440: BP+1000 per own unit with number containing L or R (e.g. 1L, 2R)
  // Deferred — number parsing needed. Skip for now.

  // RS-501: BP+1000 per own 女 unit in rush or battle
  if (cardId === "RS-501") {
    bonus += [...own.rush, ...own.battle].filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.features?.includes("女");
    }).length * 1000;
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
    const anyL = [...own.rush, ...own.battle, ...enemy.rush, ...enemy.battle].some(
      (c) => c.instanceId !== instance.instanceId && isLargeUnit(state.definitions, c.cardId),
    );
    if (anyL) bonus += 4000;
  }

  // RS-672 (ゴローダーGT): BP+2000 if any L-unit on field (own or enemy)
  if (cardId === "RS-672") {
    const anyL = [...own.rush, ...own.battle, ...enemy.rush, ...enemy.battle].some(
      (c) => c.instanceId !== instance.instanceId && isLargeUnit(state.definitions, c.cardId),
    );
    if (anyL) bonus += 2000;
  }

  // XG3-003 (ラジエッカーロボ): BP+3000 if any L-unit on field (own or enemy)
  if (cardId === "XG3-003") {
    const anyL = [...own.rush, ...own.battle, ...enemy.rush, ...enemy.battle].some(
      (c) => c.instanceId !== instance.instanceId && isLargeUnit(state.definitions, c.cardId),
    );
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
