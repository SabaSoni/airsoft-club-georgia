const { getAdmin } = require("./supabase-admin");
const { mapProfile } = require("./admin");

async function getBearerUser(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const supabase = getAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    authUser: data.user,
    profile: profile || {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || "",
      phone: data.user.user_metadata?.phone || null,
      role: "user"
    },
    token
  };
}

async function requireAuth(req) {
  const user = await getBearerUser(req);
  if (!user) {
    const err = new Error("ავტორიზაცია საჭიროა");
    err.status = 401;
    throw err;
  }
  return user;
}

async function requireAdmin(req) {
  const user = await requireAuth(req);
  const mapped = mapProfile(user.profile);
  if (!mapped?.isAdmin) {
    const err = new Error("ადმინისტრატორის უფლება საჭიროა");
    err.status = 403;
    throw err;
  }
  return user;
}

module.exports = { getBearerUser, requireAuth, requireAdmin, mapProfile };
