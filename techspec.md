# Technical Specification (TECHSPEC)
## Doctor-Facing Wound Care Mobile App + Web Portal

**Document purpose:** Engineering implementation specification derived from `prd.md` and `phase.md`.

**Primary development environment:** Google Antigravity / Antigravity 2.0  
**Primary implementation principle:** The application integrates a **client-provided ML/CV model**. The product engineering team does **not** own model training or model creation unless explicitly requested by the client.

---

# 1. Technical Objectives

The system must provide:

1. A secure doctor-facing mobile app for wound assessment and longitudinal case management.
2. A desktop web portal for review, reporting, management, registration, and export.
3. Offline-first mobile capture with reliable synchronization.
4. Integration of the **client-provided Phase 1 and Phase 2 ML/CV capabilities** through a replaceable model-adapter layer.
5. Consistent Patient → Case → Treatment → Phase data across mobile, backend, and web.
6. Reliable image capture, calibration, AI result handling, confidence/failure states, and clinical review.
7. Secure handling of sensitive patient information and wound images.
8. A codebase structured so Antigravity agents can safely implement, test, review, and extend the system.

---

# 2. Antigravity Development Contract

Antigravity is an agent-first development environment that can operate across the editor, terminal, browser, and structured artifacts. The project should therefore be organized so an agent can work on well-defined, independently testable areas rather than making uncontrolled repository-wide changes.

## 2.1 Agent Rules

Every Antigravity agent working on this repository should follow these rules:

### Rule 1 — Read project specifications first

Before changing code, read:

```text
/prd.md
/phase.md
/techspec.md
```

If requirements conflict, use this priority:

```text
1. Explicit client requirements
2. prd.md
3. phase.md
4. techspec.md implementation guidance
```

When information is missing, ambiguous, conflicting, or technically undecided, the agent must **ask the user before proceeding**.
Never invent a requirement, technical decision, clinical rule, integration detail, model behavior, or implementation constraint.

### Rule 2 — Do not invent clinical logic

Do not invent:

- Clinical scoring rules.
- Diagnostic criteria.
- Treatment recommendations.
- Final clinical option lists.
- AI medical claims.
- Regulatory classifications.

Items marked TBD, Proposed, Roadmap, or Clinical Sign-off Required remain unresolved until explicitly approved.

### Rule 3 — Do not invent the ML model

The ML/CV model is client-provided.

The engineering team must integrate the supplied model/interface, not:

- Train a replacement model.
- Generate fake model outputs in production code.
- Claim medical accuracy not supplied/validated by the client.
- Change model behavior without approval.

During development, mocks may be used only behind the model-adapter interface.

### Rule 4 — Small, reviewable changes

For every task:

1. Inspect existing code.
2. Create/update a plan.
3. Implement the smallest coherent change.
4. Run tests.
5. Run lint/type checks.
6. Verify UI behavior where applicable.
7. Review the diff.
8. Document important implementation decisions.

### Rule 5 — Never silently weaken security

Do not:

- Log patient identifiers.
- Store secrets in source code.
- Disable TLS verification.
- Expose patient images through unrestricted public URLs.
- Bypass authentication for convenience.
- Persist sensitive data in unsecured local storage.

### Rule 6 — Every feature needs error states

Agents must implement:

- Loading
- Empty
- Validation error
- Network error
- Offline state
- Permission error
- Server error
- Retry path
- User-safe failure messaging

Where AI is involved, also implement:

- Model unavailable
- Invalid input
- Calibration unavailable
- Low confidence
- Processing failure
- Unsupported image
- Model-version mismatch

---

# 3. Recommended System Architecture

Use a modular full-stack architecture:

```text
                         ┌──────────────────────┐
                         │      Mobile App      │
                         │  React Native / TS   │
                         └──────────┬───────────┘
                                    │
                               HTTPS / API
                                    │
                         ┌──────────▼───────────┐
                         │      API Backend     │
                         │ TypeScript / NestJS  │
                         └──────┬───────┬───────┘
                                │       │
                    ┌───────────┘       └────────────┐
                    ▼                                ▼
              PostgreSQL                         Object Storage
             Structured Data                     Images / PDFs
                    │                                │
                    └──────────────┬─────────────────┘
                                   │
                            ┌──────▼──────┐
                            │ AI Adapter  │
                            │ Client Model│
                            └─────────────┘

                         ┌──────────────────────┐
                         │      Web Portal      │
                         │ Next.js / TypeScript │
                         └──────────┬───────────┘
                                    │
                                  API
                                    │
                              Backend Service
```

---

# 4. Recommended Technology Stack

The following is the recommended baseline. If the existing repository already uses another stable stack, preserve the existing stack unless there is a strong technical reason to migrate.

