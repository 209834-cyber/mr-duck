// public/config.js  (shared by server and browser)
(function (exports) {
  const TIER_PREFIXES = [
    "Common", "Uncommon", "Rare", "Epic", "Legendary",
    "Mythic", "Divine", "Cosmic", "Transcendent", "Omnipotent"
  ];
  const DUCK_TYPES = [
    "Rubber Duck", "Lemon Duck", "Mallard Duck", "Sailor Duck", "Wizard Duck",
    "Ninja Duck", "Cyber Duck", "Golden Duck", "Alien Duck", "Quantum Duck"
  ];

  // 1,000 distinct duck types
  exports.DuckNames = [];
  for (let t = 0; t < 10; t++) {
    for (let sub = 1; sub <= 100; sub++) {
      const typeIndex = (sub - 1) % DUCK_TYPES.length;
      exports.DuckNames.push(`${TIER_PREFIXES[t]} ${DUCK_TYPES[typeIndex]} Mk.${sub}`);
    }
  }
  const NUM_TIERS = exports.DuckNames.length;

  // ---------------------------------------------------------------- DUCKS
  exports.DuckIncome = function (tier) {
    return Math.pow(1.35, tier - 1) * 5;
  };

  // Cost grows faster than income (1.42 vs 1.35), so every new tier takes longer to pay
  // back than the last. This is what makes 1,000 tiers a long journey instead of a
  // 30-minute sprint (with 10 * 1.36^t the whole ladder was cleared in under an hour).
  exports.DuckCost = function (tier) {
    return Math.floor(200 * Math.pow(1.42, tier - 1));
  };

  exports.MaxSlots = function (stage) {
    return 30 + stage * 10;
  };

  // NEW: duck tiers unlock gradually (lemon stage, rebirths and world all open more tiers)
  exports.MaxTier = function (stage, rebirths, world) {
    return Math.min(NUM_TIERS, 20 + stage * 12 + rebirths * 10 + ((world || 1) - 1) * 30);
  };

  // --------------------------------------------------------------- LEMONS
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
      PickAmount: s * 15,
      SellPrice: Math.pow(3, s - 1),
      LemonsPerSec: s * 25,
      // upgrade cost grows a bit faster than the income it adds (3.4x vs 3x)
      Cost: s <= 1 ? 0 : Math.floor(12000 * Math.pow(3.4, s - 2))
    };
  };

  // -------------------------------------------------------------- REBIRTH
  exports.RebirthMult = function (rebirths) {
    return 1 + rebirths * 5;
  };
  exports.RebirthCost = function (rebirths) {
    return Math.floor(1e12 * Math.pow(25, rebirths));
  };
  // NEW: Golden Eggs earned for rebirthing (spent in the Egg Shop on permanent upgrades)
  exports.RebirthEggs = function (coins, newRebirths) {
    return Math.floor(5 + 1.5 * Math.log10(Math.max(1, coins)) + 2 * newRebirths);
  };

  // --------------------------------------------------------------- WORLDS
  exports.Worlds = {
    1: { name: "Classic Pond",           unlockRebirths: 0,  coinMult: 1,    lemonMult: 1,     themeColor: "#4CAF50" },
    2: { name: "Golden Duck Realm",      unlockRebirths: 1,  coinMult: 10,   lemonMult: 5,     themeColor: "#FFD700" },
    3: { name: "Galactic Duck Nebula",   unlockRebirths: 3,  coinMult: 100,  lemonMult: 25,    themeColor: "#9C27B0" },
    4: { name: "Crystal Cavern Lake",    unlockRebirths: 6,  coinMult: 1e3,  lemonMult: 125,   themeColor: "#00BCD4" },
    5: { name: "Volcano Duck Springs",   unlockRebirths: 10, coinMult: 1e4,  lemonMult: 625,   themeColor: "#FF5722" },
    6: { name: "Frozen Quack Tundra",    unlockRebirths: 15, coinMult: 1e5,  lemonMult: 3125,  themeColor: "#90CAF9" },
    7: { name: "Cyber Duck City",        unlockRebirths: 25, coinMult: 1e6,  lemonMult: 15625, themeColor: "#00E676" },
    8: { name: "The Infinite Pond",      unlockRebirths: 40, coinMult: 1e7,  lemonMult: 78125, themeColor: "#E040FB" }
  };

  // ------------------------------------------------------ EGG SHOP (NEW)
  // cost of next level = floor(base * growth ^ currentLevel) Golden Eggs
  exports.EggUpgrades = [
    { id: "goldenTouch",   name: "Golden Touch",    desc: "+25% coins per level",               max: 100, base: 3,  growth: 1.25 },
    { id: "squeezer",      name: "Lemon Squeezer",  desc: "+25% lemons per level",              max: 100, base: 3,  growth: 1.25 },
    { id: "training",      name: "Duck Training",   desc: "+15% duck income per level",         max: 100, base: 5,  growth: 1.3 },
    { id: "luckyRebirth",  name: "Lucky Rebirth",   desc: "+10% Golden Eggs per rebirth",       max: 50,  base: 10, growth: 1.4 },
    { id: "starterKit",    name: "Starter Kit",     desc: "Start each run with 4x more coins",  max: 15,  base: 8,  growth: 1.8 },
    { id: "timeTraveler",  name: "Time Traveler",   desc: "+1 hour offline earning cap",        max: 24,  base: 6,  growth: 1.4 },
    { id: "autoSeller",    name: "Auto-Seller",     desc: "Sells your lemons automatically (faster each level)", max: 10, base: 15, growth: 1.5 },
    { id: "autoBuyer",     name: "Auto-Buyer",      desc: "Buys the best duck you can afford (faster each level)", max: 5, base: 40, growth: 2.0 },
    { id: "autoStage",     name: "Auto-Upgrader",   desc: "Upgrades your lemon business automatically", max: 1, base: 60, growth: 1 }
  ];
  exports.EggCost = function (up, level) {
    return Math.floor(up.base * Math.pow(up.growth, level));
  };

  // ------------------------------------------------- ACHIEVEMENTS (NEW)
  // each one gives +2% coins permanently and 1 Golden Egg
  exports.Achievements = [];
  (function () {
    const A = exports.Achievements;
    const add = (id, name, desc, type, value) => A.push({ id, name, desc, type, value });
    [[1e4, "First Steps"], [1e6, "Millionaire"], [1e9, "Billionaire"], [1e12, "Trillionaire"],
     [1e18, "Quintillionaire"], [1e30, "Beyond Numbers"], [1e60, "Number Wizard"], [1e100, "Googol Duck"]]
      .forEach(([v, n]) => add("earn" + v, n, "Earn " + (v >= 1e6 ? v.toExponential(0).replace("e+", "e") : v) + " coins in total", "earned", v));
    [1, 3, 5, 10, 25, 50, 100].forEach((v) => add("reb" + v, "Reborn x" + v, "Rebirth " + v + " time" + (v > 1 ? "s" : ""), "rebirths", v));
    [5, 10, 15, 20, 25].forEach((v) => add("stg" + v, "Lemon Tycoon " + v, "Reach lemon stage " + v, "stage", v));
    [10, 50, 100, 250, 500, 1000].forEach((v) => add("tier" + v, "Duck Collector " + v, "Own a tier " + v + " duck", "tier", v));
    [40, 100, 200].forEach((v) => add("pond" + v, "Crowded Pond " + v, "Have " + v + " ducks at once", "ducks", v));
    [3, 7, 30].forEach((v) => add("streak" + v, "Loyal Duck " + v, v + "-day login streak", "streak", v));
  })();

  // ------------------------------------------------------ DAILY (NEW)
  exports.DailyMinutesOfIncome = 15; // reward = 15 minutes of your income (min 1000), +10% per streak day (max +300%)

  exports.OfflineCapSeconds = 86400;
  exports.OfflineRate = 0.8;

  // ---------------------------------------------------------------- FORMAT
  const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc",
    "Ud", "Dd", "Td", "Qad", "Qid", "Sxd", "Spd", "Ocd", "Nod", "Vg"];
  exports.Format = function (num) {
    if (!isFinite(num)) return "∞";
    if (num < 1000) return String(Math.floor(num * 10) / 10);
    const idx = Math.floor(Math.log10(num) / 3);
    if (idx >= SUFFIXES.length) return num.toExponential(2).replace("e+", "e");
    return (num / Math.pow(10, idx * 3)).toFixed(2) + SUFFIXES[idx];
  };
})(typeof exports === "undefined" ? (this.Config = {}) : exports);
