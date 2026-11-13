// Fetches the most-read posts from Plausible and writes data/topposts.json,
// which layouts/index.html reads for the "Most Read Lately" box.
//
// Runs at build time (see netlify.toml). It never fails the build: if the key
// is missing or Plausible is unreachable, the previous data/topposts.json
// (the one committed to the repo) is left untouched and the site builds with that.
//
// Environment variables (set in Netlify > Site configuration > Environment variables):
//   PLAUSIBLE_API_KEY             required  Stats API key
//   PLAUSIBLE_SITE_ID             required  site domain as listed in Plausible
//   PLAUSIBLE_HOST                optional  default https://plausible.io
//   TOP_POSTS_DAYS                optional  rolling window, default 90
//   TOP_POSTS_MIN_VISITORS        optional  floor to be listed, default 3
//   PLAUSIBLE_EXCLUDE_CITY        optional  a city name, to leave your own visits out

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../data/topposts.json', import.meta.url));

const KEY = process.env.PLAUSIBLE_API_KEY;
const SITE = process.env.PLAUSIBLE_SITE_ID;
const HOST = (process.env.PLAUSIBLE_HOST || 'https://plausible.io').replace(/\/+$/, '');
const DAYS = Number(process.env.TOP_POSTS_DAYS) || 90;
const MIN_VISITORS = Number(process.env.TOP_POSTS_MIN_VISITORS) || 3;
const EXCLUDE_CITY = process.env.PLAUSIBLE_EXCLUDE_CITY || '';
const KEEP = 25; // more than the 3 shown, so the template can skip hero/notes/unknown paths

function skip(msg) {
  console.log(`[top-posts] ${msg} Keeping existing data/topposts.json.`);
  process.exit(0);
}

if (!KEY || !SITE) skip('PLAUSIBLE_API_KEY or PLAUSIBLE_SITE_ID not set.');

const iso = (d) => d.toISOString().slice(0, 10);
const end = new Date();
const start = new Date(end.getTime() - DAYS * 86400000);

const filters = [['contains', 'event:page', ['/posts/']]];
if (EXCLUDE_CITY) filters.push(['is_not', 'visit:city_name', [EXCLUDE_CITY]]);

const body = {
  site_id: SITE,
  metrics: ['visitors'],
  date_range: [iso(start), iso(end)],
  dimensions: ['event:page'],
  filters,
  order_by: [['visitors', 'desc']],
};

let data;
try {
  const res = await fetch(`${HOST}/api/v2/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) skip(`Plausible returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  data = await res.json();
} catch (err) {
  skip(`Request failed (${err.message}).`);
}

if (!Array.isArray(data?.results)) skip('Unexpected response shape.');

// Keep only real post URLs (/posts/<slug>/), merging any trailing-slash variants.
const counts = new Map();
for (const row of data.results) {
  let path = row.dimensions?.[0];
  const visitors = row.metrics?.[0];
  if (typeof path !== 'string' || typeof visitors !== 'number') continue;
  if (!path.endsWith('/')) path += '/';
  if (!/^\/posts\/[^/]+\/$/.test(path)) continue;
  counts.set(path, (counts.get(path) || 0) + visitors);
}

const posts = [...counts.entries()]
  .filter(([, v]) => v >= MIN_VISITORS)
  .sort((a, b) => b[1] - a[1])
  .slice(0, KEEP)
  .map(([path, visitors]) => ({ path, visitors }));

await writeFile(
  OUT,
  JSON.stringify({ generated: new Date().toISOString(), window_days: DAYS, posts }, null, 2) + '\n'
);
console.log(`[top-posts] Wrote ${posts.length} posts for the last ${DAYS} days.`);
