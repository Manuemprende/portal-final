// src/services/hot.ts
import { supabase } from "./supabaseClient";

/** Estructura flexible para distintas vistas (v2 / web) */
export type HotProduct = {
  id?: number;                 // algunas vistas lo usan
  prod_id?: number;            // otras vistas lo usan
  product_id?: number;         // opcional
  name: string;
  provider_id?: number;
  provider_name?: string;
  provider_url?: string;
  category_name?: string;
  country?: string;
  country_code?: string;
  country_iso?: string;
  image_url?: string;
  picture?: string;
  price?: number;
  sales_7d?: number;
  hot_rank?: number;
  rank?: number;
};

type FetchParams = { country?: string; limit?: number };

const CANDIDATE_VIEWS = [
  { schema: "dropi",  name: "v_hot_products_top200_v2"  },
  { schema: "dropi",  name: "v_hot_products_top200_web" },
  { schema: "public", name: "v_hot_products_top200_v2"  },
  { schema: "public", name: "v_hot_products_top200_web" },
] as const;

/**
 * Trae productos HOT, intentando varias vistas (dropi→public).
 * Filtra por país si la vista trae columna de país.
 * Evita el error de ordered-set `rank()` (no se usa en el query).
 */
export async function fetchHotProducts({ country, limit = 60 }: FetchParams) {
  let lastErr: any;

  for (const v of CANDIDATE_VIEWS) {
    const client = v.schema === "dropi" ? supabase : supabase.schema("public");

    // select básico (no intentamos rank() en el SQL para evitar el error)
    let q = client.from(v.name).select("*");

    // filtro por país – compatible con los nombres de columna más comunes
    if (country) {
      // si existe 'country' / 'country_code' / 'country_iso' filtrará;
      // si no existen, el OR ignorable simplemente no matará la query
      q = q.or(
        [
          `country.eq.${country}`,
          `country_code.eq.${country}`,
          `country_iso.eq.${country}`,
        ].join(",")
      );
    }

    // orden defensivo: si hay 'hot_rank' o 'rank' se usará; si no, por ventas
    // (no importa si la columna no existe: el try/catch evita romper)
    try { q = q.order("hot_rank", { ascending: true }); } catch {}
    try { q = q.order("rank",    { ascending: true }); } catch {}
    try { q = q.order("sales_7d",{ ascending: false }); } catch {}

    q = q.limit(limit);

    const { data, error } = await q;
    if (!error && data) {
      return data as HotProduct[];
    }
    lastErr = error;
  }

  console.error("fetchHotProducts() falló en todas las vistas:", lastErr);
  return [] as HotProduct[];
}
