const TBILISI_TZ = "Asia/Tbilisi";

const MONTHS_KA = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი"
];

function tbilisiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TBILISI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function tbilisiWeekday(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TBILISI_TZ,
    weekday: "short"
  }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

function addDaysToDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function getCurrentWeekRange(now = new Date()) {
  const todayKey = tbilisiDateKey(now);
  const weekday = tbilisiWeekday(now);
  const daysSinceMonday = (weekday + 6) % 7;
  const mondayKey = addDaysToDateKey(todayKey, -daysSinceMonday);
  const sundayKey = addDaysToDateKey(mondayKey, 6);

  const weekStart = new Date(`${mondayKey}T00:00:00+04:00`);
  const weekEnd = new Date(`${sundayKey}T23:59:59.999+04:00`);

  return { weekStart, weekEnd, mondayKey, sundayKey };
}

function formatWeekLabel(mondayKey, sundayKey) {
  const [, m1, d1] = mondayKey.split("-").map(Number);
  const [y2, m2, d2] = sundayKey.split("-").map(Number);
  const startMonth = MONTHS_KA[m1 - 1];
  const endMonth = MONTHS_KA[m2 - 1];

  if (m1 === m2) {
    return `${d1}–${d2} ${startMonth}, ${y2}`;
  }
  return `${d1} ${startMonth} – ${d2} ${endMonth}, ${y2}`;
}

function eventOverlapsWeek(event, weekStart, weekEnd) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt || event.startsAt);
  return start <= weekEnd && end >= weekStart;
}

function filterEventsToCurrentWeek(events, now = new Date()) {
  const { weekStart, weekEnd } = getCurrentWeekRange(now);
  return events.filter((event) => eventOverlapsWeek(event, weekStart, weekEnd));
}

function getWeekMeta(now = new Date()) {
  const { weekStart, weekEnd, mondayKey, sundayKey } = getCurrentWeekRange(now);
  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    label: formatWeekLabel(mondayKey, sundayKey)
  };
}

module.exports = {
  getCurrentWeekRange,
  filterEventsToCurrentWeek,
  getWeekMeta,
  eventOverlapsWeek
};
