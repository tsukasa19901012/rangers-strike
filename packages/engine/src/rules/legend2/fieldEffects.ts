import {
  playerHasNamedEffectInZones,
} from "@rangers-strike/cards";
import { rk3SpFloor } from "../rk/rk3UnitEffects";
import { activeNamedEffect } from "../ncGatedEffects";
import type { Category } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { effectiveBp, getDefinition, isSmallUnit, spSetValueOf, unitBp } from "../../core/catalog";
import {
  battlePositionOneBased,
  printedSpBase,
  resolveInstanceSpValue,
} from "../fractionalSp";
import {
  crossReductionFor,
  taxisSpFloor,
  fieldPositionSpFloor,
} from "../../keywords/battleKeywords";

function categoriesInclude(
  categories: Category | Category[],
  target: Category,
): boolean {
  const list = Array.isArray(categories) ? categories : [categories];
  return list.includes(target);
}

function findControllerOfNamedEffect(
  state: GameState,
  effectId: string,
  zones: Array<"rush" | "battle">,
): { playerId: PlayerId; cardId: string } | null {
  for (const playerId of ["player1", "player2"] as const) {
    const player = state.players[playerId];
    for (const zone of zones) {
      for (const card of player[zone]) {
        if (activeNamedEffect(card, effectId)) {
          return { playerId, cardId: card.cardId };
        }
      }
    }
  }
  return null;
}

/** Legend2 フィールド常駐 BP / SP パッシブ。 */
export function legend2FieldBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  role: "general" | "attacking" | "defending",
): number {
  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || def.type !== "unit") return 0;

  let bonus = 0;

  // RS-079【バイバスター】の BP 加算は DSL（bp_per_enemy_command_…）がリリース・ホールドを問わず数える。
  // ここで重ねて数えない（atwiki/page-15「OTのコマンド1つにつきBP+1000」）。

  if (activeNamedEffect(instance, "fire_spin_blade")) {
    const released = state.players[playerId].command.filter((c) => !c.commandHeld).length;
    bonus += released * 1000;
  }

  if (role === "general") bonus += ryuuGekiKenBpBonus(state, playerId, instance);

  return bonus;
}

/**
 * RS-081【龍撃剣】: このターン、ホールド状態の敵軍コマンド1つにつき BP+1000。
 * ルール: R-RES-05 — 参照は即時更新（発動後に相手がホールドした分も加算される。faq-card-2 RS-081 Q1）。
 */
function ryuuGekiKenBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  if (!instance.activatedNcEffects?.includes("ryuu_geki_ken")) return 0;
  if (!state.players[playerId].battle.some((c) => c.instanceId === instance.instanceId)) return 0;
  const enemyId = playerId === "player1" ? "player2" : "player1";
  return state.players[enemyId].command.filter((c) => c.commandHeld).length * 1000;
}

export function legend2EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const def = getDefinition(state.definitions, instance.cardId);
  const modifier = instance.spModifier ?? 0;
  const battle = state.players[playerId].battle;
  const battlePosition = battlePositionOneBased(battle, instance.instanceId);
  const printed = resolveInstanceSpValue(def, instance);
  // 「SP！」のユニットの「SPN」（spModifier）は「SPN になる」効果で、加算ではない。
  // 「SP2」になる等の上書き（spOverride）と重なっても足し合わせない（RS-259 アカレンジャーの「SP2」＋【レッドビュート】「SP1」は SP2。R-STK-02/04）。
  const overrideOnSpecial = typeof instance.spOverride === "number" && def?.sp === "special";
  let sp = overrideOnSpecial
    ? Math.max(instance.spOverride as number, modifier)
    : printedSpBase(printed, battlePosition, crossReductionFor(battle, instance.instanceId)) + modifier;
  sp = Math.max(sp, taxisSpFloor(state, playerId, instance));
  sp = Math.max(sp, fieldPositionSpFloor(state, playerId, instance));
  // RK-056 仮面ライダーザビーMF【ZECT隊長】（rules/rk/rk3UnitEffects.ts）。
  sp = Math.max(sp, rk3SpFloor(state, playerId, instance));
  // RK-081 ゲゲル: 発動ターン中は自軍 S ユニットすべて SP1
  if (
    instance.activatedNcEffects?.includes("gegeru_sp1") &&
    isSmallUnit(state.definitions, instance.cardId)
  ) {
    sp = Math.max(sp, 1);
  }

  /** RS-073 バルシールド: 自軍ダメージ6点で SP2。 */
  if (instance.cardId === "RS-073" && state.players[playerId].damage === 6) {
    sp = Math.max(sp, 2);
  }

  /** RS-078 闇の舞: 敵にレッドがいれば SP1。 */
  if (instance.cardId === "RS-078") {
    const enemyId = playerId === "player1" ? "player2" : "player1";
    const hasRed = [...state.players[enemyId].rush, ...state.players[enemyId].battle].some(
      (c) => getDefinition(state.definitions, c.cardId)?.features?.includes("レッド"),
    );
    if (hasRed) {
      sp = Math.max(sp, 1);
    }
  }

  if (
    activeNamedEffect(instance, "bio_buster") ||
    activeNamedEffect(instance, "fire_spin_blade") ||
    instance.activatedNcEffects?.includes("ryuu_geki_ken")
  ) {
    // 「BP○○以上のとき「SP1」」の判定は、外部の効果（RS-364 ヘルサターン総統の BP+3000 等）を含む
    // そのときの BP で行う（faq-card-6 RS-364 Q1）。
    const bp = effectiveBp(state, playerId, instance);
    const threshold = activeNamedEffect(instance, "fire_spin_blade") ? 10000 : 5000;
    if (bp >= threshold) {
      sp = Math.max(sp, 1);
    }
  }

  const setSp = spSetValueOf(state, playerId, instance);
  if (setSp !== undefined) return setSp;

  return sp;
}

