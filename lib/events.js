const { getAdmin } = require("./supabase-admin");
const { filterEventsToCurrentWeek, getWeekMeta } = require("./week-range");

const GALLERY_SLUG = "club-gallery";

const MONTHS = [
  "იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი",
  "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"
];

function formatEventDate(startsAt, endsAt) {
  const start = new Date(startsAt);
  const y = start.getFullYear();
  const m = MONTHS[start.getMonth()];
  if (endsAt) {
    const end = new Date(endsAt);
    if (end.getMonth() !== start.getMonth() || end.getFullYear() !== y) {
      return `${y} • ${m} – ${MONTHS[end.getMonth()]}`;
    }
  }
  return `${y} • ${m}`;
}

function mapEventRow(row) {
  const end = new Date(row.ends_at || row.starts_at);
  const start = new Date(row.starts_at);
  const now = new Date();
  const isPast = end < now;
  const isUpcoming = start > now;

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
    status: isPast ? "დასრულებული" : row.status || "",
    statusType: isPast ? "past" : row.status_type || "soon",
    posterUrl: row.poster_url || "",
    videoUrl: row.video_url || null,
    federationLink: row.federation_link || null,
    mapsUrl: row.maps_url || null,
    featured: !!row.featured,
    published: row.published !== false,
    sortOrder: row.sort_order ?? 0,
    isPast,
    isUpcoming,
    isOngoing: !isPast && !isUpcoming,
    media,
    supabaseId: String(row.id)
  };
}

function splitEvents(events) {
  const upcoming = [];
  const ongoing = [];
  const past = [];
  for (const e of events) {
    if (e.isPast) past.push(e);
    else if (e.isOngoing) ongoing.push(e);
    else upcoming.push(e);
  }
  return { upcoming, ongoing, past };
}

async function fetchPublishedEvents() {
  const supabase = getAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("events")
    .select("*, event_media(*)")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || [])
    .map(mapEventRow)
    .filter((e) => e.slug !== GALLERY_SLUG);
}

async function fetchEventBySlug(slug) {
  const supabase = getAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("events")
    .select("*, event_media(*)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapEventRow(data);
}

async function attachAttendance(events, userId) {
  const supabase = getAdmin();
  if (!supabase || !events.length) return events;

  const slugs = events.map((e) => e.slug);
  const { data: eventRows } = await supabase.from("events").select("id, slug").in("slug", slugs);
  const idBySlug = Object.fromEntries((eventRows || []).map((r) => [r.slug, r.id]));
  const eventIds = Object.values(idBySlug);

  const { data: counts } = await supabase
    .from("event_attendees")
    .select("event_id")
    .in("event_id", eventIds);

  const countMap = {};
  for (const row of counts || []) {
    countMap[row.event_id] = (countMap[row.event_id] || 0) + 1;
  }

  let attendingIds = new Set();
  if (userId) {
    const { data: mine } = await supabase
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", userId)
      .in("event_id", eventIds);
    attendingIds = new Set((mine || []).map((r) => r.event_id));
  }

  return events.map((e) => {
    const eid = idBySlug[e.slug];
    return {
      ...e,
      attendeeCount: countMap[eid] || 0,
      isAttending: attendingIds.has(eid)
    };
  });
}

async function getEventsPayload(userId) {
  let events = await fetchPublishedEvents();
  events = filterEventsToCurrentWeek(events);
  events = await attachAttendance(events, userId);
  const { upcoming, ongoing, past } = splitEvents(events);
  return { events, upcoming, ongoing, past, week: getWeekMeta() };
}

module.exports = {
  GALLERY_SLUG,
  mapEventRow,
  splitEvents,
  fetchPublishedEvents,
  fetchEventBySlug,
  attachAttendance,
  getEventsPayload
};
