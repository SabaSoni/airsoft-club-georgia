const { db } = require("./database");
const { isAdminEmail } = require("../config/admin");

function normalizeUserRow(row) {
  if (!row) return null;

  let role = row.role || "user";
  if (role === "admin" && !isAdminEmail(row.email)) {
    db.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(row.id);
    role = "user";
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role,
    isAdmin: role === "admin" && isAdminEmail(row.email)
  };
}

module.exports = { normalizeUserRow };
