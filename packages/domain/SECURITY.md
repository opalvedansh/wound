# Security & Data Retention Baseline

## Data Classification
- **PHI (Protected Health Information):** Patient names, DOB, clinical assessments, and medical images are strictly classified as PHI.
- **PII (Personally Identifiable Information):** Emails, phone numbers, and addresses.

## Encryption Standards
- **In Transit:** TLS 1.3 for all client-server and server-database communication.
- **At Rest:** AES-256 bit encryption for the PostgreSQL database (handled at the infrastructure layer) and S3 buckets storing medical images.

## Authentication & Authorization
- **Auth:** JWT-based stateless authentication with short-lived access tokens and httpOnly refresh tokens.
- **RBAC:** Roles (Admin, Orthodontist, Dentist, Patient) determine access levels. Patients can only access their own data.

## Data Retention Policy
- **Active Patients:** Data retained indefinitely while treatment is active.
- **Completed/Archived Patients:** Clinical records and S3 images retained for 7 years post-treatment completion (compliant with standard medical retention policies).
- **Audit Logs:** System access and mutation logs retained for 1 year in hot storage, 6 years in cold storage.
