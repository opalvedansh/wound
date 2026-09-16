# PHASE IMPLEMENTATION PLAN
## Doctor-Facing Wound Care App + Web Portal

> This document translates `prd.md` into a phased product, engineering, AI/CV, validation, and release plan. The key rule is that **Phase 1 AI must ship independently of Phase 2 AI**.

---

# 1. Phase Strategy

The product should be built in controlled phases so that the clinical workflow is usable before advanced AI capabilities are introduced.

## Phase Overview

| Phase | Name | Primary Goal | Status |
|---|---|---|---|
| Phase 0 | Foundation & Architecture | Establish secure platform, data model, navigation, and development foundations. | Required |
| Phase 1 | Clinical MVP + Wound Measurement AI | Deliver the complete core wound workflow with calibrated wound segmentation and sizing. | **Committed** |
| Phase 1A | Hardening & Clinical Validation | Validate the MVP for reliability, security, privacy, image quality, and clinical use. | Required before production |
| Phase 2 | Tissue Analysis AI | Add tissue segmentation and tissue-percentage measurements. | **Committed** |
| Phase 3 | Advanced CV / Analytics | Add periwound analysis, photogrammetry, and richer analytics where validated. | Roadmap |
| Phase 4 | ML/LLM & Ecosystem | Add treatment intelligence, predictive analytics, EHR/FSM and other ecosystem features. | Roadmap |

---

# 2. Critical Scope Rule

## Phase 1 must NOT depend on Phase 2

Phase 1 must be fully usable without:

- Tissue segmentation
- Tissue percentages
- Phase 2 analytics
- ML/LLM recommendations
- Predictive healing
- Periwound AI
- Photogrammetry

Phase 2 should be implemented as an extension to the same data model rather than a rewrite of Phase 1.

### Architecture principle

```text
Patient
  └── Case
       └── Treatment (T1, T2, T3...)
            ├── Pre Phase
            │    ├── Image
            │    ├── Phase 1 AI Result
            │    └── Clinical Assessment
            └── Post Phase
                 ├── Image
                 ├── Phase 1 AI Result
                 └── Clinical Assessment
```

Phase 2 extends the AI result:

```text
Phase
 └── AI Result
      ├── Phase 1
      │    ├── Segmentation
      │    ├── Area
      │    ├── L×H
      │    ├── Major Axis
      │    ├── Minor Axis
      │    └── Shape
      └── Phase 2
           └── Tissue Segmentation
                ├── Granulation %
                ├── Slough %
                ├── Necrotic %
                └── Other approved categories %
```

---

# 3. Phase 0 — Foundation & Architecture

## Objective

Build the technical foundation required for all later phases without prematurely implementing advanced AI scope.

## Scope

### Authentication

Implement:

- Email/phone + password
- OTP
- Device/biometric authentication where supported
- Signup
- Find account

### Account Recovery

Define and implement:

- Forgot password
- OTP/email verification
- Password reset
- Session recovery

The initial PRD identifies password reset as undefined; Phase 0 should close this gap.

### Core Data Model

Create persistent entities for:

- Patient
- Case
- Treatment
- Phase
- Clinical Assessment
- Image
- AI Result
- Report
- Notification
- Audit Event
- Sync Queue

### Core Relationship

```text
Patient 1 ──── * Case
Case    1 ──── * Treatment
Treatment 1 ── 2 Phase
Phase   1 ──── * Image
Phase   1 ──── 1 AI Result
Case    1 ──── * Report
```

### Security Foundation

Implement:

- Encryption at rest
- Secure network transport
- Authentication/session management
- Secure local storage for offline data
- Access-control foundation
- Audit logging foundation
- Backup/recovery strategy

### Privacy Foundation

Design:

- Consent capture
- Privacy notice
- Image privacy
- GPS/timestamp/device-ID handling
- Private-area wound handling
- Data retention model
- Sharing permissions

### Navigation

Create base navigation for:

- Login
- Home
- Patient
- Case
- Treatment
- Phase
- Questions
- Image Capture
- Result
- Report
- Settings/account

---

## Phase 0 Deliverables

- Technical architecture
- Database schema
- API specification
- Authentication system
- Core mobile navigation
- Core web navigation
- Secure storage
- Consent framework
- Audit framework
- Offline storage architecture
- CI/CD and environment setup
- Monitoring/logging foundation

