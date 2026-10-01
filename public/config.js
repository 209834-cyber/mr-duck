// Shared by server (Node) and browser.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Config = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const Config = {};

  Config.DuckNames = [
    "Common Duck","Yellow Duckling","Puddle Duck","Rubber Duck","Mallard","Pond Duck",
    "Bread Lover","Lemon Duck","Golden Duck","Crystal Duck","Ruby Duck","Emerald Duck",
    "Diamond Duck","Neon Duck","Cyber Duck","Lava Duck","Frost Duck","Void Duck",
    "Celestial Duck","Cosmic Duck",
  ];

  Config.StageNames = [
    "Lemon Stand","Lemonade Cart","Lemon Grove","Juice Bar","Lemonade Shop",
    "Citrus Farm","Lemon Factory","Zest Industries","Lemon Mega Mart","Lemon Empire",
    "Lemon Skyscraper","Lemon Space Station","Lemon Planet","Lemon Galaxy","Lemon Galaxy Corp",
  ];

  Config.BaseSlots = 10;
  Config.SlotsPerStage = 5; // 10 + 5*(stage-1) = 80 at final stage
  Config.OfflineCapSeconds = 8 * 3600;
  Config.OfflineRate = 0.5;

  Config.DuckCost = (i) => Math.floor(50 * Math.pow(3.2, i - 1));
  Config.DuckIncome = (i) => Math.floor(Math.pow(2.6, i - 1) * 10) / 10;

  Config.Stage = (i) => ({
    Name: Config.StageNames[i - 1],
    Cost: i === 1 ? 0 : Math.floor(200 * Math.pow(6, i - 2)),
    LemonsPerSec: Math.floor(Math.pow(2.4, i - 1) * 10) / 10,
    SellPrice: Math.floor(2 * Math.pow(1.7, i - 1) * 100) / 100,
    PickAmount: 1 + (i - 1) * 3,
  });

  Config.MaxSlots = (stage) => Config.BaseSlots + Config.SlotsPerStage * (stage - 1);
  Config.RebirthCost = (r) => Math.floor(5e6 * Math.pow(8, r));
  Config.RebirthMult = (r) => 1 + 0.75 * r;

  const suffixes = ["","K","M","B","T","Qa","Qi","Sx","Sp","Oc","No","Dc","Ud","Dd","Td"];
  Config.Format = (n) => {
    if (n < 1000) return String(Math.floor(n * 10) / 10);
    const idx = Math.min(Math.floor(Math.log10(n) / 3), suffixes.length - 1);
    return (n / Math.pow(10, idx * 3)).toFixed(2) + suffixes[idx];
  };

  return Config;
});
