(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const root = document.getElementById("eventRoot");
  const { BADGE_CLASS, renderCountdown, eventUrl } = window.ACG_EVENTS;

  let galleryImages = [];
  let currentIndex = 0;

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function renderEvent(event) {
    document.title = `${event.title} | Airsoft Club Georgia`;

    const isPast = event.isPast || new Date(event.endsAt || event.startsAt) < new Date();
    const isUpcoming = new Date(event.startsAt) > new Date();
    const images = (event.media || []).filter((m) => m.mediaType === "image");
    const videos = (event.media || []).filter((m) => m.mediaType === "video");
    if (event.videoUrl && !videos.some((v) => v.url === event.videoUrl)) {
      videos.unshift({ url: event.videoUrl, altText: event.title });
    }

    galleryImages = images.map((img) => ({ src: img.url, alt: img.altText || event.title }));

    root.innerHTML = `
      <section class="event-hero">
        <div class="event-hero__bg">
          <img src="${escapeHtml(event.posterUrl)}" alt="" />
        </div>
        <div class="event-hero__overlay"></div>
        <div class="container event-hero__content reveal-up">
          <a href="operations.html" class="event-hero__back">← ოპერაციები</a>
          <span class="badge ${BADGE_CLASS[event.statusType] || "badge--soon"}">${escapeHtml(event.status)}</span>
          <h1 class="event-hero__title">${escapeHtml(event.title)}</h1>
          <p class="event-hero__meta">${escapeHtml(event.dateLabel)} • ${escapeHtml(event.location)}</p>
          ${event.mapsUrl ? `<a href="${escapeHtml(event.mapsUrl)}" target="_blank" rel="noreferrer" class="event-hero__maps">რუკაზე ნახვა →</a>` : ""}
          ${event.federationLink ? `<a href="${escapeHtml(event.federationLink)}" target="_blank" rel="noreferrer" class="event-hero__fed">ფედერაცია Facebook-ზე</a>` : ""}
        </div>
      </section>

      <section class="section">
        <div class="container event-detail">
          <div class="event-detail__main reveal-up">
            <h2 class="section-title">აღწერა</h2>
            <p class="event-detail__desc">${escapeHtml(event.description)}</p>
            ${isUpcoming ? `<div id="eventPageCountdown" class="countdown countdown--inline"></div>` : ""}
            ${!isPast ? `<div id="eventAttendance" class="event-attendance reveal-up"></div>` : ""}
          </div>
        </div>
      </section>

      ${
        videos.length
          ? `
      <section class="section section--surface">
        <div class="container">
          <div class="section-header reveal-up">
            <span class="section-label">ვიდეო</span>
            <h2 class="section-title">ღონისძიების ვიდეო</h2>
          </div>
          <div class="event-videos stagger-children">
            ${videos
              .map(
                (v) => `
              <div class="event-video-block reveal-up">
                <video controls preload="metadata" poster="${escapeHtml(event.posterUrl)}">
                  <source src="${escapeHtml(v.url)}" type="video/mp4" />
                </video>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </section>
      `
          : isPast
            ? `
      <section class="section section--surface">
        <div class="container">
          <p class="shop-empty reveal-up">ვიდეო მალე დაემატება ადმინ პანელიდან.</p>
        </div>
      </section>
      `
            : ""
      }

      ${
        galleryImages.length
          ? `
      <section class="section" id="eventGallery">
        <div class="container">
          <div class="section-header reveal-up">
            <span class="section-label">გალერეა</span>
            <h2 class="section-title">ფოტო მასალები</h2>
          </div>
          <div id="eventGalleryGrid" class="masonry event-gallery"></div>
        </div>
      </section>
      `
          : isPast
            ? `
      <section class="section" id="eventGallery">
        <div class="container">
          <p class="shop-empty reveal-up">ფოტოები მალე დაემატება ადმინ პანელიდან.</p>
        </div>
      </section>
      `
            : ""
      }
    `;

    if (isUpcoming) {
      const cd = document.getElementById("eventPageCountdown");
      renderCountdown(cd, event.startsAt, "საწყისამდე დარჩა");
    }

    const attendanceEl = document.getElementById("eventAttendance");
    if (attendanceEl && window.ACG_ATTENDANCE) {
      window.ACG_ATTENDANCE.mount(attendanceEl, event.slug, {
        count: event.attendeeCount || 0,
        attending: event.isAttending || false
      });
    }

    if (galleryImages.length) {
      const grid = document.getElementById("eventGalleryGrid");
      grid.innerHTML = galleryImages
        .map(
          (item, i) => `
        <figure class="masonry-item reveal-up" style="--delay: ${i * 0.05}s" data-index="${i}">
          <img src="${item.src}" alt="${escapeHtml(item.alt)}" loading="lazy" />
          <div class="masonry-item__overlay"><span class="masonry-item__icon">+</span></div>
        </figure>
      `
        )
        .join("");

      grid.querySelectorAll(".masonry-item").forEach((fig) => {
        fig.addEventListener("click", () => openLightbox(parseInt(fig.dataset.index, 10)));
      });
    }

    if (window.ACG?.revealObserver) {
      root.querySelectorAll(".reveal-up").forEach((el) => window.ACG.revealObserver.observe(el));
    }
  }

  function openLightbox(index) {
    currentIndex = index;
    const lightbox = document.getElementById("lightbox");
    const img = document.getElementById("lightboxImage");
    if (!lightbox || !img || !galleryImages.length) return;
    img.src = galleryImages[currentIndex].src;
    img.alt = galleryImages[currentIndex].alt;
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    document.getElementById("lightbox")?.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function navigateLightbox(dir) {
    if (!galleryImages.length) return;
    currentIndex = (currentIndex + dir + galleryImages.length) % galleryImages.length;
    const img = document.getElementById("lightboxImage");
    if (img) {
      img.src = galleryImages[currentIndex].src;
      img.alt = galleryImages[currentIndex].alt;
    }
  }

  function setupLightbox() {
    document.getElementById("lightboxClose")?.addEventListener("click", closeLightbox);
    document.getElementById("lightboxPrev")?.addEventListener("click", () => navigateLightbox(-1));
    document.getElementById("lightboxNext")?.addEventListener("click", () => navigateLightbox(1));
    document.getElementById("lightbox")?.addEventListener("click", (e) => {
      if (e.target.id === "lightbox") closeLightbox();
    });
    document.addEventListener("keydown", (e) => {
      const lb = document.getElementById("lightbox");
      if (!lb?.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") navigateLightbox(-1);
      if (e.key === "ArrowRight") navigateLightbox(1);
    });
  }

  async function init() {
    setupLightbox();

    if (!slug) {
      root.innerHTML = `<p class="shop-empty">ღონისძიება ვერ მოიძებნა. <a href="operations.html">ოპერაციები</a></p>`;
      return;
    }

    try {
      const { event } = await window.ACG_EVENTS.getBySlug(slug);
      renderEvent(event);
    } catch (err) {
      root.innerHTML = `<p class="shop-empty">${escapeHtml(err.message)}. <a href="operations.html">უკან</a></p>`;
    }
  }

  init();
})();
