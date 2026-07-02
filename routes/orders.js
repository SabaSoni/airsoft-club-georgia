const express = require("express");
const { db, formatPrice } = require("../db/database");
const { trim, isOrderNumber } = require("../utils/validate");

const router = express.Router();
const MAX_SESSION_ORDERS = 20;

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ACG-${y}${m}${d}-${rand}`;
}

function rememberOrderAccess(session, orderNumber) {
  if (!session.orderAccess) session.orderAccess = [];
  if (!session.orderAccess.includes(orderNumber)) {
    session.orderAccess.unshift(orderNumber);
    session.orderAccess = session.orderAccess.slice(0, MAX_SESSION_ORDERS);
  }
}

function canViewOrder(req, order) {
  if (!order) return false;

  if (req.session?.orderAccess?.includes(order.order_number)) {
    return true;
  }

  if (!req.session?.userId) return false;

  if (order.user_id && order.user_id === req.session.userId) {
    return true;
  }

  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(req.session.userId);
  if (user?.email && order.email && user.email.toLowerCase() === order.email.toLowerCase()) {
    return true;
  }

  return false;
}

router.post("/", (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) {
    return res.status(400).json({ error: "კალათა ცარიელია" });
  }

  const customerName = trim(req.body.customerName, 120);
  const phone = trim(req.body.phone, 40);
  const email = req.body.email ? trim(req.body.email, 254) : null;
  const address = trim(req.body.address, 300);
  const paymentMethod = req.body.paymentMethod;
  const notes = req.body.notes ? trim(req.body.notes, 500) : null;

  if (!customerName || !phone || !address || !paymentMethod) {
    return res.status(400).json({ error: "გთხოვთ შეავსოთ ყველა სავალდებულო ველი" });
  }

  const validPayments = ["cash", "bank", "card"];
  if (!validPayments.includes(paymentMethod)) {
    return res.status(400).json({ error: "არასწორი გადახდის მეთოდი" });
  }

  const orderLines = [];
  let total = 0;

  for (const line of cart) {
    const productId = Number(line.productId);
    const quantity = Math.min(Math.max(1, Number(line.quantity) || 1), 99);
    if (!Number.isFinite(productId)) {
      return res.status(400).json({ error: "არასწორი პროდუქტი" });
    }

    const product = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(productId);
    if (!product) {
      return res.status(400).json({ error: "პროდუქტი მიუწვდომელია" });
    }
    if (product.stock < quantity) {
      return res.status(400).json({
        error: `"${product.name}" — მარაგში მხოლოდ ${product.stock} ცალია`
      });
    }
    orderLines.push({ product, quantity });
    total += product.price * quantity;
  }

  const orderNumber = generateOrderNumber();

  const placeOrder = db.transaction(() => {
    const orderResult = db
      .prepare(
        `INSERT INTO orders (order_number, customer_name, phone, email, address, payment_method, notes, total, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        orderNumber,
        customerName,
        phone,
        email,
        address,
        paymentMethod,
        notes,
        total,
        req.session.userId || null
      );

    const orderId = orderResult.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
      VALUES (?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");

    for (const { product, quantity } of orderLines) {
      insertItem.run(orderId, product.id, product.name, product.price, quantity);
      updateStock.run(quantity, product.id);
    }

    return orderId;
  });

  placeOrder();
  req.session.cart = [];
  rememberOrderAccess(req.session, orderNumber);

  res.status(201).json({
    message: "შეკვეთა მიღებულია",
    order: {
      orderNumber,
      total,
      totalFormatted: formatPrice(total),
      paymentMethod
    }
  });
});

router.get("/:orderNumber", (req, res) => {
  const orderNumber = trim(req.params.orderNumber, 32);
  if (!isOrderNumber(orderNumber)) {
    return res.status(400).json({ error: "არასწორი შეკვეთის ნომერი" });
  }

  const order = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(orderNumber);
  if (!order) {
    return res.status(404).json({ error: "შეკვეთა ვერ მოიძებნა" });
  }

  if (!canViewOrder(req, order)) {
    return res.status(403).json({ error: "წვდომა აკრძალულია" });
  }

  const items = db
    .prepare("SELECT product_name, unit_price, quantity FROM order_items WHERE order_id = ?")
    .all(order.id)
    .map((row) => ({
      name: row.product_name,
      quantity: row.quantity,
      unitPriceFormatted: formatPrice(row.unit_price),
      lineTotalFormatted: formatPrice(row.unit_price * row.quantity)
    }));

  res.json({
    order: {
      orderNumber: order.order_number,
      customerName: order.customer_name,
      phone: order.phone,
      address: order.address,
      paymentMethod: order.payment_method,
      status: order.status,
      totalFormatted: formatPrice(order.total),
      createdAt: order.created_at,
      items
    }
  });
});

module.exports = router;
