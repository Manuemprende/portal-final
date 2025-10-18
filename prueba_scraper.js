// ingest_supabase.js
// ─────────────────────────────────────────────────────────────────────────────
// Ingesta MULTI-NIVEL desde ./out/master/*.json (preferente) o *.csv (fallback)
// • Lee master consolidado (NO usa glob, sin libs extra)
// • Detecta país por URL/host (sin default a CL)
// • Detecta tablas reales (providers/products, dropi.* o api_*)
// • Upsert robusto (fallback insert/update si no hay UNIQUE)
// • Resuelve provider_id por (id | source_url | name+country)
// • Opcional: borra productos sin país y limpia out/prov_* al final
// • (Nuevo) Hidrata provider_name de products con el nombre real del provider
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
// NO ponemos DEFAULT_COUNTRY para evitar forzar CL.

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Rutas ────────────────────────────────────────────────────────────────────
const OUT_DIR     = path.join(__dirname, 'out');
const MASTER_DIR  = path.join(OUT_DIR, 'master');

// ── Utils ────────────────────────────────────────────────────────────────────
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const _norm = (s) => String(s || '').trim().toLowerCase();
const uniq = (arr) => Array.from(new Set(arr));

function isPlaceholderProviderName(name) {
  const n = _norm(name);
  return !n || n === 'proveedor' || n === 'provider';
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
      } else {
        field += c; i++; continue;
      }
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { pushField(); i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { pushField(); pushRow(); i++; continue; }
      field += c; i++; continue;
    }
  }
  // último campo/fila
  if (field.length || row.length) { pushField(); pushRow(); }

  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.length && r.some(x => String(x).trim() !== '')).map(r => {
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

// ── Detección de país (sin default) ─────────────────────────────────────────
function hostOf(u) {
  try { return new URL(u).host.toLowerCase(); } catch { return ''; }
}
function pathOf(u) {
  try { return new URL(u).pathname.toLowerCase(); } catch { return ''; }
}

function detectCountryISO2({ image, href, providerUrl }) {
  const s = `${image || ''} ${href || ''} ${providerUrl || ''}`.toLowerCase();

  // 1) TLD del host
  const hosts = [hostOf(image), hostOf(href), hostOf(providerUrl)];
  if (hosts.some(h => h.endsWith('.cl'))) return 'CL';
  if (hosts.some(h => h.endsWith('.co'))) return 'CO';
  if (hosts.some(h => h.endsWith('.mx'))) return 'MX';
  if (hosts.some(h => h.endsWith('.pe'))) return 'PE';
  if (hosts.some(h => h.endsWith('.ar'))) return 'AR';
  if (hosts.some(h => h.endsWith('.py'))) return 'PY';
  if (hosts.some(h => h.endsWith('.ec'))) return 'EC';
  if (hosts.some(h => h.endsWith('.pa'))) return 'PA';
  if (hosts.some(h => h.endsWith('.gt'))) return 'GT';
  if (hosts.some(h => h.endsWith('.es'))) return 'ES';

  // 2) Segmentos en path
  const ps = [pathOf(image), pathOf(href), pathOf(providerUrl)];
  const has = (t) => ps.some(p => p.includes(`/${t}/`) || p.endsWith(`/${t}`) || p.startsWith(`/${t}/`));

  if (has('chile') || /chileproducts/.test(s))     return 'CL';
  if (has('colombia') || /colombiaproducts/.test(s)) return 'CO';
  if (has('mexico') || has('mx') || /mexicoproducts/.test(s)) return 'MX';
  if (has('peru')   || has('pe') || /peruproducts/.test(s))   return 'PE';
  if (has('argentina') || has('ar')) return 'AR';
  if (has('paraguay')  || has('py')) return 'PY';
  if (has('ecuador')   || has('ec')) return 'EC';
  if (has('panama')    || has('pa')) return 'PA';
  if (has('guatemala') || has('gt')) return 'GT';
  if (has('espana') || has('es') || has('spain'))   return 'ES';

  // 3) patrones genéricos
  if (/\.cl\//.test(s)) return 'CL';
  if (/\.co\//.test(s)) return 'CO';
  if (/\.mx\//.test(s)) return 'MX';
  if (/\.pe\//.test(s)) return 'PE';
  if (/\.ar\//.test(s)) return 'AR';
  if (/\.py\//.test(s)) return 'PY';
  if (/\.ec\//.test(s)) return 'EC';
  if (/\.pa\//.test(s)) return 'PA';
  if (/\.gt\//.test(s)) return 'GT';
  if (/\.es\//.test(s)) return 'ES';

  // Sin señal → null (no forzamos CL)
  return null;
}

function parseCLP(val) {
  if (val == null) return null;
  const n = String(val).replace(/[^\d]/g, '');
  return n ? Number(n) : null;
}

// ── Normalizador de filas ───────────────────────────────────────────────────
function normalizeRow(row, meta = {}) {
  const providerName = row.providerName || row.provider_name || meta.providerName || '';
  const providerId   = row.providerId   || row.provider_id   || meta.providerId   || null;
  const providerUrl  = row.providerUrl  || row.provider_url  || meta.providerUrl  || '';

  const name     = row.name || '';
  const category = row.category || row.category_name || null;
  const stock    = row.stock != null ? Number(row.stock) : null;
  const image    = row.image || row.image_url || null;
  const href     = row.href  || null;
  const productId= row.productId ? Number(row.productId) : (row.product_id ? Number(row.product_id) : null);

  const priceProvider = parseCLP(row.priceProvider ?? row.price_provider);

  const country =
    row.country ||
    detectCountryISO2({ image, href, providerUrl }) ||
    null;

  return {
    providerName, providerId, providerUrl,
    productId, name, category,
    stock, image, href,
    priceProvider,
    country
  };
}

// ── Resolver de tablas reales ────────────────────────────────────────────────
let TABLES = { providers: 'providers', products: 'products' };
const CANDIDATES = {
  providers: ['providers', 'dropi.providers', 'api_providers'],
  products : ['products' , 'dropi.products' , 'api_products' ],
};

async function pickFirstExistingTable(list) {
  for (const t of list) {
    const { error } = await supabase.from(t).select('*', { head: true, count: 'exact' }).limit(1);
    if (!error || !/does not exist|schema cache|relation .* does not exist/i.test(error.message)) {
      return t;
    }
  }
  return null;
}

async function resolveTables() {
  const prov = await pickFirstExistingTable(CANDIDATES.providers);
  const prod = await pickFirstExistingTable(CANDIDATES.products);
  if (!prov || !prod) {
    throw new Error(`No encuentro tablas. providers=${prov} products=${prod}`);
  }
  TABLES = { providers: prov, products: prod };
  log(`🗃 Tablas → providers=${prov} | products=${prod}`);
}

// ── Limpieza opcional: productos sin país ────────────────────────────────────
async function cleanupNoCountry() {
  if (!DELETE_PRODUCTS_WITHOUT_COUNTRY) return;
  try {
    await resolveTables();
    const { error } = await supabase.from(TABLES.products).delete().is('country', null);
    if (error) log(`⚠️ Error al limpiar productos sin país: ${error.message}`);
    else log(`✅ Limpieza de productos sin país realizada.`);
  } catch (e) {
    log(`⚠️ Error al limpiar productos sin país: ${e.message}`);
  }
}

// ── Construcción del resolver de provider_id ─────────────────────────────────
async function buildProviderResolver(rows) {
  const urls  = uniq(rows.map(r => (r.providerUrl || '').trim()).filter(Boolean));
  const names = uniq(rows.map(r => (r.providerName || '').trim()).filter(Boolean));

  const byUrl = new Map();
  const byNameCountry = new Map();

  if (urls.length) {
    const { data } = await supabase.from(TABLES.providers).select('id, source_url').in('source_url', urls);
    (data || []).forEach(p => { if (p.source_url) byUrl.set(p.source_url, p.id); });
  }
  if (names.length) {
    const { data } = await supabase.from(TABLES.providers).select('id, name, country').in('name', names);
    (data || []).forEach(p => byNameCountry.set(`${_norm(p.name)}|${_norm(p.country)}`, p.id));
  }

  return function resolve(row) {
    const pid = Number(row.providerId || row.provider_id);
    if (pid) return pid;

    const url = (row.providerUrl || '').trim();
    if (url && byUrl.has(url)) return byUrl.get(url);

    const key = `${_norm(row.providerName)}|${_norm(row.country)}`;
    if (byNameCountry.has(key)) return byNameCountry.get(key);

    return null;
  };
}

// ── Upsert providers (robusto) ───────────────────────────────────────────────
async function upsertProviders(rows) {
  const providers = [];
  const seen = new Set();
  for (const r of rows) {
    const key = `${r.providerId || ''}|${r.providerName}|${r.providerUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    providers.push({
      id: r.providerId || null,
      name: r.providerName || 'Proveedor',
      source_url: r.providerUrl || null,
      country: r.country || null
    });
  }
  if (!providers.length) return;

  const BATCH = 800;
  for (let i = 0; i < providers.length; i += BATCH) {
    const chunk = providers.slice(i, i + BATCH);

    // Intento: upsert por id
    let { error } = await supabase
      .from(TABLES.providers)
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });

    if (error && /no unique or exclusion constraint/i.test(error.message)) {
      // Fallback: insert/update manual
      const ids = chunk.map(r => r.id).filter(Boolean);
      const { data: exist, error: e2 } = await supabase
        .from(TABLES.providers)
        .select('id')
        .in('id', ids);
      if (e2) throw e2;

      const have = new Set((exist || []).map(x => x.id));
      const toInsert = chunk.filter(r => !r.id || !have.has(r.id));
      const toUpdate = chunk.filter(r => r.id && have.has(r.id));

      if (toInsert.length) {
        const { error: eIns } = await supabase.from(TABLES.providers).insert(toInsert);
        if (eIns) throw eIns;
      }
      for (const row of toUpdate) {
        const { error: eUpd } = await supabase.from(TABLES.providers).update(row).eq('id', row.id);
        if (eUpd) throw eUpd;
      }
      error = null;
    }

    if (error) throw error;
  }

  log('✅ Providers OK');
}

// ── Upsert products (con provider_id resuelto + nombre real del provider) ───
async function upsertProducts(rows) {
  const resolveProviderId = await buildProviderResolver(rows);

  // 1) Resolver provider_id para cada fila y filtrar válidas
  const enriched = [];
  let skippedNoProv = 0;

  for (const r of rows) {
    const provider_id = resolveProviderId(r);
    const product_id  = Number(r.productId);
    if (!product_id || !provider_id) { if (!provider_id) skippedNoProv++; continue; }
    enriched.push({ r, provider_id, product_id });
  }

  if (!enriched.length) {
    log(`ℹ️ Products: nada que insertar (omitidos sin provider_id: ${skippedNoProv})`);
    return;
  }

  // 2) Hidratar nombre real de provider desde la tabla providers (solo si r.providerName es placeholder)
  const providerIds = uniq(enriched.map(e => e.provider_id));
  const { data: provRows, error: provErr } = await supabase
    .from(TABLES.providers)
    .select('id,name')
    .in('id', providerIds);
  if (provErr) throw provErr;

  const providerNameById = new Map((provRows || []).map(p => [Number(p.id), p.name]));

  // 3) Armar shape final para products
  const shape = enriched.map(({ r, provider_id, product_id }) => {
    const rawName = r.providerName;
    const hydratedName =
      !isPlaceholderProviderName(rawName)
        ? rawName
        : (providerNameById.get(provider_id) || rawName || null);

    return {
      product_id,
      provider_id,
      name:            r.name,
      provider_name:   hydratedName,         // ← nombre real si existía en providers
      provider_url:    r.providerUrl  || null,
      category_name:   r.category     || null,
      stock:           r.stock ?? null,
      image_url:       r.image || null,
      price_provider:  r.priceProvider ?? null,
      href:            r.href || null,
      country:         r.country || null
    };
  });

  const BATCH = 700;
  for (let i = 0; i < shape.length; i += BATCH) {
    const chunk = shape.slice(i, i + BATCH);

    let { error } = await supabase
      .from(TABLES.products)
      .upsert(chunk, { onConflict: 'product_id', ignoreDuplicates: false });

    if (error && /no unique or exclusion constraint/i.test(error.message)) {
      // Fallback: insert/update manual
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
  return rows.map(r => normalizeRow(r, meta))
             .filter(r => r.productId && r.name);
}

// ── Limpieza de out/prov_* al terminar (opcional) ────────────────────────────
function cleanOutProv() {
  if (!CLEAN_OUT_AFTER) return;
  if (!fs.existsSync(OUT_DIR)) return;
  const dirs = fs.readdirSync(OUT_DIR).filter(n => n.startsWith('prov_'));
  for (const d of dirs) {
    const full = path.join(OUT_DIR, d);
    try {
      fs.rmSync(full, { recursive: true, force: true });
    } catch {}
  }
  log('🧹 out/prov_* eliminado.');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('🚀 Iniciando ingesta multi-nivel…');

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
      if (m) {
        meta = { providerId: Number(m[1]), providerName: m[2].replace(/-/g, ' ').toUpperCase() };
      }
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
