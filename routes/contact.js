const express = require("express");
const { db } = require("../db/database");
const { trim } = require("../utils/validate");

const router = express.Router();

router.post("/", (req, res) => {
  const name = trim(req.body.name, 120);
  const phone = trim(req.body.phone, 40);
  const message = trim(req.body.message, 2000);

  if (!name || !phone || !message) {
    return res.status(400).json({ error: "გთხოვთ შეავსოთ ყველა ველი" });
  }

  db.prepare("INSERT INTO contact_messages (name, phone, message) VALUES (?, ?, ?)").run(
    name,
    phone,
    message
  );

  res.status(201).json({ message: "შეტყობინება მიღებულია. მალე დაგიკავშირდებით!" });
});

module.exports = router;
