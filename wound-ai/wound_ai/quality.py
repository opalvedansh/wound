"""Capture-quality gate. Bad photos are rejected with a retake instruction instead of analysed.

Thresholds below are starting points: tune them on your own phones and lighting,
and log every rejection so you can see whether the gate is too strict.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np


@dataclass
class QualityResult:
    ok: bool
    issues: list[str] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)


def check_quality(img_rgb: np.ndarray, marker_found: bool | None = None, min_side: int = 480,
                  blur_threshold: float = 60.0, dark: float = 50.0, bright: float = 215.0,
                  max_clipped: float = 0.08) -> QualityResult:
    issues = []
    h, w = img_rgb.shape[:2]
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    # Normalise width so the blur score is comparable across phone resolutions.
    g = cv2.resize(gray, (640, int(640 * h / w)))
    blur = float(cv2.Laplacian(g, cv2.CV_64F).var())
    mean = float(g.mean())
    clipped = float(((g >= 250) | (g <= 5)).mean())

    if min(h, w) < min_side:
        issues.append(f"Photo resolution is too low ({w}x{h}). Use the phone's main camera at full resolution.")
    if blur < blur_threshold:
        issues.append("Photo looks blurry. Hold the phone steady, tap to focus on the wound, and retake.")
    if mean < dark:
        issues.append("Photo is too dark. Use room light or daylight (avoid flash) and retake.")
    if mean > bright or clipped > max_clipped:
        issues.append("Photo is over-exposed or has glare. Avoid flash and direct light on wet wound surfaces.")
    if marker_found is False:
        issues.append("Calibration sticker not found. Place it next to the wound, flat, fully visible, then retake. "
                      "(Without it the size cannot be measured.)")
    return QualityResult(ok=not issues, issues=issues,
                         metrics={"blur_var": blur, "mean_brightness": mean, "clipped_frac": clipped,
                                  "width": w, "height": h})
