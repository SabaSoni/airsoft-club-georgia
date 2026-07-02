(function () {
  "use strict";

  const modal = document.getElementById("heroVideoModal");
  const video = document.getElementById("heroModalVideo");
  const closeBtn = document.getElementById("heroVideoClose");

  if (!modal || !video) return;

  function closeModal() {
    video.pause();
    modal.close();
  }

  function openModal(url) {
    if (url) {
      const source = video.querySelector("source");
      if (source) {
        source.src = url;
      } else {
        video.src = url;
      }
      video.load();
    }
    modal.showModal();
    video.currentTime = 0;
    video.play().catch(() => {});
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  modal.addEventListener("cancel", () => {
    video.pause();
  });

  window.ACG_VIDEO = { open: openModal, close: closeModal };
})();
