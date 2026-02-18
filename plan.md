# Home Battery Database Website — Implementation Plan

## Context

Build a website similar to ev-database.org but focused on residential all-in-one home battery systems (Tesla Powerwall, Sonnen, Enphase IQ Battery, LG RESU, BYD Battery-Box, etc.). Users can filter, sort, view details, and compare up to 3 batteries side-by-side.

**Stack:** React 19 + TypeScript + Vite (frontend) · Express + TypeScript + better-sqlite3 (backend) · SQLite (data) · Tailwind CSS (styling) · Monorepo with `concurrently`.

---

## Project Structure

```
battery-db/
├── package.json                    # root — workspace scripts + concurrently
├── .gitignore
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # Express app entry point (port 3001)
│       ├── db.ts                   # SQLite init + WAL pragma
│       ├── schema.sql
│       ├── seed.ts                 # run once: npm run seed
│       ├── routes/
│       │   └── batteries.ts        # /api/batteries, /api/batteries/:slug, /api/meta
│       └── types/
│           └── battery.ts
├── data/
│   └── batteries.db                # git-ignored SQLite file
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts              # proxy /api → localhost:3001
    ├── tailwind.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx                 # BrowserRouter + routes
        ├── types/battery.ts
        ├── api/batteries.ts        # typed fetch functions
        ├── hooks/
        │   ├── useBatteries.ts     # central filter/sort/fetch state
        │   └── useDebounce.ts
        ├── components/
        │   ├── layout/Header.tsx · Footer.tsx
        │   ├── filters/FilterPanel.tsx · CheckboxGroup.tsx · RangeSlider.tsx · SortBar.tsx
        │   ├── battery/BatteryCard.tsx · BatteryGrid.tsx · SpecTable.tsx · CompareBar.tsx
        │   └── ui/Badge.tsx · Skeleton.tsx
        └── pages/
            ├── ListPage.tsx        # / — grid + sidebar filter
            ├── DetailPage.tsx      # /battery/:slug
            └── ComparePage.tsx     # /compare?ids=slug1,slug2,slug3
```

---

## Database Schema (`server/src/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS batteries (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                     TEXT    NOT NULL UNIQUE,
  brand                    TEXT    NOT NULL,
  model                    TEXT    NOT NULL,
  full_name                TEXT    NOT NULL,
  status                   TEXT    NOT NULL DEFAULT 'available'
                             CHECK(status IN ('available','discontinued','upcoming')),
  chemistry                TEXT    NOT NULL
                             CHECK(chemistry IN ('LFP','NMC','NCA','Lead-Acid','Flow','Other')),
  usable_capacity_kwh      REAL    NOT NULL,
  total_capacity_kwh       REAL,
  continuous_power_kw      REAL    NOT NULL,
  peak_power_kw            REAL,
  max_charge_rate_kw       REAL,
  roundtrip_efficiency_pct REAL,
  depth_of_discharge_pct   REAL,
  voltage_v                REAL,
  ac_coupled               INTEGER NOT NULL DEFAULT 0,
  indoor_rated             INTEGER NOT NULL DEFAULT 1,
  outdoor_rated            INTEGER NOT NULL DEFAULT 0,
  width_mm                 REAL,
  height_mm                REAL,
  depth_mm                 REAL,
  weight_kg                REAL,
  operating_temp_min_c     REAL,
  operating_temp_max_c     REAL,
  warranty_years           INTEGER,
  warranty_cycles          INTEGER,
  price_usd                REAL,
  price_eur                REAL,
  image_url                TEXT,
  datasheet_url            TEXT,
  country_availability     TEXT    DEFAULT '[]',
  notes                    TEXT,
  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_batteries_status    ON batteries(status);
CREATE INDEX IF NOT EXISTS idx_batteries_chemistry ON batteries(chemistry);
CREATE INDEX IF NOT EXISTS idx_batteries_slug      ON batteries(slug);
```

---

## API Endpoints (`server/src/routes/batteries.ts`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/batteries` | List with query filters; dynamic parameterized SQL WHERE clause |
| GET | `/api/batteries/:slug` | Single battery detail |
| GET | `/api/meta` | Filter metadata: distinct chemistries, statuses, min/max capacity/power/price |

**Filter query params:** `status`, `chemistry` (comma-separated), `min_capacity`, `max_capacity`, `min_power`, `max_power`, `ac_coupled` (0/1), `indoor` (1), `outdoor` (1), `min_price`, `max_price`, `sort_by`, `sort_dir`

**Sort whitelist** (prevents SQL injection): `capacity → usable_capacity_kwh`, `power → continuous_power_kw`, `efficiency → roundtrip_efficiency_pct`, `price → price_usd`, `weight → weight_kg`

