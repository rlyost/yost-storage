const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dashboardFile = name => path.join(__dirname, '../../dashboards', name);
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(dashboardFile('data.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(dashboardFile('model.js'), 'utf8'), context);
const data = context.window.LAB_DATA, model = context.window.LabModel;
const byName = name => data.tests.find(test => test.name === name);

test('all supplied markers and measurements are preserved without treating blanks as zero', () => {
  assert.equal(data.tests.length, 75);
  assert.equal(data.samples.length, 12);
  assert.equal(new Set(data.tests.map(t => t.panel)).size, 7);
  assert.equal(data.tests.reduce((n, t) => n + Object.keys(t.results).length, 0), 522);
  assert.equal(byName('Cholesterol, Total').results.C, undefined);
  assert.equal(byName('LDL Cholesterol').results.N.value, 152);
  assert.equal(byName('Creatinine').results.N.display, '1.52');
  assert.equal(byName('FSH').results.N.display, '<0.7');
  assert.equal(byName('Absolute Monocytes').results.N.cell, 'N70');
});

test('same-day labs preserve their different values and separate collection identity', () => {
  const first = data.samples.find(s => s.id === 'J'), second = data.samples.find(s => s.id === 'K');
  assert.equal(first.date, second.date);
  assert.equal(first.lab, 'Lyster'); assert.equal(second.lab, 'Junction');
  assert.equal(byName('Albumin').results.J.value, 4.9);
  assert.equal(byName('Albumin').results.K.value, 4.7);
  assert.equal(byName('Testosterone, Total').results.J.value, 368);
  assert.equal(byName('Testosterone, Total').results.K.value, 407);
});

test('range comparison respects strict bounds, inclusivity, missing ranges and qualified values', () => {
  const classify = (limits, value, qualifier = '') => model.status({ limits }, { value, qualifier });
  assert.equal(classify({ op: '<', bound: 100 }, 100), 'high');
  assert.equal(classify({ op: '>', bound: 60 }, 60), 'low');
  assert.equal(classify({ min: 7, max: 25 }, 25), 'in');
  assert.equal(classify({ min: 7, max: 25 }, 7), 'in');
  assert.equal(classify({ op: '<', bound: 75 }, 10, '<'), 'in');
  assert.equal(classify({ min: 1.4, max: 12.8 }, 0.7, '<'), 'low');
  assert.equal(classify({ min: 1.4, max: 12.8 }, 3, '<'), 'unknown');
  assert.equal(classify({ op: '<', bound: 100 }, 100, '<'), 'in');
  assert.equal(classify(null, 69.8), 'unknown');
  assert.equal(model.status(byName('TSH'), undefined), 'missing');
  const latest = data.tests.map(t => model.status(t, t.results.N));
  assert.equal(latest.filter(s => s === 'high').length, 12);
  assert.equal(latest.filter(s => s === 'low').length, 3);
});

test('comparisons use earlier same-lab results and never calculate exact deltas from bounds', () => {
  const sample = data.samples.find(s => s.id === 'K');
  const prev = model.previous(byName('Albumin'), sample, data.samples);
  assert.equal(prev.sample.id, 'I');
  const latest = data.samples.at(-1);
  assert.equal(model.previous(byName('LDL Cholesterol'), latest, data.samples).sample.id, 'M');
  assert.equal(model.change({ value: 152 }, { value: 137 }), 15);
  assert.equal(model.change({ value: 0.7, qualifier: '<' }, { value: 7.8 }), null);
  assert.equal(model.change(undefined, { value: 5 }), null);
});

test('charts end at the selected collection and do not merge same-day labs', () => {
  const selected = data.samples.find(s => s.id === 'K');
  const samples = model.chartSamples(data.samples, selected, 'all');
  assert.equal(samples.some(s => s.id === 'J'), false);
  assert.equal(samples.some(s => s.id === 'K'), true);
  assert.ok(samples.every(s => s.date <= selected.date));
  const year = model.chartSamples(data.samples, data.samples.at(-1), '1');
  assert.ok(year.every(s => s.date >= '2025-10-28'));
});
