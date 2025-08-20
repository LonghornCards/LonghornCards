// scripts/fetch_zyla_prizm_silver_psa9.js
/**
 * Pulls historical prices for "Panini Prizm — Silver Prizm — PSA 9"
 * for all key players in src-assets-Key_Players.xlsx (or src/assets/Key_Players.xlsx).
 *
 * Flow:
 *  - Login with email/password → bearer token
 *  - For each player:
 *      - Search via ZYLA_SEARCH_ENDPOINT (player + filters)
 *      - Pick the best card identifier
 *      - Fetch full history via ZYLA_HIST_ENDPOINT
 *  - Save outputs:
 *      - /public/data/zyla_prizm_silver_psa9_history.json
 *      - /public/data/zyla_prizm_silver_psa9_history.csv
 *
 * Run:
 *   node scripts/fetch_zyla_prizm_silver_psa9.js
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import XLSX from 'xlsx';
import pLimit from 'p-limit';
import dayjs from 'dayjs';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'data');
const OUT_JSON = path.join(OUT_DIR, 'zyla_prizm_silver_psa9_history.json');
const OUT_CSV  = path.join(OUT_DIR, 'zyla_prizm_silver_psa9_history.csv');

// -------- ENV --------
const {
  ZYLA_EMAIL,
  ZYLA_PASSWORD,
  ZYLA_API_KEY,
  ZYLA_BASE_URL,
  ZYLA_SEARCH_ENDPOINT,
  ZYLA_HIST_ENDPOINT,
} = process.env;

if (!ZYLA_EMAIL || !ZYLA_PASSWORD || !ZYLA_BASE_URL || !ZYLA_SEARCH_ENDPOINT || !ZYLA_HIST_ENDPOINT) {
  console.error('❌ Missing one or more required env vars: ZYLA_EMAIL, ZYLA_PASSWORD, ZYLA_BASE_URL, ZYLA_SEARCH_ENDPOINT, ZYLA_HIST_ENDPOINT');
  process.exit(1);
}

const PRODUCT_LINE = 'Panini Prizm';
const PARALLEL = 'Silver Prizm';
const GRADE = 'PSA 9';
const MIN_YEAR = 2012; // only consider 2012+ cards

// Where to look for the Key Players xlsx
const POSSIBLE_KEY_FILES = [
  path.join(ROOT, 'src-assets-Key_Players.xlsx'),
  path.join(ROOT, 'src', 'assets', 'Key_Players.xlsx'),
];

// ---------- Helpers ----------
function findKeyPlayersFile() {
  for (const p of POSSIBLE_KEY_FILES) if (fs.existsSync(p)) return p;
  console.error(`❌ Could not find Key Players file. Tried:\n${POSSIBLE_KEY_FILES.join('\n')}`);
  process.exit(1);
}

function readPlayers(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const names = [];
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i][0];
    if (!cell || typeof cell !== 'string') continue;
    const val = cell.trim();
    if (!val || /^player\s*name/i.test(val)) continue; // skip header
    names.push(val);
  }
  if (!names.length) {
    console.error('❌ No player names found in the first column.');
    process.exit(1);
  }
  return names;
}

function normalizeStr(s) {
  return (s || '').toString().toLowerCase().trim();
}

// Choose the “best” search result (favor exact player match, product line, parallel, grade, and 2012+)
function selectBestCard(results, playerName) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const pNorm = normalizeStr(playerName);

  // Scoring function
  function score(card) {
    const fields = {
      player: normalizeStr(card.player || card.player_name),
      product: normalizeStr(card.product || card.product_line || card.set_name),
      parallel: normalizeStr(card.parallel || card.variant || card.parallel_name),
      grade: normalizeStr(card.grade || card.grading || card.grade_label),
      year: Number(card.year || card.set_year || card.release_year || 0)
    };

    let s = 0;
    if (fields.player === pNorm) s += 5;
    else if (fields.player && pNorm && fields.player.includes(pNorm)) s += 3;

    if (fields.product === normalizeStr(PRODUCT_LINE)) s += 4;
    else if (fields.product.includes('panini') && fields.product.includes('prizm')) s += 2;

    if (fields.parallel === normalizeStr(PARALLEL)) s += 4;
    else if (fields.parallel.includes('silver')) s += 2;

    if (fields.grade === normalizeStr(GRADE)) s += 4;
    else if (fields.grade.includes('psa')) s += 1;

    if (fields.year >= MIN_YEAR) s += 2;
    return s;
  }

  // Filter to plausible matches and pick highest score
  const filtered = results.filter((c) => {
    const year = Number(c.year || c.set_year || c.release_year || 0);
    return !Number.isNaN(year) ? year >= 2012 : true;
  });

  const pool = filtered.length ? filtered : results;
  let best = null;
  let bestScore = -Infinity;
  for (const c of pool) {
    const sc = score(c);
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return best;
}

// ---------- HTTP (login + retry) ----------
const http = axios.create({
  baseURL: ZYLA_BASE_URL,
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(ZYLA_API_KEY ? { 'X-API-Key': ZYLA_API_KEY } : {}),
  },
});

let bearerToken = null;
let tokenExpiresAt = 0; // epoch ms

async function login() {
  // Common patterns: /auth/login returning { token, expires_in } or { access_token }
  const loginPath = process.env.ZYLA_LOGIN_ENDPOINT || '/v1/auth/login';
  const url = loginPath.startsWith('/') ? loginPath : `/${loginPath}`;

  const res = await http.post(url, {
    email: ZYLA_EMAIL,
    password: ZYLA_PASSWORD,
  });

  const token = res.data?.token || res.data?.access_token;
  if (!token) throw new Error('Login succeeded but no token found in response');

  bearerToken = token;

  const now = Date.now();
  const ttlSec =
    Number(res.data?.expires_in) || Number(res.data?.expires) || 20 * 60; // default 20m
  tokenExpiresAt = now + ttlSec * 1000;

  console.log('🔑 Logged in. Token expires in ~', Math.round(ttlSec / 60), 'min');
}

async function ensureAuth() {
  const aboutToExpire = Date.now() > tokenExpiresAt - 60_000; // refresh if < 60s left
  if (!bearerToken || aboutToExpire) {
    await login();
  }
}

async function withAuth(requestFn) {
  await ensureAuth();

  try {
    return await requestFn();
  } catch (err) {
    const status = err?.response?.status;
    // Retry once on 401 by re-login
    if (status === 401) {
      console.warn('🔁 401 received—refreshing token and retrying...');
      await login();
      return await requestFn();
    }
    throw err;
  }
}

// ---------- Zyla API calls ----------
async function searchCards(playerName) {
  // We try GET with params first. If API expects POST body, we fall back.
  const params = {
    player: playerName,
    product_line: PRODUCT_LINE,
    parallel: PARALLEL,
    grade: GRADE,
    // Some APIs also accept: query, set_year_from, set_year_to, sport, manufacturer, etc.
    set_year_from: MIN_YEAR,
  };

  const path = ZYLA_SEARCH_ENDPOINT.startsWith('/')
    ? ZYLA_SEARCH_ENDPOINT
    : `/${ZYLA_SEARCH_ENDPOINT}`;

  const doGet = () => http.get(path, {
    headers: {
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
    params,
  });

  try {
    const res = await withAuth(doGet);
    const list = Array.isArray(res.data?.results)
      ? res.data.results
      : Array.isArray(res.data)
      ? res.data
      : [];
    return list;
  } catch (e) {
    // Try POST fallback (some APIs are POST /search with a JSON body)
    const doPost = () => http.post(path, params, {
      headers: {
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
    });
    const res = await withAuth(doPost);
    const list = Array.isArray(res.data?.results)
      ? res.data.results
      : Array.isArray(res.data)
      ? res.data
      : [];
    return list;
  }
}

async function fetchHistoryById(cardId) {
  if (!cardId) return [];

  const path = ZYLA_HIST_ENDPOINT.startsWith('/')
    ? ZYLA_HIST_ENDPOINT
    : `/${ZYLA_HIST_ENDPOINT}`;

  // Common patterns:
  // - GET /cards/{id}/history
  // - GET /history?card_id=
  // - POST /history with { card_id }
  const maybeGetUrl = path.replace('{id}', encodeURIComponent(cardId));
  const urlHasIdPlaceholder = path.includes('{id}');

  const doGet = () =>
    http.get(urlHasIdPlaceholder ? maybeGetUrl : path, {
      headers: {
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      params: urlHasIdPlaceholder ? {} : { card_id: cardId },
    });

  try {
    const res = await withAuth(doGet);
    const arr = Array.isArray(res.data?.history)
      ? res.data.history
      : Array.isArray(res.data)
      ? res.data
      : [];
    return arr;
  } catch (e) {
    // POST fallback
    const doPost = () =>
      http.post(
        path,
        { card_id: cardId },
        {
          headers: {
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          },
        }
      );
    const res = await withAuth(doPost);
    const arr = Array.isArray(res.data?.history)
      ? res.data.history
      : Array.isArray(res.data)
      ? res.data
      : [];
    return arr;
  }
}

// ---------- Main ----------
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const keyFile = findKeyPlayersFile();
  const players = readPlayers(keyFile);
  console.log(`🔎 Players: ${players.length}`);
  console.log(`   Looking for: ${PRODUCT_LINE} — ${PARALLEL} — ${GRADE} (>= ${MIN_YEAR})`);

  const limit = pLimit(4); // be kind to the API
  const tasks = players.map((playerName) =>
    limit(async () => {
      try {
        const searchResults = await searchCards(playerName);
        if (!searchResults.length) {
          console.warn(`⚠️  No search results for ${playerName}`);
          return [];
        }
        const best = selectBestCard(searchResults, playerName);
        if (!best) {
          console.warn(`⚠️  No suitable card found for ${playerName}`);
          return [];
        }

        // Possible id keys: id, card_id, identifier, slug, uuid
        const cardId =
          best.id ||
          best.card_id ||
          best.identifier ||
          best.uuid ||
          best.slug;

        if (!cardId) {
          console.warn(`⚠️  Missing identifier for ${playerName} result; skipping`);
          return [];
        }

        const hist = await fetchHistoryById(cardId);

        // Normalize records
        const normalized = hist
          .map((h) => ({
            player: playerName,
            product_line: PRODUCT_LINE,
            parallel: PARALLEL,
            grade: GRADE,
            card_id: cardId,
            date:
              h.date ||
              h.observed_at ||
              h.timestamp ||
              h.sale_date ||
              null,
            price: h.price ?? h.avg ?? h.close ?? h.amount ?? null,
            low: h.low ?? null,
            high: h.high ?? null,
            volume: h.volume ?? h.sales ?? null,
            source: h.source ?? h.marketplace ?? null,
            set_year: h.set_year ?? best.set_year ?? best.year ?? null,
            card_number: h.card_number ?? best.card_number ?? best.no ?? null,
            transaction_count: h.transaction_count ?? null,
          }))
          .filter((r) => r.date && r.price != null)
          .sort((a, b) => (a.date < b.date ? -1 : 1));

        console.log(
          `   • ${playerName}: ${normalized.length} rows${
            normalized.length ? ` (${normalized[0].date} → ${normalized[normalized.length - 1].date})` : ''
          }`
        );
        return normalized;
      } catch (err) {
        console.warn(`⚠️  Failed ${playerName}:`, err?.response?.status, err?.message);
        return [];
      }
    })
  );

  const results = await Promise.all(tasks);
  const flat = results.flat();

  // Write JSON
  fs.writeFileSync(OUT_JSON, JSON.stringify(flat, null, 2));
  console.log(`💾 Wrote JSON → ${OUT_JSON}`);

  // Write CSV
  const csvWriter = createCsvWriter({
    path: OUT_CSV,
    header: [
      { id: 'player', title: 'Player' },
      { id: 'product_line', title: 'Product Line' },
      { id: 'parallel', title: 'Parallel' },
      { id: 'grade', title: 'Grade' },
      { id: 'card_id', title: 'Card ID' },
      { id: 'date', title: 'Date' },
      { id: 'price', title: 'Price' },
      { id: 'low', title: 'Low' },
      { id: 'high', title: 'High' },
      { id: 'volume', title: 'Volume' },
      { id: 'transaction_count', title: 'Transaction Count' },
      { id: 'source', title: 'Source' },
      { id: 'set_year', title: 'Set Year' },
      { id: 'card_number', title: 'Card Number' },
    ],
  });
  await csvWriter.writeRecords(flat);
  console.log(`💾 Wrote CSV  → ${OUT_CSV}`);

  // Summary
  const byPlayer = flat.reduce((m, r) => {
    m[r.player] = (m[r.player] || 0) + 1;
    return m;
  }, {});
  const playersWithData = Object.keys(byPlayer).length;
  console.log(`✅ Done. ${playersWithData}/${players.length} players returned data. Total rows: ${flat.length}`);
}

main().catch((e) => {
  console.error('❌ Unhandled error:', e?.response?.data || e.message);
  process.exit(1);
});
