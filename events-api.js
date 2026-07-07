/** Events API — reads from /api/events (Supabase-backed when configured) */

const EVENTS_CACHE_KEY = "acg-events-cache-v1";
const EVENTS_CACHE_MS = 3 * 60 * 1000;

async function apiRequest(path) {
  const res = await fetch(path, { credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "მოთხოვნა ვერ შესრულდა");
  return data;
}

function readEventsCache() {
  try {
    const raw = sessionStorage.getItem(EVENTS_CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (!data || Date.now() - ts > EVENTS_CACHE_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeEventsCache(data) {
  try {
    sessionStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}
}

let eventsFetchPromise = null;

function fetchEventsFresh() {
  if (!eventsFetchPromise) {
    eventsFetchPromise = apiRequest("/api/events")
      .then((data) => {
        writeEventsCache(data);
        return data;
      })
      .finally(() => {
        eventsFetchPromise = null;
      });
  }
  return eventsFetchPromise;
}

window.ACG_EVENTS = {
  async getAll(options = {}) {
    const cached = !options.force ? readEventsCache() : null;
    if (cached) {
      fetchEventsFresh().catch(() => {});
      return cached;
    }
    return fetchEventsFresh();
  },

  async getFeatured() {
    return apiRequest("/api/events/featured");
  },

  async getBySlug(slug) {
    return apiRequest(`/api/events/${encodeURIComponent(slug)}`);
  },

  eventUrl(slug) {
    return `event.html?slug=${encodeURIComponent(slug)}`;
  }
};

function formatCountdown(targetIso) {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, total: diff };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function renderCountdown(el, targetIso, label) {
  if (!el || !targetIso) return null;

  const tick = () => {
    const c = formatCountdown(targetIso);
    if (!c) {
      el.innerHTML = `<p class="countdown-pro__ended">ოპერაცია დაიწყო!</p>`;
      return false;
    }
    el.innerHTML = `
      ${label ? `<p class="countdown-pro__caption">${label}</p>` : ""}
      <div class="countdown-pro__track" role="timer" aria-live="polite">
        <div class="countdown-pro__unit">
          <div class="countdown-pro__face"><span class="countdown-pro__num">${pad(c.days)}</span></div>
          <span class="countdown-pro__lbl">დღე</span>
        </div>
        <span class="countdown-pro__colon" aria-hidden="true">:</span>
        <div class="countdown-pro__unit">
          <div class="countdown-pro__face"><span class="countdown-pro__num">${pad(c.hours)}</span></div>
          <span class="countdown-pro__lbl">საათი</span>
        </div>
        <span class="countdown-pro__colon" aria-hidden="true">:</span>
        <div class="countdown-pro__unit">
          <div class="countdown-pro__face"><span class="countdown-pro__num">${pad(c.minutes)}</span></div>
          <span class="countdown-pro__lbl">წუთი</span>
        </div>
        <span class="countdown-pro__colon" aria-hidden="true">:</span>
        <div class="countdown-pro__unit countdown-pro__unit--seconds">
          <div class="countdown-pro__face countdown-pro__face--pulse"><span class="countdown-pro__num">${pad(c.seconds)}</span></div>
          <span class="countdown-pro__lbl">წამი</span>
        </div>
      </div>
    `;
    return true;
  };

  if (!tick()) return null;
  const id = setInterval(() => {
    if (!tick()) clearInterval(id);
  }, 1000);
  return id;
}

window.ACG_EVENTS.formatCountdown = formatCountdown;
window.ACG_EVENTS.renderCountdown = renderCountdown;

const BADGE_CLASS = {
  open: "badge--open",
  limited: "badge--limited",
  soon: "badge--soon",
  past: "badge--past"
};

window.ACG_EVENTS.BADGE_CLASS = BADGE_CLASS;

/** Start loading events immediately (before api.js / Supabase). */
window.ACG_EVENTS_LOAD = window.ACG_EVENTS.getAll();
