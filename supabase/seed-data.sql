-- Airsoft Club Georgia — Seed data
-- Run AFTER schema.sql in Supabase SQL Editor
-- Replace YOUR_VERCEL_URL with your real domain (e.g. https://airsoft-club-georgia.vercel.app)

-- ============================================================
-- SHOP — 8 products
-- ============================================================
INSERT INTO products (sku, type, name, description, price, image, stock, active, sort_order)
VALUES
  ('lt-m4-gen2', 'rifle', 'Lancer Tactical M4 SD AEG Gen 2',
   'Electric AEG, 370-390 FPS, full metal gearbox, battery და charger ჩართული.',
   485, 'https://cdn11.bigcommerce.com/s-yck5k/images/stencil/1280x1280/products/13005/69734/lancer-tactical-m4-sd-airsoft-rifle-aeg-gen-2__01036.1610847650.jpg?c=2', 6, true, 1),
  ('de-ak-m900e', 'rifle', 'Double Eagle M900E AK-47 AEG',
   'ტაქტიკური AK პლატფორმა, 350 FPS, 400rnd მაგაზინა.',
   310, 'https://cdn11.bigcommerce.com/s-yck5k/images/stencil/1280x1280/products/1793/81985/double-eagle-m900e-tactical-ak-47-airsoft-rifle__84837.1628925346.jpg?c=2', 8, true, 2),
  ('wellfire-m4-d96', 'rifle', 'WellFire D96 M4 Carbine AEG',
   'M4 კარბინი scope-ით და grip-ით, საწყისი დონის AEG.',
   190, 'https://cdn11.bigcommerce.com/s-yck5k/images/stencil/1280x1280/products/20841/120134/wellfire-d96-m4-carbine-airsoft-aeg-rifle-w-scope-and-grip-black__13639.1697270385.jpg?c=2', 10, true, 3),
  ('wg-1911', 'pistol', 'WG Full Metal 1911 CO2 Pistol',
   'სრულმეტალი 1911 CO2 პისტოლეტი, ტაქტიკური secondary.',
   165, 'https://cdn11.bigcommerce.com/s-yck5k/images/stencil/1280x1280/products/5811/74266/wg-full-metal-us-combat-1911-co2-airsoft-pistol-black__02333.1615720901.jpg?c=2', 12, true, 4),
  ('vorsk-raven', 'pistol', 'Vorsk Raven R9-4 GBB Pistol',
   'GBB პისტოლეტი Tan ფერად, სწრაფი რეაგირება CQB-ში.',
   330, 'https://cdn11.bigcommerce.com/s-yck5k/images/stencil/1280x1280/products/22408/137199/vorsk-raven-r9-4-gbb-airsoft-pistol-tan__37561.1737921043.jpg?c=2', 7, true, 5),
  ('hk-p30', 'pistol', 'H&K P30 Electric Pistol',
   'Semi/Full Auto electric pistol, კომპაქტური და ხელმისაწვდომი.',
   125, 'https://cdn11.bigcommerce.com/s-yck5k/images/stencil/1280x1280/products/2780/80508/handk-p30-electric-airsoft-pistol-semifull-auto__69536.1626241218.jpg?c=2', 15, true, 6),
  ('wellfire-ak-wood', 'rifle', 'WellFire AK47 AEG Black/Wood',
   'კლასიკური AK47 სტილი ხის ელემენტებით.',
   215, 'https://cdn11.bigcommerce.com/s-yck5k/images/stencil/1280x1280/products/17811/84761/wellfire-ak47-aeg-airsoft-rifle-blackwood__19162.1635300656.jpg?c=2', 5, true, 7),
  ('fn-scar', 'rifle', 'FN Herstal SCAR LPEG',
   'Entry level SCAR electric rifle red dot sight-ით.',
   180, 'https://cdn11.bigcommerce.com/s-yck5k/images/stencil/1280x1280/products/12496/66987/fn-herstal-entry-level-scar-electric-lpeg-airsoft-rifle-w-red-dot-sight-black__42321.1610843216.jpg?c=2', 4, true, 8)
ON CONFLICT (sku) DO UPDATE SET
  type = EXCLUDED.type,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  image = EXCLUDED.image,
  stock = EXCLUDED.stock,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- EVENTS — sample operations
-- Replace YOUR_VERCEL_URL below with your site URL
-- ============================================================
INSERT INTO events (
  slug, title, description, location, starts_at, ends_at,
  status, status_type, poster_url, video_url, federation_link,
  maps_url, featured, published, sort_order
)
VALUES
  (
    'nuclear-winter-contra-2026',
    'ბირთვული ზამთარი [კონტრა]',
    'საქართველოს აირსოფტის ფედერაციის მხარდაჭერით — სცენარული ოპერაცია.',
    'კოჯორის პოლიგონი',
    '2026-01-25T10:00:00+04:00',
    '2026-01-26T18:00:00+04:00',
    'რეგისტრაცია გახსნილია', 'open',
    'https://images.unsplash.com/photo-1578885136359-16c8bd4f8fa1?auto=format&fit=crop&w=1200&q=80',
    NULL,
    'https://www.facebook.com/airsoft.georgia.federation',
    NULL, false, true, 1
  ),
  (
    'vaziani-tactical-2026',
    'ტაქტიკური დღე ვაზიანში',
    'ქვეყნის სხვადასხვა გუნდების ერთობლივი ტაქტიკური ვარჯიში.',
    'ვაზიანი',
    '2026-04-12T09:00:00+04:00',
    '2026-04-12T17:00:00+04:00',
    'ადგილები შეზღუდულია', 'limited',
    'https://images.unsplash.com/photo-1620650504312-6959f4614fd7?auto=format&fit=crop&w=1200&q=80',
    NULL, NULL, NULL, false, true, 2
  ),
  (
    'cqb-night-2026',
    'CQB ღამის თამაში',
    'მოკლე დისტანციის დინამიკური თამაში დაბალ განათებაზე.',
    'თბილისი',
    '2026-07-18T20:00:00+04:00',
    '2026-07-19T01:00:00+04:00',
    'ანონსი მალე', 'soon',
    '/assets/operations-featured.jpg',
    NULL, NULL, NULL, true, true, 3
  ),
  (
    'nuclear-winter-2025',
    'ბირთვული ზამთარი',
    'ფედერაციის მხარდაჭერით ჩატარებული სცენარული ოპერაცია.',
    'კოჯორის პოლიგონი',
    '2025-01-20T10:00:00+04:00',
    '2025-01-21T18:00:00+04:00',
    'დასრულებული', 'past',
    '/assets/nuclear-winter-poster.jpg',
    '/assets/hero-video.mp4',
    'https://www.facebook.com/airsoft.georgia.federation',
    NULL, true, true, 10
  ),
  (
    'club-gallery',
    'გალერეა',
    'Airsoft Club Georgia — ფოტო გალერეა',
    '',
    now(),
    NULL,
    '', 'past',
    '/assets/logo-circle.png',
    NULL, NULL, NULL, false, true, 9999
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  location = EXCLUDED.location,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  status = EXCLUDED.status,
  status_type = EXCLUDED.status_type,
  poster_url = EXCLUDED.poster_url,
  video_url = EXCLUDED.video_url,
  federation_link = EXCLUDED.federation_link,
  featured = EXCLUDED.featured,
  published = EXCLUDED.published,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Gallery images (served from your Vercel site /assets/gallery/)
INSERT INTO event_media (event_id, media_type, url, public_url, alt_text, sort_order)
SELECT e.id, 'image', '/assets/gallery/gallery-01.jpg', '/assets/gallery/gallery-01.jpg', 'გალერეა 01', 1
FROM events e WHERE e.slug = 'club-gallery'
  AND NOT EXISTS (
    SELECT 1 FROM event_media m
    WHERE m.event_id = e.id AND m.url = '/assets/gallery/gallery-01.jpg'
  );
