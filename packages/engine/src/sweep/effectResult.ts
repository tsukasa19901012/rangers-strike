/**
 * 効果の結果の確認（effectsAllCards.test.ts の「結果」）。効果の文の動詞（破壊する・引く・手札に戻す・ホールドする等）
 * ごとに、盤面でカードがそのとおりに動いたかを、使う前と後のカードの置き場所を比べて確かめる。
 *
 * 比べるのはカードの置き場所（どちらの、どのゾーン）とホールド・オモテ／ウラ、ダメージだけ。BP・能力の付与・
 * 山札の並びは見ない。使ったカード自身と、その支払い・追加条件で動かしたカードは比べない（effectBoard の drive が集める）。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";

type Place = { owner: PlayerId; zone: string; held: boolean; faceDown: boolean };

const FIELD = new Set(["battle", "rush"]);
// プレイヤーの他の配列（modifiers 等）はカードを指すだけなので見ない。
const ZONES = ["deck", "hand", "discard", "power", "command", "rush", "battle", "operation", "exile", "commander"] as const;

/** カードごとの置き場所。重なったカード（ユニットの下等）は「battle/下のキー」のように置き場所に入れる。 */
export function placesOf(state: GameState): Map<string, Place> {
  const out = new Map<string, Place>();
  const walk = (owner: PlayerId, zone: string, cards: unknown) => {
    if (!Array.isArray(cards)) return;
    for (const c of cards) {
      if (!c || typeof c !== "object" || !("instanceId" in c)) continue;
      const card = c as Record<string, unknown>;
      out.set(String(card.instanceId), { owner, zone, held: card.commandHeld === true, faceDown: card.faceDown === true });
      for (const [k, v] of Object.entries(card)) if (Array.isArray(v)) walk(owner, `${zone}/${k}`, v);
    }
  };
  for (const owner of ["player1", "player2"] as const) {
    for (const zone of ZONES) walk(owner, zone, state.players[owner][zone]);
  }
  return out;
}

export type Move = { id: string; from?: Place; to?: Place };

/** 使う前と後で置き場所・ホールド・オモテウラが変わったカード（excluded は除く）。 */
export function movesBetween(before: GameState, after: GameState, excluded: ReadonlySet<string>): Move[] {
  const a = placesOf(before);
  const b = placesOf(after);
  const moves: Move[] = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    if (excluded.has(id)) continue;
    const from = a.get(id);
    const to = b.get(id);
    if (from && to && from.owner === to.owner && from.zone === to.zone && from.held === to.held && from.faceDown === to.faceDown) continue;
    moves.push({ id, from, to });
  }
  return moves;
}

const top = (p?: Place) => p?.zone.split("/")[0];
const moved = (m: Move, from: (z?: string) => boolean, to: (z?: string) => boolean) =>
  (top(m.from) !== top(m.to) || m.from?.owner !== m.to?.owner) && from(top(m.from)) && to(top(m.to));
const any = () => true;
const is = (...zones: string[]) => (z?: string) => z !== undefined && zones.includes(z);
const onField = (z?: string) => z !== undefined && FIELD.has(z);

/** 効果の文の動詞と、それが起きたと言える動き。 */
const VERBS: Array<{ name: string; text: RegExp; seen: (moves: Move[], before: GameState, after: GameState) => boolean }> = [
  // 「撃破してもよい」「戻して」等の活用も読む
  { name: "撃破", text: /撃破(する|し)|破壊(する|し)/, seen: (ms) => ms.some((m) => moved(m, onField, (z) => !onField(z))) },
  { name: "引く", text: /\d枚(引|ひ)く|カードを(引|ひ)く|ドロー(する|し)/, seen: (ms) => ms.some((m) => moved(m, is("deck"), is("hand"))) },
  { name: "手札に戻す", text: /手札に戻(す|し)/, seen: (ms) => ms.some((m) => moved(m, (z) => z !== "hand", is("hand"))) },
  { name: "手札に加える", text: /手札に加え/, seen: (ms) => ms.some((m) => moved(m, (z) => z !== "hand", is("hand"))) },
  { name: "捨札にする", text: /捨札に(する|し|置)/, seen: (ms) => ms.some((m) => moved(m, any, is("discard"))) },
  { name: "ラッシュエリアに戻す", text: /ラッシュエリアに戻(す|し)/, seen: (ms) => ms.some((m) => moved(m, is("battle"), is("rush"))) },
  { name: "バトルエリアに出す", text: /バトルエリアに出(す|し)/, seen: (ms) => ms.some((m) => moved(m, any, is("battle"))) },
  { name: "ラッシュエリアに出す", text: /ラッシュエリアに(出(す|し)|置)/, seen: (ms) => ms.some((m) => moved(m, any, is("rush"))) },
  { name: "山札に戻す", text: /山札の(上|下)に[^。、]*?(戻|置)|山札に戻|山札に加え/, seen: (ms) => ms.some((m) => moved(m, any, is("deck"))) },
  { name: "コマンドゾーンに置く", text: /コマンドゾーンに(ホールド状態で|リリース状態で)?置/, seen: (ms) => ms.some((m) => moved(m, any, is("command"))) },
  { name: "パワーゾーンに置く", text: /パワーゾーンに(置|送)|ダメージにして置/, seen: (ms) => ms.some((m) => moved(m, any, is("power"))) },
  { name: "除外", text: /除外(する|し)|ゲームから取り除/, seen: (ms) => ms.some((m) => moved(m, any, is("exile"))) },
  // コマンドもユニットも commandHeld でホールドを表す
  { name: "ホールドする", text: /ホールド(する|し)/, seen: (ms) => ms.some((m) => m.to?.held === true && m.from?.held !== true) },
  { name: "リリースする", text: /リリース(する|し)/, seen: (ms) => ms.some((m) => m.from?.held === true && m.to?.held === false) },
  {
    name: "ダメージ",
    text: /ダメージを(\d|与え)|ダメージ\+|ダメージを受ける/,
    // ダメージはパワーゾーンのウラ向きのカード
    seen: (ms, b, a) =>
      (["player1", "player2"] as const).some((p) => a.players[p].damage !== b.players[p].damage) ||
      ms.some((m) => top(m.to) === "power" && m.to?.faceDown === true && !(top(m.from) === "power" && m.from?.faceDown)),
  },
];

