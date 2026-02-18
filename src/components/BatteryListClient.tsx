import { useState } from 'react';
import type { Battery } from '../types/battery';

interface Props {
  batteries: Battery[];
}

type SortKey = 'name' | 'chemistry' | 'usable_capacity_kwh' | 'continuous_power_kw' | 'backup_type' | 'warranty_years' | 'price' | 'released_date';
type Direction = 'asc' | 'desc';

const backupLabel: Record<Battery['backup_type'], string> = {
  none: 'No backup',
  essential_circuits: 'Essential backup',
  whole_home: 'Whole-home backup',
};

const backupOrder: Record<Battery['backup_type'], number> = {
  none: 0,
  essential_circuits: 1,
  whole_home: 2,
};

const chemistryColor: Record<Battery['chemistry'], string> = {
  LFP: 'bg-green-100 text-green-800',
  NMC: 'bg-blue-100 text-blue-800',
  NCA: 'bg-purple-100 text-purple-800',
  Other: 'bg-gray-100 text-gray-800',
};

function getPrice(b: Battery): number | null {
  return b.price_us ?? b.price_nl ?? null;
}

function sortBatteries(batteries: Battery[], key: SortKey, dir: Direction): Battery[] {
  const sorted = [...batteries].sort((a, b) => {
    let diff = 0;
    switch (key) {
      case 'name':
        diff = `${a.brand_name} ${a.model}`.localeCompare(`${b.brand_name} ${b.model}`);
        break;
      case 'chemistry':
        diff = a.chemistry.localeCompare(b.chemistry);
        break;
      case 'usable_capacity_kwh':
        diff = a.usable_capacity_kwh - b.usable_capacity_kwh;
        break;
      case 'continuous_power_kw':
        diff = a.continuous_power_kw - b.continuous_power_kw;
        break;
      case 'backup_type':
        diff = backupOrder[a.backup_type] - backupOrder[b.backup_type];
        break;
      case 'warranty_years': {
        const wa = a.warranty_years ?? -1;
        const wb = b.warranty_years ?? -1;
        diff = wa - wb;
        break;
      }
      case 'price': {
        const pa = getPrice(a) ?? Infinity;
        const pb = getPrice(b) ?? Infinity;
        diff = pa - pb;
        break;
      }
      case 'released_date': {
        const da = a.released_date ?? '';
        const db_ = b.released_date ?? '';
        if (!da && !db_) { diff = 0; break; }
        if (!da) { diff = 1; break; }
        if (!db_) { diff = -1; break; }
        diff = da.localeCompare(db_);
        break;
      }
    }
    return dir === 'asc' ? diff : -diff;
  });
  return sorted;
}

function SortIcon({ active, dir }: { active: boolean; dir: Direction }) {
  if (!active) return <span className="ml-1 text-gray-300">↕</span>;
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function ColHeader({
  label,
  sortKey,
  current,
  dir,
  className,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: Direction;
  className?: string;
  onClick: (key: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`flex items-center text-left text-xs font-medium uppercase tracking-wide cursor-pointer select-none transition-colors ${active ? 'text-gray-700' : 'text-gray-400 hover:text-gray-600'} ${className ?? ''}`}
    >
      {label}
      <SortIcon active={active} dir={dir} />
    </button>
  );
}

export default function BatteryListClient({ batteries }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('usable_capacity_kwh');
  const [sortDir, setSortDir] = useState<Direction>('desc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = sortBatteries(batteries, sortKey, sortDir);

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-6 px-5 pb-1">
        <ColHeader label="Battery" sortKey="name" current={sortKey} dir={sortDir} onClick={handleSort} className="w-48 shrink-0" />
        <ColHeader label="Type" sortKey="chemistry" current={sortKey} dir={sortDir} onClick={handleSort} className="w-12 shrink-0" />
        <div className="flex flex-1 items-center gap-6">
          <ColHeader label="Capacity" sortKey="usable_capacity_kwh" current={sortKey} dir={sortDir} onClick={handleSort} className="w-24" />
          <ColHeader label="Cont. power" sortKey="continuous_power_kw" current={sortKey} dir={sortDir} onClick={handleSort} className="w-28" />
          <ColHeader label="Backup" sortKey="backup_type" current={sortKey} dir={sortDir} onClick={handleSort} className="w-36 hidden md:flex" />
          <ColHeader label="Warranty" sortKey="warranty_years" current={sortKey} dir={sortDir} onClick={handleSort} className="w-20 hidden lg:flex" />
          <ColHeader label="Released" sortKey="released_date" current={sortKey} dir={sortDir} onClick={handleSort} className="w-20 hidden lg:flex" />
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="w-16" />
          <ColHeader label="Price" sortKey="price" current={sortKey} dir={sortDir} onClick={handleSort} className="w-24 justify-end" />
        </div>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2">
        {sorted.map(battery => {
          const price = getPrice(battery);
          const currency = battery.price_us ? '$' : '€';
          return (
            <a
              key={battery.slug}
              href={`/batteries/${battery.slug}`}
              className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:shadow-md hover:border-gray-300"
            >
              {/* Name */}
              <div className="min-w-0 w-48 shrink-0">
                <p className="text-xs font-medium text-gray-500">{battery.brand_name}</p>
                <h2 className="truncate text-base font-semibold text-gray-900">{battery.model}</h2>
              </div>

              {/* Chemistry badge */}
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${chemistryColor[battery.chemistry]}`}>
                {battery.chemistry}
              </span>

              {/* Specs */}
              <div className="flex flex-1 items-center gap-6 text-sm">
                <div className="w-24">
                  <p className="font-semibold text-gray-900">{battery.usable_capacity_kwh} kWh</p>
                </div>
                <div className="w-28">
                  <p className="font-semibold text-gray-900">{battery.continuous_power_kw} kW</p>
                </div>
                <div className="w-36 hidden md:block">
                  <p className="font-semibold text-gray-900">{backupLabel[battery.backup_type]}</p>
                </div>
                <div className="w-20 hidden lg:block">
                  <p className="font-semibold text-gray-900">{battery.warranty_years ? `${battery.warranty_years} yr` : '—'}</p>
                </div>
                <div className="w-20 hidden lg:block">
                  <p className="font-semibold text-gray-900">{battery.released_date ? battery.released_date.slice(0, 4) : '—'}</p>
                </div>
              </div>

              {/* Markets + price */}
              <div className="flex shrink-0 items-center gap-4">
                <div className="flex gap-1 w-16">
                  {battery.available_nl ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">NL</span> : null}
                  {battery.available_fr ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">FR</span> : null}
                  {battery.available_us ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">US</span> : null}
                </div>
                <div className="w-24 text-right">
                  {price
                    ? <p className="text-sm font-medium text-gray-900">{currency}{price.toLocaleString()}</p>
                    : <p className="text-sm text-gray-400">—</p>}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
