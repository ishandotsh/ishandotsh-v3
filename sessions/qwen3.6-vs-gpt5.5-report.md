# ishan.sh build-off — Qwen3.6-27B (local) vs GPT-5.5

## [GENERATED - Claude Opus 4.6]

Same `PLAN.md`, same target site, two agents. Qwen3.6 ran locally
(`unsloth/Qwen3.6-27B-GGUF:Q4_K_M` via llama.cpp); GPT-5.5 ran via API.
Both produced a working Eleventy site, but the differences in correctness,
output cleanliness, and time-to-completion were stark.

---

## TL;DR

| | Qwen3.6-27B (Q4_K_M) | GPT-5.5 |
|---|---|---|
| Wall time | ~69 min (4143s active+idle) | substantially shorter |
| Output tokens | 46,054 | n/a (remote) |
| Prompt tokens consumed | 277,568 | n/a (remote) |
| Decode rate (start → end) | 28.1 → 16.2 tok/s (-42%) | n/a |
| Visible bugs in artifact | name typo, broken SVG, broken slugs | none observed |
| Template files in `_includes` | 5 (base, page, post, post-card, post-nav) | 3 (base, article, card) |
| Stray files in repo | `README.11tydata.js`, `PLAN.11tydata.js` | none |

The two outputs *look* similar in structure, but Qwen3.6 made several
small mistakes that all share a pattern: it generated plausible-looking
content from imagination instead of grounding in either the plan or
existing files.

---

## Performance (llama.cpp metrics)

From `agent/logs/experiments/ishandotsh-build-20260503-041404/`:

- **Run length:** 4142s wall (~69 min). 3942s active, 200s idle.
- **Output:** 46,054 tokens generated, 277,568 prompt tokens processed.
- **Prompt:processed-output ratio: ~6:1.** That's the "kept re-reading
  long files" symptom — every step re-shipped a lot of context to the
  model rather than relying on a working memory of what it had already
  seen.
- **Decode rate degraded over the run:**
  - First sample: 28.08 tok/s
  - Final sample: 16.19 tok/s (-42%)
  - First-half average: 23.44 tok/s
  - Second-half average: 17.13 tok/s
  - Min: 16.19, Max: 28.09 (across 403 ten-second samples)

This is exactly the context-window slowdown you flagged: as the KV
cache fills, decode gets cheaper-per-step but slower-per-token, and the
re-prompting of long files makes prompt-eval the dominant cost. By the
back half of the run, throughput is below 60% of the cold-start rate.

---

## Correctness — what each one shipped

### Qwen3.6-27B mistakes

1. **Name typo: "Ischan"** — appears twice in `_data/site.json`
   (`"author": "Ischan"`, `"description": "Personal blog and experiments
   by Ischan"`) and in `about.md` ("Hi, I'm Ischan."). The model
   hallucinated a spelling and never grounded against the directory
   name `ishandotsh-qwen3.6` or the domain `ishan.sh`.

2. **Broken GitHub SVG icon** — the `<path d="...">` in
   `_includes/base.njk` contains the fragment
   `0 0.09 2 .27 1.53-1.04 2.19-.82 2.19-.82` partway through. That's
   not valid path-command syntax (a stray `0` operator with bad arg
   count), so the icon renders as garbage. Classic generative-from-
   memory failure: the model "knew" what a GitHub octocat path looks
   like but couldn't actually reproduce it character-perfect.

3. **Broken `/posts/:slug` route** — `posts/posts.11tydata.js`:

   ```js
   permalink: (data) => {
     ...
     return `/posts/${data.slug || data.title}/`;
   }
   ```

   No slugify on the fallback. If a post lacks an explicit `slug`
   field, the raw title (with spaces, capitals, punctuation) gets
   dropped straight into the URL. GPT-5.5 handled this correctly:

   ```js
   return `/posts/${data.slug || slugify(data.title)}/`;
   ```

4. **Tag slug collapse** — Qwen's tag for "ML/AI" became `mlai`
   (slash dropped entirely, no separator). GPT-5.5 produced `ml-ai`.
   Likely Qwen's slugify regex strips non-alphanum without inserting
   a separator.

5. **Stray files** — unexpected leftovers in the repo:
   `README.11tydata.js`, `PLAN.11tydata.js` (pointless 11ty data files
   attached to docs that don't need front-matter or computed
   permalinks) that wasn't asked for. None of these
   are part of the plan.

6. **Placeholder social link** — `about.md` has
   `https://github.com/` (no username) and `https://x.com/` (no
   handle). GPT-5.5 at least put `github.com/ishan` / `x.com/ishan`
   placeholders that signal "fill this in".

### GPT-5.5

No correctness bugs surfaced from filesystem inspection. Notes:

- Cleaner template factoring: 3 includes (`base`, `article`, `card`)
  versus Qwen's 5 (`base`, `page`, `post`, `post-card`, `post-nav`).
  Qwen split things that didn't need splitting.
- Bundled Fuse.js locally (passthrough-copy from `node_modules`)
  instead of fetching from CDN at runtime — better for offline /
  privacy / reliability.
- Has `.github/` with what's presumably a Pages workflow, plus
  `.eleventyignore`. Qwen has neither.
- Routing logic uses a clean `slugify` helper exported from
  `.eleventy.js` and reused in the data file, so post and experiment
  permalinks share a single implementation.

---

## Behavioral pattern

The slow-and-error-prone failure mode for Qwen3.6 looks like one
underlying cause: **insufficient compression**. It can't hold a useful
abstraction of a file in working memory, so it re-reads files end-to-
end, which:

- inflates prompt tokens (277k of them in this run),
- pushes the context window toward saturation,
- collapses tok/s as the KV cache grows,
- and *still* leaves the model unable to keep facts straight (your
  name, the SVG, the slug fallback) because it never built a stable
  representation in the first place.

GPT-5.5 mostly grounds against the actual files, makes one focused
edit, and moves on. The artifacts show that: smaller `_includes`,
fewer files, no stray docs-with-data-files, no fictional spellings.

