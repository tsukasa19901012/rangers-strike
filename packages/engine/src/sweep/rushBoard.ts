/**
 * 全ユニットのラッシュ確認（rushAllUnits.test.ts）の盤面づくりと進め方。
 *
 * カードごとに、追加条件・必要パワー・カテゴリを満たす自軍ラッシュフェイズの盤面を、
 * テスト用の仮カードではなく本物のカードで組む。素材は追加条件の文から読み取り
 * （エンジンの判定を使わない）、カード名・特徴・「※これは「X」としてつかえる」で探す。
 */
import type { CardDefinition, RushAdditionalCondition } from "@rangers-strike/cards";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import { applyAction } from "../core/applyAction";
import type { CardInstance, GameState } from "../types/game";
import type { GameAction } from "../types/actions";

export type RushBoardOptions = {
  /** 自軍コマンドをユニットのカードで組むか、オペレーションのカードで組むか。 */
  commands: "unit" | "operation";
  /** 必要パワーに足すパワーの枚数（0 でちょうど、-1 で 1 枚足りない）。 */
  extraPower: number;
  /** カテゴリ分（と追加条件で使う分）のコマンドだけにする。省くと予備を 2 つ足す。 */
  tight?: boolean;
  /** コマンドだけ tight と同じにする（パワーは extraPower のまま）。 */
  minimalCommands?: boolean;
  /** 素材のユニットをラッシュエリアではなくバトルエリアに置く。 */
  materialsInBattle?: boolean;
};

/** 盤面を組めなかったとき（必要なカードがカタログに無い・追加条件の文を読めない）。 */
export class RushBoardSkip extends Error {}

export const base = createStarterGame({ player1Starter: "abarenoh", player2Starter: "dekaranger", seed: 1 });
export const all = Object.values(base.definitions) as CardDefinition[];
export const real = (d: CardDefinition) => !/^(TST|SPEC|CS|XX)/.test(d.id);
const cats = (d: CardDefinition) => (Array.isArray(d.category) ? d.category : [d.category]) as string[];
const norm = (s: string) => s.normalize("NFKC").replace(/\s/g, "");
const costNumber = (cost: unknown) => Number(/\d+/.exec(String(cost ?? 0))?.[0] ?? 0);

/** 場やコマンドに置いても何も起きない（ゾーンや手札に触れない）1 カテゴリの S ユニットとオペレーション。 */
export const plainUnits = all.filter(
  (d) =>
    real(d) &&
    d.type === "unit" &&
    d.size === "S" &&
    typeof d.category === "string" &&
    !d.rushAdditionalCondition &&
    !/コマンド|パワー|ラッシュ|手札|捨札|これが|ホールド|ゾーン/.test(d.text ?? ""),
);
export const plainOperations = all.filter(
  (d) => real(d) && d.type === "operation" && typeof d.category === "string" && !/コマンドゾーン|パワーゾーン|ラッシュ/.test(d.text ?? ""),
);

export const allUnitCards: CardDefinition[] = all.filter((d) => real(d) && d.type === "unit");

/** 「-」付き（ゾードダウン）や 0 でなく、必要パワーの数字だけパワーがいるユニットか。 */
export function needsPrintedPower(unit: CardDefinition): boolean {
  return !String(unit.powerCost).endsWith("-") && costNumber(unit.powerCost) > 0;
}

