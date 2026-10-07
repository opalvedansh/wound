# Wound classification flowcharts

How a wound is sorted, in the order a clinician reasons: danger signs first, then
wound type, then grade. These charts are also the **labelling scheme** for the model
(level 1: danger / not a wound, level 2: wound type, level 3: grade and flags).

The diagrams are written in [Mermaid](https://mermaid.js.org). They render as
flowcharts on GitHub, in VS Code (Markdown preview with Mermaid support) and at
[mermaid.live](https://mermaid.live) if you paste a code block there. If your viewer
shows code instead of charts, open the PNG copies in `docs/img/`.

**Legend**

| Look | Meaning |
| --- | --- |
| Hexagon | A decision (yes / no) |
| White box | A check that always runs (Chart 3) |
| Green box | Wound type or descriptor |
| Orange box | Act now, refer, or urgent flag |
| Grey box | Starting point, or not a wound |
| Dashed box | Continues in another chart |
| *Italic line* | Where the information comes from: the photo, the intake answers, or a bedside exam the model cannot do |

> These charts support clinical reasoning; they are not a diagnosis. Every threshold
> and red-flag rule must be reviewed and signed off by your clinical partner.

---

## Chart 1: sort the wound (danger signs first)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 320, "nodeSpacing": 40, "rankSpacing": 45}}}%%
flowchart TD
    start["Photo + intake answers"]:::start
    d1{{"<b>Any danger signs?</b><br/>rapid spread, fever, gangrene<br/><i>from photo + answers</i>"}}:::q
    emerg["<b>Emergency care now</b><br/>do not wait for a report"]:::urgent
    d2{{"<b>Is it a wound?</b><br/>broken skin or damaged tissue<br/><i>from photo</i>"}}:::q
    notw["<b>Not a wound</b><br/>rash, moisture damage, bruise"]:::neutral
    d3{{"<b>Foot wound with diabetes?</b><br/>any cause, even a small cut<br/><i>from photo + answers</i>"}}:::q
    dfu["<b>Diabetic foot ulcer</b><br/>go to Chart 3"]:::type
    d4{{"<b>Clear recent cause?</b><br/>injury, operation or burn<br/><i>from answers</i>"}}:::q
    chronic["<b>Chronic ulcer</b><br/>go to Chart 2"]:::next
    subgraph acute["Acute wounds"]
        trauma["<b>Traumatic</b><br/>cut, graze, bite, tear"]:::type
        surg["<b>Surgical</b><br/>infection, wound opening"]:::type
        burn["<b>Burn</b><br/>grade depth and % body area"]:::type
    end

    start --> d1
    d1 -->|yes| emerg
    d1 -->|no| d2
    d2 -->|no| notw
    d2 -->|yes| d3
    d3 -->|yes| dfu
    d3 -->|no| d4
    d4 -->|no| chronic
    d4 -->|yes| acute
    acute -.->|not healing by about 4 weeks| chronic

    classDef start fill:#F1EFE8,stroke:#5F5E5A,color:#2C2C2A
    classDef q fill:#FFFFFF,stroke:#5F5E5A,color:#2C2C2A
    classDef type fill:#E1F5EE,stroke:#0F6E56,color:#04342C
    classDef urgent fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
    classDef neutral fill:#F1EFE8,stroke:#888780,color:#2C2C2A
    classDef next fill:#FFFFFF,stroke:#5F5E5A,stroke-dasharray:5 4,color:#2C2C2A
    style acute fill:#FAFAF8,stroke:#B4B2A9
```

**Why this order**

- **Danger signs come first.** A spreading infection or gangrene needs same-day care
  whatever the wound type, so nobody waits for a full classification.
- **Any foot wound in a person with diabetes is a diabetic foot ulcer**, even if it
  started as a small cut. It follows the diabetic foot checks in Chart 3.
- **Any acute wound that stalls** (not improving after about 4 weeks) moves into the
  chronic workup, whatever caused it.

**Danger signs to train and test for (high sensitivity)**

- Spreading redness with fever or chills
- Skin turning dusky or grey, or crackling under the finger
- Pain far worse than the wound looks
- Black or wet toes (gangrene)
- Burns that are large, electrical or chemical, or on the face, hands, feet, genitals or
  major joints

---

## Chart 2: chronic ulcers (check blood flow before calling it venous)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 320, "nodeSpacing": 40, "rankSpacing": 45}}}%%
flowchart TD
    start["<b>Chronic ulcer workup</b><br/>from Chart 1"]:::next
    p{{"<b>Over a pressure point?</b><br/>bed-bound, chair-bound or device<br/><i>from photo + answers</i>"}}:::q
    pi["<b>Pressure injury</b><br/>stage 1-4, unstageable<br/>or deep tissue injury"]:::type
    leg{{"<b>On the lower leg or foot?</b><br/>typical leg ulcer sites<br/><i>from photo</i>"}}:::q
    flow{{"<b>Blood flow adequate?</b><br/>pulses felt, ABPI 0.8 or above<br/><i>needs bedside exam</i>"}}:::q
    art["<b>Arterial or mixed ulcer</b><br/>vascular review first"]:::urgent
    ven{{"<b>Venous signs?</b><br/>swelling, brown skin, inner ankle<br/><i>from photo + answers</i>"}}:::q
    vlu["<b>Venous leg ulcer</b><br/>compression can be considered"]:::type
    aty["<b>Atypical ulcer: refer</b><br/>biopsy if unusual or not healing"]:::urgent

    start --> p
    p -->|yes| pi
    p -->|no| leg
    leg -->|no| aty
    leg -->|yes| flow
    flow -->|no| art
    flow -->|yes| ven
    ven -->|yes| vlu
    ven -->|no| aty

    classDef q fill:#FFFFFF,stroke:#5F5E5A,color:#2C2C2A
    classDef type fill:#E1F5EE,stroke:#0F6E56,color:#04342C
    classDef urgent fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
    classDef next fill:#FFFFFF,stroke:#5F5E5A,stroke-dasharray:5 4,color:#2C2C2A
```

**Why blood flow is checked before venous**

Venous ulcers are treated with compression, which is dangerous if arterial supply is
poor. ABPI (ankle-brachial pressure index) compares ankle and arm blood pressure.
Guidelines disagree on exact cut-offs: most allow full compression from about 0.8
upward and differ below that. Readings can be falsely reassuring when arteries are
calcified, which is common in diabetes and kidney disease. Let your clinician set the
thresholds.

**The model cannot feel a pulse.** For every leg ulcer, the report must say
"blood flow not assessed: check before compression" unless a clinician has entered an
ABPI. It must never imply an ulcer is venous on the photo alone.

**Signs that an ulcer is atypical** (refer, consider biopsy)

- Unusual location for its apparent type
- Overgrown, cauliflower-like or "vegetative" tissue
- Undermined or purple edges, small satellite sores around it
- Severe pain, especially at dressing changes
- Failure to heal despite correct standard care

Causes include inflammatory disease (pyoderma gangrenosum, vasculitis), skin cancer,
clotting and kidney-related vessel disease, blood disorders (such as sickle cell),
infections (bacteria, mycobacteria, fungi, parasites) and some drugs.

---

## Chart 3: diabetic foot ulcer (every check runs; each can add a flag)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 320, "nodeSpacing": 40, "rankSpacing": 40}}}%%
flowchart TD
    start["<b>Diabetic foot ulcer</b><br/>from Chart 1"]:::type
    subgraph r1[" "]
        direction LR
        c1["<b>1. Blood flow to the foot?</b><br/>pulses, toe pressure<br/><i>needs bedside exam</i>"]:::q
        f1["<b>If poor: ischaemic</b><br/>urgent vascular review"]:::urgent
        c1 -. if positive .-> f1
    end
    subgraph r2[" "]
        direction LR
        c2["<b>2. Signs of infection?</b><br/>pus, redness, swelling, fever<br/><i>from photo + answers</i>"]:::q
        f2["<b>If present: infected</b><br/>grade mild, moderate or severe<br/>(IWGDF/IDSA)"]:::urgent
        c2 -. if positive .-> f2
    end
    subgraph r3[" "]
        direction LR
        c3["<b>3. How deep?</b><br/>skin, tendon or bone<br/><i>photo + bedside probe</i>"]:::q
        f3["<b>If bone reached</b><br/>suspect bone infection"]:::urgent
        c3 -. if positive .-> f3
    end
    subgraph r4[" "]
        direction LR
        c4["<b>4. Protective feeling lost?</b><br/>numbness, monofilament test<br/><i>from answers + exam</i>"]:::q
        f4["<b>If lost: neuropathic</b><br/>foot cannot feel injury"]:::type
        c4 -. if positive .-> f4
    end
    c5["<b>5. Where and how big?</b><br/>forefoot or hindfoot, area in cm²<br/><i>from photo + sticker</i>"]:::q
    out["<b>SINBAD score + flags</b><br/>report each item, not only the total"]:::type

    start --> r1 --> r2 --> r3 --> r4 --> c5 --> out

    classDef q fill:#FFFFFF,stroke:#5F5E5A,color:#2C2C2A
    classDef type fill:#E1F5EE,stroke:#0F6E56,color:#04342C
    classDef urgent fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
    style r1 fill:none,stroke:none
    style r2 fill:none,stroke:none
    style r3 fill:none,stroke:none
    style r4 fill:none,stroke:none
```

**Why a checklist, not a branching tree:** one ulcer can be ischaemic, infected and
deep at the same time, so every check runs and the flags add up.

**What IWGDF 2023 recommends**

- **SINBAD** (Site, Ischaemia, Neuropathy, Bacterial infection, Area, Depth) for
  communication between professionals; report each item, not only the total.
- **WIfI** for ulcers with peripheral artery disease.
- **IWGDF/IDSA grades** for infection.
- **No score** should be used to predict an individual patient's outcome.

---

## What this means for the model

| Rule | Implementation |
| --- | --- |
| Label in levels | Level 1: danger sign / not a wound. Level 2: wound type. Level 3: grade and flags. One output head per level. |
| Danger signs are the costliest miss | Set the danger-sign threshold for high sensitivity; accept more false alarms. |
| Bedside-exam steps are never guessed | Blood flow, probe-to-bone and monofilament results come from a clinician or are reported as "not assessed". |
| Intake answers are mandatory | Diabetes status and how the wound started decide the first branches; the photo cannot supply them. |
| Rare types are not separate classes | Pyoderma, cancer, infectious ulcers and similar go to "atypical: refer". |
| Describe, do not forecast | The report does not predict healing or amputation for an individual patient. |

The starter code's wound-type classifier currently treats types as flat classes. Next
changes: add the diabetic-foot rule from the intake answers, and the
"blood flow not assessed" flag for leg and foot ulcers.

---

## Sources

- [IWGDF 2023 classification guideline](https://iwgdfguidelines.org/wp-content/uploads/2023/07/IWGDF-2023-03-Classification-Guideline.pdf)
- [ABPI and compression: review of 13 clinical practice guidelines](https://journals.cambridgemedia.com.au/wpr/volume-27-no-2/ankle-brachial-pressure-index-and-compression-application-review-summary)
- [Atypical ulcers: diagnosis and management (Clinical Interventions in Aging)](https://www.dovepress.com/atypical-ulcers-diagnosis-and-management-peer-reviewed-fulltext-article-CIA)