## 4.1 Mobile

Recommended:

- React Native
- TypeScript
- React Navigation
- Native camera integration
- SQLite-based local persistence
- TanStack Query for server state
- Zustand or equivalent lightweight UI/local state
- Secure storage backed by platform keystore/keychain

### Mobile requirements

The mobile app must support:

- Camera
- Image file handling
- Offline persistence
- Background/foreground sync
- Network detection
- Local transaction queue
- Secure authentication tokens
- Device permission handling
- GPS capture where consented

---

# 5. Web Portal

Recommended:

- Next.js
- React
- TypeScript
- Server/client rendering according to data sensitivity and UX
- TanStack Query or equivalent API state management
- Accessible component system
- Responsive desktop-first layout

The portal should consume the same backend API as the mobile app.

Do not implement separate business logic that diverges from the mobile application.

---

# 6. Backend

Recommended:

- Node.js
- TypeScript
- NestJS or an equivalent modular TypeScript backend
- REST API initially
- OpenAPI specification
- PostgreSQL
- Object storage such as S3-compatible storage
- Redis only where needed for queues/cache
- Background worker for asynchronous image/AI/report tasks where required

The backend owns:

- Authentication
- Authorization
- Patient/case/treatment data
- Clinical assessment storage
- Image metadata
- AI result metadata
- Report generation
- Sharing
- Sync processing
- Audit events
- Notifications
- Export jobs

---

# 7. Repository Structure

Use a monorepo unless the existing project strongly dictates otherwise.

Recommended:

```text
/
├── apps/
│   ├── mobile/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── domain/
│   ├── api-client/
│   ├── validation/
│   ├── ui/
│   ├── reporting/
│   ├── ai-contract/
│   ├── sync-engine/
│   └── config/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── data-model.md
│   ├── ai-integration.md
│   ├── security.md
│   └── decisions/
│
├── scripts/
├── tests/
├── prd.md
├── phase.md
└── techspec.md
```

---

# 8. Domain Model

## 8.1 Patient

```text
Patient
- id
- externalId / patientId
- firstName
- lastName
- sex
- dateOfBirth or age
- location
- createdAt
- updatedAt
```

Sensitive identity fields must be clearly separated from analytical data where practical.

---

# 9. Case

```text
Case
- id
- patientId
- onsetDate
- woundLocation
- woundType
- baselineClinicalAssessmentId
- status
- createdAt
- updatedAt
```

One Case represents one wound.

---

# 10. Treatment

```text
Treatment
- id
- caseId
- sequenceNumber
- therapyGiven[]
- dressingType
- nextVisitAt
- createdAt
- updatedAt
```

Examples:

```text
T1
T2
T3
```

Do not store visit-specific wound-condition data directly on Treatment.

---

# 11. Phase

```text
Phase
- id
- treatmentId
- type: PRE | POST
- visitDate
- attendingDoctorId
- clinicalAssessmentId
- imageId
- aiResultId
- syncState
- createdAt
- updatedAt
```

---

# 12. Clinical Assessment

A clinical assessment represents the structured observation recorded for a phase.

Potential fields:

```text
ClinicalAssessment
- pain
- exudateLevel
- exudateType
- infectionSigns[]
- edgeCondition
- periwoundCondition
- woundAppearanceTrend
- comorbidityUpdate[]
- notes
```

Only approved fields/options may be exposed in production.

---

# 13. Image Entity

```text
Image
- id
- phaseId
- objectKey
- mimeType
- width
- height
- fileSize
- checksum
- capturedAt
- gpsMetadata
- deviceId
- calibrationMethod
- calibrationValue
- qualityStatus
- duplicateStatus
- createdAt
```

Never store raw image binary directly inside PostgreSQL unless a specific architectural decision requires it.

Use object storage with controlled access.

---

# 14. AI Result Entity

The AI result must be versioned independently from the Phase record.

```text
AIResult
- id
- phaseId
- modelProvider
- modelName
- modelVersion
- modelInputVersion
- processingMode
- status
- confidence
- createdAt
- completedAt
- errorCode
```

### Phase 1 fields

```text
Phase1Result
- woundMask
- area
- length
- width
- majorAxis
- minorAxis
- shape
```

### Phase 2 fields

```text
Phase2Result
- tissueCategories[]
- tissuePercentages[]
- tissueMasks
```

The exact model output contract must be populated from the client's supplied model specification.

---

# 15. Client-Provided ML/CV Integration

## 15.1 Core Principle

The application must use an adapter boundary:

```text
Application
    │
    ▼
AI Service Interface
    │
    ├── Client Model Adapter
    │
    └── Mock Adapter (development/test only)
```

