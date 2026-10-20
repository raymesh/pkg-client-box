// client-box · page script. Plain JS, no build step: works inside an Astro component or a page
// a server function writes. Expects the markup from html/box.html (or astro/ClientBox.astro) and
// the attribute data-client-box="<base path>" on the wrapper; the five endpoints live under that
// base (…/todos, /notes, /tidy, /photos, /photos/<id>). See server/index.js.
  // Small jobs: repo jobs come from the page; jobs added from the notes come from KV (extra).
// window.hubTodos lets the notes box add jobs and refresh this list.
(function () {
  var root = document.querySelector('[data-client-box]'); if (!root) return;
  var BASE = root.getAttribute('data-client-box') || location.pathname.replace(/\/$/, '');
  var list = document.getElementById('todos');
  if (!list) return;
  var note = document.getElementById('todo-note'), none = document.getElementById('todos-none');
  var url = BASE + '/todos';
  var repoItems = [].slice.call(list.querySelectorAll('.todo'));
  repoItems.forEach(function (li) { li.dataset.orig = li.querySelector('.todo__text').textContent; });
  var last = { state: {}, extra: [] };
  function say(t, bad) { note.textContent = t; note.classList.toggle('bad', !!bad); }
  function day(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function extraLi(e) {
    var li = document.createElement('li'); li.className = 'todo todo--extra'; li.dataset.id = e.id;
    var label = document.createElement('label'), box = document.createElement('input'), txt = document.createElement('span');
    box.type = 'checkbox'; txt.className = 'todo__text'; txt.textContent = e.text;
    label.appendChild(box); label.appendChild(txt); li.appendChild(label);
    var ed = document.createElement('button'); ed.type = 'button'; ed.className = 'todo__ed'; ed.textContent = '✎';
    ed.title = 'Edit this job'; ed.setAttribute('aria-label', 'Edit: ' + e.text); li.appendChild(ed);
    var del = document.createElement('button'); del.type = 'button'; del.className = 'todo__del'; del.textContent = '×';
    del.title = 'Delete this job'; del.setAttribute('aria-label', 'Delete: ' + e.text); li.appendChild(del);
    var meta = document.createElement('span'); meta.className = 'todo__meta';
    meta.innerHTML = '<span class="tag">From notes</span><span class="mono"></span><span class="mono done-on"></span>';
    meta.children[1].textContent = 'added ' + day(e.added); li.appendChild(meta);
    return li;
  }
  function paint(data) {
    last = data; var state = data.state || {}, open = 0, shown = 0;
    list.querySelectorAll('.todo--extra').forEach(function (li) { li.remove(); });
    var all = repoItems.concat((data.extra || []).map(function (e) { var li = extraLi(e); list.appendChild(li); return li; }));
    all.forEach(function (li) {
      var s = state[li.dataset.id] || {}, box = li.querySelector('input');
      li.hidden = !!s.deleted; if (s.deleted) return;
      shown++; box.checked = !!s.done; box.disabled = false; li.querySelector('.todo__del').disabled = false; li.querySelector('.todo__ed').disabled = false;
      if (li.dataset.orig) li.querySelector('.todo__text').textContent = s.text || li.dataset.orig;
      li.classList.toggle('is-done', !!s.done);
      li.querySelector('.done-on').textContent = s.done && s.at ? 'done ' + day(s.at) : '';
      if (!s.done) open++;
    });
    // done jobs sink to the bottom, in their original order
    all.filter(function (li) { return li.classList.contains('is-done'); }).forEach(function (li) { list.appendChild(li); });
    none.hidden = shown > 0;
    var oc = document.getElementById('open-count');
    if (oc) oc.innerHTML = '<b>' + open + '</b> small ' + (open === 1 ? 'job' : 'jobs') + ' open';
  }
  function post(body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
      .then(function (d) { paint(d); return d; });
  }
  // texts already on the list (visible ones), so the notes don't add a job twice
  function visibleTexts() {
    return [].slice.call(list.querySelectorAll('.todo:not([hidden]) .todo__text')).map(function (e) { return e.textContent.toLowerCase().replace(/\s+/g, ' ').trim(); });
  }
  window.hubTodos = {
    // the list as Sandra sees it, for Tidy up to point at jobs by id
    list: function () {
      return [].slice.call(list.querySelectorAll('.todo:not([hidden])')).map(function (li) {
        return { id: li.dataset.id, text: li.querySelector('.todo__text').textContent, done: li.classList.contains('is-done') };
      });
    },
    apply: function (changes) { return changes.length ? post({ changes: changes }).then(function () { return changes.length; }) : Promise.resolve(0); },
    add: function (texts) {
      var have = visibleTexts();
      var fresh = texts.filter(function (t) { return have.indexOf(t.toLowerCase().replace(/\s+/g, ' ').trim()) < 0; });
      return fresh.length ? post({ add: fresh }).then(function () { return fresh.length; }) : Promise.resolve(0);
    },
  };
  fetch(url, { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (data) {
      paint(data);
      list.addEventListener('change', function (e) {
        var li = e.target.closest('.todo'); if (!li) return;
        var done = e.target.checked;
        say('Saving…');
        post({ id: li.dataset.id, done: done }).then(function () { say('Saved.'); })
          .catch(function () { e.target.checked = !done; say("Couldn't save. Check your connection and try again.", true); });
      });
      // Confirm inside the row, not with confirm(): phone and in-app browsers often block
      // native dialogs, which silently cancelled the delete.
      function closeConfirm() { list.querySelectorAll('.todo__confirm, .todo__edit').forEach(function (c) { c.closest('.todo').classList.remove('confirming', 'editing'); c.remove(); }); }
      function saveEdit(li) {
        var input = li.querySelector('.todo__edit input'), v = input.value.trim();
        if (!v) { input.focus(); return; }
        if (v === li.querySelector('.todo__text').textContent) { closeConfirm(); return; }
        li.querySelectorAll('.todo__edit button').forEach(function (b) { b.disabled = true; }); say('Saving…');
        post({ id: li.dataset.id, action: 'edit', text: v }).then(function () { say('Saved.'); })
          .catch(function () { closeConfirm(); say("Couldn't save. Check your connection and try again.", true); });
      }
      list.addEventListener('click', function (e) {
        var li = e.target.closest('.todo'); if (!li) return;
        if (e.target.closest('.todo__ed')) {
          var editing = li.classList.contains('editing'); closeConfirm(); if (editing) return;
          li.classList.add('editing');
          var form = document.createElement('div'); form.className = 'todo__edit';
          form.innerHTML = '<input type="text" maxlength="300" aria-label="Job wording"><button type="button" class="cbtn cbtn--save">Save</button><button type="button" class="cbtn cbtn--no">Cancel</button>';
          li.appendChild(form);
          var input = form.querySelector('input'); input.value = li.querySelector('.todo__text').textContent; input.focus();
          input.addEventListener('keydown', function (k) { if (k.key === 'Enter') saveEdit(li); });
          return;
        }
        if (e.target.closest('.cbtn--save')) { saveEdit(li); return; }
        if (e.target.closest('.todo__del')) {
          var open = li.classList.contains('confirming'); closeConfirm(); if (open) return;
          li.classList.add('confirming');
          var bar = document.createElement('div'); bar.className = 'todo__confirm';
          bar.innerHTML = '<span>Delete this job?</span><button type="button" class="cbtn cbtn--yes">Delete</button><button type="button" class="cbtn cbtn--no">Cancel</button>';
          li.appendChild(bar); bar.querySelector('.cbtn--no').focus();
          return;
        }
        if (e.target.closest('.cbtn--no')) { closeConfirm(); return; }
        if (e.target.closest('.cbtn--yes')) {
          e.target.disabled = true; say('Deleting…');
          post({ id: li.dataset.id, deleted: true }).then(function () { say('Deleted.'); })
            .catch(function () { closeConfirm(); say("Couldn't delete. Check your connection and try again.", true); });
        }
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeConfirm(); });
    })
    .catch(function () { say('The ticks load when this page is opened from the live site.', true); });
})();

  (function () {
  var box = document.getElementById('notes'); if (!box) return;
  var root = document.querySelector('[data-client-box]');
  var base = (root && root.getAttribute('data-client-box')) || location.pathname.replace(/\/$/, '');
  var $ = function (id) { return document.getElementById(id); };
  // The box starts empty (on load and after each save); a save adds to the saved notes.
  // Edit loads the saved notes into the box, and that save replaces them.
  var text = $('notes-text'), status = $('notes-status'), pending = null, saved = null, editingSaved = false;
  function say(t, bad) { status.textContent = t || ''; status.classList.toggle('bad', !!bad); }
  // the message shows next to the button that was pressed (captured before its handler runs)
  box.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.notes__actions .nbtn');
    if (b && b.nextSibling !== status) { b.parentNode.insertBefore(status, b.nextSibling); say(''); }
  }, true);
  // Render the tidy version with textContent only: whatever comes back is never treated as HTML.
  function render(el, tidy, raw) {
    el.innerHTML = '';
    if (tidy && tidy.sections) {
      tidy.sections.forEach(function (sec) {
        if (sec.heading) { var h = document.createElement('h3'); h.textContent = sec.heading; el.appendChild(h); }
        var ul = document.createElement('ul');
        sec.items.forEach(function (it) { var li = document.createElement('li'); li.textContent = it; ul.appendChild(li); });
        el.appendChild(ul);
      });
    } else if (raw) { var p = document.createElement('p'); p.className = 'notes__raw'; p.textContent = raw; el.appendChild(p); }
  }
  function showSaved(n) {
    saved = n; editingSaved = false;
    var has = n && (n.raw || n.tidy);
    $('notes-saved').hidden = !has; $('notes-editor').hidden = false;
    if (has) {
      render($('notes-view'), n.tidy, n.raw);
      $('notes-at').textContent = n.at ? 'Saved ' + new Date(n.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    }
    text.value = ''; pending = null; $('notes-preview').hidden = true;
  }
  // same heading → items join it; new headings go at the end
  function merge(a, b) {
    var out = a && a.sections ? JSON.parse(JSON.stringify(a.sections)) : [];
    (b && b.sections || []).forEach(function (sec) {
      var hit = out.filter(function (o) { return (o.heading || '').toLowerCase() === (sec.heading || '').toLowerCase(); })[0];
      if (hit) sec.items.forEach(function (i) { if (hit.items.indexOf(i) < 0) hit.items.push(i); });
      else out.push(sec);
    });
    return out.length ? { sections: out } : null;
  }
  function save(tidy) {
    var raw = text.value.trim(), body;
    if (editingSaved) body = { raw: raw, tidy: tidy || null };
    else {
      var prev = saved || {};
      var newTidy = tidy || (prev.tidy && raw ? { sections: [{ heading: 'Notes', items: [raw] }] } : null);
      body = { raw: [prev.raw, raw].filter(Boolean).join('\n\n'), tidy: newTidy ? merge(prev.tidy, newTidy) : (prev.tidy || null) };
    }
    say('Saving…');
    return fetch(base + '/notes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
      .then(function (n) { pending = null; $('notes-preview').hidden = true; say(''); showSaved(n); })
      .catch(function (e) { say((e && e.error) ? "Couldn't save: " + e.error + '.' : "Couldn't save. Check your connection.", true); });
  }
  var buttons = ['notes-tidy', 'notes-addjob', 'notes-save', 'notes-save-tidy', 'notes-discard', 'notes-edit'].map($);
  function busy(on) { buttons.forEach(function (b) { b.disabled = on; }); }
  // One job, word for word: no AI, nothing to phrase.
  $('notes-addjob').addEventListener('click', function () {
    var t = text.value.trim();
    if (!t) { say('Write the job first.', true); return; }
    if (t.length > 300) { say('A job is limited to 300 characters. Use Tidy up for longer notes.', true); return; }
    if (!window.hubTodos) return;
    busy(true); say('Adding…');
    window.hubTodos.add([t]).then(function (n) {
      text.value = ''; editingSaved = false;
      say(n ? 'Added to Small jobs.' : 'That job is already on the list.');
    }).catch(function () { say("Couldn't add it. Check your connection.", true); })
      .finally(function () { busy(false); });
  });
  // the how-to starts closed; if she opens it, it stays open on this browser
  var how = box.querySelector('.howto');
  try { if (localStorage.getItem('hub-howto') === 'open') how.open = true; } catch (e) {}
  how.addEventListener('toggle', function () { try { localStorage.setItem('hub-howto', how.open ? 'open' : 'closed'); } catch (e) {} });
  box.querySelectorAll('.ex').forEach(function (b) {
    b.addEventListener('click', function () { text.value = b.dataset.fill; text.focus(); say(''); text.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  });
  $('notes-edit').addEventListener('click', function () { editingSaved = true; text.value = (saved && saved.raw) || ''; say('Editing your saved notes: saving replaces them.'); text.focus(); });
  $('notes-save').addEventListener('click', function () {
    if (!text.value.trim() && !editingSaved) { say('Write something first.', true); return; }
    busy(true); save(null).finally(function () { busy(false); });
  });
  // Saving the tidy version: its jobs go onto the Small jobs list first, the rest stays in the notes.
  $('notes-save-tidy').addEventListener('click', function () {
    var jobs = (pending && pending.small_jobs) || [];
    var rest = pending && pending.sections && pending.sections.length ? { sections: pending.sections } : null;
    var changes = (pending && pending.job_changes) || [];
    busy(true);
    var H = window.hubTodos, changed = 0;
    var step = H ? H.apply(changes).then(function (n) { changed = n; return jobs.length ? H.add(jobs) : 0; }) : Promise.resolve(0);
    step.then(function (added) {
      var msg = [];
      if (changed) msg.push(changed + (changed === 1 ? ' change' : ' changes'));
      if (added) msg.push(added + (added === 1 ? ' new job' : ' new jobs'));
      var done = function () { if (msg.length) say(msg.join(' and ') + ' saved to Small jobs.'); };
      if (!rest && !editingSaved) { text.value = ''; pending = null; $('notes-preview').hidden = true; done(); return; }
      return save(rest).then(done);
    }).catch(function (e) { say((e && e.error) ? "Couldn't update Small jobs: " + e.error + '.' : "Couldn't update Small jobs. Check your connection.", true); })
      .finally(function () { busy(false); });
  });
  $('notes-discard').addEventListener('click', function () { pending = null; $('notes-preview').hidden = true; text.focus(); });
  $('notes-tidy').addEventListener('click', function () {
    if (!text.value.trim()) { say('Write something first.', true); return; }
    busy(true); say('Tidying… this takes a few seconds.');
    fetch(base + '/tidy', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.value, jobs: window.hubTodos ? window.hubTodos.list() : [] }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
      .then(function (t) {
        pending = t;
        var jl = $('notes-preview-jobs-list'); jl.innerHTML = '';
        var cur = {}; (window.hubTodos ? window.hubTodos.list() : []).forEach(function (j) { cur[j.id] = j.text; });
        var VERB = { edit: 'Change', 'delete': 'Delete', done: 'Mark done', undone: 'Reopen' };
        function line(verb, a, b) {
          var li = document.createElement('li'), v = document.createElement('b'); v.textContent = verb + ': '; li.appendChild(v);
          li.appendChild(document.createTextNode(a));
          if (b) { var to = document.createElement('span'); to.className = 'notes__to'; to.textContent = ' → ' + b; li.appendChild(to); }
          jl.appendChild(li);
        }
        (t.job_changes || []).forEach(function (c) { line(VERB[c.action] || c.action, cur[c.id] || c.id, c.action === 'edit' ? c.text : ''); });
        (t.small_jobs || []).forEach(function (j) { line('Add', j); });
        $('notes-preview-jobs').hidden = !jl.children.length;
        render($('notes-preview-view'), t.sections && t.sections.length ? { sections: t.sections } : null);
        $('notes-preview').hidden = false; say('');
      })
      .catch(function (e) {
        var m = e && e.error;
        say(m === 'not set up' ? 'Tidy up isn\'t switched on yet. Save as a note for now.' : m ? "Couldn't tidy: " + m + '.' : "Couldn't tidy. Check your connection.", true);
      })
      .finally(function () { busy(false); });
  });
  fetch(base + '/notes', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(showSaved)
    .catch(function () { buttons.forEach(function (b) { b.disabled = true; }); text.disabled = true; say('Notes load when this page is opened from the live site.', true); });
})();

  // Photos: shrunk on the phone to ~1600 px JPEG (fast on mobile data, and the re-encode drops the
// phone's location data), stored behind the client's key (functions/delivery/[client]/photos.js).
(function () {
  var input = document.getElementById('photo-input'); if (!input) return;
  var root = document.querySelector('[data-client-box]');
  var base = ((root && root.getAttribute('data-client-box')) || location.pathname.replace(/\/$/, '')) + '/photos';
  var wrap = document.getElementById('photos'), grid = document.getElementById('photos-grid'), status = document.getElementById('notes-status');
  function say(t, bad) { status.textContent = t || ''; status.classList.toggle('bad', !!bad); }
  function day(iso) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function paint(list) {
    grid.innerHTML = ''; wrap.hidden = !list.length;
    list.forEach(function (p) {
      var li = document.createElement('li'); li.className = 'photo'; li.dataset.id = p.id;
      var a = document.createElement('a'); a.href = base + '/' + p.id; a.target = '_blank'; a.rel = 'noopener';
      var img = document.createElement('img'); img.src = base + '/' + p.id; img.alt = 'Photo added ' + day(p.at); img.loading = 'lazy';
      a.appendChild(img); li.appendChild(a);
      var meta = document.createElement('span'); meta.className = 'photo__at'; meta.textContent = day(p.at); li.appendChild(meta);
      var del = document.createElement('button'); del.type = 'button'; del.className = 'photo__del'; del.textContent = '×'; del.setAttribute('aria-label', 'Delete this photo'); li.appendChild(del);
      grid.appendChild(li);
    });
  }
  function shrink(file) {
    var MAX = 1600;
    if (!window.createImageBitmap) return Promise.resolve({ blob: file, w: 0, h: 0 });
    return createImageBitmap(file).then(function (bmp) {
      var k = Math.min(1, MAX / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
      var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      return new Promise(function (res) { c.toBlob(function (b) { res({ blob: b, w: w, h: h }); }, 'image/jpeg', 0.82); });
    });
  }
  function upload(file) {
    return shrink(file).then(function (r) {
      if (!r.blob) throw { error: "couldn't read that photo" };
      return fetch(base, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': r.blob.type || 'image/jpeg', 'X-Photo-Width': String(r.w), 'X-Photo-Height': String(r.h) }, body: r.blob })
        .then(function (res) { return res.json().then(function (j) { if (!res.ok) throw j; return j; }); });
    });
  }
  input.addEventListener('change', function () {
    var files = [].slice.call(input.files || []); input.value = '';
    if (!files.length) return;
    var i = 0, failed = 0;
    (function next() {
      if (i >= files.length) { say(failed ? (files.length - failed) + ' added, ' + failed + " couldn't be added." : (files.length === 1 ? 'Photo added.' : files.length + ' photos added.'), !!failed); return; }
      say('Uploading ' + (i + 1) + ' of ' + files.length + '…');
      upload(files[i++]).then(paint).catch(function () { failed++; }).then(next);
    })();
  });
  grid.addEventListener('click', function (e) {
    var li = e.target.closest('.photo'); if (!li) return;
    if (e.target.closest('.photo__del')) {
      var open = li.querySelector('.photo__confirm'); grid.querySelectorAll('.photo__confirm').forEach(function (c) { c.remove(); });
      if (open) return;
      var bar = document.createElement('div'); bar.className = 'photo__confirm';
      bar.innerHTML = '<button type="button" class="cbtn cbtn--yes">Delete</button><button type="button" class="cbtn cbtn--no">Cancel</button>';
      li.appendChild(bar); return;
    }
    if (e.target.closest('.cbtn--no')) { e.target.closest('.photo__confirm').remove(); return; }
    if (e.target.closest('.cbtn--yes')) {
      e.target.disabled = true; say('Deleting…');
      fetch(base, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: li.dataset.id, deleted: true }) })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (l) { paint(l); say('Photo deleted.'); })
        .catch(function () { say("Couldn't delete the photo. Check your connection.", true); });
    }
  });
  fetch(base, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(paint).catch(function () {});
})();
