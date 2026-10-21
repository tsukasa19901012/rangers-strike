// Browser host for the PocketJS web app.
//
// The PocketJS dev host (hosts/web/engine.js) draws a fixed 480x272 canvas for
// console apps. This host is the production page for a full-window app:
//   - the logical viewport follows the window (at least 1024x640: smaller
//     windows scale the canvas down; portrait windows get a narrow phone
//     viewport) and the core rasterizes at density 2;
//   - mouse / pen / touch reach the guest over the "pocket.overlay" service
//     channel (hover, press and the raw position for card hit tests);
//   - keyboard keys map to the console buttons the app also understands;
//   - text fields (deck builder search / deck name) are real <input>s laid
//     over the canvas where the guest asks for them, so phones get their own
//     keyboard and IME; typed text goes back over the same channel;
//   - card images are decoded by the browser and uploaded as textures on
//     demand (globalThis.__rsCardArt);
//   - the rules engine is a separate ESM file (globalThis.__rsEngine);
//   - a frame is only rasterized and copied to the canvas when the draw list
//     changed.
import { createWasmUi } from "./pocket/wasm-ops.js";

const DENSITY = 2;
const MIN_W = 1024;
const MIN_H = 640;
const MAX_W = 1680;
const MAX_H = 1050;
const PORTRAIT_W = [430, 600];
const OVERLAY = "pocket.overlay";
const PSM_8888 = 3;
const IMG_FLAG_LINEAR = 2;
const ART_W = 128;
const ART_H = 256;

const BTN = {
  SELECT: 0x0001, START: 0x0008, UP: 0x0010, RIGHT: 0x0020, DOWN: 0x0040, LEFT: 0x0080,
  LTRIGGER: 0x0100, RTRIGGER: 0x0200, TRIANGLE: 0x1000, CIRCLE: 0x2000, CROSS: 0x4000, SQUARE: 0x8000,
};
// The app reads these through client-core's ButtonRepeater (src/app.tsx lists the meanings).
const KEYMAP = {
  ArrowUp: BTN.UP, ArrowDown: BTN.DOWN, ArrowLeft: BTN.LEFT, ArrowRight: BTN.RIGHT,
  Enter: BTN.CIRCLE, KeyZ: BTN.CIRCLE,
  Escape: BTN.CROSS, Backspace: BTN.CROSS, KeyX: BTN.CROSS,
  Space: BTN.RTRIGGER, KeyE: BTN.RTRIGGER,
  KeyL: BTN.LTRIGGER, KeyQ: BTN.LTRIGGER,
  Tab: BTN.TRIANGLE, KeyS: BTN.TRIANGLE,
  Delete: BTN.SQUARE, KeyA: BTN.SQUARE,
};

const canvas = document.getElementById("screen");
const boot = document.getElementById("boot");
const statusEl = document.getElementById("status");
const barEl = document.querySelector("#bar > div");
const setStatus = (text, progress) => {
  statusEl.textContent = text;
  if (progress !== undefined) barEl.style.width = `${Math.round(progress * 100)}%`;
};

function fail(error) {
  console.error(error);
  boot.classList.add("error");
  boot.style.display = "flex";
  setStatus(`起動できませんでした: ${error && error.message ? error.message : error}`);
}

/**
 * Logical viewport for the window. Landscape: CSS px, at least MIN, at most
 * MAX (the canvas is CSS-scaled outside that range). Portrait (phones held
 * upright): a narrow logical width, PORTRAIT_W[0]..[1], and the window's
 * aspect; the app switches to its stacked phone layout.
 */
function viewportFor(cssW, cssH) {
  if (cssW < cssH) {
    const w = Math.max(PORTRAIT_W[0], Math.min(PORTRAIT_W[1], Math.round(cssW)));
    return { w, h: Math.round((w * cssH) / cssW) };
  }
  const up = Math.max(MIN_W / cssW, MIN_H / cssH, 1);
  let w = cssW * up;
  let h = cssH * up;
  const down = Math.min(MAX_W / w, MAX_H / h, 1);
  w *= down;
  h *= down;
  return { w: Math.max(MIN_W, Math.round(w)), h: Math.max(MIN_H, Math.round(h)) };
}

