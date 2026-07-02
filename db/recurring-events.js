const { db } = require("./database");

const RECURRING_SLUG_PREFIX = "lilo-sunday-";
const TBILISI_TZ = "Asia/Tbilisi";

const LILO_SUNDAY = {
  title: "კვირეული თამაში — ლილო",
  description:
    "ყოველ კვირას, 12:00-ზე. Airsoft Club Georgia-ის რეგულარული ოპერაცია ლილოს პოლიგონზე.",
  location: "ლილო",
  mapsUrl: "https://maps.app.goo.gl/orX5fPHdSxcPztMa6",
  posterUrl: "./assets/lilo-sunday.jpg",
  status: "ყოველ კვირას",
  statusType: "open",
  startHour: 12,
  durationHours: 5,
  weeksBack: 8,
  weeksAhead: 52,
  sortOrder: -10
};

function tbilisiDateKeyFromDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TBILISI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function tbilisiDateKeyFromIso(iso) {
  return tbilisiDateKeyFromDate(new Date(iso));
}

function isSundayInTbilisi(iso) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TBILISI_TZ,
    weekday: "short"
  }).format(new Date(iso));
  return weekday === "Sun";
}

function isRecurringSlug(slug) {
  return typeof slug === "string" && slug.startsWith(RECURRING_SLUG_PREFIX);
}

function collectSundayDateKeys(weeksBack, weeksAhead) {
  const keys = [];
  const seen = new Set();
  const start = new Date();
  start.setDate(start.getDate() - weeksBack * 7);
  const totalDays = (weeksBack + weeksAhead) * 7 + 7;

  for (let i = 0; i < totalDays; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (!isSundayInTbilisi(d.toISOString())) continue;
    const key = tbilisiDateKeyFromDate(d);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }

  return keys.sort();
}

function getBlockedSundayKeys() {
  const rows = db
    .prepare(
      `SELECT starts_at FROM events
       WHERE published = 1 AND slug NOT LIKE ?`
    )
    .all(`${RECURRING_SLUG_PREFIX}%`);

  const blocked = new Set();
  for (const row of rows) {
    if (isSundayInTbilisi(row.starts_at)) {
      blocked.add(tbilisiDateKeyFromIso(row.starts_at));
    }
  }
  return blocked;
}

const upsertRecurring = db.prepare(`
  INSERT INTO events (
    slug, title, description, location, starts_at, ends_at, status, status_type,
    poster_url, video_url, federation_link, maps_url, featured, published, sort_order
  ) VALUES (
    @slug, @title, @description, @location, @starts_at, @ends_at, @status, @status_type,
    @poster_url, NULL, NULL, @maps_url, 0, 1, @sort_order
  )
  ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    location = excluded.location,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    status = excluded.status,
    status_type = excluded.status_type,
    poster_url = excluded.poster_url,
    maps_url = excluded.maps_url,
    sort_order = excluded.sort_order,
    updated_at = datetime('now')
`);

function getLiloTemplate() {
  const row = db
    .prepare(
      `SELECT title, description, location, status, status_type, poster_url, maps_url, sort_order
       FROM events WHERE slug LIKE ?
       ORDER BY starts_at DESC LIMIT 1`
    )
    .get(`${RECURRING_SLUG_PREFIX}%`);

  if (!row) return { ...LILO_SUNDAY };

  return {
    ...LILO_SUNDAY,
    title: row.title,
    description: row.description,
    location: row.location,
    status: row.status,
    statusType: row.status_type,
    posterUrl: row.poster_url,
    mapsUrl: row.maps_url,
    sortOrder: row.sort_order
  };
}

function bulkUpdateRecurringLilo(fields) {
  const template = getLiloTemplate();
  const next = { ...template, ...fields };

  db.prepare(
    `UPDATE events SET
      title = @title,
      description = @description,
      location = @location,
      status = @status,
      status_type = @status_type,
      poster_url = @poster_url,
      video_url = @video_url,
      federation_link = @federation_link,
      maps_url = @maps_url,
      sort_order = @sort_order,
      updated_at = datetime('now')
    WHERE slug LIKE @prefix`
  ).run({
    title: next.title,
    description: next.description,
    location: next.location,
    status: next.status,
    status_type: next.statusType,
    poster_url: next.posterUrl,
    video_url: fields.videoUrl ?? null,
    federation_link: fields.federationLink ?? null,
    maps_url: next.mapsUrl,
    sort_order: next.sortOrder,
    prefix: `${RECURRING_SLUG_PREFIX}%`
  });

  return db.prepare("SELECT changes() AS c").get().c;
}

async function syncRecurringEvents() {
  const template = getLiloTemplate();
  const blocked = getBlockedSundayKeys();
  const dateKeys = collectSundayDateKeys(template.weeksBack, template.weeksAhead);
  const activeSlugs = new Set();

  const run = db.transaction(() => {
    for (const dateKey of dateKeys) {
      const slug = `${RECURRING_SLUG_PREFIX}${dateKey}`;

      if (blocked.has(dateKey)) {
        db.prepare("DELETE FROM events WHERE slug = ?").run(slug);
        continue;
      }

      activeSlugs.add(slug);
      const startsAt = `${dateKey}T${String(template.startHour).padStart(2, "0")}:00:00+04:00`;
      const endHour = template.startHour + template.durationHours;
      const endsAt = `${dateKey}T${String(endHour).padStart(2, "0")}:00:00+04:00`;

      upsertRecurring.run({
        slug,
        title: template.title,
        description: template.description,
        location: template.location,
        starts_at: startsAt,
        ends_at: endsAt,
        status: template.status,
        status_type: template.statusType,
        poster_url: template.posterUrl,
        maps_url: template.mapsUrl,
        sort_order: template.sortOrder
      });
    }

    const stale = db
      .prepare("SELECT id, slug FROM events WHERE slug LIKE ?")
      .all(`${RECURRING_SLUG_PREFIX}%`);

    for (const row of stale) {
      if (!activeSlugs.has(row.slug)) {
        db.prepare("DELETE FROM events WHERE id = ?").run(row.id);
      }
    }
  });

  run();

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = require("../services/supabase");
      if (supabase.isConfigured()) {
        for (const slug of activeSlugs) {
          const row = db.prepare("SELECT * FROM events WHERE slug = ?").get(slug);
          if (row) await supabase.upsertEvent(row);
        }
      }
    } catch (err) {
      console.warn("Recurring Supabase sync:", err.message);
    }
  }

  return { created: activeSlugs.size, blocked: blocked.size };
}

module.exports = {
  RECURRING_SLUG_PREFIX,
  LILO_SUNDAY,
  isRecurringSlug,
  getLiloTemplate,
  bulkUpdateRecurringLilo,
  syncRecurringEvents,
  tbilisiDateKeyFromIso,
  isSundayInTbilisi
};
