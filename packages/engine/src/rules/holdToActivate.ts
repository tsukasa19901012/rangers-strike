/**
 * 「「MA」の自軍コマンドを１つホールドして、次の効果を発動できる⇒…」型の NC 効果（ギンガマン RS-376〜RS-380 等）。
 *
 * ナンバーの欄の効果の一部で、発動は任意（「発動できる」）。NC が成立したら、指定カテゴリのリリース状態の自軍コマンドを
 * 選ぶ選択（見送り可）を出す。コマンドを選ぶとそれをホールドし（コスト）、「⇒」の後の効果を解決する。
 * 効果の本文は文言で解釈する（HOLD_BODY_HANDLERS）。解釈できない本文は起動の申し出を出さない（何もしない）。
 *
 * 「SP1」が先頭にあれば（「「SP1」「MA」の自軍コマンドを…」）、NC 成立で「SP1」になる（コマンドのホールドとは無関係）。
 */
import type { Category } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { effectiveCommandCategories, getDefinition, isSmallUnit } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { listDslEffectsForTrigger } from "../dsl/effectLookup";
import { isSelectableByOpponentEffect } from "../keywords/effectTargetability";
import { buildLogEntry } from "../log/formatLog";
import { grantSp1ToBattleUnit, markBattleNcEffect } from "./namedUnitEffects";
import { buildEffectHoldPayment } from "./commandPayment";
import type { ComboOutcome } from "./comboTypes";
import { openEffectChoice } from "./pendingChoices";
import { applyThunderRoar } from "./legend1/set6NamedEffects348";
import { enemyCommandHoldSubstitutes } from "./legend1/set7NamedEffectsB";
import { shifuSubstituteAvailable } from "./legend1/set6NamedEffectsB";
import { registerKibaShot } from "./legend1/set6AuditFixes";
import { rk6CommandHoldBlocked } from "./rk/rk6Fields";

export const HOLD_ACTIVATE_EFFECT_PREFIX = "hold_activate::";

const HOLD_TO_ACTIVATE_RE =
  /^(「SP1」)?「([A-Z]{2})」の自軍コマンドを[1１]つホールドして、?次の効果を発動できる⇒(.+)$/;

type HoldContext = {
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  sourceCardId: string;
  sourceInstanceId: string;
  effectId: string;
  /** コストとしてホールドした自軍コマンド。 */
  heldCommand: CardInstance;
};

type BodyHandler = {
  match: RegExp;
  /** 本文を解決する（選択を開くこともある）。 */
  resolve: (state: GameState, ctx: HoldContext, m: RegExpMatchArray) => GameState;
};

function enemySmallUnits(
  state: GameState,
  ctx: HoldContext,
  zones: Array<"battle" | "rush">,
  pick: (c: CardInstance) => boolean,
): string[] {
  const enemyId = opponent(ctx.playerId);
  const ids: string[] = [];
  for (const zone of zones) {
    for (const c of state.players[enemyId][zone]) {
      if (!isSmallUnit(state.definitions, c)) continue;
      if (!isSelectableByOpponentEffect(state, ctx.playerId, c.instanceId, ctx.sourceCardId)) continue;
      if (pick(c)) ids.push(c.instanceId);
    }
  }
  return ids;
}

function openDestroyChoice(state: GameState, ctx: HoldContext, valid: string[]): GameState {
  if (valid.length === 0) return state;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: `${ctx.effectId}_destroy`,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.sourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "discard",
    selectCount: 1,
    optional: false,
  });
}

const comboNumberOf = (state: GameState, cardId: string) => getDefinition(state.definitions, cardId)?.comboNumber;

