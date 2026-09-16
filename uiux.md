# UI/UX SPECIFICATION
## Doctor-Facing Wound Care Platform — iOS + Android + Admin Web Portal

> Definitive UI/UX implementation specification based on `prd.md`, `phase.md`, `techspec.md`, and the supplied canonical workflow.

## 1. Executive UX Vision

This product is a longitudinal wound-care platform, not a collection of disconnected medical forms.

The primary mental model is:

> “I am following a wound over time.”

The experience must make this journey clear:

**Patient → Case/Wound → Treatment → Pre/Post → Image + Clinical Questions → Client ML/CV Analysis → Result → Report → PDF / Live Share**

The Case experience is the central longitudinal source of truth. A clinician should understand what wound is being viewed, its current state, prior treatment history, before/after changes, current assessment, and next step without excessive navigation.

The visual language should communicate:
- Clinical credibility
- Trust
- Calm
- Precision
- Modernity
- Premium quality
- Simplicity

Avoid generic SaaS/AI aesthetics, decorative UI, excessive gradients, excessive glassmorphism, arbitrary rounded cards, and animation that does not improve comprehension.

---

# 2. Critical UX Rules

## Never assume

When a requirement, clinical value, model behavior, interaction, or technical detail is missing, ambiguous, conflicting, or undecided:

**ASK THE PRODUCT OWNER BEFORE IMPLEMENTING IT.**

Do not invent requirements.

## Client-provided ML/CV model

The ML/CV model is supplied by the client.

UX must be based on the actual client model contract.

Do not invent:
- Model capabilities
- Model outputs
- Confidence semantics
- Medical accuracy
- Model limitations
- Unsupported classifications

The UI must handle:
- Input state
- Processing state
- Result state
- Confidence/uncertainty where supplied
- Model errors
- Unsupported input
- Retry/retake

The product engineering team integrates the model; it does not invent, train, replace, or silently modify it.

## Clinical requirements

Never invent:
- Clinical classifications
- Pain scale
- Infection criteria
- Treatment recommendations
- Wound-type taxonomy
- Exudate rules
- Periwound rules
- Medical decision logic

Items marked TBD, Proposed, Roadmap, Clinical Sign-off, or Out of Scope remain unresolved until approved.

---

# 3. Platforms

## iOS

Use:
- Native iOS navigation patterns
- Safe areas
- Sheets/modals
- Gestures where useful
- Native keyboard behavior
- Native camera/permission patterns
- VoiceOver
- Dynamic Type
- Appropriate touch targets

## Android

Use:
- Native Android navigation patterns
- Correct back behavior
- Android permission patterns
- Native camera behavior
- TalkBack
- Device-size variation handling
- Appropriate touch targets

## Admin Web Portal

The Web Portal is primarily a desktop review and management experience.

Optimize for:
- Search
- Filtering
- Scanning
- Tables
- Timelines
- Charts
- Review queues
- Patient/case management
- Reporting
- Data export
- Operational visibility

Do not stretch the mobile UI onto desktop.

---

# 4. Canonical User Flow

```text
USER / DOCTOR
      ↓
    LOGIN
      ↓
PATIENT HOME / LIST
      ├─────────────────────┐
      ↓                     ↓
ADD PATIENT             EXISTING
      ↓                     ↓
PATIENT INTAKE          PATIENT PAGE
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
                  CASE 1              CASE 2
                    ↓
               CASE DETAIL
                    ↓
             ┌──────┼──────┐
             ↓      ↓      ↓
            T1     T2     T3
             ↓
          ┌──┴──┐
          ↓     ↓
         PRE   POST
          ↓
      ┌───┴─────────┐
      ↓             ↓
 IMAGE CAPTURE   QUESTIONS
      ↓
  CLIENT ML/CV
      ↓
    RESULT
      ↓
   REPORT
    ├── PDF
    └── LIVE SHARE
```

Important domain distinction:

```text
PATIENT ≠ CASE ≠ TREATMENT ≠ PHASE
```

A Patient can have multiple Cases.

A Case represents one wound.

A Case can contain multiple Treatments:

```text
T1
T2
T3
...
```

