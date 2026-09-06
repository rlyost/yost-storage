// Shared wall-clock presentation for the landing clock and alarm.
// Resolve locale/time zone on each call so system-setting changes remain visible.
var HandlerPathTime = Object.freeze({
  formatClock: function (value) {
    return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
});
