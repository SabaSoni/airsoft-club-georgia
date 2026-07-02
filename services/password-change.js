const crypto = require("crypto");
const { isPassword } = require("../utils/validate");
const bcrypt = require("bcryptjs");
const { db } = require("../db/database");
const supabaseAuth = require("./supabase-auth");

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_LENGTH = 6;

function generateCode() {
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

function hashCode(code) {
  return bcrypt.hashSync(code, 10);
}

function verifyCode(code, hash) {
  return bcrypt.compareSync(code, hash);
}

function getUserRow(userId) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

function updateLocalPassword(userId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
}

async function updateSupabasePassword(supabaseId, newPassword) {
  const service = supabaseAuth.getServiceClient();
  if (!service || !supabaseId) return;
  const { error } = await service.auth.admin.updateUserById(supabaseId, {
    password: newPassword
  });
  if (error) throw new Error(error.message);
}

function invalidateUserCodes(userId) {
  db.prepare(
    `UPDATE password_change_codes SET used_at = datetime('now')
     WHERE user_id = ? AND used_at IS NULL`
  ).run(userId);
}

function storeLocalCode(userId, code) {
  invalidateUserCodes(userId);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  db.prepare(
    `INSERT INTO password_change_codes (user_id, code_hash, expires_at)
     VALUES (?, ?, ?)`
  ).run(userId, hashCode(code), expiresAt);
  return expiresAt;
}

function verifyLocalCode(userId, code) {
  const row = db
    .prepare(
      `SELECT id, code_hash, expires_at FROM password_change_codes
       WHERE user_id = ? AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId);

  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  if (!verifyCode(code, row.code_hash)) return false;

  db.prepare("UPDATE password_change_codes SET used_at = datetime('now') WHERE id = ?").run(row.id);
  return true;
}

async function changeWithCurrentPassword(userId, currentPassword, newPassword) {
  if (!isPassword(newPassword)) {
    throw new Error("ახალი პაროლი მინიმუმ 8 სიმბოლო");
  }

  const user = getUserRow(userId);
  if (!user) throw new Error("მომხმარებელი ვერ მოიძებნა");

  if (user.supabase_id && supabaseAuth.isConfigured()) {
    const anon = supabaseAuth.getAnonClient();
    const { error } = await anon.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });
    if (error) throw new Error("მიმდინარე პაროლი არასწორია");
    await updateSupabasePassword(user.supabase_id, newPassword);
    updateLocalPassword(userId, newPassword);
    return;
  }

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    throw new Error("მიმდინარე პაროლი არასწორია");
  }

  updateLocalPassword(userId, newPassword);
}

async function sendEmailCode(userId) {
  const user = getUserRow(userId);
  if (!user) throw new Error("მომხმარებელი ვერ მოიძებნა");

  if (supabaseAuth.isConfigured()) {
    const anon = supabaseAuth.getAnonClient();
    const { error } = await anon.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false }
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("rate")) {
        throw new Error("ძალიან ხშირად სცადეთ — დაელოდეთ რამდენიმე წუთს");
      }
      throw new Error(error.message || "კოდის გაგზავნა ვერ მოხერხდა");
    }
    return { mode: "supabase_otp", email: maskEmail(user.email) };
  }

  const code = generateCode();
  storeLocalCode(userId, code);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] Password change code for ${user.email}: ${code}`);
  }
  return { mode: "local", email: maskEmail(user.email) };
}

async function changeWithEmailCode(userId, code, newPassword) {
  if (!code?.trim()) throw new Error("კოდი სავალდებულოა");
  if (!isPassword(newPassword)) {
    throw new Error("ახალი პაროლი მინიმუმ 8 სიმბოლო");
  }

  const user = getUserRow(userId);
  if (!user) throw new Error("მომხმარებელი ვერ მოიძებნა");

  if (supabaseAuth.isConfigured()) {
    const anon = supabaseAuth.getAnonClient();
    const { error } = await anon.auth.verifyOtp({
      email: user.email,
      token: code.trim(),
      type: "email"
    });
    if (error) throw new Error("არასწორი ან ვადაგასული კოდი");

    if (user.supabase_id) {
      await updateSupabasePassword(user.supabase_id, newPassword);
    }
    updateLocalPassword(userId, newPassword);
    return;
  }

  if (!verifyLocalCode(userId, code.trim())) {
    throw new Error("არასწორი ან ვადაგასული კოდი");
  }
  updateLocalPassword(userId, newPassword);
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

module.exports = {
  changeWithCurrentPassword,
  sendEmailCode,
  changeWithEmailCode
};
