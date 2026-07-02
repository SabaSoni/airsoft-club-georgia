function getAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
}

function isAdminEmail(email) {
  const admin = getAdminEmail();
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin;
}

function mapProfile(profile) {
  if (!profile) return null;
  const isAdmin = profile.role === "admin" && isAdminEmail(profile.email);
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    phone: profile.phone,
    role: isAdmin ? "admin" : "user",
    isAdmin
  };
}

module.exports = { getAdminEmail, isAdminEmail, mapProfile };
