// read_test_step1.js
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!URL || !ANON) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el .env')
  process.exit(1)
}

// Client apuntando al esquema dropi (solo lectura con anon key)
const supabase = createClient(URL, ANON, { db: { schema: 'public' } })

async function main() {
  // Trae 10 proveedores con más productos (campos de la vista v_providers_summary)
  const { data, error } = await supabase
    .from('v_providers_summary')
    .select('*')
    .order('products_count', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ Error leyendo v_providers_summary:', error.message)
    process.exit(1)
  }

  console.log('✅ OK. Proveedores TOP (10):')
  for (const r of data) {
    console.log(
      `- ${r.provider_name} (id=${r.provider_id}) | país=${r.country} | productos=${r.products_count}`
    )
  }
}

main().catch((e) => {
  console.error('❌ Excepción:', e.message)
  process.exit(1)
})
