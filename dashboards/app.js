(function () {
  'use strict';
  const data = window.LAB_DATA, model = window.LabModel;
  const $ = id => document.getElementById(id);
  const labels = { 'LIPID PANEL': 'Lipids', 'METABOLIC PANEL': 'Metabolic panel', 'A1C': 'Hemoglobin A1c', 'THYROID': 'Thyroid', 'HORMONES': 'Hormones', 'CBC': 'Blood count', 'OTHER': 'Other markers' };
  const icons = { all: '◫', 'LIPID PANEL': '◉', 'METABOLIC PANEL': '⌁', A1C: '◌', THYROID: '♧', HORMONES: '⌘', CBC: '♡', OTHER: '⊞' };
  const statusText = { in: 'In range', high: 'High', low: 'Low', unknown: 'Not classified', missing: 'Not measured' };
  const state = { sample: data.samples.at(-1), panel: 'all', metric: data.tests.find(t => t.name === 'LDL Cholesterol').id, period: 'all', search: '', status: 'all' };
  const panels = [...new Set(data.tests.map(test => test.panel))];
  const fmt = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
  const date = (iso, short = false) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', short ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' });
  const sampleLabel = sample => date(sample.date) + (sample.lab === 'Not specified' ? '' : ' · ' + sample.lab);
  const sampleTitle = sample => date(sample.date) + ' · ' + (sample.lab === 'Not specified' ? 'Lab not specified' : sample.lab);
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const result = test => test.results[state.sample.id];
  const metric = () => data.tests.find(test => test.id === state.metric);
  const panelTests = () => data.tests.filter(test => state.panel === 'all' || test.panel === state.panel);
  const badge = (test, measurement) => {
    const s = model.status(test, measurement);
    const text = s === 'unknown' ? (!test.limits ? 'No reference' : 'Indeterminate') : statusText[s];
    return '<span class="status ' + s + '">' + text + '</span>';
  };
  const diff = (current, previous) => model.change(current, previous?.result);
  const diffText = change => change === null ? '—' : change === 0 ? 'No change' : (change > 0 ? '+' : '−') + fmt(Math.abs(change));
  function buttonMetric(testId) {
    state.metric = testId;
    $('metric-select').value = testId;
    renderHighlights(); renderChart();
    $('trend-title').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }
  function setPanel(panel) {
    state.panel = panel;
    $('panel-select').value = panel;
    state.status = 'all'; $('status-filter').value = 'all';
    if (!panelTests().some(test => test.id === state.metric)) state.metric = panelTests()[0].id;
    render();
  }
  function renderNavigation() {
    const entries = [['all', 'Overview'], ...panels.map(panel => [panel, labels[panel] || panel])];
    $('panel-nav').innerHTML = entries.map(([id, label]) => '<button class="nav-item" type="button" data-panel="' + id + '" aria-current="' + (id === state.panel) + '"><span class="nav-icon" aria-hidden="true">' + icons[id] + '</span>' + label + (id === 'all' ? '' : '<span class="nav-count">' + data.tests.filter(test => test.panel === id).length + '</span>') + '</button>').join('');
    $('panel-nav').querySelectorAll('button').forEach(button => button.addEventListener('click', () => setPanel(button.dataset.panel)));
  }
  function renderSummary() {
    const tests = panelTests();
    const counts = tests.reduce((out, test) => { out[model.status(test, result(test))]++; return out; }, { in: 0, high: 0, low: 0, unknown: 0, missing: 0 });
    $('measured-count').textContent = tests.length - counts.missing;
    $('measured-note').textContent = 'of ' + tests.length + ' markers · ' + (counts.unknown ? counts.unknown + ' without a classification' : 'all recorded values classified');
    $('within-count').textContent = counts.in;
    $('outside-count').textContent = counts.high + counts.low;
    $('missing-count').textContent = counts.missing;
  }
  function renderHighlights() {
    const tests = state.panel === 'all' ? ['LDL Cholesterol', 'Creatinine', 'Hemoglobin A1c (%)', 'Hematocrit (%)'].map(name => data.tests.find(test => test.name === name)) : panelTests().slice(0, 4);
    $('highlights').innerHTML = tests.map(test => {
      const current = result(test), previous = model.previous(test, state.sample, data.samples), status = model.status(test, current);
      const change = diff(current, previous);
      return '<button type="button" class="highlight ' + (state.metric === test.id ? 'active' : '') + '" data-metric="' + test.id + '" aria-label="Explore ' + escape(test.name) + '"><div class="highlight-name"><span>' + escape(test.name.replace(' (%)', '')) + '</span><span aria-hidden="true">↗</span></div><div class="highlight-value">' + escape(current?.display ?? '—') + '<small>' + escape(test.units.replace(' (AM)', '')) + '</small></div><div class="highlight-meta"><span title="' + escape(previous ? sampleTitle(previous.sample) : 'No earlier measurement') + '">' + (change === null ? 'No comparable change' : diffText(change) + ' vs. previous') + '</span><span class="highlight-status ' + (status === 'high' || status === 'low' ? 'outside' : '') + '">' + (status === 'unknown' ? 'No classification' : statusText[status]) + '</span></div></button>';
    }).join('');
    $('highlights').querySelectorAll('button').forEach(button => button.addEventListener('click', () => buttonMetric(button.dataset.metric)));
  }
  function renderFlags() {
    const flags = panelTests().filter(test => ['high', 'low'].includes(model.status(test, result(test))));
    $('flag-count').textContent = flags.length;
    // Rotate the preview toward the selected panel; the full list is one click away.
    $('flags').innerHTML = flags.length ? flags.slice(0, 4).map(test => {
      const current = result(test), s = model.status(test, current);
      return '<div class="flag"><div><button class="flag-name" type="button" data-metric="' + test.id + '">' + escape(test.name) + '</button><div class="flag-range">Reference ' + escape(test.reference) + '</div></div><div class="flag-number">' + escape(current.display) + '<small>' + s + ' ' + (s === 'high' ? '↑' : '↓') + '</small></div></div>';
    }).join('') : '<p class="flags-empty">No recorded results outside the workbook reference ranges for this selection.</p>';
    $('flags').querySelectorAll('button').forEach(button => button.addEventListener('click', () => buttonMetric(button.dataset.metric)));
    $('show-flags').disabled = !flags.length;
    $('show-flags').firstChild.textContent = flags.length > 4 ? 'View all ' + flags.length + ' flagged results ' : 'View flagged results ';
  }
  function filteredTests() {
    return panelTests().filter(test => {
      const s = model.status(test, result(test));
      return (test.name + ' ' + test.panel).toLowerCase().includes(state.search.toLowerCase().trim()) &&
        (state.status === 'all' || (state.status === 'outside' ? s === 'high' || s === 'low' : s === state.status));
    });
  }
  function renderTable() {
    const tests = filteredTests();
    $('results-title').textContent = state.panel === 'all' ? 'All results' : labels[state.panel];
    $('table-description').textContent = sampleTitle(state.sample) + ' · Values shown only for this collection';
    $('result-rows').innerHTML = tests.length ? tests.map(test => {
      const current = result(test), prev = model.previous(test, state.sample, data.samples), change = diff(current, prev);
      return '<tr><td><button type="button" class="marker-button" data-history="' + test.id + '">' + escape(test.name) + '</button><span class="marker-panel">' + escape(labels[test.panel]) + '</span></td><td><span class="result-value ' + (['high', 'low'].includes(model.status(test, current)) ? 'orange' : '') + '">' + escape(current?.display ?? '—') + '</span><span class="result-unit">' + escape(current ? test.units : '') + '</span></td><td>' + escape(prev?.result.display ?? '—') + '<span class="small-muted">' + escape(prev ? sampleLabel(prev.sample) : 'No earlier result') + '</span></td><td class="change">' + diffText(change) + '</td><td>' + escape(test.reference || 'Not provided') + '</td><td>' + badge(test, current) + '</td><td><button type="button" class="trend-button" data-metric="' + test.id + '" aria-label="Chart ' + escape(test.name) + '">↗</button></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty-cell">No markers match these filters. Try a different search or status.</td></tr>';
    $('row-count').textContent = 'Showing ' + tests.length + ' of ' + panelTests().length + ' markers';
    $('result-rows').querySelectorAll('[data-history]').forEach(button => button.addEventListener('click', () => openHistory(button.dataset.history)));
    $('result-rows').querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => buttonMetric(button.dataset.metric)));
  }
  function renderChart() {
    const test = metric();
    const samples = model.chartSamples(data.samples, state.sample, state.period);
    const points = samples.filter(sample => test.results[sample.id]).map(sample => ({ sample, result: test.results[sample.id] }));
    $('chart-unit').textContent = test.units;
    $('metric-select').value = test.id;
    const chartLab = state.sample.lab === 'Not specified' ? 'Junction' : state.sample.lab;
    $('chart-note').textContent = 'Through ' + date(state.sample.date) + ' · ' + chartLab + ' + earlier unlabeled collections. Other labs remain in full history.' + (points.some(p => p.result.qualifier) ? ' Qualified values are plotted at their reported bounds.' : '');
    if (!points.length) {
      $('chart').innerHTML = '<div class="chart-empty"><strong>No measurements in this view</strong><span>Try a longer period, another collection, or full history.</span></div>';
      return;
    }
    const W = Math.max(300, $('chart').clientWidth), H = $('chart').clientHeight, L = 46, R = 18, T = 19, B = 36;
    const values = points.map(p => p.result.value);
    const bounds = test.limits ? (test.limits.op ? [test.limits.bound] : [test.limits.min, test.limits.max]) : [];
    let min = Math.min(...values, ...bounds), max = Math.max(...values, ...bounds);
    const padding = (max - min || Math.abs(max) || 1) * .18;
    min = Math.max(0, min - padding); max += padding;
    const start = new Date((samples[0]?.date || points[0].sample.date) + 'T12:00:00').getTime();
    const end = new Date(state.sample.date + 'T12:00:00').getTime();
    const x = sample => end === start ? (W + L - R) / 2 : L + (new Date(sample.date + 'T12:00:00').getTime() - start) / (end - start) * (W - L - R);
    const y = value => T + (max - value) / (max - min) * (H - T - B);
    const yLimit = value => y(Math.max(min, Math.min(max, value)));
    let band = '';
    if (test.limits) {
      const lower = test.limits.min ?? (['>', '≥'].includes(test.limits.op) ? test.limits.bound : min);
      const upper = test.limits.max ?? (['<', '≤'].includes(test.limits.op) ? test.limits.bound : max);
      band = '<rect x="' + L + '" y="' + yLimit(upper) + '" width="' + (W - L - R) + '" height="' + Math.max(0, yLimit(lower) - yLimit(upper)) + '" fill="#eef4e9"/>';
      bounds.forEach(bound => { if (bound >= min && bound <= max) band += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(bound) + '" y2="' + y(bound) + '" stroke="#bfd1b4" stroke-dasharray="4 4"/>'; });
    }
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = min + (max - min) * i / 4, yy = y(v);
      grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#e8ede4"/><text x="' + (L - 9) + '" y="' + (yy + 3) + '" text-anchor="end">' + fmt(Number(v.toPrecision(3))) + '</text>';
    }
    const ticks = samples.filter((sample, i) => i === 0 || i === samples.length - 1 || i % Math.max(1, Math.ceil(samples.length / 4)) === 0);
    // Avoid overlapping end labels when the final two collections are close together.
    const tickPositions = [];
    ticks.reverse().forEach(sample => {
      const xx = x(sample);
      if (tickPositions.every(pos => Math.abs(pos - xx) > 65)) { tickPositions.push(xx); grid += '<text x="' + xx + '" y="' + (H - 10) + '" text-anchor="middle">' + date(sample.date, true) + '</text>'; }
    });
    const path = points.map((p, i) => (i ? 'L' : 'M') + x(p.sample) + ',' + y(p.result.value)).join(' ');
    const dots = points.map((p, index) => {
      const selected = p.sample.id === state.sample.id;
      const out = ['high', 'low'].includes(model.status(test, p.result));
      return (selected ? '<circle cx="' + x(p.sample) + '" cy="' + y(p.result.value) + '" r="10" fill="#ecdfcc" opacity=".65"/>' : '') + '<circle class="chart-dot" data-point="' + index + '" cx="' + x(p.sample) + '" cy="' + y(p.result.value) + '" r="' + (selected ? 4.5 : 3.5) + '" fill="' + (p.result.qualifier ? '#fff' : out ? '#b27a4f' : '#387858') + '" stroke="' + (out ? '#b27a4f' : '#387858') + '" stroke-width="1.7" tabindex="0" role="img" aria-label="' + escape(sampleTitle(p.sample) + ': ' + p.result.display + ' ' + test.units + ', ' + statusText[model.status(test, p.result)]) + '"/>';
    }).join('');
    $('chart').innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="group" aria-label="' + escape(test.name + ' history; focus a point for its value') + '"><title>' + escape(test.name) + '</title><desc>Shading indicates the workbook reference range. Horizontal spacing represents elapsed time. Full history is available as a table.</desc>' + band + grid + '<path d="' + path + '" stroke="#387858" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>' + dots + '</svg><div class="chart-tooltip" role="tooltip" id="chart-tooltip" hidden></div>';
    const tooltip = $('chart-tooltip');
    $('chart').querySelectorAll('[data-point]').forEach(circle => {
      function show() {
        const point = points[Number(circle.dataset.point)];
        tooltip.innerHTML = '<strong>' + escape(point.result.display) + ' ' + escape(test.units) + '</strong><br>' + escape(sampleTitle(point.sample)) + '<br>' + statusText[model.status(test, point.result)];
        tooltip.hidden = false;
        const box = circle.getBoundingClientRect(), parent = $('chart').getBoundingClientRect();
        tooltip.style.left = Math.max(0, Math.min(parent.width - tooltip.offsetWidth, box.x - parent.x - tooltip.offsetWidth / 2)) + 'px';
        tooltip.style.top = Math.max(0, box.y - parent.y - tooltip.offsetHeight - 9) + 'px';
      }
      circle.addEventListener('mouseenter', show); circle.addEventListener('focus', show);
      circle.addEventListener('mouseleave', () => { tooltip.hidden = true; });
      circle.addEventListener('blur', () => { tooltip.hidden = true; });
      circle.addEventListener('keydown', event => { if (event.key === 'Escape') tooltip.hidden = true; });
    });
  }
  function openHistory(id) {
    const test = data.tests.find(test => test.id === id);
    $('history-title').textContent = test.name;
    $('history-reference').textContent = 'Workbook reference: ' + (test.reference || 'Not supplied');
    $('history-rows').innerHTML = data.samples.filter(sample => test.results[sample.id]).toReversed().map(sample => {
      const measurement = test.results[sample.id];
      return '<tr><td>' + date(sample.date) + '</td><td>' + escape(sample.lab) + '</td><td><strong>' + escape(measurement.display) + '</strong> ' + escape(test.units) + '</td><td>' + badge(test, measurement) + '</td><td>' + escape(data.sheet + '!' + measurement.cell) + '</td></tr>';
    }).join('');
    $('history-dialog').showModal();
  }
  function render() {
    renderNavigation(); renderSummary(); renderHighlights(); renderFlags();
    $('metric-select').innerHTML = panelTests().map(test => '<option value="' + test.id + '">' + escape(test.name) + '</option>').join('');
    renderChart(); renderTable();
  }
  function exportCSV() {
    const header = ['Marker', 'Panel', 'Collection date', 'Lab', 'Result', 'Units', 'Reference range', 'Status', 'Previous date', 'Previous lab', 'Previous result', 'Change', 'Source cell'];
    const rows = filteredTests().map(test => {
      const current = result(test), prev = model.previous(test, state.sample, data.samples);
      return [test.name, test.panel, state.sample.date, state.sample.lab, current?.display || '', test.units, test.reference, statusText[model.status(test, current)], prev?.sample.date || '', prev?.sample.lab || '', prev?.result.display || '', diffText(diff(current, prev)), current ? data.sheet + '!' + current.cell : ''];
    });
    const csv = [header, ...rows].map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'rick-labs-' + state.sample.date + '-' + state.sample.id + '.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('toast').textContent = rows.length + ' results exported for ' + date(state.sample.date); $('toast').hidden = false;
    setTimeout(() => { $('toast').hidden = true; }, 4000);
  }
  $('sample-select').innerHTML = data.samples.toReversed().map(sample => '<option value="' + sample.id + '">' + sampleLabel(sample) + '</option>').join('');
  $('sample-select').value = state.sample.id;
  $('sample-select').addEventListener('change', () => { state.sample = data.samples.find(sample => sample.id === $('sample-select').value); render(); });
  $('panel-select').innerHTML = '<option value="all">Overview · All panels</option>' + panels.map(panel => '<option value="' + panel + '">' + labels[panel] + '</option>').join('');
  $('panel-select').addEventListener('change', () => setPanel($('panel-select').value));
  $('metric-select').addEventListener('change', () => { state.metric = $('metric-select').value; renderHighlights(); renderChart(); });
  $('chart-period').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    state.period = button.dataset.period;
    $('chart-period').querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', item === button));
    renderChart();
  }));
  $('search').addEventListener('input', () => { state.search = $('search').value; renderTable(); });
  $('status-filter').addEventListener('change', () => { state.status = $('status-filter').value; renderTable(); });
  $('show-flags').addEventListener('click', () => {
    state.status = 'outside'; state.search = ''; $('status-filter').value = 'outside'; $('search').value = ''; renderTable();
    $('results-section').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  $('history-open').addEventListener('click', () => openHistory(state.metric));
  $('export-button').addEventListener('click', exportCSV);
  $('print-button').addEventListener('click', () => window.print());
  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  ['source-open', 'source-open-footer'].forEach(id => $(id).addEventListener('click', () => $('source-dialog').showModal()));
  const measurements = data.tests.reduce((sum, test) => sum + Object.keys(test.results).length, 0);
  $('sidebar-source').textContent = data.tests.length + ' markers · ' + measurements + ' measurements\n' + date(data.samples[0].date) + ' – ' + date(data.samples.at(-1).date);
  $('source-footer').textContent = 'Source: ' + data.sourceFile + '\nLab Results worksheet · ' + data.samples.length + ' collections';
  $('source-details').innerHTML = '<dl><dt>Workbook</dt><dd>' + escape(data.sourceFile) + '</dd><dt>Worksheet</dt><dd>' + escape(data.sheet) + '</dd><dt>Coverage</dt><dd>' + data.tests.length + ' markers, ' + measurements + ' measurements, ' + data.samples.length + ' collection columns</dd><dt>Dates</dt><dd>' + date(data.samples[0].date) + ' – ' + date(data.samples.at(-1).date) + '</dd><dt>Source choice</dt><dd>The Lab Results worksheet supplies all values and reference ranges. The separate Charts worksheet is not used, preserving lab-specific values.</dd><dt>Missing values</dt><dd>Empty cells stay missing; earlier results are never substituted into the selected collection.</dd><dt>Reference labels</dt><dd>High, low, and in-range labels compare each result with the workbook range. Where no range is supplied, values are not classified. Qualified results such as &lt;0.7 retain their original qualifier.</dd><dt>Changes</dt><dd>Compared with the previous available result from the same lab; if none exists, the previous earlier collection is used. Same-day values are excluded from change calculations. Changes are numerical, not assessments of clinical improvement.</dd><dt>Chart sources</dt><dd>Charts use the selected collection’s lab plus earlier collections without a lab label. Full history includes every lab, including both collections on January 30, 2026.</dd></dl>';
  render();
  if (window.ResizeObserver) {
    let width = $('chart').clientWidth;
    new ResizeObserver(() => {
      const next = $('chart').clientWidth;
      if (Math.abs(next - width) > 1) { width = next; renderChart(); }
    }).observe($('chart'));
  }
})();
