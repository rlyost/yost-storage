// Pure alarm state: no DOM, storage, audio, timers, or implicit clock reads.
var HandlerPathAlarm = (function () {
  var CATCHUP_MS = 300000;
  function defaults() {
    return {
      mode: "timer",
      state: "idle",
      durationMs: 300000,  // what Reset returns the timer to
      remainingMs: 300000, // banked time while paused or idle
      deadline: 0,         // epoch ms the timer/alarm fires
      alarmTime: "",       // "HH:MM" for alarm mode
      sound: true
    };
  }

  // Decode atomically: malformed or incomplete records fall back to defaults.
  // Unknown fields are ignored; this also decodes the legacy single record.
  function decode(raw, fallback, now) {
    var v;
    try { v = JSON.parse(raw); } catch (e) { return fallback; }
    function duration(n) {
      return Number.isFinite(n) && n >= 0 && n <= 8640000000000000;
    }
    if (!v || typeof v !== "object" || Array.isArray(v) ||
        !["timer", "alarm"].includes(v.mode) ||
        !["idle", "running", "paused", "ringing"].includes(v.state) ||
        !duration(v.durationMs) || !duration(v.remainingMs) ||
        !duration(v.deadline) || typeof v.sound !== "boolean" ||
        typeof v.alarmTime !== "string" ||
        (v.alarmTime !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.alarmTime)) ||
        (v.state === "paused" && v.mode !== "timer") ||
        (v.state === "running" && (v.deadline === 0 ||
          (v.mode === "alarm" && v.alarmTime === "")))) return fallback;
    var next = {};
    Object.keys(defaults()).forEach(function (key) { next[key] = v[key]; });
    if (next.state === "ringing") next.state = "idle";
    if (next.state === "running" && now >= next.deadline) {
      next.state = now - next.deadline < CATCHUP_MS ? "ringing" : "idle";
    }
    if (next.state !== "running") next.deadline = 0;
    if (next.state === "ringing") next.remainingMs = 0;
    return next;
  }

  // The controller supplies validated UI values and gates unavailable actions.
  // Only start/stop need an explicit epoch timestamp. Preferences do not restart effects.
  function transition(state, event, now) {
    var next = Object.assign({}, state);
    switch(event.type) {
      case "start":
        if(state.state !== "paused") {
          if(state.mode === "timer") next.durationMs = event.durationMs;
          else next.alarmTime = event.alarmTime;
        }
        next.remainingMs = state.state === "paused" ? state.remainingMs : event.durationMs;
        next.deadline = now + next.remainingMs;
        next.state = "running";
        break;
      case "stop":
        if(state.state !== "running") return state;
        next.remainingMs = state.mode === "timer" ? Math.max(0, state.deadline - now) : state.durationMs;
        next.state = state.mode === "timer" ? "paused" : "idle";
        break;
      case "mode":
        next.mode = event.mode;
        next.remainingMs = state.durationMs;
        next.state = "idle";
        break;
      case "reset":
      case "off":
        next.remainingMs = state.durationMs;
        next.state = "idle";
        break;
      case "preset":
        next.durationMs = next.remainingMs = event.durationMs;
        next.state = "idle";
        break;
      case "fire":
        next.state = "ringing";
        next.remainingMs = 0;
        break;
      case "sound":
        next.sound = event.sound;
        return next;
      case "alarmTime":
        next.alarmTime = event.alarmTime;
        return next;
      default:
        throw new Error("Unknown alarm event: " + event.type);
    }
    if(next.state !== "running") next.deadline = 0;
    return next;
  }

  function collectionDefaults() {
    return { version: 2, selectedId: "alarm-1", alarms: [Object.assign({ id: "alarm-1" }, defaults())] };
  }

  // Migrate the original single timer/alarm, preserving its deadline and preferences.
  function decodeCollection(raw, now) {
    var fallback = collectionDefaults(), value;
    try { value = JSON.parse(raw); } catch (e) { return fallback; }
    if (!value || value.version !== 2) {
      fallback.alarms[0] = Object.assign({ id: "alarm-1" }, decode(raw, defaults(), now));
      return fallback;
    }
    if (!Array.isArray(value.alarms) || !value.alarms.length) return fallback;
    var ids = new Set(), alarms = [];
    for (var i = 0; i < value.alarms.length; i++) {
      var record = value.alarms[i];
      if (!record || typeof record.id !== "string" || !record.id || ids.has(record.id)) return fallback;
      var state = decode(JSON.stringify(record), null, now);
      if (!state) return fallback;
      ids.add(record.id);
      alarms.push(Object.assign({ id: record.id }, state));
    }
    return { version: 2, selectedId: ids.has(value.selectedId) ? value.selectedId : alarms[0].id, alarms: alarms };
  }

  return Object.freeze({ defaults: defaults, decode: decode, transition: transition,
    collectionDefaults: collectionDefaults, decodeCollection: decodeCollection });
})();
