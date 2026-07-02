const express = require("express");
const { listEvents, getEventBySlug, splitEvents, mapEvent, formatEventDate } = require("../db/events");
const {
  getEventIdBySlug,
  getAttendanceCount,
  isUserAttending,
  attend,
  unattend,
  attachAttendance
} = require("../db/attendance");
const { requireAuth } = require("../middleware/auth");
const supabase = require("../services/supabase");
const { GALLERY_EVENT_SLUG } = require("../db/gallery");
const { filterEventsToCurrentWeek, getWeekMeta } = require("../db/week-range");

const router = express.Router();

function enrichEvent(event) {
  const { formatEventDate } = require("../db/events");
  const end = new Date(event.endsAt || event.startsAt);
  const start = new Date(event.startsAt);
  const now = new Date();
  return {
    ...event,
    dateLabel: event.dateLabel || formatEventDate(event.startsAt, event.endsAt),
    isPast: end < now,
    isUpcoming: start > now,
    isOngoing: start <= now && end >= now,
    statusType: end < now ? "past" : event.statusType
  };
}

async function getAllEvents() {
  let events;
  if (supabase.isConfigured()) {
    const remote = await supabase.fetchPublishedEvents();
    if (remote?.length) events = remote.map(enrichEvent);
    else events = listEvents().map(enrichEvent);
  } else {
    events = listEvents().map(enrichEvent);
  }

  const localRecurring = listEvents().filter((e) => e.slug.startsWith("lilo-sunday-"));
  if (localRecurring.length) {
    events = events.filter((e) => !e.slug.startsWith("lilo-sunday-"));
    for (const local of localRecurring) {
      events.push(enrichEvent(local));
    }
  }

  events.sort((a, b) => {
    const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (order !== 0) return order;
    return new Date(a.startsAt) - new Date(b.startsAt);
  });

  return events.filter((e) => e.slug !== GALLERY_EVENT_SLUG);
}

router.get("/", async (req, res) => {
  try {
    let events = await getAllEvents();
    events = filterEventsToCurrentWeek(events);
    events = attachAttendance(events, req.session?.userId);
    const { upcoming, ongoing, past } = splitEvents(events);
    res.json({ events, upcoming, ongoing, past, week: getWeekMeta() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ღონისძიებების ჩატვირთვა ვერ მოხერხდა" });
  }
});

router.get("/featured", async (req, res) => {
  try {
    let events = await getAllEvents();
    events = filterEventsToCurrentWeek(events);
    events = attachAttendance(events, req.session?.userId);
    const { upcoming } = splitEvents(events);
    const featured = upcoming.find((e) => e.featured) || upcoming[0] || null;
    res.json({ event: featured, week: getWeekMeta() });
  } catch (err) {
    res.status(500).json({ error: "ღონისძიების ჩატვირთვა ვერ მოხერხდა" });
  }
});

router.get("/:slug/attendance", (req, res) => {
  const eventId = getEventIdBySlug(req.params.slug);
  if (!eventId) {
    return res.status(404).json({ error: "ღონისძიება ვერ მოიძებნა" });
  }

  res.json({
    count: getAttendanceCount(eventId),
    attending: req.session?.userId ? isUserAttending(eventId, req.session.userId) : false
  });
});

router.post("/:slug/attend", requireAuth, (req, res) => {
  const eventId = getEventIdBySlug(req.params.slug);
  if (!eventId) {
    return res.status(404).json({ error: "ღონისძიება ვერ მოიძებნა" });
  }

  const event = getEventBySlug(req.params.slug);
  if (!event || event.isPast) {
    return res.status(400).json({ error: "ამ ღონისძიებაზე რეგისტრაცია დახურულია" });
  }

  const count = attend(eventId, req.session.userId);
  res.json({ message: "დაესწარიათ ოპერაციას", count, attending: true });
});

router.delete("/:slug/attend", requireAuth, (req, res) => {
  const eventId = getEventIdBySlug(req.params.slug);
  if (!eventId) {
    return res.status(404).json({ error: "ღონისძიება ვერ მოიძებნა" });
  }

  const count = unattend(eventId, req.session.userId);
  res.json({ message: "რეგისტრაცია გაუქმდა", count, attending: false });
});

router.get("/:slug", async (req, res) => {
  try {
    let event = null;
    if (supabase.isConfigured()) {
      event = await supabase.fetchEventBySlug(req.params.slug);
    }
    if (!event) {
      event = getEventBySlug(req.params.slug);
    } else if (req.params.slug.startsWith("lilo-sunday-")) {
      const local = getEventBySlug(req.params.slug);
      if (local) event = local;
    }
    if (!event) {
      return res.status(404).json({ error: "ღონისძიება ვერ მოიძებნა" });
    }
    const enriched = enrichEvent(event);
    const [withAttendance] = attachAttendance([enriched], req.session?.userId);
    res.json({ event: withAttendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ღონისძიების ჩატვირთვა ვერ მოხერხდა" });
  }
});

module.exports = router;
