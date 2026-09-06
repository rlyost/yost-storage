(function () {
  var img = document.getElementById("logo");
  var showing = null;

  function paint() {
    var next = HandlerPathDaylight.current();
    if (next === showing) return;
    showing = next;
    img.width = next.w;
    img.height = next.h;
    img.alt = next.alt;
    img.srcset = next.srcset;
    img.src = next.src;
    document.documentElement.setAttribute("data-daylight", next.mode);
  }

  paint();
  setInterval(paint, 60000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) paint();
  });
})();
