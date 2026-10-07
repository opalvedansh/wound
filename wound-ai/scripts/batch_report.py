"""Day 11: run the whole pipeline on test photos and save every report, so you can read them side by side.

    python scripts/batch_report.py --manifest data/manifest.csv --ckpt-dir checkpoints --n 30 --out reports/batch

Each photo gets a sample set of intake answers (cycled from SAMPLE_INTAKES), so the rules and wording are
exercised too. Writes one Markdown report and one outline overlay per photo, plus summary.csv with the
status, flags, size and, where the manifest has a true mask, the outline's Dice score against it.
Read all of them: fix confusing wording, check the numbers match the findings, and check that
low-confidence results say UNCERTAIN.
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

import cv2
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from wound_ai.data import read_mask  # noqa: E402
from wound_ai.metrics import dice_iou  # noqa: E402
from wound_ai.pipeline import WoundAnalyzer  # noqa: E402

SAMPLE_INTAKES = [
    {"body_location": "heel", "cause": "pressure_lying_or_sitting", "diabetes": "no", "fever": "no", "pain": 3},
    {"body_location": "foot_plantar", "cause": "started_on_its_own", "diabetes": "yes", "fever": "no", "pain": 1},
    {"body_location": "lower_leg", "cause": "started_on_its_own", "diabetes": "no", "redness_spreading": "yes", "pain": 6},
    {"body_location": "toe", "cause": "injury_cut_or_fall", "diabetes": "yes", "fever": "yes", "redness_spreading": "yes"},
    {"body_location": "foot_dorsal", "cause": "burn", "diabetes": "no", "burn_agent": "hot_liquid"},
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--ckpt-dir", default="checkpoints")
    ap.add_argument("--split", default="test")
    ap.add_argument("--n", type=int, default=30)
    ap.add_argument("--marker-mm", type=float, default=20.0)
    ap.add_argument("--out", default="reports/batch")
    a = ap.parse_args()

    df = pd.read_csv(a.manifest)
    rows = df[df.split == a.split].head(a.n)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    analyzer = WoundAnalyzer(a.ckpt_dir, marker_mm=a.marker_mm)
    print(f"models: {analyzer.seg.keys() | analyzer.cls.keys() or 'none'} | {len(rows)} {a.split} photos")

    summary = []
    for i, row in enumerate(rows.itertuples()):
        stem = Path(row.image_path).stem
        f = analyzer.analyze(row.image_path, SAMPLE_INTAKES[i % len(SAMPLE_INTAKES)], overlay_path=str(out / f"{stem}_outline.jpg"))
        (out / f"{stem}.md").write_text(f.get("report_markdown") or f"Status: {f['status']}\n\n" + "\n".join(f.get("quality", {}).get("issues", [])))

        dice = ""
        mask_path = getattr(row, "mask_path", None)
        if f.get("outline") and isinstance(mask_path, str) and mask_path:
            truth = read_mask(mask_path, binary=True)
            pred = np.zeros(truth.shape, np.uint8)
            h, w = truth.shape
            for poly in f["outline"]:
                cv2.fillPoly(pred, [np.array([[x * w, y * h] for x, y in poly], np.int32)], 1)
            dice = round(dice_iou(pred, truth)[0], 3)
        m = f.get("measurement") or {}
        wt = f.get("wound_type") or {}
        summary.append({
            "photo": stem, "status": f["status"], "dice_vs_truth": dice,
            "area_cm2": m.get("area_cm2", ""), "wound_type": wt.get("label", ""), "wound_type_prob": wt.get("prob", ""),
            "urgent_flags": sum(fl["level"] == "urgent" for fl in f.get("flags", [])),
            "review_flags": sum(fl["level"] == "review" for fl in f.get("flags", [])),
        })
        print(f"{stem}: {f['status']} | dice {dice or '-'} | flags {summary[-1]['urgent_flags']} urgent, {summary[-1]['review_flags']} review")

    with open(out / "summary.csv", "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(summary[0]) if summary else ["photo"])
        writer.writeheader()
        writer.writerows(summary)
    scored = [s["dice_vs_truth"] for s in summary if s["dice_vs_truth"] != ""]
    if scored:
        print(f"mean outline Dice on these photos: {np.mean(scored):.3f} (n={len(scored)})")
    print(f"reports in {out}/ — read them all")


if __name__ == "__main__":
    main()
