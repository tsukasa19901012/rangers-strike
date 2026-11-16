#!/usr/bin/env node
// Tests of api/match.js (対人戦の部屋) over an in-memory store:
//   node scripts/build-server.mjs && node --test scripts/match-api-test.mjs   (npm test)
// Room creation and joining, tokens, a whole match played through the API (moves picked from each player's
// own view, the clock pushed past the time limit now and then so it always ends), the 「unchanged」 poll,
// resending a move, a write that loses a race being retried from a fresh read, the record of a finished match,
// rematch and the deck reveal.
import assert from "node:assert/strict";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { createMatchHandlers, memoryMatchStore } from "../api/match.js";
import { isGameCode } from "../api/share.js";

function harness() {
  const store = memoryMatchStore();
  let now = 1_700_000_000_000;
  const handlers = createMatchHandlers(() => store, () => now);
  const post = async (body) => {
    const res = await handlers.POST(new Request("http://x/api/match", { method: "POST", body: JSON.stringify(body) }));
    return { status: res.status, body: await res.json() };
  };
  const get = async (query) => {
    const res = await handlers.GET(new Request(`http://x/api/match?${new URLSearchParams(query)}`));
    return { status: res.status, body: await res.json() };
  };
  return { store, post, get, advance: (ms) => (now += ms) };
}

async function room(h, first = "host") {
  const created = await h.post({ op: "create", deck: { starter: "abarenoh" }, first });
  assert.equal(created.status, 200);
  const joined = await h.post({ op: "join", id: created.body.id, deck: { cards: Array(40).fill("RS-001") } });
  assert.equal(joined.status, 200);
  return { id: created.body.id, tokens: { player1: created.body.token, player2: joined.body.token } };
}

test("部屋を作って参加すると対戦が始まり、トークンは保存されない", async () => {
  const h = harness();
  const created = await h.post({ op: "create", deck: { starter: "abarenoh" }, first: "guest" });
  assert.equal(created.status, 200);
  assert.match(created.body.id, /^[A-Za-z0-9]{8}$/);
  assert.match(created.body.token, /^[A-Za-z0-9]{24}$/);
  assert.equal(created.body.view.status, "waiting");
  const waiting = await h.get({ id: created.body.id, t: created.body.token });
  assert.equal(waiting.body.view.status, "waiting");
  const joined = await h.post({ op: "join", id: created.body.id, deck: { starter: "dekaranger" } });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.view.status, "playing");
  assert.equal(joined.body.view.you, "player2");
  assert.equal(joined.body.view.view.actionPlayerId, "player2"); // the guest goes first
  const stored = [...h.store.map.values()][0];
  assert.ok(!stored.includes(created.body.token) && !stored.includes(joined.body.token));
  // A second guest, a wrong token, a bad deck, an unknown room.
  assert.equal((await h.post({ op: "join", id: created.body.id, deck: { starter: "abarenoh" } })).status, 409);
  assert.equal((await h.get({ id: created.body.id, t: "x".repeat(24) })).status, 403);
  assert.equal((await h.post({ op: "create", deck: { starter: "nope" } })).status, 400);
  assert.equal((await h.post({ op: "create", deck: { cards: ["ZZ-999"] } })).status, 400);
  assert.equal((await h.get({ id: "AAAAAAAA", t: created.body.token })).status, 404);
  assert.equal((await h.post({ op: "nope", id: created.body.id })).status, 400);
});