/** unit を手札に持つ盤面（自軍ラッシュフェイズ、チャージ済み）。手札の先頭が unit。 */
export function buildRushBoard(unit: CardDefinition, options: RushBoardOptions): GameState {
  let seq = 0;
  const mk = (cardId: string, extra: Partial<CardInstance> = {}): CardInstance => ({ instanceId: `${cardId}#${seq++}`, cardId, ...extra });
  const plain = (i: number) => plainUnits[i % plainUnits.length]!.id;
  const pool = options.commands === "unit" ? plainUnits : plainOperations;
  const cond: RushAdditionalCondition | undefined = unit.rushAdditionalCondition;
  const cid = cond?.conditionId ?? "none";
  const count = cond?.unitCount ?? 1;
  const isGate = cid === "state_gate";

  const hand = [mk(unit.id), mk(plain(3)), mk(plainOperations[3]!.id)];
  const command: CardInstance[] = [];
  const power: CardInstance[] = [];
  const rush: CardInstance[] = [];
  const battle: CardInstance[] = [];
  const discard: CardInstance[] = [];
  const operation: CardInstance[] = [];
  const enemyBattle: CardInstance[] = [];

  for (const cat of cats(unit)) {
    const d = pool.find((x) => cats(x).includes(cat));
    if (!d) throw new RushBoardSkip(`${options.commands} のコマンドに ${cat} のカードが無い`);
    command.push(mk(d.id, { commandHeld: false }));
  }
  const extraCommands = !options.tight && !options.minimalCommands ? 2 : cid === "hold_extra_command" || cid === "discard_command_card" ? count : 0;
  for (let i = 0; i < extraCommands; i++) command.push(mk(pool[i]!.id, { commandHeld: false }));

  const text = (cond?.text ?? "").normalize("NFKC");
  const quoted = (t: string) => [...t.matchAll(/「([^」]+)」/g)].map((m) => m[1]!);
  const unitLike = (x: CardDefinition) => real(x) && x.id !== unit.id && (x.type === "unit" || x.type === "vehicle");
  const byName = (name: string) =>
    all.find((x) => unitLike(x) && norm(x.name) === norm(name)) ??
    all.find((x) => unitLike(x) && norm(x.name).includes(norm(name))) ??
    all.find((x) => unitLike(x) && (x.features ?? []).includes(name)) ??
    // 「※これは「X」としてつかえる」（マジイエロー＝マジガルーダ等）
    all.find((x) => unitLike(x) && (x.text ?? "").normalize("NFKC").includes(`「${name.normalize("NFKC")}」としてつかえる`));
  const byFeatures = (features: string[], anyOf: boolean, size?: string) =>
    all.find(
      (x) =>
        real(x) &&
        x.id !== unit.id &&
        x.type === "unit" &&
        (!size || x.size === size) &&
        (anyOf ? features.some((f) => (x.features ?? []).includes(f)) : features.every((f) => (x.features ?? []).includes(f))),
    );
  const need = (d: CardDefinition | undefined, what: string) => {
    if (!d) throw new RushBoardSkip(`${what} のカードがカタログに無い`);
    return d;
  };
  const numberIn = (re: RegExp) => Number(re.exec(text)?.[1] ?? 1);
  const fill = (n: number, zone: CardInstance[]) => {
    for (let i = 0; i < n; i++) zone.push(mk(plain(i * 7 + 3)));
  };
  /** 合体―A（またはB）＋C…：枠ごとに、カッコの外の名前とカッコ内の「または」の名前を候補にする。 */
  const fusionSlots = () => {
    const line = /合体[―－─-]+(.+?)(?:※|【|$)/s.exec((unit.text ?? "").normalize("NFKC"));
    if (!line) throw new RushBoardSkip("本文に合体―の行が無い");
    const slots: string[][] = [];
    let depth = 0;
    let outer = "";
    let inner = "";
    const flush = () => {
      slots.push([outer, ...inner.split("または")].flatMap((x) => x.split("または")).map((x) => x.replace(/^[-‐]/, "").trim()).filter(Boolean));
      outer = "";
      inner = "";
    };
    for (const ch of line[1]!.trim()) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (depth === 0 && ch === "+") flush();
      else if (depth === 0) outer += ch;
      else inner += ch;
    }
    flush();
    return slots;
  };

  let m: RegExpExecArray | null;
  if ((m = /自軍捨札に「([^」]+)」がある/.exec(text))) discard.push(mk(need(byName(m[1]!), m[1]!).id));
  const rest = text.replace(/自軍捨札に「[^」]+」があるとき、/, "");
  if (isGate && /^自軍捨札に「[^」]+」がある$/.test(text)) {
    // 捨札に置いた分で満たす
  } else if (/合体(ユニット|ビークル)/.test(rest)) {
    for (const names of fusionSlots()) rush.push(mk(need(names.map(byName).find(Boolean), names.join("・")).id));
  } else if ((m = /特徴(「[^」]+」(?:(?:または|と|か)「[^」]+」)*)を持つ(?:、)?自軍(S|L)?ユニット/.exec(rest)) && !/敵軍/.test(rest)) {
    const d = need(byFeatures(quoted(m[1]!), !m[1]!.includes("と"), m[2]), m[1]!);
    for (let i = 0; i < count; i++) (isGate ? battle : rush).push(mk(d.id));
  } else if ((m = /特徴(「[^」]+」(?:または「[^」]+」)*)を持つ自軍コマンド/.exec(rest))) {
    command.push(mk(need(byFeatures(quoted(m[1]!), true), m[1]!).id, { commandHeld: false }));
  } else if ((m = /特徴「([^」]+)」を持つ敵軍ユニット/.exec(rest))) {
    enemyBattle.push(mk(need(byFeatures([m[1]!], true), m[1]!).id));
  } else if ((m = /特徴「([^」]+)」を持つ捨札が自軍と敵軍で合計(\d+)枚/.exec(rest))) {
    const d = need(byFeatures([m[1]!], true), m[1]!);
    for (let i = 0; i < Number(m[2]); i++) discard.push(mk(d.id));
  } else if ((m = /カード名に(「[^」]+」(?:または「[^」]+」)*)を含む自軍(ユニット|パワー)/.exec(rest))) {
    const names = quoted(m[1]!);
    const d = need(all.find((x) => unitLike(x) && names.some((n) => norm(x.name).includes(norm(n)))), m[1]!);
    if (m[2] === "パワー") power.push(mk(d.id, { faceDown: false }));
    else for (let i = 0; i < count; i++) (isGate ? battle : rush).push(mk(d.id));
  } else if (/ダークアライアンスを持つ自軍Lユニット/.test(rest)) {
    rush.push(mk(need(all.find((x) => real(x) && x.type === "unit" && x.size === "L" && cats(x).includes("DA")), "DA の L ユニット").id));
  } else if (/リードを持つ自軍Sユニット/.test(rest)) {
    rush.push(mk(need(all.find((x) => real(x) && x.type === "unit" && x.size === "S" && /※リード/.test(x.text ?? "")), "リードを持つ S ユニット").id));
  } else if (/常駐置き場のカード/.test(rest)) {
    for (let i = 0; i < numberIn(/(\d+)枚/); i++) operation.push(mk(plainOperations[i]!.id));
  } else if (/必要パワーの数字が\d+以上の自軍パワー/.test(rest)) {
    const min = numberIn(/数字が(\d+)以上/);
    const big = all.filter((x) => real(x) && x.type === "unit" && costNumber(x.powerCost) >= min).slice(0, numberIn(/パワーを(\d+)枚/));
    power.push(...big.map((x) => mk(x.id, { faceDown: false })));
  } else if (/捨札(?:の合計)?が\d+枚以上/.test(rest)) {
    fill(numberIn(/(\d+)枚以上/), discard);
  } else if (/ユニットが\d+体以上/.test(rest)) {
    fill(numberIn(/(\d+)体以上/), battle);
  } else if (quoted(rest).length > 0) {
    // 「自軍「X」1体を…」「自軍「A」「B」「C」をそれぞれ…」「自軍「A」1体と「B」1体を…」「自軍エリアに「X」がある」
    const names = quoted(rest);
    const each = /それぞれ|」(?:\d体)?と「|」「/.test(rest);
    for (const name of each ? names : [names[0]!]) {
      const d = need(byName(name), name);
      for (let i = 0; i < (each ? 1 : count); i++) (isGate ? battle : rush).push(mk(d.id, /ホールド状態/.test(rest) ? { commandHeld: true } : {}));
    }
  } else if (/自軍(S)?ユニット/.test(rest)) {
    fill(count, rush);
  } else if (isGate) {
    throw new RushBoardSkip(`追加条件を読めない: ${text}`);
  }

  // 条件で置いたパワーも数えて、合計を必要パワー＋extraPower にそろえる（ゾードダウンは素材だけで出す）
  const powerTotal = cid.startsWith("zord_down_") ? 0 : Math.max(0, costNumber(unit.powerCost) + options.extraPower);
  for (let i = 0; power.length < powerTotal; i++) power.push(mk(plain(i), { faceDown: false }));
  if (options.materialsInBattle) battle.push(...rush.splice(0));

  const p1 = base.players.player1;
  const p2 = base.players.player2;
  return {
    ...base,
    turn: 5,
    phase: "rush",
    activePlayer: "player1",
    log: [],
    players: {
      player1: { ...p1, hand, power, command, rush, battle, discard, operation, exile: [], hasChargedThisTurn: true, deck: p1.deck.slice(0, 20) },
      player2: { ...p2, hand: p2.deck.slice(0, 3), rush: [], battle: enemyBattle, command: [], power: [], discard: [], deck: p2.deck.slice(3, 23) },
    },
  };
}

