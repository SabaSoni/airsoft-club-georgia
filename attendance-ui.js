(function () {
  "use strict";

  const POLL_MS = 15000;
  const polls = new Map();

  function attendeeLabel(count) {
    if (count === 1) return "1 მონაწილე";
    return `${count} მონაწილე`;
  }

  function renderBadge(count) {
    return `<span class="attendance-badge" data-attendance-count aria-live="polite">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
      ${attendeeLabel(count)}
    </span>`;
  }

  function renderBlock(slug, { count = 0, attending = false, compact = false } = {}) {
    const loginUrl = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return `
      <div class="attendance-block ${compact ? "attendance-block--compact" : ""}" data-attendance-root="${slug}">
        ${renderBadge(count)}
        <button type="button" class="btn ${attending ? "btn-outline" : "btn-primary"} btn-sm attendance-btn"
          data-attend-slug="${slug}" data-attending="${attending}">
          ${attending ? "გაუქმება" : "მივდივარ"}
        </button>
        <a href="${loginUrl}" class="btn btn-primary btn-sm attendance-login" hidden>შესვლა რეგისტრაციისთვის</a>
      </div>
    `;
  }

  async function fetchStatus(slug) {
    const res = await fetch(`/api/events/${encodeURIComponent(slug)}/attendance`, {
      credentials: "same-origin"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "შეცდომა");
    return data;
  }

  function updateRoot(root, data) {
    const badge = root.querySelector("[data-attendance-count]");
    const btn = root.querySelector(".attendance-btn");
    const login = root.querySelector(".attendance-login");
    if (badge) badge.innerHTML = `${badge.querySelector("svg")?.outerHTML || ""} ${attendeeLabel(data.count)}`;
    if (btn) {
      btn.dataset.attending = String(data.attending);
      btn.textContent = data.attending ? "გაუქმება" : "მივდივარ";
      btn.classList.toggle("btn-outline", data.attending);
      btn.classList.toggle("btn-primary", !data.attending);
    }
    if (login) login.hidden = true;
    if (btn) btn.hidden = false;
  }

  async function refresh(slug) {
    const root = document.querySelector(`[data-attendance-root="${slug}"]`);
    if (!root) return;
    try {
      const data = await fetchStatus(slug);
      updateRoot(root, data);
    } catch (_) {}
  }

  async function toggle(slug) {
    const root = document.querySelector(`[data-attendance-root="${slug}"]`);
    const btn = root?.querySelector(".attendance-btn");
    const attending = btn?.dataset.attending === "true";
    const method = attending ? "DELETE" : "POST";

    const res = await fetch(`/api/events/${encodeURIComponent(slug)}/attend`, {
      method,
      credentials: "same-origin"
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    if (!res.ok) throw new Error(data.error || "შეცდომა");

    if (root) updateRoot(root, { count: data.count, attending: data.attending });
    document.querySelectorAll(`[data-attendance-root="${slug}"]`).forEach((el) => {
      updateRoot(el, { count: data.count, attending: data.attending });
    });
  }

  function bind(root) {
    const slug = root.dataset.attendanceRoot;
    if (!slug) return;

    root.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-attend-slug]");
      if (!btn) return;
      e.preventDefault();
      btn.disabled = true;
      try {
        await toggle(slug);
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    });

    if (!polls.has(slug)) {
      polls.set(
        slug,
        setInterval(() => refresh(slug), POLL_MS)
      );
    }
  }

  function mount(container, slug, options = {}) {
    if (!container || !slug) return;
    container.innerHTML = renderBlock(slug, options);
    const root = container.querySelector("[data-attendance-root]");
    if (!root) return;
    bind(root);

    if (window.ACG_AUTH) {
      window.ACG_AUTH.waitReady()
        .then((user) => {
          const btn = root.querySelector(".attendance-btn");
          const login = root.querySelector(".attendance-login");
          if (!user) {
            if (btn) btn.hidden = true;
            if (login) login.hidden = false;
          }
        })
        .catch(() => {});
    }
  }

  function initAll() {
    document.querySelectorAll("[data-attendance-root]").forEach(bind);
  }

  window.ACG_ATTENDANCE = {
    renderBlock,
    mount,
    refresh,
    toggle,
    initAll,
    attendeeLabel
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
