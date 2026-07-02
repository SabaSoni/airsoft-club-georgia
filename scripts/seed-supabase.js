require("dotenv").config();
const catalog = require("../db/products-catalog");
const { getAdmin, isConfigured } = require("../lib/supabase-admin");

async function main() {
  if (!isConfigured()) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = getAdmin();

  for (const p of catalog) {
    const { error } = await supabase.from("products").upsert(
      {
        sku: p.sku,
        type: p.type,
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image,
        stock: p.stock,
        active: true
      },
      { onConflict: "sku" }
    );
    if (error) {
      console.error(`Failed ${p.sku}:`, error.message);
    } else {
      console.log(`✓ ${p.name}`);
    }
  }

  console.log(`\nSeeded ${catalog.length} products to Supabase.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
