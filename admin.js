// admin.js
"use strict";
const crypto = require("crypto");

const CODE = String(process.env.ADMIN_CODE || "");
const enabled = CODE.length >= 6;

const buffs = { coins: { mult: 1, until: 0 }, lemons: { mult: 1, until: 0 } };
const attempts = new Map();

const mult = (kind) => (Date.now() < buffs[kind].until ? buffs[kind].mult : 1);

function snapshot() {
  const now = Date.now();
  const out = {};
  for (const k of Object.keys(buffs)) {
    const secs = Math.max(0, Math.round((buffs[k].until - now) / 1000));
    out[k] = { mult: secs > 0 ? buffs[k].mult : 1, secs };
  }
  return out;
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function tryLogin(ip, code) {
  if (!enabled) return { ok: false, msg: "Admin is not enabled on this server." };
  const now = Date.now();
  const a = attempts.get(ip) || { fails: 0, until: 0 };
  if (now < a.until) return { ok: false, msg: "Too many attempts. Try again in a few minutes." };
  if (safeEqual(String(code).slice(0, 64), CODE)) { attempts.delete(ip); return { ok: true }; }
  a.fails++;
  if (a.fails >= 5) { a.until = now + 5 * 60 * 1000; a.fails = 0; }
  attempts.set(ip, a);
  return { ok: false, msg: "Wrong code." };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+n) ? +n : lo));

function handle(m, ctx) {
  const { online, Config, addCoins, totalDucks, broadcast } = ctx;
  const N = Config.DuckNames.length;
  const players = [...online.values()];
  const giveDuck = (d, tier) => {
    if (totalDucks(d) >= Config.MaxSlots(d.Stage)) return false;
    d.Ducks[tier - 1]++;
    return true;
  };
  const banner = (msg) => broadcast({ t: "banner", msg });

  switch (m.cmd) {
    case "coinBoost": {
      const x = clamp(m.mult, 1, 1000), mins = clamp(m.minutes, 1, 1440);
      buffs.coins = { mult: x, until: Date.now() + mins * 60000 };
      banner(`💰 GLOBAL BUFF: x${x} coins for ${mins} min!`);
      return `Coin boost x${x} for ${mins} min`;
    }
    case "lemonBoost": {
      const x = clamp(m.mult, 1, 1000), mins = clamp(m.minutes, 1, 1440);
      buffs.lemons = { mult: x, until: Date.now() + mins * 60000 };
      banner(`🍋 GLOBAL BUFF: x${x} lemons for ${mins} min!`);
      return `Lemon boost x${x} for ${mins} min`;
    }
    case "luckyHour": {
      const x = clamp(m.mult, 1, 1000), mins = clamp(m.minutes, 1, 1440);
      const until = Date.now() + mins * 60000;
      buffs.coins = { mult: x, until };
      buffs.lemons = { mult: x, until };
      banner(`🍀 LUCKY HOUR! x${x} coins AND lemons for ${mins} min!`);
      return `Lucky hour x${x} for ${mins} min`;
    }
    case "clearBuffs":
      buffs.coins = { mult: 1, until: 0 };
      buffs.lemons = { mult: 1, until: 0 };
      banner("Global buffs ended.");
      return "Buffs cleared";
    case "giveCoins": {
      const amt = clamp(m.amount, 1, 1e18);
      players.forEach((r) => addCoins(r.d, amt));
      banner(`💸 ADMIN GIFT: everyone received ${Config.Format(amt)} coins!`);
      return `Gave ${amt} coins to ${players.length} players`;
    }
    case "giveLemons": {
      const amt = clamp(m.amount, 1, 1e18);
      players.forEach((r) => (r.d.Lemons += amt));
      banner(`🍋 LEMON SHOWER: everyone received ${Config.Format(amt)} lemons!`);
      return `Gave ${amt} lemons to ${players.length} players`;
    }
    case "giftDuck": {
      const tier = Math.floor(clamp(m.tier, 1, N));
      let n = 0;
      players.forEach((r) => { if (giveDuck(r.d, tier)) n++; });
      banner(`🎁 FREE DUCK: everyone got a ${Config.DuckNames[tier - 1]}!`);
      return `Gave ${Config.DuckNames[tier - 1]} to ${n}/${players.length} players`;
    }
    case "duckRain": {
      let n = 0;
      players.forEach((r) => {
        for (let k = 0; k < 3; k++) if (giveDuck(r.d, 1 + Math.floor(Math.random() * N))) n++;
      });
      banner("🌧️ DUCK RAIN! High-tier ducks fell into everyone's pond!");
      return `Rained ${n} ducks on ${players.length} players`;
    }
    case "setRebirths": {
      const amount = Math.floor(clamp(m.amount, 0, 10000));
      players.forEach((r) => { r.d.Rebirths = amount; });
      banner(`⚡ ADMIN EVENT: Everyone's Rebirth count set to ${amount}!`);
      return `Set rebirths to ${amount} for all online players`;
    }
    case "teleportAll": {
      const worldId = clamp(m.world, 1, 3);
      players.forEach((r) => { r.d.World = worldId; });
      banner(`🌀 TELEPORT: Admin warped everyone to World ${worldId} (${Config.Worlds[worldId].name})!`);
      return `Teleported all players to World ${worldId}`;
    }
    case "clearDucks": {
      players.forEach((r) => { r.d.Ducks = new Array(N).fill(0); });
      banner("🧹 ADMIN EVENT: All duck ponds have been emptied!");
      return "Cleared all active players' ducks";
    }
    case "announce": {
      const msg = String(m.msg || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120);
      if (!msg) return "Empty message";
      banner("📢 " + msg);
      return "Announced";
    }
    default:
      return "Unknown command";
  }
}

module.exports = { enabled, mult, snapshot, tryLogin, handle };