---

## Seed Data (`server/src/seed.ts`)

10 real batteries pre-loaded:

| Battery | kWh | kW | Chemistry | Coupling |
|---|---|---|---|---|
| Tesla Powerwall 3 | 13.5 | 11.5 | LFP | AC |
| Tesla Powerwall 2 | 13.5 | 5.0 | NMC | AC (discontinued) |
| Sonnen eco 10 | 10.0 | 3.3 | LFP | AC |
| Enphase IQ Battery 5P | 4.96 | 3.84 | LFP | AC |
| LG RESU16H Prime | 16.0 | 7.0 | NMC | DC |
| BYD Battery-Box Premium HVS 13.8 | 13.8 | 5.0 | LFP | DC |
| Sungrow SH10.0RT + SBR100 | 9.6 | 5.0 | LFP | DC |
| Alpha ESS Smile-S6 | 5.7 | 3.0 | LFP | AC |
| Generac PWRcell M17 | 17.1 | 9.0 | NMC | DC |
| Franklin Electric aPower 5 | 5.0 | 5.0 | LFP | AC (upcoming) |

---

## Frontend Architecture

### Key hooks
- **`useBatteries`** — owns all filter state, debounces range sliders (350ms), bootstraps ranges from `/api/meta` on mount, re-fetches on filter/sort changes
- **`useDebounce`** — generic 400ms debounce hook

### Filter sidebar dimensions
- Status checkboxes (available / discontinued / upcoming)
- Chemistry checkboxes (LFP, NMC, NCA, …)
- Capacity range slider (kWh)
- Power range slider (kW)
- Coupling radio (All / AC only / DC only)
- Installation checkboxes (indoor / outdoor)
- Price range slider (USD)

### Sort options
Capacity · Power · Efficiency · Price · Weight, with ASC/DESC toggle

### BatteryCard
Shows: brand/model, status + chemistry badges, usable capacity, continuous power, efficiency, warranty, price, AC/DC coupling pill, outdoor badge, "View specs" link, "+ Compare" toggle

### ComparePage (`/compare?ids=slug1,slug2,slug3`)
Horizontal table. Rows grouped by section (Capacity / Power / Performance / Physical / Warranty & Price). Best value in each numeric row highlighted green.

### CompareBar
Fixed bottom bar — appears when ≥1 battery selected. Shows mini-cards with remove buttons and a "Compare now" CTA that navigates to `/compare?ids=…`.

---

## Design System

- **Background:** slate-50 · Cards: white · Accent: slate-900 · Prices: emerald-500
- **Chemistry badges:** LFP green · NMC blue · NCA purple · Lead-Acid gray · Flow cyan
- **Status badges:** available emerald · discontinued red · upcoming amber
- **Font:** Inter (Google Fonts)
- **Layout:** max-w-screen-xl, 3-col grid on lg, 4-col on xl; 256px filter sidebar on lg+; mobile filter as collapsible drawer

---

## Commands

```bash
# Install all workspaces
npm install

# Seed the database (first time)
npm run seed

# Development (runs server:3001 + client:5173 concurrently)
npm run dev

# Reset & reseed database
npm run db:reset

# Production build
npm run build
# Then serve client/dist as static files from Express
```

---

## Implementation Order

1. Scaffold monorepo root (`package.json` + `concurrently`)
2. Build `server/` — schema, db.ts, index.ts, types
3. Run seed — validates schema end-to-end
4. Implement all three API routes; test with curl
5. Scaffold client with `npm create vite@latest client -- --template react-ts`
6. Configure Tailwind, Inter font, vite.config proxy
7. Build types → API layer → hooks
8. Build UI components bottom-up: `Badge` → `BatteryCard` → `BatteryGrid` → `FilterPanel` → `SortBar` → `CompareBar`
9. Build pages: `ListPage` → `DetailPage` → `ComparePage`
10. Add mobile filter drawer
11. Polish: loading skeletons, empty states, page `<title>` tags

---

## Verification

- `curl "http://localhost:3001/api/batteries"` returns 10 batteries
- `curl "http://localhost:3001/api/batteries?status=available&chemistry=LFP&sort_by=capacity&sort_dir=desc"` returns filtered + sorted subset
- `curl "http://localhost:3001/api/meta"` returns correct min/max ranges
- `curl "http://localhost:3001/api/batteries/tesla-powerwall-3"` returns full record
- Browser: list page loads with all filters, cards render, filter changes update results without full reload
- Browser: detail page for `/battery/tesla-powerwall-3` shows all specs
- Browser: select 3 batteries → CompareBar appears → "Compare now" → side-by-side table with best-value highlights
- Mobile: filter opens as drawer, grid collapses to 1 column
