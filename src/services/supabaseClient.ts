// src/services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Estas variables las toma automáticamente de tu archivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificamos que las variables de entorno existan para evitar errores
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Las variables de entorno de Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY) no están definidas.");
}

// Creamos y exportamos el cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);