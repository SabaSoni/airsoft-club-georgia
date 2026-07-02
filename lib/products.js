const { getAdmin } = require("./supabase-admin");
const { formatPrice } = require("./format");

function mapProduct(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    price: row.price,
    priceFormatted: formatPrice(row.price),
    image: row.image,
    stock: row.stock,
    inStock: row.stock > 0
  };
}

async function listProducts(type) {
  const supabase = getAdmin();
  if (!supabase) return [];

  let query = supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (type && type !== "all") {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(mapProduct);
}

async function getProduct(id) {
  const supabase = getAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapProduct(data);
}

module.exports = { mapProduct, listProducts, getProduct };
