// src/services/providers.ts
import { supabase } from "./supabaseClient";

export type ProviderRow = {
  provider_id: number;
  provider_name: string;
  provider_url?: string;
  products?: number;
  sales_7d?: number;
  country?: string;
  country_code?: string;
  country_iso?: string;
};

const CANDIDATE_VIEWS = [
  { schema: "dropi",  name: "v_providers_summary" },
  { schema: "public", name: "v_providers_summary" },
] as const;

export async function fetchProviders(country?: string): Promise<ProviderRow[]> {
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
    if (!error && data) return data as ProviderRow[];
    lastErr = error;
  }

  console.error("fetchProviders() falló:", lastErr);
  return [];
}
