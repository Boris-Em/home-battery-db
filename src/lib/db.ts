import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Battery, Brand } from '../types/battery';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../../data/batteries.db');

function openDb() {
  return new Database(dbPath, { readonly: true });
}

export function getAllBatteries(): Battery[] {
  const db = openDb();
  const rows = db.prepare(`
    SELECT b.*, br.name AS brand_name
    FROM batteries b
    JOIN brands br ON b.brand_slug = br.slug
    ORDER BY b.usable_capacity_kwh DESC
  `).all() as Battery[];
  db.close();
  return rows;
}

export function getBatteryBySlug(slug: string): Battery | null {
  const db = openDb();
  const row = db.prepare(`
    SELECT b.*, br.name AS brand_name
    FROM batteries b
    JOIN brands br ON b.brand_slug = br.slug
    WHERE b.slug = ?
  `).get(slug) as Battery | undefined;
  db.close();
  return row ?? null;
}

export function getAllBrands(): Brand[] {
  const db = openDb();
  const rows = db.prepare(`SELECT * FROM brands ORDER BY name`).all() as Brand[];
  db.close();
  return rows;
}

export function getBatteriesByBrandSlug(brandSlug: string): Battery[] {
  const db = openDb();
  const rows = db.prepare(`
    SELECT b.*, br.name AS brand_name
    FROM batteries b
    JOIN brands br ON b.brand_slug = br.slug
    WHERE b.brand_slug = ?
    ORDER BY b.released_date DESC
  `).all(brandSlug) as Battery[];
  db.close();
  return rows;
}

export function getBrandBySlug(slug: string): Brand | null {
  const db = openDb();
  const row = db.prepare(`SELECT * FROM brands WHERE slug = ?`).get(slug) as Brand | undefined;
  db.close();
  return row ?? null;
}
