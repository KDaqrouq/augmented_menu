“Stop Conditions” (agent must stop and propose plan patch)

WebXR AR cannot be made to run in-browser reliably for iOS: proceed with Quick Look USDZ as primary iOS AR path and document it.

Occlusion depth not available: implement table-plane occlusion + explicit UX note.

Generator tool not integrated: keep stub generator, finish end-to-end product, then swap generator later.

Rules for agent:
- Do not invent endpoints/fields beyond what’s specified; if needed, add clearly marked assumptions.

- After each checkpoint: list files changed + commands run + what was verified.

- If WebXR occlusion/depth isn’t feasible, implement table-plane occlusion and log “depth occlusion not supported”.

Phase 0 — Repo scaffold & conventions

Initialize project

Create Next.js app (App Router) + TypeScript

Add Prisma + Postgres

Add Tailwind (optional but recommended)
Checkpoint 0A: App runs locally; DB connection works.

Create base layout

Public routes under /r/[slug]

Admin routes under /admin
Checkpoint 0B: Navigation between placeholder pages works.

Phase 1 — Data model + APIs

Implement Prisma schema

Add models: Restaurant, MenuCategory, MenuItem, MenuItemMedia, MenuItemAsset, ProcessingJob

Run migrations
Checkpoint 1A: prisma migrate successful; tables exist.

Public API endpoints

GET /api/public/restaurants/{slug}/menu

GET /api/public/items/{itemId}
Checkpoint 1B: Can fetch menu JSON for a seeded restaurant.

Admin auth (minimal)

Implement admin login (simple password gate for v1 is acceptable if explicitly documented)
Checkpoint 1C: Unauthenticated users cannot access admin APIs.

Phase 2 — Admin portal (you upload content)

Admin CRUD: restaurants/categories/items

Create UI + API routes

Add “Generate QR link” display for restaurant slug
Checkpoint 2A: Can create restaurant, categories, items.

Photo upload feature

Multipart upload to object storage (S3-compatible) OR local dev storage

Save MenuItemMedia rows with URLs and order
Checkpoint 2B: Upload 6–12 photos; see thumbnails in admin.

Measurement editing

UI fields for measurementType + measurementValue (cm)

Validate numeric range (reasonable bounds; e.g., 1–200 cm)
Checkpoint 2C: Can edit measurement and save.

Phase 3 — Processing pipeline (jobs + stub generator)

Job queue setup

Add Redis + BullMQ (or equivalent)

Create worker process
Checkpoint 3A: Can enqueue and process a dummy job.

“Generate 3D” endpoint

POST /api/admin/items/{id}/generate-3d

Create ProcessingJob row; set item status PROCESSING; increment version
Checkpoint 3B: Status transitions visible in admin.

Generator abstraction

Define interface ModelGenerator.generate(itemId, version) -> { glbUrl, usdzUrl?, bbox, units }

For v1 integration, allow a stub that returns a preloaded sample model to unblock AR work
Checkpoint 3C: Job can mark READY with stub asset.

Asset metadata storage

Create MenuItemAsset row with bbox + scaleFactor (initially 1.0 if stub)

Set item status READY
Checkpoint 3D: Item shows READY and asset URLs are accessible.

Phase 4 — Public menu UI

Menu page

/r/[slug] loads categories + items

Search input filters items
Checkpoint 4A: Single QR URL shows a usable menu.

Item detail page

/r/[slug]/item/[itemId]

Show photos, description, price

“View in AR” button
Checkpoint 4B: Button routes to AR page.

Phase 5 — AR viewer + scale correctness

AR viewer route

/r/[slug]/item/[itemId]/ar

Load item asset metadata + model URL

Implement 3D viewer baseline (non-AR) to ensure model loads
Checkpoint 5A: Model renders in 3D viewer reliably.

Implement scale calculation (must be correct)

Compute scaleFactor from measurement and asset bbox

Apply uniform scale

Display debug overlay in dev: target cm, bbox m, scaleFactor
Checkpoint 5B: Verified with at least 2 test items that scale math is correct.

WebXR AR attempt (Android/compatible)

Implement WebXR AR session where supported

Plane detection / hit-test for table placement

Tap to place; move/rotate; lock scale
Checkpoint 5C: On a WebXR-capable device, can place model on a table.

iOS fallback (must “work”)

If WebXR not available (typical iOS Safari), show button “Open in AR”:

open USDZ in Quick Look using rel="ar" or direct link pattern

If USDZ missing, fallback to embedded 3D viewer with “AR not supported” copy
Checkpoint 5D: On iPhone, AR button opens Quick Look (or at minimum shows 3D viewer fallback).

Phase 6 — Occlusion (best possible)

Table-plane occlusion (required minimum)

When placing on table, create an occlusion plane aligned to the hit-test plane to hide geometry below the table surface
Checkpoint 6A: Model appears to sit on the table without clipping below.

Depth occlusion enhancement (optional, best-effort)

If platform provides depth info, enable depth-based occlusion

Else keep table-plane occlusion and show “Limited occlusion” note
Checkpoint 6B: Occlusion behavior is deterministic and non-buggy.

Phase 7 — Analytics + dashboard

Implement client analytics events

Fire required events with restaurantId/itemId context

Include arMode and fallbacks used
Checkpoint 7A: Events appear in analytics tool with correct properties.

Internal analytics dashboard

Admin page: restaurant-level stats + top items + device breakdown
Checkpoint 7B: Dashboard loads and reflects tracked events.

Phase 8 — Hardening + performance

Asset optimization pass (v1)

Add compression pipeline hooks (even if manual initially)

Ensure CDN cache headers and versioned URLs
Checkpoint 8A: AR assets load quickly; no blocking on menu load.

Error handling & UX polish

Camera permission denied screen

Unsupported device screen

Retry + back navigation stable
Checkpoint 8B: No dead ends; always a fallback path.