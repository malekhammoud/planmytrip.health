/*
 * Pitch deck navigation. One fixed 1920x1080 stage, scaled to fit the viewport.
 * Keys: arrow keys / space / page keys, Home, End, F for fullscreen.
 */
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var current = 0;

  function fit() {
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "scale(" + scale + ")";
  }

  function show(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach(function (slide, i) {
      var active = i === current;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
      if (active) {
        slide.removeAttribute("inert");
      } else {
        slide.setAttribute("inert", "");
      }
    });
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#" + (current + 1));
    }
  }

  document.addEventListener("keydown", function (event) {
    var key = event.key;
    if (
      key === "ArrowRight" ||
      key === "ArrowDown" ||
      key === "PageDown" ||
      key === " " ||
      key === "Spacebar"
    ) {
      event.preventDefault();
      show(current + 1);
    } else if (
      key === "ArrowLeft" ||
      key === "ArrowUp" ||
      key === "PageUp"
    ) {
      event.preventDefault();
      show(current - 1);
    } else if (key === "Home") {
      event.preventDefault();
      show(0);
    } else if (key === "End") {
      event.preventDefault();
      show(slides.length - 1);
    } else if (key === "f" || key === "F") {
      event.preventDefault();
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });

  window.addEventListener("resize", fit);
  fit();

  var start = Number((window.location.hash || "#1").slice(1));
  show(Number.isFinite(start) && start > 0 ? start - 1 : 0);
})();
