"""Metrics that matter clinically, with confidence intervals."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import confusion_matrix, f1_score, roc_auc_score


def dice_iou(pred: np.ndarray, gt: np.ndarray, eps: float = 1e-7) -> tuple[float, float]:
    pred, gt = pred.astype(bool), gt.astype(bool)
    inter = (pred & gt).sum()
    union = (pred | gt).sum()
    if union == 0:  # both empty -> perfect agreement
        return 1.0, 1.0
    dice = (2 * inter + eps) / (pred.sum() + gt.sum() + eps)
    return float(dice), float((inter + eps) / (union + eps))


def per_class_sens_spec(y_true: np.ndarray, y_pred: np.ndarray, classes: list[str]) -> dict:
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(classes))))
    out = {}
    for i, c in enumerate(classes):
        tp = cm[i, i]
        fn = cm[i].sum() - tp
        fp = cm[:, i].sum() - tp
        tn = cm.sum() - tp - fn - fp
        out[c] = {
            "sensitivity": float(tp / (tp + fn)) if tp + fn else float("nan"),
            "specificity": float(tn / (tn + fp)) if tn + fp else float("nan"),
            "ppv": float(tp / (tp + fp)) if tp + fp else float("nan"),
            "support": int(tp + fn),
        }
    return out


def expected_calibration_error(probs: np.ndarray, y_true: np.ndarray, n_bins: int = 10) -> float:
    conf = probs.max(1)
    correct = (probs.argmax(1) == y_true).astype(float)
    edges = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            ece += m.mean() * abs(correct[m].mean() - conf[m].mean())
    return float(ece)


def macro_auroc(probs: np.ndarray, y_true: np.ndarray) -> float:
    try:
        if probs.shape[1] == 2:
            return float(roc_auc_score(y_true, probs[:, 1]))
        return float(roc_auc_score(y_true, probs, multi_class="ovr", average="macro",
                                   labels=list(range(probs.shape[1]))))
    except ValueError:
        return float("nan")  # a class is missing from this subset


def bootstrap_ci(fn, *arrays, n: int = 1000, seed: int = 0, alpha: float = 0.05) -> tuple[float, float, float]:
    """Point estimate + 95% CI by resampling cases. Report the CI, not just the number."""
    rng = np.random.default_rng(seed)
    point = fn(*arrays)
    size = len(arrays[0])
    stats = []
    for _ in range(n):
        idx = rng.integers(0, size, size)
        v = fn(*(a[idx] for a in arrays))
        if not np.isnan(v):
            stats.append(v)
    if not stats:
        return float(point), float("nan"), float("nan")
    lo, hi = np.percentile(stats, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return float(point), float(lo), float(hi)


def macro_f1(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(f1_score(y_true, y_pred, average="macro", zero_division=0))


def cohen_kappa(a: np.ndarray, b: np.ndarray) -> float:
    """Agreement between two clinicians. This is the ceiling your model can be judged against."""
    from sklearn.metrics import cohen_kappa_score

    return float(cohen_kappa_score(a, b))
