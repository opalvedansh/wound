# Product Requirements Document (PRD)
## Doctor-Facing Wound Care App + Web Portal

> PRD derived from the supplied product-flow, data-model, AI roadmap, intake-form, revisit-assessment, and ideas/specification screenshots.

---

## 1. Executive Summary

The product is a doctor-facing wound assessment and longitudinal case-management system consisting of:

- A **mobile app** for point-of-care capture, assessment, treatment documentation, and case review.
- A **desktop web portal** for review, reporting, management, patient registration, and data export.
- A phased **computer-vision (CV/AI) roadmap** for wound measurement and tissue analysis.

The core data hierarchy is:

**Patient → Case → Treatment → Phase → Assessment / Image / AI Result → Report**

A patient is registered once and may have multiple wound cases. Each case represents one wound and is tracked over time. Each treatment represents a care episode (T1, T2, T3…), and each treatment contains a Pre and Post phase.

The first AI release is deliberately phase-gated:

- **Phase 1:** wound segmentation, calibrated sizing, area, L×H major/minor axes, and shape analysis.
- **Phase 2:** tissue segmentation and tissue percentage by category.
- More advanced photogrammetry, ML/LLM analysis, and periwound analysis remain roadmap items.

---

## 2. Product Goals

1. Create a reliable longitudinal record of wound condition, treatment, images, measurements, and clinical progress.
2. Make wound capture fast enough for point-of-care use.
3. Use computer vision to reduce manual wound measurement and improve consistency.
4. Allow clinicians to review cases, track progress, and generate shareable reports.
5. Support offline clinical capture and synchronization when connectivity returns.
6. Maintain appropriate privacy, security, consent, and regulatory controls.
7. Keep the underlying data model clean and consistent across the mobile app and web portal.
8. Ensure Phase 1 and Phase 2 AI development remain independently releasable.

---

## 3. Non-Goals / Deferred Scope

The following are not part of the initial committed build unless explicitly promoted later:

- Full EHR integration.
- Full role hierarchy / advanced RBAC.
- FSM roster integration.
- Photogrammetry for stitching multiple images/video into large or 3D wounds.
- ML/LLM treatment suggestions.
- Predictive healing analysis.
- AI-generated narrative reports.
- AI trend tracking.
- Subscription/premium management.
- Social/community features.
- Enterprise self-service.
- Training videos / LMS.

---

## 4. Users & Primary Jobs-to-be-Done

| User | Primary Job | Primary Surface |
|---|---|---|
| Doctor / clinician | Register patients, create wound cases, capture images, assess wounds, document treatment, review trends, and share reports. | Mobile app |
| Doctor / reviewer | Review longitudinal cases, photos, measurements, flags, and reports on a larger screen. | Web portal |
| Management / front-desk staff | Complete full patient intake and perform portal management functions. | Web portal |

---

# 5. Core Domain Model

## 5.1 Patient

A patient is registered once.

Core identity fields:

- First name
- Last name
- Patient ID
- Sex
- Date of birth or age
- Location

Patient registration is performed through the full **Patient Intake Form**.

## 5.2 Case

A case represents **one wound**.

A case is created through the New Case Form and contains:

- Wound onset date
- Wound location
- Baseline wound evaluation
- Baseline wound image / AI result
- Wound type
- Exudate
- Infection signs
- Pain
- Edge/periwound condition
- Baseline comorbidities

## 5.3 Treatment

A treatment represents one care episode:

- T1
- T2
- T3
- etc.

Treatment stores care-delivered information such as:

- Therapy given
- Dressing type
- Next visit/action date

Treatment must remain separate from wound-condition observations.

## 5.4 Phase

Each treatment has:

- **Pre phase**
- **Post phase**

The Phase is the container for information that changes visit-to-visit.

It includes:

- Image Capture
- AI results
- Revisit clinical assessment
- Measurements
- Wound appearance trend
- Other visit-specific observations

