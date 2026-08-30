# Hebrew Transliterator

This repository contains the public Hebrew transliteration application for `HebrewTransliterator.com` and its automated quality checks. The experimental Bible parser and its proprietary data are maintained locally and are intentionally excluded from this repository.

## Project Layout

```text
site/       Public browser application and transliteration rulesets
tests/      Transliterator and corpus regression tests
scripts/    Transliterator-specific audit and fixture-generation tools
docs/       Transliteration specification
```

Only `site/` is published as browser assets. `worker/` contains the server-side
entry point used for privacy-safe anonymous event counts, feedback email, and
Azure audio generation.

Sefaria search, reference validation, and text retrieval run directly in the
visitor's browser. The application does not proxy Sefaria text through the
Worker. Successful Sefaria responses are kept in a small in-memory cache for up
to 10 minutes (maximum 200 entries) and identical requests already in progress
are shared. The cache is cleared whenever the page is reloaded or closed; it is
not stored in cookies, browser storage, or on the server. Failed requests are
never cached.

If a Sefaria request takes more than five seconds, the busy message tells the
visitor that Sefaria is responding slowly. Requests still use the existing
nine-second timeout, after which the visitor is told to try again in a few
minutes. Other Sefaria errors, including request throttling, produce the same
clear retry guidance.

## Run the Public Application Locally

Serve the repository root with a local HTTP server and open `/site/index.html`.

## Deployment

Cloudflare Workers Static Assets publishes the contents of `site/`, while the
Worker handles `/api/event`, feedback, and Azure Speech requests. Unchanged
Sefaria passages reuse audio stored in Cloudflare R2 under a versioned SHA-256
content key. Audio for pasted or edited Hebrew is returned without persistent
storage. Tests and development tools remain outside the deployment. The local
Bible parser, MorphHB corpus, generated reports, and unrelated scripts and
tests are excluded from Git entirely.

Cloudflare Web Analytics measures aggregate visits and performance without an
application account or persistent user identifier. Cloudflare Analytics Engine
product events include geographic fields Cloudflare derives from the request,
but never include IP addresses, pasted Hebrew, transliteration output, or raw
Sefaria search terms. After a visitor grants Analytics consent, Google Analytics
measures users and sessions and receives normalized searches submitted through
the dedicated Sefaria name/phrase search control. Successful Sefaria imports
and audio generation, listening, and downloads are recorded as consent-controlled
virtual page views organized by Sefaria reference. Arbitrary Hebrew is labeled
only as such; Google Analytics never receives the Hebrew transliteration input
or output. The Analytics Engine column map, virtual page paths, and example
queries are documented in `docs/ANALYTICS_SCHEMA.md`.

Cloudflare's deploy command is:

```powershell
npx wrangler deploy
```

## Test

Run the transliterator and audit tests:

```powershell
node --test tests\*.test.js
```

The deployment roadmap is maintained in `DEPLOYMENT_PLAN.md`.

The evidence-based Lev Shalem conventions derived from the supplied siddur
excerpts are documented in `docs/LEV_SHALEM_STYLE_GUIDE.md`.
