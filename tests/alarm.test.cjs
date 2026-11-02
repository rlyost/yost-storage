const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = ['time', 'alarm-state', 'alarm'].map(name =>
  fs.readFileSync('assets/js/' + name + '.js', 'utf8')).join('\n');
const initial = { mode: 'timer', state: 'idle', durationMs: 300000,
  remainingMs: 300000, deadline: 0, alarmTime: '', sound: true };

// Execute the production controller with controlled browser boundaries. Tests
// drive registered UI events and inspect persisted state and visible effects.
function app(options = {}) {
  let now = options.now ?? new Date(2026, 8, 5, 12).getTime();
  let stored = options.raw ?? JSON.stringify({ ...initial, ...options.state });
  let sequence = 0;
  const intervals = new Map();
  function element() {
    const listeners = {};
    return { value: '', hidden: true, open: false, dataset: {}, textContent: '', children: [],
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; },
      focus() { document.activeElement = this; },
      addEventListener(name, fn) { listeners[name] = fn; },
      emit(name, event = {}) { listeners[name]?.(event); },
      setAttribute() { this.attributeWrites = (this.attributeWrites || 0) + 1; }, close() { this.open = false; },
      showModal() { this.open = true; } };
  }
  const elements = {};
  const document = element();
  document.location = { hash: options.hash || "" };
  document.hidden = false;
  document.getElementById = id => elements[id] ??= element();
  document.createElement = () => element();
  const preset = element();
  preset.dataset.secs = '60';
  document.querySelectorAll = () => [preset];
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  vm.runInNewContext(source, { document, Date: Clock,
    window: options.window ?? {},
    localStorage: {
      getItem() { if (options.storageFails) throw Error('blocked'); return stored; },
      setItem(key, value) { assert.equal(key, 'handlerpath.alarm');
        if (options.storageFails) throw Error('blocked'); stored = value; }
    },
    setInterval(fn, delay) { intervals.set(++sequence, { fn, delay }); return sequence; },
    clearInterval(id) { intervals.delete(id); }
  });
  return { elements, document, preset, intervals,
    book: () => JSON.parse(stored),
    state() { const book = JSON.parse(stored);
      const { id, ...state } = book.alarms.find(entry => entry.id === book.selectedId);
      return state; },
    select(index) { elements['alarm-list'].children[index].children[0].emit('click'); },
    remove(index) { elements['alarm-list'].children[index].children[1].emit('click'); },
    click: id => elements[id].emit('click'),
    advance(ms) { now += ms; },
    tick() { for (const { fn } of [...intervals.values()]) fn(); },
    timer(seconds) { elements['t-h'].value = Math.floor(seconds / 3600);
      elements['t-m'].value = Math.floor(seconds / 60) % 60;
      elements['t-s'].value = seconds % 60; elements['btn-set'].emit('click'); }
  };
}

test('invalid records atomically restore defaults', () => {
  const records = ['{', 'null', '[]', '4', '{}'];
  for (const patch of [{ mode: 'bad' }, { state: 'fire' }, { sound: 'false' },
    { durationMs: -1 }, { remainingMs: '100' }, { deadline: 1e300 },
    { durationMs: 1e309 }, { alarmTime: '24:00' },
    { mode: 'alarm', state: 'paused' }, { state: 'running', deadline: 0 }]) {
    records.push(JSON.stringify({ ...initial, ...patch }));
  }
  for (const raw of records) assert.deepEqual(app({ raw }).state(), initial, raw);
});

test('unknown keys and shadowed hasOwnProperty do not break valid records', () => {
  const a = app({ state: { hasOwnProperty: null, extra: true, sound: false } });
  assert.deepEqual(a.state(), { ...initial, sound: false });
});

test('timer pause and resume bank time, reset restores configured duration', () => {
  const a = app(); a.timer(60); a.advance(12500); a.click('btn-stop');
  assert.equal(a.state().remainingMs, 47500);
  assert.equal(a.state().state, 'paused'); assert.equal(a.intervals.size, 0);
  a.advance(100000); a.click('btn-set'); a.advance(47500); a.tick();
  assert.equal(a.state().state, 'ringing');
  assert.equal(a.elements['alarm-ring'].hidden, false);
  a.click('btn-reset');
  assert.equal(a.state().remainingMs, 60000);
  assert.equal(a.state().state, 'idle'); assert.equal(a.intervals.size, 0);
  assert.equal(a.elements['alarm-ring'].hidden, true);
});

