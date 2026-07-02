(function () {
  const overlay = document.getElementById("pageTransition");
  if (!overlay) return;

  function resetOverlay() {
    overlay.classList.remove("is-exiting", "is-revealing", "is-done");
  }

  resetOverlay();

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) resetOverlay();
  });

  window.addEventListener("pagehide", () => {
    resetOverlay();
  });

  window.addEventListener("DOMContentLoaded", () => {
    resetOverlay();
  });
})();
