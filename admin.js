(function () {
  "use strict";

  const gate = document.getElementById("adminGate");
  const app = document.getElementById("adminApp");
  const eventList = document.getElementById("adminEventList");
  const eventForm = document.getElementById("eventForm");
  const adminEmpty = document.getElementById("adminEmpty");
  const mediaEventSelect = document.getElementById("mediaEventSelect");
  const mediaUploadZone = document.getElementById("mediaUploadZone");
  const mediaSelectPrompt = document.getElementById("mediaSelectPrompt");
  const mediaList = document.getElementById("mediaList");

  let events = [];
  let selectedId = null;
  let mediaSelectedId = null;
  let recurringStackOpen = false;

  const RECURRING_PREFIX = "lilo-sunday-";

  function field(name) {
    return eventForm.querySelector(`[name="${name}"]`);
  }

  function toLocalDatetime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  }

  function fromLocalDatetime(val) {
    if (!val) return null;
    return new Date(val).toISOString();
  }

  function showMsg(el, text, isError = false) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", isError);
  }

  async function adminRequest(path, options = {}) {
    const tokenHeaders = {};
    try {
      const cfg = await fetch("/api/config").then((r) => r.json());
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        const { createClient } = await import(
          "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm"
        );
        const client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        const {
          data: { session }
        } = await client.auth.getSession();
        if (session?.access_token) {
          tokenHeaders.Authorization = `Bearer ${session.access_token}`;
        }
      }
    } catch (_) {}

    const res = await fetch(`/api/admin${path}`, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...tokenHeaders,
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "შეცდომა");
    return data;
  }

  function switchTab(tab) {
    document.querySelectorAll(".admin-nav__btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.adminTab === tab);
    });
    document.querySelectorAll(".admin-panel").forEach((panel) => {
      const active = panel.dataset.panel === tab;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  document.querySelectorAll(".admin-nav__btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.adminTab));
  });

  async function checkAccess() {
    try {
      const { user } = await window.ACG_API.getMe();
      if (user?.isAdmin) {
        gate.hidden = true;
        app.hidden = false;
        const info = document.getElementById("adminAccountInfo");
        if (info) info.textContent = `${user.name} • ${user.email}`;
        await loadEvents();
        return;
      }
    } catch (_) {}
    gate.hidden = false;
    app.hidden = true;
  }

  async function loadEvents() {
    const data = await adminRequest("/events");
    events = data.events;
    renderEventList();
    renderMediaEventSelect();
  }

  const GALLERY_SLUG = "club-gallery";

  function operationEvents() {
    return events.filter((e) => e.slug !== GALLERY_SLUG);
  }

  function isRecurringEvent(event) {
    return event?.slug?.startsWith(RECURRING_PREFIX);
  }

  function partitionEvents(list) {
    const regular = [];
    const recurring = [];
    for (const e of list) {
      if (isRecurringEvent(e)) recurring.push(e);
      else regular.push(e);
    }
    recurring.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    return { regular, recurring };
  }

  function formatRecurringDate(event) {
    return new Intl.DateTimeFormat("ka-GE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Tbilisi"
    }).format(new Date(event.startsAt));
  }

  function renderEventList() {
    const { regular, recurring } = partitionEvents(operationEvents());
    const selectedRecurring = recurring.some((e) => e.id === selectedId);
    if (selectedRecurring) recurringStackOpen = true;

    const regularHtml = regular
      .map(
        (e) => `
      <li>
        <button type="button" class="admin-event-list__btn ${e.id === selectedId ? "is-active" : ""}" data-id="${e.id}">
          <strong>${e.title}</strong>
          <small>${e.dateLabel} • ${e.isPast ? "არქივი" : "მომავალი"}</small>
        </button>
      </li>
    `
      )
      .join("");

    const recurringHtml = recurring.length
      ? `
      <li class="admin-event-group ${recurringStackOpen ? "is-open" : ""}">
        <button
          type="button"
          class="admin-event-group__toggle ${selectedRecurring ? "is-active" : ""}"
          aria-expanded="${recurringStackOpen}"
          data-toggle-recurring
        >
          <span class="admin-event-group__chevron" aria-hidden="true">›</span>
          <span class="admin-event-group__label">
            <strong>კვირეული — ლილო</strong>
            <small>ყოველ კვირას 12:00 • ${recurring.length} თარიღი</small>
          </span>
          <span class="admin-event-group__count">${recurring.length}</span>
        </button>
        <ul class="admin-event-group__items" ${recurringStackOpen ? "" : "hidden"}>
          ${recurring
            .map(
              (e) => `
            <li>
              <button type="button" class="admin-event-list__btn admin-event-list__btn--nested ${e.id === selectedId ? "is-active" : ""}" data-id="${e.id}">
                <strong>${formatRecurringDate(e)}</strong>
                <small>${e.isPast ? "არქივი" : "მომავალი"}</small>
              </button>
            </li>
          `
            )
            .join("")}
        </ul>
      </li>
    `
      : "";

    eventList.innerHTML = regularHtml + recurringHtml;

    eventList.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => selectEvent(Number(btn.dataset.id)));
    });

    eventList.querySelector("[data-toggle-recurring]")?.addEventListener("click", () => {
      recurringStackOpen = !recurringStackOpen;
      renderEventList();
    });
  }

  function renderMediaEventSelect() {
    if (!mediaEventSelect) return;
    const current = mediaSelectedId || selectedId;
    const { regular, recurring } = partitionEvents(events);

    const regularOptions = regular
      .map((e) => {
        const label = e.slug === GALLERY_SLUG ? "გალერეა (ზოგადი)" : e.title;
        return `<option value="${e.id}" ${e.id === current ? "selected" : ""}>${label}</option>`;
      })
      .join("");

    const recurringOptions = recurring.length
      ? `<optgroup label="კვირეული — ლილო (${recurring.length})">${recurring
          .map(
            (e) =>
              `<option value="${e.id}" ${e.id === current ? "selected" : ""}>${formatRecurringDate(e)}</option>`
          )
          .join("")}</optgroup>`
      : "";

    mediaEventSelect.innerHTML =
      `<option value="">— ოპერაცია —</option>` + regularOptions + recurringOptions;
    if (current) {
      mediaSelectedId = current;
      onMediaEventChange(current);
    }
  }

  function onMediaEventChange(id) {
    mediaSelectedId = id ? Number(id) : null;
    if (mediaUploadZone) mediaUploadZone.hidden = !mediaSelectedId;
    if (mediaSelectPrompt) mediaSelectPrompt.hidden = !!mediaSelectedId;
    if (mediaSelectedId) loadMedia(mediaSelectedId);
    else if (mediaList) mediaList.innerHTML = "";
  }

  async function selectEvent(id) {
    selectedId = id;
    const event = events.find((e) => e.id === id);
    if (!event) return;

    adminEmpty.hidden = true;
    eventForm.hidden = false;
    const goMedia = document.getElementById("goToMediaBtn");
    if (goMedia) goMedia.hidden = false;

    renderEventList();

    field("id").value = event.id;
    field("slug").value = event.slug;
    field("title").value = event.title;
    field("description").value = event.description;
    field("location").value = event.location;
    field("status").value = event.status;
    field("statusType").value = event.statusType;
    field("startsAt").value = toLocalDatetime(event.startsAt);
    field("endsAt").value = toLocalDatetime(event.endsAt);
    field("posterUrl").value = event.posterUrl;
    field("videoUrl").value = event.videoUrl || "";
    field("federationLink").value = event.federationLink || "";
    field("sortOrder").value = event.sortOrder;
    field("featured").checked = event.featured;
    field("published").checked = event.published;

    const applyRecurringBtn = document.getElementById("applyRecurringBtn");
    const recurringNote = document.getElementById("recurringNote");
    const isRecurring = isRecurringEvent(event);
    if (applyRecurringBtn) applyRecurringBtn.hidden = !isRecurring;
    if (recurringNote) recurringNote.hidden = !isRecurring;
  }

  async function loadMedia(eventId) {
    const data = await adminRequest(`/events/${eventId}/media`);
    if (!mediaList) return;

    if (!data.media?.length) {
      mediaList.innerHTML = `<li class="admin-empty-inline">ჯერ მედია არ არის ატვირთული.</li>`;
      return;
    }

    mediaList.innerHTML = data.media
      .map(
        (m) => `
      <li class="admin-media-item">
        ${m.mediaType === "image" ? `<img src="${m.url}" alt="" />` : `<video src="${m.url}" controls></video>`}
        <div class="admin-media-item__meta">
          <span class="badge ${m.mediaType === "video" ? "badge--open" : "badge--soon"}">${m.mediaType === "video" ? "ვიდეო" : "ფოტო"}</span>
          <button type="button" class="btn btn-outline btn-sm" data-delete-media="${m.id}">წაშლა</button>
        </div>
      </li>
    `
      )
      .join("");

    mediaList.querySelectorAll("[data-delete-media]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await adminRequest(`/media/${btn.dataset.deleteMedia}`, { method: "DELETE" });
        await loadMedia(eventId);
      });
    });
  }

  function newEvent() {
    selectedId = null;
    adminEmpty.hidden = true;
    eventForm.hidden = false;
    eventForm.reset();
    field("id").value = "";
    field("published").checked = true;
    const goMedia = document.getElementById("goToMediaBtn");
    if (goMedia) goMedia.hidden = true;
    document.getElementById("applyRecurringBtn")?.setAttribute("hidden", "");
    document.getElementById("recurringNote")?.setAttribute("hidden", "");
    renderEventList();
  }

  document.getElementById("newEventBtn")?.addEventListener("click", newEvent);

  document.getElementById("goToMediaBtn")?.addEventListener("click", () => {
    if (selectedId && mediaEventSelect) {
      mediaEventSelect.value = String(selectedId);
      onMediaEventChange(selectedId);
    }
    switchTab("media");
  });

  mediaEventSelect?.addEventListener("change", (e) => onMediaEventChange(e.target.value));

  const dropzone = document.querySelector(".admin-dropzone");
  const fileInput = document.getElementById("mediaFileInput");

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
      const file = e.dataTransfer?.files?.[0];
      if (file) fileInput.files = e.dataTransfer.files;
    });
  }

  eventForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("eventFormMsg");
    const payload = {
      slug: field("slug").value,
      title: field("title").value,
      description: field("description").value,
      location: field("location").value,
      status: field("status").value,
      statusType: field("statusType").value,
      startsAt: fromLocalDatetime(field("startsAt").value),
      endsAt: fromLocalDatetime(field("endsAt").value),
      posterUrl: field("posterUrl").value,
      videoUrl: field("videoUrl").value || null,
      federationLink: field("federationLink").value || null,
      sortOrder: Number(field("sortOrder").value) || 0,
      featured: field("featured").checked,
      published: field("published").checked
    };

    try {
      if (field("id").value) {
        await adminRequest(`/events/${field("id").value}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        showMsg(msg, "შენახულია ✓");
      } else {
        const data = await adminRequest("/events", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        selectedId = data.event.id;
        showMsg(msg, "შეიქმნა ✓ — ახლა შეგიძლიათ მედიის ატვირთვა");
        document.getElementById("goToMediaBtn").hidden = false;
      }
      await loadEvents();
      if (selectedId) await selectEvent(selectedId);
    } catch (err) {
      showMsg(msg, err.message, true);
    }
  });

  document.getElementById("deleteEventBtn")?.addEventListener("click", async () => {
    if (!field("id").value || !confirm("წავშალოთ ღონისძიება?")) return;
    await adminRequest(`/events/${field("id").value}`, { method: "DELETE" });
    newEvent();
    await loadEvents();
  });

  document.getElementById("applyRecurringBtn")?.addEventListener("click", async () => {
    const msg = document.getElementById("eventFormMsg");
    if (!confirm("განახლდეს ყველა კვირეული ოპერაცია ამ ველებით?")) return;

    const payload = {
      title: field("title").value,
      description: field("description").value,
      location: field("location").value,
      status: field("status").value,
      statusType: field("statusType").value,
      posterUrl: field("posterUrl").value,
      videoUrl: field("videoUrl").value || null,
      federationLink: field("federationLink").value || null,
      sortOrder: Number(field("sortOrder").value) || -10
    };

    try {
      const data = await adminRequest("/recurring/lilo-sunday/bulk", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      showMsg(msg, `${data.message} (${data.count}) ✓`);
      await loadEvents();
      if (selectedId) await selectEvent(selectedId);
    } catch (err) {
      showMsg(msg, err.message, true);
    }
  });

  document.getElementById("mediaUploadForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("mediaUploadMsg");
    if (!mediaSelectedId) {
      showMsg(msg, "ჯერ აირჩიეთ ოპერაცია", true);
      return;
    }
    const form = e.target;
    const fd = new FormData(form);
    try {
      showMsg(msg, "იტვირთება...");
      await adminRequest(`/events/${mediaSelectedId}/media`, { method: "POST", body: fd });
      form.reset();
      showMsg(msg, "ატვირთულია ✓");
      await loadMedia(mediaSelectedId);
    } catch (err) {
      showMsg(msg, err.message, true);
    }
  });

  document.getElementById("syncSupabase")?.addEventListener("click", async () => {
    try {
      const data = await adminRequest("/sync-supabase", { method: "POST" });
      alert(data.message + (data.count ? ` (${data.count})` : ""));
      await loadEvents();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById("adminLogout")?.addEventListener("click", async () => {
    await window.ACG_API.logout();
    window.location.href = "login.html";
  });

  checkAccess();
})();
