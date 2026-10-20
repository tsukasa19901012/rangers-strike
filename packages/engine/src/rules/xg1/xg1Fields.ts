/**
 * クロスギャザー XG1 の継続効果の判定（低水準。SP・アタックの制限・特徴やキーワードの付与など）。
 * 選択を開く処理（rules/xg1/xg1Effects.ts）からは独立させ、core/catalog.ts・rules/legend3/fieldEffects.ts 等から循環なく読めるようにする。
 */
import { isSameCardIdentity, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { rm1ResidentCount } from "../rm/rm1Fields";
import { actionContextState } from "../zordFeatureContext";
import { rk12AddedFeatures, rk12TurnPayloads } from "../rk/rk12Fields";

type Defs = Pick<GameState, "definitions">;

function def(state: Defs, cardId: string): CardDefinition | undefined {
  return state.definitions[cardId];
}

function cats(state: Defs, cardId: string): string[] {
  const c = def(state, cardId)?.category;
  if (!c) return [];
  return (Array.isArray(c) ? c : [c]) as string[];
}

function other(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

// ---------------------------------------------------------------------------
// SP

/** XG1-011【スペースメタルの魔剣】: 自軍ゾーンか敵軍ゾーン（パワーゾーン・コマンドゾーン）に OT を持つオモテ向きのカードがあるか。 */
function otFaceUpInZones(state: GameState): boolean {
  for (const pid of ["player1", "player2"] as const) {
    const p = state.players[pid];
    for (const c of [...p.power, ...p.command]) {
      if (c.faceDown) continue;
      if (cats(state, c.cardId).includes("OT")) return true;
    }
  }
  return false;
}

/**
 * XG1 の「SP1」になる継続効果（rules/legend3/fieldEffects.ts legend3EffectiveSp）。
 * - XG1-011 巨大バッカスフンド【スペースメタルの魔剣】（atwiki/page-1644）
 * - XG1-012 レッドパンチャー ※（自軍コマンドがすべてリリース状態。atwiki/page-1615）
 * - XG1-020 ターボロボ【高速剣ターボクラッシュ】（BP10000 以上。atwiki/page-1545）
 * - XG1-026 ヤミマル【ヤミオノ】（自軍ダメージが3点以下。atwiki/page-1676・コメント欄「常時SP1」）
 */
export function xg1EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  sp: number,
  effectiveBp: (state: GameState, playerId: PlayerId, card: CardInstance) => number,
): number {
  const id = instance.cardId;
  if (isSameCardIdentity(id, "XG1-011") && otFaceUpInZones(state)) return Math.max(sp, 1);
  // XG1-012: コマンドが0枚なら「すべてリリース状態」にならない（利用者の決定 2026-10-20、docs/verification/unverified/questions-all.md U-9）。
  if (isSameCardIdentity(id, "XG1-012") && state.players[playerId].command.length > 0 && state.players[playerId].command.every((c) => !c.commandHeld)) return Math.max(sp, 1);
  if (isSameCardIdentity(id, "XG1-026") && state.players[playerId].damage <= 3) return Math.max(sp, 1);
  if (isSameCardIdentity(id, "XG1-020") && effectiveBp(state, playerId, instance) >= 10000) return Math.max(sp, 1);
  // XG1-086 スピルバン ※「これはBP5000以上のとき「SP1」になる。」（atwiki/page-1674）
  if (isSameCardIdentity(id, "XG1-086") && effectiveBp(state, playerId, instance) >= 5000) return Math.max(sp, 1);
  return sp;
}

// ---------------------------------------------------------------------------
// アタックの制限

function areaHas(state: GameState, playerId: PlayerId, cardId: string, zones: Array<"battle" | "rush"> = ["battle", "rush"]): boolean {
  const p = state.players[playerId];
  return zones.some((z) => p[z].some((c) => isSameCardIdentity(c.cardId, cardId)));
}

/**
 * アタックされない（rules/legend3/restrictions.ts canAttackDefender）。
 * - XG1-017 シグナルマン【許可なき戦いへの介入】: これが自軍エリアにある間、自分も相手も — S ユニットは、追加条件を持つ M ユニット・SC ユニットに
 *   アタックできない（atwiki/page-1672）。
 * - XG1-018 サイレンダーPM【治安維持】: これが自軍バトルエリアにある間、相手は — S ユニットは、M・SC・L ユニットにアタックできない（atwiki/page-1585）。
 */
export function xg1DefenderBlocksAttack(state: GameState, attackerPlayerId: PlayerId, attacker: CardInstance, defenderPlayerId: PlayerId, defender: CardInstance): boolean {
  // XG1-084 マッドギャラン【人質と脅迫】「…自分自身の手札を1枚選び捨札にしなければ、このユニットにアタックすることができない。」（atwiki/page-1677）。
  // 自軍バトルエリアにあるこれには、手札のない相手はアタックできない（捨てる手札はアタックされたとき。rules/xg1/xg1eEffects.ts）。
  if (
    isSameCardIdentity(defender.cardId, "XG1-084") &&
    attackerPlayerId !== defenderPlayerId &&
    state.players[defenderPlayerId].battle.some((c) => c.instanceId === defender.instanceId) &&
    state.players[attackerPlayerId].hand.length === 0
  ) {
    return true;
  }
  if (def(state, attacker.cardId)?.size !== "S") return false;
  const d = def(state, defender.cardId);
  if (!d || d.type !== "unit") return false;
  const size = d.size;
  if ((size === "M" || size === "SC") && d.rushAdditionalCondition && (areaHas(state, "player1", "XG1-017") || areaHas(state, "player2", "XG1-017"))) return true;
  if ((size === "M" || size === "SC" || size === "L") && areaHas(state, other(attackerPlayerId), "XG1-018", ["battle"])) return true;
  void defenderPlayerId;
  return false;
}

/**
 * XG1-084 マッドギャラン【人質と脅迫】「これが自軍バトルエリアにある間、相手は次の制限を受ける⇒自分自身のバトルエリアにあるホールド状態のSユニットは
 * ラッシュエリアに戻せない。…」（atwiki/page-1677）。スタートフェイズに戻さない（rules/startPhase.ts）。
 */
export function xg1HostageStaysAtStart(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  const card = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  const d = card ? def(state, card.cardId) : undefined;
  if (!card || !card.commandHeld || d?.type !== "unit" || d.size !== "S") return false;
  return state.players[other(playerId)].battle.some((c) => isSameCardIdentity(c.cardId, "XG1-084"));
}

/**
 * 敵軍ラッシュエリアのユニットにアタックできる（rules/legend3/restrictions.ts canAttackDefender）。
 * - XG1-021 ブルーターボ【Jガン】（NC）「これは敵軍ラッシュエリアのホールド状態のユニットにアタックできる。」（atwiki/page-1574）
 *   NC を発動したとき、またはナンバー1のこれがバトルエリアの1番目にある（NC が成立している）とき。
 */
export function xg1AttackerCanAttackRush(state: GameState, attackerPlayerId: PlayerId, attacker: CardInstance, defender: CardInstance): boolean {
  // XG1-035 兜折神【侍武装】で得る「これは敵軍ラッシュエリアのユニットにアタックできる」（atwiki/page-1591。XG1-039 の【折神の結集】を含む）。
  if (xg1HasSamuraiGrant(state, attackerPlayerId, attacker, "XG1-035")) return true;
  // XG1-043 カメバズーカ【砲撃】「このユニットは、ホールド状態のとき敵軍ラッシュエリアのユニットにアタックできる。」（atwiki/page-1612）
  if (isSameCardIdentity(attacker.cardId, "XG1-043") && attacker.commandHeld) return true;
  if (!isSameCardIdentity(attacker.cardId, "XG1-021") || !defender.commandHeld) return false;
  if (attacker.activatedNcEffects?.includes("jgan")) return true;
  return state.players[attackerPlayerId].battle[0]?.instanceId === attacker.instanceId && def(state, attacker.cardId)?.comboNumber === 1;
}

// ---------------------------------------------------------------------------
// XG1-015 宇宙警察（※常駐）
// 「特徴「警察」を持つSユニットはチェイスを得る。さらにそのユニットがOTを持つなら、特徴「宇宙刑事」が追加され、コールOTを得る。」（atwiki/page-1584）
// 得るのは常駐させたプレイヤー（自軍）のユニットだけ（ユーザー決定 2026-10-19 h–n。docs/rules/README.md §5.7）。

function policeResidentActive(state: Pick<GameState, "players">, ownerId: PlayerId): boolean {
  return rm1ResidentCount(state, ownerId, "XG1-015") > 0;
}

function isPoliceS(state: Defs, cardId: string, features?: string[]): boolean {
  const d = def(state, cardId);
  return !!d && d.type === "unit" && d.size === "S" && (features ?? d.features ?? []).includes("警察");
}

/** XG1-015: 追加される特徴（rules/addedFeatures.ts unitFeatures。features はいまの特徴）。 */
export function xg1AddedFeatures(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, cardId: string, features: string[], instanceId?: string): string[] {
  // XG1-045 イカファイア【墨攻撃】: 敵軍バトルエリアにイカファイアがある間、自軍バトルエリアのユニットに「ブラック」（atwiki/page-1614）。
  if (
    instanceId &&
    state.players[ownerId].battle.some((c) => c.instanceId === instanceId) &&
    state.players[other(ownerId)].battle.some((c) => isSameCardIdentity(c.cardId, "XG1-045"))
  ) {
    return [...xg1AddedFeatures(state, ownerId, cardId, features), "ブラック"];
  }
  if (!policeResidentActive(state, ownerId)) return [];
  if (!isPoliceS(state, cardId, features) || !cats(state, cardId).includes("OT")) return [];
  return ["宇宙刑事"];
}

/** XG1-015: コールOT（rules/callLead.ts。owner はユニットの持ち主）。 */
export function xg1GrantsCallLead(owner: Pick<GameState["players"]["player1"], "operation">, definitions: GameState["definitions"], cardId: string, kind: "call" | "lead", category: string): boolean {
  if (kind !== "call" || category !== "OT") return false;
  if (!owner.operation.some((c) => isSameCardIdentity(c.cardId, "XG1-015"))) return false;
  const state = { definitions };
  return isPoliceS(state, cardId) && cats(state, cardId).includes("OT");
}

/**
 * XG1-015: チェイス（keywords/cardKeywords.ts cardHasKeyword）。持ち主が分からないときは、宇宙警察を常駐させたプレイヤーの場にそのカードがあるかで見る。
 */
export function xg1GrantsChase(state: GameState | null, playerId: PlayerId | undefined, cardId: string): boolean {
  if (!state || !isPoliceS(state, cardId)) return false;
  const owners: PlayerId[] = playerId ? [playerId] : (["player1", "player2"] as PlayerId[]).filter((pid) => [...state.players[pid].rush, ...state.players[pid].battle].some((c) => c.cardId === cardId));
  return owners.some((pid) => policeResidentActive(state, pid));
}

// ---------------------------------------------------------------------------
// XG1-013 キングピラミッダーPF【巨大要塞】
// 「これが自軍ラッシュエリアにある間、自分がラッシュするMユニットまたはLユニットの追加条件を満たすために次のようにしてもよい⇒
//   自軍Sユニットを1体捨札にするかわりに、自軍Sユニットを1体ホールドする。」（atwiki/page-1642）
// 置きかえられるのは、名前や特徴の指定のない「自軍Sユニットを N 体捨札にする」（N は1以上）だけ。名前・特徴を指定する追加条件
// （XP-028「リードを持つ自軍Sユニット1体を捨札にする」・XG3-084「特徴「昆虫」を持つ…」等）には使えない。複数体を捨札にする追加条件
// （RS-621「自軍Sユニットを3体捨札にする」等）では、捨札にする1体ごとにホールドに置きかえてよい（ホールドと捨札の混在も可）
// （利用者の決定 2026-10-20・docs/verification/unverified/questions-all.md U-10。atwiki/page-1642 カード評価「Sユニットを複数捨てる必要のあるユニットにも使える」）。
// 素材の行き先 "hold" で表す。

const PLAIN_S_DISCARD = /^自軍Sユニットを[0-9]+体捨札にする。?$/;

/** 追加条件の文が、名前・特徴の指定のない「自軍Sユニットを N 体捨札にする」か。 */
export function xg1IsPlainSDiscardCondition(text: string | undefined): boolean {
  return PLAIN_S_DISCARD.test((text ?? "").normalize("NFKC").replace(/\s+/g, ""));
}

/** ラッシュする rushingCardId の追加条件を【巨大要塞】でホールドに置きかえられるか（いまの追加条件で判定する）。 */
export function xg1HoldSubstituteAvailable(
  player: Pick<PlayerState, "rush">,
  definitions: GameState["definitions"],
  rushingCardId: string,
): boolean {
  const d = definitions[rushingCardId];
  if (!d || (d.size !== "M" && d.size !== "L")) return false;
  const condition = resolveRushAdditionalCondition(rushingCardId, d);
  if (!condition || condition.conditionId !== "send_s_unit_to_discard" || !xg1IsPlainSDiscardCondition(condition.text)) return false;
  return player.rush.some((c) => isSameCardIdentity(c.cardId, "XG1-013"));
}

// ---------------------------------------------------------------------------
// XG1-026 ヤミマル【ヤミオノ】は xg1EffectiveSp。XG1-033 害地大臣ヨゴシュタイン【汚れた大地】
// 「これが自軍エリアにある間、コマンドゾーンにある本来のカテゴリにDAを持たないカードのうち、必要パワーの数字が3以下のカードは、カテゴリにDAが
//  追加される（この効果は重複しない）。」（atwiki/page-1581）— 軍の限定がないので敵軍のコマンドゾーンのカードにも追加される。
// コマンドのカテゴリはプレイヤー単位で判定する（core/catalog.ts effectiveCommandCategories）ので、敵軍エリアのものは applyAction / getLegalActions の
// 入口の状態で見る。

export function xg1YogosteinOnEitherField(): boolean {
  const state = actionContextState();
  if (!state) return false;
  return (["player1", "player2"] as const).some((pid) => areaHas(state, pid, "XG1-033"));
}

// ---------------------------------------------------------------------------
// XG1-031 ゴーオンレッド ※「これが自軍エリアにある間、自軍バトルフェイズ中、自分の手札にある特徴「炎神」を持つユニットカードはカテゴリにWBが
// 追加される。」（atwiki/page-1638）。手札のカードのカテゴリを見る判定（rules/residentAllyEnterRush.ts 激気）から呼ぶ。

export function xg1HandCardAddedCategories(state: GameState, playerId: PlayerId, cardId: string): string[] {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return [];
  const d = def(state, cardId);
  if (!d || d.type !== "unit" || !(d.features ?? []).includes("炎神")) return [];
  return areaHas(state, playerId, "XG1-031") ? ["WB"] : [];
}

// ---------------------------------------------------------------------------
// 【侍武装】（XG1-035 兜折神・XG1-036 舵木折神・XG1-040 虎折神）で重ねたユニットが得る能力と、XG1-039 テンクウシンケンオー【折神の結集】
// 「これが自軍エリアにある間、自軍捨札にある効果名「侍武装」を持つユニットカードは、このユニットが重ねられているかのように効果を発動する。
//  ただし、同じカード名の効果は重複して発動しない。」（atwiki/page-1589）

function isSamuraiArmorCard(state: Defs, cardId: string): boolean {
  const d = def(state, cardId);
  return !!d && d.type === "unit" && (d.text ?? "").includes("【侍武装】");
}

/** host が得ている【侍武装】の能力の元のカード（重ねたカードと、テンクウシンケンオーなら自軍捨札のもの。同じカード名は1つ）。 */
export function xg1SamuraiSources(state: GameState, ownerId: PlayerId, host: CardInstance): string[] {
  const ids = (host.stackedCards ?? []).filter((c) => isSamuraiArmorCard(state, c.cardId)).map((c) => c.cardId);
  if (isSameCardIdentity(host.cardId, "XG1-039") && [...state.players[ownerId].rush, ...state.players[ownerId].battle].some((c) => c.instanceId === host.instanceId)) {
    for (const c of state.players[ownerId].discard) if (isSamuraiArmorCard(state, c.cardId)) ids.push(c.cardId);
  }
  const seen = new Set<string>();
  return ids.filter((id) => {
    const name = def(state, id)?.name ?? id;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

export function xg1HasSamuraiGrant(state: GameState, ownerId: PlayerId, host: CardInstance, sourceCardId: string): boolean {
  return xg1SamuraiSources(state, ownerId, host).some((id) => isSameCardIdentity(id, sourceCardId));
}

/** 「このユニットの合体に必要なユニットの最大数」（合体の文の素材の数。かっこ内の「または」の組があれば多いほう）。合体ユニットでなければ 0。 */
export function xg1MaxFusionMaterialCount(state: Defs, cardId: string): number {
  const m = (def(state, cardId)?.text ?? "").match(/^合体[―ー-]+(\S+)/);
  if (!m) return 0;
  const body = m[1]!;
  const paren = body.match(/[（(]または(.+?)[）)]/);
  const main = body.replace(/[（(].*?[）)]/g, "").split("＋").filter((x) => x.trim()).length;
  const alt = paren ? paren[1]!.split("＋").filter((x) => x.trim()).length : 0;
  return Math.max(main, alt > 0 ? main - 1 + alt : main);
}

/** XG1-040 虎折神【侍武装】で得る「このユニットの合体に必要なユニットの最大数を数えて、1体につきBP+1000される」（atwiki/page-1593）。 */
export function xg1SamuraiBpBonus(state: GameState, ownerId: PlayerId, host: CardInstance): number {
  if (!xg1HasSamuraiGrant(state, ownerId, host, "XG1-040")) return 0;
  return xg1MaxFusionMaterialCount(state, host.cardId) * 1000;
}

/**
 * XG1 の BP の修正（core/catalog.ts effectiveBp）: XG1-040 の【侍武装】・XG1-058 の※「これはライド中、BP+1000される。」（atwiki/page-1565）・
 * XG1-068 の【アタックライド】「このターン、これは特徴「警察」を持つ自軍ユニット1体につきBP+1000される。」（atwiki/page-1668。エリアを問わない）。
 */
export function xg1BpBonus(state: GameState, ownerId: PlayerId, card: CardInstance): number {
  let bonus = xg1SamuraiBpBonus(state, ownerId, card);
  if (isSameCardIdentity(card.cardId, "XG1-058") && card.mountedOnInstanceId) bonus += 1000;
  if (isSameCardIdentity(card.cardId, "XG1-068") && rk12TurnPayloads<{ instanceId?: string }>(state, ownerId, XG1_068_KUUGA_RULE).some((p) => p.instanceId === card.instanceId)) {
    const field = [...state.players[ownerId].rush, ...state.players[ownerId].battle];
    const police = field.filter((c) => {
      const printed = def(state, c.cardId)?.features ?? [];
      return def(state, c.cardId)?.type === "unit" && [...printed, ...rk12AddedFeatures(state, ownerId, c, printed)].includes("警察");
    });
    bonus += 1000 * police.length;
  }
  // XG1-085 ダイアナレディ【レディスナイパー】で得た「BP+2000」（rules/xg1/xg1eEffects.ts xg1eOnEnterTail）。
  if (rk12TurnPayloads<{ instanceId?: string }>(state, ownerId, XG1_085_LADY_RULE).some((p) => p.instanceId === card.instanceId)) bonus += 2000;
  // XG1-092 ソルブレイバー【ケルベロスΔ】: このターンに自軍捨札から手札に加えた S ユニットのカード1枚につき BP+2000（rules/xg1/xg1eEffects.ts）。
  if (isSameCardIdentity(card.cardId, "XG1-092") && rk12TurnPayloads<{ instanceId?: string }>(state, ownerId, XG1_092_KERBEROS_RULE).some((p) => p.instanceId === card.instanceId)) {
    bonus += 2000 * rk12TurnPayloads(state, ownerId, XG1_092_RECOVER_RULE).length;
  }
  return bonus;
}

/** XG1-085【レディスナイパー】で BP+2000 を得たユニット（payload: { instanceId }）。 */
export const XG1_085_LADY_RULE = "xg1_085_lady_sniper";
/** XG1-092【ケルベロスΔ】を発動したユニット（payload: { instanceId }）。 */
export const XG1_092_KERBEROS_RULE = "xg1_092_kerberos_delta";
/** このターンに自軍捨札から手札に加えた S ユニットのカード（payload: { instanceId }。XG1-092 を持つプレイヤーだけ記録する）。 */
export const XG1_092_RECOVER_RULE = "xg1_092_recovered_s_unit";
/** XG1-099【採点】で必要パワーの数字を変えたユニット（payload: { instanceId, cost }）。 */
export const XG1_099_SAITEN_RULE = "xg1_099_saiten";

/** XG1-068 ディケイド クウガMF【アタックライド】を発動した記録（payload: { instanceId }。rules/xg1/xg1dEffects.ts）。 */
export const XG1_068_KUUGA_RULE = "xg1_068_kuuga_police";

// ---------------------------------------------------------------------------
// XG1-044 仮面ライダーV3 ※「これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、自軍捨札に「仮面ライダー1号」のカードと「仮面ライダー2号」の
// カードがあれば、これを自軍ラッシュエリアに出してもよい。」（atwiki/page-1619）。ホールド・リリースは問わない（rules/keywordGapRuntime.ts）。

export function xg1CanDeployFromCommand(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, card: CardInstance): boolean {
  if (!isSameCardIdentity(card.cardId, "XG1-044")) return false;
  const names = new Set(state.players[playerId].discard.map((c) => def(state, c.cardId)?.name));
  return names.has("仮面ライダー1号") && names.has("仮面ライダー2号");
}

export { other as xg1Other, cats as xg1PrintedCategories };
