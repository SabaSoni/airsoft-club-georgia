const path = require("path");

const PUBLIC_JS = new Set([
  "api.js",
  "script.js",
  "account.js",
  "auth.js",
  "cart.js",
  "shop.js",
  "checkout.js",
  "operations.js",
  "events-api.js",
  "gallery.js",
  "admin.js",
  "event.js",
  "attendance-ui.js",
  "transitions.js",
  "videos.js",
  "index.js",
  "video-modal.js",
  "order-success.js"
]);

const PUBLIC_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".mp4",
  ".webm",
  ".woff",
  ".woff2"
]);

const BLOCKED_PREFIXES = [
  "/data/",
  "/db/",
  "/routes/",
  "/middleware/",
  "/services/",
  "/config/",
  "/utils/",
  "/node_modules/",
  "/supabase/",
  "/scripts/"
];

const BLOCKED_EXACT = new Set([
  "/.env",
  "/package.json",
  "/package-lock.json",
  "/server.js",
  "/.git",
  "/.gitignore"
]);

function blockSensitivePaths(req, res, next) {
  if (!req.path || req.path === "/") return next();

  const normalized = path.posix.normalize(req.path);
  if (normalized.includes("..")) {
    return res.status(404).end();
  }

  const lower = normalized.toLowerCase();

  if (BLOCKED_EXACT.has(lower) || lower.endsWith(".db") || lower.endsWith(".sql")) {
    return res.status(404).end();
  }

  if (BLOCKED_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return res.status(404).end();
  }

  if (lower.startsWith("/uploads/")) {
    return next();
  }

  if (lower.startsWith("/assets/")) {
    return next();
  }

  const ext = path.posix.extname(lower);
  if (ext === ".js") {
    const base = path.posix.basename(lower);
    if (!PUBLIC_JS.has(base)) {
      return res.status(404).end();
    }
    return next();
  }

  if (ext && !PUBLIC_EXTENSIONS.has(ext)) {
    return res.status(404).end();
  }

  next();
}

function assertSecurityConfig() {
  const isProd = process.env.NODE_ENV === "production";
  const secret = process.env.SESSION_SECRET;

  if (isProd && (!secret || secret.length < 32)) {
    console.error("FATAL: Set SESSION_SECRET (min 32 chars) in production.");
    process.exit(1);
  }

  if (!isProd && (!secret || secret.includes("change-this"))) {
    console.warn("WARNING: Use a strong SESSION_SECRET before deploying to production.");
  }
}

module.exports = {
  blockSensitivePaths,
  assertSecurityConfig,
  PUBLIC_JS
};