const HOLD_BODY_HANDLERS: BodyHandler[] = [
  {
    // RS-376【炎一閃】「敵軍バトルエリアからナンバーを持たないSユニットを1体選び、撃破する。」
    match: /^敵軍(バトル|ラッシュ)エリアからナンバーを持たないSユニットを1体選び、?撃破する。?$/,
    resolve: (state, ctx, m) =>
      openDestroyChoice(
        state,
        ctx,
        enemySmallUnits(state, ctx, [m[1] === "ラッシュ" ? "rush" : "battle"], (c) => comboNumberOf(state, c.cardId) == null),
      ),
  },
  {
    // RS-378【流水の鼓動】「ホールドしたコマンドにナンバーがあれば、そのナンバーと同じナンバーを持つ敵軍Sユニットを1体選び撃破する。」
    match: /^ホールドしたコマンドにナンバーがあれば、そのナンバーと同じナンバーを持つ敵軍Sユニットを1体選び、?撃破する。?$/,
    resolve: (state, ctx) => {
      const number = comboNumberOf(state, ctx.heldCommand.cardId);
      if (typeof number !== "number") return state;
      return openDestroyChoice(
        state,
        ctx,
        enemySmallUnits(state, ctx, ["battle", "rush"], (c) => comboNumberOf(state, c.cardId) === number),
      );
    },
  },
  {
    // RS-377【キバショット】「このターン、リリース状態の敵軍コマンドがホールドされたとき、ホールドされたコマンドの必要パワーの数字と
    // 同じ必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する。」（誘発の処理は rules/legend1/set6AuditFixes.ts）
    match: /^このターン、?リリース状態の敵軍コマンドがホールドされたとき、?ホールドされたコマンドの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び、?撃破する。?$/,
    resolve: (state, ctx) => registerKibaShot(state, ctx.playerId, ctx.sourceInstanceId),
  },
  {
    // RS-380【花弁の爪】「敵軍コマンドをすべてホールドする。」
    match: /^敵軍コマンドをすべてホールドする。?$/,
    resolve: (state, ctx) => {
      const enemyId = opponent(ctx.playerId);
      // RK-116 マグナギガ【そびえる巨体】: 敵軍バトルエリアにあれば、このユニットの効果ではホールドされない
      // （atwiki/page-645 カード評価「ギンガピンク…の能力の防止」。rules/rk/rk6Fields.ts）。
      if (rk6CommandHoldBlocked(state, enemyId, ctx.sourceCardId)) return state;
      const enemy = state.players[enemyId];
      return {
        ...state,
        ...updatePlayer(state, enemyId, {
          ...enemy,
          command: enemy.command.map((c) => (c.commandHeld ? c : { ...c, commandHeld: true })),
        }),
      };
    },
  },
  {
    // RS-379【雷の雄叫び】「このターン、特徴「メカ」を持つ敵軍ユニットの、効果名を持つテキストは無効になり、発動もできない。」
    // （本文の解決は rules/legend1/set6NamedEffects348.ts の applyThunderRoar）
    match: /^このターン、?特徴「メカ」を持つ敵軍ユニットの、?効果名を持つテキストは無効になり、?発動もできない。?$/,
    resolve: (state, ctx) => applyThunderRoar(state, ctx.playerId),
  },
];

type ParsedHoldEffect = {
  effectId: string;
  sp1: boolean;
  category: Category;
  body: string;
  handler: BodyHandler | undefined;
};

function parseHoldEffect(cardId: string): ParsedHoldEffect | null {
  const effects = listDslEffectsForTrigger(cardId, "nc");
  if (effects.length !== 1) return null;
  const effect = effects[0]!;
  const m = (effect.text ?? "").replace(/\s+/g, "").match(HOLD_TO_ACTIVATE_RE);
  if (!m) return null;
  const body = m[3]!;
  return {
    effectId: effect.id,
    sp1: !!m[1],
    category: m[2] as Category,
    body,
    handler: HOLD_BODY_HANDLERS.find((h) => h.match.test(body)),
  };
}

/** NC 効果が「「X」の自軍コマンドを１つホールドして、次の効果を発動できる⇒…」型か。 */
export function isHoldToActivateNc(cardId: string): boolean {
  return parseHoldEffect(cardId) !== null;
}

function ownHoldableCommands(state: GameState, playerId: PlayerId, category: Category): string[] {
  const player = state.players[playerId];
  return player.command
    .filter((c) => !c.commandHeld)
    .filter((c) => effectiveCommandCategories(player, state.definitions, c.cardId).includes(category))
    .map((c) => c.instanceId);
}

function holdableCommands(state: GameState, playerId: PlayerId, category: Category): string[] {
  const own = ownHoldableCommands(state, playerId, category);
  // RS-469 ギンガベリック【雷の星獣】: 自軍バトルフェイズ中、「MA」の自軍コマンドをホールドするかわりに、敵軍コマンドを1つ選び
  // ホールドしてもよい（R-REPL-03。rules/legend1/set7NamedEffectsB.ts）。
  return [...own, ...enemyCommandHoldSubstitutes(state, playerId, category)];
}

/**
 * RS-429【暮らしの中に修行あり】: 自軍ターン中、「MA」の自軍コマンドをホールドする代わりに「WB」の自軍コマンド＋追加1つを
 * ホールドしてもよい。使えるなら、支払いの候補（MA のコマンドを先に、その後ほかのリリース状態の自軍コマンド）。
 * 「ホールドしたコマンド」は MA のかわりにホールドした WB のコマンド1つだけ（grnrngr/faq-card-6 RS-378 Q）。
 */
function shifuHoldCandidates(state: GameState, playerId: PlayerId, category: Category): string[] | null {
  if (category !== "MA" || !shifuSubstituteAvailable(state, playerId, [category])) return null;
  const primary = ownHoldableCommands(state, playerId, category);
  const rest = state.players[playerId].command
    .filter((c) => !c.commandHeld && !primary.includes(c.instanceId))
    .map((c) => c.instanceId);
  return [...primary, ...rest];
}

/**
 * NC 成立時の処理。「SP1」を得て、効果を起動できるよう NC の成立を記録する（起動はバトル進入の行動ウィンドウで
 * activate_field_unit_ability。rules/fieldActivatedAbilities.ts）。型に当てはまらなければ null（ほかの NC 処理に任せる）。
 * 本文を解釈できない効果も、見送れない別の処理（敵軍コマンドの強制ホールド等）にはしない。
 */