Each Treatment contains:

```text
PRE
POST
```

Phase contains visit-specific information:
- Image
- Clinical questions
- Measurements
- Wound condition
- Client ML/CV analysis where applicable

Treatment contains care-episode information:
- Therapy
- Dressing
- Next visit/action date

---

# 5. Information Architecture

```text
Authentication
└── Login

Doctor Workspace
└── Home / Patient List
    ├── Search
    ├── Add Patient
    │   └── Patient Intake
    │       └── New Case
    │
    └── Patient
        ├── Patient Overview
        └── Cases
            ├── Case 1
            │   └── Case Detail
            │       ├── Overview
            │       ├── T1
            │       │   ├── Pre
            │       │   │   ├── Image Capture
            │       │   │   ├── Questions
            │       │   │   └── Result
            │       │   └── Post
            │       │       ├── Image Capture
            │       │       ├── Questions
            │       │       └── Result
            │       ├── T2
            │       ├── T3
            │       └── Report
            │           ├── PDF
            │           └── Live Share
            │
            └── Case 2
```

---

# 6. Mobile Core Screen Inventory

| ID | Screen | Purpose |
|---|---|---|
| M01 | Login | Authenticate user |
| M02 | Home / Patient List | Main patient workspace |
| M03 | Patient Intake | Create patient |
| M04 | Patient Page | Patient-level overview |
| M05 | New Case | Create one wound |
| M06 | Case Detail | Longitudinal wound source of truth |
| M07 | Treatment Detail | Care episode |
| M08 | Phase Overview | Pre/Post context |
| M09 | Clinical Questions | Visit-specific observations |
| M10 | Image Capture | Capture wound image |
| M11 | Image Review / Quality | Validate image |
| M12 | AI Processing | Show client-model processing |
| M13 | Result | Display model results |
| M14 | Report Builder | Select treatments |
| M15 | Report Preview | Review report |
| M16 | Share | PDF/live sharing |
| M17 | Sync Status | Offline/sync feedback |
| M18 | Search | Patient discovery |
| M19 | Account / Settings | Account controls |

---

# 7. Web Core Screen Inventory

| ID | Screen | Purpose |
|---|---|---|
| W01 | Login | Authentication |
| W02 | Dashboard | Operational overview |
| W03 | Patient List | Search/manage patients |
| W04 | Patient Detail | Patient overview |
| W05 | Patient Registration | Full registration |
| W06 | Case Detail | Longitudinal review |
| W07 | Treatment Timeline | T1/T2/T3 review |
| W08 | Review / Flag Queue | Worklist |
| W09 | Report Builder | Report scope |
| W10 | Report Preview | Review/export |
| W11 | Data Export | CSV/report export |
| W12 | Share Management | Sharing controls |
| W13 | Account / User Access | Current simple authenticated access |

---

# 8. Mobile Screen Specifications

## M01 — Login

### Purpose
Securely authenticate a doctor.

### Primary CTA
**Sign In**

### Secondary
- Sign Up
- Find Account
- OTP/biometric entry where supported

### States
- Loading
- Invalid credentials
- Verification required
- Network unavailable
- Session expired

### UX
Keep the authentication surface calm and professional. Avoid unnecessary marketing content.

---

## M02 — Home / Patient List

### Purpose
Primary patient workspace.

### Layout

```text
Header
 ├── Context
 ├── Search
 └── Add Patient

Patient Workspace
 ├── Status/summary
 └── Patient list
```

### Patient Card/Row

Show:
- Latest wound image/thumbnail
- Patient name
- Patient ID
- Relevant wound/case context
- Current status
- Next visit
- Needs Review where applicable

### Primary CTA
**Add Patient**

### States
- Loading
- Empty
- Error
- Offline
- Sync pending

### Empty copy
> No patients yet. Add your first patient to begin tracking a wound.

---

## M03 — Patient Intake

### Purpose
Create a patient.

### Sections

**Identity**
- First name
- Last name
- Patient ID
- Sex
- DOB/age

### UX
Group fields logically rather than presenting an undifferentiated form.

Preserve entered data during validation failures.

---

