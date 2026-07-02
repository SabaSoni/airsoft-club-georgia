(function () {
  "use strict";

  const VIDEOS = [
    {
      id: "nuclear-winter-2025",
      title: "ბირთვული ზამთარი",
      meta: "20–21 იანვარი, 2025 • კოჯორის პოლიგონი",
      description:
        "ფედერაციის მხარდაჭერით ჩატარებული სცენარული ოპერაცია — ოფიციალური ვიდეოჩანაწერი ველიდან.",
      src: "./assets/hero-video.mp4",
      poster: "./assets/nuclear-winter-poster.jpg",
      eventSlug: "nuclear-winter-2025"
    },
    {
      id: "nuclear-winter-contra",
      title: "ბირთვული ზამთარი [კონტრა]",
      meta: "25–26 იანვარი, 2026 • კოჯორის პოლიგონი",
      description: "საქართველოს აირსოფტის ფედერაციის მხარდაჭერით — სცენარული ოპერაციის ვიდეომასალა.",
      src: "./assets/FDownloader.net-1013343016867147-(1080p).mp4",
      poster: "./assets/team-group.jpg",
      eventSlug: "nuclear-winter-contra-2026"
    },
    {
      id: "acg-highlights",
      title: "ACG × ფედერაცია — ჰაილაითები",
      meta: "ღონისძიებების არქივი • საქართველო",
      description: "გუნდური თამაშის საუკეთესო მომენტები ტაქტიკური ოპერაციებიდან და ღონისძიებებიდან.",
      src: "./assets/FDownloader.net-1111655623627883-(1080p).mp4",
      poster: "./assets/operations-featured.jpg",
      eventSlug: null
    }
  ];

  const player = document.getElementById("videosMainPlayer");
  const titleEl = document.getElementById("videosMainTitle");
  const metaEl = document.getElementById("videosMainMeta");
  const descEl = document.getElementById("videosMainDesc");
  const playlistEl = document.getElementById("videosPlaylist");
  const stageEl = document.getElementById("videosStage");
  const countEl = document.getElementById("videosCount");

  if (!player || !playlistEl) return;

  let activeId = VIDEOS[0].id;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getVideo(id) {
    return VIDEOS.find((v) => v.id === id) || VIDEOS[0];
  }

  function setActive(id, { autoplay = false, scrollToStage = false } = {}) {
    const video = getVideo(id);
    if (!video) return;

    activeId = video.id;
    player.pause();
    player.poster = video.poster;
    player.src = video.src;
    player.load();

    if (titleEl) titleEl.textContent = video.title;
    if (metaEl) metaEl.textContent = video.meta;
    if (descEl) descEl.textContent = video.description;

    playlistEl.querySelectorAll(".videos-playlist__item").forEach((btn) => {
      const isActive = btn.dataset.videoId === video.id;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    if (autoplay) {
      player.play().catch(() => {});
    }

    if (scrollToStage && stageEl && window.matchMedia("(max-width: 899px)").matches) {
      stageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderPlaylist() {
    if (countEl) countEl.textContent = String(VIDEOS.length);

    playlistEl.innerHTML = VIDEOS.map((video, index) => {
      const eventLink = video.eventSlug
        ? `<a href="event.html?slug=${encodeURIComponent(video.eventSlug)}" class="videos-playlist__event-link">ოპერაციის გვერდი →</a>`
        : "";

      return `
        <button
          type="button"
          class="videos-playlist__item reveal-up${video.id === activeId ? " is-active" : ""}"
          style="--delay: ${index * 0.08}s"
          data-video-id="${video.id}"
          role="option"
          aria-selected="${video.id === activeId}"
        >
          <span class="videos-playlist__thumb">
            <img src="${escapeHtml(video.poster)}" alt="" loading="lazy" />
            <span class="videos-playlist__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            </span>
          </span>
          <span class="videos-playlist__body">
            <span class="videos-playlist__index">${String(index + 1).padStart(2, "0")}</span>
            <span class="videos-playlist__title">${escapeHtml(video.title)}</span>
            <span class="videos-playlist__meta">${escapeHtml(video.meta)}</span>
            ${eventLink}
          </span>
        </button>
      `;
    }).join("");

    playlistEl.querySelectorAll(".videos-playlist__item").forEach((btn) => {
      btn.addEventListener("click", () => {
        setActive(btn.dataset.videoId, { autoplay: true, scrollToStage: true });
      });
    });

    playlistEl.querySelectorAll(".videos-playlist__event-link").forEach((link) => {
      link.addEventListener("click", (e) => e.stopPropagation());
    });

    if (window.ACG?.revealObserver) {
      playlistEl.querySelectorAll(".reveal-up:not(.is-visible)").forEach((el) => {
        window.ACG.revealObserver.observe(el);
      });
    }
  }

  const params = new URLSearchParams(window.location.search);
  const requested = params.get("v");
  const initial = VIDEOS.some((v) => v.id === requested) ? requested : VIDEOS[0].id;
  const shouldAutoplay = params.get("play") === "1";

  renderPlaylist();
  setActive(initial, { autoplay: shouldAutoplay });

  if (window.ACG?.revealObserver) {
    document.querySelectorAll(".videos-section .reveal-up:not(.is-visible)").forEach((el) => {
      window.ACG.revealObserver.observe(el);
    });
  }
})();
