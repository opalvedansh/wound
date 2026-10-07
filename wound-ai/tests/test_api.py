"""API contract the app relies on: key check, required answers, retake, and the outline.

Runs with an empty checkpoint folder, i.e. before any model is trained, which is how the app is wired up.

    .venv/bin/python -m pytest tests
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["CKPT_DIR"] = tempfile.mkdtemp(prefix="wound_ckpt_empty_")

from fastapi.testclient import TestClient  # noqa: E402

from api.server import app  # noqa: E402
from wound_ai.pipeline import mask_outline  # noqa: E402

KEY = "test-key"
INTAKE = {"diabetes": "no", "cause": "pressure_lying_or_sitting", "body_location": "heel"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("WOUND_API_KEY", KEY)
    return TestClient(app)


def jpeg(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def textured_photo() -> bytes:
    """Sharp, evenly lit 640x480 image that passes the quality gate."""
    rng = np.random.default_rng(0)
    return jpeg(rng.integers(40, 210, (480, 640, 3), dtype=np.uint8))


def analyze(client: TestClient, photo: bytes, intake: dict | str = INTAKE, key: str | None = KEY):
    headers = {"X-API-Key": key} if key is not None else {}
    body = intake if isinstance(intake, str) else json.dumps(intake)
    return client.post("/analyze", files={"image": ("w.jpg", photo, "image/jpeg")}, data={"intake": body}, headers=headers)


def test_health_is_open(client):
    assert client.get("/health").status_code == 200


def test_every_other_route_needs_the_key(client):
    assert client.get("/intake/questions").status_code == 401
    assert client.get("/intake/questions", headers={"X-API-Key": "wrong"}).status_code == 401
    assert analyze(client, textured_photo(), key=None).status_code == 401
    assert client.post("/review", json={"case_id": "x", "reviewer_id": "y", "decision": "approved"}).status_code == 401
    assert client.get("/intake/questions", headers={"X-API-Key": KEY}).status_code == 200


def test_refuses_everything_when_no_key_is_configured(monkeypatch):
    monkeypatch.delenv("WOUND_API_KEY", raising=False)
    c = TestClient(app)
    assert c.get("/intake/questions", headers={"X-API-Key": ""}).status_code == 503
    assert analyze(c, textured_photo(), key="anything").status_code == 503


def test_diabetes_and_cause_are_required(client):
    r = analyze(client, textured_photo(), {"body_location": "heel"})
    assert r.status_code == 400
    assert r.json()["detail"]["missing"] == ["diabetes", "cause"]
    assert analyze(client, textured_photo(), {"diabetes": "yes", "cause": ""}).json()["detail"]["missing"] == ["cause"]
    assert analyze(client, textured_photo(), "[1, 2]").status_code == 400


def test_works_before_any_model_is_trained(client):
    r = analyze(client, textured_photo())
    assert r.status_code == 200, r.text
    f = r.json()
    assert f["status"] == "ok"
    assert f["measurement"] is None
    assert f["outline"] is None
    assert any("Size not measured" in flag["text"] for flag in f["flags"])
    assert "AI-assisted draft" in f["report_markdown"]
    assert f["case_id"]


def test_blank_photo_asks_for_a_retake(client):
    flat = jpeg(np.full((480, 640, 3), 128, np.uint8))
    f = analyze(client, flat).json()
    assert f["status"] == "retake"
    assert any("blurry" in issue for issue in f["quality"]["issues"])
    assert "report_markdown" not in f


def test_outline_is_scaled_to_the_photo():
    mask = np.zeros((200, 400), np.uint8)
    mask[50:150, 100:300] = 1  # one 200x100 px wound
    mask[0:2, 0:2] = 1  # a speck, dropped
    polygons = mask_outline(mask)
    assert polygons is not None and len(polygons) == 1
    xs = [x for x, _ in polygons[0]]
    ys = [y for _, y in polygons[0]]
    assert min(xs) == pytest.approx(0.25, abs=0.01) and max(xs) == pytest.approx(0.75, abs=0.01)
    assert min(ys) == pytest.approx(0.25, abs=0.01) and max(ys) == pytest.approx(0.75, abs=0.01)


def test_no_outline_without_a_wound():
    assert mask_outline(None) is None
    assert mask_outline(np.zeros((10, 10), np.uint8)) is None
