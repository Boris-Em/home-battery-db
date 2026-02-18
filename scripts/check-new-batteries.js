import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import RSSParser from 'rss-parser';
import Anthropic from '@anthropic-ai/sdk';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is not set.');
  console.error('Set it with: export ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

const feeds = JSON.parse(fs.readFileSync(join(DATA_DIR, 'rss-feeds.json'), 'utf-8'));
const client = new Anthropic();

// ---------------------------------------------------------------------------
// Cutoff date
// ---------------------------------------------------------------------------

function getCutoffDate() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^new-batteries-\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();

  if (files.length > 0) {
    const dateStr = files[0].match(/(\d{4}-\d{2}-\d{2})/)[1];
    const cutoff = new Date(dateStr + 'T00:00:00Z');
    console.log(`Cutoff: ${dateStr} (from last run)`);
    return cutoff;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  console.log(`Cutoff: ${cutoff.toISOString().split('T')[0]} (first run — defaulting to 7 days ago)`);
  return cutoff;
}

// ---------------------------------------------------------------------------
// RSS fetching
// ---------------------------------------------------------------------------

const KEYWORDS = [
  'battery', 'batteries', 'ESS', 'energy storage', 'powerwall',
  'sonnen', 'enphase', 'BYD', 'LG RESU', 'home storage', 'solar storage',
  'BESS', 'stationary storage', 'residential storage', 'home battery',
];

function isRelevant(item) {
  const text = `${item.title ?? ''} ${item.contentSnippet ?? item.summary ?? ''}`.toLowerCase();
  return KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
}

async function fetchFeeds(cutoffDate) {
  const parser = new RSSParser();
  const results = [];

  await Promise.all(feeds.map(async (feed) => {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = parsed.items
        .filter(item => {
          const pub = item.pubDate ? new Date(item.pubDate) : null;
          return pub && pub > cutoffDate;
        })
        .filter(isRelevant)
        .map(item => ({
          title: item.title,
          description: (item.contentSnippet ?? item.summary ?? '').slice(0, 400),
          link: item.link,
          pubDate: item.pubDate,
          source: feed.name,
        }));
      results.push(...items);
      console.log(`  ${feed.name}: ${items.length} relevant item(s)`);
    } catch (err) {
      console.warn(`  Warning: Failed to fetch ${feed.name}: ${err.message}`);
    }
  }));

  return results;
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

function extractJsonArray(text) {
  const stripped = text.replace(/```(?:json)?\n?([\s\S]*?)```/g, '$1').trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Agent 1: identify new product announcements
// ---------------------------------------------------------------------------

async function identifyAnnouncements(items) {
  const articleList = items.map((item, i) =>
    `[${i + 1}] Title: ${item.title}
Source: ${item.source} | Date: ${item.pubDate}
URL: ${item.link}
Summary: ${item.description}`
  ).join('\n\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are reviewing article headlines and summaries from clean energy news sites.

Identify which of the following articles announce the LAUNCH or RELEASE of a new residential home battery product. A qualifying article must describe a specific new product being brought to market.

Do NOT include:
- Articles about existing products (reviews, comparisons, installations)
- Price changes, firmware updates, or accessories
- EV batteries or utility-scale / grid storage
- Vague mentions without a specific named product

For each qualifying article return a JSON object with:
- brand: manufacturer name
- model: product model name
- key_specs: array of specs mentioned (e.g. ["13.5 kWh", "LFP", "whole-home backup"])
- article_url: the article URL
- pub_date: publication date

Return ONLY a valid JSON array. If no articles qualify, return [].

Articles:
${articleList}`,
    }],
  });

  return extractJsonArray(response.content[0].text);
}

// ---------------------------------------------------------------------------
// Agent 2: cross-check against database
// ---------------------------------------------------------------------------

async function crossCheck(announced, dbBatteries) {
  const dbList = dbBatteries
    .map(b => `- ${b.brand_slug} / ${b.model} (slug: ${b.slug})`)
    .join('\n');

  const candidateList = announced
    .map((b, i) => `[${i + 1}] ${b.brand} ${b.model}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are comparing newly announced batteries against an existing database to find ones we don't track yet.

EXISTING DATABASE (${dbBatteries.length} batteries):
${dbList}

NEWLY ANNOUNCED (to check):
${candidateList}

For each newly announced battery, check if it is already in the database. Account for name variations (e.g. "Powerwall 3" matches "tesla-powerwall-3", "IQ Battery 5P" matches "enphase-iq-battery-5p").

Return a JSON array of ONLY the batteries NOT already in the database. Each object must have:
- brand: manufacturer name
- model: product model name
- key_specs: specs mentioned
- article_url: source URL
- pub_date: publication date
- reason_new: one sentence explaining why this is not in the database

Return ONLY a valid JSON array. If all are already tracked, return [].`,
    }],
  });

  const confirmed = extractJsonArray(response.content[0].text);

  // Merge article_url and key_specs back from announced if agent omitted them
  return confirmed.map(c => {
    const original = announced.find(a =>
      a.model?.toLowerCase().includes(c.model?.toLowerCase()) ||
      c.model?.toLowerCase().includes(a.model?.toLowerCase())
    );
    return { ...original, ...c };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const outputPath = join(DATA_DIR, `new-batteries-${today}.md`);

  const cutoffDate = getCutoffDate();

  console.log('\nFetching RSS feeds...');
  const items = await fetchFeeds(cutoffDate);
  console.log(`\nTotal: ${items.length} relevant article(s) since cutoff`);

  if (items.length === 0) {
    fs.writeFileSync(outputPath,
      `# New Batteries to Review — ${today}\n\nNothing relevant found since ${cutoffDate.toISOString().split('T')[0]}.\n`
    );
    console.log('Done.');
    return;
  }

  console.log('\nAgent 1: Scanning for new product announcements...');
  const announced = await identifyAnnouncements(items);
  console.log(`Agent 1: ${announced.length} potential new product(s) found`);

  if (announced.length === 0) {
    fs.writeFileSync(outputPath,
      `# New Batteries to Review — ${today}\n\nNo new product announcements in ${items.length} relevant article(s).\n`
    );
    console.log('Done.');
    return;
  }

  console.log('\nQuerying database...');
  const db = new Database(join(DATA_DIR, 'batteries.db'), { readonly: true });
  const dbBatteries = db.prepare('SELECT brand_slug, model, slug FROM batteries').all();
  db.close();
  console.log(`Database: ${dbBatteries.length} battery(ies) tracked`);

  console.log('\nAgent 2: Cross-checking against database...');
  const confirmed = await crossCheck(announced, dbBatteries);
  console.log(`Agent 2: ${confirmed.length} new battery(ies) confirmed`);

  let md = `# New Batteries to Review — ${today}\n\n`;

  if (confirmed.length === 0) {
    md += `All ${announced.length} announced battery(ies) are already tracked in the database.\n`;
  } else {
    md += `Found **${confirmed.length}** new battery(ies) not in the database.\n`;
    md += `After researching, add to \`data/batteries_seed.csv\` and run \`npm run db:seed\`.\n\n---\n\n`;
    confirmed.forEach((b, i) => {
      md += `## ${i + 1}. ${b.brand} ${b.model}\n\n`;
      md += `- **Source:** ${b.article_url}\n`;
      md += `- **Published:** ${b.pub_date}\n`;
      if (b.key_specs?.length) {
        const specs = Array.isArray(b.key_specs) ? b.key_specs.join(', ') : b.key_specs;
        md += `- **Specs mentioned:** ${specs}\n`;
      }
      md += `- **Notes:** ${b.reason_new}\n`;
      md += `\n---\n\n`;
    });
  }

  fs.writeFileSync(outputPath, md);
  console.log(`\nOutput: data/new-batteries-${today}.md`);
  console.log(`\nSummary: ${feeds.length} feeds, ${items.length} relevant articles, ${announced.length} announcements, ${confirmed.length} new to database`);
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});