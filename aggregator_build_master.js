// aggregator_build_master.js
// Une todos los out/prov_* / products.json en un master único (JSON + CSV)
// Mantiene columnas compatibles con tu tabla actual (provider_name, category_name, image_url…)

import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'out');
const MASTER_DIR = path.join(process.cwd(), 'out', 'master');

const nowIso = () => new Date().toISOString().replace(/[:.]/g, '-');

function readAllProductJsons() {
  if (!fs.existsSync(OUT_DIR)) return [];
  const dirs = fs.readdirSync(OUT_DIR).filter(d => d.startsWith('prov_'));
  const files = [];
  for (const d of dirs) {
    const p = path.join(OUT_DIR, d, 'products.json');
    if (fs.existsSync(p)) files.push(p);
  }
  return files;
}

function normalize(p, meta) {
  return {
    // Compatibles con tu tabla actual (según tu captura)
    provider_id: meta?.providerId ?? null,
    provider_name: meta?.providerName ?? null,
    name: p?.name ?? null,
    category_name: p?.category ?? null,
    category_id: p?.categoryId ?? null,          // si no tienes, quedará null
    price_provider: p?.priceProvider ?? null,
    price_suggested: p?.priceSuggested ?? null,
    stock: (p?.stock ?? null),
    image_url: p?.image ?? null,
    href: p?.href ?? null,
    // extras útiles por si quieres usarlos luego
    product_id: p?.productId ?? null,
    provider_url: meta?.providerUrl ?? null,
    scraped_at: new Date().toISOString(),
  };
}

function toCsv(rows) {
  const cols = [
    'provider_id','provider_name','name','category_name','category_id',
    'price_provider','price_suggested','stock','image_url','href',
    'product_id','provider_url','scraped_at'
  ];
  const esc = (v) => v == null ? '' : /[",\n]/.test(String(v))
    ? `"${String(v).replace(/"/g, '""')}"`
    : String(v);
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map(c => esc(r[c])).join(','));
  return lines.join('\n');
}

(function main(){
  const files = readAllProductJsons();
  if (files.length === 0) {
    console.log('⚠️  No se encontraron out/prov_*/products.json');
    process.exit(0);
  }

  const master = [];
  const seen = new Set();

  for (const f of files) {
    const { meta, products } = JSON.parse(fs.readFileSync(f,'utf8'));
    if (!meta || !Array.isArray(products)) continue;
    for (const p of products) {
      const row = normalize(p, meta);
      // clave de deduplicación conservadora
      const key = `${row.provider_id}|${row.product_id||''}|${row.name||''}|${row.href||''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      master.push(row);
    }
  }

  fs.mkdirSync(MASTER_DIR, { recursive: true });
  const stamp = nowIso();
  const jsonPath = path.join(MASTER_DIR, `master_${stamp}.json`);
  const csvPath  = path.join(MASTER_DIR, `master_${stamp}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify({ count: master.length, rows: master }, null, 2), 'utf8');
  fs.writeFileSync(csvPath, toCsv(master), 'utf8');

  console.log(`✅ Master creado (${master.length} filas)\n- ${jsonPath}\n- ${csvPath}`);
})();