test('wall-clock time already passed rolls to tomorrow and stop disarms', () => {
  const now = new Date(2026, 8, 5, 23, 59).getTime();
  const a = app({ now }); a.click('mode-alarm');
  a.elements['a-time'].value = '00:01'; a.click('btn-set');
  assert.equal(a.state().deadline, new Date(2026, 8, 6, 0, 1).getTime());
  a.click('btn-stop'); assert.equal(a.state().state, 'idle');
  assert.equal(a.state().deadline, 0); assert.equal(a.intervals.size, 0);
});

test('restoration covers future, recent, exact catch-up boundary and saved ringing', () => {
  const now = Date.now();
  for (const [offset, expected] of [[10000, 'running'], [0, 'ringing'],
    [-299999, 'ringing'], [-300000, 'idle'], [-999999, 'idle']]) {
    const a = app({ now, state: { state: 'running', deadline: now + offset } });
    assert.equal(a.state().state, expected);
    assert.equal(a.intervals.size, expected === 'idle' ? 0 : 1);
  }
  assert.equal(app({ state: { state: 'ringing' } }).state().state, 'idle');
});

test('presets cancel all active effects in every state', () => {
  for (const state of ['idle', 'running', 'paused', 'ringing']) {
    const a = app();
    if (state !== 'idle') a.timer(1);
    if (state === 'paused') a.click('btn-stop');
    if (state === 'ringing') { a.advance(1000); a.tick(); }
    a.preset.emit('click');
    assert.equal(a.state().state, 'idle', state);
    assert.equal(a.state().deadline, 0, state);
    assert.equal(a.state().durationMs, 60000, state);
    assert.equal(a.intervals.size, 0, state);
    assert.equal(a.elements['alarm-ring'].hidden, true, state);
  }
});

test('visibility catch-up fires immediately without waiting for a ticker', () => {
  const a = app(); a.timer(1); a.document.hidden = true; a.advance(5000);
  a.document.hidden = false; a.document.emit('visibilitychange');
  assert.equal(a.state().state, 'ringing');
  a.document.emit('visibilitychange'); assert.equal(a.intervals.size, 1);
  a.document.emit('keydown', { key: 'Escape' });
  assert.equal(a.state().state, 'idle'); assert.equal(a.intervals.size, 0);
});

test('ringing self-stops after five minutes', () => {
  const a = app(); a.timer(1); a.advance(1000); a.tick();
  a.advance(300001); a.tick();
  assert.equal(a.state().state, 'idle'); assert.equal(a.intervals.size, 0);
});

test('unavailable storage and audio do not prevent timer operation', async () => {
  for (const window of [{}, { AudioContext() { throw Error('unavailable'); } },
    { AudioContext: class { constructor() { this.state = 'suspended'; }
      resume() { throw Error('blocked'); } } }]) {
    const a = app({ storageFails: true, window });
    a.timer(1); a.advance(1000); a.tick();
    assert.equal(a.elements['alarm-ring'].hidden, false);
    a.click('alarm-off'); assert.equal(a.intervals.size, 0);
  }
});

test('invalid timer inputs cannot create an unfinishable deadline', () => {
  const a = app(); a.timer(Infinity);
  assert.equal(a.state().state, 'idle'); assert.equal(a.intervals.size, 0);
});

test('countdown ticks skip configuration and closed-dialog writes', () => {
  const a = app(); a.timer(60);
  const writes = a.elements['mode-timer'].attributeWrites;
  const display = a.elements['alarm-big'].textContent;
  a.advance(1000); a.tick();
  assert.equal(a.elements['mode-timer'].attributeWrites, writes);
  assert.equal(a.elements['alarm-big'].textContent, display);
  assert.match(a.elements['alarm-status'].textContent, /0:59/);
  a.elements['alarm-dialog'].showModal();
  a.advance(1000); a.tick();
  assert.equal(a.elements['alarm-big'].textContent, '0:58');
});