const NEVER_PICK = /cancel|end_phase|end_turn/;

/**
 * 手札の instanceId のユニットを、合法手だけを使ってラッシュする。ラッシュが合法手に出なければ "not offered"、
 * 途中で止まれば理由を返す。支払い・素材・効果の選択は合法手の先頭を選ぶ（キャンセルとフェイズ終了は選ばない）。
 */
export function rushThroughLegalActions(state: GameState, instanceId: string): { ok: true } | { ok: false; why: string } {
  const cardId = state.players.player1.hand.find((c) => c.instanceId === instanceId)?.cardId;
  const touches = (a: GameAction) =>
    ("sourceInstanceId" in a && a.sourceInstanceId === instanceId) || ("zordInstanceId" in a && a.zordInstanceId === instanceId);
  const starts = getLegalActions(state).filter(
    (a) => a.playerId === "player1" && (touches(a) || (a.type === "rush" && a.instanceId === instanceId)),
  );
  if (starts.length === 0) return { ok: false, why: "not offered" };
  let why = "";
  for (const start of starts) {
    let r = applyAction(state, start);
    if (!r.ok) {
      why = `start refused: ${r.error}`;
      continue;
    }
    let s = r.state!;
    for (let step = 0; step < 60; step++) {
      const me = s.players.player1;
      if (me.rush.some((c) => c.instanceId === instanceId) || me.battle.some((c) => c.instanceId === instanceId)) return { ok: true };
      // ラッシュした直後に効果で手札へ戻るもの（RS-319 デカマスター）も、ラッシュはできている
      if (s.log.some((l) => l.startsWith(`player1|rush|${cardId}|`))) return { ok: true };
      const actor = getActionPlayerId(s);
      const actions = getLegalActions(s).filter((a) => !NEVER_PICK.test(a.type) && a.playerId === actor);
      const pending = s.pendingCommandPayment ?? s.pendingZordSetup ?? s.pendingEffectChoice ?? s.pendingRush ?? s.pendingEffectRush;
      // 素材を選び終えたあとのコマンドの支払いなど、同じユニットの続きの手
      const next = pending ? actions[0] : actions.find(touches);
      if (!next) {
        why = pending ? "no action while pending" : `stopped: ${[...new Set(actions.map((a) => a.type))].join(",")}`;
        break;
      }
      r = applyAction(s, next);
      if (!r.ok) {
        why = `refused ${next.type}: ${r.error}`;
        break;
      }
      s = r.state!;
    }
  }
  return { ok: false, why: why || "too many steps" };
}