## Phase 0 Exit Criteria

Phase 0 is complete when:

- User authentication works.
- Core Patient → Case → Treatment → Phase relationships are persisted.
- Security baseline is implemented.
- Consent can be recorded.
- Mobile and web environments are deployable.
- Offline storage architecture is available.
- Phase 1 AI can be integrated without changing the core domain model.

---

# 4. Phase 1 — Clinical MVP + Wound Measurement AI

## Objective

Deliver the first clinically useful version of the product.

Phase 1 contains the complete basic clinical workflow and the first AI model.

---

## 4.1 Patient Registration

Implement:

- First name
- Last name
- Patient ID
- Sex
- DOB or age
- Location
- Onset date
- Wound location

### Wound Location

Implement:

- Human-body diagram
- Front/back selector
- Male/female private-region mode
- Region selection
- Progressive zoom
- Precise location label

---

## 4.2 New Case Form

Implement required baseline assessment fields:

### Wound Type

Initial controlled list should be finalized by clinical sign-off.

### Exudate

- None
- Light
- Moderate
- High

Type list to be finalized.

### Infection Signs

Initial source-defined values:

- Erythema in periwound
- Local warmth
- Edema

Additional proposed values require clinical sign-off.

### Pain

Final scale must be approved before release.

### Edge / Periwound

Final option list requires clinical sign-off.

### Comorbidities

Implement approved baseline multi-select list.

---

# 5. Phase 1 — Image Capture

## User Flow

```text
Start Capture
     ↓
Framing Guide
     ↓
Calibration Detection
     ↓
Manual Calibration if Needed
     ↓
Image Quality Check
     ↓
Segmentation Preview
     ↓
Confidence Check
     ↓
Accept / Retake
     ↓
AI Result
```

## Requirements

The capture UI must:

- Display a wound framing guide.
- Detect a calibration sticker where available.
- Support manual reference-length marking.
- Display segmentation-mask preview.
- Validate image quality.
- Permit retakes.
- Detect duplicate images.
- Detect corrupted images.
- Detect low-confidence outputs.
- Preserve image metadata.

---

# 6. Phase 1 — Wound Measurement AI

## Inputs

- Calibrated wound image
- Calibration reference
- Capture metadata

## Outputs

### Segmentation

Identify the wound region.

### Measurement

Generate:

- Wound area
- Length
- Width
- Major axis
- Minor axis

### Shape

Generate approved shape descriptors.

### Confidence

Return model confidence and/or quality state.

### Low-Confidence Rule

Large, complex, poorly framed, or uncertain wounds must not be presented as highly reliable measurements.

The UI should clearly identify uncertain results and provide a retake or clinician-review path.

---

# 7. Phase 1 — Treatment Workflow

## Treatment Creation

A case may contain:

- T1
- T2
- T3
- etc.

Each Treatment stores:

- Wound therapy given
- Dressing type
- Next visit/action date

## Phase Structure

```text
Treatment T1
 ├── Pre
 │    ├── Image
 │    ├── AI Result
 │    └── Clinical Questions
 │
 └── Post
      ├── Image
      ├── AI Result
      └── Clinical Questions
```

Repeat for T2, T3, etc.

---

# 8. Phase 1 — Revisit Assessment

At each revisit, collect the changing clinical fields.

Required/approved fields should include:

- Pain
- Exudate
- Infection signs
- Edge condition
- Periwound condition
- Wound appearance trend
- Comorbidity update

## Wound Appearance Trend

Options:

- Improved
- No Change
- Worsened

This represents clinician judgment alongside AI measurements.

---

# 9. Phase 1 — Pre-fill Logic

When a new Treatment starts:

```text
Previous Treatment Post
          ↓
New Treatment Pre
```

Pre-filled fields must be editable.

The doctor can:

- Change a value.
- Clear a value.
- Replace the inherited value.

The system must preserve an audit trail where clinically appropriate.

---

# 10. Phase 1 — Offline Workflow

## Offline User Journey

```text
Capture / Edit
     ↓
Save Locally
     ↓
Queue for Sync
     ↓
Network Returns
     ↓
Sync
     ↓
Server Confirmation
     ↓
Sync Status = Complete
```

## Requirements

The app must:

- Work without connectivity.
- Save clinical data locally.
- Save captured images safely.
- Queue changes.
- Retry failed synchronization.
- Display synchronization status.

