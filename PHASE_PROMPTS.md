# ANTIGRAVITY PHASE PROMPTS

These prompts are intended to be pasted into Antigravity one phase at a time.

---

# Prompt 0 — Project Discovery & Phase 0 Planning

Read:
- `prd.md`
- `phase.md`
- `techspec.md`

Do not modify the application yet.

Inspect the repository and report:

1. Current framework(s).
2. Current apps/packages.
3. Current database/storage setup.
4. Current authentication.
5. Current API structure.
6. Current mobile/web implementation status.
7. Existing AI/model integration, if any.
8. Existing tests and CI/CD.
9. Gaps relative to `phase.md`.
10. Conflicts between the repository and the specification.

Remember:
- Do not assume missing requirements.
- The ML/CV model is client-provided.
- Ask me instead of guessing.

Then propose the Phase 0 implementation plan.

WAIT FOR MY APPROVAL.

---

# Prompt 1 — Phase 0 Foundation

Implement only the approved Phase 0 work.

Focus on:
- repository structure
- environments
- authentication foundation
- database/domain model
- API foundation
- object storage foundation
- secure storage
- consent foundation
- audit foundation
- offline-storage foundation
- shared packages/contracts

Do not implement:
- Phase 1 clinical UI beyond foundation needed for architecture
- Phase 2
- ML training
- invented clinical logic
- EHR
- FSM
- advanced RBAC

Before coding, identify blockers and ask me.

After coding:
- tests
- typecheck
- lint
- build
- review diff

Return a structured completion report.
WAIT FOR MY NEXT INSTRUCTION.

---

# Prompt 2 — Phase 1 Patient and Case Workflow

Read the Phase 1 sections of `prd.md`, `phase.md`, and `techspec.md`.

Implement only:
- patient registration
- wound location
- New Case Form
- baseline clinical assessment
- case creation
- case detail
- patient detail

Do not finalize any clinical field that is marked TBD/proposed without asking me.

For every unresolved clinical field, stop and ask.

Verify:
- validation
- empty states
- loading
- errors
- offline-safe behavior where applicable
- authorization
- tests
- typecheck
- lint
- build

WAIT FOR MY NEXT INSTRUCTION.

---

# Prompt 3 — Phase 1 Treatment and Revisit Workflow

Implement:
- T1/T2/T3 treatment model
- Pre/Post phases
- Questions/Revisit Tracking Form
- therapy given
- dressing type
- next visit/action date
- revisit clinical assessment
- wound appearance trend
- comorbidity update
- previous Post → next Pre pre-fill

Critical:
- inherited values must remain editable
- clinician-entered values must not be silently overwritten
- preserve appropriate auditability
- do not invent clinical rules

Verify all state transitions and offline behavior.

WAIT FOR MY NEXT INSTRUCTION.

---

# Prompt 4 — Phase 1 Image Capture

Implement the image-capture workflow from the approved specification:

1. Camera start
2. Framing guide
3. Calibration detection
4. Manual calibration fallback
5. Image quality check
6. Retake flow
7. Image persistence
8. Capture metadata
9. AI handoff boundary

Do not implement a fake production ML model.

For development/testing, use a mock AI adapter if needed.

Before integrating the real client model, ask me for the model contract/package if it has not been supplied.

WAIT FOR MY NEXT INSTRUCTION.

---

# Prompt 5 — Phase 1 Client ML/CV Integration

The ML/CV model is supplied by the client.

Before implementation:

ASK ME for the exact client model integration contract if it is not already available in the repository.

Do not invent:
- model format
- runtime
- endpoint
- input schema
- output schema
- confidence semantics
- performance assumptions

Once the model contract is available, implement:

- AI adapter
- model invocation
- input transformation
- calibration handoff
- output normalization
- segmentation result rendering
- area
- length/width
- major/minor axis
- shape result
- confidence/error handling
- model version storage

Keep the adapter replaceable.

Add:
- mock adapter for CI
- integration tests
- model error tests
- low-confidence tests
- versioning tests

Do not train or modify the client's model.

---

# Prompt 6 — Phase 1 Offline and Sync

Implement and test:

- secure local persistence
- outbox/sync queue
- retry
- sync status
- reconnect behavior
- image upload synchronization
- server acknowledgement
- conflict detection