## M04 — Patient Page

### Purpose
Represent patient-level identity and cases.

### Structure

```text
Patient Header
 ├── Identity
 ├── Key details
 └── Privacy-aware actions

Cases
 ├── Case 1
 ├── Case 2
 └── ...
```

### Case Card

Show:
- Latest wound image
- Wound type
- Location
- Last assessment
- Current status

**Share Patient** is privacy-sensitive and must clearly communicate personal-data visibility.

---

## M05 — New Case

### Purpose
Create one wound/case.

### Sections

**Wound Onset**
- Onset date

**Wound Location**
- Front/back
- Male/female private-region mode
- Human-body diagram
- Progressive zoom
- Extra-grid label where applicable

**Clinical Baseline**
- Wound type
- Exudate
- Infection signs
- Pain
- Edge/periwound condition
- Comorbidities

**AI Capture**
- Continue to Image Capture

Clinical lists marked proposed/TBD require approval before implementation.

---

## M06 — Case Detail

### Purpose
Primary longitudinal source of truth for one wound.

### Recommended hierarchy

```text
CASE HEADER
 ├── Wound type
 ├── Location
 ├── Onset
 ├── Current status
 └── Next action

CURRENT STATE
 ├── Latest image
 ├── Latest measurements
 ├── Last assessment
 └── Next visit

TREATMENT TIMELINE
 ├── T1
 │   ├── Pre
 │   └── Post
 ├── T2
 │   ├── Pre
 │   └── Post
 └── T3
     ├── Pre
     └── Post

ACTIONS
 ├── Add Treatment / Assessment
 ├── Report
 └── Share
```

### Core principle

A clinician should understand progression without repeatedly opening unrelated screens.

### Timeline

Use a visual treatment timeline where Pre/Post relationships are unmistakable.

---

## M07 — Treatment Detail

### Purpose
Represent a care episode.

### Display
- T1/T2/T3
- Therapy given
- Dressing
- Next visit/action date
- Pre/Post progression

### Critical distinction
Treatment = care delivered.

Phase = wound state/visit information.

---

## M08 — Phase Overview

### Purpose
Make Pre/Post context impossible to miss.

Use explicit language:

**BEFORE TREATMENT**

and:

**AFTER TREATMENT**

Example:

```text
Treatment T2

PRE
Before treatment
[Continue]

POST
After treatment
[Continue]
```

Do not rely only on color.

---

## M09 — Clinical Questions

### Purpose
Capture visit-specific observations.

Potential approved groups:
- Pain
- Exudate
- Infection signs
- Edge condition
- Periwound condition
- Wound appearance trend
- Comorbidity update
- Notes where approved

### Input patterns
- Radio/select for single choice
- Multi-select for multiple findings
- Clear required/optional indicators

### Continuity

When values are carried forward, clearly label them as inherited.

---

## M10 — Image Capture

### Purpose
Capture a clinically useful AI-eligible image.

### Flow

```text
OPEN CAMERA
 ↓
FRAME WOUND
 ↓
CALIBRATION
 ↓
GUIDANCE
 ↓
QUALITY CHECK
 ↓
MASK PREVIEW
 ↓
ACCEPT / RETAKE
 ↓
CLIENT ML/CV
```

### UI Elements
- Camera preview
- Wound framing guide
- Calibration state
- Capture control
- Image quality status
- Calibration guidance
- Permission/flash controls according to platform

### Guidance

The UI should help answer:

> “Is this image good enough?”

before submission.

### Failure cases
- Permission denied
- Camera unavailable
- Blur
- Poor framing
- Calibration missing
- Processing failure
- Low confidence
- Complex/large wound

---

## M11 — Image Review / Quality

### Purpose
Let the clinician verify the captured image.

### Display
- Image
- Calibration status
- Quality state
- Retake
- Use Image

### Quality states
- Ready
- Blur detected
- Poor framing
- Calibration missing
- Unsupported
- Duplicate
- Low-confidence potential

Exact thresholds are technical/model details, not invented UX rules.

---

## M12 — AI Processing

### Purpose
Communicate processing by the client-provided model.

