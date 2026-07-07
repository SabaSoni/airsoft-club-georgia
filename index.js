(function () {
  "use strict";

  const heroVideo = document.querySelector(".hero--v2 .hero__video");
  if (!heroVideo) return;

  const startVideo = () => {
    heroVideo.preload = "auto";
    heroVideo.play().catch(() => {});
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(startVideo, { timeout: 2500 });
  } else {
    setTimeout(startVideo, 400);
  }

  document.addEventListener(
    "click",
    () => {
      if (heroVideo.preload === "none") startVideo();
    },
    { once: true, passive: true }
  );
})();
