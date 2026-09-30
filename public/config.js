// public/config.js
(function (exports) {
  const TIER_PREFIXES = [
    "Common", "Uncommon", "Rare", "Epic", "Legendary",
    "Mythic", "Divine", "Cosmic", "Transcendent", "Omnipotent"
  ];
  const DUCK_TYPES = [
    "Rubber Duck", "Lemon Duck", "Mallard Duck", "Sailor Duck", "Wizard Duck",
    "Ninja Duck", "Cyber Duck", "Golden Duck", "Alien Duck", "Quantum Duck"
  ];

  // Dynamically generate 1,000 unique duck types (100 variations per rarity tier)
  exports.DuckNames = [];
  for (let t = 0; t < 10; t++) {
    for (let sub = 1; sub <= 100; sub++) {
      const typeIndex = (sub - 1) % DUCK_TYPES.length;
      exports.DuckNames.push(`${TIER_PREFIXES[t]} ${DUCK_TYPES[typeIndex]} Mk.${sub}`);
    }
  }

  exports.DuckIncome = function (tier) {
    // Smooth exponential scaling up through tier 1000
    return Math.pow(1.15, tier - 1);
  };

  exports.DuckCost = function (tier) {
    return Math.floor(10 * Math.pow(1.18, tier - 1));
  };

  exports.MaxSlots = function (stage) {
    return 20 + stage * 5;
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
      unlockRebirths: 5,
      coinMult: 25,
      lemonMult: 10,
      themeColor: "#9C27B0"
    }
  };

  exports.OfflineCapSeconds = 86400;
  exports.OfflineRate = 0.5;

  exports.Format = function (num) {
    if (num >= 1e21) return (num / 1e21).toFixed(2) + "Sx";
    if (num >= 1e18) return (num / 1e18).toFixed(2) + "Qi";
    if (num >= 1e15) return (num / 1e15).toFixed(2) + "Qa";
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return Math.floor(num).toLocaleString();
  };
})(typeof exports === "undefined" ? (this.Config = {}) : exports);
