const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
const { db } = require("../db/database");
const { isAdminEmail } = require("../config/admin");
const { normalizeUserRow } = require("../db/map-user");

let serviceClient = null;
let anonClient = null;

function getServiceClient() {
  if (serviceClient) return serviceClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  serviceClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return serviceClient;
}

function getAnonClient() {
  if (anonClient) return anonClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  anonClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return anonClient;
}

function isConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY);
}

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role || "user",
    supabaseId: row.supabase_id || row.id
  };
}

function upsertLocalUser({ email, name, phone, role, supabaseId, passwordHash }) {
  const normalized = email.trim().toLowerCase();
  const safeRole = isAdminEmail(normalized) && role === "admin" ? "admin" : "user";
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? OR supabase_id = ?")
    .get(normalized, supabaseId || null);

  if (existing) {
    db.prepare(
      `UPDATE users SET email = ?, name = ?, phone = ?, role = ?, supabase_id = ?
       WHERE id = ?`
    ).run(normalized, name, phone || null, safeRole, supabaseId || null, existing.id);
    return existing.id;
  }

  const hash = passwordHash || bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), 10);
  const result = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, phone, role, supabase_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(normalized, hash, name, phone || null, safeRole, supabaseId || null);

  return result.lastInsertRowid;
}

function getLocalUserById(id) {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return normalizeUserRow(row);
}

async function ensureProfile(supabaseUserId, { email, name, phone, role }) {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const normalized = email.trim().toLowerCase();
  const safeRole = isAdminEmail(normalized) && role === "admin" ? "admin" : "user";

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: supabaseUserId,
        email: normalized,
        name,
        phone: phone || null,
        role: safeRole
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function register({ email, password, name, phone, role = "user" }) {
  const normalized = email.trim().toLowerCase();
  const supabase = getServiceClient();

  if (!supabase) {
    return { mode: "local" };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
    user_metadata: { name, phone, role }
  });

  if (error) {
    if (error.message.includes("already been registered")) {
      throw new Error("ეს ელფოსტა უკვე რეგისტრირებულია");
    }
    throw new Error(error.message);
  }

  await ensureProfile(data.user.id, { email: normalized, name, phone, role });

  const localId = upsertLocalUser({
    email: normalized,
    name,
    phone,
    role,
    supabaseId: data.user.id
  });

  return { mode: "supabase", localId, user: getLocalUserById(localId) };
}

async function login({ email, password }) {
  const normalized = email.trim().toLowerCase();
  const anon = getAnonClient();
  const service = getServiceClient();

  if (!anon || !service) {
    return { mode: "local" };
  }

  const { data, error } = await anon.auth.signInWithPassword({
    email: normalized,
    password
  });

  if (error) {
    throw new Error("არასწორი ელფოსტა ან პაროლი");
  }

  const authUser = data.user;
  let profile = null;

  const { data: profileRow } = await service
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  profile = profileRow;

  if (!profile) {
    const role = isAdminEmail(normalized) ? "admin" : "user";
    profile = await ensureProfile(authUser.id, {
      email: normalized,
      name: authUser.user_metadata?.name || normalized.split("@")[0],
      phone: authUser.user_metadata?.phone,
      role
    });
  }

  if (isAdminEmail(normalized) && profile.role !== "admin") {
    await service.from("profiles").update({ role: "admin" }).eq("id", authUser.id);
    profile.role = "admin";
  } else if (!isAdminEmail(normalized) && profile.role === "admin") {
    await service.from("profiles").update({ role: "user" }).eq("id", authUser.id);
    profile.role = "user";
  }

  const localId = upsertLocalUser({
    email: normalized,
    name: profile.name,
    phone: profile.phone,
    role: profile.role,
    supabaseId: authUser.id
  });

  return { mode: "supabase", localId, user: getLocalUserById(localId) };
}

module.exports = {
  isConfigured,
  register,
  login,
  upsertLocalUser,
  getLocalUserById,
  getServiceClient,
  getAnonClient
};
