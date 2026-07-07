/**
 * Optional: bundle Supabase for faster loads (same-origin, cached).
 * Run: npm run build:vendor
 * Then commit assets/supabase.min.js
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const entry = path.join("node_modules", "@supabase", "supabase-js", "dist", "module", "index.js");
const out = path.join("assets", "supabase.min.js");

if (!fs.existsSync(entry)) {
  console.error("Run npm install first — @supabase/supabase-js not found.");
  process.exit(1);
}

execSync(
  `npx --yes esbuild "${entry}" --bundle --format=esm --minify --outfile="${out}"`,
  { stdio: "inherit", cwd: __dirname + "/.." }
);

console.log("Wrote", out);
