"""Turn model findings into a report draft a clinician can review and sign.

Design rule: everything safety-relevant is DETERMINISTIC. Numbers, red flags,
uncertainty notes and the disclaimer are rendered from the findings dict by this
module. A language model (MedGemma) is only allowed to write the short narrative
summary, and that summary is rejected (template fallback) if it contains any
number not present in the findings, or any banned phrase.

The red-flag rules below are PLACEHOLDERS written from general wound-care
practice. Your clinical partner must review, edit and sign off every rule and
threshold before any patient use.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from .intake import FOOT_SITES, LEG_AND_FOOT_SITES, SPECIAL_BURN_SITES

DISCLAIMER = ("AI-generated draft for review by a qualified clinician. It is not a diagnosis and must not be used "
              "to start, stop or change treatment without clinical assessment.")

UNCERTAIN_BELOW = 0.70  # calibrated probability below which a classification is reported as uncertain
ABPI_LOW = 0.8  # below: arterial or mixed disease possible (guidelines differ; clinician sets the threshold)
ABPI_HIGH = 1.3  # above: arteries may be calcified, so the reading can be falsely reassuring
# Prefix of every danger-sign flag (Chart 1): the report then opens with "Emergency care now".
DANGER = "Danger sign"

LABELS = {
    "diabetic": "Diabetic foot ulcer", "pressure": "Pressure injury", "venous": "Venous leg ulcer",
    "surgical": "Surgical wound", "burn": "Burn", "other": "Other wound", "not_wound": "No wound detected",
}


# --------------------------------------------------------------------------- red flags

def red_flags(f: dict) -> list[dict]:
    """Return [{'level': 'urgent'|'review', 'text': ...}]. PLACEHOLDER RULES - clinical sign-off required."""
    a = f.get("intake", {})
    t = f.get("tissue_pct", {}) or {}
    wt = (f.get("wound_type") or {}).get("label")
    sev = f.get("severity", {}) or {}
    chg = f.get("change", {}) or {}
    flags = []

    def add(level, text):
        flags.append({"level": level, "text": text})

    # Chart 1: danger signs first. Each one means same-day care, whatever the wound type.
    if a.get("foot_cold_or_dark") == "yes":
        add("urgent", f"{DANGER}: a cold, pale or darkening foot or toes (possible gangrene or critical ischaemia): "
                      "same-day vascular or diabetic foot team.")
    elif a.get("diabetes") == "yes" and t.get("necrosis", 0) > 0:
        add("urgent", f"{DANGER}: dark/necrotic tissue in a person with diabetes: same-day assessment by a diabetic "
                      "foot or vascular team.")
    if a.get("fever") == "yes" and (a.get("redness_spreading") == "yes" or a.get("discharge") == "thick_yellow_or_green"):
        add("urgent", f"{DANGER}: fever with spreading redness or pus: possible spreading infection, needs urgent "
                      "medical review.")
    elif a.get("redness_spreading") == "yes":
        add("review", "Redness or swelling reported as spreading: clinician review within 24 hours.")
    if wt == "burn" or a.get("cause") == "burn":
        if a.get("burn_agent") in ("chemical", "electrical"):
            add("urgent", f"{DANGER}: chemical or electrical burn: refer to a burns unit; surface appearance can "
                          "underestimate damage.")
        if a.get("body_location") in SPECIAL_BURN_SITES:
            add("urgent", f"{DANGER}: burn on the face, neck, hands or feet: refer to a burns unit.")
        if a.get("burn_other_sites") == "yes":
            add("urgent", f"{DANGER}: burns on more than one body area: estimate the total area and refer to a burns unit.")
        if sev.get("burn_depth", {}).get("label") in ("deep_partial", "full_thickness"):
            add("urgent", "Possible deep burn: burns specialist assessment.")

    # Charts 2 and 3: a photo cannot show blood flow, so leg and foot ulcers say so until a clinician enters an ABPI.
    acute = a.get("cause") in ("burn", "surgery", "injury_cut_or_fall")
    leg_or_foot = a.get("body_location") in LEG_AND_FOOT_SITES
    if leg_or_foot and (not acute or wt == "diabetic"):
        abpi = _number(a.get("abpi"))
        if abpi is None:
            add("review", "Blood flow not assessed: check foot pulses and ABPI before any compression.")
        elif abpi < ABPI_LOW:
            add("urgent", f"ABPI {abpi} is below {ABPI_LOW}: arterial or mixed disease possible. Vascular review "
                          "before any compression.")
        elif abpi > ABPI_HIGH:
            add("review", f"ABPI {abpi} is above {ABPI_HIGH}: arteries may be calcified (common in diabetes and kidney "
                          "disease), so the reading can be falsely reassuring. Check toe pressures.")
    if a.get("wound_opening") == "yes":
        add("review", "Surgical wound reported as opening: contact the operating team.")
    pct = chg.get("percent_area_reduction")
    if pct is not None and pct < 0:
        add("review", "Wound area has increased since the last photo.")
    if pct is not None and chg.get("days_between", 0) >= 28 and pct < 50 and wt in ("diabetic", "venous"):
        add("review", "Less than half the area has closed over about 4 weeks: review the care plan.")
    conf = (f.get("wound_type") or {}).get("prob")
    if conf is not None and conf < UNCERTAIN_BELOW:
        add("review", "Model is uncertain about the wound type: clinician to classify.")
    if f.get("measurement") is None:
        add("review", "Size not measured (calibration sticker not detected or no wound region found).")
    return flags


def _number(value) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def has_danger_signs(flags: list[dict]) -> bool:
    return any(fl["level"] == "urgent" and fl["text"].startswith(DANGER) for fl in flags)


# --------------------------------------------------------------------------- template report

def _fmt_class(entry: dict | None) -> str:
    if not entry:
        return "not assessed"
    label = LABELS.get(entry["label"], entry["label"].replace("_", " "))
    if entry.get("rule"):
        model = entry.get("model")
        guess = f"; model estimate {_fmt_class(model)}" if model else ""
        return f"{label} (by rule: {entry['rule']}{guess})"
    p = entry.get("prob")
    if p is None:
        return label
    if p < UNCERTAIN_BELOW:
        alts = ", ".join(f"{LABELS.get(k, k)} {v:.0%}" for k, v in entry.get("top", [])[:3])
        return f"UNCERTAIN (top estimates: {alts})"
    return f"{label} (model confidence {p:.0%})"


def template_narrative(f: dict) -> str:
    parts = []
    wt = f.get("wound_type")
    if wt and wt.get("rule"):
        parts.append(f"Recorded as {LABELS.get(wt['label'], wt['label']).lower()} because of {wt['rule']}.")
    elif wt and (wt.get("prob") or 0) >= UNCERTAIN_BELOW:
        parts.append(f"Appearance is most consistent with {LABELS.get(wt['label'], wt['label']).lower()}.")
    elif wt:
        parts.append("The wound type could not be determined with confidence from the photo.")
    m = f.get("measurement")
    if m:
        parts.append(f"Measured area is {m['area_cm2']} cm² ({m['length_cm']} x {m['width_cm']} cm).")
    t = f.get("tissue_pct") or {}
    if t:
        main = max(t, key=t.get)
        parts.append(f"The wound bed is mostly {main} tissue ({t[main]}%).")
    c = f.get("change") or {}
    if "percent_area_reduction" in c:
        verb = "decreased" if c["percent_area_reduction"] >= 0 else "increased"
        parts.append(f"Area has {verb} by {abs(c['percent_area_reduction'])}% since the previous photo.")
    return " ".join(parts)


def render_report(f: dict, narrative: str | None = None) -> str:
    flags = f.get("flags") or red_flags(f)
    m = f.get("measurement")
    t = f.get("tissue_pct") or {}
    a = f.get("intake", {})
    lines = [
        "# Wound assessment (AI-assisted draft)",
        f"_{DISCLAIMER}_",
        "",
    ]
    if has_danger_signs(flags):
        lines += ["**Emergency care now: do not wait for this report.** Danger signs are listed under Flags.", ""]
    lines += [
        f"Generated: {f.get('timestamp', datetime.now(timezone.utc).isoformat(timespec='minutes'))}",
        "",
        "## Flags",
    ]
    if flags:
        lines += [f"- **{fl['level'].upper()}**: {fl['text']}" for fl in flags]
    else:
        lines.append("- None raised by the automatic rules.")
    lines += ["", "## Summary", narrative or template_narrative(f), "", "## Findings",
              f"- Wound type: {_fmt_class(f.get('wound_type'))}"]
    for k, v in (f.get("severity") or {}).items():
        lines.append(f"- {k.replace('_', ' ').capitalize()}: {_fmt_class(v)}")
    if m:
        lines.append(f"- Size: area {m['area_cm2']} cm², length {m['length_cm']} cm, width {m['width_cm']} cm, "
                     f"perimeter {m['perimeter_cm']} cm ({m['n_regions']} region(s)). Depth not measurable from a photo.")
    else:
        lines.append("- Size: not measured.")
    if t:
        lines.append("- Wound bed tissue: " + ", ".join(f"{k} {v}%" for k, v in t.items()))
    if f.get("change"):
        c = f["change"]
        lines.append(f"- Change: previous area {c.get('previous_area_cm2')} cm², "
                     f"area reduction {c.get('percent_area_reduction')}%"
                     + (f" over {c['days_between']} days" if c.get("days_between") else ""))
    if a:
        lines += ["", "## Reported by patient/carer"]
        lines += [f"- {k.replace('_', ' ')}: {v}" for k, v in a.items() if v not in (None, "")]
    lines += ["", "## For the reviewing clinician",
              "- Confirm wound type, stage/depth and tissue estimates on direct examination.",
              "- Assess depth, undermining, pulses/perfusion and infection signs, which a photo cannot show.",
              "- Approve, edit or reject this draft; edits are logged and used to improve the model.",
              "", f"Model versions: {json.dumps(f.get('model_versions', {}))}"]
    return "\n".join(lines)


# --------------------------------------------------------------------------- LLM narrative

SYSTEM_PROMPT = (
    "You are drafting the short summary section of a wound assessment for a clinician to review. "
    "Use ONLY the facts in the FINDINGS JSON and what is visible in the image. Do not introduce any number that is "
    "not in the JSON. Do not name medicines, doses or procedures. Do not state a definitive diagnosis; use phrases "
    "like 'appearance is consistent with'. If a finding is marked uncertain, say it is uncertain. "
    "Write 3 to 5 plain sentences, no lists, no headings."
)


def llm_user_prompt(f: dict) -> str:
    keep = {k: f[k] for k in ("wound_type", "severity", "measurement", "tissue_pct", "change", "intake") if f.get(k)}
    return "FINDINGS JSON:\n" + json.dumps(keep, indent=1) + "\n\nWrite the summary."


BANNED = [r"\bdiagnos(ed|is)\b", r"\b\d+(\.\d+)?\s?(mg|ml|mcg|iu)\b", r"\bprescrib", r"\bamputat",
          r"\bantibiotic", r"\bdefinitely\b", r"\bcertainly\b"]


def _flatten_numbers(obj) -> set[float]:
    nums = set()
    if isinstance(obj, dict):
        for v in obj.values():
            nums |= _flatten_numbers(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            nums |= _flatten_numbers(v)
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        nums.add(float(obj))
        if 0 <= obj <= 1:
            nums.add(round(float(obj) * 100))  # probabilities may be written as percentages
    elif isinstance(obj, str):
        nums |= {float(x) for x in re.findall(r"\d+(?:\.\d+)?", obj)}
    return nums


def check_narrative(text: str, f: dict) -> list[str]:
    """Return a list of problems. Empty list = narrative may be used."""
    problems = []
    allowed = _flatten_numbers(f)
    for s in re.findall(r"\d+(?:\.\d+)?", text):
        x = float(s)
        if not any(abs(x - y) <= 0.051 * max(1.0, abs(y)) for y in allowed):
            problems.append(f"number not in findings: {s}")
    for pat in BANNED:
        if re.search(pat, text, flags=re.I):
            problems.append(f"banned phrase: {pat}")
    if len(text.split()) > 160:
        problems.append("too long")
    return problems


def build_report(f: dict, llm_text: str | None = None) -> tuple[str, list[str]]:
    """Render the report, using the LLM narrative only if it passes the checks."""
    f.setdefault("flags", red_flags(f))
    problems = check_narrative(llm_text, f) if llm_text else []
    narrative = llm_text.strip() if llm_text and not problems else None
    return render_report(f, narrative), problems
