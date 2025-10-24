// src/services/auth.ts
import { createClient } from '@supabase/supabase-js';

// Accedemos a las variables de entorno con import.meta.env en Vite
const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Magic link: solo correo */
export async function signInWithEmail(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
}

/** Obtiene user + profile (role, allowed_countries, plan) */
export async function checkUserSession() {
  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) return { user: null, profile: null };

  const { data: profile, error: perr } = await supabase
    .from('profiles')
    .select('role, allowed_countries, plan, email')
    .eq('user_id', user.id)
    .single();

  if (perr) return { user, profile: null };
  return { user, profile };
}

/** Cierra sesión */
export async function signOut() {
  await supabase.auth.signOut();
}
