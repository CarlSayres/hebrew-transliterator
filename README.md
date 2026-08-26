# Hebrew Transliterator

This repository contains the public Hebrew transliteration application for `HebrewTransliterator.com` and its automated quality checks. The experimental Bible parser and its proprietary data are maintained locally and are intentionally excluded from this repository.

## Project Layout

```text
site/       Public browser application and transliteration rulesets
tests/      Transliterator and corpus regression tests
scripts/    Transliterator-specific audit and fixture-generation tools
docs/       Transliteration specification
```

Only `site/` is intended to be published as the static website.

## Run the Public Application Locally

Serve the repository root with a local HTTP server and open `/site/index.html`.

## Deployment

Cloudflare Workers Static Assets publishes only the contents of `site/`, as
configured in `wrangler.jsonc`. Tests and development tools remain in the
private repository and are not part of the deployed website. The local Bible
parser, MorphHB corpus, generated reports, and unrelated scripts and tests are
excluded from Git entirely.

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
