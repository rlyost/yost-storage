(function () {
  'use strict';
  const data = window.TITANLOG_DATA, backup = data.backup, model = window.TitanLogModel;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const human = value => String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, text => text.toUpperCase());
  const fmt = (value, digits = 1) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
  const compact = value => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  const date = key => new Date(key.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const stamp = timestamp => new Date(timestamp).toLocaleString('en-US', { timeZone: model.ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const shortDate = key => new Date(key + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const exerciseMap = new Map(backup.exercises.map(exercise => [exercise.id.toUpperCase(), exercise]));
  const workoutMap = new Map(backup.workouts.map(workout => [workout.id, workout]));
  const routineMap = new Map(backup.routines.map(routine => [routine.id, routine]));
  const recordTypes = { heaviestWeight: 'Heaviest weight', estimated1RM: 'Estimated 1RM (saved)', maxVolumeSet: 'Highest set volume', maxReps: 'Most reps', longestDuration: 'Longest duration', longestDistance: 'Longest distance', fastestPace: 'Fastest pace (raw value)' };
  const state = { period: 'all', status: 'completed', unit: backup.preferences.weightUnitRaw === 'kg' ? 'kg' : 'lb', exercise: null, metric: 'load', workoutPage: 0, recordPage: 0, templatePage: 0 };
  const PAGE = 12;
  const nameOf = entry => exerciseMap.get(entry.exerciseId.toUpperCase())?.name || 'Unknown exercise';
  let selectionKey = '', selectedCache = [];
  function selectedWorkouts() {
    const key = state.period + ':' + state.status;
    if (key !== selectionKey) { selectionKey = key; selectedCache = model.selectWorkouts(backup, state.period, state.status); }
    return selectedCache;
  }
  const weight = value => model.weight(value, state.unit);
  const weightText = value => fmt(weight(value)) + ' ' + state.unit;
  const distanceUnit = backup.preferences.distanceUnitRaw === 'mi' ? 'mi' : 'km';
  const distanceValue = meters => meters / (distanceUnit === 'mi' ? 1609.344 : 1000);
  const distanceText = meters => fmt(distanceValue(meters), 2) + ' ' + distanceUnit;
  function duration(seconds) {
    if (seconds < 60) return fmt(seconds, 0) + ' sec';
    const minutes = Math.round(seconds / 60);
    return minutes < 60 ? minutes + ' min' : Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm';
  }
  function statusBadge(status) { return '<span class="status ' + (status === 'completed' ? 'in' : status === 'abandoned' ? 'abandoned' : '') + '">' + esc(human(status)) + '</span>'; }
  function summary() {
    const workouts = selectedWorkouts(), totals = model.summary(workouts), dates = model.range(backup, state.period);
    $('training-session-count').textContent = fmt(totals.sessions, 0);
    $('training-session-note').textContent = state.status === 'all' ? 'Completed + abandoned sessions' : human(state.status) + ' sessions in selection';
    $('training-volume').innerHTML = esc(compact(weight(totals.volumeKg))) + '<small>' + state.unit + '·reps</small>';
    $('training-volume-note').textContent = 'Imported recorded totals · ' + fmt(weight(totals.volumeKg), 0) + ' ' + state.unit + '·reps';
    $('training-set-count').textContent = fmt(totals.sets, 0);
    $('training-median').textContent = totals.medianSeconds === null ? '—' : duration(totals.medianSeconds);
    $('training-timer-note').textContent = totals.longTimers ? totals.longTimers + ' recorded timers exceed 6 hours' : 'Median of saved session durations';
    $('training-range-label').textContent = (dates.start ? date(dates.start) : 'All history') + ' – ' + date(dates.end) + ' · Pacific time';
    $('training-backup-counts').textContent = backup.workouts.length + ' sessions in backup · ' + backup.workouts.filter(w => w.statusRaw === 'completed').length + ' completed · ' + backup.workouts.filter(w => w.statusRaw === 'abandoned').length + ' abandoned';
  }
  function bindTooltip(container, points, pointLabel) {
    const tooltip = container.querySelector('.data-tooltip');
    container.querySelectorAll('[data-point]').forEach(element => {
      function show() {
        const index = Number(element.dataset.point);
        tooltip.innerHTML = pointLabel(points[index]); tooltip.hidden = false;
        const box = element.getBoundingClientRect(), parent = container.getBoundingClientRect();
        tooltip.style.left = Math.max(0, Math.min(parent.width - tooltip.offsetWidth, box.x - parent.x - tooltip.offsetWidth / 2)) + 'px';
        tooltip.style.top = Math.max(0, box.y - parent.y - tooltip.offsetHeight - 8) + 'px';
      }
      element.addEventListener('mouseenter', show); element.addEventListener('focus', show);
      element.addEventListener('mouseleave', () => { tooltip.hidden = true; }); element.addEventListener('blur', () => { tooltip.hidden = true; });
      element.addEventListener('keydown', event => { if (event.key === 'Escape') tooltip.hidden = true; });
    });
  }
  function plot(container, points, options) {
    if (!points.length) { container.innerHTML = '<div class="training-empty">' + esc(options.empty || 'No sessions in this selection.') + '</div>'; return; }
    const W = Math.max(300, container.clientWidth), H = container.clientHeight, L = 49, R = 15, T = 17, B = 32;
    const maxValue = Math.max(...points.map(point => point.value));
    const maxY = options.unit === 'sessions' ? Math.max(1, Math.ceil(maxValue)) : Math.max(1, maxValue * 1.15);
    const times = points.map(point => Date.parse(point.startedAt || point.date + 'T12:00:00Z'));
    const first = times[0], last = times.at(-1);
    const barWidth = Math.max(2, (W - L - R) / points.length * .68);
    const x = index => options.bars ? L + (index + .5) * (W - L - R) / points.length : first === last ? (W + L - R) / 2 : L + (times[index] - first) / (last - first) * (W - L - R);
    const y = value => H - B - value / maxY * (H - B - T);
    let grid = '';
    const ticks = options.unit === 'sessions' && maxY < 4 ? maxY : 4;
    for (let i = 0; i <= ticks; i++) {
      const value = maxY * i / ticks, yy = y(value);
      grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--chart-grid)"/><text x="' + (L - 8) + '" y="' + (yy + 3) + '" text-anchor="end">' + esc(maxY > 9999 ? compact(value) : fmt(value, maxY < 5 ? 1 : 0)) + '</text>';
    }
    const positions = [];
    [...points.keys()].reverse().forEach(index => {
      if (index !== 0 && index !== points.length - 1 && index % Math.max(1, Math.ceil(points.length / 5))) return;
      const xx = x(index);
      if (positions.every(position => Math.abs(position - xx) > 66)) {
        positions.push(xx);
        grid += '<text x="' + xx + '" y="' + (H - 8) + '" text-anchor="middle">' + shortDate(points[index].date) + '</text>';
      }
    });
    let marks;
    if (options.bars) marks = points.map((point, index) => '<rect class="data-point" data-point="' + index + '" x="' + (x(index) - barWidth / 2) + '" y="' + (point.value ? y(point.value) : H - B - 1) + '" width="' + barWidth + '" height="' + Math.max(1, H - B - y(point.value)) + '" rx="2" fill="' + (point.value ? 'var(--plot)' : 'var(--soft)') + '" tabindex="0" role="img" aria-label="' + esc(options.label(point)) + '"/>').join('');
    else {
      const path = points.map((point, index) => (index ? 'L' : 'M') + x(index) + ',' + y(point.value)).join(' ');
      marks = '<path d="' + path + '" stroke="var(--plot)" stroke-width="2" fill="none"/>' + points.map((point, index) => '<circle class="data-point" data-point="' + index + '" cx="' + x(index) + '" cy="' + y(point.value) + '" r="3.7" fill="var(--plot)" stroke="var(--surface)" stroke-width="1.3" tabindex="0" role="img" aria-label="' + esc(options.label(point)) + '"/>').join('');
    }
    container.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc(options.title) + '"><title>' + esc(options.title) + '</title><desc>Focus a data point for its date and value.</desc>' + grid + marks + '</svg><div class="data-tooltip" role="tooltip" hidden></div>';
    bindTooltip(container, points, point => '<strong>' + esc(options.label(point)) + '</strong>' + (point.name ? '<br>' + esc(point.name) : ''));
  }
  function renderRhythm() {
    const volume = $('rhythm-metric').value === 'volume';
    const points = model.weekly(selectedWorkouts(), model.range(backup, state.period)).map(week => ({ ...week, value: volume ? weight(week.volumeKg) : week.sessions }));
    plot($('rhythm-chart'), points, { bars: true, unit: volume ? state.unit + '·reps' : 'sessions', title: 'Weekly ' + (volume ? 'recorded volume' : 'sessions'), label: point => 'Week of ' + date(point.date) + ': ' + (volume ? fmt(point.value, 0) + ' ' + state.unit + '·reps' : point.value + ' sessions') });
    $('rhythm-chart-note').textContent = (volume ? 'Saved workout volume · ' + state.unit + '·reps' : human(state.status === 'all' ? 'All' : state.status) + ' sessions') + ' · edge weeks may be partial';
    const muscles = model.muscleSets(selectedWorkouts(), exerciseMap), max = muscles[0]?.[1] || 1;
    $('muscle-bars').innerHTML = muscles.length ? muscles.slice(0, 7).map(([muscle, count]) => '<div class="muscle-row"><span>' + esc(human(muscle)) + '</span><div class="muscle-bar"><span style="width:' + count / max * 100 + '%"></span></div><strong>' + count + '</strong></div>').join('') : '<p class="detail-note">No completed sets in this selection.</p>';
  }
  function exercisePoints() { return model.exerciseHistory(selectedWorkouts(), state.exercise, state.metric); }
  function metricUnit() { return state.metric === 'load' ? state.unit : state.metric === 'time' ? 'sec' : state.metric === 'distance' ? distanceUnit : 'reps'; }
  function metricValue(value) { return state.metric === 'load' ? weight(value) : state.metric === 'distance' ? distanceValue(value) : value; }
  function renderExercise() {
    const points = exercisePoints(), exercise = exerciseMap.get(state.exercise.toUpperCase());
    const latest = points.at(-1), best = points.length ? Math.max(...points.map(point => point.value)) : null;
    const show = value => value === null || value === undefined ? '—' : fmt(metricValue(value), state.metric === 'distance' ? 2 : 1) + ' ' + metricUnit();
    const stats = [['Latest in selection', show(latest?.value)], ['Highest in selection', show(best)], ['Sessions with a value', points.length], ['Completed sets in those sessions', points.reduce((n, point) => n + point.sets, 0)]];
    $('exercise-stats').innerHTML = stats.map(([label, value]) => '<div><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>').join('');
    plot($('exercise-chart'), points.map(point => ({ ...point, value: metricValue(point.value) })), { unit: metricUnit(), title: (exercise?.name || 'Exercise') + ' · ' + $('exercise-metric').selectedOptions[0].textContent, empty: state.metric === 'load' ? 'No positive logged loads for this exercise in the selection. Try total reps, time, or a different period.' : 'No completed sets for this exercise in the selection.', label: point => date(point.date) + ': ' + fmt(point.value, state.metric === 'distance' ? 2 : 1) + ' ' + metricUnit() });
    $('exercise-chart-note').textContent = state.metric === 'load' ? 'Highest positive set weight per session, as stored. No extra doubling or bodyweight estimate is applied.' : state.metric === 'reps' ? 'Sum of completed-set reps per session, including warmups.' : state.metric === 'time' ? 'Longest completed set duration per session, from durationSeconds.' : 'Sum of completed-set distances per session, converted from meters.';
    $('exercise-history-open').disabled = !points.length;
  }
  function pageRows(items, page) { return items.slice(page * PAGE, (page + 1) * PAGE); }
  function pageControls(prefix, items, page) {
    const pages = Math.max(1, Math.ceil(items.length / PAGE));
    $(prefix + '-prev').disabled = page === 0; $(prefix + '-next').disabled = page >= pages - 1;
    $(prefix + '-page').textContent = (page + 1) + ' / ' + pages;
    $(prefix + '-row-count').textContent = items.length ? 'Showing ' + (page * PAGE + 1) + '–' + Math.min((page + 1) * PAGE, items.length) + ' of ' + items.length : 'Showing 0 results';
  }
  function filteredWorkouts() {
    const query = $('workout-search').value.trim().toLowerCase();
    return selectedWorkouts().filter(workout => (workout.name + ' ' + workout.exercises.map(nameOf).join(' ')).toLowerCase().includes(query));
  }
  function renderWorkouts() {
    const workouts = filteredWorkouts();
    state.workoutPage = Math.min(state.workoutPage, Math.max(0, Math.ceil(workouts.length / PAGE) - 1));
    $('workout-description').textContent = 'Selected period and status · recorded totals · click a session to see its sets';
    $('workout-rows').innerHTML = workouts.length ? pageRows(workouts, state.workoutPage).map(workout => '<tr><td><button class="workout-title" type="button" data-workout="' + esc(workout.id) + '">' + esc(workout.name) + '</button><span class="small-muted">' + esc(stamp(workout.startedAt)) + '</span></td><td>' + statusBadge(workout.statusRaw) + '</td><td>' + duration(workout.totalDurationSeconds) + (workout.totalDurationSeconds > 21600 ? '<span class="long-timer">Long timer in source</span>' : '') + '</td><td>' + model.completedSets(workout).length + '</td><td>' + esc(weightText(workout.totalVolumeKg)) + '·reps</td><td><button class="view-session" type="button" data-workout="' + esc(workout.id) + '" aria-label="View ' + esc(workout.name) + '">View ↗</button></td></tr>').join('') : '<tr><td colspan="6" class="empty-cell">No workouts match this selection. Try all history, another status, or a different search.</td></tr>';
    pageControls('workout', workouts, state.workoutPage); bindWorkoutLinks($('workout-rows'));
    $('titan-export').disabled = !workouts.length;
  }
  function filteredRecords() {
    const query = $('record-search').value.trim().toLowerCase(), type = $('record-type').value;
    return model.records(backup, state.period, state.status).filter(record => (!type || record.recordTypeRaw === type) && record.exerciseName.toLowerCase().includes(query));
  }
  function recordValue(record) {
    if (['heaviestWeight', 'estimated1RM'].includes(record.recordTypeRaw)) return weightText(record.value);
    if (record.recordTypeRaw === 'maxVolumeSet') return weightText(record.value) + '·reps';
    if (record.recordTypeRaw === 'maxReps') return fmt(record.value, 0) + ' reps';
    if (record.recordTypeRaw === 'longestDuration') return fmt(record.value) + ' sec';
    if (record.recordTypeRaw === 'longestDistance') return distanceText(record.value);
    return fmt(record.value, 4) + ' (raw)';
  }
  function renderRecords() {
    const records = filteredRecords();
    state.recordPage = Math.min(state.recordPage, Math.max(0, Math.ceil(records.length / PAGE) - 1));
    $('record-description').textContent = 'Saved achievement entries, not distinct current records · selected period and session status';
    $('record-rows').innerHTML = records.length ? pageRows(records, state.recordPage).map(record => '<tr><td>' + esc(record.exerciseName) + '<span class="small-muted">' + esc(stamp(record.achievedAt)) + '</span></td><td>' + esc(recordTypes[record.recordTypeRaw] || human(record.recordTypeRaw)) + '</td><td>' + esc(recordValue(record)) + '</td><td>' + (record.repsAtValue ?? '—') + '</td><td><button class="view-session" type="button" data-workout="' + esc(record.workoutId) + '">View session ↗</button></td></tr>').join('') : '<tr><td colspan="5" class="empty-cell">No record entries match this selection.</td></tr>';
    pageControls('record', records, state.recordPage); bindWorkoutLinks($('record-rows'));
    $('record-export').disabled = !records.length;
  }
  function renderBody() {
    const cards = [];
    if (Number.isFinite(backup.preferences.bodyWeightKg)) cards.push(['Body weight', fmt(weight(backup.preferences.bodyWeightKg)), state.unit, backup.preferences.bodyWeightUpdatedAt ? stamp(backup.preferences.bodyWeightUpdatedAt) : 'Date not supplied', 'Saved preference value']);
    const measurements = new Map();
    backup.bodyMeasurements.forEach(item => { if (!measurements.has(item.kindRaw) || measurements.get(item.kindRaw).recordedAt < item.recordedAt) measurements.set(item.kindRaw, item); });
    measurements.forEach(item => cards.push([human(item.kindRaw), fmt(item.value, 2), '', stamp(item.recordedAt), 'As exported · unit unspecified']));
    $('body-cards').innerHTML = cards.map(([name, value, unit, recorded, note]) => '<article class="body-card"><h3>' + esc(name) + '</h3><strong>' + esc(value) + '<small>' + esc(unit) + '</small></strong><p>' + esc(recorded) + '<br>' + esc(note) + '</p></article>').join('') || '<p class="detail-note">No body data supplied.</p>';
  }
  function filteredTemplates() {
    const query = $('template-search').value.trim().toLowerCase(), routine = $('template-routine').value;
    return backup.templates.filter(template => (template.name + ' ' + template.exercises.map(nameOf).join(' ')).toLowerCase().includes(query) && (!routine || (routine === 'unassigned' ? !template.routineId : template.routineId === routine))).slice().sort((a, b) => (a.orderIndex - b.orderIndex) || a.name.localeCompare(b.name));
  }
  function renderTemplates() {
    const templates = filteredTemplates();
    state.templatePage = Math.min(state.templatePage, Math.max(0, Math.ceil(templates.length / PAGE) - 1));
    $('template-description').textContent = backup.templates.length + ' templates · ' + backup.routines.length + ' routines (' + backup.routines.filter(routine => routine.isArchived).length + ' archived) · independent of the period filter';
    $('template-grid').innerHTML = templates.length ? pageRows(templates, state.templatePage).map(template => '<button class="template-card" type="button" data-template="' + esc(template.id) + '"><strong>' + esc(template.name) + '</strong><span>' + template.exercises.length + ' exercises · ' + esc(routineMap.get(template.routineId)?.name || 'Unassigned routine') + '</span>' + (template.isArchived ? '<small>Archived template</small>' : '') + '</button>').join('') : '<p class="detail-note">No templates match this selection.</p>';
    $('template-grid').querySelectorAll('button').forEach(button => button.addEventListener('click', () => openTemplate(button.dataset.template)));
    pageControls('template', templates, state.templatePage);
  }
  function bindWorkoutLinks(container) { container.querySelectorAll('[data-workout]').forEach(button => button.addEventListener('click', () => openWorkout(button.dataset.workout))); }
  function openWorkout(id) {
    const workout = workoutMap.get(id); if (!workout) return;
    $('workout-detail-title').textContent = workout.name;
    $('workout-detail').innerHTML = '<div class="dialog-summary"><span>' + esc(stamp(workout.startedAt)) + ' · Pacific time</span>' + statusBadge(workout.statusRaw) + '<span>' + duration(workout.totalDurationSeconds) + ' recorded</span><span>' + weightText(workout.totalVolumeKg) + '·reps</span><span>' + model.completedSets(workout).length + ' completed sets</span></div>' + (workout.totalDurationSeconds > 21600 ? '<p class="detail-note">The source records a timer longer than six hours. It is shown without correction.</p>' : '') + workout.exercises.slice().sort((a, b) => a.orderIndex - b.orderIndex).map(entry => {
      const exercise = exerciseMap.get(entry.exerciseId.toUpperCase());
      return '<section class="dialog-exercise"><h3>' + esc(nameOf(entry)) + '</h3><p>' + esc(human(exercise?.primaryMuscleRaw)) + ' · ' + esc(human(exercise?.equipmentRaw)) + (entry.targetSetsSnapshot ? ' · Planned ' + entry.targetSetsSnapshot + ' sets of ' + esc(entry.targetRepsSnapshot || 'unspecified reps') : '') + '</p>' + (entry.sets.length ? '<div class="table-scroll"><table><thead><tr><th>Set</th><th>Type / status</th><th>Logged load</th><th>Reps</th><th>Time</th><th>Distance</th></tr></thead><tbody>' + entry.sets.slice().sort((a, b) => a.orderIndex - b.orderIndex).map((set, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(human(set.setTypeRaw)) + ' · ' + (set.isCompleted ? 'done' : 'not completed') + '</td><td>' + weightText(set.weightKg) + '</td><td>' + set.reps + '</td><td>' + set.durationSeconds + ' sec</td><td>' + distanceText(set.distanceMeters) + '</td></tr>').join('') + '</tbody></table></div>' : '<p>No logged sets. Planned exercise retained from the backup.</p>') + '</section>';
    }).join('') + '<p class="detail-note">Source workout ID: ' + esc(workout.id) + '<br>Volume is the saved workout total. Set loads are shown as stored; no additional bodyweight or paired-dumbbell calculation is applied here.</p>';
    $('workout-dialog').showModal();
  }
  function openExerciseHistory() {
    $('exercise-detail-title').textContent = exerciseMap.get(state.exercise.toUpperCase())?.name || 'Exercise';
    $('exercise-detail-rows').innerHTML = exercisePoints().slice().reverse().map(point => '<tr><td>' + date(point.date) + '</td><td><button class="view-session" type="button" data-workout="' + esc(point.workoutId) + '">' + esc(point.name) + '</button></td><td>' + fmt(metricValue(point.value), 2) + ' ' + metricUnit() + '</td><td>' + point.sets + '</td></tr>').join('');
    bindWorkoutLinks($('exercise-detail-rows')); $('exercise-dialog').showModal();
  }
  function openTemplate(id) {
    const template = backup.templates.find(item => item.id === id); if (!template) return;
    const routine = routineMap.get(template.routineId);
    $('template-detail-title').textContent = template.name;
    $('template-detail').innerHTML = '<p class="detail-note">' + esc(routine ? routine.name + (routine.isArchived ? ' · archived routine' : '') : 'Unassigned routine') + (template.isArchived ? ' · Archived template' : '') + '</p>' + (routine?.routineDescription ? '<p class="detail-note">' + esc(routine.routineDescription) + '</p>' : '') + '<ol class="template-exercise-list">' + template.exercises.slice().sort((a, b) => a.orderIndex - b.orderIndex).map(entry => '<li>' + esc(nameOf(entry)) + '<span>' + (entry.targetSets ?? 'Unspecified') + ' target sets · ' + esc(entry.targetReps || 'Reps not specified') + '</span></li>').join('') + '</ol><p class="detail-note">Source template ID: ' + esc(template.id) + '</p>';
    $('template-dialog').showModal();
  }
  function download(rows, filename) {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + model.csv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('toast').textContent = (rows.length - 1) + ' rows exported'; $('toast').hidden = false;
    setTimeout(() => { $('toast').hidden = true; }, 4000);
  }
  function exportWorkouts() {
    const workouts = filteredWorkouts(); if (!workouts.length) return;
    download([['Workout ID', 'Workout name', 'Started at (UTC)', 'Pacific date', 'Status', 'Recorded duration (seconds)', 'Completed sets', 'Recorded volume (kg·reps)', 'Recorded volume (' + state.unit + '·reps)'], ...workouts.map(workout => [workout.id, workout.name, workout.startedAt, model.dayKey(workout.startedAt), workout.statusRaw, workout.totalDurationSeconds, model.completedSets(workout).length, workout.totalVolumeKg, weight(workout.totalVolumeKg)])], 'titanlog-workouts-' + model.dayKey(backup.exportedAt) + '.csv');
  }
  function exportRecords() {
    const records = filteredRecords(); if (!records.length) return;
    download([['Record ID', 'Exercise', 'Record type', 'Achieved at (UTC)', 'Source value', 'Displayed value', 'Reps at value', 'Workout ID', 'Set ID'], ...records.map(record => [record.id, record.exerciseName, record.recordTypeRaw, record.achievedAt, record.value, recordValue(record), record.repsAtValue ?? '', record.workoutId, record.setId])], 'titanlog-records-' + model.dayKey(backup.exportedAt) + '.csv');
  }
  function render() { summary(); renderRhythm(); renderExercise(); renderWorkouts(); renderRecords(); renderBody(); }
  $('training-unit').value = state.unit;
  ['period', 'status', 'unit'].forEach(key => $('training-' + key).addEventListener('change', () => { state[key] = $('training-' + key).value; state.workoutPage = state.recordPage = 0; render(); }));
  const performed = new Set(backup.workouts.flatMap(workout => workout.exercises.filter(entry => entry.sets.some(set => set.isCompleted)).map(entry => entry.exerciseId.toUpperCase())));
  const exercises = backup.exercises.filter(exercise => performed.has(exercise.id.toUpperCase())).slice().sort((a, b) => a.name.localeCompare(b.name));
  state.exercise = (exercises.find(exercise => exercise.name === 'Barbell Bench Press') || exercises[0] || backup.exercises[0]).id;
  $('exercise-select').innerHTML = exercises.map(exercise => '<option value="' + esc(exercise.id) + '">' + esc(exercise.name) + '</option>').join('');
  $('exercise-select').value = state.exercise;
  $('exercise-select').addEventListener('change', () => {
    state.exercise = $('exercise-select').value;
    const tracking = exerciseMap.get(state.exercise.toUpperCase())?.trackingTypeRaw;
    state.metric = tracking === 'reps' ? 'reps' : tracking === 'time' || tracking === 'timeDistance' ? 'time' : 'load';
    $('exercise-metric').value = state.metric; renderExercise();
  });
  $('exercise-metric').addEventListener('change', () => { state.metric = $('exercise-metric').value; renderExercise(); });
  $('rhythm-metric').addEventListener('change', renderRhythm);
  $('exercise-history-open').addEventListener('click', openExerciseHistory);
  $('workout-search').addEventListener('input', () => { state.workoutPage = 0; renderWorkouts(); });
  $('record-search').addEventListener('input', () => { state.recordPage = 0; renderRecords(); });
  $('record-type').innerHTML = '<option value="">All record types</option>' + Object.entries(recordTypes).map(([type, label]) => '<option value="' + type + '">' + label + '</option>').join('');
  $('record-type').addEventListener('change', () => { state.recordPage = 0; renderRecords(); });
  [['workout', 'workoutPage', renderWorkouts], ['record', 'recordPage', renderRecords], ['template', 'templatePage', renderTemplates]].forEach(([prefix, key, renderer]) => {
    $(prefix + '-prev').addEventListener('click', () => { state[key] = Math.max(0, state[key] - 1); renderer(); });
    $(prefix + '-next').addEventListener('click', () => { state[key]++; renderer(); });
  });
  $('template-search').addEventListener('input', () => { state.templatePage = 0; renderTemplates(); });
  $('template-routine').innerHTML = '<option value="">All routines</option><option value="unassigned">Unassigned routine</option>' + backup.routines.slice().sort((a, b) => a.orderIndex - b.orderIndex).map(routine => '<option value="' + esc(routine.id) + '">' + esc(routine.name) + (routine.isArchived ? ' (archived)' : '') + '</option>').join('');
  $('template-routine').addEventListener('change', () => { state.templatePage = 0; renderTemplates(); });
  $('titan-export').addEventListener('click', exportWorkouts); $('record-export').addEventListener('click', exportRecords);
  $('titan-print').addEventListener('click', () => window.print());
  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('.titan-source-open').forEach(button => button.addEventListener('click', () => $('titan-source-dialog').showModal()));
  $('titan-sidebar-source').textContent = backup.workouts.length + ' sessions · ' + backup.exercises.length.toLocaleString() + ' catalog exercises\nExported ' + stamp(backup.exportedAt);
  $('titan-source-footer').textContent = 'Source: ' + data.sourceFile + '\nExported ' + stamp(backup.exportedAt) + ' Pacific time';
  const details = [
    ['Backup', data.sourceFile], ['Version', 'Backup format ' + backup.formatVersion + ' · app ' + backup.appVersion], ['Exported', stamp(backup.exportedAt) + ' Pacific time (' + backup.exportedAt + ')'],
    ['Coverage', backup.workouts.length + ' workouts, ' + backup.exercises.length + ' catalog exercises, ' + backup.personalRecords.length + ' saved record entries, ' + backup.templates.length + ' templates, ' + backup.routines.length + ' routines, ' + backup.bodyMeasurements.length + ' body measurements. All original backup fields are preserved.'],
    ['Session status', 'The initial view includes completed sessions only. Abandoned sessions remain available through the status filter. Sets marked completed in an abandoned session count only when that status is selected.'],
    ['Date windows', 'Pacific calendar dates, anchored to the backup’s export date. Last 30 or 90 days includes the export day. Session charts use startedAt; record history uses achievedAt.'],
    ['Volume', 'Imported from each session’s totalVolumeKg and converted for display. These saved totals are not recalculated from set weights and reps, so they can differ from a simple load × reps calculation.'],
    ['Time', 'Recorded durations are not corrected. Six completed-session timers in the full backup exceed six hours. The summary shows the median, and long timers are labeled in session history.'],
    ['Exercise progress', 'Uses completed sets within the selected sessions. Load is the highest positive logged weight per session; no extra doubling, bodyweight substitution, or assisted-load adjustment is made. Zero-weight entries remain visible in session details and reps/time views.'],
    ['Muscles', 'Each completed set is attributed once to the catalog’s primary muscle. Warmups are included; secondary muscle groups are not duplicated. The chart shows the seven largest groups in the selection.'],
    ['Personal records', 'A history of saved achievement entries, not a count of distinct current records. Saved estimates are not recomputed. Fastest-pace values are shown raw because the record does not declare their unit.'],
    ['Body data', 'Current body weight comes from preferences and has its own update date. Other measurements are shown as exported because their units are not explicitly declared. These snapshots and saved templates are independent of the workout date filter.'],
    ['Snapshot', 'This page reads the supplied backup only. It does not sync with the TitanLog app.'], ['Fingerprint', data.sha256]
  ];
  $('titan-source-details').innerHTML = details.map(([name, value]) => '<dt>' + esc(name) + '</dt><dd>' + esc(value) + '</dd>').join('');
  render(); renderTemplates();
  if (window.ResizeObserver) {
    const widths = new Map();
    const observer = new ResizeObserver(entries => {
      let rhythm = false, exercise = false;
      entries.forEach(entry => { const previous = widths.get(entry.target.id); widths.set(entry.target.id, entry.contentRect.width); if (previous !== undefined && Math.abs(previous - entry.contentRect.width) > 1) { if (entry.target.id === 'rhythm-chart') rhythm = true; else exercise = true; } });
      if (rhythm) renderRhythm(); if (exercise) renderExercise();
    });
    observer.observe($('rhythm-chart')); observer.observe($('exercise-chart'));
  }
})();
