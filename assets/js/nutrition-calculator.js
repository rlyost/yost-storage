(function () {
  'use strict';
  var form = document.getElementById('nutrition-form');
  if (!form) return;
  var weight = document.getElementById('nutrition-weight');
  var unit = document.getElementById('nutrition-unit');
  var error = document.getElementById('nutrition-error');
  var results = document.getElementById('nutrition-results');
  var calories = document.getElementById('nutrition-calories');
  var protein = document.getElementById('nutrition-protein');

  function clearResults() {
    results.hidden = true;
    calories.textContent = '';
    protein.textContent = '';
    error.hidden = true;
    error.textContent = '';
    weight.removeAttribute('aria-invalid');
  }

  function format(value) {
    return Math.round(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearResults();
    var value = weight.valueAsNumber;
    var pounds = unit.value === 'kg' ? value / 0.45359237 : value;
    if (!Number.isFinite(value) || value < 1 || !Number.isFinite(pounds * 12)) {
      error.textContent = 'Enter a valid current body weight of at least 1 ' + (unit.value === 'kg' ? 'kg' : 'lb') + '.';
      error.hidden = false;
      weight.setAttribute('aria-invalid', 'true');
      weight.focus();
      return;
    }
    calories.textContent = format(pounds * 11) + '–' + format(pounds * 12);
    protein.textContent = format(pounds * 0.8) + '–' + format(pounds);
    results.hidden = false;
  });

  weight.addEventListener('input', clearResults);
  unit.addEventListener('change', function () {
    weight.placeholder = unit.value === 'kg' ? 'e.g. 82' : 'e.g. 180';
    clearResults();
  });
})();
