(function () {
  // View switching: one delegated listener avoids per-button closures.
  var tabs = document.querySelector('.tabs');
  var views = ['curriculum', 'log'].map(function(name){
    return {
      name: name,
      content: document.getElementById('view-' + name),
      navigation: document.getElementById('nav-' + name)
    };
  });
  tabs.addEventListener('click', function(event){
      var t = event.target.closest('.tab');
      if(!t) return;
      var v = t.dataset.view;
      tabs.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});
      t.classList.add('active');
      views.forEach(function(view){
        var hidden = view.name !== v;
        view.content.classList.toggle('hidden', hidden);
        view.navigation.classList.toggle('hidden', hidden);
      });
      var sb = document.querySelector('nav.side'); if(sb) sb.scrollTop = 0;
      window.scrollTo({top:0,behavior:'smooth'});
  });

  // Search across both views
  var q = document.getElementById('q');
  // The manual is static: index once at initialization. Highlighting only changes
  // markup, not text. If editable/dynamic cards are added, rebuild this metadata
  // after content changes and before the next search.
  var cards = Array.prototype.map.call(document.querySelectorAll('.card'), function(card){
    return {
      element: card,
      session: card.closest('.session'),
      searchText: card.textContent.toLocaleLowerCase(),
      marks: []
    };
  });

  function setHidden(card, hidden){
    card.element.classList.toggle('hidden', hidden);
    if(card.session) card.session.classList.toggle('hidden', hidden);
  }

  function clearCard(card){
    // Normalize once per affected parent, not once for every individual match.
    var parents = new Set();
    card.marks.forEach(function(mark){
      parents.add(mark.parentNode);
      mark.replaceWith(document.createTextNode(mark.textContent));
    });
    card.marks = [];
    parents.forEach(function(parent){ parent.normalize(); });
    setHidden(card, false);
  }

  var searchFrame = 0;
  var completedTerm = '';
  var searching = false;
  q.addEventListener('input', function(){
    cancelAnimationFrame(searchFrame);
    searchFrame = requestAnimationFrame(search);
  });

  function search(){
    var term = q.value.trim();
    if(!searching && term === completedTerm) return;
    searching = true;
    var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')','gi');
    var needle = term.toLocaleLowerCase();
    var cursor = 0;
    var clearing = true;

    // Bound work per frame. A newer input cancels the queued slice and starts
    // cleanup again, so stale queries cannot finish painting over new results.
    function step(){
      var started = performance.now();
      var count = 0;
      while(cursor < cards.length){
        var card = cards[cursor++];
        if(clearing) clearCard(card);
        else highlight(card);
        if(++count >= 12 || performance.now() - started >= 6) break;
      }
      if(cursor === cards.length && clearing && term.length >= 2){
        clearing = false;
        cursor = 0;
      }
      if(cursor < cards.length) searchFrame = requestAnimationFrame(step);
      else {
        searching = false;
        completedTerm = term;
      }
    }

    function highlight(c){
      var hit = c.searchText.indexOf(needle) !== -1;
      if(!hit){
        setHidden(c, true);
        return;
      }
      // highlight text nodes only
      var walker = document.createTreeWalker(c.element, NodeFilter.SHOW_TEXT, null);
      var nodes = [], n;
      while(n = walker.nextNode()){ if(n.nodeValue.trim()) nodes.push(n); }
      nodes.forEach(function(node){
        if(node.parentNode.nodeName === 'PRE') return;
        if(!re.test(node.nodeValue)){ re.lastIndex = 0; return; }
        re.lastIndex = 0;
        var fragment = document.createDocumentFragment();
        var last = 0;
        node.nodeValue.replace(re, function(match, _, offset){
          fragment.append(document.createTextNode(node.nodeValue.slice(last, offset)));
          var mark = document.createElement('mark');
          mark.dataset.search = '';
          c.marks.push(mark);
          mark.textContent = match;
          fragment.append(mark);
          last = offset + match.length;
          return match;
        });
        fragment.append(document.createTextNode(node.nodeValue.slice(last)));
        node.replaceWith(fragment);
      });
    }
    step();
  }
})();