export function tryApplyHoldToActivateNc(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): ComboOutcome | null {
  const parsed = parseHoldEffect(card.cardId);
  if (!parsed) return null;
  let next = markBattleNcEffect(state, playerId, card.instanceId, parsed.effectId);
  const logs = [buildLogEntry(playerId, "number_combo", card.cardId, state.definitions, parsed.effectId)];
  if (parsed.sp1) next = grantSp1ToBattleUnit(next, playerId, card.instanceId);
  return { state: next, logs };
}

/**
 * このユニットの「…ホールドして、次の効果を発動できる」を今起動できるか。自軍バトルフェイズに NC が成立して出た直後の
 * 行動ウィンドウ（アタック・ストライクの前）で、指定カテゴリのリリース状態の自軍コマンドがあるときだけ。
 */
export function canActivateHoldToActivate(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const parsed = parseHoldEffect(card.cardId);
  if (!parsed?.handler) return false;
  if (state.phase !== "battle" || state.activePlayer !== playerId) return false;
  const entry = state.pendingBattleEntry;
  if (!entry || entry.playerId !== playerId || entry.instanceId !== card.instanceId) return false;
  if (card.battleActed) return false;
  if (!card.activatedNcEffects?.includes(parsed.effectId)) return false;
  return holdableCommands(state, playerId, parsed.category).length > 0 || shifuHoldCandidates(state, playerId, parsed.category) !== null;
}

/**
 * 起動: 自軍コマンドを選んでホールドする選択（見送り可）を開き、コマンドの支払い（effect_hold）を始める。
 * 支払いを終えると completeEffectHoldChoice → resolveHoldActivateChoice で本文を解決する。
 */
export function beginHoldToActivate(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  const parsed = parseHoldEffect(card.cardId);
  if (!parsed) return state;
  const shifu = shifuHoldCandidates(state, playerId, parsed.category);
  const valid = shifu ?? holdableCommands(state, playerId, parsed.category);
  if (valid.length === 0) return state;
  const opened = openEffectChoice(state, {
    playerId,
    effectId: `${HOLD_ACTIVATE_EFFECT_PREFIX}${parsed.effectId}`,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    phasePlayerId: playerId,
    kind: "select_command",
    commandFilter: "any",
    commandAction: "hold",
    validInstanceIds: valid,
    selectCount: 1,
    optional: true,
    ...(shifu ? { shifuSubstitute: true } : {}),
  });
  const payment = buildEffectHoldPayment(opened);
  return payment ? { ...opened, pendingCommandPayment: payment } : opened;
}

/** RS-429 の代用でホールドした2つのうち、MA のかわりの WB のコマンド（WB が2つなら先に選んだ方）。 */
export function shifuSubstituteCommandId(state: GameState, playerId: PlayerId, commandInstanceIds: string[]): string {
  const player = state.players[playerId];
  return (
    commandInstanceIds.find((id) => {
      const cmd = player.command.find((c) => c.instanceId === id);
      return !!cmd && effectiveCommandCategories(player, state.definitions, cmd.cardId).includes("WB");
    }) ?? commandInstanceIds[0]!
  );
}

export function isHoldActivateChoice(pending: PendingEffectChoice | undefined): boolean {
  return !!pending?.effectId.startsWith(HOLD_ACTIVATE_EFFECT_PREFIX);
}

/**
 * 選んだ自軍コマンドをホールドし（支払いで既にホールドしていればそのまま）、本文を解決する。
 * 選択は閉じた状態で返す（本文が選択を開けばそれが残る）。
 */
export function resolveHoldActivateChoice(
  state: GameState,
  pending: PendingEffectChoice,
  commandInstanceId: string,
): GameState | null {
  if (!pending.validInstanceIds.includes(commandInstanceId)) return null;
  const parsed = parseHoldEffect(pending.sourceCardId);
  if (!parsed?.handler) return null;
  // ホールドするのは自軍コマンド（コスト）か、RS-469【雷の星獣】でかわりに選んだ敵軍コマンド。
  const holderId = state.players[pending.playerId].command.some((c) => c.instanceId === commandInstanceId)
    ? pending.playerId
    : opponent(pending.playerId);
  const player = state.players[holderId];
  const held = player.command.find((c) => c.instanceId === commandInstanceId);
  if (!held) return null;
  let next: GameState = {
    ...state,
    pendingEffectChoice: undefined,
    activePlayer: pending.phasePlayerId,
    ...updatePlayer(state, holderId, {
      ...player,
      command: player.command.map((c) => (c.instanceId === commandInstanceId ? { ...c, commandHeld: true } : c)),
    }),
  };
  const m = parsed.body.match(parsed.handler.match)!;
  next = parsed.handler.resolve(
    next,
    {
      playerId: pending.playerId,
      phasePlayerId: pending.phasePlayerId,
      sourceCardId: pending.sourceCardId,
      sourceInstanceId: pending.sourceInstanceId ?? "",
      effectId: parsed.effectId,
      heldCommand: held,
    },
    m,
  );
  return next;
}