## 5.5 Report

A report combines selected treatments into a shareable summary.

The user can:

- Select treatments
- Generate a PDF
- Share the report
- Potentially share a live case link

---

# 6. Mobile App Requirements

## 6.1 Login

### Requirements

The app shall support:

- Email/phone + password
- OTP authentication
- Device lock / biometric authentication such as fingerprint or face
- Signup
- Find account

### Open Item

Password-reset behavior is not defined. A standard email/OTP reset flow should be evaluated before build.

---

## 6.2 Home Page

### Requirements

The Home page shall display:

- Patient list
- Patient thumbnails using the latest image
- Patient name / ID
- Current status at a glance
- Healing
- Needs Review
- Overdue
- Next visit date
- Search
- Delete
- Add New Patient
- Navigation to patient page

### Flow

**Add New Patient → New Case Form**

**Tap Patient → Patient Page**

### Important Dependency

Status-tag rules must be defined once and reused by:

- Mobile Home
- Web Review / Flag Queue

---

## 6.3 Patient Page

### Requirements

Display:

- Basic patient details
- Notes
- Wound type
- Patient's cases
- Latest image
- Last assessment date

Each case should appear as a thumbnail/card.

### Sharing

**Share Patient** should support hiding personal details.

### Flow

**Tap Case → Case Page**

### Important Note

Full registration occurs through the Patient Intake Form, not the lightweight Patient Page.

---

## 6.4 Case Page

A Case represents one wound tracked over time.

### Requirements

Display:

- Treatment history
- Visit dates
- Treatments
- Progress
- Assessments
- Images
- Measurements
- Flags

### Actions

- Add Assessment
- Create treatment
- Delete case
- Share PDF
- Share live case link

### Sharing

A case share is explicitly intended to support:

1. Static PDF
2. Live link

The live link must not be treated as merely a static PDF.

---

## 6.5 Report / Status

### Requirements

The screen shall allow the clinician to:

- View current status
- Select treatments to include
- Generate PDF
- Download PDF
- Share PDF

Example:

> Select T1 + T2 → Generate Report

### Open Item

The source contains a naming collision between:

- "Report Status"
- "Add Assessment"

A single canonical name should be selected.

---

## 6.6 Treatment

A treatment groups one care episode:

- T1
- T2
- T3
- etc.

### Requirements

The clinician can:

- View an existing treatment
- Add a new treatment
- View therapy
- View dressing
- View next-visit date

### Data Boundary

Treatment contains **care-delivered fields**.

Wound-condition fields belong to the Phase / Revisit Assessment.

---

## 6.7 Phase (Pre/Post)

Each treatment contains:

- Pre-treatment phase
- Post-treatment phase

### Requirements

The phase records whether the assessment is:

- Before treatment
- After treatment

This is also where:

- Image Capture
- Revisit Tracking Form

are completed.

---

## 6.8 Questions

The Questions screen contains phase-specific clinical questions.

Its content corresponds to the **Revisit Tracking Form**.

The same clinical fields are re-asked at each visit so change over time can be tracked.

---

# 7. Image Capture Requirements

## 7.1 Capture Flow

The app shall:

1. Guide the user to frame the wound using a guide box.
2. Detect a calibration sticker automatically where possible.
3. Allow the user to manually mark a reference length when no sticker is visible.
4. Show a live segmentation-mask preview.
5. Run image-quality checks.
6. Allow the user to retake an image if quality requirements are not met.
7. Flag low-confidence results for large or complex wounds.

## 7.2 Calibration

The calibration process must produce a reliable real-world scale for wound measurement.

Supported approaches:

- Automatic calibration-sticker detection.
- Manual reference-length marking.

## 7.3 Quality Control

The image-quality pipeline should identify issues such as:

- Blur
- Poor framing
- Inadequate visibility
- Invalid calibration
- Duplicate images
- Other known capture failures

