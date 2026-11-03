const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dashboardFile = name => path.join(__dirname, '../../dashboards', name);
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(dashboardFile('titanlog-data.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(dashboardFile('titanlog-model.js'), 'utf8'), context);
const data = context.window.TITANLOG_DATA, backup = data.backup, model = context.window.TitanLogModel;

test('correct backup preserves all source collections and replaces experiment data', () => {
  assert.equal(data.sourceFile, 'titanlog-backup-20261102-164353.json');
  assert.equal(backup.formatVersion, 2);
  assert.equal(backup.workouts.length, 267); assert.equal(backup.exercises.length, 1228);
  assert.equal(backup.personalRecords.length, 1257); assert.equal(backup.templates.length, 38);
  assert.equal(backup.routines.length, 6); assert.equal(backup.bodyMeasurements.length, 3);
  assert.equal(backup.preferences.weightUnitRaw, 'lb');
  assert.equal(backup.workouts.flatMap(w => w.exercises.flatMap(e => e.sets)).length, 2899);
  assert.equal(data.experiments, undefined);
});

test('completed and abandoned sessions stay separate; completed sets in abandoned sessions are retained', () => {
  const completed = model.selectWorkouts(backup, 'all', 'completed');
  const abandoned = model.selectWorkouts(backup, 'all', 'abandoned');
  assert.equal(completed.length, 147); assert.equal(abandoned.length, 120);
  assert.equal(model.selectWorkouts(backup, 'all', 'all').length, 267);
  const summary = model.summary(completed);
  assert.equal(summary.sets, 2843); assert.equal(summary.medianSeconds, 3120);
  assert.equal(summary.longTimers, 6);
  assert.ok(Math.abs(summary.volumeKg - 1362801.028021318) < 1e-7);
  assert.equal(model.summary(abandoned).sets, 56);
  assert.equal(model.summary(abandoned).medianSeconds, 0);
  assert.equal(model.summary([]).medianSeconds, null);
});

test('Pacific date windows include the export date and do not shift evening sessions into tomorrow', () => {
  assert.equal(model.dayKey(backup.exportedAt), '2026-11-02');
  assert.equal(model.dayKey('2026-11-02T04:34:54Z'), '2026-11-01');
  assert.equal(model.dayKey('2026-10-03T19:00:00Z'), '2026-10-03');
  assert.equal(model.range(backup, '30').start, '2026-10-04');
  assert.equal(model.range(backup, '90').start, '2026-08-05');
  const recent = model.selectWorkouts(backup, '30', 'completed');
  assert.equal(recent.length, 14); assert.equal(model.summary(recent).sets, 245);
  assert.equal(model.selectWorkouts(backup, '90', 'completed').length, 43);
  assert.equal(model.records(backup, '30', 'completed').length, 96);
  assert.equal(model.records(backup, '90', 'completed').length, 404);
});

test('weekly buckets preserve counts and recorded volumes, with zero weeks included', () => {
  const workouts = model.selectWorkouts(backup, 'all', 'completed');
  const buckets = model.weekly(workouts, model.range(backup, 'all'));
  assert.equal(buckets.reduce((sum, week) => sum + week.sessions, 0), 147);
  assert.ok(Math.abs(buckets.reduce((sum, week) => sum + week.volumeKg, 0) - model.summary(workouts).volumeKg) < 1e-7);
  assert.ok(buckets.every(week => new Date(week.date+'T12:00:00Z').getUTCDay() === 1));
  const fixture = [{ startedAt: '2026-10-05T19:00:00Z', totalVolumeKg: 5 }];
  const weeks = model.weekly(fixture, { start: '2026-10-05', end: '2026-10-20' });
  assert.equal(weeks.length, 3); assert.equal(weeks[1].sessions, 0); assert.equal(weeks[2].sessions, 0);
});

test('muscle grouping counts each completed set once instead of repeating secondary muscles', () => {
  const workouts = model.selectWorkouts(backup, 'all', 'completed');
  const map = new Map(backup.exercises.map(exercise => [exercise.id.toUpperCase(), exercise]));
  const groups = model.muscleSets(workouts, map);
  assert.equal(groups.reduce((sum, [, count]) => sum + count, 0), 2843);
  assert.ok(groups[0][1] >= groups.at(-1)[1]);
});

test('exercise progress uses logged weights without doubling and excludes unlogged planned exercises', () => {
  const latest = model.selectWorkouts(backup, 'all', 'completed')[0];
  const rdl = model.exerciseHistory([latest], '77777777-0007-0000-0000-000000000002', 'load');
  assert.equal(rdl.length, 1); assert.equal(rdl[0].value, 83.91458845185656); assert.equal(rdl[0].sets, 4);
  assert.equal(model.exerciseHistory([latest], '66666666-0006-0000-0000-000000000001', 'load').length, 0);
  assert.equal(model.exerciseHistory([latest], '88888888-0008-0000-0000-000000000001', 'load').length, 0);
  const calfReps = model.exerciseHistory([latest], '88888888-0008-0000-0000-000000000001', 'reps');
  assert.equal(calfReps[0].value, 60);
  assert.equal(model.exerciseHistory([latest], '77777777-0007-0000-0000-000000000002', 'reps')[0].value, 34);
});

test('weight conversion and CSV output keep original record values and safe document text', () => {
  assert.ok(Math.abs(model.weight(1, 'lb') - 2.2046226218487757) < 1e-12);
  assert.equal(model.weight(1, 'kg'), 1);
  assert.ok(Math.abs(model.weight(backup.preferences.bodyWeightKg, 'lb') - 220.00370007741703) < 1e-6);
  const csv = model.csv([['Name', 'Volume'], ['=1+1,"quoted"', 42]]);
  assert.ok(csv.includes('"\'=1+1,""quoted"""')); assert.ok(csv.includes('"42"'));
});

test('model calculations do not mutate source workout or record ordering', () => {
  const before = JSON.stringify(backup);
  const workouts = model.selectWorkouts(backup, '90', 'completed');
  model.summary(workouts); model.weekly(workouts, model.range(backup, '90'));
  model.exerciseHistory(workouts, backup.exercises[0].id, 'reps'); model.records(backup, '90', 'completed');
  assert.equal(JSON.stringify(backup), before);
});
