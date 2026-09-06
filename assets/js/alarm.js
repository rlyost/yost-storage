(function () {
  // Timer and wall-clock alarm sharing one state machine:
  //   idle -> running -> ringing, with paused hanging off running.
  // Deadlines are absolute timestamps, never accumulated intervals, so a
  // throttled background tab or a sleeping laptop can't drift the count.
  var KEY = "handlerpath.alarm";
  var RING_MAX_MS = 300000;   // stop flashing after 5 min if nobody's home

  var $ = function (id) { return document.getElementById(id); };
  var dlg = $("alarm-dialog");
  var statusEl = $("alarm-status");
  var big = $("alarm-big");
  var sub = $("alarm-sub");
  var ring = $("alarm-ring");
  var ringLogo = $("alarm-ring-logo");
  var soundBox = $("alarm-sound");
  var fields = { timer: $("fields-timer"), alarm: $("fields-alarm") };
  var tabs = { timer: $("mode-timer"), alarm: $("mode-alarm") };
  var btn = { set: $("btn-set"), stop: $("btn-stop"), reset: $("btn-reset"), off: $("btn-off") };

  var st = HandlerPathAlarm.defaults();

  var ticker = null;
  var beeper = null;
  var ringStarted = 0;
  var ac = null;

  /* ---- persistence ------------------------------------------------ */

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    st = HandlerPathAlarm.decode(raw, st, Date.now());
  }

  /* ---- formatting ------------------------------------------------- */

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function fmtLeft(ms) {
    var t = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return h ? h + ":" + pad(m) + ":" + pad(sec) : m + ":" + pad(sec);
  }

  /* ---- audio ------------------------------------------------------ */

  // Built lazily inside a click so autoplay policy lets it through.
  function audio() {
    if (!ac) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ac = new C(); } catch (e) { return null; }
    }
    if (ac.state === "suspended") {
      try {
        var resumed = ac.resume();
        if (resumed && resumed.catch) resumed.catch(function () {});
      } catch (e) { return null; }
    }
    return ac;
  }

  function beep() {
    if (!st.sound) return;
    var c = audio();
    if (!c) return;
    for (var i = 0; i < 3; i++) {
      var at = c.currentTime + i * 0.22;
      var o = c.createOscillator(), g = c.createGain();
      o.type = "square";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.22, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      o.connect(g);
      g.connect(c.destination);
      o.start(at);
      o.stop(at + 0.2);
    }
  }

  /* ---- inputs ----------------------------------------------------- */

  function readFields() {
    if (st.mode === "timer") {
      var h = +$("t-h").value || 0, m = +$("t-m").value || 0, sec = +$("t-s").value || 0;
      return (h * 3600 + m * 60 + sec) * 1000;
    }
    var parts = ($("a-time").value || "").split(":");
    if (parts.length < 2) return 0;
    var target = new Date();
    target.setHours(+parts[0], +parts[1], 0, 0);
    // A time already past today means tomorrow.
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    return target.getTime() - Date.now();
  }

  function writeTimerFields(ms) {
    var t = Math.round(ms / 1000);
    $("t-h").value = Math.floor(t / 3600);
    $("t-m").value = Math.floor((t % 3600) / 60);
    $("t-s").value = t % 60;
  }

  /* ---- render ----------------------------------------------------- */

  function left() {
    if (st.state === "running") return st.deadline - Date.now();
    return st.remainingMs;
  }

  function render() {
    tabs.timer.setAttribute("aria-selected", st.mode === "timer");
    tabs.alarm.setAttribute("aria-selected", st.mode === "alarm");
    fields.timer.hidden = st.mode !== "timer";
    fields.alarm.hidden = st.mode !== "alarm";

    btn.set.disabled = st.state === "running" || st.state === "ringing";
    btn.set.textContent = st.state === "paused" ? "Resume" : "Set";
    btn.stop.disabled = st.state !== "running";
    btn.reset.disabled = st.state === "idle" && st.remainingMs === st.durationMs;
    btn.off.disabled = st.state !== "ringing";
    renderStatus(true);
  }

  function setText(element, text) {
    if(element.textContent !== text) element.textContent = text;
  }

  // Periodic updates touch only the badge and an open dialog's readout.
  function renderStatus(force) {
    var main = "\u2014", note = "Not set", badge = "";

    if (st.state === "running") {
      main = st.mode === "timer" ? fmtLeft(left()) : HandlerPathTime.formatClock(st.deadline);
      note = st.mode === "timer" ? "Counting down" : "Rings in " + fmtLeft(left());
      badge = (st.mode === "timer" ? "TIMER " : "ALARM ") + main;
    } else if (st.state === "paused") {
      main = fmtLeft(st.remainingMs);
      note = "Stopped";
      badge = "TIMER " + main + " STOPPED";
    } else if (st.state === "ringing") {
      main = "RINGING";
      note = "Turn it off";
      badge = "ALARM RINGING";
    }

    if(force || dlg.open){
      setText(big, main);
      setText(sub, note);
    }

    statusEl.hidden = !badge;
    setText(statusEl, badge);

  }

  /* ---- state machine ---------------------------------------------- */

  function startTicking() {
    stopTicking();
    ticker = setInterval(function () {
      if (st.state !== "running") return;
      if (Date.now() >= st.deadline) fire();
      else if (!document.hidden) renderStatus(false);
    }, 1000);
  }

  function stopTicking() {
    if (ticker) { clearInterval(ticker); ticker = null; }
  }

  function set() {
    var ms;
    if (st.state === "paused") {
      ms = st.remainingMs;                 // Resume from where Stop left it
    } else {
      ms = readFields();
      if (!Number.isFinite(ms) || ms <= 0 || !Number.isFinite(new Date(Date.now() + ms).getTime())) { sub.textContent = "Enter a time first"; return; }
    }
    audio();                                // unlock inside this click
    commit(HandlerPathAlarm.transition(st, { type: "start", durationMs: ms, alarmTime: $("a-time").value }, Date.now()));
    dlg.close();   // armed - get the card out of the way
  }

  function stop() {
    if (st.state !== "running") return;
    commit(HandlerPathAlarm.transition(st, { type: "stop" }, Date.now()));
  }

  function reset() {
    if (st.mode === "timer") writeTimerFields(st.durationMs);
    commit(HandlerPathAlarm.transition(st, { type: "reset" }));
  }

  // Every transition owns cleanup, scheduling, persistence and rendering.
  // Presets replace the active timer with an idle duration, including while ringing.
  function commit(next) {
    stopTicking();
    silence();
    st = next;
    save();
    if (st.state === "running") startTicking();
    if (st.state === "ringing") startRinging();
    render();
  }

  function fire() {
    commit(HandlerPathAlarm.transition(st, { type: "fire" }));
  }

  function startRinging() {
    var live = document.getElementById("logo");
    ringLogo.src = (live && live.currentSrc) || "HandlerPath_Gators-512.webp";
    ringLogo.alt = "Alarm";
    if (dlg.open) dlg.close();
    ring.hidden = false;
    ringStarted = Date.now();
    beep();
    beeper = setInterval(function () {
      if (Date.now() - ringStarted > RING_MAX_MS) { turnOff(); return; }
      beep();
    }, 1500);
  }

  function silence() {
    if (beeper) { clearInterval(beeper); beeper = null; }
    ring.hidden = true;
  }

  function turnOff() {
    commit(HandlerPathAlarm.transition(st, { type: "off" }));
  }

  /* ---- wiring ----------------------------------------------------- */

  $("alarm-link").addEventListener("click", function () {
    render();
    dlg.showModal();
  });
  $("alarm-close").addEventListener("click", function () { dlg.close(); });

  Object.keys(tabs).forEach(function (m) {
    tabs[m].addEventListener("click", function () {
      if (st.state === "running" || st.state === "ringing") return;
      commit(HandlerPathAlarm.transition(st, { type: "mode", mode: m }));
      if (st.mode === "timer") writeTimerFields(st.durationMs);
    });
  });

  Array.prototype.forEach.call(
    document.querySelectorAll(".alarm-presets button"),
    function (b) {
      b.addEventListener("click", function () {
        writeTimerFields(+b.dataset.secs * 1000);
        commit(HandlerPathAlarm.transition(st, { type: "preset", durationMs: +b.dataset.secs * 1000 }));
      });
    }
  );

  btn.set.addEventListener("click", set);
  btn.stop.addEventListener("click", stop);
  btn.reset.addEventListener("click", reset);
  btn.off.addEventListener("click", turnOff);
  $("alarm-off").addEventListener("click", turnOff);

  $("a-time").addEventListener("change", function () {
    st = HandlerPathAlarm.transition(st, { type: "alarmTime", alarmTime: $("a-time").value });
    save();
  });

  soundBox.addEventListener("change", function () {
    st = HandlerPathAlarm.transition(st, { type: "sound", sound: soundBox.checked });
    save();
  });

  // Esc kills the flash as well as the dialog.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && st.state === "ringing") turnOff();
  });

  // Coming back to a throttled tab: settle up immediately.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden || st.state !== "running") return;
    if (Date.now() >= st.deadline) fire();
    else renderStatus(false);
  });

  load();
  soundBox.checked = st.sound;
  if (st.mode === "alarm") $("a-time").value = st.alarmTime;
  writeTimerFields(st.mode === "timer" ? (st.remainingMs || st.durationMs) : st.durationMs);
  commit(st); // Persist normalized recovery state and reconcile its effects.
})();
