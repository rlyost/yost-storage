(function () {
  // Independent records share one scheduler; all deadlines are absolute timestamps.
  var KEY = "handlerpath.alarm";
  var RING_MAX_MS = 300000;
  var $ = function (id) { return document.getElementById(id); };
  var dlg = $("alarm-dialog"), statusEl = $("alarm-status");
  var big = $("alarm-big"), sub = $("alarm-sub");
  var ring = $("alarm-ring"), ringLogo = $("alarm-ring-logo");
  var soundBox = $("alarm-sound"), list = $("alarm-list");
  var fields = { timer: $("fields-timer"), alarm: $("fields-alarm") };
  var tabs = { timer: $("mode-timer"), alarm: $("mode-alarm") };
  var btn = { set: $("btn-set"), stop: $("btn-stop"), reset: $("btn-reset"), off: $("btn-off") };
  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) {}
  var book = HandlerPathAlarm.decodeCollection(raw, Date.now());
  var st = selected(), dirty = false, sequence = 0;
  var ticker = null, beeper = null, ac = null;
  var ringStarted = new Map(), rows = new Map();

  function selected() {
    return book.alarms.find(function (entry) { return entry.id === book.selectedId; });
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(book)); } catch (e) {}
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtLeft(ms) {
    var t = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return h ? h + ":" + pad(m) + ":" + pad(sec) : m + ":" + pad(sec);
  }
  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }
  function title(entry) {
    if (entry.mode === "timer") return "Timer · " + fmtLeft(entry.durationMs);
    if (!entry.alarmTime) return "New alarm";
    var date = new Date();
    var parts = entry.alarmTime.split(":");
    date.setHours(+parts[0], +parts[1], 0, 0);
    return "Alarm · " + HandlerPathTime.formatClock(date);
  }
  function note(entry) {
    if (entry.state === "ringing") return "Ringing";
    if (entry.state === "paused") return "Stopped · " + fmtLeft(entry.remainingMs);
    if (entry.state === "running") return "Rings in " + fmtLeft(entry.deadline - Date.now());
    return "Not set";
  }

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
    if (!book.alarms.some(function (entry) { return entry.state === "ringing" && entry.sound; })) return;
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

  function readFields() {
    if (st.mode === "timer") {
      var inputs = [$("t-h"), $("t-m"), $("t-s")];
      var values = inputs.map(function (input) { return Number(input.value); });
      if (values.some(function (value, i) {
        return !Number.isInteger(value) || value < 0 || value > (i === 0 ? 99 : 59);
      })) return 0;
      return (values[0] * 3600 + values[1] * 60 + values[2]) * 1000;
    }
    var value = $("a-time").value;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return 0;
    var parts = value.split(":"), target = new Date();
    target.setHours(+parts[0], +parts[1], 0, 0);
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    return target.getTime() - Date.now();
  }

  function writeTimerFields(ms) {
    var t = Math.round(ms / 1000);
    $("t-h").value = Math.floor(t / 3600);
    $("t-m").value = Math.floor((t % 3600) / 60);
    $("t-s").value = t % 60;
  }
  function writeFields() {
    dirty = false;
    writeTimerFields(st.durationMs);
    $("a-time").value = st.alarmTime;
    soundBox.checked = st.sound;
  }

  function renderList() {
    list.replaceChildren();
    rows.clear();
    book.alarms.forEach(function (entry) {
      var row = document.createElement("li");
      row.className = "alarm-entry";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "alarm-select";
      edit.setAttribute("aria-pressed", entry.id === st.id);
      edit.setAttribute("aria-label", "Edit " + title(entry));
      var heading = document.createElement("strong"), status = document.createElement("small");
      heading.textContent = title(entry);
      status.textContent = note(entry);
      edit.append(heading, status);
      edit.addEventListener("click", function () {
        book.selectedId = entry.id;
        st = selected();
        writeFields();
        save();
        render();
        $(st.mode === "timer" ? "t-h" : "a-time").focus();
      });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.setAttribute("aria-label", "Delete " + title(entry));
      remove.addEventListener("click", function () {
        book.alarms = book.alarms.filter(function (item) { return item.id !== entry.id; });
        if (!book.alarms.length) book = HandlerPathAlarm.collectionDefaults();
        if (!selected()) book.selectedId = book.alarms[0].id;
        st = selected();
        writeFields();
        changed();
        $("alarm-add").focus();
      });
      row.append(edit, remove);
      list.append(row);
      rows.set(entry.id, status);
    });
  }

  function render() {
    tabs.timer.setAttribute("aria-pressed", st.mode === "timer");
    tabs.alarm.setAttribute("aria-pressed", st.mode === "alarm");
    tabs.timer.disabled = tabs.alarm.disabled = st.state === "running" || st.state === "ringing";
    fields.timer.hidden = st.mode !== "timer";
    fields.alarm.hidden = st.mode !== "alarm";
    btn.set.disabled = st.state === "ringing";
    btn.set.textContent = st.state === "running" ? "Save changes" : st.state === "paused" && !dirty ? "Resume" : "Set";
    btn.stop.disabled = st.state !== "running";
    btn.reset.disabled = st.state === "idle" && st.remainingMs === st.durationMs;
    btn.off.disabled = st.state !== "ringing";
    renderList();
    renderStatus(true);
  }

  // Periodic updates leave configuration controls and focused list buttons intact.
  function renderStatus(force) {
    var main = "—", description = "Not set";
    if (st.state === "running") {
      main = st.mode === "timer" ? fmtLeft(st.deadline - Date.now()) : HandlerPathTime.formatClock(st.deadline);
      description = st.mode === "timer" ? "Counting down" : note(st);
    } else if (st.state === "paused") {
      main = fmtLeft(st.remainingMs); description = "Stopped";
    } else if (st.state === "ringing") {
      main = "RINGING"; description = "Turn it off";
    }
    if (force || dlg.open) { setText(big, main); setText(sub, description); }
    var ringing = book.alarms.filter(function (entry) { return entry.state === "ringing"; });
    var active = book.alarms.filter(function (entry) { return entry.state === "running"; })
      .sort(function (a, b) { return a.deadline - b.deadline; });
    var paused = book.alarms.filter(function (entry) { return entry.state === "paused"; });
    var badge = "";
    if (ringing.length) badge = ringing.length === 1 ? "ALARM RINGING" : ringing.length + " ALARMS RINGING";
    else if (active.length) {
      var next = active[0];
      badge = (next.mode === "timer" ? "TIMER " + fmtLeft(next.deadline - Date.now()) :
        "ALARM " + HandlerPathTime.formatClock(next.deadline));
      if (active.length > 1) badge += " · +" + (active.length - 1) + " active";
    } else if (paused.length) badge = "TIMER " + fmtLeft(paused[0].remainingMs) + " STOPPED";
    statusEl.hidden = !badge;
    setText(statusEl, badge);
    if (force || dlg.open) book.alarms.forEach(function (entry) {
      if (rows.has(entry.id)) setText(rows.get(entry.id), note(entry));
    });
  }

  function commit(next) {
    book.alarms = book.alarms.map(function (entry) { return entry.id === st.id ? next : entry; });
    st = next;
    dirty = false;
    changed();
  }
  function changed() { save(); reconcile(); render(); }

  function tick() {
    var now = Date.now(), updated = false;
    book.alarms = book.alarms.map(function (entry) {
      if (entry.state === "running" && now >= entry.deadline) {
        updated = true;
        return HandlerPathAlarm.transition(entry, { type: "fire" });
      }
      if (entry.state === "ringing" && now - ringStarted.get(entry.id) >= RING_MAX_MS) {
        updated = true;
        return HandlerPathAlarm.transition(entry, { type: "off" });
      }
      return entry;
    });
    st = selected();
    if (updated) changed();
    else if (!document.hidden) renderStatus(false);
  }

  function reconcile() {
    var running = book.alarms.some(function (entry) { return entry.state === "running"; });
    if (running && !ticker) ticker = setInterval(tick, 1000);
    if (!running && ticker) { clearInterval(ticker); ticker = null; }
    var ringing = book.alarms.filter(function (entry) { return entry.state === "ringing"; });
    var ringingIds = new Set(ringing.map(function (entry) { return entry.id; }));
    ringStarted.forEach(function (_, id) { if (!ringingIds.has(id)) ringStarted.delete(id); });
    ringing.forEach(function (entry) { if (!ringStarted.has(entry.id)) ringStarted.set(entry.id, Date.now()); });
    if (ringing.length) {
      setText($("alarm-ring-text"), ringing.map(title).join(" · "));
      if (!beeper) {
        var live = $("logo");
        ringLogo.src = (live && live.currentSrc) || "HandlerPath_Gators-512.webp";
        ringLogo.alt = "Alarm";
        if (dlg.open) dlg.close();
        ring.hidden = false;
        $("alarm-off").focus();
        beep();
        beeper = setInterval(function () { tick(); beep(); }, 1500);
      }
    } else {
      if (beeper) { clearInterval(beeper); beeper = null; }
      var wasRinging = !ring.hidden;
      ring.hidden = true;
      if (wasRinging) $("alarm-link").focus();
    }
  }

  function set() {
    if (st.state === "ringing") return;
    var resume = st.state === "paused" && !dirty;
    var ms = resume ? st.remainingMs : readFields();
    if (!Number.isFinite(ms) || ms <= 0 || !Number.isFinite(new Date(Date.now() + ms).getTime())) {
      sub.textContent = "Enter a valid time first"; return;
    }
    audio();
    var base = resume ? st : HandlerPathAlarm.transition(st, { type: "reset" });
    commit(HandlerPathAlarm.transition(base, { type: "start", durationMs: ms, alarmTime: $("a-time").value }, Date.now()));
    dlg.close();
  }
  function turnOff() {
    book.alarms = book.alarms.map(function (entry) {
      return entry.state === "ringing" ? HandlerPathAlarm.transition(entry, { type: "off" }) : entry;
    });
    st = selected();
    changed();
  }

  $("alarm-link").addEventListener("click", function () { render(); dlg.showModal(); });
  $("alarm-close").addEventListener("click", function () { dlg.close(); });
  $("alarm-add").addEventListener("click", function () {
    var id;
    do { id = "alarm-" + Date.now() + "-" + (++sequence); }
    while (book.alarms.some(function (entry) { return entry.id === id; }));
    st = Object.assign({ id: id }, HandlerPathAlarm.defaults(), { mode: "alarm" });
    book.alarms.push(st);
    book.selectedId = id;
    writeFields();
    changed();
    $("a-time").focus();
  });
  Object.keys(tabs).forEach(function (mode) {
    tabs[mode].addEventListener("click", function () {
      if (st.state === "running" || st.state === "ringing") return;
      commit(HandlerPathAlarm.transition(st, { type: "mode", mode: mode }));
      writeFields();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".alarm-presets button"), function (button) {
    button.addEventListener("click", function () {
      writeTimerFields(+button.dataset.secs * 1000);
      commit(HandlerPathAlarm.transition(st, { type: "preset", durationMs: +button.dataset.secs * 1000 }));
    });
  });
  ["t-h", "t-m", "t-s", "a-time"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      dirty = true;
      btn.set.textContent = st.state === "running" ? "Save changes" : "Set";
    });
  });
  btn.set.addEventListener("click", set);
  btn.stop.addEventListener("click", function () {
    if (st.state === "running") commit(HandlerPathAlarm.transition(st, { type: "stop" }, Date.now()));
  });
  btn.reset.addEventListener("click", function () {
    commit(HandlerPathAlarm.transition(st, { type: "reset" })); writeFields();
  });
  btn.off.addEventListener("click", function () { commit(HandlerPathAlarm.transition(st, { type: "off" })); });
  $("alarm-off").addEventListener("click", turnOff);
  soundBox.addEventListener("change", function () {
    // Preferences do not replace unsaved time edits or restart other alarms.
    var next = HandlerPathAlarm.transition(st, { type: "sound", sound: soundBox.checked });
    book.alarms = book.alarms.map(function (entry) { return entry.id === st.id ? next : entry; });
    st = next; save();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !ring.hidden) turnOff();
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });

  writeFields();
  changed();
  if (document.location.hash === "#alarm" && ring.hidden) dlg.showModal();
})();
