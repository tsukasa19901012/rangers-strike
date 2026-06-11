#!/usr/bin/env node
/**
 * core-playable catalog から legend3 unit effect スナップショットを生成（メンテ用）。
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const cardsPath = path.join(packageRoot, "src/generated/catalog/core-playable/cards.json");
const outPath = path.join(packageRoot, "pipeline/data/legend3-unit-effects-snapshot.json");

const NAME_TO_ID = {
  アカレンジャー: "RS-126",
  バイオジェット1号: "RS-128",
  バイオジェット2号: "RS-129",
  ジェットファルコン: "RS-134",
  ランドライオン: "RS-135",
  アクアドルフィン: "RS-136",
  スカイフェニックス: "RS-142",
  グランタウラス: "RS-144",
  ダッシュレオン: "RS-145",
  ドグランダー: "RS-146",
  モアローダー: "RS-147",
  ガオライオン: "RS-152",
  ガオイーグル: "RS-153",
  ガオシャーク: "RS-154",
  ガオバイソン: "RS-155",
  ガオタイガー: "RS-156",
  ガオエレファント: "RS-158",
  ガオコング: "RS-159",
  バイオハンター・シルバ: "RS-132",
  ゴーゴードリル: "RS-171",
  ゴーゴーショベル: "RS-172",
  ゴーゴーミキサー: "RS-173",
  ゴーゴークレーン: "RS-174",
  ゴーゴージェット: "RS-177",
};

const EFFECT_ID = {
  レッドビュート: "red_boot",
  バイオ粒子斬り: "bio_particle_slash",
  拠点攻撃: "base_attack",
  ステルス: "stealth",
  ファイヤーソード: "fire_sword",
  ミラージュビーム: "mirage_beam",
  反バイオ粒子砲: "anti_bio_cannon",
  ブルバドス活人剣: "blue_bados_life_sword",
  スーパーライブクラッシュ: "super_live_crush",
  ファルコンクロー: "falcon_claw",
  強襲: "assault",
  潜航: "submerge",
  ジェットスケボー: "jet_skateboard",
  ドルフィンアロー: "dolphin_arrow",
  データ解析: "data_analysis",
  紐拳: "string_fist",
  クラウンファイナルクラッシュ: "crown_final_crush",
  タウラスダイブ: "taurus_dive",
  超文明の守護: "hyper_civilization_guard",
  超力モアキャノン: "super_moa_cannon",
  スターライザー: "star_raiser",
  サイドナックル: "side_knuckle",
  バンパーボウ: "bumper_bow",
  怒涛裂断シャークショット: "furious_shark_shot",
  天地轟鳴アニマルハート: "heaven_earth_animal_heart",
  灼熱の咆哮: "scorching_roar",
  フェザーボム: "feather_bomb",
  鋼の角: "steel_horn",
  鋭い爪: "sharp_claw",
  悪鬼貫徹ネックスラスト: "oni_neck_last",
  エレファントシールド: "elephant_shield",
  ファイヤーダンス: "fire_dance",
  ブレイジングファイヤー: "blazing_fire",
  ノーブルスラッシュ: "noble_slash",
  サージングチョッパー: "surging_chopper",
  アイアンブロークン: "iron_broken",
  白虎十文字斬り: "white_tiger_cross_slash",
  ムーンライトソニック: "moonlight_sonic",
  爆竜必殺バキバキパンチ: "baki_baki_punch",
  爆竜必殺クロスサンダー: "cross_thunder",
  地球資源吸収: "earth_resource_absorb",
  闇の取引: "dark_deal",
  マキシマムペネトレーション: "maximum_penetration",
  ショベルディフェンス: "shovel_defense",
  ウォールシュート: "wall_shoot",
  リフトアップ: "lift_up",
  大突撃: "great_assault",
  空輸: "airlift",
  サガスナイパー: "sagas_sniper",
  森羅万象ビッグバンファイナル: "nature_big_bang_final",
};

function slug(name) {
  return EFFECT_ID[name] ?? name;
}

function parseZord(text) {
  const m = text.match(/合体[―-]([^【]+)/);
  if (!m) return null;
  const parts = m[1].trim().split(/[＋+]/).map((s) => s.trim()).filter(Boolean);
  const partnerCardIds = parts.map((n) => NAME_TO_ID[n]).filter(Boolean);
  if (partnerCardIds.length === 0) return null;
  return { text: `合体―${parts.join("＋")}`, partnerCardIds };
}

function inferEffectId(name, body, card) {
  if (typeof card.comboNumber === "number" && /^「SP1」$/.test(body.trim())) {
    return "grant_sp1";
  }
  return slug(name);
}

const SP1_TOKEN = "「SP1」";

function restAfterSp1(body) {
  return body.startsWith(SP1_TOKEN) ? body.slice(SP1_TOKEN.length).trim() : "";
}

/** NC の SP1 と別タイミングの能力が同居する場合は分割する。 */
function shouldSplitSp1FromNamedEffect(rest) {
  return rest.includes("ターンを終える") || rest.includes("撃破したとき");
}

