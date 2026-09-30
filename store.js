// Save storage. Uses a free Upstash Redis database when configured (survives redeploys),
// otherwise falls back to a local saves.json file.
//
// Env vars (from Upstash dashboard > your database > REST API):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
"use strict";
const fs = require("fs");
const path = require("path");

const URL_ = String(process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, "");
const TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || "");
const useRedis = !!(URL_ && TOKEN);
const HASH = "duck_saves";
const SAVE_FILE = path.join(process.env.DATA_DIR || __dirname, "saves.json");

async function redis(commands) {
  const res = await fetch(URL_ + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Upstash HTTP " + res.status);
  const out = await res.json();
  for (const o of out) if (o && o.error) throw new Error("Upstash: " + o.error);
  return out.map((o) => o.result);
}

function readFile() {
  try { return JSON.parse(fs.readFileSync(SAVE_FILE, "utf8")); } catch { return {}; }
}

async function load() {
  if (!useRedis) {
    console.log("Storage: local file (" + SAVE_FILE + "). Progress resets on hosts without a disk.");
    return readFile();
  }
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const [flat] = await redis([["HGETALL", HASH]]);
      const saves = {};
      if (Array.isArray(flat)) {
        for (let i = 0; i + 1 < flat.length; i += 2) {
          try { saves[flat[i]] = JSON.parse(flat[i + 1]); } catch {}
        }
      } else if (flat && typeof flat === "object") {
        for (const k of Object.keys(flat)) { try { saves[k] = JSON.parse(flat[k]); } catch {} }
      }
      if (!Object.keys(saves).length) {
        // first run: import an existing local saves.json if there is one
        const local = readFile();
        const tokens = Object.keys(local);
        if (tokens.length) {
          await redis(tokens.map((t) => ["HSET", HASH, t, JSON.stringify(local[t])]));
          console.log("Imported " + tokens.length + " players from saves.json into Upstash.");
          return local;
        }
      }
      console.log("Storage: Upstash Redis (" + Object.keys(saves).length + " players loaded).");
      return saves;
    } catch (e) {
      lastErr = e;
      console.error("Database load failed (attempt " + attempt + "/5):", e.message);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  // Refuse to start: starting empty could overwrite real player progress.
  throw new Error("Could not reach the database: " + (lastErr && lastErr.message));
}

// tokens: array of player tokens whose save should be written
async function save(tokens, saves) {
  if (useRedis) {
    const cmds = tokens.filter((t) => saves[t]).map((t) => ["HSET", HASH, t, JSON.stringify(saves[t])]);
    if (cmds.length) await redis(cmds);
  } else {
    const tmp = SAVE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(saves));
    fs.renameSync(tmp, SAVE_FILE);
  }
}

module.exports = { load, save, useRedis };
