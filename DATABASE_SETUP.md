# Free permanent saves with Upstash Redis (about 5 minutes)

Render's free tier wipes files on every restart or deploy. Storing progress in a free
Upstash database fixes that: progress survives updates, sleeping and restarts.

## 1. Create the database
1. Go to https://upstash.com and sign up (free, no card needed at the time of writing).
2. Click **Create Database**  (Redis).
3. Name: `duck-tycoon`. Pick the region closest to your Render region. Choose the **Free** plan. Create.

## 2. Copy the two secrets
On the database page, scroll to the **REST API** section. Copy:
- `UPSTASH_REDIS_REST_URL`   (looks like https://something.upstash.io)
- `UPSTASH_REDIS_REST_TOKEN` (long text; use the normal token, NOT the "read-only" one)

## 3. Give them to Render (do NOT put them in GitHub)
Render dashboard > your service > **Environment** > **Add Environment Variable**. Add:

| Key | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | the URL you copied |
| `UPSTASH_REDIS_REST_TOKEN` | the token you copied |
| `ADMIN_CODE` | your admin code |

Save. Render redeploys automatically.

## 4. Check it worked
Render > **Logs** should show:
`Storage: Upstash Redis (0 players loaded).`
(the number grows as people play). If you see `Storage: local file` instead, the two
variables are missing or misspelled.

## Notes
- If the database can't be reached when the game starts, the game refuses to start instead of
  running empty (so it can never overwrite real progress). Fix the variables and redeploy.
- Saves are written every 20 seconds while players are online and when they leave, so at most
  ~20 seconds of progress could be lost in a crash.
- Free plan limits can change. Check Upstash's current free limits. This game only writes
  online players' saves, so a small group stays well within them.
- To run locally with the database, set the same variables before `npm start`. Without them
  the game just uses `saves.json` as before. If the database is empty and a local `saves.json`
  exists, it is imported automatically on first start.
