/**
 * RK catchall テキストのファミリ分類（検証用）。
 * Usage: npx tsx packages/cards/scripts/classify-rk-effects.ts
 */
import { readFileSync } from "node:fs";

export type RkFamily =
  | "passive_while_field"
  | "passive_note"
  | "enter_battle_destroy"
  | "enter_battle_hold"
  | "hold_self_enemy_power"
  | "enemy_to_power"
  | "power_zone_action"
  | "combo_named"
  | "combo_destroy_hold_all"
  | "hand_reveal_then"
  | "reveal_scry"
  | "ride_action"
  | "ride_grant_ability"
  | "release_command_bp"
  | "on_destroy_hold_command"
  | "on_destroy_grant"
  | "opponent_must"
  | "opponent_self_order"
  | "rush_discard_search"
  | "register_resist_battle"
  | "destroy_choose_enemy"
  | "damage_power_zone"
  | "deploy_rush"
  | "deploy_battle"
  | "hold_remaining"
  | "pick_remaining"
  | "pick_discard"
  | "return_zone"
  | "stack_cards"
  | "destroy_on_rush"
  | "destroy_all_on_battle_win"
  | "optional_hold_sp"
  | "ignore_rule_grant"
  | "bp_modify_attack"
  | "cannot_restrict"
  | "resident_hand"
  | "grant_effect_nc"
  | "unknown";

export function classifyRkEffectText(text: string): RkFamily {
  const t = text;
  if (/^※/.test(t) || (/にある間/.test(t) && !/発動できる/.test(t) && !/選び/.test(t))) {
    return "passive_while_field";
  }
  if (/ラッシュフェイズ中、このユニットを捨札にして.*山札を見て/.test(t)) return "rush_discard_search";
  if (/次の効果を、相手、自分の順に行う/.test(t)) return "opponent_self_order";
  if (/相手は次の制限を受ける|相手は.*しなければ|相手がそうしなかった/.test(t)) return "opponent_must";
  if (/からコンビネーションしたとき発動できる⇒ホールド状態のSユニットをすべて撃破/.test(t)) {
    return "combo_destroy_hold_all";
  }
  if (/からコンビネーションしたとき発動できる/.test(t)) return "combo_named";
  if (/手札を[23]枚選び、相手に見せてもよい/.test(t)) return "hand_reveal_then";
  if (/オモテにしてもよい|オモテにする/.test(t) && /山札/.test(t)) return "reveal_scry";
  if (/撃破されて捨札になったとき、このユニットカードを自軍コマンドゾーンにホールド/.test(t)) {
    return "on_destroy_hold_command";
  }
  if (/撃破されて捨札になったとき次の効果を発動できる/.test(t)) return "on_destroy_grant";
  if (/これにライドしている.*次の能力を得る/.test(t)) return "ride_grant_ability";
  if (/ライド/.test(t) && (/ライドオフ|ライドさせ|ライドしていない|ライド中/.test(t))) return "ride_action";
  if (/リリース状態の自軍コマンド.*BP\+/.test(t)) return "release_command_bp";
  if (/バトルエリアに出たとき.*ホールドしてもよい/.test(t) && /そうしたとき/.test(t)) {
    return "hold_self_enemy_power";
  }
  if (/バトルエリアに出たとき.*ホールドしてもよい/.test(t)) return "enter_battle_hold";
  if (/バトルエリアに出たとき.*撃破/.test(t)) return "enter_battle_destroy";
  if (/持ち主のパワーゾーンにダメージにして置/.test(t)) return "enemy_to_power";
  if (/パワーゾーン/.test(t) && (/ラッシュしたとき|バトルエリアに出たとき/.test(t))) return "power_zone_action";
  if (/レジストを持つ敵軍Sユニット.*バトルする/.test(t)) return "register_resist_battle";
  if (/撃破してもよい/.test(t) && /敵軍.*選び/.test(t)) return "destroy_choose_enemy";
  if (/パワーゾーン.*捨札/.test(t)) return "damage_power_zone";
  if (/ラッシュエリアに出/.test(t) && /バトルエリアに出たとき/.test(t)) return "deploy_rush";
  if (/アタックする/.test(t) && /バトルエリアに出た/.test(t)) return "deploy_battle";
  if (/ターンを終えるとき.*リリースするか、ホールド/.test(t)) return "hold_remaining";
  if (/ラッシュしたとき.*選んでもよい/.test(t) && /Sユニットか.*Mユニット/.test(t)) return "pick_remaining";
  if (/捨札からユニットカードを1枚選/.test(t)) return "pick_discard";
  if (/山札の下に戻|山札に戻/.test(t)) return "return_zone";
  if (/山札の下に戻してもよい/.test(t) && /重ねたカード/.test(t)) return "stack_cards";
  if (/ラッシュしたとき.*撃破/.test(t)) return "destroy_on_rush";
  if (/バトルで敵軍ユニットを撃破したとき.*すべて撃破/.test(t)) return "destroy_all_on_battle_win";
  if (/ラッシュしたとき、これをホールドしてもよい.*SP1/.test(t)) return "optional_hold_sp";
  if (/次の効果を発動する⇒/.test(t) && /にある間/.test(t)) return "ignore_rule_grant";
  if (/アタックしてバトルに勝つたび/.test(t)) return "bp_modify_attack";
  if (/パワーゾーンのオモテ向きのカードから.*ラッシュエリアに出してもよい/.test(t)) {
    return "cannot_restrict";
  }
  if (/常駐置き場からカードを1枚選び.*手札に加え/.test(t)) return "resident_hand";
  if (/次の効果を発動できる⇒|発動できる⇒/.test(t)) return "grant_effect_nc";
  if (/次の能力を得る⇒/.test(t)) return "ride_grant_ability";
  if (/にある間/.test(t)) return "passive_while_field";
  return "unknown";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = JSON.parse(readFileSync("/tmp/rk-catchalls.json", "utf8")) as Array<{
    id: string;
    text: string;
  }>;
  const counts = new Map<RkFamily, number>();
  const unknowns: string[] = [];
  for (const it of items) {
    const fam = classifyRkEffectText(it.text);
    counts.set(fam, (counts.get(fam) ?? 0) + 1);
    if (fam === "unknown") unknowns.push(`${it.id}: ${it.text.slice(0, 60)}`);
  }
  console.log([...counts.entries()].sort((a, b) => b[1] - a[1]));
  if (unknowns.length) {
    console.log("unknowns:", unknowns.length);
    unknowns.slice(0, 10).forEach((u) => console.log(u));
  }
}
