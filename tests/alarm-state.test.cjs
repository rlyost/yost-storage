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

test('collection decoding migrates legacy state and recovers each independent deadline', () => {
  const running = model.transition(model.defaults(), { type: 'start', durationMs: 10000 }, 1000);
  const migrated = model.decodeCollection(JSON.stringify(running), 2000);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.alarms[0].deadline, 11000);
  const saved = { version: 2, selectedId: 'second', alarms: [
    { ...running, id: 'first' }, { ...running, deadline: 20000, id: 'second' }
  ] };
  const restored = model.decodeCollection(JSON.stringify(saved), 12000);
  assert.equal(restored.selectedId, 'second');
  assert.equal(restored.alarms[0].state, 'ringing');
  assert.equal(restored.alarms[1].deadline, 20000);
  assert.equal(saved.alarms[0].state, 'running');
});

test('malformed collections fall back safely and missing selection picks the first entry', () => {
  const valid = { ...model.defaults(), id: 'one' };
  for (const alarms of [[], null, [valid, valid], [{ ...valid, sound: 'yes' }],
    [{ ...valid, id: null }], [null]]) {
    const restored = model.decodeCollection(JSON.stringify({ version: 2, alarms }), 1000);
    assert.equal(restored.alarms.length, 1);
    assert.equal(restored.selectedId, 'alarm-1');
    assert.equal(restored.alarms[0].sound, true);
  }
  const restored = model.decodeCollection(JSON.stringify({ version: 2, selectedId: 'missing', alarms: [valid] }), 1000);
  assert.equal(restored.selectedId, 'one');
});
