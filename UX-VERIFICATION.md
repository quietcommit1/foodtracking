# UX verification — 11 October 2026

Inspected Today, Foods, Recipes, History, Settings, authentication, scanner, product review and diary-entry dialogs in Chromium. Exercised rendered pages rather than inferring behavior from source alone. Reviewed mobile dashboard, portion-entry, meal and history screenshots.

## Problems fixed

| Priority | Reproduction / affected component                                                                                                           | Fix                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | First-time user selects Today → Add Food → signs in; requested logging task disappears. `App`, `Auth`.                                      | Resume the requested task after the account cache is ready; retain account checks.                                                                                                                                    |
| 2        | Guest searches Foods → selects soya chunks → signs in; selected food disappears. `App`, `StarterLibrary`, `Auth`.                           | Retain the reference selection and construct its private draft after authentication.                                                                                                                                  |
| 3        | Barcode request is slow; no cancel action, repeat scan remains enabled, late response can replace a newer task. `App`, `Dashboard`.         | Cancel lookup action, disabled scan while pending, request/account guards; opening another task or navigating cancels the pending UI result. Cancellation ignores the response; it does not abort the server request. |
| 4        | Tap unused padding inside a modal; the task closes as though the backdrop was tapped. `Modal`.                                              | Check actual dialog bounds before treating a click as a backdrop dismissal.                                                                                                                                           |
| 5        | Enter in ingredient quantity submits the recipe instead of adding an ingredient. `RecipeForm`.                                              | Enter adds the selected ingredient; recipe saving remains a separate action.                                                                                                                                          |
| 6        | Keyboard users must traverse repeated navigation before the page content. `App`, CSS.                                                       | Visible-on-focus skip link and focusable main landmark.                                                                                                                                                               |
| 7        | A food-category filter with no matching saved foods gives no explanation or recovery. `App`.                                                | Empty-filter message and a Clear food filters action; distinguish private-library searches from reference results.                                                                                                    |
| 8        | Searching “lentils raw” while the reference download is delayed announces “No reference matches” before loading finishes. `StarterLibrary`. | Suppress premature empty results; expose loading through `aria-busy`.                                                                                                                                                 |
| 9        | A long portion dialog briefly keeps its old height when the mobile viewport shrinks. CSS, mobile browser regression test.                   | Limit height using the smaller of dynamic viewport height and measured visual viewport height. Check settled bounds and submit-button reachability.                                                                   |

## Actual checks

- `npm test`: 41 passing tests in 9 files, including nutrition, unknown values, recipes, snapshots, dated targets, account-scoped queue behavior, backups and SQL/RLS isolation using PGlite.
- `npm run test:e2e`: 32 passing Chromium browser tests. Includes first-time authentication continuation, a complete quick-entry flow using Tab/Enter and typing, ingredient Enter behavior, barcode image decoding and manual rescan, stale/cancelled lookup recovery, library loading, failed storage/sync recovery, saved meals and production PWA offline reload.
- Mobile browser viewports: 320 and 390 pixels wide, including a shortened viewport. Inspected overflow, input sizes, reachable actions and modal focus restoration.
- Automated axe WCAG A/AA checks pass on Today in light/dark themes and mobile History. These checks do not establish complete accessibility compliance.
- Browser workflows capture uncaught JavaScript runtime errors. Expected HTTP errors are deliberately injected in outage/lookup tests.
- Production TypeScript/Vite/PWA build passes. Vite still reports bundles larger than 500 kB (including the separate reference-data chunk); this is a remaining performance consideration, not a demonstrated speed improvement.

## Limits and phone checks

Authenticated browser tests use an explicitly synthetic Supabase HTTP backend. SQL/RLS tests use local PGlite. No real hosted-account writes or real cross-device sync were performed in this audit. Barcode fixtures are decoded by the actual scanner library, but a physical camera was unavailable.

No physical iPhone, Safari/WebKit, VoiceOver or installed iOS home-screen application was tested. A reduced Chromium viewport is not an actual iOS keyboard test. On iPhone, check:

1. Open both Safari and the home-screen app; sign in and search soya chunks. Select it, enter a fractional weight, and verify protein/calorie totals.
2. With the keyboard open, reach the submit action without zooming or clipping. Rotate the phone and reopen the dialog.
3. Allow the rear camera and scan a well-lit barcode; cancel and verify the camera stops. Test barcode-photo and manual-entry fallbacks.
4. Check VoiceOver labels, modal focus, draft protection and return to the initiating action.
5. Reload once online, log a cached food offline, reconnect, and confirm one entry appears on a second device.
