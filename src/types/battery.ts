export interface Brand {
  slug: string;
  name: string;
  country: string | null;
  website_url: string | null;
  logo_url: string | null;
  description: string | null;
}

export interface Battery {
  // Identity
  slug: string;
  brand_slug: string;
  brand_name: string;
  model: string;
  manufacturer_sku: string | null;
  status: 'available' | 'discontinued' | 'upcoming';
  released_date: string | null;
  image_url: string | null;
  datasheet_url: string | null;
  product_url: string | null;

  // Core specs
  usable_capacity_kwh: number;
  total_capacity_kwh: number | null;
  continuous_power_kw: number;
  peak_power_kw: number | null;
  max_charge_rate_kw: number | null;

  // Technology
  chemistry: 'LFP' | 'NMC' | 'NCA' | 'Other';
  ac_coupled: 0 | 1;
  backup_type: 'none' | 'essential_circuits' | 'whole_home';
  scalable: 0 | 1;

  // Efficiency & lifespan
  roundtrip_efficiency_pct: number | null;
  depth_of_discharge_pct: number | null;
  warranty_years: number | null;
  warranty_cycles: number | null;
  warranty_throughput_kwh: number | null;

  // Physical
  weight_kg: number | null;
  indoor_rated: 0 | 1;
  outdoor_rated: 0 | 1;
  ip_rating: string | null;
  operating_temp_min_c: number | null;
  operating_temp_max_c: number | null;

  // Pricing & availability
  price_nl: number | null;
  price_fr: number | null;
  price_us: number | null;
  price_note: string | null;
  available_nl: 0 | 1;
  available_fr: 0 | 1;
  available_us: 0 | 1;

  // Meta
  notes: string | null;
  created_at: string;
  updated_at: string;
}