### Preferred copy
> Analyzing wound image…

Avoid theatrical “AI magic” interactions.

### UI
- Processing state
- Progress only if technically available
- Safe wait state
- Cancel if supported

### Failure
Provide:
- Explanation
- Retry
- Retake if relevant
- Return to case

---

## M13 — Result

### Purpose
Present client ML/CV output clearly.

### Phase 1
Show only supported/available client outputs, including as defined by the PRD:
- Wound area
- Length × height
- Major/minor axis
- Shape analysis

### Phase 2
Only after Phase 2 release:
- Tissue percentages
- Approved tissue categories

### Layout

```text
RESULT HEADER
 ↓
Wound Visualization
 ↓
Key Measurement
 ↓
Supporting Measurements
 ↓
Confidence/Quality if supplied
 ↓
Context/Comparison
 ↓
Next Action
```

### Source distinction

Clearly distinguish:
- AI-generated information
- Clinician-entered observations

Never present an AI output as a diagnosis unless explicitly supported by approved requirements.

---

## M14 — Report Builder

### Purpose
Choose treatments for report generation.

Example:

```text
Treatments
☑ T1
☑ T2
☐ T3
```

Primary CTA:

**Generate Report**

---

## M15 — Report Preview

### Purpose
Review report before export/share.

### Actions
- Download PDF
- Share
- Back

Do not over-specify report content that is still evolving.

---

## M16 — Share

### Options

```text
Share PDF
Share Live
```

### Privacy

Clearly communicate included/excluded personal information.

Live sharing must be controlled and must not expose raw public storage URLs.

---

## M17 — Sync Status

### States

```text
Offline
Saved locally
Sync pending
Syncing
Synced
Sync failed
Conflict requires review
```

### UX

Keep synchronization status visible but unobtrusive.

Success should not interrupt clinical work.

---

# 9. Web Portal Screen Specifications

## W01 — Login

Desktop authentication flow with the same account model.

---

## W02 — Dashboard

### Purpose
Operational overview.

### Primary information
- Total patients
- Active cases
- Treatments this week
- Pending reviews
- Meaningful charts

Every visualization should support an operational question.

---

## W03 — Patient List

Use a desktop table.

Recommended columns:
- Patient
- Patient ID
- Active case
- Wound type
- Status
- Last assessment
- Next visit

Interactions:
- Search
- Sorting where useful
- Filtering where useful
- Open patient

---

## W04 — Patient Detail

```text
Patient Header
 ├── Identity
 ├── Status
 └── Actions

Cases
 ├── Case 1
 ├── Case 2
 └── ...
```

Keep patient-level information distinct from case-level wound information.

---

## W05 — Patient Registration

Full registration workflow.

Use desktop width to make structured entry efficient without creating a dense wall of controls.

---

## W06 — Case Detail

### Purpose
Desktop longitudinal review.

### Recommended layout

```text
Case Header
─────────────────────────────
Current Summary

Latest Result
─────────────────────────────

Treatment Timeline
─────────────────────────────
T1        T2        T3
PRE/POST  PRE/POST  PRE/POST

Images / Measurements
─────────────────────────────

Clinical Assessment
─────────────────────────────

Flags / Next Visit
```

The reviewer should understand progression quickly.

---

## W07 — Treatment Timeline

```text
T1
 ├── Pre
 │    ├── Image
 │    ├── AI Result
 │    └── Assessment
 └── Post
      ├── Image
      ├── AI Result
      └── Assessment
```

Repeat for T2/T3.

Allow focused treatment inspection while keeping the overall timeline visible.

---

## W08 — Review / Flag Queue

Unified desktop worklist for:
- Flagged
- Overdue
- Needs Review

Reuse the exact same status taxonomy as Mobile.

---

## W09 — Report Builder

Desktop treatment-selection experience.

Use the larger canvas for easy multi-treatment selection and report scope.

---

## W10 — Report Preview

Actions:
- Download PDF
- Share
- Return to builder

---

## W11 — Data Export

Support approved:
- CSV
- Formatted report downloads

Clearly show privacy/de-identification implications where applicable.

---

## W12 — Share Management

