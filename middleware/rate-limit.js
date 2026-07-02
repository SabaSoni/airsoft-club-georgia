const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "ძალიან ბევრი მცდელობა — სცადეთ 15 წუთში" }
});

const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "პაროლის ცვლილების ლიმიტი — სცადეთ მოგვიანებით" }
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "ძალიან ბევრი შეტყობინება — სცადეთ მოგვიანებით" }
});

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "ძალიან ბევრი შეკვეთა — სცადეთ მოგვიანებით" }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "მოთხოვნების ლიმიტი — სცადეთ მოგვიანებით" }
});

module.exports = {
  authLimiter,
  passwordLimiter,
  contactLimiter,
  orderLimiter,
  apiLimiter
};
