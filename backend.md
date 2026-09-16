# Backend Architecture & Implementation Specification
## ClearAligner Clinical Portal & Mobile App

> Definitive backend specification based on `prd.md`, `techspec.md`, `uiux.md`, and the current Supabase + Prisma implementation.

## 1. Executive Backend Vision

The backend for this longitudinal wound-care platform is built to support a robust, offline-capable mobile client and a high-performance administrative web portal. 

The primary architectural drivers are:
- **Offline-First Resilience**: Mobile apps must function in clinical environments with zero connectivity.
- **Strict Data Isolation**: Patient data must be strictly siloed per doctor using Row-Level Security (RLS).
- **Longitudinal Tracking**: The database schema strictly follows the `Patient → Case → Treatment → Phase` hierarchy defined in the UI/UX spec.

---

## 2. Infrastructure Stack

- **Database**: PostgreSQL (hosted on Supabase)
- **ORM / Types**: Prisma (v7.10) for schema definition, migrations, and type generation.
- **Authentication**: Supabase Auth (JWT-based)
- **File Storage**: Supabase Storage (for secure wound images)
- **Monorepo**: Nx (managing shared `domain` packages between Next.js and Expo)
- **Backend APIs / Edge**: `@supabase/server` for Next.js SSR and API routes.

---

## 3. Database Schema & Data Modeling

The core domain model reflects the clinical workflow:

1. **User (Doctor)**: Synced automatically from `auth.users` via PostgreSQL triggers.
2. **Patient**: Tied to a specific `userId` (Doctor).
3. **Case**: Represents a single wound. Tied to a `Patient`.
4. **Treatment**: Represents a clinical episode (T1, T2...). Tied to a `Case`.
5. **Phase**: Represents the `PRE` or `POST` state of a Treatment.
6. **ClinicalAssessment**: Measurements, exudate, pain, and infection signs. Tied to a `Phase`.
7. **Image**: The raw image URL/metadata. Tied to a `Phase`.
8. **AIResult**: The outputs from the client-provided ML/CV model. Tied to a `Phase`.

### Prisma Integration
Prisma is used as the single source of truth for the schema (`prisma/schema.prisma`). 
- **DATABASE_URL**: Uses the Supabase Transaction Pooler (port 6543) for high-concurrency Edge/Serverless queries.
- **DIRECT_URL**: Uses the direct connection (port 5432) for running schema migrations (`npx prisma db push`).

---

## 4. Authentication & Security

### Multi-tenant Data Isolation (Row-Level Security)
Every table is secured using PostgreSQL Row-Level Security (RLS).
- A policy enforces that a logged-in doctor (`auth.uid()`) can only `SELECT`, `INSERT`, `UPDATE`, or `DELETE` records where the `userId` matches their own ID.
- Cascading RLS ensures that access to `Case`, `Treatment`, and `Phase` is restricted based on ownership of the parent `Patient` record.

### Auth Flow
- **Web**: Utilizes `@supabase/server` for secure cookie-based session management. Middleware protects the `/dashboard` routes, redirecting unauthenticated users to `/login`.
- **Mobile**: Utilizes `@supabase/supabase-js` with React Native async storage for persistent local sessions.

---

## 5. Offline-First Sync Engine (Mobile)

Because clinical environments often lack WiFi, the mobile application does not rely on real-time API calls.

### Architecture
1. **Local State**: The mobile app uses Zustand (`useVisitStore`) with React Native `secureStorage` to persist all Patient and Treatment data locally.
2. **Outbox Pattern**: Any mutation (adding a patient, saving an assessment, capturing an image) writes to a local `Outbox`.
3. **Sync Engine**: `syncManager.ts` runs a background loop (and listens to NetInfo network changes) to process the Outbox.

### Conflict Resolution: "Server Wins"
To prevent complex merge conflicts on clinical data, the system implements a strict **Server Wins** policy.
- During sync, the engine checks the `updatedAt` timestamp of the server record.
- If the server record is newer than the local Outbox item, the local changes are discarded to preserve the server's source of truth.

---

## 6. File Storage (Images)

Wound images are highly sensitive Protected Health Information (PHI).
- **Storage Bucket**: A private Supabase Storage bucket named `images`.
- **Upload Flow**: 
  1. Mobile app captures the image (M10).
  2. Image is uploaded to Supabase Storage.
  3. The returned secure path is saved to the `Image` database table linked to the current `Phase`.
- **Access Control**: RLS policies on the Storage bucket ensure that only the doctor who owns the associated patient can read or download the image.

---

## 7. AI / ML Integration

The backend treats the ML/CV model as a black-box external dependency.
- **Processing State**: When an image is uploaded, the backend (or edge function) dispatches it to the ML model.
- **Results**: The model returns Phase 1 data (Wound Area, Dimensions, Shape). The backend stores this in the `AIResult` table.
- **Resilience**: The schema supports `confidenceScore` and handles missing or null values gracefully, allowing the UI to present loading or failure states appropriately (M12/M13).

---

## 8. API Design & Data Fetching

Rather than building a heavy REST API, the application uses **Direct Database Access via Supabase Client**:

- **Client-Side**: The Web Portal's `mockStore.ts` (now connected to Supabase) directly queries the database using `supabase.from('Patient').select('*')`.
- **Server-Side**: For operations requiring elevated privileges (like generating PDF reports or aggregating dashboard statistics), Next.js Server Components and API Routes leverage `@supabase/server` and Prisma.

---

## 9. Next Implementation Phases

1. **Storage Buckets**: Provision the Supabase Storage bucket and configure RLS.
2. **File Uploads**: Implement the React Native camera capture and base64/FormData upload to Supabase Storage.
3. **PDF Generation**: Build the server-side API endpoint for Report Generation (W09/W10) using Prisma to aggregate the longitudinal case data.
