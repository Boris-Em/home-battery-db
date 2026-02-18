import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

const db = new Database(join(dataDir, 'batteries.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
  DROP TABLE IF EXISTS batteries;
  DROP TABLE IF EXISTS brands;

  CREATE TABLE brands (
    slug          TEXT PRIMARY KEY NOT NULL,
    name          TEXT NOT NULL,
    country       TEXT,
    website_url   TEXT,
    logo_url      TEXT,
    description   TEXT
  );

  CREATE TABLE batteries (
    -- Identity
    slug                      TEXT PRIMARY KEY NOT NULL,
    brand_slug                TEXT NOT NULL REFERENCES brands(slug),
    model                     TEXT NOT NULL,
    manufacturer_sku          TEXT,
    status                    TEXT NOT NULL DEFAULT 'available'
                                CHECK(status IN ('available', 'discontinued', 'upcoming')),
    released_date             TEXT,
    image_url                 TEXT,
    datasheet_url             TEXT,
    product_url               TEXT,

    -- Core specs
    usable_capacity_kwh       REAL NOT NULL,
    total_capacity_kwh        REAL,
    continuous_power_kw       REAL NOT NULL,
    peak_power_kw             REAL,
    max_charge_rate_kw        REAL,

    -- Technology
    chemistry                 TEXT NOT NULL CHECK(chemistry IN ('LFP', 'NMC', 'NCA', 'Other')),
    ac_coupled                INTEGER NOT NULL,
    backup_type               TEXT NOT NULL CHECK(backup_type IN ('none', 'essential_circuits', 'whole_home')),
    scalable                  INTEGER NOT NULL,

    -- Efficiency & lifespan
    roundtrip_efficiency_pct  REAL,
    depth_of_discharge_pct    REAL,
    warranty_years            REAL,
    warranty_cycles           INTEGER,
    warranty_throughput_kwh   REAL,

    -- Physical
    weight_kg                 REAL,
    indoor_rated              INTEGER NOT NULL,
    outdoor_rated             INTEGER NOT NULL,
    ip_rating                 TEXT,
    operating_temp_min_c      REAL,
    operating_temp_max_c      REAL,

    -- Pricing & availability
    price_nl                  REAL,
    price_fr                  REAL,
    price_us                  REAL,
    price_note                TEXT,
    available_nl              INTEGER NOT NULL DEFAULT 0,
    available_fr              INTEGER NOT NULL DEFAULT 0,
    available_us              INTEGER NOT NULL DEFAULT 0,

    -- Meta
    notes                     TEXT,
    created_at                TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert 'true'/'false' CSV strings to SQLite 1/0. */
const bool = (v) => (v === 'true' ? 1 : 0);

/** Return null for empty strings, otherwise parse as float. */
const num = (v) => (v === '' ? null : parseFloat(v));

/** Return null for empty strings, otherwise return the string. */
const str = (v) => (v === '' ? null : v);

// ---------------------------------------------------------------------------
// Seed brands
// ---------------------------------------------------------------------------

const brandsCSV = readFileSync(join(dataDir, 'brands_seed.csv'), 'utf8');
const brands = parse(brandsCSV, { columns: true, skip_empty_lines: true });

const insertBrand = db.prepare(`
  INSERT INTO brands (slug, name, country, website_url, logo_url, description)
  VALUES (@slug, @name, @country, @website_url, @logo_url, @description)
`);

for (const row of brands) {
  insertBrand.run({
    slug:        row.slug,
    name:        row.name,
    country:     str(row.country),
    website_url: str(row.website_url),
    logo_url:    str(row.logo_url),
    description: str(row.description),
  });
}

console.log(`✓ Inserted ${brands.length} brands`);

// ---------------------------------------------------------------------------
// Seed batteries
// ---------------------------------------------------------------------------

const batteriesCSV = readFileSync(join(dataDir, 'batteries_seed.csv'), 'utf8');
const batteries = parse(batteriesCSV, { columns: true, skip_empty_lines: true });

const insertBattery = db.prepare(`
  INSERT INTO batteries (
    slug, brand_slug, model, manufacturer_sku, status, released_date,
    image_url, datasheet_url, product_url,
    usable_capacity_kwh, total_capacity_kwh, continuous_power_kw,
    peak_power_kw, max_charge_rate_kw,
    chemistry, ac_coupled, backup_type, scalable,
    roundtrip_efficiency_pct, depth_of_discharge_pct,
    warranty_years, warranty_cycles, warranty_throughput_kwh,
    weight_kg, indoor_rated, outdoor_rated, ip_rating,
    operating_temp_min_c, operating_temp_max_c,
    price_nl, price_fr, price_us, price_note,
    available_nl, available_fr, available_us,
    notes
  ) VALUES (
    @slug, @brand_slug, @model, @manufacturer_sku, @status, @released_date,
    @image_url, @datasheet_url, @product_url,
    @usable_capacity_kwh, @total_capacity_kwh, @continuous_power_kw,
    @peak_power_kw, @max_charge_rate_kw,
    @chemistry, @ac_coupled, @backup_type, @scalable,
    @roundtrip_efficiency_pct, @depth_of_discharge_pct,
    @warranty_years, @warranty_cycles, @warranty_throughput_kwh,
    @weight_kg, @indoor_rated, @outdoor_rated, @ip_rating,
    @operating_temp_min_c, @operating_temp_max_c,
    @price_nl, @price_fr, @price_us, @price_note,
    @available_nl, @available_fr, @available_us,
    @notes
  )
`);

for (const row of batteries) {
  insertBattery.run({
    slug:                     row.slug,
    brand_slug:               row.brand_slug,
    model:                    row.model,
    manufacturer_sku:         str(row.manufacturer_sku),
    status:                   row.status,
    released_date:            str(row.released_date),
    image_url:                str(row.image_url),
    datasheet_url:            str(row.datasheet_url),
    product_url:              str(row.product_url),
    usable_capacity_kwh:      num(row.usable_capacity_kwh),
    total_capacity_kwh:       num(row.total_capacity_kwh),
    continuous_power_kw:      num(row.continuous_power_kw),
    peak_power_kw:            num(row.peak_power_kw),
    max_charge_rate_kw:       num(row.max_charge_rate_kw),
    chemistry:                row.chemistry,
    ac_coupled:               bool(row.ac_coupled),
    backup_type:              row.backup_type,
    scalable:                 bool(row.scalable),
    roundtrip_efficiency_pct: num(row.roundtrip_efficiency_pct),
    depth_of_discharge_pct:   num(row.depth_of_discharge_pct),
    warranty_years:           num(row.warranty_years),
    warranty_cycles:          num(row.warranty_cycles),
    warranty_throughput_kwh:  num(row.warranty_throughput_kwh),
    weight_kg:                num(row.weight_kg),
    indoor_rated:             bool(row.indoor_rated),
    outdoor_rated:            bool(row.outdoor_rated),
    ip_rating:                str(row.ip_rating),
    operating_temp_min_c:     num(row.operating_temp_min_c),
    operating_temp_max_c:     num(row.operating_temp_max_c),
    price_nl:                 num(row.price_nl),
    price_fr:                 num(row.price_fr),
    price_us:                 num(row.price_us),
    price_note:               str(row.price_note),
    available_nl:             bool(row.available_nl),
    available_fr:             bool(row.available_fr),
    available_us:             bool(row.available_us),
    notes:                    str(row.notes),
  });
}

console.log(`✓ Inserted ${batteries.length} batteries`);

db.close();
console.log('✓ Database written to data/batteries.db');