The rest of the application must not depend directly on a specific ML framework.

---

# 16. AI Adapter Interface

Conceptual interface:

```ts
interface WoundAiModel {
  getModelInfo(): Promise<ModelInfo>;

  analyzePhase1(input: Phase1Input): Promise<Phase1Output>;

  analyzePhase2?(input: Phase2Input): Promise<Phase2Output>;
}
```

The actual TypeScript shape must be finalized once the client supplies the model contract.

---

# 17. Model Integration Contract

Before AI implementation, obtain from the client:

- Model format.
- Supported platforms.
- Runtime requirements.
- Input image requirements.
- Expected image dimensions.
- Color format.
- Normalization requirements.
- Calibration input requirements.
- Output schema.
- Segmentation representation.
- Confidence representation.
- Supported model versions.
- Hardware requirements.
- Processing time expectations.
- Error codes.
- Phase 1/Phase 2 availability.
- Licensing/restrictions.
- Update mechanism.
- Validation results supplied by client.

### Important

Do not infer missing model details from generic ML conventions.

---

# 18. AI Processing Modes

The architecture must support two implementations:

```text
Mode A — On Device
Mobile
 └── AI Runtime
      └── Client Model
```

```text
Mode B — Hosted
Mobile
 └── API
      └── AI Service
           └── Client Model
```

The product can choose the actual mode after the client model's deployment requirements are known.

The UI and domain layer should remain independent of this decision.

---

# 19. Phase 1 AI Flow

```text
Camera
  ↓
Image Quality
  ↓
Calibration
  ↓
AI Adapter
  ↓
Client Phase 1 Model
  ↓
Segmentation
  ↓
Measurement Conversion
  ↓
Confidence / Validation
  ↓
Persist Result
  ↓
Result Screen
```

---

# 20. Phase 2 AI Flow

```text
Phase 1 Wound Region
       +
Calibrated Image
       ↓
Client Phase 2 Model
       ↓
Tissue Segmentation
       ↓
Area by Tissue Type
       ↓
Percentage Calculation / Model Output
       ↓
Persist Versioned Result
       ↓
UI / Report / Analytics
```

---

# 21. Calibration Architecture

Calibration is a core product requirement.

Support:

### Automatic

```text
Image
 ↓
Calibration Sticker Detection
 ↓
Reference Size
 ↓
Scale
```

### Manual

```text
Image
 ↓
Doctor Marks Reference
 ↓
Doctor Enters/Confirms Length
 ↓
Scale
```

The calibration object must include:

- Method
- Reference length
- Unit
- Confidence/quality state
- Source coordinates where needed

The measurement layer must reject impossible or invalid calibration states.

---

# 22. Image Quality Pipeline

Before AI inference:

```text
Image Capture
 ↓
Format Validation
 ↓
Dimension Validation
 ↓
Blur Check
 ↓
Framing Check
 ↓
Calibration Check
 ↓
Duplicate Check
 ↓
AI Eligibility
```

Possible states:

```text
VALID
BLURRED
POOR_FRAMING
CALIBRATION_MISSING
DUPLICATE
CORRUPTED
UNSUPPORTED
LOW_LIGHT
LOW_CONFIDENCE
```

The exact thresholds should be configurable rather than hard-coded when practical.

---

# 23. AI Confidence Handling

AI confidence must be treated as a product state, not just a hidden metric.

Example:

```text
HIGH_CONFIDENCE
MEDIUM_CONFIDENCE
LOW_CONFIDENCE
FAILED
```

Low confidence should:

- Be visible to the clinician.
- Explain that review/retake may be required.
- Never silently convert into a confident clinical result.
- Be stored with the result.

The final UI language should be clinically reviewed.

---

# 24. Offline-First Architecture

The mobile app must be able to continue core capture workflows without connectivity.

## Local database

Persist locally:

- Patient references
- Case
- Treatment
- Phase
- Clinical assessment
- Image metadata
- Pending uploads
- AI result status
- Sync state

## Image handling

Images should:

- Be stored in secure local storage temporarily.
- Be associated with a local ID.
- Upload only after sync conditions allow.
- Be deleted from temporary storage after successful durable persistence according to retention policy.

---

# 25. Sync Engine

Use an explicit sync queue.

```text
Local Change
    ↓
Outbox
    ↓
Sync Worker
    ↓
API
    ↓
Server Validation
    ↓
Success / Conflict / Failure
```

Each mutation should have:

```text
operationId
entityType
entityId
operationType
payloadVersion
createdAt
attemptCount
lastError
```

---

# 26. Sync Conflict Strategy

The PRD identifies multi-device offline conflict as unresolved.

Before production, implement an explicit strategy.

