# Metrics

Measured on 2026-11-11 against the real database and storage bucket. Everything here comes from the two scripts in `scripts/`, so the numbers can be rerun:

```bash
npx tsx --env-file=.env scripts/measure-metrics.ts --out raw-metrics.md
npx tsx scripts/measure-page-weight.ts http://localhost:3000/r/demo --runs 3
```

Both are read-only. They list and download files and run SELECT queries. Nothing is written to the database, and no Tripo tasks are created.

## Summary

| What | Result | Sample | How |
| --- | --- | --- | --- |
| Low-poly pass (15k face cap) | 41.2 MB to 2.0 MB per model (95% smaller), 1,487,960 to 7,552 triangles (99.5% fewer) | same dish, v1 vs v4 | stored GLBs, triangle count from glTF-Transform |
| Low-poly + compression | 41.2 MB to 1.9 MB (95.4% smaller) | same dish | v4 run through `compressGlbBuffer` |
| glTF compression alone (dedup, prune, quantize) | median 21.5% smaller, range 6% to 21.5% | N=7 stored uncompressed GLBs | re-run through `compressGlbBuffer` in memory |
| Compression is lossless for shape | triangles and vertices identical in 7/7, bounding box changed by at most 0.021% | N=7 | before/after comparison |
| Digital scale accuracy | 0% error against the entered size for web GLB and iPhone USDZ | 4 dishes, 8 checks | bounding box x scale factor vs admin measurement |
| Web vs iPhone model agreement | within 0.35% on every axis | 4 dishes | USDZ parsed with three.js `USDLoader` |
| Photos to AR-ready model | median 3.9 min, p90 5.5 min | N=9 jobs | `ProcessingJob` created to finished |
| Job success rate | 9/9 succeeded | N=9 | `ProcessingJob.status` |
| Paid Tripo tasks per failed job, worst case | 9 before (3 attempts x 3 tasks), 3 now | code at 8d75a15 vs main | task ids are saved and resumed on retry |
| Menu page weight on a phone | 3,396 KB to 260 KB (92% less); images 3,249 KB to 14 KB | 3 cold runs each, medians | Playwright, iPhone 13, slow 4G + 4x CPU |
| Menu page LCP, same throttling | 1,356 ms to 904 ms (33% faster) | 3 runs each, medians | PerformanceObserver |
| Output formats per dish | 3 (web GLB, iPhone USDZ, Android GLB with scale baked in) | | `model-generator.ts` |
| Codebase | 79 TypeScript files, 6,195 lines, 19 API routes, 33 tests | | `measure-metrics.ts` |

## Notes and limits

Compression. The pipeline only stores the compressed file, so originals exist only where compression was switched off when the model was made. Seven stored GLBs are like that, and those are the sample. The five high-poly models all land at 21.4% to 21.5%. The two low-poly ones only drop about 6%, because textures make up most of their size and quantization does not touch textures. The other 8 stored GLBs were already compressed and their originals are gone, so they are not counted.

Scale. The digital check confirms the files are scaled to the size the admin typed in. It cannot tell how close that is to the real plate on a real table. That needs a physical test:

1. Put a plate of known size on a table, measure it with a ruler, and enter that size in admin.
2. Place the dish in AR on an iPhone and an Android phone, lay the ruler next to it on screen, and read the width at the same spot as the real plate.
3. Error = (AR width - real width) / real width, over at least 5 dishes on both phones.

Live models. Three of the four dishes with models (Apple, Pizza, Pizza 1) were made before the low-poly step was added. They are still about 39 MB GLBs with 1.4M triangles and 50 MB USDZs. Apple is on the public menu. Regenerating them with the current pipeline would bring them down to about 2 MB. No Android scale-baked GLBs exist yet, because that format was added after the last generation.

Retries. The worst case of 9 paid tasks comes from the old code creating all three Tripo tasks again on each of its 3 attempts. The resume logic is covered by `tests/tripo-resume.test.ts` and `tests/process-job.test.ts`, but no production job has used it yet.

Page weight. The old menu loaded each dish's original photo straight from storage. The new one requests a small AVIF/WebP thumbnail through `next/image`. Both builds ran in production mode on this machine against the same database. The old dish page could not be compared, because it reads columns the latest migration removed.

Analytics. The 602 events in the database (109 menu views, 114 dish views, 172 3D/AR opens, 15 placements) are almost all from my own testing, not from real diners, so they are not usage numbers.

Cost. Tripo pricing is not in the code or config, so cost per dish is not computed here.

## Raw output of measure-metrics.ts

### 1. glTF compression (dedup, prune, quantize)

