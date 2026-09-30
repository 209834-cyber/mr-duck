// public/config.js
(function (exports) {
  // Generates 100 unique ducks across 10 distinct tiers (10 ducks per tier)
  const TIER_PREFIXES = [
    "Common", "Uncommon", "Rare", "Epic", "Legendary",
    "Mythic", "Divine", "Cosmic", "Transcendent", "Omnipotent"
  ];
  const DUCK_TYPES = [
    "Rubber Duck", "Lemon Duck", "Mallard Duck", "Sailor Duck", "Wizard Duck",
    "Ninja Duck", "Cyber Duck", "Golden Duck", "Alien Duck", "Quantum Duck"
  ];

  exports.DuckNames = [];
  for (let t = 0; t < 10; t++) {
    for (let d = 0; d < 10; d++) {
      exports.DuckNames.push(`${TIER_PREFIXES[t]} ${DUCK_TYPES[d]} (v${d + 1})`);
    }
  }

  exports.DuckIncome = function (tier) {
    // Multiplier scales exponentially across all 100 ducks
    return Math.pow(2.8, tier - 1);
  };

  exports.DuckCost = function (tier) {
    return Math.floor(10 * Math.pow(3.2, tier - 1));
  };

  exports.MaxSlots = function (stage) {
    return 10 + stage * 3;
  };

  // 25 Lemon Business Upgrades
  exports.StageNames = [
    "Lemonade Stand", "Lemon Grove", "Lemon Orchard", "Lemonade Factory", "Citrus Empire",
    "Golden Grove", "Solar Lemon Processor", "Lunar Lemon Harvester", "Plasma Lemon Reactor", "Starlight Citrus Farm",
    "Nebula Squeezers", "Galactic Lemon Refinery", "Quantum Citrus Synth", "Supernova Squeeze Lab", "Dimension Lemon Core",
    "Dark Matter Juicer", "Singularity Orchard", "Hyperdrive Citrus Matrix", "Void Lemon Forge", "Aether Grove",
    "Celestial Squeeze Engine", "Chronos Lemon Vault", "Multiverse Citrus Hub", "Infinity Lemon Foundry", "Omni-Duck Citrus Matrix"
  ];

  exports.Stage = function (stage) {
    const s = Math.max(1, Math.min(stage, exports.StageNames.length));
    return {
      Name: exports.StageNames[s - 1],
      PickAmount: s * 5,
      SellPrice: Math.pow(2.5, s - 1),
      LemonsPerSec: s * 10,
      Cost: Math.floor(100 * Math.pow(3.5, s - 1))
    };
  };

  exports.RebirthMult = function (rebirths) {
    return 1 + rebirths * 2.5;
  };

  exports.RebirthCost = function (rebirths) {
    return Math.floor(1e6 * Math.pow(8, rebirths));
  };

  // ---- World Configurations ----
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
      unlockRebirths: 1,
      coinMult: 5,
      lemonMult: 3,
      themeColor: "#FFD700"
    },
    3: {
      name: "Galactic Duck Nebula",
      unlockRebirths: 5, // Requires 5 Rebirths to unlock
      coinMult: 25,      // Permanent 25x coins in World 3
      lemonMult: 10,     // Permanent 10x lemons in World 3
      themeColor: "#9C27B0"
    }
  };

  exports.OfflineCapSeconds = 86400; // 24 hours
  exports.OfflineRate = 0.5;

  exports.Format = function (num) {
    if (num >= 1e18) return (num / 1e18).toFixed(2) + "Qi";
    if (num >= 1e15) return (num / 1e15).toFixed(2) + "Qa";
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return Math.floor(num).toLocaleString();
  };
})(typeof exports === "undefined" ? (this.Config = {}) : exports);