function inferTrigger(body, card) {
  if (card.comboNumber === "L" && body.includes("このユニットからコンビネーションする")) {
    return { type: "joint_combo_l" };
  }
  if (card.comboNumber === "R" && body.includes("コンビネーションするとき")) {
    return { type: "joint_combo_r" };
  }
  if (
    typeof card.comboNumber === "number" &&
    body.startsWith(SP1_TOKEN) &&
    !shouldSplitSp1FromNamedEffect(restAfterSp1(body))
  ) {
    return { type: "nc" };
  }
  if (body.includes("ラッシュしたとき")) return { type: "on_rush" };
  if (body.includes("バトルエリアに出るとき") || body.includes("バトルエリアに出たとき")) {
    return { type: "enter_battle" };
  }
  if (body.includes("バトルするとき") || body.includes("アタックするとき") || body.includes("アタックして")) {
    return { type: "on_attack" };
  }
  if (body.includes("撃破したとき") || body.includes("してもよい")) return { type: "conditional" };
  if (typeof card.comboNumber === "number") return { type: "nc" };
  return { type: "while_in_field" };
}

function parseUnnamed(text) {
  const out = [];
  const prefix = text.split(/(?=【)/)[0] ?? "";
  for (const line of prefix.split("。").map((s) => s.trim()).filter(Boolean)) {
    if (!line.startsWith("※")) continue;
    if (
      line.includes("コマンド") &&
      line.includes("ホールド") &&
      line.includes("バトルエリアに出られない")
    ) {
      out.push({ kind: "note", text: line, rule: "battle_entry_hold", holdCount: 1 });
    } else if (line.includes("ラッシュしたとき") && line.includes("パワーゾーン") && line.includes("捨札")) {
      const discardCount = /[２2]/.test(line) ? 2 : 1;
      out.push({ kind: "note", text: line, rule: "rush_power_to_discard", discardCount });
    } else if (line.includes("自軍ターン中") && line.includes("バトルエリアに出られない")) {
      out.push({ kind: "note", text: line, rule: "cannot_enter_battle_own_turn" });
    } else if (line.includes("ラッシュエリアのSユニット") && line.includes("捨札")) {
      out.push({ kind: "note", text: line, rule: "battle_entry_discard_s_from_rush" });
    } else if (line.includes("敵軍ラッシュエリアのSユニットにアタックできる")) {
      out.push({ kind: "note", text: line, rule: "can_attack_enemy_rush_s" });
    } else if (line.includes("敵軍バトルエリアのSユニットにアタックできない")) {
      out.push({ kind: "note", text: line, rule: "cannot_attack_enemy_battle_s" });
    } else if (
      line.includes("特徴「航空機」") &&
      line.includes("アタックされない")
    ) {
      out.push({ kind: "note", text: line, rule: "requires_aircraft_attacker" });
    } else if (line.includes("ラッシュしたターン") && line.includes("バトルエリアに出られない")) {
      out.push({ kind: "note", text: line, rule: "no_battle_entry_turn_rushed" });
    } else if (line.includes("手札からカードを") && line.includes("捨札") && line.includes("バトルエリアに出られない")) {
      const discardCount = /[２2]/.test(line) ? 2 : 1;
      out.push({ kind: "note", text: line, rule: "battle_entry_discard_from_hand", discardCount });
    } else if (line.includes("バトルエリアにあるとき") && line.includes("「MA」が追加")) {
      out.push({ kind: "note", text: line, rule: "battle_adds_ma_category" });
    } else if (line.includes("からコンビネーションしなければバトルエリアに出られない")) {
      const partner = /「(.+?)」/.exec(line)?.[1];
      const partnerId = partner ? NAME_TO_ID[partner] : undefined;
      out.push({
        kind: "note",
        text: line,
        rule: "battle_entry_combo_from",
        ...(partnerId ? { partnerCardIds: [partnerId] } : {}),
      });
    } else {
      out.push({ kind: "note", text: line });
    }
  }
  const zord = parseZord(text);
  if (zord) out.unshift({ kind: "zord", text: zord.text, partnerCardIds: zord.partnerCardIds });
  return out;
}

function parseNamed(text, card) {
  const out = [];
  const re = /【([^】]+)】([^【]*)/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1].split("（")[0].trim();
    const body = (m[2] ?? "").trim().replace(/^⇒/, "").trim();
    if (!body && name !== "鋭い爪") continue;
    const effectBody = body || SP1_TOKEN;
    const rest = restAfterSp1(effectBody);
    if (
      typeof card.comboNumber === "number" &&
      rest &&
      shouldSplitSp1FromNamedEffect(rest)
    ) {
      out.push({
        name: "SP+1",
        text: SP1_TOKEN,
        effectId: "grant_sp1",
        trigger: { type: "nc" },
      });
      out.push({
        name,
        text: rest,
        effectId: slug(name),
        trigger: inferTrigger(rest, card),
      });
      continue;
    }
    out.push({
      name,
      text: effectBody,
      effectId: inferEffectId(name, effectBody, card),
      trigger: inferTrigger(effectBody, card),
    });
  }
  return out;
}

async function main() {
  const catalog = JSON.parse(await readFile(cardsPath, "utf8"));
  const result = {};
  for (const card of catalog.cards.filter((c) => c.type === "unit")) {
    const text = card.text ?? "";
    result[card.id] = {
      ...(card.rushAdditionalCondition
        ? { rushAdditionalCondition: card.rushAdditionalCondition }
        : {}),
      rawText: text,
      unnamedText: parseUnnamed(text),
      namedEffects: parseNamed(text, card),
    };
  }
  await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(result).length} legend3 unit effect blocks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
