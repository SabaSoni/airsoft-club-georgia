const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { listGalleryImages, getGalleryEventId, GALLERY_EVENT_SLUG } = require("../db/gallery");
const { db } = require("../db/database");
const { requireAdmin } = require("../middleware/auth");

const { resolveUploadPath } = require("../utils/safe-path");

const router = express.Router();

const uploadsRoot = path.join(__dirname, "..", "uploads", "gallery");

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadsRoot);
  },
  filename(_req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(file.mimetype.startsWith("image/") ? null : new Error("მხოლოდ სურათი"), file.mimetype.startsWith("image/"));
  }
});

router.get("/", (_req, res) => {
  try {
    res.json({ items: listGalleryImages() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "გალერეის ჩატვირთვა ვერ მოხერხდა" });
  }
});

router.post("/upload", requireAdmin, upload.array("files", 20), (req, res) => {
  const eventId = getGalleryEventId();
  if (!eventId) {
    return res.status(500).json({ error: "გალერეის ღონისძიება ვერ მოიძებნა" });
  }

  if (!req.files?.length) {
    return res.status(400).json({ error: "ფაილი არ არის ატვირთული" });
  }

  const insert = db.prepare(
    `INSERT INTO event_media (event_id, media_type, url, alt_text, sort_order)
     VALUES (?, 'image', ?, ?, ?)`
  );

  const created = [];
  for (const file of req.files) {
    const publicUrl = `/uploads/gallery/${file.filename}`;
    const alt = req.body.altText?.trim() || file.originalname;
    const result = insert.run(eventId, publicUrl, alt, Number(req.body.sortOrder) || 0);
    created.push({
      id: result.lastInsertRowid,
      src: publicUrl,
      alt,
      eventSlug: GALLERY_EVENT_SLUG
    });
  }

  res.status(201).json({ message: "ატვირთულია", items: created });
});

router.delete("/:mediaId", requireAdmin, (req, res) => {
  const mediaId = Number(req.params.mediaId);
  const media = db.prepare("SELECT * FROM event_media WHERE id = ?").get(mediaId);
  if (!media) return res.status(404).json({ error: "სურათი ვერ მოიძებნა" });

  if (media.url.startsWith("/uploads/")) {
    const filePath = resolveUploadPath(path.join(__dirname, ".."), media.url);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare("DELETE FROM event_media WHERE id = ?").run(mediaId);
  res.json({ message: "წაიშალა" });
});

module.exports = router;
