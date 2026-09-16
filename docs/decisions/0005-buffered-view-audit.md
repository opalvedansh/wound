# ADR-0005: View-audit events are written in batches, so a crash can lose up to 2 seconds of them

- **Status:** Accepted. The project owner accepted this risk when approving the M1 plan.
- **Date:** 2026-09-16
- **Takes effect:** T8

## Context

The spec requires an audit trail of who opened which patient records. Views happen far more often than edits. Writing an audit row inside every read would add a database write and extra lock time to every screen load.

Edits are different: each edit's audit row is written in the same transaction as the change, so the two succeed or fail together.

## Decision

- **What's buffered:** views of a patient, a case or a full-size image go into an in-memory buffer, grouped by org.
- **When the buffer is written to `audit_event`:**
  - every 2 seconds
  - immediately when the buffer reaches its size limit
  - on graceful shutdown (SIGTERM)
- **How:** each org's events are inserted in that org's own `withTenant` transaction.
- **Timestamps:** each event keeps the time the view happened, not the time it was written.
- **What's not buffered:** report downloads and report shares are written during the request, like edits.
- **When a write fails:**
  - The events stay in the buffer and are retried.
  - The buffer has a size cap. If it fills while writes keep failing, the oldest events are dropped.
  - Each drop sends an error with the number of dropped events, and no patient data, to the logs and to Sentry.

## Consequences

- **Accepted risk:** if the process stops without a graceful shutdown (a crash, an out-of-memory kill, `kill -9`), up to about 2 seconds of view events are lost. Edits, report downloads and shares aren't affected.
- **Database outages:** an outage long enough to fill the buffer also loses view events. In that case the reads being audited are failing too.
- **Revisit** if the regulatory review (G5) requires every view to be recorded. View events would then be written during the request.
