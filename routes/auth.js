const express = require("express");
const bcrypt = require("bcryptjs");
const { db } = require("../db/database");
const { getAdminEmail, isAdminEmail } = require("../config/admin");
const { normalizeUserRow } = require("../db/map-user");
const supabaseAuth = require("../services/supabase-auth");
const passwordChange = require("../services/password-change");
const { requireAuth } = require("../middleware/auth");
const { trim, isEmail, isPassword } = require("../utils/validate");

const router = express.Router();

function getUserById(id) {
  return normalizeUserRow(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function mapUser(row) {
  return normalizeUserRow(row);
}

function adminAccountExists() {
  const adminEmail = getAdminEmail();
  if (!adminEmail) return false;
  return !!db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
}

function saveSession(req, res, { status = 200, message, user }) {
  req.session.userId = user.id;
  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      return res.status(500).json({ error: "სესიის შეცდომა — სცადეთ თავიდან" });
    }
    res.status(status).json({ message, user: mapUser(user) });
  });
}

router.get("/register-status", (_req, res) => {
  const adminEmail = getAdminEmail();
  const adminExists = adminAccountExists();
  const masked = adminEmail ? adminEmail.replace(/^(.{2}).+(@.+)$/, "$1***$2") : null;

  res.json({
    open: true,
    adminOpen: !!(adminEmail && !adminExists),
    adminEmail: adminEmail && !adminExists ? masked : null,
    supabaseAuth: supabaseAuth.isConfigured(),
    message: adminEmail && !adminExists
      ? `ადმინისტრატორის რეგისტრაცია: ${masked}`
      : "შექმენით ანგარიში ოპერაციებზე რეგისტრაციისა და შეკვეთების სანახავად"
  });
});

router.post("/register", async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!isEmail(normalizedEmail) || !name?.trim()) {
      return res.status(400).json({ error: "ელფოსტა, პაროლი და სახელი სავალდებულოა" });
    }
    if (!isPassword(password)) {
      return res.status(400).json({ error: "პაროლი მინიმუმ 8 სიმბოლო" });
    }

    const role = isAdminEmail(normalizedEmail) ? "admin" : "user";

    if (role === "admin") {
      if (!getAdminEmail()) {
        return res.status(503).json({ error: "ADMIN_EMAIL არ არის კონფიგურირებული (.env)" });
      }
      if (adminAccountExists()) {
        return res.status(403).json({ error: "ადმინისტრატორის ანგარიში უკვე არსებობს — გამოიყენეთ შესვლა" });
      }
    } else if (db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail)) {
      return res.status(409).json({ error: "ეს ელფოსტა უკვე რეგისტრირებულია" });
    }

    if (supabaseAuth.isConfigured()) {
      const result = await supabaseAuth.register({
        email: normalizedEmail,
        password,
        name: name.trim(),
        phone: phone?.trim(),
        role
      });
      const user = result.user || getUserById(result.localId);
      return saveSession(req, res, {
        status: 201,
        message: role === "admin" ? "ადმინისტრატორის ანგარიში შეიქმნა" : "რეგისტრაცია წარმატებულია",
        user
      });
    }

    const hash = bcrypt.hashSync(password, 10);
    const insert = db
      .prepare("INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?)")
      .run(normalizedEmail, hash, name.trim(), phone?.trim() || null, role);

    saveSession(req, res, {
      status: 201,
      message: role === "admin" ? "ადმინისტრატორის ანგარიში შეიქმნა" : "რეგისტრაცია წარმატებულია",
      user: getUserById(insert.lastInsertRowid)
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(400).json({ error: err.message || "რეგისტრაცია ვერ მოხერხდა" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!isEmail(normalizedEmail) || !password) {
      return res.status(400).json({ error: "ელფოსტა და პაროლი სავალდებულოა" });
    }

    const localRow = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);

    if (supabaseAuth.isConfigured()) {
      if (localRow && !localRow.supabase_id && bcrypt.compareSync(password, localRow.password_hash)) {
        if (isAdminEmail(localRow.email) && localRow.role !== "admin") {
          db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(localRow.id);
          localRow.role = "admin";
        }
        return saveSession(req, res, { message: "წარმატებით შეხვედით", user: mapUser(localRow) });
      }

      const result = await supabaseAuth.login({ email: normalizedEmail, password });
      const user = result.user || getUserById(result.localId);
      if (!user) return res.status(401).json({ error: "მომხმარებელი ვერ მოიძებნა" });
      return saveSession(req, res, { message: "წარმატებით შეხვედით", user });
    }

    if (!localRow || !bcrypt.compareSync(password, localRow.password_hash)) {
      return res.status(401).json({ error: "არასწორი ელფოსტა ან პაროლი" });
    }

    if (isAdminEmail(localRow.email) && localRow.role !== "admin") {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(localRow.id);
      localRow.role = "admin";
    }

    saveSession(req, res, { message: "წარმატებით შეხვედით", user: mapUser(localRow) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(401).json({ error: err.message || "შესვლა ვერ მოხერხდა" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "გამოსვლა ვერ მოხერხდა" });
    res.clearCookie("acg.sid");
    res.json({ message: "გამოსვლა წარმატებულია" });
  });
});

router.get("/me", (req, res) => {
  if (!req.session?.userId) return res.json({ user: null });
  const user = getUserById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }
  res.json({
    user: mapUser(user),
    auth: {
      supabase: supabaseAuth.isConfigured(),
      passwordMethods: ["current", supabaseAuth.isConfigured() ? "email" : "email_local"]
    }
  });
});

router.post("/password/send-code", requireAuth, async (req, res) => {
  try {
    const result = await passwordChange.sendEmailCode(req.session.userId);
    res.json({
      message: `კოდი გაიგზავნა: ${result.email}`,
      mode: result.mode
    });
  } catch (err) {
    console.error("Send code error:", err);
    res.status(400).json({ error: err.message || "კოდის გაგზავნა ვერ მოხერხდა" });
  }
});

router.post("/password/change", requireAuth, async (req, res) => {
  try {
    const { method, currentPassword, code, newPassword, confirmPassword } = req.body;

    if (!isPassword(newPassword)) {
      return res.status(400).json({ error: "პაროლი მინიმუმ 8 სიმბოლო" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "პაროლები არ ემთხვევა" });
    }

    if (method === "email") {
      await passwordChange.changeWithEmailCode(req.session.userId, code, newPassword);
    } else {
      await passwordChange.changeWithCurrentPassword(
        req.session.userId,
        currentPassword,
        newPassword
      );
    }

    res.json({ message: "პაროლი წარმატებით შეიცვალა" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(400).json({ error: err.message || "პაროლის შეცვლა ვერ მოხერხდა" });
  }
});

module.exports = router;
