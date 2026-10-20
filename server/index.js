// client-box · server library. One function makes the five handlers a site mounts behind its own
// access check: jobs, notes, tidy (Claude), photos (list / upload / delete) and one photo.
//
//   import { createClientBox } from '<package>/server/index.js';
//   const box = createClientBox({
//     store: env.CLIENT_STATE,            // a Cloudflare KV namespace (one per site: content never crosses sites)
//     scope: 'sandra',                    // whose box: every key is prefixed with it
//     anthropicKey: env.ANTHROPIC_API_KEY, // optional; without it Tidy up answers "not set up"
//     about: { writer: 'Sandra', reader: 'Raymesh', work: '…' } // optional: who writes, who reads, what about (for Tidy up)
//   });
//   return box.todos(request);            // or box.notes / box.tidy / box.photos / box.photo(request, id)
//
// The site decides who may call these (a key link, a cookie, a password): the library trusts the
// caller. Every handler returns a Response. Nothing here knows about any site.
import { tidyWithClaude } from './tidy.js';

const ID = /^[a-z0-9-]{1,64}$/;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const today = () => new Date().toISOString().slice(0, 10);
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// A tidy version is headings, each with a short list; anything else is dropped.
export const cleanTidy = (t) => {
  if (!t || !Array.isArray(t.sections)) return null;
  const sections = t.sections.slice(0, 20).map((s) => ({
    heading: String(s?.heading ?? '').slice(0, 120),
    items: (Array.isArray(s?.items) ? s.items : []).slice(0, 50).map((i) => String(i).slice(0, 500)).filter(Boolean),
  })).filter((s) => s.heading || s.items.length);
  return sections.length ? { sections } : null;
};

