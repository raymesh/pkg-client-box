// client-box · renders the box's HTML as a string, for a page a server function writes (and for
// the Astro component, which calls the same function). Plain template literals; every piece of
// site data is escaped. The script (client-box.js) and styles (client-box.css) are separate files.
import { STRINGS } from './strings.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = (iso, lang) => new Date(iso + 'T12:00:00').toLocaleDateString(lang === 'es' ? 'es-PR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// jobs: the site's own fixed jobs [{ id, text, added, tags?: [{ label, accent? }] }]; jobs added on
// the page come from the server at runtime. base: where the endpoints live, e.g. '/delivery/sandra'.
export function renderClientBox({ base, lang = 'en', jobs = [], strings = {} }) {
  const S = { ...(STRINGS[lang] || STRINGS.en), ...strings };
  const job = (t) => `
    <li class="todo" data-id="${esc(t.id)}">
      <label><input type="checkbox" disabled /><span class="todo__text">${esc(t.text)}</span></label>
      <button type="button" class="todo__ed" aria-label="${esc(S.edit)}: ${esc(t.text)}" title="${esc(S.edit)}" disabled>✎</button>
      <button type="button" class="todo__del" aria-label="×: ${esc(t.text)}" title="×" disabled>×</button>
      <span class="todo__meta">${(t.tags || []).map((g) => `<span class="tag${g.accent ? ' tag--owner' : ''}">${esc(g.label)}</span>`).join('')}<span class="mono">${esc(S.added)} ${esc(day(t.added, lang))}</span><span class="mono done-on"></span></span>
    </li>`;
  const how = S.h.map((h) => `
        <div><dt>${esc(h.t)}</dt><dd>${h.d}${h.ex.map((e) => `<button type="button" class="ex" data-fill="${esc(e)}">${esc(e)}</button>`).join('')}</dd></div>`).join('');
  return `<div class="client-box" data-client-box="${esc(base)}" data-lang="${esc(lang)}">
  <section>
    <h2>${esc(S.jobs)}</h2>
    <p class="note" id="todo-note">${esc(S.jobsHint)}</p>
    <p class="none" id="todos-none" hidden>${esc(S.none)}</p>
    <ul class="todos" id="todos">${jobs.map(job).join('')}
    </ul>
  </section>
  <section class="notes-box" id="notes">
    <h2>${esc(S.title)}</h2>
    <p class="note">${S.intro}</p>
    <details class="howto">
      <summary>${esc(S.howto)}</summary>
      <p class="howto__tap">${esc(S.tap)}</p>
      <dl class="howto__list">${how}
      </dl>
    </details>
    <div class="notes__edit" id="notes-editor">
      <textarea id="notes-text" rows="5" maxlength="6000" placeholder="${esc(S.placeholder)}"></textarea>
      <p class="notes__actions">
        <button type="button" class="nbtn nbtn--main" id="notes-tidy">${esc(S.tidy)}</button>
        <button type="button" class="nbtn" id="notes-addjob">${esc(S.addJob)}</button>
        <button type="button" class="nbtn" id="notes-save">${esc(S.saveNote)}</button>
        <label class="nbtn nbtn--photo" for="photo-input">${esc(S.addPhotos)}</label>
        <span class="notes__status" id="notes-status" role="status"></span>
      </p>
      <div class="notes__preview" id="notes-preview" hidden>
        <p class="notes__label">${esc(S.tidied)}</p>
        <div class="notes__jobs" id="notes-preview-jobs" hidden><h3>${esc(S.changes)}</h3><ul id="notes-preview-jobs-list"></ul></div>
        <div id="notes-preview-view"></div>
        <p class="notes__actions">
          <button type="button" class="nbtn nbtn--main" id="notes-save-tidy">${esc(S.saveThis)}</button>
          <button type="button" class="nbtn" id="notes-discard">${esc(S.keepEditing)}</button>
        </p>
      </div>
    </div>
    <input type="file" id="photo-input" accept="image/*" multiple hidden />
    <div class="notes__saved" id="notes-saved" hidden>
      <h3>${esc(S.yourNotes)}</h3>
      <div id="notes-view"></div>
      <p class="notes__meta"><span id="notes-at"></span> <button type="button" class="nbtn" id="notes-edit">${esc(S.edit)}</button></p>
    </div>
    <div class="photos" id="photos" hidden>
      <h3>${esc(S.photos)}</h3>
      <ul class="photos__grid" id="photos-grid"></ul>
    </div>
  </section>
</div>`;
}
