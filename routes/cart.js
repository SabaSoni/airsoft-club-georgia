const express = require("express");
const { db, mapProduct, formatPrice } = require("../db/database");

const router = express.Router();

function getCart(session) {
  if (!session.cart) session.cart = [];
  return session.cart;
}

function buildCartResponse(cart) {
  if (!cart.length) {
    return { items: [], itemCount: 0, subtotal: 0, subtotalFormatted: formatPrice(0) };
  }

  const items = [];
  let subtotal = 0;
  let itemCount = 0;

  for (const line of cart) {
    const product = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(line.productId);
    if (!product) continue;

    const qty = Math.min(line.quantity, product.stock);
    if (qty <= 0) continue;

    const lineTotal = product.price * qty;
    subtotal += lineTotal;
    itemCount += qty;

    items.push({
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice: product.price,
      unitPriceFormatted: formatPrice(product.price),
      quantity: qty,
      lineTotal,
      lineTotalFormatted: formatPrice(lineTotal),
      stock: product.stock,
      inStock: product.stock > 0
    });
  }

  return {
    items,
    itemCount,
    subtotal,
    subtotalFormatted: formatPrice(subtotal)
  };
}

router.get("/", (req, res) => {
  const cart = getCart(req.session);
  res.json(buildCartResponse(cart));
});

router.post("/items", (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) {
    return res.status(400).json({ error: "productId სავალდებულოა" });
  }

  const product = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(productId);
  if (!product) {
    return res.status(404).json({ error: "პროდუქტი ვერ მოიძებნა" });
  }
  if (product.stock < 1) {
    return res.status(400).json({ error: "პროდუქტი ამოწურულია" });
  }

  const qty = Math.max(1, Math.min(Number(quantity) || 1, product.stock));
  const cart = getCart(req.session);
  const existing = cart.find((i) => i.productId === product.id);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, product.stock);
  } else {
    cart.push({ productId: product.id, quantity: qty });
  }

  req.session.cart = cart;
  res.json({ message: "კალათაში დაემატა", cart: buildCartResponse(cart) });
});

router.patch("/items/:productId", (req, res) => {
  const productId = Number(req.params.productId);
  const quantity = Number(req.body.quantity);

  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: "არასწორი რაოდენობა" });
  }

  const product = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(productId);
  if (!product) {
    return res.status(404).json({ error: "პროდუქტი ვერ მოიძებნა" });
  }

  const cart = getCart(req.session);
  const idx = cart.findIndex((i) => i.productId === productId);

  if (quantity === 0) {
    if (idx >= 0) cart.splice(idx, 1);
  } else if (idx >= 0) {
    cart[idx].quantity = Math.min(quantity, product.stock);
  } else {
    return res.status(404).json({ error: "პროდუქტი კალათაში არ არის" });
  }

  req.session.cart = cart;
  res.json({ cart: buildCartResponse(cart) });
});

router.delete("/items/:productId", (req, res) => {
  const productId = Number(req.params.productId);
  const cart = getCart(req.session);
  req.session.cart = cart.filter((i) => i.productId !== productId);
  res.json({ cart: buildCartResponse(req.session.cart) });
});

router.delete("/", (req, res) => {
  req.session.cart = [];
  res.json({ cart: buildCartResponse([]) });
});

module.exports = router;
