const { db } = require("./database");

const FEDERATION_FB = "https://www.facebook.com/airsoft.georgia.federation";

/** აირსოფტის გუნდის ფოტოები — ოპერაციების ტიზერებისთვის */
const TEAM_IMG = {
  tactical: "https://images.unsplash.com/photo-1578885136359-16c8bd4f8fa1?auto=format&fit=crop&w=1200&q=80",
  squad: "https://images.unsplash.com/photo-1620650504312-6959f4614fd7?auto=format&fit=crop&w=1200&q=80",
  movement: "https://images.unsplash.com/photo-1511884642898-4c92249e20b6?auto=format&fit=crop&w=1200&q=80"
};

const events = [
  {
    slug: "nuclear-winter-contra-2026",
    title: "ბირთვული ზამთარი [კონტრა]",
    description:
      "საქართველოს აირსოფტის ფედერაციის მხარდაჭერით — სცენარული ოპერაცია მკაფიო წესებით და უსაფრთხოების რეგლამენტით.",
    location: "კოჯორის პოლიგონი",
    starts_at: "2026-01-25T10:00:00+04:00",
    ends_at: "2026-01-26T18:00:00+04:00",
    status: "რეგისტრაცია გახსნილია",
    status_type: "open",
    poster_url: TEAM_IMG.tactical,
    video_url: "./assets/hero-video.mp4",
    federation_link: FEDERATION_FB,
    featured: 0,
    sort_order: 1
  },
  {
    slug: "vaziani-tactical-2026",
    title: "ტაქტიკური დღე ვაზიანში",
    description: "ქვეყნის სხვადასხვა გუნდების ერთობლივი ტაქტიკური ვარჯიში და გუნდური სცენარები.",
    location: "ვაზიანი",
    starts_at: "2026-04-12T09:00:00+04:00",
    ends_at: "2026-04-12T17:00:00+04:00",
    status: "ადგილები შეზღუდულია",
    status_type: "limited",
    poster_url: TEAM_IMG.squad,
    featured: 0,
    sort_order: 2
  },
  {
    slug: "cqb-night-2026",
    title: "CQB ღამის თამაში",
    description: "მოკლე დისტანციის დინამიკური თამაში დაბალ განათებაზე სპეციალური წესებით.",
    location: "თბილისი",
    starts_at: "2026-07-18T20:00:00+04:00",
    ends_at: "2026-07-19T01:00:00+04:00",
    status: "ანონსი მალე",
    status_type: "soon",
    poster_url: "./assets/operations-featured.jpg",
    featured: 1,
    sort_order: 3
  },
  {
    slug: "nuclear-winter-2025",
    title: "ბირთვული ზამთარი",
    description: "ფედერაციის მხარდაჭერით ჩატარებული სცენარული ოპერაცია — არქივი და ფოტო/ვიდეო მასალები.",
    location: "კოჯორის პოლიგონი",
    starts_at: "2025-01-20T10:00:00+04:00",
    ends_at: "2025-01-21T18:00:00+04:00",
    status: "დასრულებული",
    status_type: "past",
    poster_url: "./assets/nuclear-winter-poster.jpg",
    video_url: "./assets/hero-video.mp4",
    federation_link: FEDERATION_FB,
    featured: 1,
    sort_order: 10
  }
];

const upsertEvent = db.prepare(`
  INSERT INTO events (
    slug, title, description, location, starts_at, ends_at, status, status_type,
    poster_url, video_url, federation_link, featured, published, sort_order
  ) VALUES (
    @slug, @title, @description, @location, @starts_at, @ends_at, @status, @status_type,
    @poster_url, @video_url, @federation_link, @featured, 1, @sort_order
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
    video_url = excluded.video_url,
    federation_link = excluded.federation_link,
    featured = excluded.featured,
    sort_order = excluded.sort_order,
    updated_at = datetime('now')
`);

function normalizeEvent(e) {
  return {
    ...e,
    video_url: e.video_url ?? null,
    federation_link: e.federation_link ?? null
  };
}

const seedMedia = db.prepare(`
  INSERT INTO event_media (event_id, media_type, url, alt_text, sort_order)
  SELECT @event_id, @media_type, @url, @alt_text, @sort_order
  WHERE NOT EXISTS (
    SELECT 1 FROM event_media WHERE event_id = @event_id AND url = @url
  )
`);

const seed = db.transaction(() => {
  for (const e of events) upsertEvent.run(normalizeEvent(e));

  const past = db.prepare("SELECT id FROM events WHERE slug = ?").get("nuclear-winter-2025");
  if (past) {
    seedMedia.run({
      event_id: past.id,
      media_type: "image",
      url: "./assets/nuclear-winter-poster.jpg",
      alt_text: "ბირთვული ზამთარი — პოსტერი",
      sort_order: 1
    });
    seedMedia.run({
      event_id: past.id,
      media_type: "image",
      url: "./assets/hero-action.jpg",
      alt_text: "ბირთვული ზამთარი — ველის ფოტო",
      sort_order: 2
    });
    seedMedia.run({
      event_id: past.id,
      media_type: "video",
      url: "./assets/hero-video.mp4",
      alt_text: "ბირთვული ზამთარი — ოფიციალური ვიდეო",
      sort_order: 3
    });
  }

  const { getAdminEmail, isAdminEmail } = require("../config/admin");

  const adminEmail = getAdminEmail();
  if (adminEmail) {
    db.prepare("UPDATE users SET role = 'user' WHERE email != ? AND role = 'admin'").run(adminEmail);
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
    if (existing) {
      db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(adminEmail);
    }
  }
});

seed();

const { syncRecurringEvents } = require("./recurring-events");
syncRecurringEvents().then((r) => {
  console.log(`Seeded ${events.length} events. Recurring Sundays: ${r.created} (${r.blocked} blocked).`);
});
