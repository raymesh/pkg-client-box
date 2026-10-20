# client-box

The "Small jobs" + "Add & update" + photos box from Sandra's hub on raymesh.com, as one package
any site can mount. **One copy of the code; each site keeps its own content.**

- A client ticks jobs, edits their wording (✎), deletes them (×, with an in-row confirm).
- A text box: **Add as a small job** (word for word), **Tidy up** (Claude sorts jobs, changes like
  "change X to Y" / "X is done", questions and dates; the client checks before saving),
  **Save as a note**, **Add photos** (shrunk to 1600 px on the phone, which drops location data).
- English or Spanish (`lang`). Phone first; no build step on the page side.

## How it's shared

This repo is pulled into each site as a **git submodule** at `vendor/client-box`. An improvement
is a commit here; a site takes it with `git submodule update --remote vendor/client-box`, then
commits and pushes. No registry, no tokens. (It can become an npm package later; the `exports`
map is already in place.)

Content never lives here. Each site has its own Cloudflare KV namespace bound as `CLIENT_STATE`;
inside it every key is prefixed with the box's `scope` (`todos:sandra`, `photos:sandra`).

## Install in a site (Astro on Cloudflare Pages)

1. `git submodule add git@github.com:raymesh/pkg-client-box.git vendor/client-box`
   and `npm install @anthropic-ai/sdk` (only needed for Tidy up).
2. A KV namespace for the site, bound as `CLIENT_STATE` on the Pages project
   (`wrangler kv namespace create <site>-client-state`, then bind it in the Pages settings or
   `wrangler.toml`). For Tidy up, the `ANTHROPIC_API_KEY` secret.
3. **Endpoints.** One Pages Function that owns the path under the page, after the site's own
   access check (a key cookie, a password, whatever the site uses):

   ```js
   // functions/delivery/[client]/[[path]].js
   import { createClientBox } from '../../../vendor/client-box/server/index.js';
   export async function onRequest({ request, params, env }) {
     if (!allowed(request, params.client)) return new Response('Unauthorized', { status: 401 }); // the site's rule
     const box = createClientBox({ store: env.CLIENT_STATE, scope: params.client, anthropicKey: env.ANTHROPIC_API_KEY,
       about: { writer: 'Sandra', reader: 'Raymesh', work: 'lighting, carpentry, small jobs around her salon' } });
     return box.route(request, (params.path || []).join('/'));
   }
   ```
   `box.route` serves `todos`, `notes`, `tidy`, `photos`, `photos/<id>`; or call `box.todos(request)` etc. one by one.
4. **The page.** In an Astro page:
   ```astro
   import ClientBox from '../../vendor/client-box/astro/ClientBox.astro';
   <ClientBox base="/delivery/sandra" lang="en" jobs={client.todos.map((t) => ({ id: t.id, text: t.text, added: t.added, tags: [...] }))} />
   ```
   In a page a function writes (plain HTML): `renderClientBox({ base, lang, jobs })` from
   `html/render.js` for the markup, plus `<link rel="stylesheet" href="…/client-box.css">` and
   `<script src="…/client-box.js">` served from the site's `public/`.

`jobs` are the site's own fixed jobs (from a data file); jobs the client adds live in KV. A fixed
job the client deletes is hidden (the data file keeps it until the site removes the line).

## Files

- `server/index.js` — `createClientBox({ store, scope, anthropicKey, about, limits })` → `{ todos, notes, tidy, photos, photo, route }`.
- `server/tidy.js` — the Claude call (Opus 5.5, low effort, structured output, server-side fallback on refusals).
- `html/render.js` — the markup as a string; `html/strings.js` — every word, `en` and `es`.
- `html/client-box.js` — the page script; `html/client-box.css` — the styles (use the host's tokens when present).
- `astro/ClientBox.astro` — the component: markup + styles + script.

## Testing a site

Cloudflare's local runtime: `wrangler pages dev dist --kv CLIENT_STATE` after the site's build.
Then on the page at phone size: tick, edit, delete a job; Add as a small job; Save as a note;
Tidy up (needs a key in `.dev.vars`); upload and delete a photo; reload and check it all stuck.
