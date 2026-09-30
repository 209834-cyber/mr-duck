// public/admin.js
(function () {
  const ws = window.gameSocket; // Access the main WebSocket connection

  function sendAdminCmd(cmd, data = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ t: "admin", cmd, ...data }));
  }

  // --- Admin Commands UI Handlers ---

  // 1. World Teleportation (Worlds 1, 2, or 3)
  window.adminTeleportAll = function (worldId) {
    sendAdminCmd("teleportAll", { world: Number(worldId) });
  };

  // 2. Adjust Global Rebirths for all players
  window.adminSetRebirths = function (amount) {
    sendAdminCmd("setRebirths", { amount: Number(amount) });
  };

  // 3. Give 1,000 Duck Tiers (Random Tier or Specific Tier 1-1000)
  window.adminGiftDuck = function (tier) {
    sendAdminCmd("giftDuck", { tier: Number(tier) });
  };

  // 4. Trigger High-Tier Duck Rain (Random ducks 1-1000)
  window.adminDuckRain = function () {
    sendAdminCmd("duckRain");
  };

  // 5. Global Multiplier Boosts
  window.adminCoinBoost = function (mult, minutes) {
    sendAdminCmd("coinBoost", { mult: Number(mult), minutes: Number(minutes) });
  };

  window.adminLemonBoost = function (mult, minutes) {
    sendAdminCmd("lemonBoost", { mult: Number(mult), minutes: Number(minutes) });
  };

  window.adminLuckyHour = function (mult, minutes) {
    sendAdminCmd("luckyHour", { mult: Number(mult), minutes: Number(minutes) });
  };

  window.adminClearBuffs = function () {
    sendAdminCmd("clearBuffs");
  };

  // 6. Currencies & Management
  window.adminGiveCoins = function (amount) {
    sendAdminCmd("giveCoins", { amount: Number(amount) });
  };

  window.adminGiveLemons = function (amount) {
    sendAdminCmd("giveLemons", { amount: Number(amount) });
  };

  window.adminClearDucks = function () {
    if (confirm("Are you sure you want to clear all ducks from active players?")) {
      sendAdminCmd("clearDucks");
    }
  };

  window.adminAnnounce = function (msg) {
    sendAdminCmd("announce", { msg: String(msg) });
  };
})();
