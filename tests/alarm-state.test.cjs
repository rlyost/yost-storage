const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('assets/js/alarm-state.js', 'utf8'), context);
const model = context.HandlerPathAlarm;

test('pure transitions accept explicit time and never mutate their inputs', () => {
  const initial = Object.freeze(model.defaults());
  const running = Object.freeze(model.transition(initial, { type: 'start', durationMs: 60000 }, 1000));
  assert.equal(initial.state, 'idle'); assert.equal(initial.durationMs, 300000);
  const paused = Object.freeze(model.transition(running, { type: 'stop' }, 11000));
  assert.equal(paused.remainingMs, 50000); assert.equal(paused.deadline, 0);
  assert.equal(running.deadline, 61000);
  const resumed = model.transition(paused, { type: 'start', durationMs: 1 }, 100000);
  assert.equal(resumed.deadline, 150000); assert.equal(resumed.durationMs, 60000);
  const ringing = model.transition(resumed, { type: 'fire' });
  assert.equal(ringing.deadline, 0); assert.equal(ringing.remainingMs, 0);
  assert.equal(model.transition(ringing, { type: 'off' }).remainingMs, 60000);
});

test('preferences preserve a running deadline; decoding does not mutate defaults', () => {
  const defaults = Object.freeze(model.defaults());
  const running = model.transition(defaults, { type: 'start', durationMs: 10000 }, 1000);
  const muted = model.transition(running, { type: 'sound', sound: false });
  assert.equal(muted.deadline, running.deadline); assert.equal(running.sound, true);
  const restored = model.decode(JSON.stringify(running), defaults, 12000);
  assert.equal(restored.state, 'ringing'); assert.equal(restored.remainingMs, 0);
  assert.equal(defaults.state, 'idle');
});
