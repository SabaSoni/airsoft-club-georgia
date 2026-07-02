function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function parsePath(req) {
  const segments = req.query?.path;
  if (Array.isArray(segments)) return "/" + segments.join("/");
  if (typeof segments === "string") return "/" + segments;
  const url = req.url || "";
  const q = url.indexOf("?");
  const pathname = q === -1 ? url : url.slice(0, q);
  return pathname.replace(/^\/api/, "") || "/";
}

module.exports = { json, readBody, parsePath };
