const path = require("path");

function resolveUploadPath(rootDir, publicUrl) {
  if (!publicUrl || typeof publicUrl !== "string") return null;
  if (!publicUrl.startsWith("/uploads/")) return null;

  const relative = publicUrl.replace(/^\/+/, "");
  const absolute = path.resolve(path.join(rootDir, relative));
  const uploadsRoot = path.resolve(path.join(rootDir, "uploads"));

  if (!absolute.startsWith(uploadsRoot + path.sep) && absolute !== uploadsRoot) {
    return null;
  }

  return absolute;
}

module.exports = { resolveUploadPath };