## Conflict Handling

Before production multi-device use, define a conflict strategy for:

> The same case being modified on two offline devices.

Recommended design direction:

- Field-level versioning.
- Server-side conflict detection.
- Manual resolution for clinically significant conflicts.

Do not silently overwrite clinical data without a defined policy.

---

# 11. Phase 1 — Reporting

## App

Support:

- View current case status.
- Select treatments.
- Generate PDF.
- Download.
- Share.

## Web

Use the same report definition and ideally the same report engine.

Example:

```text
Case
 ├── T1
 ├── T2
 └── T3

Select T1 + T2
       ↓
Generate Report
       ↓
PDF
```

---

# 12. Phase 1 — Patient & Case Sharing

## Share Patient

Provide a privacy-aware mode that can hide:

- Name
- Patient ID
- Other personal identifiers as configured

## Share Case

Support:

- Static PDF
- Live link

### Live-Link Minimum Requirements

Before enabling production sharing, define:

- Recipient authentication
- Permission level
- Link expiration
- Link revocation
- Audit trail
- Download behavior
- Personal-data visibility

---

# 13. Phase 1 — Web Portal

Implement:

## Dashboard

Show:

- Total patients
- Active cases
- Treatments this week
- Pending reviews
- Basic charts

## Patient List

- Search
- Name
- Patient ID
- Patient details

## Case View

- Treatment timeline
- Pre/Post images
- Measurements
- Flags
- Assessments

## Report

- Treatment selection
- PDF generation

## Review Queue

Show:

- Flagged
- Overdue
- Needs Review

## Patient Registration

Provide full Patient Intake.

## Data Export

Provide:

- CSV
- Formatted reports

Bulk export privacy/de-identification requirements must be resolved before unrestricted production export.

---

# 14. Phase 1 — Notifications

Implement the basic follow-up reminder architecture.

Candidate events:

- Next visit
- Follow-up due
- Overdue visit

The exact patient/doctor notification policy must be finalized before production.

---

# 15. Phase 1 — MVP Hardening

After the core MVP works, conduct a dedicated hardening pass.

## Image Testing

Test:

- Blur
- Low light
- Poor framing
- Occlusion
- Calibration failure
- Large wounds
- Complex wounds
- Duplicate images
- Corrupted files

## Clinical Testing

Validate:

- Clinical terminology
- Option lists
- Pain scale
- Infection criteria
- Edge/periwound choices
- Wound types
- Comorbidities

## Security Testing

Conduct:

- Authentication testing
- Authorization testing
- Data encryption validation
- API security testing
- Mobile storage testing
- Portal security testing
- Sharing/link security testing

## Privacy Testing

Validate:

- Consent
- Data minimization
- Private-area images
- Metadata handling
- Export behavior
- Share behavior
- Data deletion/retention

---

# 16. Phase 1 Exit Criteria

Phase 1 is ready for controlled clinical pilot when all of the following are true:

### Core Clinical Workflow

- Patient can be created.
- Case can be created.
- Wound location can be selected.
- Baseline assessment can be completed.
- Treatment can be created.
- Pre/Post phases can be completed.
- Revisit can be completed.

### AI

- Calibration works.
- Segmentation works within agreed validation thresholds.
- Area is generated.
- L×H is generated.
- Major/minor axes are generated.
- Shape output is available.
- Low-confidence output is flagged.
- Retake workflow works.

### Offline

- User can capture without signal.
- Data persists locally.
- Synchronization works after reconnect.
- Sync status is visible.
- Conflict handling is documented.

### Reporting

- Report can be generated.
- Selected treatments appear correctly.
- PDF output is consistent on App and Web.

### Portal

- Patient search works.
- Case review works.
- Timeline works.
- Flags work.
- Reports work.

### Security / Privacy

- Encryption at rest is validated.
- Consent works.
- Private-area data handling is validated.
- Sharing permissions work.
- Audit logging works.

### Clinical

- Proposed option lists are approved.
- Pain scale is approved.
- Clinical terminology is approved.

---

# 17. Phase 1A — Clinical Validation & Production Readiness

## Objective

Move from functional MVP to a clinically validated, production-ready release.

## Activities

### Clinical Validation

Evaluate:

