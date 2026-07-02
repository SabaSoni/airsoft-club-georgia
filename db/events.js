const { db } = require("./database");

function isPast(event) {
  if (!event.ends_at) return false;
  return new Date(event.ends_at) < new Date();
}

function isUpcoming(event) {
  return new Date(event.starts_at) > new Date();
}

function formatEventDate(startsAt, endsAt) {
  const start = new Date(startsAt);
  const months = [
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
  const y = start.getFullYear();
  const m = months[start.getMonth()];
  if (endsAt) {
    const end = new Date(endsAt);
    if (end.getMonth() !== start.getMonth() || end.getFullYear() !== y) {
      return `${y} • ${m} – ${months[end.getMonth()]}`;
    }
  }
  return `${y} • ${m}`;
}

function getMediaForEvent(eventId) {
  return db
    .prepare(
      `SELECT id, media_type AS mediaType, url, alt_text AS altText, sort_order AS sortOrder
       FROM event_media WHERE event_id = ? ORDER BY sort_order ASC, id ASC`
    )
    .all(eventId);
}

function mapEvent(row, media = null) {
  if (!row) return null;
  const past = isPast(row);
  const upcoming = isUpcoming(row);
  const effectiveStatusType = past ? "past" : row.status_type;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    dateLabel: formatEventDate(row.starts_at, row.ends_at),
    status: past ? "დასრულებული" : row.status,
    statusType: effectiveStatusType,
    posterUrl: row.poster_url,
    videoUrl: row.video_url,
    federationLink: row.federation_link,
    mapsUrl: row.maps_url || null,
    featured: !!row.featured,
    published: !!row.published,
    sortOrder: row.sort_order,
    isPast: past,
    isUpcoming: upcoming,
    isOngoing: !past && !upcoming,
    media: media ?? getMediaForEvent(row.id)
  };
}

function listEvents({ publishedOnly = true } = {}) {
  const where = publishedOnly ? "WHERE published = 1" : "";
  const rows = db
    .prepare(`SELECT * FROM events ${where} ORDER BY sort_order ASC, starts_at ASC`)
    .all();
  return rows.map((r) => mapEvent(r));
}

function getEventBySlug(slug) {
  const row = db.prepare("SELECT * FROM events WHERE slug = ? AND published = 1").get(slug);
  return mapEvent(row);
}

function getEventById(id) {
  const row = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  return mapEvent(row);
}

function splitEvents(events) {
  const now = Date.now();
  const past = events.filter((e) => {
    const end = new Date(e.endsAt || e.startsAt).getTime();
    return end < now;
  });
  const upcoming = events.filter((e) => new Date(e.startsAt).getTime() > now);
  const ongoing = events.filter((e) => {
    const start = new Date(e.startsAt).getTime();
    const end = new Date(e.endsAt || e.startsAt).getTime();
    return start <= now && end >= now;
  });
  return { upcoming, ongoing, past };
}

function getNextFeaturedEvent() {
  const events = listEvents();
  const { upcoming } = splitEvents(events);
  const featured = upcoming.find((e) => e.featured) || upcoming[0];
  return featured || null;
}

module.exports = {
  mapEvent,
  listEvents,
  getEventBySlug,
  getEventById,
  getMediaForEvent,
  splitEvents,
  getNextFeaturedEvent,
  formatEventDate,
  isPast,
  isUpcoming
};
