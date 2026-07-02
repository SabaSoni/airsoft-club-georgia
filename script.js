/* Shared utilities — nav, scroll, animations, back-to-top */

(function () {
  "use strict";

  const header = document.querySelector(".site-header");
  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  const backToTop = document.getElementById("backToTop");
  const currentPage = document.body.dataset.page;

  /* Active nav link */
  document.querySelectorAll(".site-nav__link, .mobile-menu__link").forEach((link) => {
    if (link.dataset.page === currentPage) {
      link.classList.add("is-active");
    }
  });

  /* Header shrink on scroll */
  function onScroll() {
    if (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    }
    if (backToTop) {
      backToTop.classList.toggle("is-visible", window.scrollY > 300);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", () => {
      const open = mobileMenu.classList.toggle("is-open");
      menuToggle.classList.toggle("is-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mobileMenu.classList.remove("is-open");
        menuToggle.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* Back to top */
  if (backToTop) {
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.querySelectorAll(".back-to-top-footer").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* Footer year */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* Scroll reveal observer */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
  );

  document.querySelectorAll(".reveal-up, .reveal-left, .reveal-right, .reveal-scale").forEach((el) => {
    revealObserver.observe(el);
  });

  /* Stagger children */
  document.querySelectorAll(".stagger-children").forEach((parent) => {
    parent.querySelectorAll(":scope > *").forEach((child, i) => {
      child.style.setProperty("--i", i);
      if (!child.classList.contains("reveal-up")) {
        child.classList.add("reveal-up");
      }
      revealObserver.observe(child);
    });
  });

  window.ACG = window.ACG || {};
  window.ACG.revealObserver = revealObserver;

  const ACCOUNT_ICON_SVG = `<svg class="header-icon-btn__svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

  /* Header auth button */
  async function initAuthHeader() {
    const btn = document.getElementById("headerAuthBtn");
    if (!btn || !window.ACG_API?.getMe) return;

    try {
      const { user } = await window.ACG_API.getMe();
      if (user) {
        const actions = document.querySelector(".header-actions");
        if (actions && !document.getElementById("headerAccountBtn")) {
          const accountLink = document.createElement("a");
          accountLink.id = "headerAccountBtn";
          accountLink.href = "account.html";
          accountLink.className = "btn btn-ghost header-icon-btn";
          accountLink.setAttribute("aria-label", "ჩემი ანგარიში");
          accountLink.title = "ჩემი ანგარიში";
          accountLink.innerHTML = ACCOUNT_ICON_SVG;
          actions.insertBefore(accountLink, btn);
        }

        btn.textContent = "გამოსვლა";
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-outline");
        btn.href = "#";
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          await window.ACG_API.logout();
          window.location.href = "index.html";
        });

        if (user.isAdmin) {
          const actions = document.querySelector(".header-actions");
          if (actions && !document.getElementById("headerAdminBtn")) {
            const adminLink = document.createElement("a");
            adminLink.id = "headerAdminBtn";
            adminLink.href = "admin.html";
            adminLink.className = "btn btn-ghost btn-sm";
            adminLink.textContent = "ადმინი";
            actions.insertBefore(adminLink, btn);
          }
        } else {
          document.getElementById("headerAdminBtn")?.remove();
        }
      }
    } catch (_) {}
  }

  initAuthHeader();

  /* Contact form */
  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("formMessage");
      const submitBtn = contactForm.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        if (window.ACG_API) {
          const data = await window.ACG_API.sendContact({
            name: contactForm.name.value,
            phone: contactForm.phone.value,
            message: contactForm.message.value
          });
          if (msg) msg.textContent = data.message;
        } else if (msg) {
          msg.textContent = "შეტყობინება მიღებულია. მალე დაგიკავშირდებით!";
        }
        contactForm.reset();
      } catch (err) {
        if (msg) {
          msg.textContent = err.message;
          msg.classList.add("is-error");
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
})();
