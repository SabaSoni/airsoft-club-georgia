const { db } = require("./database");
const catalog = require("./products-catalog");

const cols = db.prepare("PRAGMA table_info(products)").all();
const hasSku = cols.some((c) => c.name === "sku");
if (!hasSku) {
  db.exec("ALTER TABLE products ADD COLUMN sku TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku)");
}

const upsert = db.prepare(`
  INSERT INTO products (sku, type, name, description, price, image, stock, active)
  VALUES (@sku, @type, @name, @description, @price, @image, @stock, 1)
  ON CONFLICT(sku) DO UPDATE SET
    type = excluded.type,
    name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    image = excluded.image,
    stock = excluded.stock,
    active = 1
`);

const sync = db.transaction(() => {
  db.exec("UPDATE products SET active = 0 WHERE sku IS NULL OR sku = ''");
  for (const p of catalog) upsert.run(p);
});

sync();
console.log(`Synced ${catalog.length} products from catalog.`);
