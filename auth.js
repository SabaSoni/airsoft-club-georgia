(function () {
  "use strict";

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const tabBtns = document.querySelectorAll(".auth-tabs__btn");
  const sessionPanel = document.getElementById("authSessionPanel");
  const authFormsWrap = document.getElementById("authFormsWrap");
  const authTabs = document.querySelector(".auth-tabs");
  const registerHint = document.getElementById("registerHint");

  if (!loginForm && !registerForm) return;

  let activeUser = null;

  const showcaseVideo = document.querySelector(".auth-showcase__video");
  if (showcaseVideo) {
    const desktop = window.matchMedia("(min-width: 960px)");
    const loadVideo = () => {
      if (!desktop.matches) return;
      showcaseVideo.preload = "auto";
      showcaseVideo.play().catch(() => {});
    };
    if (desktop.matches) loadVideo();
    desktop.addEventListener("change", loadVideo);
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      loginForm.classList.toggle("is-hidden", tab !== "login");
      loginForm.hidden = tab !== "login";
      registerForm.classList.toggle("is-hidden", tab !== "register");
      registerForm.hidden = tab !== "register";
      clearMessages();
    });
  });

  document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    const input = document.getElementById(btn.dataset.togglePassword);
    if (!input) return;

    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("is-visible", show);
      btn.setAttribute("aria-label", show ? "პაროლის დამალვა" : "პაროლის ჩვენება");
    });
  });

  function showMessage(el, text, type = "") {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("is-error", "is-success");
    if (type) el.classList.add(type);
  }

  function clearMessages() {
    showMessage(document.getElementById("loginMessage"), "");
    showMessage(document.getElementById("registerMessage"), "");
  }

  function setLoading(form, loading) {
    const btn = form.querySelector(".auth-submit");
    if (btn) btn.classList.toggle("is-loading", loading);
    form.querySelectorAll("input, button[type=submit]").forEach((el) => {
      if (el.type !== "button") el.disabled = loading;
    });
  }

  function showLoginForms() {
    sessionPanel?.setAttribute("hidden", "");
    authFormsWrap?.removeAttribute("hidden");
    authTabs?.removeAttribute("hidden");
    registerHint?.removeAttribute("hidden");
    activeUser = null;
  }

  function showSessionPanel(user) {
    activeUser = user;
    const emailEl = document.getElementById("authSessionEmail");
    const nameEl = document.getElementById("authSessionName");
    const avatarEl = document.getElementById("authSessionAvatar");
    const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

    if (emailEl) emailEl.textContent = user.email;
    if (nameEl) nameEl.textContent = user.name || user.email;
    if (avatarEl) avatarEl.textContent = initial;

    sessionPanel?.removeAttribute("hidden");
    authFormsWrap?.setAttribute("hidden", "");
    authTabs?.setAttribute("hidden", "");
    registerHint?.setAttribute("hidden", "");

    const continueBtn = document.getElementById("authContinueBtn");
    if (continueBtn) {
      continueBtn.textContent = user.isAdmin ? "ადმინ პანელი" : "ჩემი ანგარიში";
    }
  }

  async function initSessionState() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "login") {
      showLoginForms();
      return;
    }

    try {
      const user = await window.ACG_AUTH.waitReady();
      if (!user) return;

      showSessionPanel(user);

      const next = params.get("next");
      if (next) {
        window.location.replace(next);
      }
    } catch (_) {}
  }

  async function setupRegisterTab() {
    const registerTab = document.querySelector('.auth-tabs__btn[data-tab="register"]');
    if (!registerTab) return;

    try {
      const status = await window.ACG_API.getRegisterStatus();
      if (registerHint) {
        registerHint.textContent = status.adminOpen
          ? `ადმინისტრატორის რეგისტრაცია: ${status.adminEmail}`
          : status.message || "";
        registerHint.hidden = false;
      }
    } catch (_) {}
  }

  document.getElementById("authContinueBtn")?.addEventListener("click", () => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) {
      window.location.href = next;
      return;
    }
    window.location.href = activeUser?.isAdmin ? "admin.html" : "account.html";
  });

  document.getElementById("authSwitchAccount")?.addEventListener("click", async () => {
    const btn = document.getElementById("authSwitchAccount");
    if (btn) btn.disabled = true;
    try {
      await window.ACG_API.logout();
      showLoginForms();
      clearMessages();
      loginForm?.reset();
      registerForm?.reset();
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  initSessionState();
  setupRegisterTab();

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("loginMessage");
      setLoading(loginForm, true);
      showMessage(msg, "");

      try {
        const data = await window.ACG_API.login({
          email: loginForm.email.value,
          password: loginForm.password.value
        });
        showMessage(msg, data.message, "is-success");
        setTimeout(() => {
          const params = new URLSearchParams(window.location.search);
          const next = params.get("next");
          if (next) {
            window.location.href = next;
            return;
          }
          window.location.href = data.user?.isAdmin ? "admin.html" : "account.html";
        }, 400);
      } catch (err) {
        showMessage(msg, err.message, "is-error");
        setLoading(loginForm, false);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("registerMessage");
      setLoading(registerForm, true);
      showMessage(msg, "");

      try {
        const data = await window.ACG_API.register({
          name: registerForm.name.value,
          email: registerForm.email.value,
          phone: registerForm.phone.value,
          password: registerForm.password.value
        });
        showMessage(msg, data.message, data.user ? "is-success" : "");
        if (!data.user) {
          setLoading(registerForm, false);
          return;
        }
        setTimeout(() => {
          const params = new URLSearchParams(window.location.search);
          const next = params.get("next");
          if (next) {
            window.location.href = next;
            return;
          }
          window.location.href = data.user?.isAdmin ? "admin.html" : "account.html";
        }, 400);
      } catch (err) {
        showMessage(msg, err.message, "is-error");
        setLoading(registerForm, false);
      }
    });
  }
})();
