const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trim(str, max = 500) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, max);
}

function isEmail(value) {
  return EMAIL_RE.test(value) && value.length <= 254;
}

function isPassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

function isOrderNumber(value) {
  return typeof value === "string" && /^ACG-\d{6}-\d{4}$/.test(value);
}

function parsePositiveInt(value, max = 999) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.floor(n), max);
}

module.exports = {
  trim,
  isEmail,
  isPassword,
  isOrderNumber,
  parsePositiveInt
};
