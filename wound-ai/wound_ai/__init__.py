"""wound_ai: modular wound-image analysis for clinician-assist reporting.

Pipeline: capture quality gate -> wound segmentation -> wound type / severity
classifiers -> tissue segmentation -> marker-based measurement -> red-flag rules
-> report draft (template or MedGemma) -> clinician review.

Every output of this package is a DRAFT for a qualified clinician to review.
"""

__version__ = "0.1.0"
