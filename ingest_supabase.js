// ingest_supabase.js
// ─────────────────────────────────────────────────────────────────────────────
// Ingesta MULTI-PAÍS desde ./out/master/*.json|csv (preferente) o ./out/prov_*/.
// • Dedup por product_id
// • País como TEXTO ("chile","mexico",...) — compatible con RLS
// • Inserta/actualiza providers sin chocar con UNIQUE(name,country)
// • Inserta/actualiza products SIN usar id externo del scraper (FK OK)
// • Hidrata providerName si viene "Proveedor" o vacío (desde URL o campo "provider")
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── ENV ──────────────────────────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY/ANON_KEY en .env');
  process.exit(1);
}

const DELETE_PRODUCTS_WITHOUT_COUNTRY = String(process.env.DELETE_PRODUCTS_WITHOUT_COUNTRY || '0') === '1';
const CLEAN_OUT_AFTER                 = String(process.env.CLEAN_OUT_AFTER || '0') === '1';

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Rutas ────────────────────────────────────────────────────────────────────
const OUT_DIR     = path.join(__dirname, 'out');
const MASTER_DIR  = path.join(OUT_DIR, 'master');

// ── Utils ────────────────────────────────────────────────────────────────────
const log   = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const _norm = (s) => String(s || '').trim().toLowerCase();
const uniq  = (arr) => Array.from(new Set(arr));

function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Canonicalizar URLs de proveedor: sin query/hash y sin slash final
function canonUrl(u) {
  try {
    if (!u) return null;
    const x = new URL(u);
    x.search = '';
    x.hash   = '';
    let s = x.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return u || null;
  }
}

// Intentar sacar el nombre del proveedor desde la URL:
// .../dashboard/provider/2924/meibocl?...
function guessProviderNameFromUrl(u) {
  try {
    if (!u) return null;
    const m = new URL(u).pathname.match(/\/provider\/\d+\/([^\/\?\#]+)/i);
    if (m && m[1]) return titleCase(m[1]);
    return null;
  } catch {
    return null;
  }
}

// ── CSV parser (simple, sin dependencias) ────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', inQuotes = false, row = [];
  const pushField = () => { row.push(field); field = ''; };
  const pushRow   = () => { rows.push(row); row = []; };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      } else { field += c; i++; continue; }
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { pushField(); i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { pushField(); pushRow(); i++; continue; }
      field += c; i++; continue;
    }
  }
  if (field.length || row.length) { pushField(); pushRow(); }

  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.length && r.some(x => String(x).trim() !== ''))
    .map(r => {
      const o = {};
      headers.forEach((h, idx) => { o[h] = r[idx] ?? ''; });
      return o;
    });
}

// ── Lectores master JSON/CSV ────────────────────────────────────────────────
function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(n => exts.some(e => n.toLowerCase().endsWith(e)))
    .map(n => path.join(dir, n))
    .sort();
}

function readJsonFile(fp) {
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.products)) return data.products;
    if (Array.isArray(data?.rows))     return data.rows;
    return [];
  } catch (e) {
    log(`⚠️  JSON inválido: ${fp} — ${e.message}`);
    return [];
  }
}

function readCsvFile(fp) {
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    return parseCSV(raw);
  } catch (e) {
    log(`⚠️  CSV inválido: ${fp} — ${e.message}`);
    return [];
  }
}

// ── Detección de país (TEXTO; sin default) ──────────────────────────────────
function hostOf(u) { try { return new URL(u).host.toLowerCase(); } catch { return ''; } }
function pathOf(u) { try { return new URL(u).pathname.toLowerCase(); } catch { return ''; } }

function iso2ToName(iso) {
  const m = {
    cl: 'chile', co: 'colombia', mx: 'mexico', pe: 'peru', ar: 'argentina',
    py: 'paraguay', ec: 'ecuador', pa: 'panama', gt: 'guatemala', es: 'espana',
    uy: 'uruguay', us: 'usa', ve: 'venezuela', bo: 'bolivia', cr: 'costa_rica',
    hn: 'honduras', ni: 'nicaragua', do: 'republica_dominicana', sv: 'el_salvador',
  };
  return m[String(iso||'').toLowerCase()] || null;
}

