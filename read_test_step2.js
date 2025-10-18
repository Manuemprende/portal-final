// read_test_step2.js
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const URL  = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY   // <-- usa tu ANON/PUBLIC KEY aquí

if (!URL || !ANON) {
  console.error('Falta SUPABASE_URL o SUPABASE_ANON_KEY en .env')
  process.exit(1)
}

const supabase = createClient(URL, ANON, { db: { schema: 'public' } })

async function main () {
  const { data, error } = await supabase
    .from('v_categories_summary')
    .select('*')
    .order('product_count', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ Error leyendo v_categories_summary:', error.message)
    process.exit(1)
  }

  console.log('\n✅ OK. Categorías TOP (20):')
  for (const r of data) {
    console.log(`- ${r.category_name || 'Sin categoría'} | productos=${r.product_count}`)
  }
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
