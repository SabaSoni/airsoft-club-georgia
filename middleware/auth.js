function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "ავტორიზაცია საჭიროა" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "ავტორიზაცია საჭიროა" });
  }

  const { db } = require("../db/database");
  const { getAdminEmail, isAdminEmail } = require("../config/admin");
  const adminEmail = getAdminEmail();

  if (!adminEmail) {
    return res.status(503).json({ error: "ადმინისტრატორის ელფოსტა არ არის კონფიგურირებული" });
  }

  const user = db.prepare("SELECT email, role FROM users WHERE id = ?").get(req.session.userId);
  if (!user || user.role !== "admin" || !isAdminEmail(user.email)) {
    return res.status(403).json({ error: "ადმინისტრატორის უფლება საჭიროა" });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
