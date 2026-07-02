(function () {
  "use strict";

  const heroBg = document.querySelector(".hero--v2 .hero__video");

  if (heroBg) {
    heroBg.play().catch(() => {
      document.addEventListener("click", () => heroBg.play().catch(() => {}), { once: true });
    });
  }
})();