## 7.4 AI Deployment Decision

Still TBD:

- On-device inference
- Hosted/server inference

The decision must consider:

- Privacy
- Connectivity
- Latency
- Device capability
- Model update strategy

---

# 8. AI / Computer Vision Requirements

## 8.1 Phase 1 — Committed

Phase 1 delivers:

- Wound segmentation
- Wound sizing
- Area
- L×H
- Major axis
- Minor axis
- Shape analysis

The output powers the App Result screen.

### Phase 1 Requirement

Phase 1 must work from a calibrated wound image.

---

## 8.2 Phase 2 — Committed

Phase 2 delivers tissue segmentation.

Example tissue categories:

- Granulation
- Slough
- Necrotic
- Other clinically approved categories

Output:

**Percentage of wound area by tissue type**

### Phase 2 Rule

Phase 2 should be built and validated after Phase 1 ships.

Phase 2 scope must not leak into the Phase 1 MVP.

---

## 8.3 Photogrammetry — Roadmap

Potential future capability:

- Stitch multiple images
- Stitch video
- Support large wounds
- Support 3D wound representations

---

## 8.4 ML / LLM Analysis — Roadmap

Potential future capabilities:

- AI treatment suggestions
- Auto-generated text reports
- Predictive healing patterns
- AI trend tracking

These are not Phase 1 requirements.

---

## 8.5 Periwound Analysis — Roadmap / Discovery

Potential capabilities:

- Identify periwound region
- Analyze periwound characteristics
- Identify baseline skin for comparison
- Identify maceration
- Analyze redness/inflammation

The specification notes that redness and inflammation are more difficult to identify reliably and require further validation.

---

# 9. Patient Intake Form

## 9.1 Patient Contact

Required:

- First name
- Last name

Additional:

- Patient ID — automatic or manual
- Sex — Male / Female / Other
- Date of birth — date picker or age option

## 9.2 Possible Additions

The source identifies these as ideas requiring confirmation rather than settled requirements:

- Contact number
- Consent checkbox covering:
  - DPDP notice
  - Treatment
  - Photo use
  - AI training use
- Referral source
- Assigned doctor

### Important

These should not be silently added or removed without confirmation.

---

# 10. New Case Form

The New Case Form performs the full clinical evaluation when a wound/case is first opened.

## 10.1 Onset Date

Required.

Definition:

> Date when the wound first appeared.

## 10.2 Wound Location

Required interactive selector.

Requirements:

- Sectioned human-body diagram
- Automatic zoom into finer regions
- Extra-grid label
- Male/Female toggle for private-area regions
- Front/Back toggle

## 10.3 Wound Image AI — Phase 1

Required.

Outputs:

- Area
- L×H
- Major/minor axis
- Shape analysis

The image powers the Result screen.

## 10.4 Wound Image AI — Phase 2

Future/Phase 2 field.

Output:

- Percentage area by tissue type

Examples:

- Granulation
- Slough
- Necrotic

---

# 11. Clinical Data Requirements

## 11.1 Wound Type

Required.

### Common examples

- Pressure Ulcer
- Diabetic Foot Ulcer
- Venous Leg Ulcer

### Proposed uncommon list

- Arterial Ulcer
- Surgical Wound Dehiscence
- Traumatic Wound
- Burn
- Post-Amputation Wound
- Other

### Status

The expanded uncommon list is proposed and requires clinical confirmation.

---

## 11.2 Exudate

Required.

### Level

- None
- Light
- Moderate
- High

### Proposed Type

- Serous
- Sanguineous
- Serosanguineous
- Purulent

The proposed type list requires clinical confirmation.

---

## 11.3 Signs of Infection

Required multi-select.

### Source items

- Erythema in periwound
- Local warmth
- Edema

### Proposed additions

- Purulent discharge
- Malodor
- Increased pain
- Fever/systemic signs

Clinical sign-off is required before treating the expanded list as final.