Recommended:

```text
Client version
Server version
       ↓
Version mismatch?
   ┌───┴────┐
  No       Yes
  │         │
Apply     Conflict
            │
            ▼
   Clinical review / merge
```

Do not silently use last-write-wins for clinically significant records unless explicitly approved.

---

# 27. API Design

Use REST with OpenAPI.

Example endpoints:

```text
POST   /auth/login
POST   /auth/otp
POST   /auth/forgot-password
POST   /auth/reset-password

GET    /patients
POST   /patients
GET    /patients/:id
PATCH  /patients/:id
DELETE /patients/:id

GET    /patients/:id/cases
POST   /patients/:id/cases

GET    /cases/:id
PATCH  /cases/:id
DELETE /cases/:id

GET    /cases/:id/treatments
POST   /cases/:id/treatments

GET    /treatments/:id
POST   /treatments/:id/phases

GET    /phases/:id
PATCH  /phases/:id

POST   /images/presign
POST   /images/:id/quality-check

POST   /ai/phase1/analyze
POST   /ai/phase2/analyze

GET    /ai/results/:id

POST   /reports
GET    /reports/:id
POST   /reports/:id/share

GET    /review-queue

POST   /sync
GET    /sync/status

GET    /exports
POST   /exports
```

Actual endpoint design may be consolidated where appropriate; avoid unnecessary endpoint proliferation.

---

# 28. API Validation

Use schema validation at API boundaries.

Validate:

- Authentication input
- Patient fields
- Case fields
- Treatment fields
- Clinical assessments
- Image metadata
- AI results
- Sharing requests
- Export requests
- Sync mutations

No client-side validation should be considered sufficient on its own.

---

# 29. Authentication & Authorization

## Authentication

Support:

- Email/phone + password
- OTP
- Device authentication / biometric unlock where appropriate

Use:

- Short-lived access tokens
- Refresh-token rotation or an equivalent secure session mechanism
- Server-side session revocation

## Current Role Model

Initial release:

```text
Authenticated User
```

Do not build a complex role hierarchy unless separately approved.

However, authorization checks should be centralized so future RBAC can be added.

---

# 30. Sharing Security

## Patient Sharing

Default to minimizing personal information.

## Case Live Link

A live link must use:

- Non-guessable token
- Expiration
- Revocation
- Permission scope
- Audit event
- HTTPS
- Controlled image access

Never expose raw storage URLs publicly.

---

# 31. Data Privacy

The system must treat the following as sensitive:

- Patient identity
- Wound images
- GPS
- Timestamp
- Device ID
- Clinical observations
- Treatment information
- AI results

## Consent

Consent requirements should cover the approved uses of:

- Patient data
- Photos
- AI processing
- AI training use if applicable
- GPS metadata
- Sharing

Do not assume AI-training consent merely because AI processing consent exists.

---

# 32. Storage Design

Recommended:

```text
PostgreSQL
 ├── Patients
 ├── Cases
 ├── Treatments
 ├── Phases
 ├── Assessments
 ├── AI Results
 ├── Reports
 ├── Users
 ├── Audit Events
 └── Sync Records

Object Storage
 ├── Original Images
 ├── Processed Images
 ├── Segmentation Masks
 └── PDFs
```

Object storage access should use private buckets/containers with signed or authorized access.

---

# 33. Database Versioning

Every schema change must have:

- Migration
- Rollback strategy where practical
- Backward-compatibility consideration
- Test coverage

Never modify production database structure manually without a migration.

---

# 34. Reporting Architecture

Use one report-definition package shared by:

- Mobile
- Web
- Backend

Recommended:

```text
Report Data Model
      ↓
Report Renderer
      ↓
PDF
```

Report should be generated from structured case/treatment data rather than screen scraping.

---

# 35. Report Contents

Potential content:

- Patient-safe identity fields depending on sharing mode
- Case ID
- Wound type
- Wound location
- Visit dates
- Treatment timeline
- Therapy
- Dressing
- AI measurements
- Tissue percentages when Phase 2 exists
- Clinical observations
- Images
- Flags

The final report template requires product/clinical design approval.

---

# 36. Mobile Navigation

Recommended:

```text
Login
  ↓
Home
 ├── Add Patient
 │     ↓
 │  Patient Intake
 │     ↓
 │  New Case
 │
 └── Existing Patient
       ↓
    Patient Page
       ↓
      Case
       ↓
    Treatment
       ↓
     Phase
       ↓
    Questions
       ↓
 Image Capture
       ↓
     Result
       ↓
    Report
```

---

# 37. Web Navigation