- AI measurement accuracy
- Segmentation accuracy
- Calibration accuracy
- Repeatability
- Inter-user variability
- Poor-quality image behavior
- Large/complex wound behavior

### Model Validation

Establish agreed validation metrics such as:

- Segmentation performance
- Measurement error
- Confidence calibration
- Failure rate
- Retake rate

Exact thresholds must be defined with clinical and regulatory stakeholders.

### Human Factors

Evaluate:

- Capture speed
- Number of taps
- User comprehension
- Error recovery
- Confidence/uncertainty presentation
- Workflow interruption

### Security

Perform:

- Penetration testing
- API testing
- Mobile security testing
- Web security testing
- Storage security validation

### Operational Readiness

Provide:

- Logging
- Monitoring
- Alerting
- Backups
- Disaster recovery
- Model/version tracking
- Support process

---

# 18. Phase 2 — Tissue Analysis AI

## Objective

Add wound tissue segmentation without changing the existing clinical workflow.

Phase 2 is a separate AI build and validation stream.

---

## 18.1 Phase 2 Inputs

Use:

- Captured wound image
- Calibrated wound scale
- Phase 1 wound segmentation
- Clinical context where approved

---

## 18.2 Phase 2 Outputs

Calculate tissue area percentages.

Initial categories:

- Granulation
- Slough
- Necrotic
- Other approved categories

Output example:

```text
Wound Area: 12.4 cm²

Granulation: 55%
Slough:      25%
Necrotic:    15%
Other:        5%
```

The exact categories and reporting rules must receive clinical sign-off.

---

# 19. Phase 2 — Product Changes

## Result Screen

Add:

- Tissue segmentation visualization
- Tissue percentage chart
- Confidence/quality status
- Comparison with previous visit

## Case Timeline

Display tissue data per treatment/visit.

Example:

```text
T1 Pre   → Granulation 40%
T1 Post  → Granulation 45%

T2 Pre   → Granulation 55%
T2 Post  → Granulation 60%
```

## Web Metrics

Enable:

- Tissue distribution
- Tissue trends
- Case-level comparisons
- Aggregate tissue statistics

---

# 20. Phase 2 — Comorbidity-Aware Analytics

Once tissue data exists, the product may introduce controlled analytics around comorbidities.

Possible analysis dimensions:

- Wound type
- Comorbidity
- Tissue composition
- Healing trend
- Treatment episode

These analytics should remain descriptive unless separately validated for prediction.

---

# 21. Phase 2 Exit Criteria

Phase 2 is complete when:

- Tissue segmentation is validated.
- Tissue percentages are reliable within agreed clinical thresholds.
- Tissue results display correctly in App.
- Tissue results display correctly in Web.
- Historical visits retain Phase 1 results even if Phase 2 data is unavailable.
- Phase 1 workflows continue to function normally.
- Reports can include tissue information where requested.
- Privacy/security controls are unchanged or appropriately extended.
- The Phase 2 model version is traceable for every result.

---

# 22. Phase 3 — Advanced Computer Vision

Phase 3 is roadmap scope and should begin only after Phase 1/2 are stable and clinically validated.

## 22.1 Periwound Analysis

Potential capabilities:

- Identify periwound region.
- Compare periwound to baseline skin.
- Identify maceration.
- Identify erythema/redness.
- Analyze inflammation indicators.

### Key Risk

Redness and inflammation are explicitly harder to identify reliably.

Therefore:

- Do not present speculative classifications as confirmed clinical findings.
- Use confidence indicators.
- Require clinical validation.
- Consider clinician confirmation.

---

## 22.2 Photogrammetry

Potential capabilities:

- Multiple-image capture.
- Video capture.
- Image stitching.
- Large-wound reconstruction.
- 3D wound representation.

This should not block the standard single-image workflow.

---

# 23. Phase 4 — ML / LLM Intelligence

Phase 4 contains advanced intelligence features.

Potential capabilities:

## AI Treatment Suggestions

System may surface candidate treatment considerations.

This should be:

- Clearly separated from clinician decisions.
- Explainable.
- Confidence-aware.
- Validated before clinical use.

## Auto-generated Reports

Generate draft narrative summaries from structured patient data.

The clinician should review/approve before sharing.

## Predictive Healing

Potential future capabilities:

- Healing trajectory
- Risk indicators
- Trend prediction

These are higher-risk medical decision-support features and require appropriate validation.

