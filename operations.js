const FEDERATION_FB = "https://www.facebook.com/airsoft.georgia.federation";

const LOADING_HTML = `<p class="shop-loading">იტვირთება...</p>`;

let eventsData = { upcoming: [], ongoing: [], past: [], events: [], week: null };
let weekRefreshTimer = null;

function setSectionLoading(ids) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = LOADING_HTML;
  });
}

function observeReveals(container) {
  if (!window.ACG?.revealObserver) return;
  container.querySelectorAll(".reveal-up:not(.is-visible)").forEach((el) => {
    window.ACG.revealObserver.observe(el);
  });
}

function bindVideoPlay(container) {
  container.querySelectorAll("[data-play-video]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = btn.dataset.playVideo;
      openVideoModal(url);
    });
  });
}

function openVideoModal(url) {
  if (window.ACG_VIDEO) {
    window.ACG_VIDEO.open(url);
  }
}

function updateWeekLabel() {
  const el = document.getElementById("operationsWeekLabel");
  if (!el || !eventsData.week?.label) return;
  el.textContent = `ამ კვირა: ${eventsData.week.label} (ორშაბათი – კვირა)`;
}

function scheduleWeekRefresh() {
  if (weekRefreshTimer) clearTimeout(weekRefreshTimer);
  if (!eventsData.week?.weekEnd) return;

  const ms = new Date(eventsData.week.weekEnd).getTime() - Date.now() + 3000;
  if (ms <= 0) return;

  weekRefreshTimer = setTimeout(() => {
    initOperations();
  }, ms);
}

function renderCountdownSection(event) {
  const { renderCountdown, eventUrl } = window.ACG_EVENTS;
  const section = document.getElementById("eventCountdown");
  if (!section || !event) {
    if (section) section.hidden = true;
    return;
  }

  section.hidden = false;
  const target = document.getElementById("countdownTarget");
  const title = document.getElementById("countdownTitle");
  const meta = document.getElementById("countdownMeta");
  const link = document.getElementById("countdownLink");
  const posterWrap = document.getElementById("countdownPosterWrap");
  const poster = document.getElementById("countdownPoster");

  if (title) title.textContent = event.title;
  if (meta) meta.textContent = `${event.dateLabel || ""} • ${event.location || ""}`;
  if (link) link.href = eventUrl(event.slug);

  if (poster && posterWrap && event.posterUrl) {
    poster.src = event.posterUrl;
    poster.alt = event.title;
    posterWrap.hidden = false;
  }

  if (target) {
    renderCountdown(target, event.startsAt, "საწყისამდე დარჩა");
  }
}

function renderTeaser(container) {
  if (!container) return;

  const { BADGE_CLASS, eventUrl } = window.ACG_EVENTS;
  const upcoming = eventsData.upcoming;
  if (!upcoming.length) {
    container.innerHTML = `<p class="shop-empty">ახალი ღონისძიებები მალე დაემატება.</p>`;
    return;
  }

  const featured = upcoming.find((e) => e.featured) || upcoming[0];
  const others = upcoming.filter((e) => e.slug !== featured.slug).slice(0, 2);

  container.innerHTML = `
    <div class="ops-featured reveal-up">
      <a href="${eventUrl(featured.slug)}" class="ops-featured__media">
        <img src="${featured.posterUrl}" alt="${featured.title}" loading="lazy" />
        ${
          featured.videoUrl
            ? `<button type="button" class="ops-featured__play" data-play-video="${featured.videoUrl}" aria-label="ვიდეოს ნახვა">
            <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          </button>`
            : ""
        }
      </a>
      <div class="ops-featured__body">
        <div class="ops-featured__meta">
          <span class="badge ${BADGE_CLASS[featured.statusType] || "badge--soon"}">${featured.status}</span>
          ${featured.federationLink ? `<a href="${featured.federationLink}" target="_blank" rel="noreferrer" class="ops-featured__fed">ფედერაცია</a>` : ""}
        </div>
        <h3 class="ops-featured__title">${featured.title}</h3>
        <p class="ops-featured__when">${featured.dateLabel} • ${featured.location}</p>
        <p class="ops-featured__desc">${featured.description}</p>
        <div class="ops-featured__attendance" data-attendance-mount="${featured.slug}"></div>
        <div class="ops-featured__actions">
          <a href="${eventUrl(featured.slug)}" class="btn btn-primary btn-sm">დეტალები</a>
          <a href="${FEDERATION_FB}" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm">ფედერაცია</a>
        </div>
      </div>
    </div>
    <div class="ops-mini-grid">
      ${others
        .map(
          (op, i) => `
        <a href="${eventUrl(op.slug)}" class="ops-mini-card reveal-up" style="--delay: ${(i + 1) * 0.08}s">
          <div class="ops-mini-card__img">
            <img src="${op.posterUrl}" alt="${op.title}" loading="lazy" />
          </div>
          <div class="ops-mini-card__body">
            <span class="badge ${BADGE_CLASS[op.statusType]}">${op.status}</span>
            <h4>${op.title}</h4>
            <p>${op.dateLabel} • ${op.location}</p>
          </div>
        </a>
      `
        )
        .join("")}
    </div>
  `;

  bindVideoPlay(container);
  mountAttendance(container, eventsData);
  observeReveals(container);
}

