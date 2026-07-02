require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const helmet = require("helmet");

const { assertSecurityConfig, blockSensitivePaths } = require("./middleware/security");
const {
  apiLimiter,
  authLimiter,
  passwordLimiter,
  contactLimiter,
  orderLimiter
} = require("./middleware/rate-limit");

assertSecurityConfig();

require("./db/database");
require("./db/seed");
require("./db/seed-events");
require("./db/seed-gallery");

const productsRouter = require("./routes/products");
const cartRouter = require("./routes/cart");
const ordersRouter = require("./routes/orders");
const contactRouter = require("./routes/contact");
const authRouter = require("./routes/auth");
const eventsRouter = require("./routes/events");
const adminEventsRouter = require("./routes/admin-events");
const userRouter = require("./routes/user");
const galleryRouter = require("./routes/gallery");

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  app.set("trust proxy", 1);
}

const supabaseOrigin = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : null;

const imgSrc = [
  "'self'",
  "data:",
  "blob:",
  "https://images.unsplash.com",
  "https://cdn11.bigcommerce.com"
];
if (supabaseOrigin) imgSrc.push(supabaseOrigin);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc,
        connectSrc: ["'self'", ...(supabaseOrigin ? [supabaseOrigin] : [])],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" }
  })
);

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use(
  session({
    name: "acg.sid",
    secret: process.env.SESSION_SECRET || "acg-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.use("/api", apiLimiter);

app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", orderLimiter, ordersRouter);
app.use("/api/contact", contactLimiter, contactRouter);
app.use("/api/auth/password", passwordLimiter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/admin", adminEventsRouter);
app.use("/api/user", userRouter);
app.use("/api/gallery", galleryRouter);

app.get("/api/config", (_req, res) => {
  res.json({
    runtime: "express",
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(blockSensitivePaths);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use("/uploads", express.static(path.join(__dirname, "uploads"), { dotfiles: "deny", index: false }));
app.use(express.static(path.join(__dirname), { dotfiles: "deny", index: false }));

app.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "ფაილი ძალიან დიდია" });
  }
  console.error(err);
  res.status(500).json({ error: "სერვერის შეცდომა" });
});

const server = app.listen(PORT, () => {
  console.log(`Airsoft Club Georgia → http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use. Stop the other server first:`);
    console.error(`  netstat -ano | findstr :${PORT}`);
    console.error(`  taskkill /PID <pid> /F\n`);
    process.exit(1);
  }
  throw err;
});
