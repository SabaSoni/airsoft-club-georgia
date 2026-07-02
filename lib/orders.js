const { getAdmin } = require("./supabase-admin");
const { formatPrice } = require("./format");
const { getProduct } = require("./products");

const ORDER_RE = /^ACG-\d{6}-\d{4}$/;

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ACG-${y}${m}${d}-${rand}`;
}

async function placeOrder({ userId, userEmail, body }) {
  const supabase = getAdmin();
  if (!supabase) throw new Error("Supabase არ არის კონფიგურირებული");

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    const err = new Error("კალათა ცარიელია");
    err.status = 400;
    throw err;
  }

  const customerName = String(body.customerName || "").trim().slice(0, 120);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const email = body.email ? String(body.email).trim().slice(0, 254) : null;
  const address = String(body.address || "").trim().slice(0, 300);
  const paymentMethod = body.paymentMethod;
  const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null;

  if (!customerName || !phone || !address || !paymentMethod) {
    const err = new Error("გთხოვთ შეავსოთ ყველა სავალდებულო ველი");
    err.status = 400;
    throw err;
  }

  const validPayments = ["cash", "bank", "card"];
  if (!validPayments.includes(paymentMethod)) {
    const err = new Error("არასწორი გადახდის მეთოდი");
    err.status = 400;
    throw err;
  }

  const orderLines = [];
  let total = 0;

  for (const line of items) {
    const productId = line.productId;
    const quantity = Math.min(Math.max(1, Number(line.quantity) || 1), 99);
    const product = await getProduct(productId);
    if (!product) {
      const err = new Error("პროდუქტი მიუწვდომელია");
      err.status = 400;
      throw err;
    }
    if (product.stock < quantity) {
      const err = new Error(`"${product.name}" — მარაგში მხოლოდ ${product.stock} ცალია`);
      err.status = 400;
      throw err;
    }
    orderLines.push({ product, quantity });
    total += product.price * quantity;
  }

  const orderNumber = generateOrderNumber();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: userId || null,
      customer_name: customerName,
      phone,
      email: email || userEmail || null,
      address,
      payment_method: paymentMethod,
      notes,
      total,
      status: "pending"
    })
    .select()
    .single();

  if (orderErr) throw new Error(orderErr.message);

  const itemRows = orderLines.map(({ product, quantity }) => ({
    order_id: order.id,
    product_id: product.id,
    product_name: product.name,
    unit_price: product.price,
    quantity
  }));

  const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
  if (itemsErr) throw new Error(itemsErr.message);

  for (const { product, quantity } of orderLines) {
    const { error: stockErr } = await supabase
      .from("products")
      .update({ stock: product.stock - quantity })
      .eq("id", product.id)
      .eq("stock", product.stock);
    if (stockErr) throw new Error(stockErr.message);
  }

  return {
    orderNumber,
    total,
    totalFormatted: formatPrice(total),
    paymentMethod
  };
}

async function getOrder(orderNumber, { userId, userEmail }) {
  if (!ORDER_RE.test(orderNumber)) {
    const err = new Error("არასწორი შეკვეთის ნომერი");
    err.status = 400;
    throw err;
  }

  const supabase = getAdmin();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, order_items(product_name, unit_price, quantity)")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) {
    const err = new Error("შეკვეთა ვერ მოიძებნა");
    err.status = 404;
    throw err;
  }

  const allowed =
    (userId && order.user_id === userId) ||
    (userEmail && order.email && order.email.toLowerCase() === userEmail.toLowerCase());

  if (!allowed) {
    const err = new Error("წვდომა აკრძალულია");
    err.status = 403;
    throw err;
  }

  return {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    phone: order.phone,
    address: order.address,
    paymentMethod: order.payment_method,
    status: order.status,
    totalFormatted: formatPrice(order.total),
    createdAt: order.created_at,
    items: (order.order_items || []).map((row) => ({
      name: row.product_name,
      quantity: row.quantity,
      unitPriceFormatted: formatPrice(row.unit_price),
      lineTotalFormatted: formatPrice(row.unit_price * row.quantity)
    }))
  };
}

module.exports = { placeOrder, getOrder };
