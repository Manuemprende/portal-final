// scripts/test_rpc.ts
import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const url = process.env.SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // usa TU var

if (!url || !serviceRole) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env");
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

async function main() {
  const { error } = await supabase.rpc("upsert_provider_and_product", {
    _provider_id: 4175,
    _provider_name: "AIRAM PRODUCTIS IMPORTACIONES SPA",
    _provider_url:
      "https://app.dropi.cl/dashboard/provider/4175/airam?isFavorite=false&order_by=created_at&order_type=desc",
    _product_id: 72154,
    _name: "Candida Cleanse 60 Capsulas Suplemento",
    _category: "Belleza",
    _price_provider: "$14.990",
    _price_suggested: "$29.990",
    _stock: 500,
    _image:
      "https://d39ru7awumhsh2.cloudfront.net/chile/products/72154/1760407927candida%20airamproducts_cl.png",
    _href:
      "https://app.dropi.cl/dashboard/product-details/72154/candida-cleanse-60-capsulas-suplemento",
    _country: "chile",
  });

  if (error) {
    console.error("RPC error:", error);
    process.exit(1);
  }

  console.log("✅ RPC OK");
}

main();
