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

  // Generates 1,000 distinct duck types
  exports.DuckNames = [];
  for (let t = 0; t < 10; t++) {
    for (let sub = 1; sub <= 100; sub++) {
      const typeIndex = (sub - 1) % DUCK_TYPES.length;
      exports.DuckNames.push(`${TIER_PREFIXES[t]} ${DUCK_TYPES[typeIndex]} Mk.${sub}`);
    }
  }

  // FAST PROGRESSION: 1.35x multiplier per tier yields massive coin acceleration
  exports.DuckIncome = function (tier) {
    return Math.pow(1.35, tier - 1) * 5;
  };

  // CHEAPER DUCKS: 1.10x cost growth allows buying deep into tiers fast
  exports.DuckCost = function (tier) {
    return Math.floor(10 * Math.pow(1.10, tier - 1));
  };

  exports.MaxSlots = function (stage) {
    return 30 + stage * 10;
  };

  // 25 Business Upgrades
  exports.StageNames = [
    "Lemonade Stand", "Lemon Grove", "Lemon Orchard", "Lemonade Factory", "Citrus Empire",
    "Golden Grove", "Solar Lemon Processor", "Lunar Lemon Harvester", "Plasma Lemon Reactor", "Starlight Citrus Farm",
    "Nebula Squeezers", "Galactic Lemon Refinery", "Quantum Citrus Synth", "Supernova Squeeze Lab", "Dimension Lemon Core",
    "Dark Matter Juicer", "Singularity Orchard", "Hyperdrive Citrus Matrix", "Void Lemon Forge", "Aether Grove",
    "Celestial Squeeze Engine", "Chronos Lemon Vault", "Multiverse Citrus Hub", "Infinity Lemon Foundry", "Omni-Duck Citrus Matrix"
  ];

  // FASTER UPGRADES: Lower cost scaling (1.8x) and higher profits
  exports.Stage = function (stage) {
    const s = Math.max(1, Math.min(stage, exports.StageNames.length));
    return {
      Name: exports.StageNames[s - 1],
      PickAmount: s * 15,
      SellPrice: Math.pow(3, s - 1),
      LemonsPerSec: s * 25,
      Cost: Math.floor(50 * Math.pow(1.8, s - 1))
    };
  };

  // EASY REBIRTH: Stronger boost per rebirth (5x)
  exports.RebirthMult = function (rebirths) {
    return 1 + rebirths * 5;
  };

  // EASY REBIRTH: Base cost only 10,000 Coins & 2x growth per level
  exports.RebirthCost = function (rebirths) {
    return Math.floor(10000 * Math.pow(2, rebirths));
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
      coinMult: 10,
      lemonMult: 5,
      themeColor: "#FFD700"
    },
    3: {
      name: "Galactic Duck Nebula",
      unlockRebirths: 3,
      coinMult: 100,
      lemonMult: 25,
      themeColor: "#9C27B0"
    }
  };

  exports.OfflineCapSeconds = 86400;
  exports.OfflineRate = 0.8;

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
