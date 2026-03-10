1) Tech Stack (recommended for v1)
Frontend (public menu + AR)

Next.js (App Router) web app

Three.js for 3D rendering

WebXR (where available) for AR session

<model-viewer> as compatibility layer and/or fallback (especially Android)

iOS fallback:

Option A: Apple Quick Look with USDZ (most reliable)

Option B: “non-true AR” camera overlay fallback (less recommended)
Decision for v1: Implement Quick Look USDZ fallback on iOS when WebXR AR isn’t available.

Backend

Node.js (Next.js API routes or separate service)

Postgres + Prisma (or equivalent ORM)

Object storage + CDN (S3-compatible)

Processing Pipeline

Async job queue (e.g., BullMQ + Redis)

Generation method: start with single approach to reduce risk

Option 1: Photogrammetry pipeline (COLMAP + OpenMVS) → mesh → GLB/USDZ

Option 2: AI image-to-3D service/model → mesh → GLB/USDZ
Decision for v1: Keep pipeline interface abstract (ModelGenerator) so you can swap implementations. Agent can stub generator to accept a pre-made GLB during early integration if needed.

Analytics

PostHog / Mixpanel / GA4 (pick one)

Store restaurant + item context on every event

Server-side ingestion optional; client-side acceptable for v1

2) System Architecture Overview

Public web app serves:

Restaurant menu pages

Item detail pages

AR viewer route: /r/{slug}/item/{itemId}/ar

Admin app serves:

Dashboard

CRUD for restaurant/menu/items

Upload photos & measurement

Trigger processing job

Backend services:

API for menu data (public read)

Admin API (auth required)

Job workers for 3D generation & optimization

Storage:

Raw images stored per item/version

Output assets stored per item/version (GLB, USDZ)

Metadata in Postgres

3) Data Model (Prisma-style conceptual)
Restaurant

id (uuid)

name

slug (unique)

theme fields (optional)

createdAt, updatedAt

MenuCategory

id

restaurantId (FK)

name

sortOrder

MenuItem

id

restaurantId (FK)

categoryId (FK nullable)

name

description

price (string for v1, or cents+currency)

isAvailable

measurementType (enum)

measurementValue (number; centimeters)

arAssetStatus (enum: NONE, PROCESSING, READY, FAILED)

arAssetVersion (int)

MenuItemMedia (raw photos)

id

itemId (FK)

url

sortOrder

metadata (json: exif, width, height)

MenuItemAsset (generated model)

id

itemId (FK)

version

glbUrl

usdzUrl (optional but recommended for iOS)

units (string: “meters”)

bboxX, bboxY, bboxZ (meters)

scaleFactor (number)

polyCount (optional)

textureSize (optional)

createdAt

ProcessingJob

id

itemId

version

status (queued/running/succeeded/failed)

errorMessage

logsUrl (optional)

createdAt, updatedAt

4) API Endpoints (contract)
Public

GET /api/public/restaurants/{slug}/menu

returns categories + items + minimal fields + thumbnail

GET /api/public/items/{itemId}

returns item details + asset URLs + dimensions + measurement

Admin (auth required)

POST /api/admin/restaurants

POST /api/admin/restaurants/{id}/categories

POST /api/admin/items

POST /api/admin/items/{id}/photos (multipart)

PATCH /api/admin/items/{id} (edit measurement, etc.)

POST /api/admin/items/{id}/generate-3d (enqueue job)

GET /api/admin/items/{id}/jobs (status)

5) AR Rendering & Scale Calculation
Unit conventions

All rendering uses meters.

Every asset must be stored/served as:

units = meters

bbox in meters

pivot/origin standardized (e.g., bottom-center on table plane)

Scale logic (core)

Input: measurement type + value in cm

Determine target real-world dimension (meters):

targetMeters = measurementValue / 100.0

Determine model’s corresponding dimension:

Use asset bbox dimension mapping:

if PLATE_DIAMETER: choose max(bboxX, bboxZ) as “diameter”

if MAX_WIDTH: choose max(bboxX, bboxZ)

if CUP_HEIGHT: use bboxY

scaleFactor = targetMeters / modelDimensionMeters

Apply uniform scaling to the model in viewer

Height accuracy

Enforced by uniform scaling; height follows.

If height must match a different measurement (future), support 2-point calibration later.

6) Occlusion Strategy
Preferred (when available)

Depth-based occlusion from AR platform (WebXR depth / ARKit)

Practical v1 approach

Implement “table occlusion”:

Use an occlusion plane aligned with detected table plane so model appears correctly resting on surface (hides anything below table)

Device-dependent enhancement:

If depth occlusion supported → enable it

Else → table-plane-only occlusion + clear messaging

7) iOS Fallback Strategy

If WebXR AR not supported:

Provide “View in AR (iOS)” that opens USDZ Quick Look

Ensure USDZ uses same scale calibration as GLB (must be exported in meters)

If Quick Look unavailable:

Fallback to non-AR 3D viewer embedded in page

8) Performance Requirements

GLB compressed (Draco/Meshopt where applicable)

Textures compressed and limited resolution (e.g., 1–2K for v1)

CDN caching with versioned URLs

Lazy-load AR assets only when user taps AR

9) Analytics Events (schema)

Each event must include:

restaurantId, itemId (if applicable)

device type, OS, browser

arMode: webxr, quicklook, 3dviewer
Events:

menu_view

category_view

item_view

ar_open

ar_supported (true/false + reason)

ar_permission_result (granted/denied)

ar_asset_load_time_ms

ar_place_success

ar_session_duration_ms

ar_fallback_used

10) Testing Strategy

Unit tests:

scale calculation for each measurement type

API validation

Integration tests:

admin upload → job enqueue → status transitions

Manual test matrix:

iPhone Safari (Quick Look)

Android Chrome (WebXR if available)

Desktop (menu only + 3D viewer fallback)