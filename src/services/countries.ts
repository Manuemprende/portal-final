// src/services/countries.ts
import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(url, anon);

export type CountryRow = {
  code: string;      // 'CL'
  name: string;      // 'Chile'
  enabled: boolean;
  position: number;
  flag_url: string;  // https://flagcdn.com/h40/cl.png
};

export async function fetchCountries(): Promise<CountryRow[]> {
  const { data, error } = await supabase
    .from('v_countries_web')
    .select('code,name,enabled,position,flag_url')
    .order('position');

  if (error) {
    console.error('fetchCountries error:', error);
    return [];
  }
  return (data ?? []) as CountryRow[];
}
