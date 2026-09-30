// Hidden admin panel. Click the (almost invisible) square in the bottom-left corner.
// The code is checked by the SERVER; nothing secret is in this file.
(function () {
  const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
  const cmd = (c, extra) => send(Object.assign({ t: "admin", cmd: c }, extra || {}));
  const el = (tag, css, parent, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; if (parent) parent.appendChild(e); return e; };

  // hidden trigger
  const hidden = el("div", "position:fixed;left:0;bottom:0;width:30px;height:30px;opacity:0.03;background:#000;z-index:50;cursor:default", document.body);
  let isAdmin = false, panel;
  hidden.onclick = () => {
    if (isAdmin) { panel.style.display = panel.style.display === "none" ? "block" : "none"; return; }
    const c = prompt("Enter admin code:");
    if (c) send({ t: "admin_login", code: c });
  };

  // buff banner
  const banner = el("div", "position:fixed;top:0;left:0;right:0;text-align:center;font-weight:bold;padding:6px;z-index:40;display:none;background:linear-gradient(90deg,#ff9d00,#ff4d6d);color:#fff;text-shadow:0 1px 2px #0006");
  document.body.appendChild(banner);
  let ends = { coins: 0, lemons: 0, mult: { coins: 1, lemons: 1 } };
  function tickBanner() {
    const now = Date.now(), parts = [];
    for (const k of ["coins", "lemons"]) {
      const left = Math.round((ends[k] - now) / 1000);
      if (left > 0) parts.push(`${k === "coins" ? "💰" : "🍋"} x${ends.mult[k]} ${k} — ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
    }
    banner.style.display = parts.length ? "block" : "none";
    banner.textContent = "🔥 GLOBAL BUFF: " + parts.join("   |   ");
  }
  setInterval(tickBanner, 500);

  const flash = el("div", "position:fixed;top:44px;left:50%;transform:translateX(-50%);background:#22303c;color:#fff;padding:12px 22px;border-radius:24px;z-index:45;display:none;font-weight:bold;max-width:90vw;text-align:center");
  document.body.appendChild(flash);
  let flashT;
  function announce(msg) { flash.textContent = msg; flash.style.display = "block"; clearTimeout(flashT); flashT = setTimeout(() => (flash.style.display = "none"), 7000); }

  // panel
  function buildPanel() {
    panel = el("div", "position:fixed;right:12px;bottom:12px;width:340px;max-height:85vh;overflow:auto;background:#1c1f2b;color:#fff;border-radius:14px;padding:14px;z-index:60;box-shadow:0 6px 30px #000a;font-size:14px", document.body);
    const head = el("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px", panel);
    el("b", "font-size:17px", head, "🛠️ Admin Panel");
    const x = el("button", "background:#555;padding:4px 10px", head, "✕"); x.onclick = () => (panel.style.display = "none");
    const status = el("div", "background:#0006;padding:6px;border-radius:8px;margin-bottom:8px;min-height:18px;font-size:12px", panel, "Ready.");
    panel.status = status;

    const btn = (label, color, fn, parent) => { const b = el("button", `background:${color};margin:3px;padding:8px 10px;font-size:13px`, parent || panel, label); b.onclick = fn; return b; };
    const sec = (t) => el("div", "margin-top:10px;font-weight:bold;opacity:.85", panel, t);
    const input = (ph, val, w) => { const i = el("input", `width:${w || 70}px;padding:6px;border-radius:6px;border:0;margin:2px`, null); i.placeholder = ph; i.value = val || ""; return i; };

    sec("⚡ Quick events");
    const q = el("div", "", panel);
    btn("🍀 Lucky Hour (x2, 60m)", "#2e8b57", () => cmd("luckyHour", { mult: 2, minutes: 60 }), q);
    btn("💰 x5 Coins (10m)", "#c98a00", () => cmd("coinBoost", { mult: 5, minutes: 10 }), q);
    btn("🍋 x5 Lemons (10m)", "#b8a600", () => cmd("lemonBoost", { mult: 5, minutes: 10 }), q);
    btn("⚡ COIN FRENZY x10 (5m)", "#d6336c", () => cmd("coinBoost", { mult: 10, minutes: 5 }), q);
    btn("🌧️ Duck Rain", "#3b82f6", () => cmd("duckRain"), q);
    btn("🍋 Lemon Shower (10K)", "#a3a300", () => cmd("giveLemons", { amount: 10000 }), q);
    btn("💸 Coin Rain (100K)", "#16a085", () => cmd("giveCoins", { amount: 100000 }), q);
    btn("🚫 End all buffs", "#7f1d1d", () => cmd("clearBuffs"), q);

    sec("🎛️ Custom buff");
    const cb = el("div", "", panel);
    const mIn = input("mult", "3"), minIn = input("mins", "15");
    cb.append(mIn, minIn);
    btn("Coins", "#c98a00", () => cmd("coinBoost", { mult: +mIn.value, minutes: +minIn.value }), cb);
    btn("Lemons", "#b8a600", () => cmd("lemonBoost", { mult: +mIn.value, minutes: +minIn.value }), cb);
    btn("Both", "#2e8b57", () => cmd("luckyHour", { mult: +mIn.value, minutes: +minIn.value }), cb);

    sec("🎁 Gifts to everyone online");
    const gb = el("div", "", panel);
    const amtIn = input("amount", "1000000", 110);
    gb.append(amtIn);
    btn("Coins", "#16a085", () => cmd("giveCoins", { amount: +amtIn.value }), gb);
    btn("Lemons", "#a3a300", () => cmd("giveLemons", { amount: +amtIn.value }), gb);
    const tierSel = el("select", "padding:6px;border-radius:6px;margin:2px", gb);
    Config.DuckNames.forEach((n, i) => { const o = el("option", "", tierSel, `${i + 1}. ${n}`); o.value = i + 1; });
    btn("Gift duck", "#3b82f6", () => cmd("giftDuck", { tier: +tierSel.value }), gb);

    sec("📢 Announcement");
    const ab = el("div", "", panel);
    const msgIn = input("message", "", 200); ab.append(msgIn);
    btn("Send", "#6b46c1", () => { cmd("announce", { msg: msgIn.value }); msgIn.value = ""; }, ab);
  }

  window.onExtraMsg = function (m) {
    if (m.t === "state" && m.Buffs) {
      const now = Date.now();
      for (const k of ["coins", "lemons"]) { ends[k] = now + m.Buffs[k].secs * 1000; ends.mult[k] = m.Buffs[k].mult; }
    } else if (m.t === "banner") {
      announce(m.msg);
      if (typeof addChat === "function") addChat("📣", m.msg);
    } else if (m.t === "admin_ok") {
      if (m.msg === "login") { isAdmin = true; if (!panel) buildPanel(); panel.style.display = "block"; }
      else if (panel) panel.status.textContent = "✅ " + m.msg;
    } else if (m.t === "admin_err") {
      if (panel && isAdmin) panel.status.textContent = "❌ " + m.msg; else alert(m.msg);
    }
  };
})();
