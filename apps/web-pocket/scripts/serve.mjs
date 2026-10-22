#!/usr/bin/env node
// Minimal static server for dist/ (development only).
//   node scripts/serve.mjs [--port=8140]
// /api/share runs api/share.js with an in-memory store (boards are lost on restart).
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createShareHandlers } from "../api/share.js";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const port = Number((process.argv.find((a) => a.startsWith("--port=")) ?? "--port=8140").slice(7));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".pak": "application/octet-stream",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

const memory = new Map();
const memoryStore = {
  put: async (key, value) => (memory.has(key) ? false : (memory.set(key, value), true)),
  get: async (key) => memory.get(key) ?? null,
};
const share = createShareHandlers(() => memoryStore);

async function api(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request(new URL(req.url ?? "/", "http://127.0.0.1"), {
    method: req.method,
    headers: { "content-type": req.headers["content-type"] ?? "" },
    body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
  });
  const handler = req.method === "POST" ? share.POST : req.method === "GET" ? share.GET : null;
  const response = handler ? await handler(request) : new Response("", { status: 405 });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  if (path === "/api/share") {
    api(req, res).catch(() => res.writeHead(500).end());
    return;
  }
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`Rangers Strike (PocketJS web): http://127.0.0.1:${port}/`));
