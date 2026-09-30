// public/config.js
(function (exports) {
  exports.DuckNames = [
    "Yellow Rubber Duck",
    "Lemon Duck",
    "Mallard Duck",
    "Sailor Duck",
    "Wizard Duck",
    "Ninja Duck",
    "Cyber Duck",
    "Golden Duck",
    "Cosmic Duck"
  ];

  exports.DuckIncome = function (tier) {
    return Math.pow(4, tier - 1);
  };

  exports.DuckCost = function (tier) {
    return Math.floor(10 * Math.pow(5, tier - 1));
  };

  exports.MaxSlots = function (stage) {
    return 5 + stage * 2;
  };

  exports.StageNames = [
    "Lemonade Stand",
    "Lemon Grove",
    "Lemon Orchard",
    "Lemonade Factory",
    "Citrus Empire",
    "Golden Grove"
  ];

  exports.Stage = function (stage) {
    const s = Math.max(1, Math.min(stage, exports.StageNames.length));
    return {
      Name: exports.StageNames[s - 1],
      PickAmount: s * 2,
      SellPrice: Math.pow(2, s - 1),
      LemonsPerSec: s * 3,
      Cost: Math.floor(100 * Math.pow(4, s - 1))
    };
  };

  exports.RebirthMult = function (rebirths) {
    return 1 + rebirths * 1.5;
  };

  exports.RebirthCost = function (rebirths) {
    return Math.floor(1e6 * Math.pow(10, rebirths));
  };

  // ---- NEW: World Configurations ----
  exports.Worlds = {
    1: {
      name: "Classic Pond",
      unlockRebirths: 0,
      coinMult: 1,
      lemonMult: 1,
      themeColor: "#4CAF50"
    },
    2: {
      name: "Golden Duck Realm",
      unlockRebirths: 1, // Requires at least 1 Rebirth to unlock
      coinMult: 3,       // Permanent 3x coins in World 2
      lemonMult: 2,      // Permanent 2x lemons in World 2
      themeColor: "#FFD700"
    }
  };

  exports.OfflineCapSeconds = 86400; // 24 hours
  exports.OfflineRate = 0.5;

  exports.Format = function (num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return Math.floor(num).toLocaleString();
  };
})(typeof exports === "undefined" ? (this.Config = {}) : exports);
