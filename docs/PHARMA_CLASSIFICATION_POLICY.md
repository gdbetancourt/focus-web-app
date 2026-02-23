# Pharma Classification Policy (Definitive)

This document defines how pharma companies are classified and exposed across Focus.

## Canonical Modes

- `official`: Canonical company classification curated in the Companies domain.  
  This is the source of truth for business reporting and segmentation.
- `detected`: Algorithmic or inferred pharma candidates that are not yet promoted to canonical classification.
- `all`: Union of `official` and `detected`.

## API Contract

For pharma pipelines endpoints, use:

- `classification_mode=official|detected|all`

Compatibility bridge (legacy clients):

- `include_detected=true` maps to `classification_mode=all`
- default remains `classification_mode=official`

## UI Semantics

- Companies section should map to `official` by default.
- Pharma Pipelines can switch mode (`official`, `detected`, `all`) explicitly.
- When mode is `all`, rows must show the source badge (`Official` or `Detected`).

## Long-Term Governance

- No hidden exclusions by merge flags at query level for the pharma classification source.
- Merge lifecycle should be resolved in canonical company logic, not with ad-hoc filters in pipelines.
- Promotion flow:
  1. Candidate appears as `detected`.
  2. Ops/analyst validates.
  3. Candidate is promoted to `official`.
  4. Reporting relies on `official` unless explicitly requesting `all`.

