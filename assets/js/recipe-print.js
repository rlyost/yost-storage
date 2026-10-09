(function () {
  'use strict';

  var area = document.getElementById('printarea');
  var toolbar = document.getElementById('print-toolbar');
  var printButton = document.getElementById('print-current');
  var backButton = document.getElementById('print-back');
  var returnButton = null;
  var scrollPosition = 0;

  function clearPrint() {
    document.body.classList.remove('printing-list', 'printing-recipe');
    var target = document.querySelector('.print-target');
    if (target) target.classList.remove('print-target');
    area.setAttribute('aria-hidden', 'true');
    toolbar.hidden = true;
  }

  function tryPrint() {
    // Keep the preview available when a mobile browser ignores or rejects print().
    try {
      if (typeof window.print === 'function') window.print();
    } catch (error) {
      // The toolbar explains how to print through the browser instead.
    }
  }

  function showPrint(button, mode) {
    returnButton = button;
    scrollPosition = window.scrollY;
    document.body.classList.add(mode);
    toolbar.hidden = false;
    window.scrollTo(0, 0);
    printButton.focus({ preventScroll: true });
    // Call synchronously within the tap; mobile browsers can require user activation.
    tryPrint();
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('.recipe-btn, .print-btn') : null;
    if (!button) return;
    if (button.classList.contains('recipe-btn')) {
      var card = document.getElementById(button.getAttribute('data-target'));
      if (!card) return;
      clearPrint();
      card.classList.add('print-target');
      showPrint(button, 'printing-recipe');
      return;
    }

    var recipe = SHOP[button.getAttribute('data-key')];
    if (!recipe) return;
    if (!recipe.i.length) {
      window.alert('No ingredient list was found for this recipe.');
      return;
    }
    clearPrint();
    area.replaceChildren();
    var title = document.createElement('h1');
    title.textContent = recipe.t;
    var subtitle = document.createElement('p');
    subtitle.className = 'sub';
    subtitle.textContent = 'Shopping list \u00b7 ' + recipe.i.length + ' items';
    var list = document.createElement('ul');
    recipe.i.forEach(function (ingredient) {
      var item = document.createElement('li');
      item.textContent = ingredient;
      list.appendChild(item);
    });
    area.append(title, subtitle, list);
    area.setAttribute('aria-hidden', 'false');
    showPrint(button, 'printing-list');
  });

  function backToRecipes() {
    if (toolbar.hidden) return;
    clearPrint();
    if (returnButton) returnButton.focus({ preventScroll: true });
    window.scrollTo(0, scrollPosition);
    returnButton = null;
  }

  printButton.addEventListener('click', tryPrint);
  backButton.addEventListener('click', backToRecipes);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') backToRecipes();
  });
  // Do not reset on a timer or afterprint: browser-menu printing needs this state.
})();
