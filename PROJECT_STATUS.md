# SIH26166 — Project Status & Context Brief
**Last updated:** (update this line each time you edit)

> **How to use this file:** Paste this entire document at the start of any new AI chat session so it has full context immediately. Update the checklists at the bottom as you complete work — this file is meant to be a living log, not a one-time snapshot.

---

## 1. What we're building (plain-language summary)

**Problem Statement:** SIH26166 — Multi-modal, Sun-Angle and Scale-Invariant Image Correspondence using Chandrayaan-2 optical images (OHRC, TMC and IIRS)

India's Chandrayaan-2 orbiter has three cameras (OHRC, TMC, IIRS) that photograph the same lunar regions very differently — different sun angles, different resolutions, and IIRS isn't even a normal photo (hyperspectral/infrared). Nobody currently has an automated way to confirm "these images from different cameras/times show the same place."

**What we're building:** A website where a scientist uploads two Moon images, and the system:
1. Figures out if they show the same place or not
2. If yes — shows how they align, stamps it onto its correct spot on an interactive 2D Moon map
3. If no — honestly reports "no match" instead of forcing a wrong answer
4. Remembers every result permanently, so the Moon map grows more complete over time (unverified areas stay black — intentional and honest)

**Real-world motivation:** ISRO has years of scattered, multi-instrument Moon imagery with no automated cross-referencing tool. This matters for tasks like landing-site characterization (as needed for Chandrayaan-3).

**Official PS requirements (from the real PS text — not just our interpretation):**
- Generic software solution finding correspondence between Chandrayaan-2 images and lunar reference images
- **Sub-pixel accuracy**
- **Match points maintaining uniform distribution across the images** (not clustered)
- Deliverable: software + registered product **with corresponding match points**
- Deliverable: evaluation metric (RMSE, inlier match count, inlier ratio, etc.)

---

## 2. Team & roles

| Person | Role | Owns |
|---|---|---|
| **Rashel** | Camera Geometry | Coarse geolocation alignment from spacecraft/PDS4 metadata |
| **Sahid** | Signal Processing | Phase correlation matching (same-sensor optical pairs, sun-angle robust) |
| **Khushi** | Information Theory | Mutual information matching (cross-modal pairs, e.g. OHRC↔IIRS) |
| **Urmi** | Optimization/Validation | RANSAC validation, spatial distribution enforcement, final transform |
| **Harish** | Deep Learning (stretch) | Pretrained SuperPoint+SuperGlue fallback for hardest cross-modal cases — **only activated on October go/no-go decision** |
| **Moumita** | Systems Integration | Next.js frontend, Leaflet 2D Moon map, NestJS gateway, MongoDB |

---

## 3. Pipeline — how a request actually flows

```
Scientist uploads 2 images (Next.js)
        ↓
NestJS gateway receives, enqueues job
        ↓
Rashel's stage: parse PDS4 metadata → coarse geolocation/alignment
        ↓ (fails here if metadata missing → user told clearly, no wasted compute)
Sahid's stage (optical-optical pairs) ⟷ Khushi's stage (cross-modal pairs) — run in parallel, routed by instrument type
        ↓
Urmi's stage: spatial-distribution-aware candidate selection → RANSAC → final transform + inlier count + RMSE
        ↓
Decision: MATCHED (≥threshold inliers) / UNCERTAIN (borderline) / UNMATCHED (below threshold)
        ↓
Moumita's stage: on MATCHED → warp image, write Observation + MoonMapPatch, stamp onto live 2D Leaflet map
                 on UNMATCHED/UNCERTAIN → write Observation only, honestly report to user, nothing stamped
```

**(Conditional, Oct+) Harish's stage** sits as an alternative to Sahid/Khushi specifically for hard cross-modal cases — same output shape, Urmi's RANSAC doesn't care which module produced the candidates.

---

## 4. Architecture decisions (locked in)