function detectCountryName({ image, href, providerUrl }) {
  const hosts = [hostOf(image), hostOf(href), hostOf(providerUrl)];
  if (hosts.some(h => h.endsWith('.cl'))) return 'chile';
  if (hosts.some(h => h.endsWith('.co'))) return 'colombia';
  if (hosts.some(h => h.endsWith('.mx'))) return 'mexico';
  if (hosts.some(h => h.endsWith('.pe'))) return 'peru';
  if (hosts.some(h => h.endsWith('.ar'))) return 'argentina';
  if (hosts.some(h => h.endsWith('.py'))) return 'paraguay';
  if (hosts.some(h => h.endsWith('.ec'))) return 'ecuador';
  if (hosts.some(h => h.endsWith('.pa'))) return 'panama';
  if (hosts.some(h => h.endsWith('.gt'))) return 'guatemala';
  if (hosts.some(h => h.endsWith('.es'))) return 'espana';

  const ps = [pathOf(image), pathOf(href), pathOf(providerUrl)];
  const has = (t) => ps.some(p => p.includes(`/${t}/`) || p.endsWith(`/${t}`) || p.startsWith(`/${t}/`));
  if (has('chile')) return 'chile';
  if (has('colombia')) return 'colombia';
  if (has('mexico') || has('mx')) return 'mexico';
  if (has('peru') || has('pe')) return 'peru';
  if (has('argentina') || has('ar')) return 'argentina';
  if (has('paraguay') || has('py')) return 'paraguay';
  if (has('ecuador') || has('ec')) return 'ecuador';
  if (has('panama') || has('pa')) return 'panama';
  if (has('guatemala') || has('gt')) return 'guatemala';
  if (has('espana') || has('es') || has('spain')) return 'espana';

  return null;
}

function parseCLP(val) {
  if (val == null) return null;
  const n = String(val).replace(/[^\d]/g, '');
  return n ? Number(n) : null;
}

// ── Normalizador de filas ───────────────────────────────────────────────────
function normalizeRow(row, meta = {}) {
  const providerUrl = row.providerUrl || row.provider_url || meta.providerUrl || '';
  let providerName =
    row.providerName ||
    row.provider_name ||
    row.provider ||                      // <- a veces viene así
    meta.providerName ||
    guessProviderNameFromUrl(providerUrl) ||
    '';

  if (!providerName || /^proveedor$/i.test(providerName)) {
    const guessed = guessProviderNameFromUrl(providerUrl);
    if (guessed) providerName = guessed;
  }
  providerName = providerName || 'Proveedor';

  const name     = row.name || '';
  const category = row.category || row.category_name || null;
  const stock    = row.stock != null ? Number(row.stock) : null;
  const image    = row.image || row.image_url || null;
  const href     = row.href  || null;
  const productId= row.productId ? Number(row.productId) : (row.product_id ? Number(row.product_id) : null);
  const priceProvider = parseCLP(row.priceProvider ?? row.price_provider);

  // país: si viene ISO2, traducir; si no, detectar; quedarnos con TEXTO
  let country = row.country || null;
  if (country && country.length <= 3) country = iso2ToName(country) || country.toLowerCase();
  if (!country) country = detectCountryName({ image, href, providerUrl }) || null;

  return {
    providerName,
    providerUrl,
    productId,
    name,
    category,
    stock,
    image,
    href,
    priceProvider,
    country
  };
}

// ── Resolver de tablas reales (FIJO a public) ────────────────────────────────
const TABLES = { providers: 'providers', products: 'products' };
async function resolveTables() { /* fijo */ return; }

// ── Limpieza opcional: productos sin país ────────────────────────────────────
async function cleanupNoCountry() {
  if (!DELETE_PRODUCTS_WITHOUT_COUNTRY) return;
  try {
    await resolveTables();
    const { error } = await supabase.from(TABLES.products).delete().is('country', null);
    if (error) log(`⚠️ Error al limpiar productos sin país: ${error.message}`);
    else log('✅ Limpieza de productos sin país realizada.');
  } catch (e) {
    log(`⚠️ Error al limpiar productos sin país: ${e.message}`);
  }
}

