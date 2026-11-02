(function () {
  var frame = document.getElementById('app');
  var button = document.getElementById('run');
  var output = document.getElementById('results');
  var KEY = 'handlerpath.alarm';
  var lines = [];
  var loadSequence = 0;
  function alarmBook() { return JSON.parse(localStorage.getItem(KEY)); }
  function alarmState() {
    var book = alarmBook();
    return book.alarms.find(function (entry) { return entry.id === book.selectedId; });
  }
  function check(condition, message) {
    if (!condition) throw new Error(message);
    lines.push('PASS ' + message);
    output.textContent = lines.join('\n');
  }
  function load(path) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () { reject(new Error('Page load timed out')); }, 10000);
      frame.onload = function () { clearTimeout(timeout); resolve(frame.contentDocument); };
      // A hash-only iframe navigation does not load a new document.
      var target = new URL(path, document.baseURI);
      target.searchParams.set('test-load', String(++loadSequence));
      frame.src = target.href;
    });
  }
  function waitFor(predicate) {
    return new Promise(function (resolve, reject) {
      var start = performance.now();
      function poll() {
        if (predicate()) return resolve();
        if (performance.now() - start > 6000) return reject(new Error('Condition timed out'));
        setTimeout(poll, 25);
      }
      poll();
    });
  }
  function key(doc, value) {
    doc.activeElement.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', {
      key: value, bubbles: true, cancelable: true
    }));
  }
  async function search(doc, value) {
    var input = doc.getElementById('q');
    var changed = performance.now();
    var observer = new MutationObserver(function () { changed = performance.now(); });
    observer.observe(doc.body, { subtree: true, childList: true, attributes: true });
    input.value = value;
    input.dispatchEvent(new frame.contentWindow.Event('input'));
    try { await waitFor(function () { return performance.now() - changed > 150; }); }
    finally { observer.disconnect(); }
  }
  async function recipePrintChecks() {
    frame.width = '390';
    for (var path of ['High_Protein_Crockpot.html', 'yummy_shred.html']) {
      var doc = await load('../' + path);
      var win = frame.contentWindow;
      var toolbar = doc.getElementById('print-toolbar');
      var recipeButton = doc.querySelector('.recipe-btn');
      var target = doc.getElementById(recipeButton.dataset.target);
      var printCalls = 0;
      win.print = function () { printCalls++; };
      recipeButton.querySelector('path').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
      check(printCalls === 1 && !toolbar.hidden && target.checkVisibility(), path + ': tap opens recipe preview and calls print synchronously');
      check(Array.from(doc.querySelectorAll('article.recipe')).filter(function (card) {
        return card.checkVisibility();
      }).length === 1, path + ': preview shows only the selected recipe');
      await new Promise(function (resolve) { setTimeout(resolve, 3200); });
      win.dispatchEvent(new win.Event('afterprint'));
      check(!toolbar.hidden && target.classList.contains('print-target'), path + ': preview persists for browser-menu printing');
      doc.getElementById('print-current').click();
      check(printCalls === 2, path + ': preview Print button retries');
      key(doc, 'Escape');
      check(toolbar.hidden && doc.activeElement === recipeButton, path + ': Escape restores recipe-button focus');
      win.print = function () { throw new Error('Printing unavailable'); };
      recipeButton.click();
      check(!toolbar.hidden && target.checkVisibility(), path + ': rejected printing retains a usable preview');
      doc.getElementById('print-back').click();
      win.print = undefined;
      var shoppingButton = doc.querySelector('.print-btn');
      shoppingButton.click();
      var recipe = win.SHOP[shoppingButton.dataset.key];
      var area = doc.getElementById('printarea');
      check(area.checkVisibility() && area.getAttribute('aria-hidden') === 'false' &&
        Array.from(area.querySelectorAll('li')).map(function (li) { return li.textContent; }).join('\n') === recipe.i.join('\n'),
        path + ': unavailable printing shows an accessible shopping list with exact ingredients');
      check(doc.documentElement.scrollWidth <= win.innerWidth, path + ': mobile preview has no horizontal overflow');
      doc.getElementById('print-back').click();
      check(toolbar.hidden && doc.activeElement === shoppingButton && !doc.body.classList.contains('printing-list'),
        path + ': Back restores the recipe page and focus');
    }
  }
  document.getElementById('run-print').addEventListener('click', async function () {
    var printRun = this;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
      output.textContent = 'Run this harness on a local HTTP server.';
      return;
    }
    printRun.disabled = button.disabled = true;
    lines = [];
    try {
      await recipePrintChecks();
      lines.push('COMPLETE: ' + lines.length + ' checks passed');
    } catch (error) {
      lines.push('FAIL ' + error.message);
    } finally {
      frame.src = 'about:blank';
      frame.width = '1000';
      output.textContent = lines.join('\n');
      printRun.disabled = button.disabled = false;
    }
  });
  button.addEventListener('click', async function () {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
      output.textContent = 'Run this harness on a local HTTP server.';
      return;
    }
    button.disabled = document.getElementById('run-print').disabled = true;
    lines = [];
    var saved = localStorage.getItem(KEY);
    try {
      localStorage.removeItem(KEY);
      var doc = await load('../index.html');
      var initialURL = doc.location.href;
      doc.getElementById('calc-link').click();
      var $ = function (id) { return doc.getElementById(id); };
      check(doc.location.href === initialURL, 'Calculator menu action stays on the current page');
      check($('calculator').open && doc.activeElement === $('calc-close'), 'Calculator dialog opens with close-button focus');
      ['1', '.', '5', '+', '2', '.', '5', 'Enter'].forEach(function (value) { key(doc, value); });
      check($('calc-display').textContent === '4', 'Calculator keyboard arithmetic');
      key(doc, 'Escape');
      check(!$('calculator').open && doc.activeElement === $('calc-link'), 'Calculator Escape returns focus');
      $('calc-link').click();
      check($('calculator').open, 'Calculator menu reopens the popup');
      $('calc-link').click();
      check(!$('calculator').open, 'Calculator menu toggles the popup closed');
      $('calc-link').click();
      $('calc-close').click();
      check(doc.activeElement === $('calc-link'), 'Calculator close button returns focus');

      $('alarm-link').click();
      check(doc.location.href === initialURL, 'Alarm menu action stays on the current page');
      check($('alarm-dialog').matches(':modal'), 'Alarm uses a native modal dialog');
      $('alarm-sound').checked = false;
      $('alarm-sound').dispatchEvent(new frame.contentWindow.Event('change'));
      $('t-h').value = 0; $('t-m').value = 0; $('t-s').value = 4;
      $('btn-set').click();
      check(!$('alarm-dialog').open, 'Arming closes the alarm dialog');
      doc = await load('../index.html#alarm'); $('btn-stop').click();
      var paused = alarmState();
      check(paused.state === 'paused' && paused.remainingMs > 0, 'Stop banks remaining timer time');
      $('btn-set').click();
      doc = await load('../index.html');
      check(alarmState().state === 'running', 'Reload restores a running deadline');
      await waitFor(function () { return !$('alarm-ring').hidden; });
      check($('alarm-status').textContent === 'ALARM RINGING', 'Restored timer rings');
      $('alarm-off').click();
      check($('alarm-ring').hidden && alarmState().state === 'idle', 'Turn Off hides overlay and disarms');

      $('alarm-link').click();
      $('t-h').value = 0; $('t-m').value = 10; $('t-s').value = 0;
      $('btn-set').click();
      var firstDeadline = alarmState().deadline;
      $('alarm-link').click(); $('alarm-add').click();
      check(doc.activeElement === $('a-time'), 'Adding an alarm focuses its time field');
      $('a-time').value = '23:59'; $('btn-set').click();
      var secondId = alarmBook().selectedId;
      check(alarmBook().alarms.length === 2 && alarmBook().alarms[0].deadline === firstDeadline,
        'Adding an alarm preserves the existing timer');
      $('alarm-link').click(); $('a-time').value = '23:58';
      $('a-time').dispatchEvent(new frame.contentWindow.Event('input'));
      check($('btn-set').textContent === 'Save changes', 'Running alarms expose an edit action');
      $('btn-set').click();
      doc = await load('../index.html#alarm');
      check(alarmBook().selectedId === secondId && alarmState().alarmTime === '23:58' &&
        alarmBook().alarms[0].deadline === firstDeadline, 'Multiple alarms and edits survive reload');
      $('alarm-list').querySelector('.alarm-select').click();
      check(doc.activeElement === $('t-h'), 'Selecting a saved timer opens its editor');
      $('alarm-list').querySelector('li:last-child button:last-child').click();
      check(alarmBook().alarms.length === 1 && alarmState().deadline === firstDeadline,
        'Deleting another alarm preserves the selected timer');
      $('btn-reset').click();

      doc = await load('../PAWS_Training_Manual.html');
      var cards = Array.from(doc.querySelectorAll('.card'));
      var original = cards.map(function (card) { return card.textContent; });
      await search(doc, 'dog');
      check(doc.querySelectorAll('mark[data-search]').length > 0, 'Manual creates search highlights');
      doc.querySelector('[data-view="log"]').click();
      check(!doc.getElementById('view-log').classList.contains('hidden'), 'Manual tab switches during search');
      await search(doc, 'training');
      check(cards.every(function (card, i) { return card.textContent === original[i]; }), 'Replacing highlights preserves text');
      await search(doc, '');
      check(doc.querySelectorAll('mark[data-search]').length === 0 && cards.every(function (card) {
        return !card.classList.contains('hidden');
      }), 'Clearing search removes marks and restores cards');
      check(cards.every(function (card, i) { return card.textContent === original[i]; }), 'Clearing preserves all original text');

      await recipePrintChecks();
      lines.push('COMPLETE: ' + lines.length + ' checks passed');
    } catch (error) {
      lines.push('FAIL ' + error.message);
    } finally {
      frame.src = 'about:blank';
      frame.width = '1000';
      if (saved === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, saved);
      output.textContent = lines.join('\n');
      button.disabled = document.getElementById('run-print').disabled = false;
    }
  });
})();
