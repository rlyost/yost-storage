const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function calculator() {
  const elements = {};
  let focused;
  function element() {
    const events = {};
    return { open: false, textContent: '0', attributes: {},
      addEventListener(name, fn) { events[name] = fn; },
      emit(name, event = {}) { events[name]?.(event); },
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { focused = this; }, show() { this.open = true; },
      close() { this.open = false; },
      querySelector() { return elements['calc-close']; } };
  }
  const document = element();
  document.getElementById = id => elements[id] ??= element();
  vm.runInNewContext(fs.readFileSync('assets/js/calculator.js', 'utf8'), { document });
  return { elements, focus: () => focused,
    click(id) { elements[id].emit('click'); },
    button(dataset) { elements['calc-keys'].emit('click', {
      target: { closest: () => ({ dataset }) } }); },
    key(key, tagName = 'BUTTON') {
      let prevented = false;
      document.emit('keydown', { key, target: { tagName }, preventDefault() { prevented = true; } });
      return prevented;
    },
    display: () => elements['calc-display'].textContent
  };
}

test('calculator opens, closes, and returns focus through each control', () => {
  const c = calculator();
  c.click('calc-link'); assert.equal(c.elements.calculator.open, true);
  assert.equal(c.focus(), c.elements['calc-close']);
  assert.equal(c.elements['calc-link'].attributes['aria-expanded'], 'true');
  c.key('Escape'); assert.equal(c.elements.calculator.open, false);
  assert.equal(c.focus(), c.elements['calc-link']);
  assert.equal(c.elements['calc-link'].attributes['aria-expanded'], 'false');
  c.click('calc-link'); c.click('calc-close');
  assert.equal(c.focus(), c.elements['calc-link']);
  c.click('calc-link'); c.click('calc-link');
  assert.equal(c.elements.calculator.open, false);
});

test('keyboard arithmetic, decimal aliases, editing, percent and error recovery', () => {
  const c = calculator(); c.click('calc-link');
  for (const key of ['1', ',', '5', '+', '2', '.', '5', 'Enter']) assert.equal(c.key(key), true);
  assert.equal(c.display(), '4');
  c.key('*'); c.key('3'); c.key('='); assert.equal(c.display(), '12');
  c.key('%'); assert.equal(c.display(), '0.12');
  c.button({ action: 'clear' });
  c.key('9'); c.key('/'); c.key('0'); c.key('Enter'); assert.equal(c.display(), 'Error');
  c.key('5'); assert.equal(c.display(), '5');
  c.key('6'); c.key('Backspace'); assert.equal(c.display(), '5');
  c.button({ action: 'sign' }); assert.equal(c.display(), '-5');
});

test('keyboard leaves editable controls and closed calculator alone', () => {
  const c = calculator(); assert.equal(c.key('7'), false);
  c.click('calc-link');
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) assert.equal(c.key('7', tag), false);
  assert.equal(c.key('Tab'), false); assert.equal(c.key('a'), false);
  assert.equal(c.display(), '0');
});

test('delegated buttons support zero, chaining, operation replacement and digit limit', () => {
  const c = calculator(); c.click('calc-link');
  for (const digit of '1234567890123') c.button({ digit });
  assert.equal(c.display(), '123456789012');
  c.button({ action: 'clear' }); c.button({ digit: '8' });
  c.button({ operation: '+' }); c.button({ operation: '-' });
  c.button({ digit: '3' }); c.button({ operation: '*' });
  c.button({ digit: '0' }); c.button({ action: 'equals' });
  assert.equal(c.display(), '0');
});
