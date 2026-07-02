const { db } = require("./database");

const GALLERY_EVENT_SLUG = "club-gallery";

function getGalleryEventId() {
  const row = db.prepare("SELECT id FROM events WHERE slug = ?").get(GALLERY_EVENT_SLUG);
  return row?.id ?? null;
}

function listGalleryImages() {
  const rows = db
    .prepare(
      `SELECT
        em.id,
        em.url,
        em.alt_text AS altText,
        em.sort_order AS sortOrder,
        em.created_at AS createdAt,
        e.id AS eventId,
        e.slug AS eventSlug,
        e.title AS eventTitle,
        e.starts_at AS eventStartsAt
      FROM event_media em
      INNER JOIN events e ON e.id = em.event_id
      WHERE em.media_type = 'image' AND e.published = 1
      ORDER BY em.created_at DESC, em.sort_order ASC, em.id DESC`
    )
    .all();

  return rows.map((row) => ({
    id: row.id,
    src: row.url,
    alt: row.altText || row.eventTitle || "Airsoft Club Georgia",
    eventSlug: row.eventSlug,
    eventTitle: row.eventTitle,
    eventUrl: row.eventSlug === GALLERY_EVENT_SLUG ? null : `event.html?slug=${encodeURIComponent(row.eventSlug)}`,
    createdAt: row.createdAt
  }));
}

module.exports = {
  GALLERY_EVENT_SLUG,
  getGalleryEventId,
  listGalleryImages
};