---

## 11.4 Pain Assessment

Required.

Potential formats:

- 0–10 scale
- Mild / Moderate / Severe

### Open Decision

The exact scale requires clinical input.

---

## 11.5 Edges & Periwound Condition

Required.

### Proposed Edge Options

- Well-defined
- Rolled
- Undermined
- Macerated
- Callused

### Proposed Periwound Skin Options

- Healthy
- Dry/Flaky
- Macerated
- Erythematous
- Fragile

The supplied specification identifies these as proposed options pending clinical sign-off.

---

## 11.6 Patient Comorbidities

Required multi-select at baseline.

Proposed list:

- Diabetes
- Hypertension
- Cardiovascular Disease
- Chronic Kidney Disease
- Peripheral Vascular Disease
- Obesity
- Smoking
- Immunocompromised
- Other
- None

These values feed future Phase 2 comorbidity-aware analytics.

---

# 12. Treatment Follow-up / Revisit Assessment

## 12.1 Wound Therapy Given

Required multi-select.

Examples:

- Debridement
- NPWT
- Dressing change

The final list is TBD.

---

## 12.2 Dressing Type

Required.

Format:

- Dropdown
- Text

### Future Idea

A Triage-branded dressing could potentially be scanned to auto-fill this field and track usage.

---

## 12.3 Next Visit / Action Date

Optional date picker.

---

## 12.4 Revisit Clinical Assessment

The same clinical fields from the New Case Form are re-asked at each visit.

Purpose:

> Track change over time.

Additional visit-specific data:

- Visit date
- Attending doctor
- Next-visit scheduling

The revisit form should not duplicate patient/wound identity parameters unnecessarily.

---

## 12.5 Wound Measurements & Tissue %

Automatically populated from the AI Image Capture result.

### Phase 1

- Area
- L×H
- Major/minor axis
- Shape

### Phase 2

- Tissue percentage by category

These should not be manually re-entered when a valid AI result exists.

---

## 12.6 Pain

Required at every revisit.

Use the same scale as the New Case Form.

---

## 12.7 Exudate

Required at every revisit.

### Level

- None
- Light
- Moderate
- High

### Type

- Serous
- Sanguineous
- Serosanguineous
- Purulent

---

## 12.8 Signs of Infection

Required multi-select at every revisit.

Examples:

- Erythema in periwound
- Local warmth
- Edema
- Purulent discharge
- Malodor
- Increased pain
- Fever/systemic signs

---

## 12.9 Edges & Periwound Condition

Required at every revisit.

The selected option set should be finalized through clinical sign-off.

---

## 12.10 Wound Appearance Trend

Required.

Options:

- Improved
- No Change
- Worsened

This represents the doctor's overall clinical judgment for the visit, alongside AI measurements.

---

## 12.11 Comorbidity Update

Optional multi-select.

Uses the same baseline list plus:

- No Change

This allows a new diagnosis to be captured without rerunning the entire intake process.

---

# 13. Pre-fill Logic

When a new treatment is created:

**Previous Treatment Post → New Treatment Pre**

The next treatment's Pre-phase fields should default from the previous treatment's Post-phase values.

The doctor must be able to:

- Edit inherited values.
- Clear inherited values.

The pre-fill system must not overwrite clinician changes.

---

# 14. Offline Mode & Synchronization

## Requirements

The app shall:

- Work without network signal.
- Store pending changes locally.
- Automatically synchronize when back online.
- Show a visible sync-status indicator.

## Open Decision

The source does not define conflict handling when:

> The same case is edited on two offline devices before either device synchronizes.

A conflict strategy must be defined, such as:

- Last-write-wins
- Field-level merge
- Manual conflict resolution
- Clinician review

---

# 15. Photo Integrity

Every captured photo should be automatically associated with:

- Timestamp
- GPS
- Device ID

The specification treats GPS/timestamp as personal data.

