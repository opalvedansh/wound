# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users
Doctors, clinicians, and wound care specialists operating at the point of care in clinical environments.

## Product Purpose
A longitudinal wound-care tracking application. It allows clinicians to capture calibrated wound images, process them through a client-provided ML/CV model for segmentation and sizing, and track wound healing progression across treatments. Success means a reliable, offline-capable, and highly trusted clinical tool that integrates seamlessly into a doctor's workflow without acting like a disconnected form.

## Positioning
A highly credible clinical instrument centered around the longitudinal "wound journey." It is explicitly not a generic SaaS tool. It enforces a strict taxonomy: Patient → Case (one wound) → Treatment (care episode) → Phase (Pre/Post visit).

## Operating Context
Clinical environments with varying network reliability. The offline workflow is a first-class citizen—the app must function seamlessly without connectivity, safely queue local data, and sync when online. 

## Capabilities and Constraints
- **Offline First**: Native offline support with local secure storage and explicit sync states.
- **Client ML/CV Dependency**: The app integrates a client-provided AI model. The UX handles capture quality, calibration, low confidence, and retries, but NEVER invents model capabilities or medical claims.
- **Clinical Accuracy**: No invented clinical taxonomies. All wound types, exudate lists, and pain scales require explicit sign-off.
- **Privacy & Security**: Strict data privacy rules including metadata handling and private-area considerations.

## Brand Commitments
- Visual language must convey clinical credibility, trust, calm, precision, and simplicity.
- Banned aesthetics: excessive gradients, glassmorphism, arbitrary rounded cards, decorative dashboards, "AI magic" animations.

## Evidence on Hand
- Detailed UI/UX specification (`uiux.md`).
- Strict phasing rules (`phase.md`) restricting Phase 2 tissue features from appearing in Phase 1.
- Client-provided ML model capabilities for Phase 1 (Area, Length × Height, Major/Minor axis, Shape).

## Product Principles
1. **The Case is the Source of Truth:** A clinician must understand wound progression across treatments without repeatedly navigating away.
2. **Never Invent Medical Logic:** Clinical inputs and AI interpretations must strictly follow approved requirements, never guessing at diagnoses.
3. **Offline Safety is Visible:** Clinicians must trust that captured data is safe locally and understand sync state at a glance.
4. **Unmistakable Phases:** The distinction between Pre-Treatment and Post-Treatment states must be explicitly labeled and visually unmissable.
