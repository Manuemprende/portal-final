// src/services/pushToSupabase.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!; // <- tu var .env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env');
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

export type ScrapedProduct = {
  providerId: number;
  providerName: string;
  providerUrl: string;
  productId: number;
  name: string;
  category: string;
  priceProvider: string;   // puede venir con $ . ,
  priceSuggested: string;  // puede venir con $ . ,
  stock: number | null;
  image: string | null;
  href: string | null;
  country: string;         // ej: "chile"
};

async function mapWithConcurrency<T, R>(
  arr: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
) {
  const results: Promise<R>[] = [];
  const running: Promise<any>[] = [];
  for (let i = 0; i < arr.length; i++) {
    const p = Promise.resolve().then(() => fn(arr[i], i));
    results.push(p);
    const e: Promise<any> = p.then(() => running.splice(running.indexOf(e), 1));
    running.push(e);
    if (running.length >= limit) await Promise.race(running);
  }
  return Promise.allSettled(results);
}

export async function pushProductsBatch(products: ScrapedProduct[], concurrency = 12) {
  return mapWithConcurrency(products, concurrency, async (p) => {
    const { error } = await supabaseAdmin.rpc('upsert_provider_and_product', {
      _provider_id: p.providerId,
      _provider_name: p.providerName,
      _provider_url: p.providerUrl,
      _product_id: p.productId,
      _name: p.name,
      _category: p.category,
      _price_provider: p.priceProvider ?? '',
      _price_suggested: p.priceSuggested ?? '',
      _stock: p.stock ?? null,
      _image: p.image ?? null,
      _href: p.href ?? null,
      _country: p.country,
    });
    if (error) throw error;
    return true;
  });
}