Consent and privacy controls must therefore explicitly address this metadata.

Photo-integrity handling should also cover:

- Corrupted images
- Blurred images
- Duplicate detection

---

# 16. Web Portal Requirements

## 16.1 Dashboard

Display:

- Total patients
- Active cases
- Treatments this week
- Pending reviews
- Simple counts
- Simple charts

---

## 16.2 Patient List

Requirements:

- Searchable table
- Search by name
- Search by patient ID
- Drill down to patient details

---

## 16.3 Case View

Display:

- Full treatment timeline
- T1 / T2 / T3…
- Pre-treatment photos
- Post-treatment photos
- Measurements
- Phase 2 tissue percentages
- Flags

---

## 16.4 Report / PDF Export

Provide:

- Desktop version of App report
- Treatment selection
- PDF generation
- Same report engine as the mobile app

The detailed redesign is still in progress.

---

## 16.5 Data Import / Export

Requirements:

- Raw CSV export
- Formatted report downloads

### Privacy

Bulk exports may require de-identification under applicable privacy policy.

---

## 16.6 Review / Flag Queue

Provide a single worklist containing:

- Flagged cases
- Overdue cases
- Needs-review cases

The same status-tag rule must be reused by App Home.

---

## 16.7 User Access

Current iteration:

- Simple authenticated login
- Reuse App account

Not included:

- Role hierarchy
- Complex permissions
- Multiple organizational levels

The architecture should still allow future RBAC.

---

## 16.8 Patient Registration

Management/front-desk staff can complete the full Patient Intake Form from the portal.

This is distinct from the lightweight Patient Page in the mobile app.

---

## 16.9 Data Overview / Metrics

Potential aggregate views:

- Cases by wound type
- Healing trends
- Tissue-percentage distribution

### Dependency

This functionality depends on Phase 2 data and therefore should not become a Phase 1 dependency.

---

# 17. Reporting & Sharing

## Report

A report pulls selected Treatments into a shareable summary.

Users can:

1. Select treatments.
2. Generate report.
3. Download PDF.
4. Share PDF.

## Share Patient

Should allow:

- Sharing patient context
- Hiding personal details

## Share Case

Should allow:

- Static PDF
- Live case link

## Live-Link Requirements to Define

Before production, specify:

- Authentication
- Permissions
- Expiration
- Revocation
- Audit logging
- Whether recipients can download data
- Whether personal details are hidden by default

---

# 18. Security, Privacy & Regulatory Requirements

## Security

Minimum stated requirement:

- Encryption at rest

The product should additionally support appropriate:

- Authentication
- Secure transport
- Access control
- Audit logging
- Session management
- Secure backups
- Device security

## Privacy / DPDP

Consent/privacy requirements must address:

- Patient data
- Wound images
- GPS metadata
- Timestamp metadata
- Device ID
- Treatment data
- Potential AI-training use

Private-area wound images require especially careful handling.

## Regulatory

The supplied specification identifies:

- DPDP consent
- CDSCO involvement/consideration
- Medical device/software/app regulatory considerations

Formal regulatory assessment should determine:

- Applicable classification
- Clinical validation expectations
- Software lifecycle requirements
- Documentation requirements
- Quality-management requirements
- Cybersecurity expectations

No regulatory classification should be assumed solely from this PRD.

---

# 19. Notifications

The specification calls for reminders for:

- Patients
- Doctors

Potential reminder event:

> Follow-up / next visit

Open decisions:

- Notification channel
- Patient opt-in
- Doctor opt-in
- Timing
- Escalation
- Cancellation/rescheduling behavior
- Ownership of reminders

---

# 20. FSM Handoff

The specification describes:

> "Request Therapy" on a Treatment can trigger a case in an FSM system.

Current scope:

- One-way action only.
- No data pull-back.
- FSM integration is out of scope for the current build.

## Conflict

