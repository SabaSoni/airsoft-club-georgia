let client = null;

const { createClient } = require("@supabase/supabase-js");
const { formatEventDate } = require("../db/events");

function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}

function isConfigured() {
  return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

function mapRow(row) {
  const media = (row.event_media || []).map((m) => ({
    id: m.id,
    mediaType: m.media_type,
    url: m.public_url || m.url,
    altText: m.alt_text || "",
    sortOrder: m.sort_order ?? 0
  }));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || "",
    location: row.location || "",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    dateLabel: formatEventDate(row.starts_at, row.ends_at),
    status: row.status || "",
    statusType: row.status_type || "soon",
    posterUrl: row.poster_url || "",
    videoUrl: row.video_url || null,
    federationLink: row.federation_link || null,
    featured: !!row.featured,
    published: row.published !== false,
    sortOrder: row.sort_order ?? 0,
    media,
    supabaseId: String(row.id)
  };
}

async function fetchPublishedEvents() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("events")
    .select("*, event_media(*)")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("starts_at", { ascending: true });

  if (error) {
    console.warn("Supabase fetch events:", error.message);
    return null;
  }

  return (data || []).map(mapRow);
}

async function fetchEventBySlug(slug) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("events")
    .select("*, event_media(*)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

async function upsertEvent(event) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const payload = {
    slug: event.slug,
    title: event.title,
    description: event.description,
    location: event.location,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    status: event.status,
    status_type: event.status_type,
    poster_url: event.poster_url,
    video_url: event.video_url,
    federation_link: event.federation_link,
    featured: !!event.featured,
    published: event.published !== 0,
    sort_order: event.sort_order ?? 0
  };

  const { data, error } = await supabase.from("events").upsert(payload, { onConflict: "slug" }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function uploadMedia(eventSlug, file, mediaType) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const ext = file.originalname.split(".").pop();
  const path = `${eventSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("event-media").upload(path, file.buffer, {
    contentType: file.mimetype,
    upsert: false
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from("event-media").getPublicUrl(path);

  const { data: event } = await supabase.from("events").select("id").eq("slug", eventSlug).single();
  if (!event) throw new Error("Event not found in Supabase");

  const { data: media, error } = await supabase
    .from("event_media")
    .insert({
      event_id: event.id,
      media_type: mediaType,
      url: path,
      public_url: urlData.publicUrl,
      alt_text: file.originalname
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return media;
}

module.exports = {
  isConfigured,
  fetchPublishedEvents,
  fetchEventBySlug,
  upsertEvent,
  uploadMedia,
  getSupabase
};