test("API だけで決着まで進み、同じ操作の再送は2回適用されない", async () => {
  const h = harness();
  const { id, tokens } = await room(h, "random");
  const seq = { player1: 0, player2: 0 };
  let rand = 7;
  const next = () => ((rand = (Math.imul(rand, 1103515245) + 12345) >>> 0) / 2 ** 32);
  let view = (await h.get({ id, t: tokens.player1 })).body.view;
  let steps = 0;
  let resent = 0;
  for (; steps < 6000 && view.status === "playing"; steps++) {
    const actor = view.view.actionPlayerId;
    const own = (await h.get({ id, t: tokens[actor] })).body.view;
    if (own.status !== "playing") break;
    if (next() < 0.01) {
      h.advance(200_000); // past the time limit: the server plays on for the actor
      view = (await h.get({ id, t: tokens.player1 })).body.view;
      continue;
    }
    h.advance(300);
    const legal = own.view.legalActions;
    assert.ok(legal.length > 0, `step ${steps}: no legal move for ${actor}`);
    seq[actor] += 1;
    const request = { op: "act", id, t: tokens[actor], seq: seq[actor], version: own.version, action: legal[Math.floor(next() * legal.length)] };
    const sent = await h.post(request);
    assert.equal(sent.status, 200);
    if (!sent.body.result.ok) {
      // A move the engine refuses on the real board too (not the API's concern); its number is simply skipped.
      assert.equal(sent.body.result.reason, "rejected", JSON.stringify(sent.body.result));
    } else if (steps % 9 === 0) {
      // The answer was lost: the same request again is not applied twice.
      const again = await h.post(request);
      assert.deepEqual(again.body.result, { ok: true, duplicate: true });
      assert.equal(again.body.view.version, sent.body.view.version);
      resent++;
    }
    view = sent.body.view;
    // The other player's poll: "unchanged" while nothing happened since their version.
    const other = actor === "player1" ? "player2" : "player1";
    const polled = (await h.get({ id, t: tokens[other] })).body.view;
    assert.equal((await h.get({ id, t: tokens[other], v: String(polled.version) })).body.unchanged, true);
  }
  const final = (await h.get({ id, t: tokens.player2 })).body.view;
  assert.equal(final.status, "finished", `not finished after ${steps} steps`);
  assert.ok(["win", "timeout"].includes(final.result.reason), JSON.stringify(final.result));
  assert.equal(final.lastSeq, seq.player2);
  assert.ok(resent > 3);
  // Moves after the end are refused.
  const late = await h.post({ op: "act", id, t: tokens.player1, seq: seq.player1 + 1, version: final.version, action: { type: "end_phase", playerId: "player1" } });
  assert.equal(late.body.result.reason, "finished");
});

test("同時に書かれたら読み直してやり直す", async () => {
  const h = harness();
  const { id, tokens } = await room(h, "host");
  const view = (await h.get({ id, t: tokens.player1 })).body.view;
  const swap = h.store.swap;
  let lost = 0;
  h.store.swap = async (...args) => {
    if (lost++ === 0) {
      // Someone else wrote first: the stored revision moves on (same match, so the move still applies).
      const key = args[0];
      const value = h.store.map.get(key);
      const bar = value.indexOf("|");
      h.store.map.set(key, `${Number(value.slice(0, bar)) + 1}${value.slice(bar)}`);
    }
    return swap(...args);
  };
  const sent = await h.post({ op: "act", id, t: tokens.player1, seq: 1, version: view.version, action: view.view.legalActions[0] });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.result.ok, true);
  assert.equal(lost, 2);
  assert.equal((await h.get({ id, t: tokens.player1 })).body.view.lastSeq, 1);
});

test("投了すると相手の勝ちで終わる", async () => {
  const h = harness();
  const { id, tokens } = await room(h);
  const out = await h.post({ op: "resign", id, t: tokens.player2 });
  assert.equal(out.status, 200);
  assert.equal(out.body.view.status, "finished");
  assert.deepEqual(out.body.view.result, { winner: "player1", reason: "resign" });
});

test("参加前ならホストは部屋を閉じられ、閉じた部屋には入れない", async () => {
  const h = harness();
  const created = await h.post({ op: "create", deck: { starter: "abarenoh" } });
  assert.equal((await h.post({ op: "cancel", id: created.body.id, t: "x".repeat(24) })).status, 403);
  assert.equal((await h.post({ op: "cancel", id: created.body.id, t: created.body.token })).body.ok, true);
  assert.equal((await h.post({ op: "join", id: created.body.id, deck: { starter: "abarenoh" } })).status, 404);
  const { id, tokens } = await room(h);
  assert.equal((await h.post({ op: "cancel", id, t: tokens.player1 })).status, 409);
});