The Patient Intake Form includes an **Assigned Field Agent** concept that assumes FSM roster visibility.

Recommended resolution:

- Remove the field for the current iteration, **or**
- Define a minimal one-way roster lookup.

Do not implement hidden FSM dependencies.

---

# 21. Future Ideas / Backlog

| Idea / Flag | Description | Disposition |
|---|---|---|
| Case Compendium / Triage Social | Follow/connect with users; private/global posts; share studies or case reports. | Future |
| Incision Wound Management | Parallel workflow for surgical incision wounds. | Future |
| Subscription Management | Paid partial/premium features. | Future |
| Connect to EHRs | Integrate with hospital/service-provider EHR systems. | Later stage |
| Self-Service for Enterprises | Request/track services or order products directly. | Future |
| Training Videos / LMS | Built-in learning management system linked to wound-photo SOP. | Future |
| Scan-to-track Dressing | Scan a branded dressing to auto-fill dressing type and track usage. | Future |
| Share Patient / Share Case | Privacy-aware patient/case sharing modes. | Design requirement / future enhancement |
| FSM roster dependency | Assigned Field Agent assumes FSM roster visibility. | Resolve before using field |
| Report naming | Resolve Report Status vs Add Assessment naming collision. | TBD |
| Web Patient Registration | Confirm full intake is genuinely Iteration 1. | TBD |
| Clinical option lists | Many values are proposed rather than clinically confirmed. | Clinical sign-off |
| CV feedback loop | Allow users to edit/suggest corrections to wound/periwound regions. | Future / validate |

---

# 22. CV Feedback Loop

A highlighted idea is to allow the clinician to:

- Edit the AI-identified wound area.
- Suggest corrections to the wound area.
- Potentially edit/suggest the periwound area.

Potential uses:

- Improve clinician trust.
- Correct segmentation errors.
- Collect labeled feedback.
- Support future model QA/training.

This should be treated as a controlled workflow rather than unrestricted model retraining.

Open decisions:

- Can the clinician edit the mask directly?
- Is the correction saved as clinical truth or AI feedback?
- Is correction mandatory when confidence is low?
- How are corrections reviewed?
- Can corrections be used for model training?
- What consent is required for model-training use?

---

# 23. MVP Acceptance Criteria

The MVP is acceptable when all of the following are true:

### Authentication

- A doctor can authenticate successfully.
- Account recovery behavior is defined.

### Patient & Case

- A doctor can find or create a patient.
- A doctor can create a wound case.
- Required baseline fields can be completed.
- Wound location can be selected.

### Image Capture

- The app provides guided wound framing.
- Calibration can be automatic or manual.
- Image quality can be checked.
- Failed captures can be retaken.
- Low-confidence cases are flagged.

### Phase 1 AI

- Calibrated wound segmentation works.
- Area is calculated.
- L×H is calculated.
- Major/minor axes are available.
- Shape analysis is available.
- Results are visible on the Result screen.

### Treatment

- T1/T2/T3 treatment episodes can be created.
- Therapy can be recorded.
- Dressing can be recorded.
- Next visit can be recorded.

### Pre/Post

- Pre and Post phases are supported.
- Revisit clinical information can be recorded.
- Previous Post values can pre-fill the next Pre phase.
- Clinicians can edit or clear inherited values.

### Offline

- Core capture works without signal.
- Changes synchronize after reconnecting.
- Sync status is visible.
- A conflict strategy is defined before multi-device production use.

### Web Portal

- Patients can be searched.
- Cases can be opened.
- Treatment timelines can be reviewed.
- Photos and measurements can be inspected.
- Flags can be reviewed.

### Reporting

- Treatments can be selected.
- A PDF can be generated.
- App and portal use consistent report definitions.

### Privacy / Security

- Encryption at rest is implemented.
- Consent/privacy handling for images and metadata is defined.
- Appropriate access controls exist.
- Sharing behavior is controlled and auditable.

### Clinical Validation

