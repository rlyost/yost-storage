/* Pure calculations over the backup. Imported records are never modified. */
(function (root) {
  'use strict';
  const ZONE = 'America/Los_Angeles', DAY = 86400000, LB_PER_KG = 2.2046226218487757;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  function dayKey(timestamp) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
    return parts.year + '-' + parts.month + '-' + parts.day;
  }
  function addDays(day, offset) { return new Date(Date.parse(day + 'T12:00:00Z') + offset * DAY).toISOString().slice(0, 10); }
  function range(backup, period) {
    const end = dayKey(backup.exportedAt);
    return { start: period === 'all' ? '' : addDays(end, 1 - Number(period)), end };
  }
  function selectWorkouts(backup, period = 'all', status = 'completed') {
    const dates = range(backup, period);
    return backup.workouts.filter(workout => {
      const key = dayKey(workout.startedAt);
      return key >= dates.start && key <= dates.end && (status === 'all' || workout.statusRaw === status);
    }).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  function completedSets(workout) { return workout.exercises.flatMap(entry => entry.sets.filter(set => set.isCompleted)); }
  function summary(workouts) {
    const durations = workouts.map(workout => workout.totalDurationSeconds).sort((a, b) => a - b);
    const middle = Math.floor(durations.length / 2);
    const median = !durations.length ? null : durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
    return { sessions: workouts.length, sets: workouts.reduce((n, w) => n + completedSets(w).length, 0),
      volumeKg: workouts.reduce((n, w) => n + w.totalVolumeKg, 0), medianSeconds: median,
      longTimers: workouts.filter(w => w.totalDurationSeconds > 21600).length };
  }
  function weight(kg, unit) { return unit === 'lb' ? kg * LB_PER_KG : kg; }
  function weekly(workouts, dates) {
    if (!workouts.length) return [];
    function monday(key) {
      const weekday = new Date(key + 'T12:00:00Z').getUTCDay();
      return addDays(key, -((weekday + 6) % 7));
    }
    const start = monday(dates.start || dayKey(workouts.at(-1).startedAt)), end = monday(dates.end);
    const buckets = new Map();
    for (let key = start; key <= end; key = addDays(key, 7)) buckets.set(key, { date: key, sessions: 0, volumeKg: 0 });
    workouts.forEach(workout => { const bucket = buckets.get(monday(dayKey(workout.startedAt))); if (bucket) { bucket.sessions++; bucket.volumeKg += workout.totalVolumeKg; } });
    return [...buckets.values()];
  }
  function muscleSets(workouts, exerciseMap) {
    const counts = new Map();
    workouts.forEach(workout => workout.exercises.forEach(entry => {
      const muscle = exerciseMap.get(entry.exerciseId.toUpperCase())?.primaryMuscleRaw || 'unknown';
      counts.set(muscle, (counts.get(muscle) || 0) + entry.sets.filter(set => set.isCompleted).length);
    }));
    return [...counts].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  }
  function exerciseHistory(workouts, id, metric) {
    return workouts.slice().reverse().flatMap(workout => {
      const sets = workout.exercises.filter(entry => entry.exerciseId.toUpperCase() === id.toUpperCase()).flatMap(entry => entry.sets.filter(set => set.isCompleted));
      if (!sets.length) return [];
      let value;
      if (metric === 'load') {
        const weighted = sets.filter(set => set.weightKg > 0);
        if (!weighted.length) return [];
        value = Math.max(...weighted.map(set => set.weightKg));
      } else if (metric === 'reps') value = sets.reduce((sum, set) => sum + set.reps, 0);
      else if (metric === 'time') value = Math.max(...sets.map(set => set.durationSeconds));
      else value = sets.reduce((sum, set) => sum + set.distanceMeters, 0);
      return [{ workoutId: workout.id, date: dayKey(workout.startedAt), startedAt: workout.startedAt, name: workout.name, value, sets: sets.length }];
    });
  }
  function records(backup, period, status) {
    const dates = range(backup, period), workoutMap = new Map(backup.workouts.map(workout => [workout.id, workout]));
    return backup.personalRecords.filter(record => {
      const date = dayKey(record.achievedAt), workout = workoutMap.get(record.workoutId);
      return date >= dates.start && date <= dates.end && (status === 'all' || workout?.statusRaw === status);
    }).slice().sort((a, b) => b.achievedAt.localeCompare(a.achievedAt));
  }
  function csv(rows) {
    return rows.map(row => row.map(value => {
      const text = String(value ?? '');
      const safe = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
      return '"' + safe.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }
  root.TitanLogModel = Object.freeze({ ZONE, dayKey, addDays, range, selectWorkouts, completedSets, summary, weight, weekly, muscleSets, exerciseHistory, records, csv });
})(typeof window === 'undefined' ? globalThis : window);
