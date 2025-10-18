// src/services/categories.ts
import { supabase } from "./supabaseClient";

export type Niche = {
  category_id?: number;
  category_name: string;
  products?: number;
  sales_7d?: number;
  country?: string;
  country_code?: string;
  country_iso?: string;
};

const CANDIDATE_VIEWS = [
  { schema: "dropi",  name: "v_categories_summary_web" },
  { schema: "dropi",  name: "v_categories_summary"     },
  { schema: "public", name: "v_categories_summary_web" },
  { schema: "public", name: "v_categories_summary"     },
] as const;

export async function fetchNiches(country?: string): Promise<Niche[]> {
  let lastErr: any;

  for (const v of CANDIDATE_VIEWS) {
    const client = v.schema === "dropi" ? supabase : supabase.schema("public");

    let q = client.from(v.name).select("*");

    if (country) {
      q = q.or(
        [
          `country.eq.${country}`,
          `country_code.eq.${country}`,
          `country_iso.eq.${country}`,
        ].join(",")
      );
    }

    try { q = q.order("products", { ascending: false }); } catch {}
    try { q = q.order("sales_7d", { ascending: false }); } catch {}

    const { data, error } = await q;
    if (!error && data) return data as Niche[];
    lastErr = error;
  }

  console.error("fetchNiches() falló:", lastErr);
  return [];
}
