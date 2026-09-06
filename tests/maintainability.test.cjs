const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync('assets/js/' + name + '.js', 'utf8');

test('shared formatter preserves locale output for Date and timestamp inputs', () => {
  const context = vm.createContext({});
  vm.runInContext(read('time'), context);
  for (const value of [0, Date.now(), new Date(2026, 8, 5, 23, 59)]) {
    assert.equal(context.HandlerPathTime.formatClock(value),
      new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  }
  const html = fs.readFileSync('index.html', 'utf8');
  for (const name of ['clock', 'alarm']) {
    assert.ok(html.indexOf('assets/js/time.js') < html.indexOf('assets/js/' + name + '.js'));
  }
});

test('manual keeps state private and preserves filtering, clearing and tab navigation', () => {
  function element(text = '') {
    const classes = new Set();
    const listeners = {};
    return { textContent: text, dataset: {}, value: '',
      classList: { add: x => classes.add(x), remove: x => classes.delete(x),
        toggle(x, on) { if (on) classes.add(x); else classes.delete(x); },
        contains: x => classes.has(x) },
      addEventListener: (name, fn) => { listeners[name] = fn; },
      emit: (name, event) => listeners[name](event),
      closest() { return this.session ?? null; }
    };
  }
  const cards = [element('Alpha dog'), element('Beta cat')];
  cards[1].session = element();
  const buttons = ['curriculum', 'log'].map(name => {
    const button = element(); button.dataset.view = name;
    button.closest = () => button; return button;
  });
  const tabs = element(); tabs.querySelectorAll = () => buttons;
  const ids = Object.fromEntries(['q', 'view-curriculum', 'view-log',
    'nav-curriculum', 'nav-log'].map(id => [id, element()]));
  const side = { scrollTop: 100 };
  let frame = null;
  let scroll = null;
  const context = vm.createContext({
    document: {
      querySelector: selector => selector === '.tabs' ? tabs : side,
      querySelectorAll: selector => selector === '.card' ? cards : [],
      getElementById: id => ids[id],
      // PRE content is searchable but intentionally excluded from highlighting.
      createTreeWalker(card) { let visited = false;
        return { nextNode() { if (visited) return null; visited = true;
          return { nodeValue: card.textContent, parentNode: { nodeName: 'PRE' } }; } }; }
    },
    NodeFilter: { SHOW_TEXT: 4 },
    window: { scrollTo(value) { scroll = value; } },
    cancelAnimationFrame() { frame = null; },
    requestAnimationFrame(fn) { frame = fn; return 1; }
  });
  const originalGlobals = Object.keys(context);
  vm.runInContext(read('manual'), context);
  assert.deepEqual(Object.keys(context), originalGlobals);
  assert.ok(cards.every(card => !Object.hasOwn(card, '_searchText')));
  function search(value) { ids.q.value = value; ids.q.emit('input'); frame(); }
  search('ALPHA');
  assert.equal(cards[0].classList.contains('hidden'), false);
  assert.equal(cards[1].classList.contains('hidden'), true);
  assert.equal(cards[1].session.classList.contains('hidden'), true);
  tabs.emit('click', { target: buttons[1] });
  assert.equal(ids['view-curriculum'].classList.contains('hidden'), true);
  assert.equal(ids['nav-curriculum'].classList.contains('hidden'), true);
  assert.equal(ids['view-log'].classList.contains('hidden'), false);
  assert.equal(buttons[1].classList.contains('active'), true);
  assert.equal(side.scrollTop, 0); assert.equal(scroll.top, 0);
  search('x');
  assert.ok(cards.every(card => !card.classList.contains('hidden')));
  assert.equal(cards[1].session.classList.contains('hidden'), false);
  assert.equal(ids['view-curriculum'].classList.contains('hidden'), true);
  search('['); search('.*'); // Literal regexp characters remain safe.
  assert.ok(cards.every(card => card.classList.contains('hidden')));
  search(''); assert.ok(cards.every(card => !card.classList.contains('hidden')));
});