async function fetchBytes(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label} (${url}) が見つかりません: ${res.status}`);
  return res.arrayBuffer();
}

async function start() {
  setStatus("ルールエンジンを読み込み中…", 0.1);
  const [engine, wasmBytes, pak, source, images] = await Promise.all([
    import("./engine.js"),
    fetchBytes("pocket/pocketjs.wasm", "PocketJS"),
    fetchBytes("app/main.pak", "app pak"),
    fetch("app/main.js").then((r) => (r.ok ? r.text() : Promise.reject(new Error(`app/main.js: ${r.status}`)))),
    fetch("card-images.json").then((r) => (r.ok ? r.json() : {})),
  ]);
  setStatus("画面を準備中…", 0.7);

  let view = viewportFor(window.innerWidth, window.innerHeight);
  const wasm = await createWasmUi(wasmBytes, { width: view.w, height: view.h, rasterDensity: DENSITY });
  const ctx = canvas.getContext("2d");
  let image = null;
  const sizeCanvas = () => {
    canvas.width = view.w * DENSITY;
    canvas.height = view.h * DENSITY;
    const scale = Math.min(window.innerWidth / view.w, window.innerHeight / view.h);
    canvas.style.width = `${Math.floor(view.w * scale)}px`;
    canvas.style.height = `${Math.floor(view.h * scale)}px`;
    image = ctx.createImageData(canvas.width, canvas.height);
    placeFields();
  };

  // ---- text inputs over the canvas (the guest sends {type:"rs.fields"})
  const inputs = new Map(); // field id -> <input>
  let fields = [];
  function placeFields() {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / view.w;
    const shown = new Set();
    for (const f of fields) {
      shown.add(f.id);
      let el = inputs.get(f.id);
      if (!el) {
        el = document.createElement("input");
        el.type = f.id === "search" ? "search" : "text";
        el.className = "field";
        el.dataset.field = f.id;
        el.enterKeyHint = f.id === "search" ? "search" : "done";
        el.autocomplete = "off";
        el.spellcheck = false;
        el.addEventListener("input", () => {
          inbox.push(JSON.stringify({ type: "state", value: { kind: "text", id: f.id, text: el.value } }));
        });
        document.body.appendChild(el);
        inputs.set(f.id, el);
      }
      el.placeholder = f.placeholder;
      el.maxLength = f.maxLength;
      if (el.value !== f.text && document.activeElement !== el) el.value = f.text;
      Object.assign(el.style, {
        display: "block",
        left: `${rect.left + f.rect.x * scale}px`,
        top: `${rect.top + f.rect.y * scale}px`,
        width: `${f.rect.w * scale}px`,
        height: `${f.rect.h * scale}px`,
        // 16 px at least: smaller text makes iOS zoom the page when the field is focused.
        fontSize: `${Math.max(16, Math.round(15 * scale))}px`,
        padding: `0 ${Math.round(10 * scale)}px`,
      });
    }
    for (const [id, el] of inputs) {
      if (shown.has(id)) continue;
      if (document.activeElement === el) canvas.focus();
      el.style.display = "none";
    }
  }
  sizeCanvas();

  // ---- service channel: pointer events for the guest (framework overlay-host)
  const inbox = [];
  wasm.ops.svcOpen = (name) => name === OVERLAY;
  wasm.ops.svcPoll = () => (inbox.length ? `${inbox.splice(0).join("\n")}\n` : null);
  wasm.ops.svcSend = (line) => {
    // The guest asks for a pointer cursor over clickable things.
    try {
      const msg = JSON.parse(line);
      if (msg && msg.type === "rs.cursor") canvas.classList.toggle("pointer", !!msg.pointer);
      else if (msg && msg.type === "rs.fields") {
        fields = msg.fields || [];
        placeFields();
      }
    } catch {
      // not ours
    }
  };
  const toLogical = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(view.w - 1, ((e.clientX - rect.left) * view.w) / rect.width)),
      y: Math.max(0, Math.min(view.h - 1, ((e.clientY - rect.top) * view.h) / rect.height)),
    };
  };
  const send = (kind, e, extra = {}) => {
    const { x, y } = toLogical(e);
    // Framework desktop pointer (hover focus + press on focusable views)...
    if (kind === "move") inbox.push(JSON.stringify({ type: "pointer", event: { kind: "move", x, y } }));
    else if ((kind === "down" || kind === "up") && extra.button === 0) {
      inbox.push(JSON.stringify({ type: "pointer", event: { kind: "button", x, y, down: kind === "down" } }));
    }
    // ...and the raw event for the app's own card hit tests.
    inbox.push(JSON.stringify({ type: "state", value: { kind, x, y, ...extra } }));
  };
  canvas.addEventListener("pointermove", (e) => send("move", e));
  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus();
    canvas.setPointerCapture?.(e.pointerId);
    send("down", e, { button: e.button });
  });
  canvas.addEventListener("pointerup", (e) => send("up", e, { button: e.button }));
  canvas.addEventListener("pointerleave", () => {
    inbox.push(JSON.stringify({ type: "pointer", event: { kind: "move", x: null, y: null } }));
    inbox.push(JSON.stringify({ type: "state", value: { kind: "leave", x: -1, y: -1 } }));
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      send("wheel", e, { dy: Math.sign(e.deltaY) });
    },
    { passive: false },
  );

  // ---- keyboard -> console buttons
  // A key pressed and released between two frames still counts for one frame.
  let held = 0;
  let tapped = 0;
  window.addEventListener("keydown", (e) => {
    // Typing in a text field: keys are text, not buttons. Enter / Esc leave the field.
    if (e.target instanceof HTMLInputElement) {
      if (!e.isComposing && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault();
        canvas.focus();
      }
      return;
    }
    if (e.key === "/" && inputs.get("search")?.style.display === "block") {
      e.preventDefault();
      inputs.get("search").focus();
      return;
    }
    const bit = KEYMAP[e.code];
    if (bit === undefined || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    held |= bit;
    tapped |= bit;
  });
  window.addEventListener("keyup", (e) => {
    const bit = KEYMAP[e.code];
    if (bit !== undefined) held &= ~bit;
  });
  window.addEventListener("blur", () => (held = 0));

  // ---- card images: decoded by the browser, uploaded as linear-filtered textures
  const art = new Map(); // cardId -> handle (-1 while loading or missing)
  let artVersion = 0;
  const scratch = document.createElement("canvas");
  scratch.width = ART_W;
  scratch.height = ART_H;
  const sctx = scratch.getContext("2d", { willReadFrequently: true });
  sctx.imageSmoothingQuality = "high";
  function loadArt(cardId) {
    const url = images[cardId];
    if (!url) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      sctx.clearRect(0, 0, ART_W, ART_H);
      sctx.drawImage(img, 0, 0, ART_W, ART_H);
      const rgba = sctx.getImageData(0, 0, ART_W, ART_H).data;
      const blob = new Uint8Array(8 + rgba.length);
      const dv = new DataView(blob.buffer);
      dv.setUint16(0, ART_W, true);
      dv.setUint16(2, ART_H, true);
      blob[4] = PSM_8888;
      blob[5] = IMG_FLAG_LINEAR;
      blob.set(rgba, 8);
      const handle = wasm.ops.uploadImgEntry ? wasm.ops.uploadImgEntry(blob) : wasm.ops.uploadTexture(blob.subarray(8), ART_W, ART_H, PSM_8888);
      art.set(cardId, handle);
      artVersion++;
    };
    img.src = url;
  }
  globalThis.__rsCardArt = {
    /** Texture handle for a card ("back" for the card back); -1 until it has loaded. */
    texture(cardId) {
      const known = art.get(cardId);
      if (known !== undefined) return known;
      art.set(cardId, -1);
      loadArt(cardId);
      return -1;
    },
    version: () => artVersion,
  };

  // ---- guest
  globalThis.__rsEngine = engine;
  globalThis.ui = wasm.ops;
  globalThis.frame = undefined;
  globalThis.__simHz = 60;
  globalThis.__pocketApp = "rangers-strike-web";
  globalThis.__pak = pak;
  new Function(`${source}\n//# sourceURL=app/main.js`)();
  if (typeof globalThis.frame !== "function") throw new Error("app bundle installed no frame()");
  const frame = globalThis.frame;

  // ---- resize
  let pendingResize = false;
  const applyResize = () => {
    pendingResize = false;
    const next = viewportFor(window.innerWidth, window.innerHeight);
    if (next.w !== view.w || next.h !== view.h) {
      view = next;
      wasm.resizeViewport(view.w, view.h);
      globalThis.__pocketResizeViewport?.(view.w, view.h);
    }
    sizeCanvas();
    lastHash = -1n;
  };
  window.addEventListener("resize", () => (pendingResize = true));

  // ---- loop: fixed 60 Hz steps, rasterize only when the draw list changed
  let lastHash = -1n;
  let acc = 0;
  let last = performance.now();
  const step = () => {
    const buttons = held | tapped;
    tapped = 0;
    frame(buttons, 0x8080);
    wasm.tick();
  };
  const blit = () => {
    const hash = wasm.drawHash ? wasm.drawHash() : -2n;
    if (hash === lastHash && hash !== -2n) return;
    lastHash = hash;
    image.data.set(wasm.renderScaledIncremental(DENSITY));
    ctx.putImageData(image, 0, 0);
  };
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (pendingResize) applyResize();
    let dt = Math.min(250, now - last);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= 1000 / 60 && steps < 4) {
      try {
        step();
      } catch (e) {
        console.error("frame error", e);
      }
      acc -= 1000 / 60;
      steps++;
    }
    if (steps > 0) blit();
  };
  step();
  blit();
  boot.style.display = "none";
  canvas.focus();
  requestAnimationFrame(loop);
}

start().catch(fail);
