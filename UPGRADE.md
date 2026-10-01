# Upgrade notes (your customised version + progression + admin + database)

## Files
Replace / add these in your GitHub repo (same folders as before):

| File | Action |
|---|---|
| `server.js` | replace (your version, merged with new systems + database saving) |
| `admin.js` | replace (server-side admin, many new commands) |
| `store.js` | add (Upstash Redis / file saving; see DATABASE_SETUP.md) |
| `public/config.js` | replace (your version, extended + rebalanced) |
| `public/admin1.js` | replace (new tabbed admin panel) |
| `public/progress.js` | add (Egg Shop, achievements, daily reward, golden duck) |
| `public/index.html` | **do not replace.** Just add ONE line after the admin1.js line: `<script src="progress.js"></script>` |

Render environment variables: `ADMIN_CODE`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## New progression
- **Golden Eggs**: earned on every rebirth, never lost. Spend them in the Egg Shop (9 permanent upgrades,
  incl. Auto-Seller, Auto-Buyer, Auto-Upgrader, +coins, +lemons, +duck income, bigger offline cap, bigger starting coins).
- **32 achievements**: each gives +2% coins forever and 1 egg.
- **Daily reward** with a login streak (bonus eggs every 7th day).
- **Golden Duck**: appears for everyone every ~8-16 minutes; first player to click it wins a prize.
- **8 worlds** (your first 3 are unchanged).
- **Duck tiers unlock gradually** (lemon stage + rebirths + world). The shop shows the 40 highest unlocked tiers.
- **Full pond**: buying a better duck now replaces your weakest one, so slots never block progress.
- Number formatting now works past 1e21 (scientific notation beyond 1e66).

## Balance changes to YOUR numbers (and why)
In a simulation, your original numbers let a greedy player reach duck tier 1000 in about 40 minutes and do 100 rebirths in
the first ~10 minutes, because ducks paid for themselves in 2-4 seconds and rebirths cost almost nothing.
Changed in `public/config.js`:
- `DuckCost`: `10 * 1.36^(t-1)`  ->  `200 * 1.42^(t-1)`
- Stage upgrade cost: `5000 * 3.4^(s-2)`  ->  `12000 * 3.4^(s-2)`
- `RebirthCost`: `2e9 * 2.2^r`  ->  `1e12 * 25^r`
Everything else you customised (income, lemons, rebirth multiplier, worlds, offline rate) is kept.
Players' existing saves keep working; they keep their ducks/rebirths, but new purchases cost more.

## Admin panel (hidden square, bottom-left; code = your ADMIN_CODE)
- **Events:** Lucky Hour, coin / lemon / egg boosts, Coin Frenzy, MEGA EVENT (all three), Golden Duck race, Duck Rain,
  Raffle, custom buff (any x1-1000, up to 24h), end one or all buffs.
- **Gifts** (to everyone or one chosen player): coins, lemons, eggs, rebirths, time skip, ducks (tier + count), raise lemon stage.
- **Players:** list, kick, mute/unmute, reset progress.
- **Server:** announcements, stats, save now.
