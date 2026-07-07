let galleryItems = [];
let currentIndex = 0;
let isAdmin = false;

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function observeReveals(container) {
  if (!window.ACG?.revealObserver) return;
  container.querySelectorAll(".reveal-up:not(.is-visible)").forEach((el) => {
    window.ACG.revealObserver.observe(el);
  });
}

function renderGallery(limit = null) {
  const grid = document.getElementById("galleryGrid");
  const empty = document.getElementById("galleryEmpty");
  if (!grid) return;

  const items = limit ? galleryItems.slice(0, limit) : galleryItems;

  if (!items.length) {
    grid.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  grid.innerHTML = items
    .map(
      (item, i) => `
    <figure class="gallery-scroll__item masonry-item reveal-up" style="--delay: ${(i % 12) * 0.04}s" data-index="${i}">
      <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" />
      <div class="masonry-item__overlay">
        <span class="masonry-item__icon" aria-hidden="true">+</span>
        ${item.eventTitle && item.eventSlug !== "club-gallery" ? `<span class="gallery-scroll__caption">${escapeHtml(item.eventTitle)}</span>` : ""}
      </div>
      ${
        isAdmin
          ? `<button type="button" class="gallery-admin-delete" data-delete-id="${item.id}" aria-label="წაშლა">✕</button>`
          : ""
      }
    </figure>
  `
    )
    .join("");

  grid.querySelectorAll(".masonry-item").forEach((fig) => {
    fig.addEventListener("click", (e) => {
      if (e.target.closest(".gallery-admin-delete")) return;
      openLightbox(parseInt(fig.dataset.index, 10));
    });
  });

  grid.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("წავშალოთ ეს ფოტო გალერეიდან?")) return;
      try {
        const res = await fetch(`/api/gallery/${btn.dataset.deleteId}`, {
          method: "DELETE",
          credentials: "same-origin"
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "შეცდომა");
        await loadGallery();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  observeReveals(grid);
}

function openLightbox(index) {
  currentIndex = index;
  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImage");
  const caption = document.getElementById("lightboxCaption");
  if (!lightbox || !img || !galleryItems[currentIndex]) return;

  const item = galleryItems[currentIndex];
  img.src = item.src;
  img.alt = item.alt;
  if (caption) {
    caption.textContent = item.eventTitle && item.eventSlug !== "club-gallery" ? item.eventTitle : item.alt;
    caption.hidden = !caption.textContent;
  }
  lightbox.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  lightbox.classList.remove("is-open");
  document.body.style.overflow = "";
}

function navigateLightbox(dir) {
  if (!galleryItems.length) return;
  currentIndex = (currentIndex + dir + galleryItems.length) % galleryItems.length;
  openLightbox(currentIndex);
}

function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;

  document.getElementById("lightboxClose")?.addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev")?.addEventListener("click", () => navigateLightbox(-1));
  document.getElementById("lightboxNext")?.addEventListener("click", () => navigateLightbox(1));

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") navigateLightbox(-1);
    if (e.key === "ArrowRight") navigateLightbox(1);
  });
}

async function loadGallery() {
  const res = await fetch("/api/gallery", { credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "გალერეის ჩატვირთვა ვერ მოხერხდა");
  galleryItems = data.items || [];
  window.ACG.galleryItems = galleryItems;

  const grid = document.getElementById("galleryGrid");
  const isTeaser = grid?.dataset.teaser === "true";
  renderGallery(isTeaser ? 6 : null);
}

async function setupAdminUpload() {
  const bar = document.getElementById("galleryAdminBar");
  const form = document.getElementById("galleryUploadForm");
  const msg = document.getElementById("galleryUploadMsg");
  const dropzone = document.getElementById("galleryDropzone");
  const fileInput = document.getElementById("galleryFileInput");

  if (!window.ACG_AUTH) return;

  try {
    const user = await window.ACG_AUTH.waitReady();
    isAdmin = !!user?.isAdmin;
  } catch (_) {
    isAdmin = false;
  }

  if (!isAdmin || !bar) return;

  bar.hidden = false;

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fileInput?.files?.length) {
      if (msg) msg.textContent = "აირჩიეთ ერთი ან მეტი ფოტო";
      return;
    }

    const fd = new FormData();
    for (const file of fileInput.files) {
      fd.append("files", file);
    }

    try {
      if (msg) msg.textContent = "იტვირთება...";
      const res = await fetch("/api/gallery/upload", {
        method: "POST",
        credentials: "same-origin",
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ატვირთვა ვერ მოხერხდა");
      form.reset();
      if (msg) msg.textContent = "ატვირთულია ✓";
      await loadGallery();
    } catch (err) {
      if (msg) msg.textContent = err.message;
    }
  });

  if (dropzone && fileInput) {
    ["dragenter", "dragover"].forEach((ev) => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });
    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer?.files?.length) {
        fileInput.files = e.dataTransfer.files;
      }
    });
    dropzone.addEventListener("click", () => fileInput.click());
  }
}

async function initGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  setupLightbox();
  await setupAdminUpload();

  try {
    await loadGallery();
  } catch (err) {
    const empty = document.getElementById("galleryEmpty");
    if (empty) {
      empty.hidden = false;
      empty.textContent = err.message;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGallery);
} else {
  initGallery();
}

window.ACG = window.ACG || {};
window.ACG.refreshGallery = loadGallery;
