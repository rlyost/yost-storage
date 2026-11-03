async () => {
  const $ = id => document.getElementById(id), checks = [];
  function check(value, message) { if (!value) throw Error(message); checks.push(message); }
  function choose(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('change', { bubbles: true })); }
  function search(value) { $('search').value = value; $('search').dispatchEvent(new Event('input', { bubbles: true })); }
  const data = window.LAB_DATA;
  check(data.tests.length === 75 && document.querySelectorAll('#result-rows tr').length === 75, 'All 75 markers render');
  check($('measured-count').textContent === '60' && $('within-count').textContent === '40' && $('outside-count').textContent === '15' && $('missing-count').textContent === '15', 'Latest summary reconciles recorded and missing results');
  check(document.querySelectorAll('.chart-dot').length === 11, 'All-history LDL chart renders 11 measured collections');
  document.querySelector('[data-period="1"]').click();
  check(document.querySelectorAll('.chart-dot').length === 4, 'One-year chart contains four collection points');
  const dot = document.querySelector('.chart-dot'); dot.focus();
  check(!$('chart-tooltip').hidden && $('chart-tooltip').textContent.includes('Junction'), 'Chart point keyboard focus exposes date, lab and value'); dot.blur();
  search('Creatinine');
  check(document.querySelectorAll('#result-rows tr').length === 1 && $('result-rows').textContent.includes('1.52'), 'Search isolates the correct marker and value');
  search('nothing matches'); check($('result-rows').textContent.includes('No markers match'), 'Empty search state explains filters');
  search(''); choose('status-filter', 'outside');
  check(document.querySelectorAll('#result-rows tr').length === 15, 'Outside-reference filter shows 15 results');
  choose('status-filter', 'unknown'); check(document.querySelectorAll('#result-rows tr').length === 5, 'Unclassified filter preserves five measurements with no reference');
  choose('status-filter', 'missing'); check(document.querySelectorAll('#result-rows tr').length === 15, 'Missing filter shows empty source cells');
  choose('status-filter', 'all');
  const albumin = data.tests.find(t => t.name === 'Albumin');
  choose('sample-select', 'J'); search('Albumin');
  check($('result-rows').querySelector('.result-value').textContent === '4.9', 'Lyster collection retains Albumin 4.9');
  choose('sample-select', 'K');
  check($('result-rows').querySelector('.result-value').textContent === '4.7', 'Junction collection retains Albumin 4.7');
  document.querySelector('[data-history="' + albumin.id + '"]').click();
  check($('history-dialog').matches(':modal'), 'Marker opens native history dialog');
  const rows = [...$('history-rows').querySelectorAll('tr')].filter(r => r.textContent.includes('Jan 30, 2026'));
  check(rows.length === 2 && rows.some(r => r.textContent.includes('Lyster')) && rows.some(r => r.textContent.includes('Junction')), 'Full history keeps both same-day labs separate');
  check(rows.some(r => r.textContent.includes('J24')) && rows.some(r => r.textContent.includes('K24')), 'History includes original source-cell addresses');
  $('history-dialog').close(); search(''); choose('sample-select', 'N');
  document.querySelector('[data-panel="CBC"]').click();
  check($('results-title').textContent === 'Blood count' && document.querySelectorAll('#result-rows tr').length === 20, 'Panel navigation scopes results and chart options');
  document.querySelector('[data-panel="all"]').click();
  $('source-open-footer').click();
  check($('source-dialog').matches(':modal') && $('source-details').textContent.includes('not sync') === false, 'Data provenance opens from footer');
  $('source-dialog').close();
  search('FSH');
  check($('result-rows').textContent.includes('<0.7') && $('result-rows').textContent.includes('Low'), 'Qualified result retains its bound and correct workbook-range label');
  let exportedBlob, downloadName;
  const oldURL = URL.createObjectURL, oldClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = blob => { exportedBlob = blob; return oldURL(blob); };
  HTMLAnchorElement.prototype.click = function () { downloadName = this.download; };
  try { $('export-button').click(); } finally { URL.createObjectURL = oldURL; HTMLAnchorElement.prototype.click = oldClick; }
  const csv = await exportedBlob.text();
  check(downloadName === 'rick-labs-2026-10-28-N.csv' && csv.includes('"<0.7"') && csv.split('\r\n').length === 2, 'CSV reflects search, selected collection, exact qualifier and source identity');
  search(''); document.querySelector('[data-period="all"]').click();
  window.scrollTo(0,0);
  return { passed: checks.length, checks };
}
