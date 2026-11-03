async () => {
  const $ = id => document.getElementById(id), checks = [];
  function check(value, message) { if (!value) throw Error(message); checks.push(message); }
  function choose(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('change', { bubbles: true })); }
  function input(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('input', { bubbles: true })); }
  const data = window.TITANLOG_DATA, backup = data.backup;
  check(data.sourceFile === 'titanlog-backup-20261102-164353.json' && !data.experiments, 'Correct backup replaces the mistaken experiment export');
  check(backup.workouts.length === 267 && backup.exercises.length === 1228 && backup.personalRecords.length === 1257, 'All source workout, exercise and record collections are present');
  check($('training-session-count').textContent === '147' && $('training-set-count').textContent === '2,843', 'Default view shows completed sessions and their logged sets');
  check($('training-median').textContent === '52 min' && $('training-timer-note').textContent.includes('6 recorded timers'), 'Median duration preserves long-timer context');
  check($('workout-row-count').textContent === 'Showing 1–12 of 147', 'Workout history paginates the full completed selection');
  $('workout-next').click(); check($('workout-row-count').textContent === 'Showing 13–24 of 147', 'Next workout page advances');
  $('workout-prev').click(); check($('workout-prev').disabled, 'Previous page returns to the first page');
  choose('training-period', '90'); check($('training-session-count').textContent === '43' && $('training-set-count').textContent === '859', 'Ninety-day summary matches source totals');
  choose('training-period', '30'); check($('training-session-count').textContent === '14' && $('training-set-count').textContent === '245', 'Thirty-day summary matches source totals');
  check($('record-row-count').textContent.includes('of 96'), 'Record history respects its achievement-date range');
  choose('training-period', 'all'); choose('training-status', 'abandoned');
  check($('training-session-count').textContent === '120' && $('training-set-count').textContent === '56', 'Abandoned sessions retain their completed sets separately');
  choose('training-status', 'all'); check($('training-session-count').textContent === '267' && $('training-set-count').textContent === '2,899', 'All-session view combines source statuses explicitly');
  choose('training-status', 'completed'); choose('training-unit', 'kg');
  check($('body-cards').textContent.includes('99.8kg') && $('training-volume').textContent.includes('kg'), 'Weight-unit changes apply to workout totals and saved body weight');
  choose('training-unit', 'lb');
  const bar = $('rhythm-chart').querySelector('[data-point]'); bar.focus();
  check(!$('rhythm-chart').querySelector('.data-tooltip').hidden && $('rhythm-chart').querySelector('.data-tooltip').textContent.includes('Week of'), 'Weekly chart points have keyboard-accessible labels'); bar.blur();
  choose('rhythm-metric', 'volume'); check($('rhythm-chart-note').textContent.includes('Saved workout volume'), 'Weekly chart switches to imported volume'); choose('rhythm-metric', 'sessions');
  const pushup = backup.exercises.find(e => e.name === 'Push Up');
  choose('exercise-select', pushup.id); check($('exercise-metric').value === 'reps', 'Reps-only exercises automatically select a suitable metric');
  check($('exercise-chart').querySelectorAll('.data-point').length > 0, 'Exercise progress shows session values');
  $('exercise-history-open').click(); check($('exercise-dialog').matches(':modal') && $('exercise-detail-rows').children.length > 0, 'Exercise chart exposes its data as a history table');
  $('exercise-dialog').querySelector('.close-dialog').click();
  input('workout-search', 'Romanian Deadlift'); check($('workout-rows').textContent.includes('Push Pull Legs'), 'Workout search includes exercise names');
  input('workout-search', 'not a real workout'); check($('workout-rows').textContent.includes('No workouts match') && $('titan-export').disabled, 'Empty workout search shows a useful state and disables export');
  input('workout-search', ''); $('workout-rows').querySelector('.view-session').click();
  check($('workout-dialog').matches(':modal') && $('workout-detail').textContent.includes('19 completed sets'), 'Workout detail shows saved totals and logged sets');
  check($('workout-detail').textContent.includes('No logged sets. Planned exercise retained'), 'Unlogged planned exercises are preserved in workout details');
  check($('workout-detail').textContent.includes('BC8DB6A4-3FF5-4520-9A24-792A5FEC59F1'), 'Workout details retain source identity');
  $('workout-dialog').querySelector('.close-dialog').click();
  check($('record-row-count').textContent.includes('of 1257'), 'Personal record history retains all saved achievement entries');
  choose('record-type', 'heaviestWeight'); check($('record-rows').textContent.includes('Heaviest weight'), 'Record types filter without recomputing achievements');
  input('record-search', 'no record'); check($('record-rows').textContent.includes('No record entries') && $('record-export').disabled, 'Record search has a safe empty state');
  input('record-search', ''); choose('record-type', '');
  check($('body-cards').textContent.includes('106.68') && $('body-cards').textContent.includes('unit unspecified'), 'Body measurements retain values without invented units');
  input('template-search', 'Core Workout');
  check($('template-grid').querySelectorAll('button').length === 1, 'Saved templates are searchable');
  $('template-grid').querySelector('button').click();
  check($('template-dialog').matches(':modal') && $('template-detail').textContent.includes('target sets'), 'Template detail exposes the saved exercise targets');
  $('template-dialog').querySelector('.close-dialog').click(); input('template-search', '');
  const archived = backup.routines.find(r => r.isArchived); choose('template-routine', archived.id);
  check($('template-grid').querySelectorAll('button').length === 3, 'Archived routine templates remain available'); choose('template-routine', '');
  document.querySelector('.page-footer .titan-source-open').click();
  check($('titan-source-dialog').matches(':modal') && $('titan-source-details').textContent.includes('totalVolumeKg'), 'Source dialog explains imported totals and methodology');
  $('titan-source-dialog').querySelector('.close-dialog').click();
  let blob, filename;
  const oldURL = URL.createObjectURL, oldClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = value => { blob = value; return oldURL(value); };
  HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  try { $('titan-export').click(); } finally { URL.createObjectURL = oldURL; HTMLAnchorElement.prototype.click = oldClick; }
  const csv = await blob.text();
  check(filename === 'titanlog-workouts-2026-11-02.csv' && csv.split('\r\n').length === 148 && csv.includes('"Recorded volume (kg·reps)"'), 'Workout CSV includes the full filtered selection and original volume units');
  check(document.querySelector('meta[name="robots"]').content === 'noindex, nofollow', 'Noindex is retained');
  check(document.documentElement.scrollWidth === document.documentElement.clientWidth, 'Training dashboard has no horizontal page overflow');
  const bench = backup.exercises.find(e => e.name === 'Barbell Bench Press'); choose('exercise-select', bench.id);
  window.scrollTo(0, 0);
  return { passed: checks.length, checks };
}
