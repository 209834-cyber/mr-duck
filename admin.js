// Admin module: global buffs, gifts, events and moderation.
// The secret code lives ONLY on the server (ADMIN_CODE environment variable).
"use strict";
const crypto = require("crypto");

const CODE = String(process.env.ADMIN_CODE || "");
const enabled = CODE.length >= 6;

const KINDS = ["coins", "lemons", "eggs"];
const buffs = {};
KINDS.forEach((k) => (buffs[k] = { mult: 1, until: 0 }));
const attempts = new Map(); // ip -> { fails, until }
const startedAt = Date.now();

const mult = (kind) => (buffs[kind] && Date.now() < buffs[kind].until ? buffs[kind].mult : 1);

function snapshot() {
  const now = Date.now(), out = {};
  for (const k of KINDS) {
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
const cleanText = (s, n) => String(s || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);

function handle(m, ctx) {
  const { online, Config, addCoins, totalDucks, broadcast } = ctx;
  const F = Config.Format;
  const N = Config.DuckNames.length;
  const all = [...online.values()];
  const who = String(m.target || "").trim().toLowerCase();
  const targets = who ? all.filter((r) => r.name.toLowerCase() === who) : all;
  const label = who ? (targets[0] ? targets[0].name : "nobody") : "everyone";
  const banner = (msg) => broadcast({ t: "banner", msg });
  const needTarget = () => (who && targets.length ? null : "Pick a player first.");

  const setBuff = (kind, x, mins) => { buffs[kind] = { mult: x, until: Date.now() + mins * 60000 }; };

  switch (m.cmd) {
    // ---------------------------------------------------------- global buffs
    case "coinBoost": case "lemonBoost": case "eggBoost": {
      const kind = { coinBoost: "coins", lemonBoost: "lemons", eggBoost: "eggs" }[m.cmd];
      const x = clamp(m.mult, 1, 1000), mins = clamp(m.minutes, 1, 1440);
      setBuff(kind, x, mins);
      const icon = { coins: "💰", lemons: "🍋", eggs: "🥚" }[kind];
      banner(`${icon} GLOBAL BUFF: x${x} ${kind} for ${mins} min!`);
      return `${kind} x${x} for ${mins} min`;
    }
    case "luckyHour": {
      const x = clamp(m.mult, 1, 1000), mins = clamp(m.minutes, 1, 1440);
      setBuff("coins", x, mins); setBuff("lemons", x, mins);
      banner(`🍀 LUCKY HOUR! x${x} coins AND lemons for ${mins} min!`);
      return `Lucky hour x${x} for ${mins} min`;
    }
    case "megaEvent": {
      const x = clamp(m.mult, 1, 1000), mins = clamp(m.minutes, 1, 1440);
      KINDS.forEach((k) => setBuff(k, x, mins));
      banner(`🎆 MEGA EVENT! x${x} coins, lemons AND golden eggs for ${mins} min!`);
      return `Mega event x${x} for ${mins} min`;
    }
    case "clearBuff": {
      const k = String(m.kind || "all");
      (k === "all" ? KINDS : KINDS.filter((x) => x === k)).forEach((x) => (buffs[x] = { mult: 1, until: 0 }));
      banner(k === "all" ? "All global buffs ended." : `The ${k} buff ended.`);
      return "Buff(s) cleared";
    }
    case "clearBuffs":
      KINDS.forEach((x) => (buffs[x] = { mult: 1, until: 0 }));
      banner("Global buffs ended.");
      return "Buffs cleared";

    // ------------------------------------------------- gifts (everyone/target)
    case "giveCoins": {
      const amt = clamp(m.amount, 1, 1e15);
      targets.forEach((r) => addCoins(r.d, amt));
      if (!who) banner(`💸 ADMIN GIFT: everyone received ${F(amt)} coins!`);
      return `Gave ${F(amt)} coins to ${label}`;
    }
    case "giveLemons": {
      const amt = clamp(m.amount, 1, 1e15);
      targets.forEach((r) => (r.d.Lemons += amt));
      if (!who) banner(`🍋 LEMON SHOWER: everyone received ${F(amt)} lemons!`);
      return `Gave ${F(amt)} lemons to ${label}`;
    }
    case "giveEggs": {
      const amt = Math.floor(clamp(m.amount, 1, 1e9));
      targets.forEach((r) => (r.d.Eggs += amt));
      if (!who) banner(`🥚 GOLDEN EGG RAIN: everyone received ${F(amt)} Golden Eggs!`);
      return `Gave ${amt} eggs to ${label}`;
    }
    case "giveTime": { // "time skip": income for N minutes
      const mins = clamp(m.minutes, 1, 10080);
      targets.forEach((r) => {
        addCoins(r.d, ctx.incomePerSec(r.d) * mins * 60);
        r.d.Lemons += ctx.lemonRate(r.d) * mins * 60;
      });
      if (!who) banner(`⏩ TIME WARP: everyone earned ${mins} minutes of income instantly!`);
      return `Time-skipped ${mins} min for ${label}`;
    }
    case "giftDuck": {
      const tier = Math.floor(clamp(m.tier, 1, N));
      const count = Math.floor(clamp(m.count || 1, 1, 100));
      let n = 0;
      targets.forEach((r) => {
        for (let k = 0; k < count; k++) {
          if (totalDucks(r.d) >= Config.MaxSlots(r.d.Stage)) break;
          r.d.Ducks[tier - 1]++; n++;
          if (tier > (r.d.BestTier || 0)) r.d.BestTier = tier;
        }
      });
      if (!who) banner(`🎁 FREE DUCKS: everyone got ${count} x ${Config.DuckNames[tier - 1]}!`);
      return `Gave ${n} x ${Config.DuckNames[tier - 1]} to ${label} (full ponds skipped)`;
    }
    case "duckRain": {
      let n = 0;
      targets.forEach((r) => {
        const top = Math.max(1, Math.min(N, Config.MaxTier(r.d.Stage, r.d.Rebirths, r.d.World)));
        for (let k = 0; k < 3; k++) {
          if (totalDucks(r.d) >= Config.MaxSlots(r.d.Stage)) break;
          const tier = Math.max(1, top - Math.floor(Math.random() * 6));
          r.d.Ducks[tier - 1]++; n++;
          if (tier > (r.d.BestTier || 0)) r.d.BestTier = tier;
        }
      });
      banner("🌧️ DUCK RAIN! Free ducks fell into the pond!");
      return `Rained ${n} ducks on ${label}`;
    }
    case "giveRebirths": {
      const amt = Math.floor(clamp(m.amount, 1, 1000));
      targets.forEach((r) => (r.d.Rebirths += amt));
      if (!who) banner(`🔄 REBIRTH BLESSING: everyone gained ${amt} rebirth level(s)!`);
      return `Gave ${amt} rebirths to ${label}`;
    }
    case "setStage": {
      const st = Math.floor(clamp(m.stage, 1, Config.StageNames.length));
      targets.forEach((r) => { if (r.d.Stage < st) r.d.Stage = st; });
      if (!who) banner(`🏭 BUSINESS BOOM: everyone's lemon business grew to stage ${st}!`);
      return `Raised ${label} to stage ${st}`;
    }
    case "raffle": {
      if (!all.length) return "Nobody online.";
      const amt = clamp(m.amount, 1, 1e15);
      const w = all[Math.floor(Math.random() * all.length)];
      addCoins(w.d, amt);
      banner(`🎰 RAFFLE WINNER: ${w.name} won ${F(amt)} coins!`);
      return `${w.name} won the raffle`;
    }
    case "goldenDuck":
      ctx.spawnGolden(clamp(m.minutes || 5, 1, 1440));
      return "Golden duck released";
    case "announce": {
      const msg = cleanText(m.msg, 120);
      if (!msg) return "Empty message";
      banner("📢 " + msg);
      return "Announced";
    }

    // ------------------------------------------------------------ moderation
    case "kick": {
      const e = needTarget(); if (e) return e;
      for (const [ws, r] of online) if (r === targets[0]) ws.close();
      return `Kicked ${targets[0].name}`;
    }
    case "mute": case "unmute": {
      const e = needTarget(); if (e) return e;
      targets.forEach((r) => (m.cmd === "mute" ? ctx.muted.add(r.token) : ctx.muted.delete(r.token)));
      return `${m.cmd === "mute" ? "Muted" : "Unmuted"} ${targets[0].name}`;
    }
    case "resetPlayer": {
      const e = needTarget(); if (e) return e;
      ctx.replaceData(targets[0], ctx.newData());
      ctx.send([...online.keys()].find((w) => online.get(w) === targets[0]), { t: "toast", msg: "Your progress was reset by an admin." });
      return `Reset ${targets[0].name}`;
    }

    // ----------------------------------------------------------------- tools
    case "players":
      return {
        msg: `${all.length} online`,
        data: all.map((r) => ({
          name: r.name, coins: r.d.Coins, rebirths: r.d.Rebirths, stage: r.d.Stage,
          ducks: totalDucks(r.d), world: r.d.World || 1, muted: ctx.muted.has(r.token),
        })),
      };
    case "saveNow":
      ctx.writeSaves();
      return "Save started";
    case "stats": {
      const up = Math.round((Date.now() - startedAt) / 60000);
      return `Online ${all.length} | saved players ${Object.keys(ctx.saves).length} | uptime ${up} min | RAM ${Math.round(process.memoryUsage().rss / 1048576)} MB`;
    }
    default:
      return "Unknown command";
  }
}

module.exports = { enabled, mult, snapshot, tryLogin, handle };
