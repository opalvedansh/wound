"""Day 7: check size measurement on your own phone, before trusting any model.

Cut a red paper shape of known size (say a 4 x 3 cm rectangle = 12 cm²), stick a printed calibration sticker
beside it on a flat surface, and photograph it straight on and again at about 30 degrees. The red shape stands
in for the wound: it is found by colour, so this tests the sticker and the measurement maths, not the model.

    python scripts/check_measure.py straight.jpg tilted.jpg --true-area 12 --overlay-dir reports/measure

Pass: measured area within about 5% of the true area at both angles.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from wound_ai.data import read_rgb  # noqa: E402
from wound_ai.measure import find_marker, measure_wound  # noqa: E402


def red_mask(img_rgb: np.ndarray) -> np.ndarray:
    """The largest saturated red region (red wraps around hue 0 in HSV)."""
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    red = cv2.inRange(hsv, (0, 90, 50), (10, 255, 255)) | cv2.inRange(hsv, (170, 90, 50), (180, 255, 255))
    red = cv2.morphologyEx(red, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats((red > 0).astype(np.uint8))
    if n <= 1:
        return np.zeros(red.shape, np.uint8)
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return (labels == largest).astype(np.uint8)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photos", nargs="+")
    ap.add_argument("--true-area", type=float, help="the shape's real area in cm²")
    ap.add_argument("--marker-mm", type=float, default=20.0, help="printed sticker side length (check with a ruler)")
    ap.add_argument("--tolerance", type=float, default=5.0, help="pass if within this many percent")
    ap.add_argument("--overlay-dir", help="write each photo with the found shape and sticker drawn on it")
    a = ap.parse_args()

    failures = 0
    for path in a.photos:
        img = read_rgb(path)
        calib = find_marker(img, a.marker_mm)
        mask = red_mask(img)
        if calib is None:
            print(f"{path}: sticker NOT found. Keep it flat, fully in frame, without glare.")
            failures += 1
            continue
        if not mask.any():
            print(f"{path}: no red shape found.")
            failures += 1
            continue
        m = measure_wound(mask, calib)
        if m is None:
            print(f"{path}: shape too small to measure.")
            failures += 1
            continue
        line = f"{path}: {m.area_cm2:.2f} cm² ({m.length_cm:.2f} x {m.width_cm:.2f} cm), sticker {calib.marker_px_side:.0f} px"
        if a.true_area:
            error = 100 * (m.area_cm2 - a.true_area) / a.true_area
            ok = abs(error) <= a.tolerance
            failures += not ok
            line += f", error {error:+.1f}% -> {'PASS' if ok else 'FAIL'}"
        print(line)
        if a.overlay_dir:
            out = Path(a.overlay_dir)
            out.mkdir(parents=True, exist_ok=True)
            vis = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(vis, contours, -1, (0, 255, 0), max(2, img.shape[1] // 300))
            cv2.imwrite(str(out / f"{Path(path).stem}_measured.jpg"), vis)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
