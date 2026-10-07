"""HTTP API for the wound analyzer (FastAPI). Your Next.js app calls this.

    WOUND_API_KEY=... CKPT_DIR=checkpoints uvicorn api.server:app --host 0.0.0.0 --port 8000

Endpoints (all but /health need the X-API-Key header to match WOUND_API_KEY)
  GET  /health                    model versions
  GET  /intake/questions          core intake questions for the form
  POST /intake/follow-ups         extra questions given answers so far (+ model's first guess)
  POST /analyze                   photo + intake answers -> findings + report draft
  POST /review                    clinician approves / edits / rejects a draft

Only the app's server holds the key; phones and browsers never call this API directly.
If WOUND_API_KEY is unset the API refuses every request rather than running open.

Privacy: by default nothing is written to disk. Set STORE_CASES=1 only inside an
ethics-approved study where patients consented to their data being kept; cases
are then saved under CASE_DIR for annotation and for fine-tuning the summary model.
Put this behind authentication (clinician accounts) and HTTPS before real use.
"""
from __future__ import annotations

import hmac
import json
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from wound_ai.intake import CORE_QUESTIONS, follow_up_questions
from wound_ai.pipeline import WoundAnalyzer

CKPT_DIR = os.environ.get("CKPT_DIR", "checkpoints")
STORE = os.environ.get("STORE_CASES") == "1"
CASE_DIR = Path(os.environ.get("CASE_DIR", "data/cases"))
MAX_BYTES = 15 * 1024 * 1024
# The assessment changes with these answers (diabetic-foot rule, follow-up selection), so they are never optional.
REQUIRED_INTAKE = ("diabetes", "cause")

llm = None
if os.environ.get("USE_LLM") == "1":
    from wound_ai import llm as llm_mod

    llm = llm_mod.load(adapter=os.environ.get("LLM_ADAPTER") or None)

analyzer = WoundAnalyzer(CKPT_DIR, marker_mm=float(os.environ.get("MARKER_MM", 20)), llm=llm)
app = FastAPI(title="Wound assessment API", version="0.1.0")


def require_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("WOUND_API_KEY", "")
    if not expected:
        raise HTTPException(503, "WOUND_API_KEY is not set on the server, so no request is accepted")
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), expected.encode()):
        raise HTTPException(401, "missing or wrong X-API-Key")


keyed = [Depends(require_key)]


class FollowUpRequest(BaseModel):
    answers: dict
    predicted_type: str | None = None


class Review(BaseModel):
    case_id: str
    reviewer_id: str
    decision: str              # approved | edited | rejected
    final_summary: str | None = None
    corrections: dict | None = None   # e.g. {"wound_type": "venous", "pu_stage": null}


@app.get("/health")
def health():
    return {"ok": True, "models": {**{k: v["version"] for k, v in analyzer.seg.items()},
                                   **{k: v["version"] for k, v in analyzer.cls.items()}}}


@app.get("/intake/questions", dependencies=keyed)
def questions():
    return CORE_QUESTIONS


@app.post("/intake/follow-ups", dependencies=keyed)
def follow_ups(req: FollowUpRequest):
    return follow_up_questions(req.answers, req.predicted_type)


# A plain `def`: inference is synchronous, so FastAPI runs it in a worker thread instead of blocking the server.
@app.post("/analyze", dependencies=keyed)
def analyze(image: UploadFile = File(...), intake: str = Form("{}"), previous: str = Form("")):
    try:
        answers = json.loads(intake or "{}")
        prev = json.loads(previous) if previous else None
    except json.JSONDecodeError:
        raise HTTPException(400, "intake/previous must be JSON")
    if not isinstance(answers, dict):
        raise HTTPException(400, "intake must be a JSON object")
    missing = [k for k in REQUIRED_INTAKE if answers.get(k) in (None, "")]
    if missing:
        raise HTTPException(400, {"error": "required intake answers missing", "missing": missing})
    data = image.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "image too large")
    bgr = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(400, "could not read image")
    case_id = uuid.uuid4().hex
    f = analyzer.analyze(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), answers, prev)
    f["case_id"] = case_id
    if f.get("wound_type"):
        f["follow_up_questions"] = follow_up_questions(answers, f["wound_type"]["label"])
    if STORE:
        d = CASE_DIR / case_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "image.jpg").write_bytes(data)
        (d / "findings.json").write_text(json.dumps(f, indent=1, default=str))
    return f


@app.post("/review", dependencies=keyed)
def review(r: Review):
    if r.decision not in ("approved", "edited", "rejected"):
        raise HTTPException(400, "decision must be approved, edited or rejected")
    if STORE:
        d = CASE_DIR / r.case_id
        if not d.exists():
            raise HTTPException(404, "unknown case")
        (d / "review.json").write_text(r.model_dump_json(indent=1))
    return {"ok": True, "stored": STORE}