## AI Trend Tracking

Track:

- Wound area
- Shape
- Tissue distribution
- Periwound state
- Clinical trend

---

# 24. Ecosystem Roadmap

These features should remain separate from the core MVP.

## EHR Integration

Potential:

- Hospital EHR connection
- Service-provider EHR connection
- Patient data synchronization

Dependency:

- Security
- Interoperability
- Privacy
- Vendor integration
- Regulatory review

## FSM Integration

Potential:

- Request therapy
- Create FSM case

Current approved scope:

> One-way trigger only; no data pull-back.

## Advanced Roles & Permissions

Future:

- Doctor
- Nurse
- Reviewer
- Admin
- Front desk
- Organization admin

The current system should be architected to support this later.

---

# 25. Release Dependency Map

```text
PHASE 0
Foundation
   │
   ▼
PHASE 1
Clinical Workflow + Phase 1 AI
   │
   ├──────────────► Web Portal
   │
   ├──────────────► Reporting
   │
   ├──────────────► Offline Sync
   │
   └──────────────► Clinical Validation
                         │
                         ▼
                    PHASE 2
                 Tissue Segmentation
                         │
                         ├────► Tissue Metrics
                         ├────► Tissue Trends
                         └────► Comorbidity Analytics
                                      │
                                      ▼
                                  PHASE 3
                            Advanced Computer Vision
                                      │
                                      ▼
                                  PHASE 4
                            ML / LLM / Ecosystem
```

---

# 26. Feature-to-Phase Matrix

| Feature | P0 | P1 | P1A | P2 | P3 | P4 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Authentication | ✓ | | | | | |
| Password reset | ✓ | | | | | |
| Patient registration | ✓ | ✓ | ✓ | | | |
| Case creation | ✓ | ✓ | ✓ | | | |
| Treatment tracking | | ✓ | ✓ | | | |
| Pre/Post phases | | ✓ | ✓ | | | |
| Revisit assessment | | ✓ | ✓ | | | |
| Image capture | | ✓ | ✓ | | | |
| Calibration | | ✓ | ✓ | | | |
| Image quality checks | | ✓ | ✓ | | | |
| Phase 1 segmentation | | ✓ | ✓ | | | |
| Wound measurements | | ✓ | ✓ | | | |
| Offline mode | ✓ | ✓ | ✓ | | | |
| Sync/conflict handling | ✓ | ✓ | ✓ | | | |
| PDF reports | | ✓ | ✓ | ✓ | | |
| Web portal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Review queue | | ✓ | ✓ | ✓ | | |
| Patient sharing | | ✓ | ✓ | | | |
| Live case links | | ✓ | ✓ | | | |
| Notifications | ✓ | ✓ | ✓ | | | |
| Tissue segmentation | | | | ✓ | | |
| Tissue percentages | | | | ✓ | | |
| Tissue analytics | | | | ✓ | | |
| Periwound AI | | | | | ✓ | |
| Photogrammetry | | | | | ✓ | |
| AI treatment suggestions | | | | | | ✓ |
| Predictive healing | | | | | | ✓ |
| Auto-generated reports | | | | | | ✓ |
| EHR integration | | | | | | ✓ |
| Advanced RBAC | | | | | | ✓ |
| FSM integration | | | | | | ✓ |

---

# 27. Phase Governance

Each phase should use the following gates.

## Gate 1 — Scope Freeze

Before development:

- Requirements frozen.
- Clinical option lists identified.
- TBDs assigned owners.
- Dependencies documented.
- Acceptance criteria agreed.

## Gate 2 — Development Complete

Before QA:

- Feature implementation complete.
- Unit tests complete.
- Integration tests complete.
- API contracts stable.

## Gate 3 — QA Complete

Verify:

- Functional behavior.
- Cross-device behavior.
- Offline behavior.
- Security.
- Performance.
- Error handling.

## Gate 4 — Clinical Validation

For clinical/AI functionality:

- Clinical review.
- Dataset validation.
- Failure-mode review.
- Human-factors review.

## Gate 5 — Release Approval

Require:

- Product approval.
- Engineering approval.
- QA approval.
- Clinical approval where applicable.
- Security/privacy approval.
- Regulatory review where required.

---

# 28. Cross-Phase Non-Functional Requirements

These requirements apply to every release.

## Security

