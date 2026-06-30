# Portfolio Content

Sanitized, publishable source content for the YBF Studios portfolio.

This repository contains public case-study narratives and evidence records. It must not contain private source code, credentials, personal messages, local filesystem paths, or unpublished financial results.

## Commands

- `npm run validate` — compile in memory and run schema, evidence, privacy, and integrity checks.
- `npm run compile` — write deterministic `dist/portfolio.json` and `dist/portfolio.sha256`.
- `npm run affected -- --before <sha> --after <sha>` — derive the content routes affected by a commit range.

Any narrative, ownership, evidence, metric, media, or publication-status change requires human review. Deterministic repository metadata may be automated only through an allowlisted workflow.