Stored GLBs: 15. Uncompressed (no KHR_mesh_quantization): 7, re-run through compressGlbBuffer here. Already compressed when stored: 8 (their originals are not kept, so they are not in this sample).

| file | before MB | after MB | reduction | triangles before/after | vertices before/after | bbox max diff |
| --- | --- | --- | --- | --- | --- | --- |
| 3a39c613-cb8c-4a45-90a7-bba7889de9c5/v2/model.glb | 40.46 | 31.77 | 21.5% | 1484780/1484780 | 759669/759669 | 0.004% |
| 3a39c613-cb8c-4a45-90a7-bba7889de9c5/v3/model.glb | 38.89 | 30.53 | 21.5% | 1423448/1423448 | 730441/730441 | 0.001% |
| 41adea0f-d56f-4fdd-9437-90feb9ed69ab/v1/model.glb | 39.13 | 30.73 | 21.5% | 1423368/1423368 | 733407/733407 | 0.003% |
| b9e52a5a-c3b1-4996-9d27-f0eebefaf94c/v1/model.glb | 41.17 | 32.31 | 21.5% | 1487960/1487960 | 774675/774675 | 0.008% |
| b9e52a5a-c3b1-4996-9d27-f0eebefaf94c/v3/model.glb | 2.01 | 1.89 | 6% | 7252/7252 | 10504/10504 | 0.019% |
| b9e52a5a-c3b1-4996-9d27-f0eebefaf94c/v4/model.glb | 2.01 | 1.89 | 6.2% | 7552/7552 | 10850/10850 | 0.021% |
| efa25dd3-2eec-4afd-bd91-3fc13a7a3f0e/v1/model.glb | 39.25 | 30.83 | 21.4% | 1427792/1427792 | 735399/735399 | 0.019% |

Whole-file reduction: mean 17.1%, median 21.5%, range 6% to 21.5% (N=7).
Non-texture bytes (geometry + JSON) reduction: mean 24.9%, median 21.7% (textures are copied as-is, so they dilute the whole-file number).
Triangle and vertex counts unchanged in 7/7; largest bounding-box change 0.021%.

### 2. Live models (one per dish with a ready 3D model)

| dish | v | measurement | GLB MB | USDZ MB | Android GLB MB | triangles (cap 15k) | max texture px | all <= 50 MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pizza | 1 | 20 cm PLATE_DIAMETER_CM | 39.13 | 49.74 | n/a | 1423368 | 2048 | yes |
| Pizza 1 | 1 | 20 cm PLATE_DIAMETER_CM | 39.25 | 49.96 | n/a | 1427792 | 2048 | yes |
| Pizza Display | 4 | 24 cm MAX_WIDTH_CM | 2.01 | 0.4 | n/a | 7552 | 2048 | yes |
| Apple | 3 | 18.5 cm PLATE_DIAMETER_CM | 38.89 | 49.41 | n/a | 1423448 | 2048 | yes |

Mean sizes: GLB 29.82 MB (N=4), USDZ 37.38 MB (N=4), Android GLB n/a MB (N=0). Triangles within the 15000 cap: 1/4.

### 3. Digital scale accuracy

| dish | entered | implied at generation (cm) | web GLB err | Android GLB err | USDZ err | max cross-format diff |
| --- | --- | --- | --- | --- | --- | --- |
| Pizza | 20 cm PLATE_DIAMETER_CM | 20 | 0% | n/a | 0% | 0% |
| Pizza 1 | 20 cm PLATE_DIAMETER_CM | 20 | 0% | n/a | 0% | 0% |
| Pizza Display | 24 cm MAX_WIDTH_CM | 24 | 0% | n/a | 0% | 0.349% |
| Apple | 18.5 cm PLATE_DIAMETER_CM | 18.5 | 0% | n/a | 0% | 0% |

Max |error| over all formats: 0% (N=8 format checks over 4 dishes). Max cross-format difference: 0.349%.

### 4. Generation jobs

Jobs: 9 (QUEUED 0, RUNNING 0, SUCCEEDED 9, FAILED 0).
Queued to ready (SUCCEEDED, N=9): median 3.9 min, p90 5.5 min, min 3.4, max 5.5.
Jobs with saved Tripo task ids (new resume code): 0.

### 6. Analytics events (all time)

602 events from 2026-03-09 to 2026-11-11: ar_open 172, ar_supported 160, item_view 114, menu_view 109, ar_fallback_used 27, ar_place_success 15, ar_permission_result 5.

### Codebase

src: 79 TypeScript files, 6195 non-blank lines. Tests: 33 cases in 7 files. API route handlers: 19.