- Encryption at rest.
- Secure transport.
- Secure authentication.
- Strong session controls.
- Appropriate authorization.
- Audit logging.

## Privacy

- Consent management.
- Data minimization.
- Private-area image protection.
- Controlled sharing.
- Metadata protection.
- Retention/deletion policy.

## Reliability

- Offline resilience.
- Safe retry.
- Data integrity.
- Backup/recovery.

## Performance

Performance targets must be defined for:

- Image capture.
- AI inference.
- Result rendering.
- Offline save.
- Sync.
- Report generation.

## Observability

Track:

- Application errors.
- Sync failures.
- AI failures.
- Low-confidence image rates.
- Capture retake rates.
- Report generation failures.
- API failures.

Avoid collecting unnecessary patient-identifying information in telemetry.

---

# 29. Phase 1 Recommended Sprint Breakdown

## Sprint 1 — Foundation

- Authentication
- Patient entity
- Case entity
- Treatment entity
- Phase entity
- Navigation
- API/database skeleton

## Sprint 2 — Patient & Case

- Patient registration
- Wound location
- New Case Form
- Clinical fields
- Validation

## Sprint 3 — Treatment & Revisit

- Treatment creation
- Pre/Post phases
- Questions
- Revisit form
- Pre-fill logic

## Sprint 4 — Image Capture

- Camera flow
- Guide box
- Calibration
- Manual reference
- Image quality
- Retake

## Sprint 5 — Phase 1 AI

- Segmentation
- Measurement
- Shape analysis
- Confidence
- Result screen

## Sprint 6 — Offline + Sync

- Local persistence
- Queue
- Sync
- Retry
- Sync status
- Conflict detection

## Sprint 7 — Reporting + Portal

- Reports
- PDF
- Patient list
- Case view
- Review queue
- Dashboard

## Sprint 8 — Hardening

- Security
- Privacy
- Clinical sign-off
- AI validation
- Error handling
- Pilot readiness

> Sprint duration should be decided by the engineering team; the sequence is more important than a fixed calendar duration.

---

# 30. Definition of Done by Phase

## A feature is "Done" when:

- Requirement implemented.
- UI reviewed.
- API/database behavior validated.
- Unit tests pass.
- Integration tests pass.
- Error states handled.
- Offline behavior handled where applicable.
- Security implications reviewed.
- Analytics/telemetry reviewed.
- Documentation updated.
- Acceptance criteria pass.

## AI feature additional requirements

- Model version recorded.
- Input constraints documented.
- Confidence behavior defined.
- Failure modes tested.
- Validation dataset documented.
- Clinical review completed where required.
- Model rollout/rollback strategy defined.

---

# 31. Major Risks by Phase

| Phase | Risk | Mitigation |
|---|---|---|
| P0 | Poorly designed data hierarchy creates later migration pain. | Freeze core entities and relationships early. |
| P1 | AI measurement is unreliable for poor images. | Calibration, quality checks, confidence, retake workflow. |
| P1 | Proposed clinical options are treated as final. | Mandatory clinical sign-off gate. |
| P1 | Offline edits overwrite each other. | Versioning + defined conflict resolution. |
| P1 | Sensitive images are over-shared. | Privacy-by-design and controlled sharing. |
| P1A | MVP passes functional tests but fails real clinical workflow. | Human-factors and clinical pilot testing. |
| P2 | Tissue segmentation is mistaken for diagnosis. | Clear presentation, confidence, and clinical validation. |
| P3 | Periwound/redness analysis produces false confidence. | Conservative confidence handling and clinician confirmation. |
| P4 | AI recommendations become unsafe decision support. | Formal validation, governance, explainability, and regulatory review. |

---

# 32. Final Phase Principles

1. **Ship the complete workflow before advanced intelligence.**
2. **Keep Phase 1 AI and Phase 2 AI technically separable.**
3. **Never silently turn proposed clinical options into requirements.**
4. **Never hide low-confidence AI output.**
5. **Do not let lack of connectivity block clinical capture.**
6. **Treat wound images and metadata as sensitive data.**
7. **Keep treatment-delivered data separate from wound-condition data.**
8. **Use one report/data definition across App and Web.**
9. **Validate clinical behavior before expanding AI claims.**
10. **Design the foundation for future EHR, FSM, RBAC, and advanced AI without making them MVP dependencies.**
