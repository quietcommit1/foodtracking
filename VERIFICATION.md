# Verification evidence

Validated in the onboarding cloud machine on 11 October 2026 with Node 24.19.0, npm 11.9.0 and installed Chromium. The repository began empty with an unborn Git branch; the initial application was built locally. Source was subsequently committed and pushed to `quietcommit1/foodtracking` on `main`. Deployment status is documented in `DEPLOYMENT.md`.

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
