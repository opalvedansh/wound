# ANTIGRAVITY PROJECT RULES

## Source of Truth

Always read:
- `prd.md`
- `phase.md`
- `techspec.md`

## Ask Instead of Assuming

When a requirement is missing, ambiguous, conflicting, or undecided:

**ASK THE USER.**

Never invent a requirement or technical decision.

## Client ML/CV Model

The ML/CV model is supplied by the client.

Engineering owns integration, not model creation/training.

Always ask for:
- model package/endpoint
- model runtime
- input contract
- output contract
- versioning information
- validation information

when missing.

## Clinical

Never invent clinical rules, classifications, scores, treatment guidance, or medical claims.

## Scope

Stay inside the active phase.

Do not implement roadmap features without approval.

## Security

Never:
- log patient identifiers
- commit secrets
- expose images publicly
- disable TLS
- bypass auth
- weaken access controls

## Engineering Quality

Every meaningful change must be:
- tested
- typechecked
- linted
- built
- reviewed

UI changes should receive browser/device verification where appropriate.

## Reporting

At the end of every task report:
- summary
- files changed
- tests
- verification
- unresolved questions
- known limitations