For live shares:
- Access information
- Expiration
- Status
- Revoke
- Audit information where approved

---

# 10. Longitudinal Case Timeline

The timeline is a signature product experience.

## Goal

Make wound progression understandable across treatments.

```text
CASE
│
├── T1
│   ├── PRE
│   │   Image
│   │   Measurement
│   │   Assessment
│   │
│   └── POST
│       Image
│       Measurement
│       Assessment
│
├── T2
│   ├── PRE
│   └── POST
│
└── T3
    ├── PRE
    └── POST
```

Support:
- Current vs previous
- Pre vs Post
- Treatment-to-treatment progression

Do not overload the initial timeline view with every possible field.

---

# 11. Pre-fill UX

Workflow:

```text
Previous Treatment POST
        ↓
Next Treatment PRE
        ↓
Carried-forward values
```

The UI must clearly show:

> Carried forward from T1 Post

The clinician can:
- Accept
- Edit
- Clear

Do not make inherited clinical information look newly entered.

---

# 12. Offline UX

The system should make it obvious that offline work is safe.

### Global state

```text
Offline · Saved locally
```

Then:

```text
Syncing…
```

Then:

```text
All changes synced
```

### Failure

> Some changes could not be synced. We'll retry automatically.

### Conflict

Until the product policy is approved, communicate that review is required rather than inventing merge rules.

---

# 13. AI/ML UX

## External dependency

The client supplies the ML/CV model.

The UX is responsible for representing:

```text
Input
 ↓
Processing
 ↓
Supported output
 ↓
Confidence/quality where supplied
 ↓
Clinical context/action
```

Avoid:
- Futuristic AI decoration
- Anthropomorphic language
- Unsupported claims
- “Diagnosis” language unless explicitly required

## Phase 1 vs Phase 2

### Phase 1
- Segmentation
- Wound area
- Length × height
- Major/minor axis
- Shape

### Phase 2
- Tissue segmentation
- Tissue percentages
- Approved tissue categories

Phase 2 must not appear as an active Phase 1 capability.

---

# 14. Design System

## Visual Direction

The design should communicate:

- Clinical credibility
- Trust
- Calm
- Precision
- Intelligence
- Premium quality
- Simplicity

Avoid:

- Excessive gradients
- Glassmorphism
- Arbitrary rounded cards
- Decorative dashboards
- Excessive animation
- Generic AI/SaaS styling

---

# 15. Design Tokens

## Color Roles

```text
Primary
Secondary
Background
Surface
Elevated Surface
Primary Text
Secondary Text
Muted Text
Border
Disabled
Success
Warning
Error
Information
Clinical Semantic Colors
```

Use semantic color together with text/icon meaning.

## Typography

```text
Display
H1
H2
H3
Body Large
Body
Body Small
Label
Caption
Measurement / Numeric
```

Measurements should be highly scannable.

## Spacing

Use a consistent scale.

## Radius

Use a restrained controlled scale.

## Elevation

Use a light, systematic elevation approach.

---

# 16. Reusable Components

Every component should define:
- Purpose
- Anatomy
- Variants
- States
- Behavior
- Accessibility
- Usage rules

Core components:

- Buttons
- Inputs
- Select/dropdown
- Search
- Cards
- Lists
- Tables
- Tabs
- Dialogs
- Sheets
- Banners
- Alerts
- Toasts
- Loaders
- Skeletons
- Empty states
- Error states
- Camera controls
- Image preview
- Result cards
- Timeline
- Charts
- Filters
- Status badges
- Date controls
- Navigation

Do not convert every piece of content into a card.

---

# 17. Status Taxonomy

Use one shared status system.

Possible states defined by the product include:

- Healing
- Needs Review
- Overdue
- Upcoming

The exact rules must be finalized centrally.

The same rules must drive:
- Mobile Home
- Case status
- Web Review Queue
- Relevant notifications

---

# 18. Error & Edge-State Matrix

Every major workflow must design for:

