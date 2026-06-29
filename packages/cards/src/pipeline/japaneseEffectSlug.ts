import { hashEffectText, sanitizeEffectId } from "./metaMaps";

/** 効果名に頻出する漢字（読みはローマ字 slug 用）。 */
const KANJI_PHRASES: Record<string, string> = {
  灼熱: "shakunetsu",
  忍法: "ninpo",
  超忍法: "choninpo",
  音撃打: "ongekida",
  真紅: "shinku",
  力: "chikara",
  号: "go",
  太陽: "taiyo",
  石: "seki",
  火: "hi",
  炎: "honoo",
  花: "hana",
  爆: "baku",
  弾: "dan",
  真: "shin",
  向: "ko",
  両: "ryo",
  断: "dan",
  王: "ou",
  月: "tsuki",
  風: "kaze",
  雷: "kami",
  水: "mizu",
  土: "tsuchi",
  光: "hikari",
  闇: "yami",
  魔: "ma",
  神: "shin",
  龍: "ryu",
  虎: "tora",
  獅: "shi",
  鷹: "taka",
  剣: "ken",
  刀: "to",
  拳: "ken",
  脚: "kyaku",
  盾: "tate",
  甲: "ko",
  翼: "tsubasa",
  牙: "kiba",
  爪: "tsume",
  角: "tsuno",
  波: "nami",
  撃: "geki",
  斬: "zan",
  破: "ha",
  壊: "kai",
  守: "mamoru",
  護: "go",
};

/** カタカナ1文字〜拗音（長音含む）→ ローマ字。 */
const KANA: Record<string, string> = {
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o",
  ァ: "a", ィ: "i", ゥ: "u", ェ: "e", ォ: "o",
  カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko",
  ガ: "ga", ギ: "gi", グ: "gu", ゲ: "ge", ゴ: "go",
  キャ: "kya", キュ: "kyu", キョ: "kyo",
  ギャ: "gya", ギュ: "gyu", ギョ: "gyo",
  サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so",
  ザ: "za", ジ: "ji", ズ: "zu", ゼ: "ze", ゾ: "zo",
  シャ: "sha", シュ: "shu", ショ: "sho",
  ジャ: "ja", ジュ: "ju", ジョ: "jo",
  タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to",
  ダ: "da", ヂ: "ji", ヅ: "zu", デ: "de", ド: "do",
  チャ: "cha", チュ: "chu", チョ: "cho",
  ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no",
  ニャ: "nya", ニュ: "nyu", ニョ: "nyo",
  ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho",
  バ: "ba", ビ: "bi", ブ: "bu", ベ: "be", ボ: "bo",
  パ: "pa", ピ: "pi", プ: "pu", ペ: "pe", ポ: "po",
  ヒャ: "hya", ヒュ: "hyu", ヒョ: "hyo",
  ビャ: "bya", ビュ: "byu", ビョ: "byo",
  ピャ: "pya", ピュ: "pyu", ピョ: "pyo",
  マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo",
  ミャ: "mya", ミュ: "myu", ミョ: "myo",
  ヤ: "ya", ユ: "yu", ヨ: "yo",
  ャ: "ya", ュ: "yu", ョ: "yo",
  ラ: "ra", リ: "ri", ル: "ru", レ: "re", ロ: "ro",
  リャ: "rya", リュ: "ryu", リョ: "ryo",
  ワ: "wa", ヲ: "wo", ン: "n",
  ヴ: "vu", ー: "",
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "wo", ん: "n",
};

const KANA_KEYS = Object.keys(KANA).sort((a, b) => b.length - a.length);

export function normalizeEffectName(name: string): string {
  return name.split("（")[0]?.trim() ?? name;
}

function applyKanjiPhrases(text: string): string {
  let out = text;
  const phrases = Object.keys(KANJI_PHRASES).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    out = out.split(phrase).join(` ${KANJI_PHRASES[phrase]} `);
  }
  return out;
}

export function kanaToRomaji(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; ) {
    let matched = false;
    for (const key of KANA_KEYS) {
      if (!text.startsWith(key, i)) continue;
      out += KANA[key] ?? "";
      i += key.length;
      matched = true;
      break;
    }
    if (!matched) {
      const ch = text[i]!;
      if (/[a-zA-Z0-9]/.test(ch)) out += ch.toLowerCase();
      else if (ch === "・" || ch === "／" || ch === "/") out += "_";
      else if (ch === "の") out += "_no_";
      else if (/\s/.test(ch)) out += "_";
      i += 1;
    }
  }
  return out;
}

/** 日本語効果名から readable な snake_case ID を生成する。 */
export function slugifyJapaneseEffectName(name: string): string {
  const base = normalizeEffectName(name);
  let prepared = base.replace(/（[^）]*）/g, " ").replace(/[・／/]/g, "_");
  prepared = applyKanjiPhrases(prepared);
  prepared = prepared.replace(/(\d+)号/g, "_$1_go");
  const romaji = kanaToRomaji(prepared);
  const slug = sanitizeEffectId(
    romaji
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, ""),
  );
  if (slug.length >= 2 && !slug.startsWith("named_")) return slug;
  return `effect_${hashEffectText(base).slice(0, 12)}`;
}
