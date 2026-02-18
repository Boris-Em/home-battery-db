# check-new-batteries — Plan

A script run manually each day to detect new home battery products announced in industry news and verify they aren't already tracked in the database.

```
npm run check
```

---

## Architecture

```
scripts/check-new-batteries.js   ← main script
data/rss-feeds.json              ← curated list of RSS feeds (editable)
data/batteries.db                ← existing SQLite DB, queried read-only
data/new-batteries-YYYY-MM-DD.md ← output: one file per run (gitignored)
```

**New dependencies:** `rss-parser`, `@anthropic-ai/sdk`

**Env var required:** `ANTHROPIC_API_KEY`

---

## Flow

### 1. Determine cutoff date
- Scan `data/` for existing `new-batteries-YYYY-MM-DD.md` files
- Use the date of the most recent file as the cutoff
- First run ever: default to 7 days ago

### 2. Fetch RSS feeds
- Fetch all feeds from `data/rss-feeds.json` in parallel
- Keep only items published after the cutoff date
- Keyword pre-filter: drop items with no battery-related terms in title or description
- If nothing passes: log "Nothing relevant since [date]" and exit

### 3. Agent 1 — Identify new product announcements (Claude Haiku)
- Input: filtered article titles + descriptions
- Task: identify which articles announce the launch or release of a new residential home battery (not a review, price change, or accessory)
- Output: structured list of `{ brand, model, key_specs_mentioned, article_url, pub_date }`
- If none found: exit

### 4. Load current database
- Query `batteries.db`: `SELECT brand_slug, model, slug FROM batteries`
- Query `batteries.db`: `SELECT slug, name FROM brands`

### 5. Agent 2 — Cross-check against database (Claude Haiku)
- Input: Agent 1 findings + current database contents
- Task: filter out batteries already tracked, accounting for name variations (e.g. "Powerwall 3" matches `tesla-powerwall-3`)
- Output: confirmed new batteries only

### 6. Write output file
- Filename: `data/new-batteries-YYYY-MM-DD.md`
- One entry per confirmed new battery:
  - Brand, model name
  - Source article URL and publish date
  - Key specs mentioned in the article
  - Agent notes on why it's considered new

---

## RSS feeds (`data/rss-feeds.json`)

| Source | URL |
|---|---|
| PV Magazine (international) | https://www.pv-magazine.com/feed/ |
| PV Magazine USA | https://pv-magazine-usa.com/feed/ |
| Electrek | https://electrek.co/feed/ |
| CleanTechnica | https://cleantechnica.com/feed/ |
| Solar Power World | https://www.solarpowerworldonline.com/feed/ |
| PV Tech | https://www.pv-tech.org/feed/ |
| Energy Storage News | https://www.energy-storage.news/feed/ |
| Canary Media | https://www.canarymedia.com/rss |