function mountAttendance(container, data) {
  if (!window.ACG_ATTENDANCE) return;
  const all = [...(data.upcoming || []), ...(data.ongoing || [])];
  const bySlug = Object.fromEntries(all.map((e) => [e.slug, e]));

  container.querySelectorAll("[data-attendance-mount]").forEach((el) => {
    const slug = el.dataset.attendanceMount;
    const event = bySlug[slug];
    if (!event) return;
    window.ACG_ATTENDANCE.mount(el, slug, {
      count: event.attendeeCount || 0,
      attending: event.isAttending || false,
      compact: true
    });
  });
}

function renderTimeline(container) {
  if (!container) return;

  const { BADGE_CLASS, eventUrl } = window.ACG_EVENTS;
  const items = [...eventsData.upcoming, ...eventsData.ongoing];
  if (!items.length) {
    container.innerHTML = `<p class="shop-empty">ამჟამად მომავალი ღონისძიებები არ არის.</p>`;
    return;
  }

  container.innerHTML = items
    .map(
      (op, i) => `
    <div class="timeline-item reveal-up" style="--delay: ${i * 0.1}s">
      <article class="card timeline-card">
        ${op.posterUrl ? `<img class="timeline-card__thumb" src="${op.posterUrl}" alt="" loading="lazy" />` : ""}
        <h3 class="timeline-card__title">${op.title}</h3>
        <p class="timeline-card__meta">${op.dateLabel} • ${op.location}</p>
        <p class="timeline-card__desc">${op.description}</p>
        <div class="timeline-card__attendance" data-attendance-mount="${op.slug}"></div>
        <div class="timeline-card__footer">
          <span class="badge ${BADGE_CLASS[op.statusType] || "badge--soon"}">${op.status}</span>
          <a href="${eventUrl(op.slug)}" class="btn btn-outline btn-sm">დეტალები</a>
        </div>
      </article>
    </div>
  `
    )
    .join("");

  mountAttendance(container, eventsData);
  observeReveals(container);
}

function renderPastOperations(container) {
  if (!container) return;

  const { eventUrl } = window.ACG_EVENTS;
  const items = eventsData.past;
  if (!items.length) {
    container.innerHTML = `<p class="shop-empty">არქივი ცარიელია.</p>`;
    return;
  }

  container.innerHTML = items
    .map(
      (op, i) => `
    <a href="${eventUrl(op.slug)}" class="past-op-card reveal-up" style="--delay: ${i * 0.08}s">
      <img src="${op.posterUrl}" alt="${op.title} — ღონისძიების ფოტო" loading="lazy" />
      ${
        op.media?.some((m) => m.mediaType === "video") || op.videoUrl
          ? `
        <div class="past-op-card__play" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      `
          : ""
      }
      <div class="past-op-card__overlay">
        <h4 class="past-op-card__title">${op.title}</h4>
        <span class="past-op-card__cta">გალერეა →</span>
      </div>
    </a>
  `
    )
    .join("");

  observeReveals(container);
}

async function initOperations() {
  const timeline = document.getElementById("operationsTimeline");
  const teaser = document.getElementById("operationsTeaser");
  const pastGrid = document.getElementById("pastOpsGrid");

  setSectionLoading(["operationsTimeline", "operationsTeaser", "pastOpsGrid"]);

  try {
    const loader = window.ACG_EVENTS_LOAD || window.ACG_EVENTS.getAll();
    eventsData = await loader;
    window.ACG.operations = eventsData;
  } catch (err) {
    console.error(err);
    eventsData = { upcoming: [], ongoing: [], past: [], events: [], week: null };
  }

  updateWeekLabel();
  renderCountdownSection(eventsData.upcoming.find((e) => e.featured) || eventsData.upcoming[0]);
  if (teaser) renderTeaser(teaser);
  if (timeline) renderTimeline(timeline);
  if (pastGrid) renderPastOperations(pastGrid);
  scheduleWeekRefresh();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOperations);
} else {
  initOperations();
}

window.ACG = window.ACG || {};
window.ACG.refreshOperations = initOperations;