- **Frontend:** Next.js + Tailwind + Leaflet — **2D map only for MVP** (custom selenographic CRS via lat/lon bounding boxes). 3D sphere viewer is explicitly **backlogged**, not cancelled.
- **Backend:** NestJS as the **API gateway** (auth, orchestration, MongoDB) — not a peer to FastAPI, sits in front of it. Naming: services are named `gateway`, `vision-service` (Rashel/Sahid/Khushi/Urmi's CPU pipeline), `inference-service` (Harish's GPU-bound SuperGlue, if activated) — not generic names like "core" or "backend."
- **AI/ML:** FastAPI microservices for all registration pipeline compute
- **Database:** MongoDB — 5 collections (see §5)
- **Object storage:** MinIO (self-hostable, S3-compatible) for raw/registered images — not AWS S3, for ISRO data-sovereignty reasons
- **Large files:** MVP uses cropped/browse-quality real image tiles, not full-resolution multi-GB originals; presigned-upload-URL pattern is documented as a real future upgrade, not built yet
- **Auth:** password-based (bcrypt hash, `select: false` on the field) — **OAuth/institutional SSO was raised as a stronger fit for an ISRO-facing pitch, still an open decision, not yet settled**

---

## 5. MongoDB Schemas — current state (all fixes applied)

**5 collections:** `User`, `RawImage`, `PipelineRun`, `Observation`, `MoonMapPatch`

All five use `@Schema({ timestamps: true })` (auto createdAt/updatedAt — do not declare these fields manually).

**User** — `passwordHash` (bcrypt, `select: false`, never raw password), `deletedAt` (soft delete), roles: scientist/reviewer/admin

**RawImage** — `contentHash` has `unique: true` (DB-guaranteed dedup — same file uploaded twice is rejected/reused, not duplicated), `storageRef` points to MinIO object, PDS4 metadata embedded (projection, corner coordinates, resolution, acquisition time)

**PipelineRun** — lightweight orchestration state only. **`observationId` field removed** (was a circular FK — look up the observation via `Observation.runId` instead, never the reverse). `referenceImageId` is **optional** (supports single-image geolocation placement with no second image to match against).

**Observation** — the permanent scientific record. Includes:
- `matchedPoints[]` — the final RANSAC-validated correspondence points (required PS deliverable, not optional)
- `confidence.rmseX` / `rmseY` — split, matches both the real ISRO/SAC benchmark paper's convention and the PS's named evaluation metric
- `confidence.spatialDistributionScore` — required since PS explicitly asks for uniform distribution, not just match count
- `singleImagePlacement: boolean` — distinguishes "placed via metadata alone" from "placed via verified cross-image match"
- `duplicateOf` — self-referencing FK for when the same pair gets registered more than once
- `deletedAt` — soft delete (never actually lose a scientific record, even a wrong one)
- `runId` is optional (single-image placements have no pipeline run)