```text
Login
  ↓
Dashboard
 ├── Patient List
 │     └── Patient Detail
 │            └── Case View
 │                  └── Treatment Timeline
 │
 ├── Review / Flag Queue
 │
 ├── Reports
 │
 ├── Patient Registration
 │
 └── Data Export
```

---

# 38. UI State Model

Each major workflow should define:

```text
INITIAL
LOADING
READY
EDITING
SAVING
SUCCESS
OFFLINE
SYNC_PENDING
SYNC_FAILED
ERROR
```

AI workflows additionally:

```text
CAPTURING
CALIBRATING
QUALITY_CHECK
PROCESSING
LOW_CONFIDENCE
RESULT_READY
MODEL_ERROR
```

---

# 39. Clinical Form Design

All forms should support:

- Required/optional indicators
- Inline validation
- Accessible labels
- Clear units
- Controlled vocabularies
- Safe defaults
- Explicit "No Change" where required
- Clear save state

Do not use free text where a clinically approved controlled value is required.

---

# 40. Pre-fill Engine

Implement a generic field inheritance mechanism.

```text
Previous POST
     ↓
Field Mapping
     ↓
New PRE defaults
     ↓
Clinician override
     ↓
Save
```

Store whether a value is:

```text
INHERITED
USER_ENTERED
SYSTEM_GENERATED
AI_GENERATED
```

This is useful for auditability and debugging.

---

# 41. Status Engine

Create one shared status service.

Possible states:

```text
HEALING
NEEDS_REVIEW
OVERDUE
UPCOMING
```

The exact rules are TBD.

Once approved, mobile Home and web Review Queue must use the same status engine.

Do not duplicate status calculations in two frontends.

---

# 42. Review / Flag Engine

Flags may originate from:

- AI low confidence
- Image quality failure
- Sync conflict
- Overdue follow-up
- Clinical review requirement
- Other approved rules

Conceptual model:

```text
Flag
- id
- caseId / phaseId
- type
- severity
- status
- message
- source
- createdAt
- resolvedAt
- resolvedBy
```

---

# 43. Error Handling

Use typed error categories.

```text
AUTH_ERROR
VALIDATION_ERROR
PERMISSION_ERROR
NETWORK_ERROR
OFFLINE_ERROR
SYNC_CONFLICT
IMAGE_ERROR
CALIBRATION_ERROR
AI_ERROR
MODEL_VERSION_ERROR
REPORT_ERROR
STORAGE_ERROR
UNKNOWN_ERROR
```

Users should see understandable messages.

Developers should receive structured diagnostic information without sensitive patient data in logs.

---

# 44. Logging & Observability

Log:

- Application failures
- API errors
- Sync events
- AI processing state
- Model version
- Report generation state
- Security events

Do NOT log:

- Full patient names
- Patient IDs
- Raw clinical notes
- Raw wound images
- Access tokens
- Passwords
- Refresh tokens
- Full GPS coordinates unless strictly required for controlled diagnostics

Use pseudonymous/internal correlation IDs.

---

# 45. Audit Trail

Audit clinically meaningful events:

- Patient created
- Case created
- Assessment updated
- Treatment created
- Image captured
- AI result generated
- AI result superseded
- Report generated
- Patient/case shared
- Live link revoked
- Export generated
- Authentication/security events
- Conflict resolution

Recommended fields:

```text
AuditEvent
- id
- actorId
- action
- entityType
- entityId
- timestamp
- requestId
- metadata
```

Avoid including unnecessary patient data in audit payloads.

---

# 46. Security Baseline

At minimum:

- TLS
- Encryption at rest
- Secure credential handling
- Platform secure storage
- API authorization
- Input validation
- Rate limiting for sensitive endpoints
- Audit logging
- Dependency vulnerability checks
- Secure headers
- Signed/private image access
- Backup encryption

---

# 47. Image Security

Images should be:

- Private by default.
- Accessed through authorized APIs or short-lived signed URLs.
- Encrypted at rest.
- Associated with patient/case/phase permissions.
- Audited on access where appropriate.

Private-area images require the same technical controls as all other images, with potentially stricter sharing rules depending on policy.

---

# 48. Testing Strategy

## Unit Tests

Cover:

- Domain logic
- Validation
- Status calculation
- Pre-fill engine
- Calibration math
- Sync state machine
- AI adapter normalization
- Report data transformation

## Integration Tests

Cover:

- API + database
- Authentication
- Patient/case workflow
- Image upload
- AI adapter
- Reports
- Sharing
- Sync

## End-to-End Tests

Cover critical journeys:

```text
Login
→ Create Patient
→ Create Case
→ Capture Image
→ AI Result
→ Create Treatment
→ Pre/Post
→ Report
```

And:

```text
Offline Capture
→ Reconnect
→ Sync
→ Verify Server State
```