export function createClientBox({ store, scope, anthropicKey, about, limits = {} }) {
  if (!ID.test(String(scope || ''))) throw new Error('client-box: scope must be lowercase letters, digits and dashes');
  const L = { maxState: 300, maxExtra: 100, maxJobText: 300, maxNotes: 6000, maxPhotos: 150, maxPhotoBytes: 4 * 1024 * 1024, tidiesPerDay: 40, ...limits };
  const key = (k) => `${k}:${scope}`;
  const need = () => (store ? null : json({ error: 'storage not bound' }, 503));
  const body = async (request) => { try { return await request.json(); } catch { return undefined; } };

  // ---- jobs: GET → { state, extra } · POST { id, done } · { id, deleted: true } · { id, action: 'edit', text }
  //      · { add: [...] } · { changes: [{ action, id, text }] }   (state: { <id>: { done, deleted, text, at } })
  async function todos(request) {
    const missing = need(); if (missing) return missing;
    const state = JSON.parse((await store.get(key('todos'))) || '{}');
    let extra = JSON.parse((await store.get(key('todos-extra'))) || '[]');
    if (request.method === 'GET') return json({ state, extra });
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    const b = await body(request); if (b === undefined) return json({ error: 'bad json' }, 400);

    if (Array.isArray(b?.add)) {
      const have = new Set(extra.map((e) => norm(e.text)));
      let n = 0;
      for (const raw of b.add.slice(0, 30)) {
        const text = String(raw ?? '').trim().slice(0, L.maxJobText);
        if (!text || have.has(norm(text))) continue;
        if (extra.length >= L.maxExtra) return json({ error: 'too many jobs' }, 400);
        have.add(norm(text));
        extra.push({ id: `n-${Date.now().toString(36)}-${(n++).toString(36)}`, text, added: today() });
      }
      await store.put(key('todos-extra'), JSON.stringify(extra));
      return json({ state, extra });
    }

    const extraIds = () => new Set(extra.map((e) => e.id));
    const apply = (c) => {
      const id = String(c?.id ?? '');
      if (!ID.test(id)) return 'bad input';
      if (!(id in state) && !extraIds().has(id) && Object.keys(state).length >= L.maxState) return 'full';
      const isExtra = extraIds().has(id);
      if (c.action === 'delete' || c.deleted === true) {
        if (isExtra) { extra = extra.filter((e) => e.id !== id); delete state[id]; }
        else state[id] = { ...(state[id] || {}), deleted: true, at: today() };
      } else if (c.action === 'edit' || (typeof c.text === 'string' && c.action === undefined)) {
        const text = String(c.text ?? '').trim().slice(0, L.maxJobText);
        if (!text) return 'empty text';
        if (isExtra) extra = extra.map((e) => (e.id === id ? { ...e, text } : e));
        else state[id] = { ...(state[id] || {}), text, at: today() };
      } else if (c.action === 'done' || c.action === 'undone' || typeof c.done === 'boolean') {
        const done = c.action ? c.action === 'done' : c.done;
        state[id] = { ...(state[id] || {}), done, at: today() };
      } else return 'bad input';
      return null;
    };
    if (Array.isArray(b?.changes)) { for (const c of b.changes.slice(0, 30)) { const err = apply(c); if (err) return json({ error: err }, 400); } }
    else { const err = apply(b || {}); if (err) return json({ error: err }, 400); }
    await store.put(key('todos-extra'), JSON.stringify(extra));
    await store.put(key('todos'), JSON.stringify(state));
    return json({ state, extra });
  }

  // ---- notes: GET → { raw, tidy, at } · POST { raw, tidy }
  async function notes(request) {
    const missing = need(); if (missing) return missing;
    if (request.method === 'GET') return json(JSON.parse((await store.get(key('notes'))) || '{"raw":"","tidy":null,"at":null}'));
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    const b = await body(request); if (b === undefined) return json({ error: 'bad json' }, 400);
    const raw = typeof b?.raw === 'string' ? b.raw : '';
    if (raw.length > L.maxNotes) return json({ error: `notes are limited to ${L.maxNotes} characters` }, 400);
    const saved = { raw, tidy: cleanTidy(b?.tidy), at: new Date().toISOString() };
    await store.put(key('notes'), JSON.stringify(saved));
    return json(saved);
  }

  // ---- tidy: POST { text, jobs: [{ id, text, done }] } → { job_changes, small_jobs, sections }
  async function tidy(request) {
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    if (!anthropicKey) return json({ error: 'not set up' }, 503);
    const b = await body(request); if (b === undefined) return json({ error: 'bad json' }, 400);
    const text = typeof b?.text === 'string' ? b.text.trim() : '';
    if (!text) return json({ error: 'nothing to tidy' }, 400);
    if (text.length > L.maxNotes) return json({ error: `notes are limited to ${L.maxNotes} characters` }, 400);
    const jobs = (Array.isArray(b?.jobs) ? b.jobs : []).slice(0, 150)
      .map((j) => ({ id: String(j?.id ?? ''), text: String(j?.text ?? '').slice(0, 300), done: !!j?.done }))
      .filter((j) => ID.test(j.id) && j.text);
    if (store) {
      const day = key(`tidy:${today()}`);
      const used = Number((await store.get(day)) || 0);
      if (used >= L.tidiesPerDay) return json({ error: 'daily limit reached' }, 429);
      await store.put(day, String(used + 1), { expirationTtl: 2 * 24 * 3600 });
    }
    const out = await tidyWithClaude({ apiKey: anthropicKey, text, jobs, about });
    if (out.error) return json({ error: out.error }, out.status || 502);
    const known = new Set(jobs.map((j) => j.id)), seen = new Set();
    const job_changes = out.job_changes
      .filter((c) => known.has(c.id) && (c.action !== 'edit' || c.text))
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
    const sectionsTidy = cleanTidy({ sections: out.sections });
    const small_jobs = out.small_jobs.slice(0, 30).map((j) => j.slice(0, L.maxJobText));
    if (!sectionsTidy && !small_jobs.length && !job_changes.length) return json({ error: 'could not tidy these notes' }, 502);
    return json({ job_changes, small_jobs, sections: sectionsTidy ? sectionsTidy.sections : [] });
  }

  // ---- photos: GET → [{ id, w, h, type, size, at }] · POST image bytes · POST { id, deleted: true }
  const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  async function photos(request) {
    const missing = need(); if (missing) return missing;
    let list = JSON.parse((await store.get(key('photos'))) || '[]');
    if (request.method === 'GET') return json(list);
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (type === 'application/json') {
      const b = await body(request); if (b === undefined) return json({ error: 'bad json' }, 400);
      const id = String(b?.id ?? '');
      if (!ID.test(id) || b.deleted !== true) return json({ error: 'bad input' }, 400);
      list = list.filter((p) => p.id !== id);
      await store.delete(key(`photo:${id}`));
      await store.put(key('photos'), JSON.stringify(list));
      return json(list);
    }
    if (!TYPES.includes(type)) return json({ error: 'only JPEG, PNG or WebP photos' }, 415);
    if (list.length >= L.maxPhotos) return json({ error: 'too many photos' }, 400);
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return json({ error: 'empty photo' }, 400);
    if (bytes.byteLength > L.maxPhotoBytes) return json({ error: 'photo too large' }, 413);
    const dim = (h) => Math.max(0, Math.min(10000, parseInt(request.headers.get(h) || '0', 10) || 0));
    const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await store.put(key(`photo:${id}`), bytes, { metadata: { type } });
    list.unshift({ id, w: dim('X-Photo-Width'), h: dim('X-Photo-Height'), type, size: bytes.byteLength, at: new Date().toISOString() });
    await store.put(key('photos'), JSON.stringify(list));
    return json(list);
  }

  // ---- one photo: GET → the bytes
  async function photo(request, id) {
    id = String(id || '');
    if (!store || !ID.test(id)) return new Response('Not found', { status: 404 });
    const { value, metadata } = await store.getWithMetadata(key(`photo:${id}`), 'arrayBuffer');
    if (!value) return new Response('Not found', { status: 404 });
    return new Response(value, { headers: { 'Content-Type': metadata?.type || 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
  }

  // route(request, path): mounts all five under one base path, e.g. route(request, '/photos/p-abc')
  async function route(request, path) {
    const p = String(path || '').replace(/^\/+|\/+$/g, '');
    if (p === 'todos') return todos(request);
    if (p === 'notes') return notes(request);
    if (p === 'tidy') return tidy(request);
    if (p === 'photos') return photos(request);
    const m = p.match(/^photos\/([a-z0-9-]+)$/);
    if (m) return request.method === 'GET' ? photo(request, m[1]) : json({ error: 'method' }, 405);
    return json({ error: 'not found' }, 404);
  }

  return { todos, notes, tidy, photos, photo, route };
}
