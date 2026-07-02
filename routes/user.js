const express = require("express");
const { db, formatPrice } = require("../db/database");
const { requireAuth } = require("../middleware/auth");
const { getUserAttendance } = require("../db/attendance");
const { normalizeUserRow } = require("../db/map-user");

const router = express.Router();

router.get("/dashboard", requireAuth, (req, res) => {
  const user = normalizeUserRow(db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId));

  if (!user) {
    return res.status(401).json({ error: "მომხმარებელი ვერ მოიძებნა" });
  }

  const orders = db
    .prepare(
      `SELECT order_number, total, status, payment_method, created_at
       FROM orders
       WHERE user_id = ? OR (email = ? AND email IS NOT NULL AND email != '')
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all(user.id, user.email)
    .map((row) => ({
      orderNumber: row.order_number,
      totalFormatted: formatPrice(row.total),
      status: row.status,
      paymentMethod: row.payment_method,
      createdAt: row.created_at
    }));

  const { upcoming, attended } = getUserAttendance(user.id);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isAdmin: user.isAdmin
    },
    orders,
    eventsUpcoming: upcoming,
    eventsAttended: attended
  });
});

module.exports = router;