The specification does not finalize multi-device conflict resolution.

ASK ME before choosing a clinically significant conflict policy.

Never silently overwrite clinical records.

WAIT FOR MY NEXT INSTRUCTION.

---

# Prompt 7 — Phase 1 Reporting and Web Portal

Implement the approved Phase 1 portal:

- dashboard
- patient list
- patient detail
- case view
- treatment timeline
- review/flag queue
- report generation
- PDF export
- patient registration
- approved data export

Use shared domain/API contracts with mobile.

Do not duplicate business rules unnecessarily.

Verify:
- access control
- loading/empty/error states
- report correctness
- responsive behavior
- browser tests

---

# Prompt 8 — Phase 1 Sharing and Notifications

Implement only the approved Phase 1 sharing and notification behavior.

Before implementing live links, ASK ME to confirm:
- authentication
- permissions
- expiry
- revocation
- audit
- personal-data visibility

Before implementing notifications, ASK ME to confirm:
- channels
- consent
- timing
- escalation

Do not invent these policies.

---

# Prompt 9 — Phase 1A Hardening

Perform Phase 1A hardening.

Review:
- security
- privacy
- authentication
- authorization
- image access
- audit logs
- offline behavior
- sync
- client-model integration
- model versioning
- performance
- failure handling
- clinical terminology
- human factors
- browser/mobile UX

Produce a findings report before making large changes.

Ask before resolving unspecified policy decisions.

Then fix only approved issues.

Run full test/build verification.

---

# Prompt 10 — Phase 2 Client ML/CV Integration

Do not begin until Phase 1 is stable.

The Phase 2 tissue-analysis ML/CV model is also client-provided.

Ask me for the exact Phase 2 model contract before integration if unavailable.

Implement only:
- Phase 2 adapter
- tissue result persistence
- tissue result UI
- tissue percentages
- approved categories
- case/timeline display
- reporting
- metrics

Do not change Phase 1 behavior unnecessarily.

If the client model does not support a requested output, STOP and ask me.

---

# Prompt 11 — Phase 3 Advanced CV

Phase 3 is roadmap scope.

Do not implement merely because it is technically interesting.

Before starting, ask me which approved feature is in scope:
- periwound analysis
- baseline skin comparison
- maceration analysis
- redness/inflammation analysis
- photogrammetry
- large-wound reconstruction
- 3D wound representation

The client must supply/approve any required ML/CV model.

Do not invent model behavior.

Wait for explicit scope approval.

---

# Prompt 12 — Phase 4 ML/LLM and Ecosystem

Phase 4 is roadmap scope.

Before starting, ask me which exact capability is approved.

Potential features include:
- treatment decision support
- generated narrative reports
- predictive healing
- AI trend tracking
- EHR integration
- FSM integration
- advanced RBAC

Do not implement medical decision support without explicit clinical, safety, and regulatory requirements.

Ask before proceeding.

---

# Prompt 13 — Backend: Storage Buckets

Implement the Storage Buckets phase as specified in `backend.md`:
1. Provision the Supabase Storage bucket named `images`.
2. Configure Row-Level Security (RLS) so that only the doctor who owns the associated patient can read or upload the image.

Verify:
- Bucket exists and is private
- RLS policies applied to the bucket

WAIT FOR MY NEXT INSTRUCTION.

---

# Prompt 14 — Backend: File Uploads

Implement the File Uploads phase as specified in `backend.md`:
1. Implement the React Native camera capture workflow.
2. Implement base64/FormData upload to Supabase Storage.
3. Save the returned secure path to the `Image` database table linked to the current `Phase`.

Verify:
- File upload is successful
- Image path correctly saved in the database
- Image only accessible by the authorized doctor

WAIT FOR MY NEXT INSTRUCTION.

---

# Prompt 15 — Backend: PDF Generation

Implement the PDF Generation phase as specified in `backend.md`:
1. Build the server-side API endpoint for Report Generation (W09/W10).
2. Use Prisma to aggregate the longitudinal case data.
3. Ensure the generated PDF accurately represents the patient's wound progression across treatments.

Verify:
- API endpoint properly authenticated
- Database query efficiency
- Accurate PDF generation and formatting

WAIT FOR MY NEXT INSTRUCTION.