## Visual / Browser Testing

Use Antigravity browser capabilities where practical to verify:

- Web layout
- Forms
- Navigation
- Empty/error states
- Report screens
- Review queue

---

# 49. AI Test Strategy

Because the model is client-provided, engineering validates integration behavior rather than retraining the model.

Test:

- Correct input transformation
- Correct image format
- Correct calibration handoff
- Correct model invocation
- Correct output parsing
- Unit conversion
- Mask rendering
- Confidence mapping
- Model errors
- Model timeout
- Unsupported model version
- Phase 1/Phase 2 availability

Use a mocked model adapter for deterministic CI tests.

Use the real client model only in controlled integration/validation environments.

---

# 50. Model Versioning

Every stored AI result must include:

```text
modelProvider
modelName
modelVersion
processingMode
inputVersion
timestamp
```

Never overwrite a historical AI result merely because a newer model is available.

A rerun should create a new versioned result.

---

# 51. Client Model Onboarding Checklist

Before integrating the production model, collect:

- Model package
- Runtime
- License
- Supported OS/platforms
- Input specification
- Output specification
- Example input
- Example output
- Error behavior
- Performance expectations
- Memory requirements
- CPU/GPU requirements
- Model version
- Versioning policy
- Validation documentation
- Known limitations

Once received, update:

```text
/docs/ai-integration.md
```

Do not put client secrets or private model binaries into Git.

---

# 52. Environment Strategy

Use separate environments:

```text
local
development
staging
pilot
production
```

Each environment should have:

- Separate database
- Separate object storage
- Separate secrets
- Separate AI configuration
- Separate telemetry where practical

---

# 53. Secrets Management

Never commit:

- API keys
- Database passwords
- JWT secrets
- Storage secrets
- Model credentials

Use:

- Environment variables for local development.
- Managed secret storage for shared environments.

---

# 54. CI/CD

Every pull request should run:

```text
Install
↓
Type Check
↓
Lint
↓
Unit Tests
↓
Integration Tests
↓
Build
↓
Security/Vulnerability Scan
```

For mobile/web:

- Build validation
- Bundle validation
- Environment validation

For AI integration:

- Mock model integration tests must always run.

---

# 55. Antigravity Agent Decomposition

Use specialized agents/tasks rather than asking one agent to build the entire system at once.

Suggested workstreams:

### Agent 1 — Architecture

Own:

- Repository setup
- Shared packages
- Database schema
- API contracts
- Environment setup

### Agent 2 — Mobile

Own:

- Navigation
- Patient flow
- Case flow
- Treatment/phase flow
- Forms
- Offline UX

### Agent 3 — Web

Own:

- Dashboard
- Patient list
- Case view
- Review queue
- Reports
- Registration
- Export

### Agent 4 — Backend

Own:

- REST API
- Auth
- Domain services
- Database
- Storage
- Reporting

### Agent 5 — AI Integration

Own:

- AI adapter
- Client model integration
- Calibration handoff
- Result normalization
- Confidence/error mapping
- Model versioning

### Agent 6 — QA / Verification

Own:

- Automated tests
- E2E tests
- Browser verification
- Regression tests
- Error-state coverage

### Agent 7 — Security

Own:

- Security review
- Dependency scan
- Storage/access review
- Audit review
- Sharing review

Agents should not overwrite one another's work without inspecting the current branch/state first.

---

# 56. Antigravity Task Format

Each implementation task should be provided to the agent in this structure:

```text
TASK
Implement: <feature>

CONTEXT
Read:
- prd.md
- phase.md
- techspec.md
- <relevant source files>

SCOPE
- <explicit requirements>

DO NOT
- <out-of-scope items>
- Do not invent clinical logic.
- Do not invent ML model behavior.

IMPLEMENTATION
- <technical constraints>

ACCEPTANCE
- <testable requirements>

VERIFICATION
- Run tests
- Run lint
- Run typecheck
- Verify UI/browser if applicable
- Report changed files and test results
```

---

# 57. Recommended Antigravity Customization

The repository should maintain persistent project guidance for agents.

Recommended structure:

```text
.ag/
  rules/
  skills/
```

Use persistent Rules for:

- Architecture constraints
- Security rules
- Clinical requirement handling
- Client ML model constraints
- Coding conventions

Use Skills for repeatable engineering procedures such as:

- Implement feature
- Run QA
- Build release
- Validate AI integration
- Review security

Antigravity's current documentation describes Skills/Rules as reusable agent guidance. Avoid designing new work around deprecated Workflows; current Antigravity documentation says Workflows are being migrated/deprecated in favor of Agent Skills.

---

# 58. Suggested Project Rules

