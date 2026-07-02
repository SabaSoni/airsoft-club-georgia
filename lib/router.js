const { json, readBody, parsePath } = require("./http");
const { isConfigured } = require("./supabase-admin");
const { getBearerUser, requireAuth, requireAdmin, mapProfile } = require("./auth");
const { getAdminEmail, isAdminEmail } = require("./admin");
const { listProducts, getProduct } = require("./products");
const { placeOrder, getOrder } = require("./orders");
const {
  getEventsPayload,
  fetchEventBySlug,
  fetchPublishedEvents,
  attachAttendance,
  splitEvents,
  GALLERY_SLUG
} = require("./events");
const { filterEventsToCurrentWeek } = require("./week-range");
const { getAdmin } = require("./supabase-admin");
const { formatPrice } = require("./format");

async function handleApi(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return;
  }

  if (!isConfigured()) {
    return json(res, 503, { error: "Supabase არ არის კონფიგურირებული" });
  }

  const path = parsePath(req);
  const method = req.method || "GET";

  try {
  // GET /config
  if (method === "GET" && path === "/config") {
    return json(res, 200, {
      runtime: "vercel",
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      supabaseConfigured: true
    });
  }

  if (method === "GET" && path === "/health") {
    return json(res, 200, { ok: true });
  }

  // Products
  if (method === "GET" && path === "/products") {
    const url = new URL(req.url, "http://localhost");
    const type = url.searchParams.get("type");
    const products = await listProducts(type);
    return json(res, 200, { products });
  }

  const productMatch = path.match(/^\/products\/([^/]+)$/);
  if (method === "GET" && productMatch) {
    const product = await getProduct(productMatch[1]);
    if (!product) return json(res, 404, { error: "პროდუქტი ვერ მოიძებნა" });
    return json(res, 200, { product });
  }

  // Contact
  if (method === "POST" && path === "/contact") {
    const body = await readBody(req);
    const name = String(body.name || "").trim().slice(0, 120);
    const phone = String(body.phone || "").trim().slice(0, 40);
    const message = String(body.message || "").trim().slice(0, 2000);
    if (!name || !phone || !message) {
      return json(res, 400, { error: "გთხოვთ შეავსოთ ყველა ველი" });
    }
    const supabase = getAdmin();
    const { error } = await supabase.from("contact_messages").insert({ name, phone, message });
    if (error) throw new Error(error.message);
    return json(res, 201, { message: "შეტყობინება მიღებულია. მალე დაგიკავშირდებით!" });
  }

  // Orders
  if (method === "POST" && path === "/orders") {
    const body = await readBody(req);
    const bearer = await getBearerUser(req);
    const order = await placeOrder({
      userId: bearer?.authUser?.id || null,
      userEmail: bearer?.profile?.email || null,
      body
    });
    return json(res, 201, { message: "შეკვეთა მიღებულია", order });
  }

  const orderMatch = path.match(/^\/orders\/([^/]+)$/);
  if (method === "GET" && orderMatch) {
    const bearer = await getBearerUser(req);
    const order = await getOrder(decodeURIComponent(orderMatch[1]), {
      userId: bearer?.authUser?.id || null,
      userEmail: bearer?.profile?.email || null
    });
    return json(res, 200, { order });
  }

  // Auth register-status
  if (method === "GET" && path === "/auth/register-status") {
    const adminEmail = getAdminEmail();
    const supabase = getAdmin();
    let adminExists = false;
    if (adminEmail && supabase) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", adminEmail)
        .eq("role", "admin")
        .maybeSingle();
      adminExists = !!data;
    }
    const masked = adminEmail ? adminEmail.replace(/^(.{2}).+(@.+)$/, "$1***$2") : null;
    return json(res, 200, {
      open: true,
      adminOpen: !!(adminEmail && !adminExists),
      adminEmail: adminEmail && !adminExists ? masked : null,
      supabaseAuth: true,
      message: adminEmail && !adminExists
        ? `ადმინისტრატორის რეგისტრაცია: ${masked}`
        : "შექმენით ანგარიში ოპერაციებზე რეგისტრაციისა და შეკვეთების სანახავად"
    });
  }

  // Promote first admin (ADMIN_EMAIL)
  if (method === "POST" && path === "/auth/promote-admin") {
    const bearer = await requireAuth(req);
    const adminEmail = getAdminEmail();
    if (!adminEmail || bearer.profile.email.toLowerCase() !== adminEmail) {
      return json(res, 200, { user: mapProfile(bearer.profile) });
    }
    const supabase = getAdmin();
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .neq("id", bearer.authUser.id)
      .maybeSingle();
    if (!existing) {
      await supabase.from("profiles").update({ role: "admin" }).eq("id", bearer.authUser.id);
      bearer.profile.role = "admin";
    }
    return json(res, 200, { user: mapProfile(bearer.profile) });
  }

  // Auth me
  if (method === "GET" && path === "/auth/me") {
    const bearer = await getBearerUser(req);
    if (!bearer) {
      return json(res, 200, {
        user: null,
        auth: { supabase: true, passwordMethods: ["current", "email"] }
      });
    }
    return json(res, 200, {
      user: mapProfile(bearer.profile),
      auth: { supabase: true, passwordMethods: ["current", "email"] }
    });
  }

  // User dashboard
  if (method === "GET" && path === "/user/dashboard") {
    const bearer = await requireAuth(req);
    const user = mapProfile(bearer.profile);
    const supabase = getAdmin();

    const { data: orders } = await supabase
      .from("orders")
      .select("order_number, total, status, payment_method, created_at")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: attendance } = await supabase
      .from("event_attendees")
      .select("created_at, events(slug, title, location, starts_at, ends_at, poster_url)")
      .eq("user_id", user.id);

    const now = Date.now();
    const eventsUpcoming = [];
    const eventsAttended = [];

    for (const row of attendance || []) {
      const e = row.events;
      if (!e) continue;
      const item = {
        slug: e.slug,
        title: e.title,
        location: e.location,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        posterUrl: e.poster_url,
        registeredAt: row.created_at
      };
      const end = new Date(e.ends_at || e.starts_at).getTime();
      if (end < now) eventsAttended.push(item);
      else eventsUpcoming.push(item);
    }

    return json(res, 200, {
      user,
      orders: (orders || []).map((o) => ({
        orderNumber: o.order_number,
        totalFormatted: formatPrice(o.total),
        status: o.status,
        paymentMethod: o.payment_method,
        createdAt: o.created_at
      })),
      eventsUpcoming,
      eventsAttended
    });
  }

  // Events
  if (method === "GET" && path === "/events") {
    const bearer = await getBearerUser(req);
    const payload = await getEventsPayload(bearer?.authUser?.id || null);
    return json(res, 200, payload);
  }

  if (method === "GET" && path === "/events/featured") {
    const bearer = await getBearerUser(req);
    const payload = await getEventsPayload(bearer?.authUser?.id || null);
    const featured = payload.upcoming.find((e) => e.featured) || payload.upcoming[0] || null;
    return json(res, 200, { event: featured, week: payload.week });
  }

  const attendMatch = path.match(/^\/events\/([^/]+)\/attend$/);
  if (attendMatch) {
    const slug = decodeURIComponent(attendMatch[1]);
    const supabase = getAdmin();
    const { data: event } = await supabase.from("events").select("id, starts_at, ends_at").eq("slug", slug).maybeSingle();
    if (!event) return json(res, 404, { error: "ღონისძიება ვერ მოიძებნა" });

    if (method === "GET") {
      const bearer = await getBearerUser(req);
      const { count } = await supabase
        .from("event_attendees")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);
      let attending = false;
      if (bearer) {
        const { data: row } = await supabase
          .from("event_attendees")
          .select("id")
          .eq("event_id", event.id)
          .eq("user_id", bearer.authUser.id)
          .maybeSingle();
        attending = !!row;
      }
      return json(res, 200, { count: count || 0, attending });
    }

    const bearer = await requireAuth(req);
    const end = new Date(event.ends_at || event.starts_at);
    if (end < new Date()) {
      return json(res, 400, { error: "ამ ღონისძიებაზე რეგისტრაცია დახურულია" });
    }

    if (method === "POST") {
      await supabase.from("event_attendees").upsert(
        { event_id: event.id, user_id: bearer.authUser.id },
        { onConflict: "event_id,user_id" }
      );
      const { count } = await supabase
        .from("event_attendees")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);
      return json(res, 200, { message: "დაესწარიათ ოპერაციას", count: count || 0, attending: true });
    }

    if (method === "DELETE") {
      await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", event.id)
        .eq("user_id", bearer.authUser.id);
      const { count } = await supabase
        .from("event_attendees")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);
      return json(res, 200, { message: "რეგისტრაცია გაუქმდა", count: count || 0, attending: false });
    }
  }

  const eventSlugMatch = path.match(/^\/events\/([^/]+)$/);
  if (method === "GET" && eventSlugMatch) {
    const slug = decodeURIComponent(eventSlugMatch[1]);
    const event = await fetchEventBySlug(slug);
    if (!event) return json(res, 404, { error: "ღონისძიება ვერ მოიძებნა" });
    const bearer = await getBearerUser(req);
    const [withAttendance] = await attachAttendance([event], bearer?.authUser?.id || null);
    return json(res, 200, { event: withAttendance });
  }

  // Gallery
  if (method === "GET" && path === "/gallery") {
    const supabase = getAdmin();
    const { data: galleryEvent } = await supabase.from("events").select("id").eq("slug", GALLERY_SLUG).maybeSingle();
    if (!galleryEvent) return json(res, 200, { items: [] });

    const { data: media } = await supabase
      .from("event_media")
      .select("id, url, public_url, alt_text, sort_order")
      .eq("event_id", galleryEvent.id)
      .eq("media_type", "image")
      .order("sort_order", { ascending: true });

    return json(res, 200, {
      items: (media || []).map((m) => ({
        id: m.id,
        src: m.public_url || m.url,
        alt: m.alt_text || "",
        eventSlug: GALLERY_SLUG
      }))
    });
  }

  // Admin — list events
  if (method === "GET" && path === "/admin/events") {
    await requireAdmin(req);
    const supabase = getAdmin();
    const { data, error } = await supabase.from("events").select("*").order("sort_order").order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { mapEventRow } = require("./events");
    return json(res, 200, { events: (data || []).map((r) => mapEventRow({ ...r, event_media: [] })) });
  }

  return json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("API error:", path, err);
    return json(res, err.status || 500, { error: err.message || "სერვერის შეცდომა" });
  }
}

module.exports = { handleApi };
