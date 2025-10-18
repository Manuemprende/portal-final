// sink_supabase.js
import { createClient } from '@supabase/supabase-js';

// Lee env
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE en el entorno.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

const BATCH_SIZE = 100;

/**
 * Upserta/obtiene el provider y devuelve { id, name, country, url }
 */
export async function upsertProvider(meta) {
  const payload = {
    provider_id: meta.providerId ?? null, // si lo tienes numérico
    name: meta.providerName ?? 'Proveedor',
    url: meta.providerUrl ?? null,
    country: meta.country ?? null,          // opcional si lo anexas
    last_seen_at: new Date().toISOString(),
  };

  // upsert por (provider_id) o (name,url) si no hay id estable
  const { data, error } = await supabase
    .from('dropi.providers')
    .upsert(payload, { onConflict: 'provider_id', ignoreDuplicates: false })
    .select('*')
    .limit(1);

  if (error) throw error;
  return data?.[0];
}

/**
 * Upserta productos en lotes
 * products: array con tus objetos del scraper (ya traen: name, productId/href, priceProvider, priceSuggested, stock, image, category, providerName, etc.)
 */
export async function upsertProducts(providerRow, products = []) {
  if (!products.length) return { inserted: 0, updated: 0 };

  // Normaliza/asegura campos mínimos
  const norm = (p) => {
    // intenta deducir product_id desde href o image si falta
    let productId = p.productId;
    if (!productId && p.href) {
      const m = String(p.href).match(/product-details\/(\d+)/i);
      if (m) productId = Number(m[1]);
    }
    if (!productId && p.image) {
      const m = String(p.image).match(/\/products\/(\d+)\//i);
      if (m) productId = Number(m[1]);
    }

    // slug de nombre (suave)
    const slug =
      (p.name || '')
        .toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || null;

    return {
      provider_pk: providerRow.id,          // FK al provider real
      provider_id: providerRow.provider_id, // id “externo” si lo tenías
      product_id: productId ?? null,
      name: p.name ?? null,
      slug,
      category: p.category ?? null,
      price_provider_raw: p.priceProvider ?? null,
      price_suggested_raw: p.priceSuggested ?? null,
      stock: (p.stock === null || p.stock === undefined) ? null : Number(p.stock),
      image_url: p.image ?? null,
      href: p.href ?? null,
      raw_provider_name: p.provider ?? null,
      // extras útiles
      seen_at: new Date().toISOString(),
      provider_url_at_scrape: p.providerUrl ?? providerRow.url ?? null,
    };
  };

  let inserted = 0, updated = 0;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE).map(norm);

    // Conflicto por (provider_pk, product_id) si existe product_id, si no por (provider_pk, name, image_url)
    // Para simplificar usamos (provider_pk, product_id) y asumimos product_id presente en la mayoría.
    const { data, error, status } = await supabase
      .from('dropi.products')
      .upsert(chunk, { onConflict: 'provider_pk,product_id', ignoreDuplicates: false })
      .select('id, inserted_at, updated_at');

    if (error) throw error;

    // Aproximamos “insertados vs actualizados” por timestamps distintos (si tu tabla tiene triggers/columns)
    inserted += (data || []).filter(r => r.inserted_at === r.updated_at).length;
    updated  += (data || []).filter(r => r.inserted_at !== r.updated_at).length;
  }

  return { inserted, updated };
}

/**
 * Punto único a llamar desde tu scraper
 */
export async function saveToSupabase(meta, products) {
  const provider = await upsertProvider(meta);
  const res = await upsertProducts(provider, products);
  console.log(`✅ Supabase: prov=${provider.name} (${provider.id}) | +${res.inserted} / ~${res.updated} productos`);
  return { provider, ...res };
}
