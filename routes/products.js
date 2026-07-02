const express = require("express");
const { db, mapProduct, formatPrice } = require("../db/database");

const router = express.Router();

router.get("/", (req, res) => {
  const { type } = req.query;
  let sql = "SELECT * FROM products WHERE active = 1";
  const params = [];

  if (type && type !== "all") {
    sql += " AND type = ?";
    params.push(type);
  }
  sql += " ORDER BY id ASC";

  const rows = db.prepare(sql).all(...params);
  res.json({ products: rows.map(mapProduct) });
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: "პროდუქტი ვერ მოიძებნა" });
  }
  res.json({ product: mapProduct(row) });
});

module.exports = router;
