const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { db } = require("../db/database");
const { mapEvent, getEventById, getMediaForEvent } = require("../db/events");
const { requireAdmin } = require("../middleware/auth");
const supabase = require("../services/supabase");
const { syncRecurringEvents, bulkUpdateRecurringLilo, RECURRING_SLUG_PREFIX } = require("../db/recurring-events");

const { resolveUploadPath } = require("../utils/safe-path");

const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm"
]);

const router = express.Router();
const uploadsRoot = path.join(__dirname, "..", "uploads", "events");

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = path.join(uploadsRoot, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = ALLOWED_MEDIA_TYPES.has(file.mimetype);
    cb(ok ? null : new Error("მხოლოდ სურათი ან ვიდეო"), ok);
  }
});

router.use(requireAdmin);

router.get("/events", (_req, res) => {
  const rows = db.prepare("SELECT * FROM events ORDER BY sort_order ASC, starts_at DESC").all();
  res.json({ events: rows.map((r) => mapEvent(r)) });
});

router.patch("/recurring/lilo-sunday/bulk", async (req, res) => {
  const {
    title,
    description,
    location,
    status,
    statusType,
    posterUrl,
    videoUrl,
    federationLink,
    mapsUrl,
    sortOrder
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ error: "სათაური სავალდებულოა" });
  }

  try {
    const count = bulkUpdateRecurringLilo({
      title: title.trim(),
      description: description?.trim() || "",
      location: location?.trim() || "",
      status: status?.trim() || "",
      statusType: statusType || "open",
      posterUrl: posterUrl?.trim() || "",
      videoUrl: videoUrl?.trim() || null,
      federationLink: federationLink?.trim() || null,
      mapsUrl: mapsUrl?.trim() || null,
      sortOrder: sortOrder ?? -10
    });

    await syncRecurringEvents();

    if (supabase.isConfigured()) {
      const rows = db
        .prepare("SELECT * FROM events WHERE slug LIKE ?")
        .all(`${RECURRING_SLUG_PREFIX}%`);
      for (const row of rows) {
        await supabase.upsertEvent(row);
      }
    }

    res.json({ message: "ყველა კვირეული განახლდა", count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "შეცდომა" });
  }
});

router.post("/events", async (req, res) => {
  const {
    slug,
    title,
    description,
    location,
    startsAt,
    endsAt,
    status,
    statusType,
    posterUrl,
    videoUrl,
    federationLink,
    featured,
    published,
    sortOrder
  } = req.body;

  if (!slug?.trim() || !title?.trim() || !startsAt) {
    return res.status(400).json({ error: "slug, title და startsAt სავალდებულოა" });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO events (
          slug, title, description, location, starts_at, ends_at, status, status_type,
          poster_url, video_url, federation_link, featured, published, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        slug.trim(),
        title.trim(),
        description?.trim() || "",
        location?.trim() || "",
        startsAt,
        endsAt || null,
        status?.trim() || "",
        statusType || "soon",
        posterUrl?.trim() || "",
        videoUrl?.trim() || null,
        federationLink?.trim() || null,
        featured ? 1 : 0,
        published === false ? 0 : 1,
        sortOrder ?? 0
      );

    const row = db.prepare("SELECT * FROM events WHERE id = ?").get(result.lastInsertRowid);

    if (supabase.isConfigured()) {
      await supabase.upsertEvent(row);
    }

    await syncRecurringEvents();

    res.status(201).json({ event: mapEvent(row) });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "ეს slug უკვე არსებობს" });
    }
    console.error(err);
    res.status(500).json({ error: err.message || "შეცდომა" });
  }
});

router.patch("/events/:id", async (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "ღონისძიება ვერ მოიძებნა" });

  const fields = {
    slug: req.body.slug ?? existing.slug,
    title: req.body.title ?? existing.title,
    description: req.body.description ?? existing.description,
    location: req.body.location ?? existing.location,
    starts_at: req.body.startsAt ?? existing.starts_at,
    ends_at: req.body.endsAt !== undefined ? req.body.endsAt : existing.ends_at,
    status: req.body.status ?? existing.status,
    status_type: req.body.statusType ?? existing.status_type,
    poster_url: req.body.posterUrl ?? existing.poster_url,
    video_url: req.body.videoUrl !== undefined ? req.body.videoUrl : existing.video_url,
    federation_link:
      req.body.federationLink !== undefined ? req.body.federationLink : existing.federation_link,
    featured: req.body.featured !== undefined ? (req.body.featured ? 1 : 0) : existing.featured,
    published: req.body.published !== undefined ? (req.body.published ? 1 : 0) : existing.published,
    sort_order: req.body.sortOrder ?? existing.sort_order
  };

  db.prepare(
    `UPDATE events SET
      slug = @slug, title = @title, description = @description, location = @location,
      starts_at = @starts_at, ends_at = @ends_at, status = @status, status_type = @status_type,
      poster_url = @poster_url, video_url = @video_url, federation_link = @federation_link,
      featured = @featured, published = @published, sort_order = @sort_order,
      updated_at = datetime('now')
    WHERE id = @id`
  ).run({ ...fields, id });

  const row = db.prepare("SELECT * FROM events WHERE id = ?").get(id);

  if (supabase.isConfigured()) {
    try {
      await supabase.upsertEvent(row);
    } catch (e) {
      console.warn("Supabase sync:", e.message);
    }
  }

  await syncRecurringEvents();

  res.json({ event: mapEvent(row) });
});

