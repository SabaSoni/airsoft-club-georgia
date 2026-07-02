const fs = require("fs");
const path = require("path");
const { db } = require("./database");
const { GALLERY_EVENT_SLUG } = require("./gallery");

const CURSOR_ASSETS = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-Saba-Desktop-Freelance-airsoft-club-georgia",
  "assets"
);

const SEED_FILES = [
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_587477467_122154076262834421_7650699420282844392_n-e740b1b6-bfc2-4dfb-b321-0f7ad024a22a.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_494741408_122115441158834421_7533929141204516367_n-23f79503-b6c7-4ef4-9522-ae928cddb601.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_550330991_1097107882623479_7226733913285991135_n-85699c41-1fac-4cc8-96fb-fe520a617a3d.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_484749434_949352814065654_7670998662287765458_n-a55c197b-693d-4318-94b0-85d323430e47.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_484468964_949352810732321_3615418940680578751_n-8e78256f-17ab-4460-a9bf-38083b741c09.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_550900409_1097107939290140_925572920562089240_n-0c6565f1-02fd-438f-8ad2-93a20c76a28f.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_550233605_1097109249290009_8661940904222668183_n-2ddc9122-9094-4d76-9d2b-4fa873bbb4de.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_489570298_122100605984834421_5295070426097773793_n-07bd9aa7-927c-4745-8b54-a4abcfde4a7d.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_489911234_122100605804834421_2177542364513642811_n-9bcf354b-8b13-4118-93b3-7cf51294c214.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_490405948_122100605852834421_7511104004594280598_n-404919ed-30a4-49ef-b145-b0ed0aa9ace4.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_490415072_122100605900834421_4682062679386528659_n-bbea2606-596e-4f5e-a5d4-a1db8140b5cf.png",
  "c__Users_Saba_AppData_Roaming_Cursor_User_workspaceStorage_5b828f333782a62766e6cc83debd979d_images_489476740_122100605846834421_4371536716283453713_n-dcf9e9b4-cbe1-46f0-aa5f-4388531848a5.png"
];

const galleryDir = path.join(__dirname, "..", "assets", "gallery");
if (!fs.existsSync(galleryDir)) {
  fs.mkdirSync(galleryDir, { recursive: true });
}

const upsertGalleryEvent = db.prepare(`
  INSERT INTO events (
    slug, title, description, location, starts_at, ends_at, status, status_type,
    poster_url, featured, published, sort_order
  ) VALUES (
    @slug, @title, @description, '', datetime('now'), NULL,
    '', 'past', @poster_url, 0, 1, 9999
  )
  ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    poster_url = excluded.poster_url,
    updated_at = datetime('now')
`);

const seedMedia = db.prepare(`
  INSERT INTO event_media (event_id, media_type, url, alt_text, sort_order)
  SELECT @event_id, 'image', @url, @alt_text, @sort_order
  WHERE NOT EXISTS (
    SELECT 1 FROM event_media WHERE event_id = @event_id AND url = @url
  )
`);

function copySeedImages() {
  let copied = 0;
  SEED_FILES.forEach((name, i) => {
    const src = path.join(CURSOR_ASSETS, name);
    const destName = `gallery-${String(i + 1).padStart(2, "0")}.jpg`;
    const dest = path.join(galleryDir, destName);
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
    copied += 1;
  });
  return copied;
}

const seed = db.transaction(() => {
  copySeedImages();

  const firstPoster = "./assets/gallery/gallery-01.jpg";
  upsertGalleryEvent.run({
    slug: GALLERY_EVENT_SLUG,
    title: "გალერეა",
    description: "Airsoft Club Georgia — ფოტო არქივი",
    poster_url: firstPoster
  });

  const event = db.prepare("SELECT id FROM events WHERE slug = ?").get(GALLERY_EVENT_SLUG);
  if (!event) return 0;

  let count = 0;
  for (let i = 0; i < SEED_FILES.length; i += 1) {
    const url = `./assets/gallery/gallery-${String(i + 1).padStart(2, "0")}.jpg`;
    const filePath = path.join(galleryDir, `gallery-${String(i + 1).padStart(2, "0")}.jpg`);
    if (!fs.existsSync(filePath)) continue;

    seedMedia.run({
      event_id: event.id,
      url,
      alt_text: `Airsoft Club Georgia — ოპერაცია ${i + 1}`,
      sort_order: i + 1
    });
    count += 1;
  }

  return count;
});

const seeded = seed();
console.log(`Gallery seeded (${seeded} images).`);
