const { db } = require("./database");

function getEventIdBySlug(slug) {
  const row = db.prepare("SELECT id FROM events WHERE slug = ?").get(slug);
  return row?.id ?? null;
}

function getAttendanceCount(eventId) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM event_attendees WHERE event_id = ?").get(eventId);
  return row?.c ?? 0;
}

function isUserAttending(eventId, userId) {
  if (!eventId || !userId) return false;
  return !!db.prepare("SELECT 1 FROM event_attendees WHERE event_id = ? AND user_id = ?").get(eventId, userId);
}

function attend(eventId, userId) {
  db.prepare("INSERT OR IGNORE INTO event_attendees (event_id, user_id) VALUES (?, ?)").run(eventId, userId);
  return getAttendanceCount(eventId);
}

function unattend(eventId, userId) {
  db.prepare("DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?").run(eventId, userId);
  return getAttendanceCount(eventId);
}

function getCountsForSlugs(slugs) {
  if (!slugs.length) return {};
  const placeholders = slugs.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT e.slug, COUNT(ea.id) AS count
       FROM events e
       LEFT JOIN event_attendees ea ON ea.event_id = e.id
       WHERE e.slug IN (${placeholders})
       GROUP BY e.id`
    )
    .all(...slugs);
  return Object.fromEntries(rows.map((r) => [r.slug, r.count]));
}

function attachAttendance(events, userId = null) {
  const slugs = events.map((e) => e.slug);
  const counts = getCountsForSlugs(slugs);
  let attendingSlugs = new Set();

  if (userId && slugs.length) {
    const placeholders = slugs.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT e.slug FROM event_attendees ea
         JOIN events e ON e.id = ea.event_id
         WHERE ea.user_id = ? AND e.slug IN (${placeholders})`
      )
      .all(userId, ...slugs);
    attendingSlugs = new Set(rows.map((r) => r.slug));
  }

  return events.map((e) => ({
    ...e,
    attendeeCount: counts[e.slug] ?? 0,
    isAttending: attendingSlugs.has(e.slug)
  }));
}

function getUserAttendance(userId) {
  const rows = db
    .prepare(
      `SELECT e.*, ea.created_at AS registered_at
       FROM event_attendees ea
       JOIN events e ON e.id = ea.event_id
       WHERE ea.user_id = ?
       ORDER BY e.starts_at DESC`
    )
    .all(userId);

  const now = Date.now();
  const upcoming = [];
  const attended = [];

  for (const row of rows) {
    const end = new Date(row.ends_at || row.starts_at).getTime();
    const item = {
      slug: row.slug,
      title: row.title,
      location: row.location,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      posterUrl: row.poster_url,
      registeredAt: row.registered_at
    };
    if (end < now) attended.push(item);
    else upcoming.push(item);
  }

  return { upcoming, attended };
}

module.exports = {
  getEventIdBySlug,
  getAttendanceCount,
  isUserAttending,
  attend,
  unattend,
  attachAttendance,
  getUserAttendance
};