/** RS-089 救護活動: WB Mユニット撃破時、捨札の代わりにパワーへ。 */
export function shouldMedicalRescueToPower(
  state: GameState,
  ownerId: PlayerId,
  cardId: string,
): boolean {
  if (!playerHasNamedEffectInZones(state.players[ownerId], "medical_rescue", ["rush"])) {
    return false;
  }
  const def = getDefinition(state.definitions, cardId);
  if (!def || def.size !== "M") return false;
  return categoriesInclude(def.category, "WB");
}

/** RS-086 交通整理: 戦闘進入時、敵は同じサイズを使わなければならない。 */
export function trafficControlRequiresSameSize(
  state: GameState,
  playerId: PlayerId,
  unitSize: string | undefined,
): boolean {
  const controller = findControllerOfNamedEffect(state, "traffic_control", ["battle"]);
  if (!controller || controller.playerId === playerId) return false;
  // 「並べるユニットはすべて同じサイズ」— 既にサイズが混在していれば、どのサイズも出せない（faq-card-2 RS-086 Q1）。
  return state.players[playerId].battle.some(
    (c) => getDefinition(state.definitions, c.cardId)?.size !== unitSize,
  );
}

/**
 * RS-097 連獅子: SP1 以上または「！」の敵軍ユニットがバトルエリアに出るために
 * ホールドしなければならないコマンドの数（敵軍バトルエリアのハリケンレオンの数だけ重複）。
 * ルール: R-ADD-07 — 同じ継続効果は枚数分重複する（RS-097 Q7）。
 */
export function karakuriLionChainHoldCount(
  state: GameState,
  defenderId: PlayerId,
  unit: CardInstance,
): number {
  const enemyId: PlayerId = defenderId === "player1" ? "player2" : "player1";
  const chains = state.players[enemyId].battle.filter((c) =>
    activeNamedEffect(c, "karakuri_lion_chain"),
  ).length;
  if (chains === 0) return 0;

  const def = getDefinition(state.definitions, unit.cardId);
  const hasBang = def?.sp === "special" || def?.features?.includes("!");
  const effectiveSp = legend2EffectiveSp(state, defenderId, unit);
  return effectiveSp >= 1 || hasBang ? chains : 0;
}

export function findLegend2NamedEffectOnField(
  state: GameState,
  effectId: string,
  zones: Array<"rush" | "battle"> = ["rush", "battle"],
): { playerId: PlayerId; cardId: string } | null {
  return findControllerOfNamedEffect(state, effectId, zones);
}

export function hasSeabedSurvey(state: GameState, playerId: PlayerId): boolean {
  return playerHasNamedEffectInZones(state.players[playerId], "seabed_survey", ["rush"]);
}

export function hasJaguarMothership(state: GameState, playerId: PlayerId): boolean {
  return playerHasNamedEffectInZones(state.players[playerId], "jaguar_mothership", ["rush"]);
}

export function hasDekabaseMothership(state: GameState, playerId: PlayerId): boolean {
  return playerHasNamedEffectInZones(state.players[playerId], "dekabase_mothership", ["rush"]);
}