- Loading
- Empty
- Success
- Validation error
- Network error
- Offline
- Sync pending
- Sync failure
- Permission denied
- Session expired
- Timeout
- Invalid data
- Incomplete data
- Duplicate action
- Cancellation
- Camera unavailable
- Poor image
- Calibration failure
- Unsupported image
- AI unavailable
- AI processing failure
- Low-confidence result

Each state should explain what happened and what the user can do next.

---

# 19. UX Writing

Language must be:
- Professional
- Calm
- Precise
- Non-alarming
- Action-oriented

Avoid generic error copy.

Example:

Instead of:
> Something went wrong.

Use:
> We couldn't process this image. Try another photo or retake the image.

Instead of:
> Submit

Use task-specific actions:
- Save Assessment
- Continue to Result
- Generate Report
- Share PDF
- Share Live

Do not write unsupported clinical conclusions.

---

# 20. Accessibility

## iOS
- VoiceOver
- Dynamic Type
- Focus/order
- Touch targets
- Semantic labels

## Android
- TalkBack
- Appropriate touch targets
- Semantic labels
- Accessibility focus behavior

## Web
- Keyboard navigation
- Visible focus
- Semantic headings
- Form labels
- Accessible dialogs
- Table semantics

## Universal

Never communicate critical state using color alone.

---

# 21. Motion & Microinteractions

Use motion only when it clarifies state.

Define motion for:
- Capture confirmation
- Image validation
- AI processing
- Result reveal
- Save/success
- Error
- Sync
- Navigation

Reduced-motion mode must be respected.

Avoid animation simply to make the product look “AI”.

---

# 22. Responsive Behavior

## Mobile

Support:
- Small phones
- Standard phones
- Large phones
- Keyboard
- Rotation where supported

## Tablet

Use additional space intelligently without creating a desktop clone.

## Web

Support:
- Standard desktop
- Large desktop

Handle:
- Long names
- Long clinical text
- Large images
- Missing data
- Wide tables
- Long timelines

---

# 23. Privacy UX

Privacy should be apparent without interrupting clinical workflows.

## Patient sharing

Clearly show what personal data is hidden or included.

## Live sharing

Make access scope explicit.

## Private-area wounds

Avoid unnecessary exposure in list thumbnails/previews and protect access appropriately.

## Metadata

GPS/timestamp/device metadata should be handled automatically according to approved privacy requirements.

---

# 24. FSM Handoff UX

Where approved, Treatment may contain:

**Request Therapy**

This is a one-way handoff.

Do not design a full FSM management interface.

Do not create two-way synchronization without explicit scope approval.

---

# 25. Analytics / Events

Use privacy-conscious product analytics.

Potential events:

```text
login_completed
patient_created
case_created
treatment_created
phase_started
image_capture_started
image_capture_completed
image_retaken
image_quality_failed
ai_processing_started
ai_result_completed
ai_result_low_confidence
assessment_saved
report_generated
report_shared
live_share_created
sync_started
sync_completed
sync_failed
```

Do not send raw wound images or raw clinical notes to generic analytics systems without explicit approval.

---

# 26. Traceability Matrix

| Requirement | UX Representation | Platform | Phase |
|---|---|---|---|
| Authentication | Login | iOS/Android/Web | P0/P1 |
| Patient registration | Patient Intake | iOS/Android/Web | P1 |
| Multiple cases | Patient → Cases | iOS/Android/Web | P1 |
| One wound per case | Case Detail | iOS/Android/Web | P1 |
| Multiple treatments | Treatment Timeline | iOS/Android/Web | P1 |
| Pre/Post | Phase Overview | iOS/Android | P1 |
| Clinical questions | Questions | iOS/Android/Web review | P1 |
| Image capture | Camera | iOS/Android | P1 |
| Calibration | Capture | iOS/Android | P1 |
| Client Phase 1 ML | AI Processing + Result | iOS/Android | P1 |
| Wound measurements | Result | iOS/Android/Web | P1 |
| Tissue % | Phase 2 Result | iOS/Android/Web | P2 |
| Pre-fill | Carried-forward state | iOS/Android | P1 |
| Offline | Sync UX | iOS/Android | P1 |
| PDF reports | Report flow | iOS/Android/Web | P1 |
| Live share | Share flow | iOS/Android/Web | P1 |
| Dashboard | Dashboard | Web | P1 |
| Patient management | Patient List | Web | P1 |
| Review queue | Flag Queue | Web | P1 |
| Data export | Export | Web | P1 |
| Periwound AI | Future UX | Future | P3 |
| Photogrammetry | Future UX | Future | P3 |
| ML/LLM | Future UX | Future | P4 |