// ── Upsert providers SIN chocar contra UNIQUE(name,country) ──────────────────
async function upsertProviders(rows) {
  const candidates = [];
  const seenKey = new Set();
  for (const r of rows) {
    const name    = (r.providerName || 'Proveedor').trim();
    const country = r.country || null;
    const key = `${_norm(name)}|${_norm(country)}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    candidates.push({
      name,
      country,
      source_url: canonUrl(r.providerUrl) || null,
    });
  }
  if (!candidates.length) return;

  const names = uniq(candidates.map(c => c.name));
  const urls  = uniq(candidates.map(c => c.source_url).filter(Boolean));

  const existingByNameCountry = new Map();
  if (names.length) {
    const { data, error } = await supabase
      .from(TABLES.providers)
      .select('id,name,country,source_url')
      .in('name', names);
    if (error) throw error;
    (data || []).forEach(p => {
      existingByNameCountry.set(`${_norm(p.name)}|${_norm(p.country)}`, p);
    });
  }

  const existingByUrl = new Map();
  {
    const { data, error } = await supabase
      .from(TABLES.providers)
      .select('id,source_url');
    if (error) throw error;
    (data || []).forEach(p => {
      const cu = canonUrl(p.source_url);
      if (cu) existingByUrl.set(cu, p);
    });
  }

  const toInsert = [];
  const toUpdate = [];

  for (const c of candidates) {
    const key = `${_norm(c.name)}|${_norm(c.country)}`;
    const byNC  = existingByNameCountry.get(key);
    const byURL = c.source_url ? existingByUrl.get(c.source_url) : null;

    if (byNC) {
      const update = {};
      const cu = c.source_url;
      if (!byNC.source_url && cu) update.source_url = cu;
      if (Object.keys(update).length) toUpdate.push({ id: byNC.id, ...update });
    } else if (byURL) {
      const update = {};
      if (!byURL.name && c.name)      update.name = c.name;
      if (!byURL.country && c.country)update.country = c.country;
      if (Object.keys(update).length) toUpdate.push({ id: byURL.id, ...update });
    } else {
      toInsert.push({
        name: c.name,
        country: c.country,
        source_url: c.source_url || null,
      });
    }
  }

  if (toInsert.length) {
    const { error } = await supabase.from(TABLES.providers).insert(toInsert);
    if (error) throw error;
  }
  for (const u of toUpdate) {
    const { error } = await supabase.from(TABLES.providers).update(u).eq('id', u.id);
    if (error) throw error;
  }

  log('✅ Providers OK');
}

// ── Resolver provider_id para products (sin usar id externo) ────────────────
async function buildProviderResolver(rows) {
  const urls  = uniq(rows.map(r => canonUrl(r.providerUrl)).filter(Boolean));
  const names = uniq(rows.map(r => (r.providerName || '').trim()).filter(Boolean));

  const byUrl = new Map();
  const byNameCountry = new Map();

  const needName = names.length ? supabase
    .from(TABLES.providers)
    .select('id,name,country')
    .in('name', names)
  : Promise.resolve({ data: [] });

  const needUrl = supabase
    .from(TABLES.providers)
    .select('id,source_url');

  const [resName, resUrl] = await Promise.all([needName, needUrl]);

  (resUrl.data || []).forEach(p => {
    const cu = canonUrl(p.source_url);
    if (cu) byUrl.set(cu, p.id);
  });

  (resName.data || []).forEach(p => {
    byNameCountry.set(`${_norm(p.name)}|${_norm(p.country)}`, p.id);
  });

  return function resolve(row) {
    const cu = canonUrl(row.providerUrl);
    if (cu && byUrl.has(cu)) return byUrl.get(cu);

    const key = `${_norm(row.providerName)}|${_norm(row.country)}`;
    if (byNameCountry.has(key)) return byNameCountry.get(key);

    return null;
  };
}

// ── Upsert products (por product_id) ─────────────────────────────────────────
async function upsertProducts(rows) {
  const resolveProviderId = await buildProviderResolver(rows);

  const shape = [];
  let skippedNoProv = 0;

  for (const r of rows) {
    const provider_id = resolveProviderId(r);
    const product_id  = Number(r.productId);

    if (!product_id || !provider_id) { if (!provider_id) skippedNoProv++; continue; }

    shape.push({
      product_id,
      provider_id,
      name:            r.name,
      provider_name:   r.providerName || null,
      provider_url:    canonUrl(r.providerUrl) || null,
      category:        r.category || null,       // <- ajustado
      stock:           r.stock ?? null,
      image:           r.image || null,          // <- ajustado
      price_provider:  r.priceProvider ?? null,  // ya numérico con parseCLP
      href:            r.href || null,
      country:         r.country || null
    });
  }

  if (!shape.length) {
    log(`ℹ️ Products: nada que insertar (omitidos sin provider_id: ${skippedNoProv})`);
    return;
  }

  const BATCH = 700;
  for (let i = 0; i < shape.length; i += BATCH) {
    const chunk = shape.slice(i, i + BATCH);

    let { error } = await supabase
      .from(TABLES.products)
      .upsert(chunk, { onConflict: 'product_id', ignoreDuplicates: false });

    if (error && /no unique or exclusion constraint/i.test(error.message)) {
      const ids = chunk.map(r => r.product_id);
      const { data: exist, error: e2 } = await supabase
        .from(TABLES.products)
        .select('product_id')
        .in('product_id', ids);
      if (e2) throw e2;

      const have = new Set((exist || []).map(x => x.product_id));
      const toInsert = chunk.filter(r => !have.has(r.product_id));
      const toUpdate = chunk.filter(r =>  have.has(r.product_id));

      if (toInsert.length) {
        const { error: eIns } = await supabase.from(TABLES.products).insert(toInsert);
        if (eIns) throw eIns;
      }
      for (const row of toUpdate) {
        const { error: eUpd } = await supabase.from(TABLES.products).update(row).eq('product_id', row.product_id);
        if (eUpd) throw eUpd;
      }
      error = null;
    }

    if (error) throw error;
  }

  log(`✅ Products OK (omitidos sin provider_id: ${skippedNoProv})`);
}

// ── Lectura master (prefiere JSON; si no, CSV) ───────────────────────────────
function listMasterSources() {
  const jsonFiles = listFiles(MASTER_DIR, ['.json']);
  if (jsonFiles.length) return { files: jsonFiles, kind: 'json' };

  const csvFiles = listFiles(MASTER_DIR, ['.csv']);
  if (csvFiles.length) return { files: csvFiles, kind: 'csv' };

  // Fallback: buscar prov_*/products.json|csv
  const provDirs = fs.existsSync(OUT_DIR)
    ? fs.readdirSync(OUT_DIR).filter(n => n.startsWith('prov_')).map(n => path.join(OUT_DIR, n))
    : [];

  const files = [];
  for (const d of provDirs) {
    const pj = path.join(d, 'products.json');
    const pc = path.join(d, 'products.csv');
    if (fs.existsSync(pj)) files.push(pj);
    else if (fs.existsSync(pc)) files.push(pc);
  }

  if (!files.length) return { files: [], kind: 'none' };
  const kind = files[0].endsWith('.json') ? 'json' : 'csv';
  return { files, kind };
}

function normalizeMany(rows, meta) {
  return rows.map(r => normalizeRow(r, meta)).filter(r => r.productId && r.name);
}

// ── Limpieza de out/prov_* al terminar (opcional) ────────────────────────────
function cleanOutProv() {
  if (!CLEAN_OUT_AFTER) return;
  if (!fs.existsSync(OUT_DIR)) return;
  const dirs = fs.readdirSync(OUT_DIR).filter(n => n.startsWith('prov_'));
  for (const d of dirs) {
    const full = path.join(OUT_DIR, d);
    try { fs.rmSync(full, { recursive: true, force: true }); } catch {}
  }
  log('🧹 out/prov_* eliminado.');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('🚀 Iniciando ingesta…');

  if (DELETE_PRODUCTS_WITHOUT_COUNTRY) {
    log('🧹 Eliminando productos sin país...');
    await cleanupNoCountry();
  }

  log('🔎 Directorios escaneados:');
  log(` - ${MASTER_DIR}`);
  log(` - ${OUT_DIR}`);

  const { files, kind } = listMasterSources();
  log(`📁 Archivos detectados: ${files.length}`);
  if (!files.length) {
    console.error(`❌ No se encontraron fuentes en ${MASTER_DIR} ni ${OUT_DIR}/prov_*`);
    process.exit(1);
  }

  await resolveTables();

  // Leer todo y normalizar
  let all = [];
  for (const fp of files) {
    const base = path.basename(fp);
    let meta = {};
    if (/prov_(\d+)_([^_]+)/i.test(fp)) {
      const m = base.match(/prov_(\d+)_([^_]+)/i) || path.dirname(fp).match(/prov_(\d+)_([^_]+)/i);
      if (m) meta = { providerName: titleCase(m[2].replace(/-/g, ' ')) };
    }

    let rows = [];
    if (kind === 'json') rows = readJsonFile(fp);
    else if (kind === 'csv') rows = readCsvFile(fp);

    const norm = normalizeMany(rows, meta);
    all = all.concat(norm);
  }

  if (!all.length) {
    console.error('❌ No hay filas válidas después de normalizar.');
    process.exit(1);
  }

  // Dedup por productId (última gana)
  const map = new Map();
  for (const r of all) map.set(r.productId, r);
  const uniqueRows = Array.from(map.values());

  log(`📦 Filas totales listas para upsert: ${uniqueRows.length}`);

  // Conteo por país (diagnóstico)
  const byCountry = uniqueRows.reduce((acc, r) => {
    const k = r.country || 'NULL';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  log(`🌎 Conteo por país: ${JSON.stringify(byCountry)}`);

  // Upserts
  await upsertProviders(uniqueRows);
  await upsertProducts(uniqueRows);

  cleanOutProv();

  log('✅ Ingesta finalizada.');
}

main().catch(e => {
  console.error(`❌ Falla general: ${e.message || e}`);
  process.exit(1);
});