test('alarm URL opens the alarm dialog on load', () => {
  const a = app({ hash: '#alarm' });
  assert.equal(a.elements['alarm-dialog'].open, true);
});

test('multiple alarms can be added, edited and deleted without changing other deadlines', () => {
  const now = new Date(2026, 8, 5, 12).getTime();
  const a = app({ now });
  a.timer(60);
  const first = a.book().alarms[0];
  a.click('alarm-add');
  a.elements['a-time'].value = '12:02'; a.click('btn-set');
  assert.equal(a.book().alarms.length, 2);
  assert.equal(a.book().alarms[0].deadline, first.deadline);
  const secondId = a.book().selectedId;
  a.elements['a-time'].value = '12:03';
  a.elements['a-time'].emit('input'); a.click('btn-set');
  assert.equal(a.state().deadline, now + 180000);
  assert.equal(a.book().selectedId, secondId);
  assert.equal(a.book().alarms[0].deadline, first.deadline);
  a.select(0); a.click('btn-stop');
  assert.equal(a.book().alarms[1].deadline, now + 180000);
  a.remove(0);
  assert.equal(a.book().selectedId, secondId);
  assert.equal(a.state().deadline, now + 180000);
  a.remove(0);
  assert.equal(a.book().alarms.length, 1);
  assert.equal(a.state().state, 'idle');
  assert.equal(a.intervals.size, 0);
});

test('simultaneous and staggered alarms ring independently while other timers continue', () => {
  const a = app(); a.timer(1);
  a.click('alarm-add'); a.click('mode-timer'); a.timer(1);
  a.click('alarm-add'); a.click('mode-timer'); a.timer(10);
  a.advance(1000); a.tick();
  assert.deepEqual(a.book().alarms.map(entry => entry.state), ['ringing', 'ringing', 'running']);
  assert.equal(a.elements['alarm-status'].textContent, '2 ALARMS RINGING');
  assert.equal(a.elements['alarm-ring'].hidden, false);
  a.click('alarm-off');
  assert.deepEqual(a.book().alarms.map(entry => entry.state), ['idle', 'idle', 'running']);
  assert.equal(a.intervals.size, 1);
  a.advance(9000); a.tick();
  assert.equal(a.state().state, 'ringing');
  a.remove(2);
  assert.equal(a.elements['alarm-ring'].hidden, true);
  assert.equal(a.intervals.size, 0);
});

test('a selected idle alarm does not prevent other alarms from catching up or reloading', () => {
  const now = new Date(2026, 8, 5, 12).getTime();
  const a = app({ now }); a.timer(1); a.click('alarm-add');
  const saved = JSON.stringify(a.book());
  const restored = app({ now: now + 1000, raw: saved });
  assert.equal(restored.state().mode, 'alarm');
  assert.equal(restored.state().state, 'idle');
  assert.equal(restored.book().alarms[0].state, 'ringing');
  assert.equal(restored.elements['alarm-ring'].hidden, false);
  a.document.hidden = true; a.advance(1000);
  a.document.hidden = false; a.document.emit('visibilitychange');
  assert.equal(a.book().alarms[0].state, 'ringing');
});

test('editing a paused timer sets a new duration and invalid edits preserve running alarms', () => {
  const a = app(); a.timer(60); a.advance(10000); a.click('btn-stop');
  a.elements['t-s'].value = 5; a.elements['t-s'].emit('input');
  a.click('btn-set');
  assert.equal(a.state().durationMs, 65000);
  const deadline = a.state().deadline;
  for (const value of [-1, 60, 0.5, Infinity]) {
    a.elements['t-m'].value = value; a.click('btn-set');
    assert.equal(a.state().deadline, deadline);
    assert.equal(a.state().state, 'running');
  }
});

test('ring timeout belongs to each alarm and is not restarted by unrelated changes', () => {
  const a = app(); a.timer(1); a.click('alarm-add'); a.click('mode-timer'); a.timer(121);
  a.advance(1000); a.tick();
  a.advance(120000); a.tick();
  a.advance(180000); a.tick();
  assert.deepEqual(a.book().alarms.map(entry => entry.state), ['idle', 'ringing']);
  a.advance(120000); a.tick();
  assert.equal(a.elements['alarm-ring'].hidden, true);
  assert.equal(a.intervals.size, 0);
});
