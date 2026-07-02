function getAdminEmail() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

function isAdminEmail(email) {
  const adminEmail = getAdminEmail();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

module.exports = { getAdminEmail, isAdminEmail };