test("終わった対戦は1回だけ記録され、記録は CPU 戦の記録と同じ形に対人戦の印", async () => {
  const h = harness();
  const { id, tokens } = await room(h, "guest");
  // A few moves, then a resign.
  for (let i = 0; i < 6; i++) {
    const v = (await h.get({ id, t: tokens.player1 })).body.view;
    const actor = v.view.actionPlayerId;
    const own = (await h.get({ id, t: tokens[actor] })).body.view;
    await h.post({ op: "act", id, t: tokens[actor], seq: own.lastSeq + 1, version: own.version, action: own.view.legalActions[0] });
  }
  assert.equal((await h.post({ op: "resign", id, t: tokens.player1 })).status, 200);
  await h.get({ id, t: tokens.player2 });
  await h.post({ op: "reveal", id, t: tokens.player2 });
  const keys = [...h.store.map.keys()].filter((k) => k.startsWith("game:"));
  assert.equal(keys.length, 1);
  const code = h.store.map.get(keys[0]);
  assert.ok(isGameCode(code));
  const record = JSON.parse(gunzipSync(Buffer.from(code.slice(4), "base64url")).toString("utf8"));
  assert.equal(record.pvp, true);
  assert.equal(record.winner, "player2");
  assert.equal(record.reason, "resign");
  assert.equal(record.firstPlayer, "player2");
  assert.equal(record.humanDeck, "abarenoh");
  assert.equal(record.cpuDeck, "custom:pvp");
  assert.equal(record.cpuCards.length, 40);
  assert.equal(record.actions.length, 6);
});

test("再戦: 片方が希望すると相手に伝わり、両者そろうと同じトークンで入れる新しい部屋が始まる（先攻は逆）", async () => {
  const h = harness();
  const { id, tokens } = await room(h, "host");
  assert.equal((await h.post({ op: "rematch", id, t: tokens.player1 })).status, 409); // まだ対戦中
  await h.post({ op: "resign", id, t: tokens.player2 });
  const seen = (await h.get({ id, t: tokens.player2 })).body.view.version;
  const first = await h.post({ op: "rematch", id, t: tokens.player1 });
  assert.deepEqual(first.body.post.rematch, { you: true, them: false });
  // The other side's "anything new?" poll sees it.
  const polled = await h.get({ id, t: tokens.player2, v: String(seen) });
  assert.equal(polled.body.unchanged, undefined);
  assert.deepEqual(polled.body.post.rematch, { you: false, them: true });
  // Pressing again changes nothing.
  const again = await h.post({ op: "rematch", id, t: tokens.player1 });
  assert.equal(again.body.view.version, first.body.view.version);
  const second = await h.post({ op: "rematch", id, t: tokens.player2 });
  const next = second.body.post.rematch.id;
  assert.match(next, /^[A-Za-z0-9]{8}$/);
  assert.notEqual(next, id);
  assert.equal((await h.get({ id, t: tokens.player1 })).body.post.rematch.id, next);
  const p1 = (await h.get({ id: next, t: tokens.player1 })).body.view;
  const p2 = (await h.get({ id: next, t: tokens.player2 })).body.view;
  assert.equal(p1.status, "playing");
  assert.equal(p1.you, "player1");
  assert.equal(p2.you, "player2");
  assert.equal(p1.view.actionPlayerId, "player2"); // the host went first last time
  assert.equal((await h.get({ id: next, t: "x".repeat(24) })).status, 403);
});

test("デッキ公開: 両者が同意したときだけ相手のデッキが届く", async () => {
  const h = harness();
  const { id, tokens } = await room(h);
  assert.equal((await h.post({ op: "reveal", id, t: tokens.player1 })).status, 409); // まだ対戦中
  await h.post({ op: "resign", id, t: tokens.player1 });
  const one = await h.post({ op: "reveal", id, t: tokens.player1 });
  assert.deepEqual(one.body.post.reveal, { you: true, them: false });
  assert.deepEqual((await h.get({ id, t: tokens.player2 })).body.post.reveal, { you: false, them: true });
  const two = await h.post({ op: "reveal", id, t: tokens.player2 });
  assert.equal(two.body.post.reveal.deck.length, 40);
  // The guest sees the host's starter (abarenoh), the host the guest's 40 × RS-001.
  assert.ok(two.body.post.reveal.deck.some((c) => c !== "RS-001"));
  const host = (await h.get({ id, t: tokens.player1 })).body.post.reveal;
  assert.equal(host.deck.length, 40);
  assert.ok(host.deck.every((c) => c === "RS-001"));
});
