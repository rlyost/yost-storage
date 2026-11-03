/* Reference comparisons only use the workbook's supplied ranges. */
(function (root) {
  function interval(result) {
    if (result.qualifier === '<' || result.qualifier === '≤') return { low: -Infinity, high: result.value, lowOpen: true, highOpen: result.qualifier === '<' };
    if (result.qualifier === '>' || result.qualifier === '≥') return { low: result.value, high: Infinity, lowOpen: result.qualifier === '>', highOpen: true };
    return { low: result.value, high: result.value, lowOpen: false, highOpen: false };
  }
  function status(test, result) {
    if (!result) return 'missing';
    if (!test.limits) return 'unknown';
    var range = test.limits, bound = interval(result);
    var min = range.min ?? (range.op === '>' || range.op === '≥' ? range.bound : -Infinity);
    var max = range.max ?? (range.op === '<' || range.op === '≤' ? range.bound : Infinity);
    var minOpen = range.op === '>', maxOpen = range.op === '<';
    if (bound.high < min || (bound.high === min && (minOpen || bound.highOpen))) return 'low';
    if (bound.low > max || (bound.low === max && (maxOpen || bound.lowOpen))) return 'high';
    var aboveMin = bound.low > min || (bound.low === min && (!minOpen || bound.lowOpen));
    var belowMax = bound.high < max || (bound.high === max && (!maxOpen || bound.highOpen));
    return aboveMin && belowMax ? 'in' : 'unknown';
  }
  function previous(test, sample, samples) {
    var candidates = samples.filter(function (entry) { return entry.date < sample.date && test.results[entry.id]; });
    // Use the same lab where available, then earlier unlabeled/historical collections.
    var sameLab = candidates.filter(function (entry) { return entry.lab === sample.lab; });
    var collection = (sameLab.length ? sameLab : candidates).at(-1);
    return collection ? { sample: collection, result: test.results[collection.id] } : null;
  }
  function change(current, previousResult) {
    if (!current || !previousResult || current.qualifier || previousResult.qualifier) return null;
    return Number((current.value - previousResult.value).toPrecision(12));
  }
  function chartSamples(samples, sample, period) {
    var cutoff = new Date(sample.date + 'T12:00:00');
    if (period !== 'all') cutoff.setFullYear(cutoff.getFullYear() - Number(period));
    var earliest = period === 'all' ? '' : cutoff.toISOString().slice(0, 10);
    return samples.filter(function (entry) {
      return entry.date <= sample.date && entry.date >= earliest &&
        (entry.lab === 'Not specified' || entry.lab === sample.lab || sample.lab === 'Not specified' && entry.lab === 'Junction');
    });
  }
  root.LabModel = Object.freeze({ status: status, previous: previous, change: change, chartSamples: chartSamples });
})(typeof window === 'undefined' ? globalThis : window);
