(function () {
  var frame = document.getElementById('app');
  var button = document.getElementById('run');
  var output = document.getElementById('results');
  var KEY = 'handlerpath.alarm';
  var lines = [];
  function check(condition, message) {
    if (!condition) throw new Error(message);
    lines.push('PASS ' + message);
    output.textContent = lines.join('\n');
  }
  function load(path) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () { reject(new Error('Page load timed out')); }, 10000);
      frame.onload = function () { clearTimeout(timeout); resolve(frame.contentDocument); };
      frame.src = path;
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
  button.addEventListener('click', async function () {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
      output.textContent = 'Run this harness on a local HTTP server.';
      return;
    }
    button.disabled = true;
    lines = [];
    var saved = localStorage.getItem(KEY);
    try {
      localStorage.removeItem(KEY);
      var doc = await load('../index.html');
      var $ = function (id) { return doc.getElementById(id); };
      $('calc-link').click();
      check($('calculator').open && doc.activeElement === $('calc-close'), 'Calculator dialog opens with close-button focus');
      ['1', '.', '5', '+', '2', '.', '5', 'Enter'].forEach(function (value) { key(doc, value); });
      check($('calc-display').textContent === '4', 'Calculator keyboard arithmetic');
      key(doc, 'Escape');
      check(!$('calculator').open && doc.activeElement === $('calc-link'), 'Calculator Escape returns focus');
      $('calc-link').click(); $('calc-close').click();
      check(doc.activeElement === $('calc-link'), 'Calculator close button returns focus');

      $('alarm-link').click();
      check($('alarm-dialog').matches(':modal'), 'Alarm uses a native modal dialog');
      $('alarm-sound').checked = false;
      $('alarm-sound').dispatchEvent(new frame.contentWindow.Event('change'));
      $('t-h').value = 0; $('t-m').value = 0; $('t-s').value = 4;
      $('btn-set').click();
      check(!$('alarm-dialog').open, 'Arming closes the alarm dialog');
      $('alarm-link').click(); $('btn-stop').click();
      var paused = JSON.parse(localStorage.getItem(KEY));
      check(paused.state === 'paused' && paused.remainingMs > 0, 'Stop banks remaining timer time');
      $('btn-set').click();
      doc = await load('../index.html');
      check(JSON.parse(localStorage.getItem(KEY)).state === 'running', 'Reload restores a running deadline');
      await waitFor(function () { return !$('alarm-ring').hidden; });
      check($('alarm-status').textContent === 'ALARM RINGING', 'Restored timer rings');
      $('alarm-off').click();
      check($('alarm-ring').hidden && JSON.parse(localStorage.getItem(KEY)).state === 'idle', 'Turn Off hides overlay and disarms');

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
      lines.push('COMPLETE: ' + lines.length + ' checks passed');
    } catch (error) {
      lines.push('FAIL ' + error.message);
    } finally {
      frame.src = 'about:blank';
      if (saved === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, saved);
      output.textContent = lines.join('\n');
      button.disabled = false;
    }
  });
})();