**MoonMapPatch** — one per matched Observation (`observationId` has `unique: true`). Uses a plain `regionBounds { minLat, maxLat, minLon, maxLon }` (not GeoJSON — deliberately simplified to match Leaflet's `L.imageOverlay()` API directly for 2D-first MVP scope). **Open question, unresolved:** `Bbox2D` field's purpose is unclear/possibly redundant with `regionBounds` — needs a decision (keep with clearer naming if there's a real pixel-space use case, or drop it).

**Explicitly backlogged, not missing by accident:**
- `PipelineStageEvent` (separate append-only stage log) — nested stages on `PipelineRun` instead, fine at hackathon scale
- `MapTileIndex` (precomputed best-observation-per-grid-cell) — add only if map rendering performance becomes a real problem

---

## 6. Verified external research (fact-checked, not assumed)

Real paper: Makharia, Singla, Amitabh, Dube, Sharma (2025), "Comparative Evaluation of Traditional and Deep Learning Feature Matching Algorithms using Chandrayaan-2 Lunar Data," SAC/ISRO Ahmedabad — arXiv:2509.04775. Confirmed real, numbers verified against the actual paper.

**Key takeaways used in our design:**
- Their pipeline used metadata/projection-based georeferencing successfully — validates our lighter, metadata-first approach for Rashel's stage over full SPICE ray-tracing
- SuperGlue (pretrained) scored best on their OHRC↔NAC benchmark (0.62px RMSE) — but classical methods (AKAZE) were competitive or better on some IIRS↔WAC polar cases — **not a blanket "SuperGlue wins everything," stay nuanced about this in the pitch**
- Their preprocessing (CLAHE, shadow normalization, histogram matching, PCA) is documented and reused in Sahid/Khushi's stages
- **Important caveat:** their hardest benchmarks are OHRC↔NAC and IIRS↔WAC — i.e. Chandrayaan-2 vs. NASA LRO cross-*mission* registration, not quite our OHRC↔TMC↔IIRS cross-*instrument*-same-mission scope. Related, not identical.
- Mutual information (Khushi's approach) was never tested in this paper at all — no published evidence it's worse, just untested by this source

---

## 7. Deadlines

- **Sept 15** — Internal MVP demo (PPT + live QR-linked prototype)
- **~Sept 30** — National portal submission deadline
- **Nov 20** — Self-imposed feature freeze before finale prep
- **December** — Grand Finale (36-hour build)

---

## 8. MVP scope (Sept 15) — what must work, nothing more

- ONE real OHRC↔TMC pair, correctly matched, correctly placed on the 2D Leaflet Moon map
- ONE real pair correctly rejected as "no match" (the negative-control proof)
- Full pipeline: upload → Rashel → Sahid (or Khushi) → Urmi → Moumita, working end to end
- No IIRS cross-modal matching required yet, no Harish/SuperGlue, no bundle adjustment, no Fourier-Mellin — all explicitly deferred

---

## 9. Build checklist — update this section as you go

### Schemas & Backend Foundation
- [x] All 5 Mongoose schemas drafted and corrected (timestamps, soft delete, password hashing, circular FK removed, PS-required fields added)
- [ ] `Bbox2D` question resolved (keep with clear naming, or drop)
- [ ] Auth strategy finalized (password vs. OAuth)
- [ ] NestJS modules scaffolded (`UsersModule`, `ImagesModule`, `PipelineModule`, `ObservationsModule`)
- [ ] MongoDB connection + indexes actually deployed

### Data Access
- [ ] ISSDC/PRADAN account registered
- [ ] At least 1 real OHRC+TMC pair (same region) downloaded
- [ ] At least 1 real pair of *different* regions downloaded (for the no-match demo)

### Rashel — Camera Geometry
- [ ] PDS4 metadata parsing working on real downloaded images
- [ ] Coarse coordinate-frame alignment producing lat/lon bounds

### Sahid — Signal Processing
- [ ] Phase correlation implemented and tested on toy data
- [ ] Working on real OHRC↔TMC pair from Rashel's output

### Khushi — Information Theory
- [ ] Hand-computed toy MI example completed
- [ ] MI implementation validated on Sahid's easy pair first (not real IIRS yet)

### Urmi — Validation
- [ ] RANSAC wrapper working against dummy candidate matches
- [ ] Spatial distribution / grid-coverage logic implemented
- [ ] RMSE calculation against control points implemented
- [ ] Wired to real candidate output from Sahid/Khushi

### Moumita — Integration & Frontend
- [ ] FastAPI ↔ NestJS API contracts defined
- [ ] Upload endpoint + MongoDB write working
- [ ] Leaflet 2D map rendering with custom CRS
- [ ] Before/after alignment toggle
- [ ] Negative-control ("no match") UI state
- [ ] "Uncertain — needs review" UI state

### Harish — Deep Learning (October checkpoint, not MVP)
- [ ] Not started — correctly deferred

### PPT / Submission
- [x] Official 6-slide template filled in with real content
- [x] Slide 2 redesigned: two-column (solution points + visual roadmap)
- [ ] Slide 3 redesigned: architecture diagram instead of text bullets
- [ ] Team ID / Team Name filled in (still placeholders)
- [ ] Theme field double-checked against official portal listing
- [ ] Exported to PDF (portal doesn't accept PPTX)

---

## 10. Open questions / decisions not yet made

1. Password auth vs. OAuth/SSO for scientist login?
2. `Bbox2D` on MoonMapPatch — keep, rename, or remove?
3. Reference image source: always user-uploaded pairs, or a pre-loaded browsable catalog? (affects whether a 6th `ReferenceCatalog` schema is needed)
4. Innovation slide direction: leading with change-detection framing (recommended) vs. GenAI query layer vs. cross-mission fusion vs. predictive mission planning — pick one for the pitch, don't dilute across all four