Create a persistent rule similar to:

```text
# Medical App Engineering Rules

1. Read prd.md, phase.md, techspec.md before making architectural changes.
2. Treat clinical TBD/proposed items as unresolved.
3. The ML/CV model is client-provided.
4. Never invent, retrain, replace, or alter the client model.
5. Keep AI behind an adapter interface.
6. Never log patient-identifying information.
7. Images are private by default.
8. Offline changes require explicit sync state.
9. Never silently overwrite clinical records.
10. Add tests with meaningful feature changes.
11. Keep mobile, web, and backend business rules centralized where possible.
12. Review diffs before considering a task complete.
```

---

# 59. Phase-to-Technical-Implementation Mapping

| Phase | Technical Deliverables |
|---|---|
| Phase 0 | Monorepo, authentication, database, API, storage, security foundation, offline storage, shared domain packages |
| Phase 1 | Patient/Case/Treatment/Phase UI, clinical forms, image capture, calibration, client Phase 1 model adapter, AI result screen, offline sync, reporting, portal |
| Phase 1A | Clinical validation tooling, model integration tests, image-quality tests, security testing, performance testing, audit verification |
| Phase 2 | Client Phase 2 model adapter, tissue results, tissue UI, tissue reporting, metrics |
| Phase 3 | Periwound model integration if supplied/approved, photogrammetry pipeline |
| Phase 4 | ML/LLM integrations, predictive analytics, EHR/FSM integrations, advanced RBAC |

---

# 60. Phase 1 Build Order

Recommended technical order:

```text
1. Repository + environments
2. Authentication
3. Database/domain model
4. Backend API
5. Mobile navigation
6. Patient registration
7. Case creation
8. Treatment/Phase
9. Clinical forms
10. Image capture
11. Calibration
12. Client Phase 1 model adapter
13. AI result handling
14. Offline storage
15. Sync
16. Reporting
17. Web portal
18. Sharing
19. Notifications
20. Security hardening
21. Clinical validation
```

The model adapter should be integrated only after the client model contract is known.

---

# 61. Phase 2 Build Order

```text
1. Confirm client Phase 2 model contract
2. Extend AI adapter
3. Add tissue-result persistence
4. Add tissue UI
5. Add report support
6. Add timeline comparison
7. Add aggregate tissue metrics
8. Validate
9. Release
```

Do not rewrite the Phase 1 wound-measurement pipeline.

---

# 62. Performance Requirements

Exact targets must be defined from real client model/device characteristics.

Measure at minimum:

- App launch
- Screen navigation
- Image capture startup
- Image preprocessing
- AI inference time
- Result rendering
- Local save
- Sync latency
- Upload time
- Report generation
- Portal page load

AI timing should be separated into:

```text
Capture
→ Preprocess
→ Model Inference
→ Postprocess
→ Persistence
```

This makes model-integration bottlenecks visible.

---

# 63. Accessibility

Mobile and web interfaces should support:

- Readable typography
- Proper labels
- Touch targets
- Screen-reader semantics
- Keyboard accessibility on Web
- Meaningful error messaging
- Non-color-only status communication

Critical medical workflow information must never be conveyed using color alone.

---

# 64. Localization Readiness

Even if the first release is one language, do not hard-code user-facing strings throughout the UI.

Centralize:

- Labels
- Error messages
- Status messages
- Clinical terms
- Notifications

This allows later localization without architectural changes.

---

# 65. Analytics

Product analytics should avoid unnecessary patient data.

Track anonymous/product events such as:

- Capture started
- Capture failed
- Capture retaken
- AI result ready
- AI low confidence
- Report generated
- Sync failed
- Sync succeeded
- Portal case opened

Never send raw wound images or clinical notes to generic analytics systems unless explicitly approved.

---

# 66. Data Export

Exports should be generated through backend-controlled jobs.

Flow:

```text
User requests export
       ↓
Authorization
       ↓
Create Export Job
       ↓
Generate dataset
       ↓
Apply de-identification policy
       ↓
Generate file
       ↓
Secure download
       ↓
Audit event
```

The exact de-identification policy requires privacy/legal approval.

---

# 67. Notification Architecture

Use a notification service abstraction.

```text
Domain Event
   ↓
Notification Rules
   ↓
Notification Service
   ├── Push
   ├── Email
   └── SMS / other approved channel
```

The implementation should not assume all channels are enabled.

Events:

- Upcoming visit
- Follow-up due
- Overdue

Consent and timing rules must be configurable.

---

# 68. Backup & Recovery

Define:

- Database backup frequency
- Object storage backup/versioning
- Recovery point objective
- Recovery time objective
- Restore testing
- Key/secrets recovery

