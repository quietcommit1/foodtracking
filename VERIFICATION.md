# Verification evidence

Validated in the onboarding cloud machine on 11 October 2026 with Node 24.19.0, npm 11.9.0 and installed Chromium. The repository began empty with an unborn Git branch; the initial application was built locally. Source was subsequently committed and pushed to `quietcommit1/foodtracking` on `main`. Deployment status is documented in `DEPLOYMENT.md`.

## Initial onboarding checks

| Check                                        | Result                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm ci --cache /workspace/.npm-cache`       | Passed; frozen install tested, including repeat installation                                                          |
| `npm test`                                   | **30 passed**, 7 test files; no skipped tests                                                                         |
| `npm run build`                              | Passed: TypeScript + production PWA/assets/service worker                                                             |
| `npm run check:edge`                         | Passed: real Deno check of authenticated `food-lookup`                                                                |
| `npm run test:e2e`                           | **6 passed** in Chromium; desktop/mobile UI, logging lifecycle, retries, production PWA offline reload                |
| Automated WCAG 2 A/AA dashboard checks       | Passed in light and dark modes using axe; this is an automated check, not an accessibility certification              |
| `npm audit --omit=dev --audit-level=high`    | No production vulnerabilities reported                                                                                |
| Hosted Supabase connection / real Auth users | **Not run:** no project URL/public key/test accounts supplied                                                         |
| Hosted Edge lookup / live OFF response       | **Not run:** no deployed function/project credentials; official current documentation inspected, handler type checked |
| Real phone camera                            | **Not available:** actual WASM image decoder fixtures and mocked lifecycle tested; README phone checklist provided    |

## Exercised behaviour

- Fractional gram/serving scaling, explicit per-serving volume conversions, rejection of unspecified g/ml conversions, final cooked recipe weight, unknown nutrient propagation.
- Local calendar dates at midnight and month/leap-year boundaries; effective-dated target lookup; explicit zero vs unlogged days and history averaging.
- Immediate dashboard calorie/macronutrient updates, independently calculated remaining amounts/overages, capped progress, incomplete totals, unset targets.
- Real migration/RLS executed in embedded **PostgreSQL (PGlite)** with two distinct simulated Auth users and an `authenticated` role. Ownership isolation, foreign-key ownership for ingredient/portion children, duplicate barcodes, account-mismatched operations, replayed operation IDs and invalid nutrition constraints verified. Hosted Auth itself is not simulated as verified.
- Diary snapshots survive library corrections/deletion; quantity editing uses historical snapshots.
- Versioned backup parsing, duplicate/invalid IDs, impossible dates, missing/negative nutrition and reference validation; actual SQL restore is transactional, reassigns rows to the caller and rolls back duplicates.
- Actual camera decoder engine reads generated EAN-13, EAN-8, UPC-A and UPC-E PNG fixtures. Permission denial/unsupported context/late-permission track cleanup tested separately with mocked media devices. No physical camera claim.
- Account-scoped offline queues retain data over account changes; failed writes preserve operation IDs; retries do not duplicate diary entries. Synced manually created barcode lookup bypasses the external function.
- Browser tests use an **explicit synthetic HTTP Supabase backend**, not a real hosted database: miss → barcode-prefilled manual form → save → rescan without external call → log → library correction → historical quantity edit. Failed sync/retry also exercised.
- Production service-worker test signs in using that synthetic backend, saves a custom food offline, reloads the application offline, sees the retained IndexedDB food/queue, and reconnects to create exactly one server row.

## Delivery and remaining actions

The cloud configuration draft saved `install_script`, `start_skill`, the actual `/workspace/foodtracking` repository mount (verified unborn HEAD), and requirements for the two **public** frontend variables. Saving did not apply values, deploy the app, or publish the environment. Review/save those settings and publish through the environment UI when ready.

Follow README.md to create/connect a Supabase Free project, apply the SQL migration, create an individually confirmed initial account, deploy `food-lookup`, supply its contact/staging settings and configure HTTPS static deployment. Use `npm run test:hosted` with two disposable confirmed test accounts to verify the real hosted Auth/RLS/Edge boundary. Complete the phone checklist before relying on camera scanning.

The full-account cache uses 500-row paginated reads and is appropriate for the initial personal scope. Multi-device conflicts use last server-received write wins. Restore requires syncing/closing other devices and refreshing them afterwards; offline queues on those devices are not invalidated automatically. Both policies, provider limits, privacy and data licensing are documented in README.md.

## Subsequent mobile usability checks — 11 October 2026

- `npm test`: 38 tests passed across 9 files, including meal protein totals, unknown protein and independently updated dashboard values.
- `npm run build`: TypeScript and production PWA build passed.
- `npm run test:e2e`: 13 Chromium tests passed, including the new mobile choose-food → immediate quantity → live protein preview → log flow, input font size >=16 px, Change food navigation, no horizontal overflow, dashboard accessibility, barcode photo decoding, retries and production offline reload.
- Real iPhone Safari auto-zoom/keyboard/camera testing remains unavailable in the cloud; mobile Chromium checks and the CSS fix do not constitute a real-device Safari result.
- Home-screen PWA checks cover the production standalone manifest, viewport-fit metadata, service-worker/offline reload and a reduced-height mobile dialog with the Add food action reachable. iPhone notch/home-indicator CSS and Apple installation metadata are included; actual iOS safe-area/keyboard behavior still requires the README phone checklist.
- The public site was deployed through GitHub Actions on earlier changes. OFF's record for Nakpro barcode 8906133020187 was checked live: it exists without structured nutrition. The deployed site's Supabase `food-lookup` endpoint returned HTTP 404; see BARCODE_SETUP.md. Hosted authenticated diary/Edge tests still require real disposable accounts and a deployed function.

## UX audit implementation — 11 October 2026

The implementation improves consistent search filters/pagination, save-to-log continuity with date/meal context, changed-draft dismissal guards and keyboard focus, durable local-save feedback, rejected-row correction, nutrition-basis review, searchable/editable recipe ingredients, saved-meal previews/scaling/management, local midnight handling, and responsive history controls. Nutrition snapshots, unknown values, account ownership, RLS and authenticated barcode integration are preserved. No migration or new dependency is required.

New meaningful checks cover IndexedDB quota failure/retry, an explicit correction replacing multiple rejected upserts, and edits made while an operation is in flight. Browser flows cover past-date lunch creation → protected draft → save → portion → log, device-storage failure retaining inputs, inline recipe quantity scaling with final cooked weight, basis-review gating, saved-meal scaling/rename/delete without changing diaries, midnight with historical-date preservation, consistent Recent/Favourites/Library behavior, readable 44 px history date controls, reduced visible viewport and keyboard-focus restoration. Today light/dark and History receive automated WCAG 2 A/AA checks; this is not a claim of full WCAG compliance.

Draft protection does not recover an unsubmitted form after browser shutdown/reload. Rejected batches remain transactional; product correction is supported, but arbitrary dependent-operation splitting is not introduced. Real hosted authenticated regression tests and actual iPhone Safari/camera/keyboard tests remain unavailable without the appropriate accounts/device.

Final checks: `npm test` **41 passed** across 9 files; `npm run test:e2e` **22 passed**; `npm run build` passed (existing large-chunk advisory remains). Rendered screens were inspected at widths 320, 390, 768 and 1440 px with no horizontal page overflow or runtime errors in that inspection. The 320 × 400 px dialog stayed within the visible viewport. Mobile portion/history screenshots were reviewed. Tests use a synthetic authenticated Supabase backend and PostgreSQL RLS fixtures; they do not establish hosted production account behavior or real iOS keyboard compliance.
