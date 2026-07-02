(function () {
  "use strict";

  const gate = document.getElementById("accountGate");
  const app = document.getElementById("accountApp");
  const loading = document.getElementById("accountLoading");
  const gateMsg = document.getElementById("accountGateMsg");

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("ka-GE", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function initials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return parts
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }

  function showMsg(el, text, isError = false) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", isError);
  }

  function showLoading(show) {
    if (loading) loading.hidden = !show;
  }

  function showGate(message) {
    gate.hidden = false;
    app.hidden = true;
    if (gateMsg && message) gateMsg.textContent = message;
  }

  function renderOrders(orders) {
    const el = document.getElementById("accountOrders");
    if (!orders.length) {
      el.innerHTML = `<p class="account-empty">შეკვეთები ჯერ არ გაქვთ. <a href="shop.html">მაღაზია →</a></p>`;
      return;
    }
    el.innerHTML = orders
      .map(
        (o) => `
      <article class="account-item">
        <div>
          <strong>${escapeHtml(o.orderNumber)}</strong>
          <span class="account-item__meta">${formatDate(o.createdAt)}</span>
        </div>
        <div class="account-item__right">
          <span class="account-item__price">${escapeHtml(o.totalFormatted)}</span>
          <span class="badge badge--soon">${escapeHtml(o.status)}</span>
        </div>
      </article>
    `
      )
      .join("");
  }

  function renderEvents(elId, events, emptyMsg) {
    const el = document.getElementById(elId);
    if (!events.length) {
      el.innerHTML = `<p class="account-empty">${emptyMsg}</p>`;
      return;
    }
    el.innerHTML = events
      .map(
        (e) => `
      <a href="event.html?slug=${encodeURIComponent(e.slug)}" class="account-event">
        ${e.posterUrl ? `<img src="${escapeHtml(e.posterUrl)}" alt="" loading="lazy" />` : `<div class="account-event__placeholder" aria-hidden="true"></div>`}
        <div>
          <strong>${escapeHtml(e.title)}</strong>
          <span>${escapeHtml(e.location || "")}</span>
        </div>
      </a>
    `
      )
      .join("");
  }

  function renderDashboard(data) {
    gate.hidden = true;
    app.hidden = false;

    const user = data.user;
    document.getElementById("accountName").textContent = user.name;
    document.getElementById("accountEmail").textContent = user.email;
    document.getElementById("accountAvatar").textContent = initials(user.name);

    const phoneEl = document.getElementById("accountPhone");
    if (phoneEl) {
      if (user.phone) {
        phoneEl.textContent = user.phone;
        phoneEl.hidden = false;
      } else {
        phoneEl.hidden = true;
      }
    }

    document.getElementById("statOrders").textContent = String((data.orders || []).length);
    document.getElementById("statUpcoming").textContent = String((data.eventsUpcoming || []).length);
    document.getElementById("statAttended").textContent = String((data.eventsAttended || []).length);

    const actions = document.querySelector(".account-profile__actions");
    if (user.isAdmin && actions && !document.getElementById("accountAdminLink")) {
      const adminLink = document.createElement("a");
      adminLink.id = "accountAdminLink";
      adminLink.href = "admin.html";
      adminLink.className = "btn btn-ghost btn-sm";
      adminLink.textContent = "ადმინ პანელი";
      const logoutBtn = document.getElementById("accountLogout");
      actions.insertBefore(adminLink, logoutBtn);
    }

    renderOrders(data.orders || []);
    renderEvents(
      "accountUpcoming",
      data.eventsUpcoming || [],
      'ჯერ არ ხართ დარეგისტრირებული. <a href="operations.html">ოპერაციები →</a>'
    );
    renderEvents(
      "accountAttended",
      data.eventsAttended || [],
      "დასრულებული ოპერაციები აქ გამოჩნდება."
    );

    if (window.ACG?.revealObserver) {
      app.querySelectorAll(".reveal-up").forEach((el) => window.ACG.revealObserver.observe(el));
    }
  }

  function setupPasswordTabs() {
    const tabs = document.querySelectorAll("[data-pw-tab]");
    const panels = document.querySelectorAll("[data-pw-panel]");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.dataset.pwTab;
        tabs.forEach((t) => {
          const active = t.dataset.pwTab === id;
          t.classList.toggle("is-active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });
        panels.forEach((panel) => {
          const active = panel.dataset.pwPanel === id;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });
      });
    });
  }

  function setupPasswordForms() {
    const msg = document.getElementById("passwordFormMsg");
    const sendCodeMsg = document.getElementById("sendCodeMsg");
    const currentForm = document.getElementById("passwordFormCurrent");
    const emailForm = document.getElementById("passwordFormEmail");
    const sendCodeBtn = document.getElementById("sendCodeBtn");

    currentForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(currentForm);
      try {
        showMsg(msg, "იტვირთება...");
        await window.ACG_API.changePassword({
          method: "current",
          currentPassword: fd.get("currentPassword"),
          newPassword: fd.get("newPassword"),
          confirmPassword: fd.get("confirmPassword")
        });
        currentForm.reset();
        showMsg(msg, "პაროლი წარმატებით შეიცვალა ✓");
      } catch (err) {
        showMsg(msg, err.message, true);
      }
    });

    sendCodeBtn?.addEventListener("click", async () => {
      try {
        showMsg(sendCodeMsg, "იგზავნება...");
        const data = await window.ACG_API.sendPasswordCode();
        showMsg(sendCodeMsg, data.message || "კოდი გაიგზავნა");
      } catch (err) {
        showMsg(sendCodeMsg, err.message, true);
      }
    });

    emailForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(emailForm);
      try {
        showMsg(msg, "იტვირთება...");
        await window.ACG_API.changePassword({
          method: "email",
          code: fd.get("code"),
          newPassword: fd.get("newPassword"),
          confirmPassword: fd.get("confirmPassword")
        });
        emailForm.reset();
        showMsg(sendCodeMsg, "");
        showMsg(msg, "პაროლი წარმატებით შეიცვალა ✓");
      } catch (err) {
        showMsg(msg, err.message, true);
      }
    });
  }

  function setupLogout() {
    document.getElementById("accountLogout")?.addEventListener("click", async () => {
      await window.ACG_API.logout();
      window.location.href = "login.html";
    });
  }

  async function init() {
    setupPasswordTabs();
    setupPasswordForms();
    setupLogout();

    gate.hidden = true;
    app.hidden = true;
    showLoading(true);

    if (!window.ACG_API) {
      showLoading(false);
      showGate("სერვერი არ მუშაობს — გაუშვით npm start და გახსენით localhost:3000");
      return;
    }

    try {
      const sessionUser = await window.ACG_AUTH.waitReady();
      if (!sessionUser) {
        showLoading(false);
        showGate();
        return;
      }

      try {
        const data = await window.ACG_API.getDashboard();
        showLoading(false);
        renderDashboard(data);
      } catch (err) {
        const { user: me } = await window.ACG_API.getMe({ force: true });
        showLoading(false);
        renderDashboard({
          user: me || sessionUser,
          orders: [],
          eventsUpcoming: [],
          eventsAttended: []
        });
        console.warn("Dashboard partial load:", err.message);
      }
    } catch (err) {
      showLoading(false);
      showGate(err.message || "შესვლა საჭიროა");
    }
  }

  init();
})();
