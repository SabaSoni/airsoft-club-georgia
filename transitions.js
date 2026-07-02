(function () {
  const overlay = document.getElementById("pageTransition");
  if (!overlay) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TRANSITION_KEY = "acg-page-transition";

  function resetOverlay() {
    overlay.classList.remove("is-exiting", "is-revealing", "is-done");
  }

  function isSameOrigin(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.origin === window.location.origin && !href.startsWith("#");
    } catch {
      return false;
    }
  }

  // Always start from a clean overlay (guards bfcache / back-button restores).
  resetOverlay();

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      sessionStorage.removeItem(TRANSITION_KEY);
      resetOverlay();
    }
  });

  // Strip transition classes before the page is cached so Back does not restore a black screen.
  window.addEventListener("pagehide", () => {
    resetOverlay();
  });

  if (!prefersReduced && sessionStorage.getItem(TRANSITION_KEY)) {
    sessionStorage.removeItem(TRANSITION_KEY);
    overlay.classList.add("is-revealing");
    requestAnimationFrame(() => overlay.classList.add("is-done"));
    setTimeout(() => resetOverlay(), 320);
  }

  if (prefersReduced) return;

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href]");
    if (!link) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:")) return;
    if (!isSameOrigin(href)) return;

    e.preventDefault();
    sessionStorage.setItem(TRANSITION_KEY, "1");
    overlay.classList.add("is-exiting");

    setTimeout(() => {
      window.location.href = href;
    }, 220);
  });
})();
