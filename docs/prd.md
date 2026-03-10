1) Goal

Create a QR-accessible web menu where each item can be viewed in AR at accurate real-world scale (1:1) on a table surface. Users browse a normal menu UI, tap a camera/AR button on any item, and see the dish+plate in AR. Must work for iPhone majority users with a practical fallback if full WebAR capabilities aren’t available.

2) Users & Use Cases
End customer (primary)

Scan restaurant QR → menu opens instantly

Browse categories, search, open item detail

Tap “View in AR” → camera opens → place item on table

View item at true scale; move/rotate; exit back to menu

Admin / Operator (you) (primary for v1)

Create restaurants

Create menu items and categories

Upload 6–12 photos per item + one measurement per item

Trigger 3D generation pipeline

Publish updates; see processing status

View analytics

3) Scope
In scope (v1)

Single QR code opens menu web app

Menu browsing (categories, item list, item details)

“View in AR” per item

AR placement tables only (horizontal plane)

True-to-scale rendering using one measurement per item

Occlusion (best possible on iPhone; degrade gracefully)

Backend pipeline: photos → 3D asset (GLB + iOS fallback if needed)

Admin portal (you upload content)

Analytics: views + AR engagement + device breakdown

Out of scope (v1)

Restaurant self-service onboarding (owners uploading themselves)

Real-time availability / POS integration

Payments or ordering

Multi-user shared AR

Perfect photorealism; “good enough” acceptable if scale is accurate

4) Non-Functional Requirements

Mobile-first performance: fast menu load; AR assets load acceptably on cellular

Modern device assumption (recent iOS/Android)

Reliability: graceful fallbacks for unsupported AR/camera permissions

Security: admin auth required for uploads; public menu read-only

Observability: pipeline failures surfaced with actionable errors

5) Key Product Decisions
Measurement per item (scale)

Each item includes MeasurementType and MeasurementValue.

Default measurement: plate diameter (recommended), but must support alternatives since plate varies.

Agent must implement at least:

PLATE_DIAMETER_CM

BOWL_DIAMETER_CM

CUP_HEIGHT_CM

MAX_WIDTH_CM (fallback if plate/bowl unknown)

iPhone-first WebAR strategy

Prefer browser AR if feasible; if not, use a fallback experience that still “works”.

Fallback must still show the object and allow user to place/scale accurately (even if tracking is less stable).

Occlusion requirement

Must implement an occlusion strategy.

If full real-world occlusion is not technically available in some browsers, the system must:

provide best-effort occlusion where possible

clearly degrade (e.g., “Limited occlusion on this device”)

6) UX Flows
Flow A — Customer

Scan QR → /r/{restaurantSlug}

Menu page loads (categories, search)

Tap item → item details page

Tap “View in AR”

Camera permission prompt

AR view: scan table → tap to place → move/rotate

Exit AR → returns to item details/menu

Flow B — Admin (you)

Login → dashboard

Create restaurant → generate QR link

Create categories + items

Upload 6–12 photos + measurement

Trigger “Generate 3D”

Monitor status (processing/ready/failed) + view preview

Publish menu

7) Success Metrics

Menu load time (p50, p90)

Item detail view → AR open rate

AR open → successful placement rate

Median time-in-AR per item

iOS vs Android success rates

Pipeline success rate per item (ready vs failed)

8) Acceptance Criteria (Definition of Done)
Menu

 One QR opens restaurant menu in browser

 Menu supports category browsing + search

 Each item page has “View in AR” entry

 Back button returns correctly without losing menu state

AR

 AR view opens camera and attempts table placement

 Item appears at accurate scale using stored measurement

 User can move and rotate object; scale is locked (unless in admin debug)

 Occlusion is enabled where supported; otherwise shows fallback behavior

 iPhone users get a working AR-like experience (native Quick Look or web fallback) rather than dead end

Pipeline

 Admin can upload photos + measurement and trigger generation

 System produces a web-friendly model asset (GLB) and stores dimensions/scale factor

 Failures are visible with reason and “retry” option

Analytics

 Track events: menu_view, item_view, ar_open, ar_permission_result, ar_supported, ar_place_success, ar_session_end

 Dashboard shows per-restaurant metrics and device/browser breakdown

9) Edge Cases & Constraints

Low light / reflective plates → tracking/model quality issues

Camera permission denied → show instructions + non-AR 3D viewer fallback

Unsupported browser features → fallback path

Wrong measurement entered → scale incorrect; admin must be able to edit measurement and re-scale/re-export without re-uploading images