- Proposed clinical option lists have explicit clinical sign-off.
- Pain scale is finalized.
- Infection and periwound options are finalized.

### Scope Control

- Phase 2 does not block Phase 1.
- Roadmap ML/LLM functionality does not become an MVP dependency.
- FSM integration remains out of scope unless separately approved.

---

# 24. Open Decisions

| Area | Decision Required |
|---|---|
| Password reset | Adopt standard email/OTP reset? |
| Clinical pain scale | 0–10 or mild/moderate/severe? |
| Clinical option lists | Approve wound type, exudate, infection, edge/periwound and comorbidity options. |
| AI hosting | On-device vs hosted inference. |
| Offline conflicts | Define merge/conflict behavior. |
| Live sharing | Define authentication, permissions, expiry, revocation and auditability. |
| Notifications | Define channels, consent, timing and escalation. |
| Photo metadata | Confirm GPS necessity, visibility, retention and consent. |
| Regulatory | Confirm classification, validation and CDSCO pathway/obligations. |
| Report naming | Select canonical screen/action name. |
| FSM | Remove Assigned Field Agent or define minimal roster lookup. |
| CV feedback | Decide whether and how clinicians can correct AI regions. |

---

# 25. Suggested Release Plan

## Release 0 — Foundation

Focus:

- Authentication
- Patient model
- Case model
- Treatment model
- Phase model
- Secure storage
- Consent/privacy foundations
- Core navigation

## Release 1 — Phase 1 MVP

Deliver:

- Patient Intake
- New Case Form
- Wound location
- Image Capture
- Calibration
- Wound segmentation
- Wound sizing
- Revisit workflow
- Treatment tracking
- Pre/Post phases
- Offline mode
- Sync
- Basic reporting
- Web case review

## Release 1 — Hardening

Before production:

- Clinical sign-off
- Image-quality testing
- Duplicate/corrupted image handling
- Security testing
- Privacy review
- Auditability
- Regulatory assessment
- Clinical pilot/validation

## Release 2 — Phase 2

Deliver:

- Tissue segmentation
- Tissue percentage
- Phase 2 reporting
- Tissue analytics
- Comorbidity-aware analytics
- Data overview / metrics

## Later Roadmap

Potential additions:

- Photogrammetry
- Periwound analysis
- ML/LLM analysis
- Predictive healing
- AI trend tracking
- EHR integration
- Advanced permissions
- Enterprise features
- Training/LMS
- Dressing scan/track
- Social/case compendium

---

# 26. Product Principles

1. **Clinical truth over AI confidence** — AI assists the clinician; it must expose uncertainty rather than imply false precision.
2. **Phase-gated AI** — Phase 1 ships independently from Phase 2.
3. **One source of truth** — App and web portal share the same core data definitions.
4. **Longitudinal by design** — Every visit should make change over time measurable.
5. **Privacy by design** — Especially for private-area wound images and image metadata.
6. **Offline first for clinical capture** — Lack of connectivity must not block core documentation.
7. **Explicit uncertainty** — Proposed clinical lists and undecided architecture must remain visibly TBD until approved.
8. **Clear data boundaries** — Treatment data and wound-condition data should remain separate.
9. **Reusable status logic** — App Home and portal review queue should use the same rules.
10. **Future-proof architecture** — EHR, RBAC, FSM, Phase 2 AI, and other future capabilities should be possible without redesigning the core model.

---

# 27. Traceability Note

This PRD is a structured interpretation of the supplied screenshots.

Items explicitly marked as:

- Proposed
- Idea
- TBD
- Flagged
- Roadmap
- Out of scope
- Pending clinical sign-off

have intentionally **not** been converted into unconditional committed MVP requirements.

Clinical option lists, AI behavior, privacy requirements, and regulatory obligations should be validated with the appropriate clinical, privacy, security, engineering, and regulatory stakeholders before final build sign-off.
