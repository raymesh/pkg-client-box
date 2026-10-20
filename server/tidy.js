// The "Tidy up" call to Claude. Takes the free text plus the jobs list as the client sees it,
// returns { job_changes, small_jobs, sections } or { error, status }. The prompt is a template:
// `about` says whose notes these are and what the work is, so the same package fits a salon
// client and a production team. Uses the Anthropic SDK; the site installs @anthropic-ai/sdk.
import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_ABOUT = {
  writer: 'the client', // who writes: "Sandra", "el equipo"
  reader: 'the person doing the work', // who reads: "Raymesh"
  work: 'projects and small jobs', // what it is about: "lighting, carpentry, small jobs around her salon and home"
};

const system = (a) => `You tidy up notes that ${a.writer} writes for ${a.reader}, about ${a.work}.
Sort the free-form text into three places:
- job_changes: changes asked for to jobs already on the Small jobs list (listed below with their ids): "edit" with the new full wording, "delete", "done" (finished) or "undone" (reopen). Use only ids from that list; when the wording does not clearly match one job, leave it out.
- small_jobs: NEW concrete fixes or tasks to be done (not ones already on the list) (something that needs repair, installing, adjusting, buying). One short item each.
- sections: everything else (bigger projects, questions for ${a.reader}, ideas, dates), as a few short sections, each a plain heading with a list of short items. Never make a section called "Small jobs"; those items belong in small_jobs only.
- Keep every fact given: sizes, quantities, places, dates, names, prices, preferences. Do not drop anything.
- Do not add tasks, advice, opinions, prices or details that were not written.
- Group related things. Use headings that fit what was written, for example "Projects", "Questions for ${a.reader}", "Ideas", "Dates". Use only the groups the notes need. A date that belongs to a job stays in that job's item.
- One idea per item, in the writer's words where possible, as a short phrase or sentence.
- Write in the same language the writer used; if they mix Spanish and English, keep each item in the language it was written in.`;

const SCHEMA = {
  type: 'object',
  properties: {
    job_changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { action: { type: 'string', enum: ['edit', 'delete', 'done', 'undone'] }, id: { type: 'string' }, text: { type: 'string' } },
        required: ['action', 'id', 'text'],
        additionalProperties: false,
      },
    },
    small_jobs: { type: 'array', items: { type: 'string' } },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { heading: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } },
        required: ['heading', 'items'],
        additionalProperties: false,
      },
    },
  },
  required: ['job_changes', 'small_jobs', 'sections'],
  additionalProperties: false,
};

// A section the model still calls "small jobs" (in either language) is moved to small_jobs.
const JOBS = /^(small jobs?|jobs?|tasks?|to-?dos?|trabajos?( peque[nñ]os)?|trabajitos|tareas|pendientes|arreglos)$/i;

export async function tidyWithClaude({ apiKey, text, jobs, about = {}, model = 'claude-opus-5-5' }) {
  const a = { ...DEFAULT_ABOUT, ...about };
  const listed = jobs.length ? jobs.map((j) => `- ${j.id}: ${j.text}${j.done ? ' (done)' : ''}`).join('\n') : '(the list is empty)';
  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // a declined request is re-run on Anthropic's recommended fallback model
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: system(a),
      messages: [{ role: 'user', content: `The Small jobs list now (id: job):\n${listed}\n\nThe notes:\n\n${text}` }],
    });
    if (response.stop_reason === 'refusal') return { error: 'could not tidy these notes', status: 422 };
    if (response.stop_reason === 'max_tokens') return { error: 'notes too long to tidy', status: 422 };
    const out = response.content.find((b) => b.type === 'text');
    let parsed = null;
    try { parsed = out ? JSON.parse(out.text) : null; } catch {}
    const small_jobs = (Array.isArray(parsed?.small_jobs) ? parsed.small_jobs : []).map((j) => String(j).trim()).filter(Boolean);
    const sections = (Array.isArray(parsed?.sections) ? parsed.sections : []).filter((sec) => {
      if (!JOBS.test(String(sec?.heading ?? '').trim())) return true;
      (Array.isArray(sec?.items) ? sec.items : []).forEach((i) => { const t = String(i).trim(); if (t) small_jobs.push(t); });
      return false;
    });
    const job_changes = (Array.isArray(parsed?.job_changes) ? parsed.job_changes : [])
      .map((c) => ({ action: String(c?.action ?? ''), id: String(c?.id ?? ''), text: String(c?.text ?? '').trim().slice(0, 300) }))
      .filter((c) => ['edit', 'delete', 'done', 'undone'].includes(c.action));
    return { job_changes, small_jobs, sections };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { error: 'busy, try again in a minute', status: 429 };
    if (e instanceof Anthropic.AuthenticationError) return { error: 'not set up', status: 503 };
    if (e instanceof Anthropic.APIError) return { error: 'tidy service error', status: 502 };
    return { error: 'tidy failed', status: 502 };
  }
}
