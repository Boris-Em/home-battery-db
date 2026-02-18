# Home Battery Database

## Problem

Buying or comparing home battery systems is painful. Specs are scattered across manufacturer PDFs, review sites, and forum posts — with no consistent format. Consumers, installers, and researchers have no single place to filter, compare, and evaluate options side by side.

This site is a structured, up-to-date database of residential home battery systems that makes it easy to find the right battery for any situation.

---

## Inspiration

**[ev-database.org](https://ev-database.org)** is the primary reference. It does for electric vehicles exactly what this site aims to do for home batteries: a clean, filterable database with consistent specs, detail pages, and side-by-side comparison. The structure, UX patterns, and content approach are the direct model.

---

## Target audience

**Primary: homeowners** researching a home battery purchase. They've typically just gotten a solar quote, experienced a power outage, or been nudged by a subsidy program. They're not technical — they need help translating specs into real-world answers and want to compare options before talking to an installer.

**Secondary: professional installers** who configure and sell systems daily. They already know the specs — they want fast lookup, comparison, and datasheet access to sanity-check a product or find alternatives for a client's budget.

**Markets:** Netherlands · France · United States

Each market has distinct characteristics:

- **Netherlands** — high solar adoption, dense housing, strong grid, net metering phase-out driving battery interest, EUR pricing
- **France** — growing solar market, EDF dominance, different subsidy landscape, EUR pricing
- **United States** — largest market, huge regional variation (California IQ, Texas outages, hurricane belt), USD pricing, installer-driven sales

**Implications for the product:**

- Battery availability varies by market — need per-market availability flags
- Pricing in EUR and USD; subsidies/incentives are out of scope for v1
- Language: English-first for all three markets (v1); localization later
- Content tone: accessible, jargon-light for homeowners; dense and fast for installers

---

## Tech stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Framework | Astro | Static site generation with pre-rendered HTML for every page — good SEO without server complexity |
| UI components | React | Interactive islands (filter panel, compare feature) where JavaScript is genuinely needed |
| Language | TypeScript | Type safety across the codebase |
| Styling | Tailwind CSS | Fast, consistent styling; well-suited to data-dense UIs |
| Data | SQLite (build-time only) | Structured schema, easy to edit with a GUI tool (TablePlus, DB Browser); queried at build time to generate static pages — no runtime database |
| Hosting | Vercel or Netlify | Free tier, automatic deploys from git |

---

## Data model

Two entities: **Brand** and **Battery**. All data read from SQLite at build time. Batteries reference brands via `brand_slug`.

## Brand

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `slug` | text | ✅ | URL identifier, e.g. `tesla` |
| `name` | text | ✅ | e.g. Tesla |
| `country` | text | — | Country of origin |
| `website_url` | text | — | |
| `logo_url` | text | — | |
| `description` | text | — | One-sentence description |

---

## Battery

### Identity

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `slug` | text | ✅ | URL identifier, e.g. `tesla-powerwall-3` |
| `brand_slug` | text | ✅ | FK → brands.slug |
| `model` | text | ✅ | e.g. Powerwall 3 |
| `manufacturer_sku` | text | — | Manufacturer model code e.g. `IQ10T`, `RESU10H-R2` |
| `status` | enum | ✅ | `available` · `discontinued` · `upcoming` |
| `released_date` | date | — | Market introduction date; year-only precision is fine |
| `image_url` | text | — | |
| `datasheet_url` | text | — | Link to manufacturer PDF |
| `product_url` | text | — | Manufacturer product page |

### Core specs

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `usable_capacity_kwh` | number | ✅ | Primary headline spec |
| `total_capacity_kwh` | number | — | Some brands only publish usable |
| `continuous_power_kw` | number | ✅ | What you can continuously draw |
| `peak_power_kw` | number | — | Short-term burst |
| `max_charge_rate_kw` | number | — | |

### Technology

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `chemistry` | enum | ✅ | `LFP` · `NMC` · `NCA` · `Other` |
| `ac_coupled` | boolean | ✅ | True = AC, False = DC |
| `backup_type` | enum | ✅ | `none` · `essential_circuits` · `whole_home` |
| `scalable` | boolean | ✅ | Supports stacking additional modules |

### Efficiency & lifespan

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roundtrip_efficiency_pct` | number | — | e.g. 90 |
| `depth_of_discharge_pct` | number | — | e.g. 100 |
| `warranty_years` | number | — | |
| `warranty_cycles` | number | — | |
| `warranty_throughput_kwh` | number | — | Total energy guaranteed over warranty |

### Physical

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `weight_kg` | number | — | |
| `indoor_rated` | boolean | ✅ | |
| `outdoor_rated` | boolean | ✅ | |
| `ip_rating` | text | — | e.g. IP55 |
| `operating_temp_min_c` | number | — | |
| `operating_temp_max_c` | number | — | |

### Pricing & availability

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `price_nl` | number | — | EUR, indicative retail ex. installation |
| `price_fr` | number | — | EUR, indicative retail ex. installation |
| `price_us` | number | — | USD, indicative retail ex. installation |
| `price_note` | text | — | e.g. "base unit only", "ex. VAT" |
| `available_nl` | boolean | ✅ | |
| `available_fr` | boolean | ✅ | |
| `available_us` | boolean | ✅ | |

### Meta

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `notes` | text | — | Free-form internal notes |
| `created_at` | datetime | ✅ | |
| `updated_at` | datetime | ✅ | |
