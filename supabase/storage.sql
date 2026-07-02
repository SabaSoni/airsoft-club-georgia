-- Airsoft Club Georgia — Storage bucket
-- Run AFTER schema.sql in Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-media',
  'event-media',
  true,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
DROP POLICY IF EXISTS "Public read event media files" ON storage.objects;
CREATE POLICY "Public read event media files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-media');

-- Authenticated users can upload (admin check is in API)
DROP POLICY IF EXISTS "Authenticated upload event media" ON storage.objects;
CREATE POLICY "Authenticated upload event media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated delete own uploads" ON storage.objects;
CREATE POLICY "Authenticated delete own uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-media' AND auth.role() = 'authenticated');
