#!/usr/bin/env node
// Relax the PocketJS 0.14 Vita host's USB-debug JS watchdog for this app.
//
// The stock host (hosts/vita/src/lib.rs) interrupts guest evaluation after 5 s
// and each frame turn after 250 ms when built with the usb-debug feature. On a
// real PS Vita, evaluating the bundled rules engine and some CPU turns exceed
// those limits, so the guest dies with "InternalError: interrupted" before the
// first frame. Release builds without usb-debug have no watchdog at all.
//
// Limits (ms) can be overridden with POCKET_VITA_EVAL_MS / POCKET_VITA_FRAME_MS.
// The patch is idempotent and re-applied on every build because the toolchain
// lives in node_modules.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FRAMEWORK_ROOT } from "./toolchain.mjs";

const evalMs = Number(process.env.POCKET_VITA_EVAL_MS ?? 120_000);
const frameMs = Number(process.env.POCKET_VITA_FRAME_MS ?? 30_000);
const file = join(FRAMEWORK_ROOT, "hosts/vita/src/lib.rs");
let src = readFileSync(file, "utf8");
const before = src;

// Stock and previously patched forms are both rewritten to the current limits.
src = src.replace(
  /std::time::Duration::from_(?:secs\(5\)|millis\(\d+\) \/\* rs-eval \*\/)/g,
  `std::time::Duration::from_millis(${evalMs}) /* rs-eval */`,
);
src = src.replace(
  /std::time::Duration::from_millis\((?:250|\d+ \/\* rs-frame \*\/)\)/g,
  (m) => (m.includes("rs-eval") ? m : `std::time::Duration::from_millis(${frameMs} /* rs-frame */)`),
);

if (!src.includes("rs-eval") || !src.includes("rs-frame")) {
  console.error("patch-pocketjs-vita: watchdog sites not found; PocketJS host changed?");
  process.exit(1);
}
if (src !== before) writeFileSync(file, src);
console.log(`patch-pocketjs-vita: eval ${evalMs} ms, frame ${frameMs} ms`);
