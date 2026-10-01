// Hidden admin panel (public/admin1.js). Click the almost-invisible square in the bottom-left corner.
// The code is checked by the SERVER; nothing secret is in this file.
(function () {
  const send = (o) => typeof ws !== "undefined" && ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
  const cmd = (c, extra) => send(Object.assign({ t: "admin", cmd: c, target: targetSel ? targetSel.value : "" }, extra || {}));
  const el = (tag, css, parent, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };

  const hidden = el("div", "position:fixed;left:0;bottom:0;width:30px;height:30px;opacity:0.03;background:#000;z-index:50;cursor:default", document.body);
  let isAdmin = false, panel, body, status, targetSel, tabs = {}, curTab = "events", playersData = [];
  hidden.onclick = () => {
    if (isAdmin) { panel.style.display = panel.style.display === "none" ? "block" : "none"; if (panel.style.display === "block") cmd("players", { target: "" }); return; }
    const c = prompt("Enter admin code:");
    if (c) send({ t: "admin_login", code: c });
  };

  // ---- global buff banner (everyone sees this) -------------------------
  const banner = el("div", "position:fixed;top:0;left:0;right:0;text-align:center;font-weight:bold;padding:6px;z-index:40;display:none;background:linear-gradient(90deg,#ff9d00,#ff4d6d);color:#fff;text-shadow:0 1px 2px #0006", document.body);
  const ends = { coins: 0, lemons: 0, eggs: 0, mult: { coins: 1, lemons: 1, eggs: 1 } };
  const ICON = { coins: "💰", lemons: "🍋", eggs: "🥚" };
  setInterval(() => {
    const now = Date.now(), parts = [];
    for (const k of ["coins", "lemons", "eggs"]) {
      const left = Math.round((ends[k] - now) / 1000);
      if (left > 0) parts.push(`${ICON[k]} x${ends.mult[k]} ${k} — ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
    }
    banner.style.display = parts.length ? "block" : "none";
    banner.textContent = "🔥 GLOBAL BUFF: " + parts.join("   |   ");
  }, 500);

  const flash = el("div", "position:fixed;top:44px;left:50%;transform:translateX(-50%);background:#22303c;color:#fff;padding:12px 22px;border-radius:24px;z-index:45;display:none;font-weight:bold;max-width:90vw;text-align:center", document.body);
  let flashT;
  function announce(msg) { flash.textContent = msg; flash.style.display = "block"; clearTimeout(flashT); flashT = setTimeout(() => (flash.style.display = "none"), 7000); }

  // ---- panel ----------------------------------------------------------------
  const btn = (label, color, fn, parent) => { const b = el("button", `background:${color};margin:3px;padding:7px 10px;font-size:12px;color:#fff;border:0;border-radius:8px;cursor:pointer;font-weight:bold`, parent, label); b.onclick = fn; return b; };
  const sec = (parent, t) => el("div", "margin-top:10px;font-weight:bold;opacity:.85", parent, t);
  const input = (ph, val, w) => { const i = el("input", `width:${w || 70}px;padding:6px;border-radius:6px;border:0;margin:2px`); i.placeholder = ph; i.value = val || ""; return i; };
  const row = (parent) => el("div", "", parent);

  function build() {
    panel = el("div", "position:fixed;right:12px;bottom:12px;width:370px;max-height:88vh;overflow:auto;background:#1c1f2b;color:#fff;border-radius:14px;padding:14px;z-index:60;box-shadow:0 6px 30px #000a;font-size:14px", document.body);
    const head = el("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px", panel);
    el("b", "font-size:17px", head, "🛠️ Admin Panel");
    const x = el("button", "background:#555;padding:4px 10px;color:#fff;border:0;border-radius:8px;cursor:pointer", head, "✕"); x.onclick = () => (panel.style.display = "none");
    const trow = el("div", "margin-bottom:6px;font-size:12px", panel, "Target: ");
    targetSel = el("select", "padding:5px;border-radius:6px", trow);
    status = el("div", "background:#0006;padding:6px;border-radius:8px;margin:6px 0;min-height:18px;font-size:12px", panel, "Ready.");
    const tb = el("div", "display:flex;gap:4px;margin-bottom:4px", panel);
    ["events", "gifts", "players", "server"].forEach((name) => {
      const b = btn({ events: "⚡ Events", gifts: "🎁 Gifts", players: "👥 Players", server: "🖥️ Server" }[name], "#444", () => show(name), tb);
      tabs[name] = b;
    });
    body = el("div", "", panel);
    show("events");
  }
  function refreshTargets() {
    if (!targetSel) return;
    const keep = targetSel.value;
    targetSel.innerHTML = "";
    const all = el("option", "", targetSel, "Everyone online"); all.value = "";
    playersData.forEach((p) => { const o = el("option", "", targetSel, p.name); o.value = p.name; });
    targetSel.value = [...targetSel.options].some((o) => o.value === keep) ? keep : "";
  }
  function show(name) {
    curTab = name; body.innerHTML = "";
    Object.keys(tabs).forEach((k) => (tabs[k].style.background = k === name ? "#6b46c1" : "#444"));
    ({ events: tabEvents, gifts: tabGifts, players: tabPlayers, server: tabServer })[name]();
  }

  function tabEvents() {
    sec(body, "⚡ Quick global events (always affect everyone)");
    const q = row(body);
    const g = (c, e) => () => send(Object.assign({ t: "admin", cmd: c, target: "" }, e));
    btn("🍀 Lucky Hour x2 (60m)", "#2e8b57", g("luckyHour", { mult: 2, minutes: 60 }), q);
    btn("💰 x5 Coins (10m)", "#c98a00", g("coinBoost", { mult: 5, minutes: 10 }), q);
    btn("🍋 x5 Lemons (10m)", "#b8a600", g("lemonBoost", { mult: 5, minutes: 10 }), q);
    btn("⚡ COIN FRENZY x10 (5m)", "#d6336c", g("coinBoost", { mult: 10, minutes: 5 }), q);
    btn("🥚 Egg Frenzy x3 (30m)", "#e08e0b", g("eggBoost", { mult: 3, minutes: 30 }), q);
    btn("🎆 MEGA EVENT x3 (30m)", "#7c3aed", g("megaEvent", { mult: 3, minutes: 30 }), q);
    btn("🌟 Golden Duck race", "#d4a017", g("goldenDuck", { minutes: 10 }), q);
    btn("🌧️ Duck Rain", "#3b82f6", g("duckRain"), q);
    btn("🚫 End all buffs", "#7f1d1d", g("clearBuff", { kind: "all" }), q);

    sec(body, "🎛️ Custom buff");
    const cb = row(body);
    const kind = el("select", "padding:6px;border-radius:6px;margin:2px", cb);
    [["coins", "Coins"], ["lemons", "Lemons"], ["eggs", "Eggs"], ["both", "Coins+Lemons"], ["all", "Everything"]].forEach(([v, t]) => { const o = el("option", "", kind, t); o.value = v; });
    const mIn = input("x", "3", 50), minIn = input("min", "15", 50);
    cb.append(mIn, minIn);
    btn("Start", "#2e8b57", () => {
      const c = { coins: "coinBoost", lemons: "lemonBoost", eggs: "eggBoost", both: "luckyHour", all: "megaEvent" }[kind.value];
      send({ t: "admin", cmd: c, mult: +mIn.value, minutes: +minIn.value, target: "" });
    }, cb);

    sec(body, "🎰 Raffle (random online player wins coins)");
    const rb = row(body); const rIn = input("coins", "1000000", 110); rb.append(rIn);
    btn("Draw winner", "#6b46c1", () => send({ t: "admin", cmd: "raffle", amount: +rIn.value }), rb);

    sec(body, "End one buff");
    const eb = row(body);
    ["coins", "lemons", "eggs"].forEach((k) => btn(ICON[k] + " " + k, "#7f1d1d", () => send({ t: "admin", cmd: "clearBuff", kind: k }), eb));
  }

  function tabGifts() {
    sec(body, "🎁 Gifts go to the target selected above");
    const a = row(body); const amt = input("amount", "1000000", 120); a.append(amt);
    btn("💰 Coins", "#16a085", () => cmd("giveCoins", { amount: +amt.value }), a);
    btn("🍋 Lemons", "#a3a300", () => cmd("giveLemons", { amount: +amt.value }), a);
    btn("🥚 Eggs", "#e08e0b", () => cmd("giveEggs", { amount: +amt.value }), a);
    btn("🔄 Rebirths", "#aa3cc8", () => cmd("giveRebirths", { amount: +amt.value }), a);

    sec(body, "⏩ Time skip (instant income for N minutes)");
    const t = row(body); const mins = input("minutes", "60", 90); t.append(mins);
    btn("Skip", "#3b82f6", () => cmd("giveTime", { minutes: +mins.value }), t);

    sec(body, "🦆 Ducks");
    const d = row(body);
    const tier = el("select", "padding:6px;border-radius:6px;margin:2px;max-width:200px", d);
    Config.DuckNames.forEach((n, i) => { const o = el("option", "", tier, `${i + 1}. ${n}`); o.value = i + 1; });
    const cnt = input("count", "1", 50); d.append(cnt);
    btn("Give", "#3b82f6", () => cmd("giftDuck", { tier: +tier.value, count: +cnt.value }), d);

    sec(body, "🏭 Lemon business");
    const s = row(body); const st = input("stage 1-25", "25", 90); s.append(st);
    btn("Raise to stage", "#b8a600", () => cmd("setStage", { stage: +st.value }), s);
  }

  function tabPlayers() {
    sec(body, "👥 Online players");
    btn("↻ Refresh", "#444", () => cmd("players", { target: "" }), row(body));
    if (!playersData.length) el("div", "opacity:.7;font-size:12px;margin-top:6px", body, "No players loaded yet.");
    playersData.forEach((p) => {
      const r = el("div", "background:#0004;border-radius:8px;padding:6px;margin-top:6px;font-size:12px", body);
      el("div", "", r, `${p.name}${p.muted ? " 🔇" : ""} — 🔄${p.rebirths} · stage ${p.stage} · 🦆${p.ducks} · world ${p.world}`);
      const act = (c) => () => send({ t: "admin", cmd: c, target: p.name });
      btn("Kick", "#b91c1c", act("kick"), r);
      btn(p.muted ? "Unmute" : "Mute", "#555", act(p.muted ? "unmute" : "mute"), r);
      btn("Reset", "#7f1d1d", () => { if (confirm("Reset ALL progress for " + p.name + "?")) act("resetPlayer")(); }, r);
    });
  }

  function tabServer() {
    sec(body, "📢 Announcement");
    const ab = row(body); const msg = input("message", "", 220); ab.append(msg);
    btn("Send", "#6b46c1", () => { send({ t: "admin", cmd: "announce", msg: msg.value, target: "" }); msg.value = ""; }, ab);
    sec(body, "🖥️ Server");
    const sb = row(body);
    btn("📊 Stats", "#444", () => send({ t: "admin", cmd: "stats", target: "" }), sb);
    btn("💾 Save now", "#2e8b57", () => send({ t: "admin", cmd: "saveNow", target: "" }), sb);
  }

  // ---- messages -------------------------------------------------------------
  const prev = window.onExtraMsg;
  window.onExtraMsg = function (m) {
    if (prev) prev(m);
    if (m.t === "state" && m.Buffs) {
      const now = Date.now();
      for (const k of ["coins", "lemons", "eggs"]) if (m.Buffs[k]) { ends[k] = now + m.Buffs[k].secs * 1000; ends.mult[k] = m.Buffs[k].mult; }
    } else if (m.t === "banner") {
      announce(m.msg);
      if (typeof addChat === "function") addChat("📣", m.msg);
    } else if (m.t === "admin_ok") {
      if (m.msg === "login") { isAdmin = true; if (!panel) build(); panel.style.display = "block"; cmd("players", { target: "" }); return; }
      if (m.data) { playersData = m.data; refreshTargets(); if (curTab === "players") show("players"); }
      if (status) status.textContent = "✅ " + m.msg;
    } else if (m.t === "admin_err") {
      if (status && isAdmin) status.textContent = "❌ " + m.msg; else alert(m.msg);
    }
  };
})();