---

# 27. Phase Control

## Phase 1 UI/UX

The first production UX must contain only approved Phase 1 functionality:

- Patient
- Case
- Treatment
- Pre/Post
- Clinical questions
- Image capture
- Calibration
- Client-provided Phase 1 ML
- Measurement results
- Offline
- Sync
- Reporting
- PDF
- Live sharing
- Web portal
- Review queue

## Phase 2 UI/UX

Introduces:

- Tissue segmentation
- Tissue percentages
- Approved tissue categories
- Tissue visualization
- Tissue trends
- Phase 2 reporting
- Phase 2 metrics

Phase 2 should extend the existing design system rather than redesign Phase 1.

---

# 28. Open Questions

The UX specification must visibly preserve unresolved questions.

## Product
- Exact status rules
- Final report visual structure
- Live-share recipient permissions
- Live-share expiration
- Live-share revocation
- Offline conflict resolution
- Notification behavior

## Clinical
- Final pain scale
- Final wound-type list
- Final exudate list
- Final infection list
- Final edge/periwound list
- Final comorbidity list

## Client ML/CV
- Exact model input contract
- Exact model output contract
- Supported Phase 1 outputs
- Supported Phase 2 outputs
- Confidence representation
- Runtime constraints
- Processing-time characteristics

Unknowns must be escalated to the product owner rather than guessed.

---

# 29. UX Review Checklist

Before design/implementation approval, verify:

## Clinical
- [ ] Patient vs Case is unmistakable.
- [ ] Treatment vs Phase is unmistakable.
- [ ] Pre vs Post is unmistakable.
- [ ] Longitudinal progression is understandable.
- [ ] Clinical observations are separated from AI outputs.

## Workflow
- [ ] Core workflow is fast.
- [ ] Errors are recoverable.
- [ ] Retake is easy.
- [ ] Offline state is visible.
- [ ] Sync state is understandable.

## AI
- [ ] Client model is treated as external dependency.
- [ ] Only supported outputs appear.
- [ ] Confidence is shown only according to the model contract.
- [ ] No unsupported medical claim is made.
- [ ] Phase 2 does not leak into Phase 1.

## Web
- [ ] Admin/reviewer can scan patients and cases quickly.
- [ ] Dashboard is operationally useful.
- [ ] Timeline is readable.
- [ ] Review queue is actionable.
- [ ] Export and report flows are understandable.

## Visual
- [ ] Premium without decoration.
- [ ] Consistent hierarchy.
- [ ] Reusable design system.
- [ ] No generic AI dashboard aesthetic.

## Accessibility
- [ ] Screen-reader usable.
- [ ] Keyboard usable on Web.
- [ ] Dynamic text supported.
- [ ] Color is not the only status signal.

## Privacy
- [ ] Sensitive images protected.
- [ ] Sharing is controlled.
- [ ] Private-area data is handled carefully.
- [ ] Metadata visibility is considered.

---

# 30. Final UX Standard

The product should feel like:

> **A world-class clinical product that happens to be beautifully designed.**

Not:

> **A beautiful interface pretending to be a clinical product.**

Every screen should reinforce one story:

```text
PATIENT
  ↓
CASE / WOUND
  ↓
TREATMENT
  ↓
PRE
  ↓
IMAGE + QUESTIONS
  ↓
CLIENT ML/CV
  ↓
RESULT
  ↓
POST
  ↓
IMAGE + QUESTIONS
  ↓
RESULT
  ↓
NEXT TREATMENT
  ↓
PROGRESSION
  ↓
REPORT
  ↓
PDF / LIVE SHARE
```

The Case Detail experience should remain the center of this journey, while the camera, AI result, Pre/Post relationship, and report/share flows should each feel like deliberate parts of the same clinical product.
