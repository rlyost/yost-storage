(function () {
  // Hours and minutes only, in the viewer's own locale and time zone,
  // so the readout matches whatever their system clock shows.
  var el = document.getElementById("clock");
  var timer = null;

  function tick() {
    var now = new Date();
    el.textContent = HandlerPathTime.formatClock(now);
    // Re-arm on the next minute boundary rather than a fixed interval,
    // so the flip stays in step after sleep or clock changes.
    clearTimeout(timer);
    timer = setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
  }

  tick();
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) tick();
  });
})();