/**
 * 効果の文のうち、必ず起きる最初の 1 文。trigger（「これをラッシュしたとき」等）を含む【能力】の、trigger の後の最初の文
 * （trigger が無ければ本文の最初の文）。条件・分岐・選択肢・能力の付与・山札をオモテにする等を含む文は、
 * 盤面や選び方しだいで起きないことがあるので null（確かめない）。※の注記と「〜しなければ」の条件文は先に除く。
 */
export function certainSentence(card: CardDefinition, trigger?: RegExp): string | null {
  const seg = abilityText(card, trigger);
  if (seg === null) return null;
  const [sentence = "", next = ""] = seg.split("。").map((x) => x.trim());
  // 「…置く。置けなければ手札に加える」は置き場所しだい
  if (/^置けなければ/.test(next)) return null;
  return isCertain(sentence) ? sentence : null;
}

/**
 * trigger（「これをラッシュしたとき」等）を含む【能力】の、trigger の後の文（trigger が無ければ本文全体）。
 * ※の注記と「〜しなければ」の条件文は除く。trigger の前に条件があるもの（「〜のとき次の能力を得る⇒…」）は null。
 */
export function abilityText(card: CardDefinition, trigger?: RegExp): string | null {
  const text = (card.text ?? "").normalize("NFKC").replace(/※[^【。]*。?/g, "");
  let seg = text;
  if (trigger) {
    const part = text.split(/(?=【)/).find((p) => trigger.test(p));
    if (!part) return null;
    if (/能力を得|なら|とき|場合/.test(part.slice(0, part.search(trigger)))) return null;
    seg = part.slice(part.search(trigger)).replace(/^[^、]*、/, "");
  }
  return seg.replace(/[^。]*しなければ[^。]*。/g, "").trim();
}

/** 盤面や選び方しだいで起きないことがある文（条件・分岐・選択肢・能力の付与・山札をオモテにする等）でないか。 */
export function isCertain(sentence: string): boolean {
  return sentence.length > 0 && !UNCERTAIN.test(sentence);
}

const UNCERTAIN =
  /すべて|なら|あれば|場合|とき|たび|ごとに|につき|か、|かを選|か(撃破|ホールド|リリース|捨札)|◎|⇒|→|次の効果|能力を得|オモテに|見て|見せ|まで|好きな|できる|ターン中|間、|常駐|ただし|代わりに|以外/;

/** 使ったカード自身を動かす文。 */
export const SELF_SUBJECT = /^(このカード|このユニット|これ)を/;

/** 文に書かれた動詞。 */
export function verbsOf(sentence: string): string[] {
  return VERBS.filter((v) => v.text.test(sentence)).map((v) => v.name);
}

/** 動き（使う前と後）で起きた動詞。 */
export function seenVerbs(before: GameState, after: GameState, excluded: ReadonlySet<string>): Set<string> {
  const moves = movesBetween(before, after, excluded);
  return new Set(VERBS.filter((v) => v.seen(moves, before, after)).map((v) => v.name));
}

/** 動詞ごとの、それに当たる動きの数（ダメージは点数の増減）。 */
export function verbCounts(before: GameState, after: GameState, excluded: ReadonlySet<string>): Map<string, number> {
  const moves = movesBetween(before, after, excluded);
  const damage = (["player1", "player2"] as const).reduce((n, p) => n + Math.abs(after.players[p].damage - before.players[p].damage), 0);
  return new Map(VERBS.map((v) => [v.name, v.name === "ダメージ" ? damage : moves.filter((m) => v.seen([m], before, after)).length]));
}

/** 文に書かれているのに盤面で起きなかった動詞。「このカードを…」「これを…」の文は、使ったカード自身の動きも見る。 */
export function missingVerbs(
  sentence: string,
  before: GameState,
  after: GameState,
  excluded: ReadonlySet<string>,
  sourceInstanceId: string,
): string[] {
  const skip = SELF_SUBJECT.test(sentence) ? new Set([...excluded].filter((id) => id !== sourceInstanceId)) : excluded;
  const moves = movesBetween(before, after, skip);
  return VERBS.filter((v) => v.text.test(sentence) && !v.seen(moves, before, after)).map((v) => v.name);
}