router.delete("/events/:id", async (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM events WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "ღონისძიება ვერ მოიძებნა" });
  await syncRecurringEvents();
  res.json({ message: "წაიშალა" });
});

router.post("/events/:id/media", upload.single("file"), async (req, res) => {
  const id = Number(req.params.id);
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  if (!event) return res.status(404).json({ error: "ღონისძიება ვერ მოიძებნა" });
  if (!req.file) return res.status(400).json({ error: "ფაილი არ არის ატვირთული" });

  const mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";
  const publicUrl = `/uploads/events/${id}/${req.file.filename}`;

  const result = db
    .prepare(
      `INSERT INTO event_media (event_id, media_type, url, alt_text, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, mediaType, publicUrl, req.body.altText?.trim() || req.file.originalname, Number(req.body.sortOrder) || 0);

  if (supabase.isConfigured()) {
    try {
      const buffer = fs.readFileSync(req.file.path);
      await supabase.uploadMedia(event.slug, { ...req.file, buffer }, mediaType);
    } catch (e) {
      console.warn("Supabase media upload:", e.message);
    }
  }

  const media = db.prepare("SELECT * FROM event_media WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({
    media: {
      id: media.id,
      mediaType: media.media_type,
      url: media.url,
      altText: media.alt_text,
      sortOrder: media.sort_order
    }
  });
});

router.delete("/media/:mediaId", (req, res) => {
  const mediaId = Number(req.params.mediaId);
  const media = db.prepare("SELECT * FROM event_media WHERE id = ?").get(mediaId);
  if (!media) return res.status(404).json({ error: "მედია ვერ მოიძებნა" });

  if (media.url.startsWith("/uploads/")) {
    const filePath = resolveUploadPath(path.join(__dirname, ".."), media.url);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare("DELETE FROM event_media WHERE id = ?").run(mediaId);
  res.json({ message: "წაიშალა" });
});

router.get("/events/:id/media", (req, res) => {
  const id = Number(req.params.id);
  const event = getEventById(id);
  if (!event) return res.status(404).json({ error: "ღონისძიება ვერ მოიძებნა" });
  res.json({ media: getMediaForEvent(id) });
});

router.post("/sync-supabase", async (_req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(400).json({ error: "Supabase არ არის კონფიგურირებული" });
  }

  try {
    const remote = await supabase.fetchPublishedEvents();
    if (!remote?.length) return res.json({ message: "Supabase-ში ღონისძიებები ვერ მოიძებნა", count: 0 });

    const upsert = db.prepare(`
      INSERT INTO events (
        slug, title, description, location, starts_at, ends_at, status, status_type,
        poster_url, video_url, federation_link, featured, published, sort_order, supabase_id
      ) VALUES (
        @slug, @title, @description, @location, @startsAt, @endsAt, @status, @statusType,
        @posterUrl, @videoUrl, @federationLink, @featured, 1, @sortOrder, @supabaseId
      )
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title, description = excluded.description, location = excluded.location,
        starts_at = excluded.starts_at, ends_at = excluded.ends_at, status = excluded.status,
        status_type = excluded.status_type, poster_url = excluded.poster_url,
        video_url = excluded.video_url, federation_link = excluded.federation_link,
        featured = excluded.featured, sort_order = excluded.sort_order,
        supabase_id = excluded.supabase_id, updated_at = datetime('now')
    `);

    const sync = db.transaction(() => {
      for (const e of remote) {
        upsert.run({
          slug: e.slug,
          title: e.title,
          description: e.description,
          location: e.location,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          status: e.status,
          statusType: e.statusType,
          posterUrl: e.posterUrl,
          videoUrl: e.videoUrl,
          federationLink: e.federationLink,
          featured: e.featured ? 1 : 0,
          sortOrder: e.sortOrder,
          supabaseId: e.supabaseId
        });
      }
    });
    sync();

    res.json({ message: "სინქრონიზაცია დასრულდა", count: remote.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
