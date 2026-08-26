# Hebrew Transliterator

This repository contains the public Hebrew transliteration application for `HebrewTransliterator.com` and its automated quality checks. The experimental Bible parser and its proprietary data are maintained locally and are intentionally excluded from this repository.

## Project Layout

```text
site/       Public browser application and transliteration rulesets
tests/      Transliterator and corpus regression tests
scripts/    Transliterator-specific audit and fixture-generation tools
docs/       Transliteration specification
```

Only `site/` is published as browser assets. `worker/` contains the small
server-side entry point used for privacy-safe anonymous event counts.

## Run the Public Application Locally

Serve the repository root with a local HTTP server and open `/site/index.html`.

## Deployment

Cloudflare Workers Static Assets publishes the contents of `site/`, while the
Worker handles `/api/event` and writes whitelisted anonymous event names to
Workers Analytics Engine. Tests and development tools remain outside the
deployment. The local Bible parser, MorphHB corpus, generated reports, and
unrelated scripts and tests are excluded from Git entirely.

Cloudflare Web Analytics measures aggregate visits and performance without an
application account or persistent user identifier. Cloudflare Analytics Engine
product events include geographic fields Cloudflare derives from the request,
but never include IP addresses, pasted Hebrew, transliteration output, or raw
Sefaria search terms. After a visitor grants Analytics consent, Google Analytics
measures users and sessions and receives normalized searches submitted through
the dedicated Sefaria name/phrase search control. It never receives the Hebrew
transliteration input or output. The Analytics Engine column map and example
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
