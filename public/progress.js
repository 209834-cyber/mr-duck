// public/progress.js - Egg Shop, Achievements, Daily reward, Golden Duck, toasts.
// Self-contained: add  <script src="progress.js"></script>  AFTER admin1.js in index.html.
(function () {
  const F = Config.Format;
  const send = (o) => typeof ws !== "undefined" && ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
  const act = (a, arg) => send({ t: "act", a, arg });
  const el = (tag, css, parent, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };

  let S = null, tab = "eggs", open = false;

  // ---- toasts ---------------------------------------------------------------
  const toastBox = el("div", "position:fixed;left:50%;bottom:60px;transform:translateX(-50%);z-index:80;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none", document.body);
  function toast(msg) {
    const t = el("div", "background:#22303c;color:#fff;padding:10px 18px;border-radius:20px;font-weight:bold;box-shadow:0 3px 12px #0006;max-width:90vw;text-align:center", toastBox, msg);
    setTimeout(() => t.remove(), 5500);
  }

  // ---- golden duck ----------------------------------------------------------
  let goldenEl = null;
  function showGolden(id, secs) {
    hideGolden();
    goldenEl = el("div", `position:fixed;left:${10 + Math.random() * 75}%;top:${20 + Math.random() * 55}%;font-size:64px;cursor:pointer;z-index:70;animation:gbob .8s ease-in-out infinite;filter:drop-shadow(0 0 14px gold);user-select:none`, document.body, "🦆");
    goldenEl.title = "Golden Duck! Click!";
    goldenEl.onclick = () => { act("ClaimGolden", id); hideGolden(); };
    setTimeout(hideGolden, secs * 1000);
  }
  function hideGolden() { if (goldenEl) { goldenEl.remove(); goldenEl = null; } }
  const st = el("style", "", document.head, "@keyframes gbob{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-14px) scale(1.12)}}");

  // ---- progress button + modal ---------------------------------------------
  const openBtn = el("button", "position:fixed;top:52px;right:10px;z-index:30;background:#e6b800;color:#222;font-weight:bold;border:0;border-radius:20px;padding:8px 14px;cursor:pointer;box-shadow:0 2px 8px #0004", document.body, "⭐ Progress");
  const dot = el("span", "display:none;background:#e11;color:#fff;border-radius:10px;padding:0 6px;margin-left:6px;font-size:12px", openBtn, "!");
  const modal = el("div", "position:fixed;inset:0;background:#000a;z-index:65;display:none;align-items:center;justify-content:center", document.body);
  const box = el("div", "background:#fff8d6;color:#22303c;border-radius:16px;padding:16px;width:min(94vw,560px);max-height:88vh;overflow:auto", modal);
  openBtn.onclick = () => { open = true; modal.style.display = "flex"; render(); };
  modal.onclick = (e) => { if (e.target === modal) { open = false; modal.style.display = "none"; } };

  function button(label, color, fn, parent, disabled) {
    const b = el("button", `background:${color};color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:bold;cursor:pointer;margin:2px;${disabled ? "opacity:.45;cursor:not-allowed" : ""}`, parent, label);
    b.disabled = !!disabled; if (!disabled) b.onclick = fn; return b;
  }

  function render() {
    if (!open || !S) return;
    const P = S.Prog;
    box.innerHTML = "";
    const head = el("div", "display:flex;justify-content:space-between;align-items:center", box);
    el("b", "font-size:20px", head, "⭐ Progress");
    el("span", "font-weight:bold", head, `🥚 ${F(P.Eggs)} Golden Eggs`);
    const tabs = el("div", "display:flex;gap:6px;margin:10px 0", box);
    [["eggs", "🥚 Egg Shop"], ["ach", `🏆 Achievements (${P.Ach.length}/${Config.Achievements.length})`], ["daily", "🎁 Daily"], ["world", "🌍 Worlds"]].forEach(([k, t]) =>
      button(t, tab === k ? "#6b46c1" : "#888", () => { tab = k; render(); }, tabs));

    if (tab === "eggs") {
      el("div", "font-size:13px;margin-bottom:8px", box, `Rebirthing now would give ${F(P.EggsOnRebirth)} 🥚. Eggs are permanent: they are never lost when you rebirth.`);
      Config.EggUpgrades.forEach((u) => {
        const level = P.EggUp[u.id] | 0, maxed = level >= u.max, cost = Config.EggCost(u, level);
        const r = el("div", "display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:10px;padding:8px;margin-bottom:6px", box);
        const info = el("div", "", r);
        el("b", "", info, `${u.name}  Lv ${level}/${u.max}`);
        el("div", "font-size:12px;opacity:.8", info, u.desc);
        button(maxed ? "MAX" : `${F(cost)} 🥚`, "#e08e0b", () => act("BuyEgg", u.id), r, maxed || P.Eggs < cost);
      });
    } else if (tab === "ach") {
      el("div", "font-size:13px;margin-bottom:8px", box, `Each achievement gives +2% coins forever and 1 🥚. Current bonus: +${P.Ach.length * 2}%.`);
      Config.Achievements.forEach((a) => {
        const done = P.Ach.includes(a.id);
        el("div", `background:${done ? "#c8f7c5" : "#fff"};border-radius:10px;padding:6px 10px;margin-bottom:4px;font-size:13px;opacity:${done ? 1 : .8}`, box, `${done ? "✅" : "⬜"} ${a.name} — ${a.desc}`);
      });
    } else if (tab === "daily") {
      el("div", "margin-bottom:8px", box, `Login streak: ${P.Streak} day${P.Streak === 1 ? "" : "s"} (bigger reward each consecutive day, bonus eggs every 7th day).`);
      button(P.CanDaily ? "🎁 Claim today's reward" : "Come back tomorrow", "#3aa655", () => act("ClaimDaily"), box, !P.CanDaily);
      el("div", "margin-top:12px;font-size:13px", box, "🌟 Golden Ducks also appear every few minutes. Click one fast to win a coin prize!");
    } else if (tab === "world") {
      Object.keys(Config.Worlds).forEach((k) => {
        const w = Config.Worlds[k], unlocked = S.Rebirths >= w.unlockRebirths, cur = S.World === +k;
        const r = el("div", `display:flex;justify-content:space-between;align-items:center;border-left:8px solid ${w.themeColor};background:#fff;border-radius:10px;padding:8px;margin-bottom:6px`, box);
        const info = el("div", "", r);
        el("b", "", info, `${k}. ${w.name}`);
        el("div", "font-size:12px;opacity:.8", info, `x${F(w.coinMult)} coins · x${F(w.lemonMult)} lemons · needs ${w.unlockRebirths} rebirths`);
        button(cur ? "Current" : unlocked ? "Travel" : "Locked", "#4a6fdc", () => act("SwitchWorld", +k), r, cur || !unlocked);
      });
    }
  }

  // ---- shop clean-up: show only unlocked tiers (a window of 40) and fix 'full pond' ----
  function fixShop() {
    if (!S) return;
    const items = document.querySelectorAll("#shop > button");
    if (!items.length) return;
    const maxT = S.Prog.MaxTier;
    let low = 0; for (let i = 0; i < S.Ducks.length; i++) if (S.Ducks[i] > 0) { low = i + 1; break; }
    items.forEach((b, i) => {
      const tier = i + 1;
      const visible = tier <= maxT && tier > maxT - 40;
      b.style.display = visible ? "" : "none";
      if (visible) {
        const room = S.Total < S.Slots || (low > 0 && low < tier); // server replaces the weakest duck when full
        b.disabled = !(S.Coins >= Config.DuckCost(tier) && room);
      }
    });
  }

  // ---- messages -------------------------------------------------------------
  const prev = window.onExtraMsg;
  window.onExtraMsg = function (m) {
    if (prev) prev(m);
    if (m.t === "state") {
      S = m;
      dot.style.display = m.Prog.CanDaily ? "inline" : "none";
      setTimeout(fixShop, 0); // run after the main script has re-drawn the shop
      if (open && !(document.activeElement && document.activeElement.tagName === "INPUT")) render();
    } else if (m.t === "toast") toast(m.msg);
    else if (m.t === "golden") showGolden(m.id, m.secs);
    else if (m.t === "golden_end") hideGolden();
  };
})();