Do not consider backups complete until restoration has been tested.

---

# 69. Disaster / Failure Handling

The system must handle:

- API downtime
- AI service/model unavailable
- Object storage unavailable
- Device offline
- Sync failure
- Partial upload
- Corrupt image
- Report generation failure

Mobile clinical capture should remain usable for supported offline workflows even if backend services are temporarily unavailable.

---

# 70. Production Readiness Checklist

Before pilot/production:

### Architecture

- [ ] Database migrations tested
- [ ] API contracts documented
- [ ] Model adapter documented
- [ ] Report engine documented

### Security

- [ ] TLS
- [ ] Encryption at rest
- [ ] Secret management
- [ ] Authorization
- [ ] Secure image access
- [ ] Audit logging
- [ ] Dependency scan
- [ ] Pen test / security review

### Mobile

- [ ] Offline mode
- [ ] Sync
- [ ] Camera permissions
- [ ] Secure local storage
- [ ] Image cleanup
- [ ] Error states

### AI

- [ ] Client model integrated
- [ ] Model version captured
- [ ] Input contract tested
- [ ] Output contract tested
- [ ] Confidence handling
- [ ] Failure handling
- [ ] Performance measured
- [ ] Validation evidence reviewed

### Clinical

- [ ] Option lists approved
- [ ] Pain scale approved
- [ ] Terminology approved
- [ ] Clinical workflow reviewed

### Privacy

- [ ] Consent
- [ ] GPS handling
- [ ] Private-area images
- [ ] Sharing controls
- [ ] Export controls
- [ ] Retention/deletion

### Operations

- [ ] Monitoring
- [ ] Alerting
- [ ] Backups
- [ ] Restore test
- [ ] Release rollback plan

---

# 71. Definition of Technical Done

A technical feature is complete only when:

1. Requirement is implemented.
2. Domain/API/data behavior is correct.
3. Loading/empty/error/offline states exist.
4. Authorization is enforced.
5. Sensitive data is handled safely.
6. Unit/integration tests pass.
7. Typecheck passes.
8. Lint passes.
9. Build succeeds.
10. Browser/device flow is verified where applicable.
11. Documentation is updated.
12. The diff has been reviewed.
13. No unrelated functionality was silently changed.

For AI features additionally:

14. Client model contract is respected.
15. Model version is persisted.
16. Input/output transformation is tested.
17. Confidence/error states are handled.
18. Client-provided validation evidence is referenced.
19. No unsupported medical claim is introduced.

---

# 72. Important Technical Decisions Still Required

| Decision | Current State |
|---|---|
| Mobile framework | Recommended React Native/TypeScript; confirm against existing repo/team |
| Backend framework | Recommended NestJS/TypeScript |
| Database | PostgreSQL |
| Object storage | S3-compatible/private object storage |
| AI execution mode | TBD based on client model |
| Client model format/runtime | **Awaiting client specification** |
| Phase 1 model API | **Awaiting client specification** |
| Phase 2 model API | **Awaiting client specification** |
| Offline conflict resolution | TBD |
| Pain scale | Clinical sign-off |
| Clinical option lists | Clinical sign-off |
| Live-link authentication | TBD |
| Notification channels | TBD |
| Regulatory classification | Formal assessment required |

---

# 73. Golden Rule for the Antigravity Build

The agent should think of the project as:

```text
PRODUCT REQUIREMENTS
        ↓
PHASE PLAN
        ↓
TECHNICAL CONTRACT
        ↓
SMALL IMPLEMENTATION TASK
        ↓
CODE
        ↓
TEST
        ↓
VERIFY
        ↓
REVIEW
```

Not:

```text
Prompt
  ↓
Generate entire app
  ↓
Hope it works
```

The objective is to make Antigravity operate as a controlled engineering partner with explicit boundaries, tests, artifacts, and verification.

---

# 74. Final Architecture Principle

The most important implementation boundary is:

```text
                  PRODUCT
                     │
        ┌────────────┴────────────┐
        │                         │
   Clinical System            AI Adapter
        │                         │
Patient/Case/Treatment       Client Model
Phase/Assessment             Phase 1 / Phase 2
Reports                      Versioned Outputs
Offline/Sync
        │                         │
        └────────────┬────────────┘
                     │
                 Secure API
                     │
               Storage / DB
```

The product must **consume and operationalize the client-provided AI model** while keeping the model replaceable and versioned.

This separation allows:

- Client model updates without rewriting the clinical workflow.
- Phase 2 model integration without breaking Phase 1.
- Mocked AI testing in CI.
- On-device or hosted model execution.
- Clear ownership between product engineering and the client model team.
- Safer future integration of additional CV/AI capabilities.
