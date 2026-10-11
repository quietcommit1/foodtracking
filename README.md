# Everyday — a private food diary

A working React + TypeScript + Vite application for calorie and macronutrient tracking, with Supabase as the persistent source of truth. The original, mobile-first interface puts a calorie ring and all three macro cards together above the logging actions. Indian packaged products and your own homemade foods use the same private library; there are no assumed roti/bowl sizes, authoritative sample nutrition, exercise calories, weight tracking, subscriptions, or paid APIs.

## Run locally

Use Node 22.12+ (Node 24 is validated here) and npm. Dependencies are pinned with `package-lock.json`.

```bash
npm ci
cp .env.example .env.local
# Fill in your own project URL and public/publishable key.
npm run dev
```

Without those variables the interface loads with an explicit connection notice and an empty diary. Saving requires authentication; it does not pretend a local-only diary is Supabase-backed. No hosted database is connected in the delivered workspace. Never put a service-role/secret Supabase key into any `VITE_` variable. The public legacy anon key is also usable, protected by Auth and RLS.

The cloud onboarding environment is already isolated. Use this checkout at `/workspace/foodtracking`; do not create a worktree unless explicitly requested.

## Connect Supabase

1. Create a project on Supabase's Free plan. Copy Project URL and the public/publishable API key from the project settings into `.env.local` or your static host's build variables as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Run the entire file `supabase/migrations/202610110001_initial.sql` once in the Supabase SQL Editor. It creates the tables, constraints, RLS policies, indexes, transactional sync/backup RPCs and lookup throttle. For managed migrations you can instead use the Supabase CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

3. In Authentication settings keep email/password enabled and email confirmation enabled. Set an appropriate password minimum (the UI requires at least 8 characters), your deployed Site URL, and allowed redirect URLs. Do not disable RLS or confirmation to make setup pass.
4. To create your **initial personal account without a paid email service**, use Supabase Dashboard → Authentication → Users → Add user → Create new user. Set your own email and a strong password and explicitly confirm that initial user's email in the dashboard (the Create User flow offers Auto Confirm User). This is an intentional administrator action for your own account, not disabling confirmation globally. Sign in with that email/password in Everyday. Normal sign-up remains available with confirmation; Supabase's default email sender is restricted/rate limited and is unsuitable for a public service. No SMTP purchase is needed for the initial administrator-created account. If the Dashboard UI changes, use its individual-user confirmation control rather than relaxing project security.
5. Deploy the authenticated product lookup:

   ```bash
   npx supabase secrets set OFF_CONTACT_EMAIL=YOUR_REAL_CONTACT_EMAIL OFF_STAGING=true
   npx supabase functions deploy food-lookup
   ```

   The handler always verifies its bearer token with `Auth.getUser`, queries saved foods under the caller's RLS context and never uses a service-role key. `verify_jwt=false` in `supabase/config.toml` bypasses only the gateway's legacy JWT-key verification so newer publishable keys work; **the handler still rejects unauthenticated callers**. Supabase injects the function's project URL and anon key. `OFF_CONTACT_EMAIL` is an Edge Function setting, not a frontend setting. Use the OFF staging database for integration tests, then explicitly set `OFF_STAGING=false` for personal production use.

6. Follow the [Open Food Facts API usage registration](https://openfoodfacts.github.io/openfoodfacts-server/api/) instructions, including the usage form, before external lookup. The function identifies itself as `EverydayDiary/1.0 (your contact email)` and makes read-only requests. No OFF account credential, paid nutrition key, or upload is used.
7. Restart Vite after changing frontend variables. Sign in, set effective-dated targets in Settings, add a food and log it. Confirm the status says **Synced** and reload on a second device using the same Supabase account.

Frontend requests need your `PROJECT_REF.supabase.co` destination reachable. The Edge Function needs outbound HTTPS to `world.openfoodfacts.org` (or `world.openfoodfacts.net` for staging). Cloud development network policies may need the specific project hostname added; changing a browser build variable does not configure network access. No secret values belong in this repository or chat.

## How the diary works

- Today defaults to the **device's local calendar date**, using date-only database fields. Previous/next, calendar input and Return to today allow past logging. Targets have an effective date and never overwrite older target periods. Blank targets are unset; each nutrient's remaining amount is calculated independently. Progress visuals cap at 100%; actual values and overages remain visible. Unknown nutrient entries mark affected totals **incomplete** and show the known subtotal.
- Add Food provides live **local** library search, recent items, favourites, saved meals and quick calorie-only entries. Quick entries deliberately leave macros unknown. Food-specific saved servings/household measures support fractional amounts. Grams and millilitres are never converted into each other without a supplied basis; this app does not implement density conversions. Per-serving foods can have a specifically defined gram or millilitre serving size.
- Entries can be edited, moved to another meal/date and deleted. Editing quantity scales the **original logged nutrition snapshot**, not the current food. Copy meal and Save meal preserve snapshots. Removing a food doesn't erase diary history; foods still referenced by recipe ingredients are protected from deletion by the database.
- Food forms support regional Unicode names, brand, barcode, per-100 g/ml or per-serving nutrition, optional fibre, preparation state and notes. Empty nutrient fields stay `null`. Raw/cooked/packaged foods stay distinct. Imported source IDs/URLs/raw source data are stored separately from your editable nutrition. Corrections remain private and user-entered values are estimates, not independently verified.
- Recipe ingredients carry their selected food/quantity snapshots, include oil/ghee like any other ingredient, and propagate unknown nutrients. Batch nutrition is divided by servings; with a final cooked batch weight, per-100 g nutrition is `batch / weight × 100`. Saving creates a logging food. Editing a recipe updates future logging nutrition; historical entries and saved-meal snapshots stay unchanged. If an ingredient's library nutrition changes, explicitly replace that ingredient in the editor to incorporate the correction into the recipe.
- History includes 7/30-day averages and browsable daily diaries. Unlogged days are excluded; explicitly recorded zero days are included. Unknown included nutrients yield an unknown average. The chart provides date/calorie text equivalents. No weight or exercise charts exist.

## Barcode scanning & external lookup

The actual camera scanner uses the MIT-licensed `zxing-wasm` wrapper and the Apache-2.0 ZXing-C++ engine. The WASM file is served from your own frontend build and precached by the PWA. It recognises EAN-13, EAN-8, UPC-A and UPC-E. Camera acquisition requests the rear-facing camera, offers camera selection after permission, has stop/cancel controls and stops tracks even if permission completes after leaving. Detections are locked to one result until leaving/reopening. Permission/decoder errors offer manual entry. Camera frames never leave the device.

Camera APIs require **HTTPS** or **localhost** and a supported browser. A plain LAN URL such as `http://192.168…` is not a secure context. For phone tests use an HTTPS static deployment or a trusted local HTTPS development setup. Browser/OS camera permission is still required. iOS Safari requires a user gesture (opening Scan Barcode supplies it), and PWA camera behaviour should be tested on the intended phone.

Barcodes are strings throughout. Surrounding whitespace is trimmed; digits are never converted to numbers. A 12-digit UPC-A is stored as its equivalent EAN-13 with one leading zero. GTIN-14 with packaging indicator zero is stored as its equivalent 13-digit code; non-zero packaging indicators are preserved. UPC-E is expanded only when the decoder identifies UPC-E or the user explicitly chooses UPC-E in manual scanning. Eight-digit manual values otherwise mean EAN-8. Do not infer product origin or nutrition from a prefix. Use Scan → manual entry for compressed UPC-E; the food editor's optional barcode input accepts canonical EAN/UPC-A/GTIN.

Lookup order is cached/saved personal library → a direct indexed Supabase lookup → authenticated Edge Function (which rechecks saved foods) → OFF. A later scan of a manually saved barcode doesn't call OFF. External results always open a review form; only your confirmation saves them. Misses and unavailable/rate-limited/timeout responses show different messages, with barcode-prefilled manual creation in both cases. Duplicate `(user_id, barcode)` values are prevented by a database constraint; local duplicates offer editing the existing product. Concurrent conflicts retain pending edits and show the server constraint error. Export pending edits, discard the conflicting local queue/reload, then edit the existing server product. Nothing is silently merged or publicly published.

As checked against the current [official API introduction](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/index.md), [v3.6 changes](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/ref-api-and-product-schema-change-log.md), and [nutrition schema](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/ref/schemas/product_nutrition_v3.yaml), the read API uses `nutrition.aggregated_set` with a normalized 100 g or 100 ml basis. The adapter preserves missing/qualified values as unknown, and retains the full requested source subset. It does not guess missing energy or macro values. Current product reads are **15 requests/minute/IP** and search is **10/minute/IP**. This function throttles to 12/minute across your project, requests a small field set, has an 8-second timeout and handles 404, 429 and 5xx separately. Hosting IPs can be shared across projects, so OFF may still throttle. There is no external text search or bulk database download.

## Offline use, syncing & conflicts

The production PWA precaches application assets, local fonts and the scanner WASM; visit it online once before relying on it offline. IndexedDB stores account-scoped data and pending operations. Retained files and caches survive process restarts; live development servers do not. Supabase remains the authoritative persistent database.

You can view cached diaries, add cached foods, quick entries, create manual foods/recipes and edit targets offline after signing in and loading your account at least once. Do not sign out before an offline session. An expired session needs an online reauthentication before uploading. External product lookup is unavailable offline; manual creation still queues locally.

Every queued operation and row has a stable UUID. The sync RPC atomically applies a batch and records operation IDs, so a lost response/retry cannot create duplicate entries. Every operation must match `auth.uid()`, preventing an old queue from being applied to a new account. Data refreshes after sign-in, completed writes, focus/visibility and reconnect. Reads use 500-row pages ordered by ID; indexed user/date and user/barcode queries support server access. For the initial single-user scope the account library/diary is cached in full using paginated queries; very large multi-year accounts should move to selected-date/range hydration before expanding this into a multi-user service.

Status is **Pending**, **Syncing**, **Synced**, **Failed**, or **Offline**. Optimistic dashboard totals update immediately, while unsynced rows remain labelled. Failed writes retain queued edits and offer retry. If Supabase is paused, resume it in the Supabase Dashboard and retry. IndexedDB storage failures warn you to keep the page open; don't clear site data with pending changes. No storage API can protect data from browser eviction or a user clearing storage.

Conflicts use **last successfully received server write wins for each row**. A stale device can therefore overwrite another device's edit when it reconnects; the server timestamp records receipt time, not client time. Deletes are idempotent and later explicit upserts may recreate a row. Unique constraints and ownership never yield to conflict resolution. Restore is a whole-account replacement: first sync/close other devices, export a backup, restore, then refresh every device before editing again. Pending queues on other devices are not automatically invalidated by restore; uploading them afterward may overwrite restored rows. This explicit conflict policy is suitable for one initial user, not concurrent collaborative editing.

## Backups

Settings → Export JSON creates a **version 1** complete backup from a single SQL-statement database snapshot, including foods/source data, portions, recipes/ingredients, diary snapshots, explicit-zero days, targets, favourites, saved meals/items and preferences. Exports require online access and a fully synced queue. Diary CSV quotes fields and leaves unknown nutrients blank.

Restore accepts a maximum 20 MB versioned JSON file, validates IDs, duplicates, references and nutrition before showing counts, then requires typing `REPLACE`. The authenticated database function replaces your account's rows in **one transaction**, reassigns ownership to the caller, and applies all database constraints. Failure rolls back the whole replacement; it cannot partially erase your diary. There is no ambiguous duplicate merge mode: restore explicitly replaces, and rejects duplicate IDs/barcodes. Existing IDs belonging to other users cannot be imported. Operation receipts stay separate from portable personal data. Pending-edit exports on a failed-sync banner are recovery/debug files, not complete restore backups; copy those preserved values through the normal editor after resolving conflicts.

## Static deployment

```bash
npm run build
# Deploy dist/ to a free static hosting tier with HTTPS.
npm run preview
```

Set the two public `VITE_` variables at build time (they are embedded in the frontend). Changing them requires rebuilding. Serve `.wasm` with `application/wasm`, retain SPA fallback to `index.html`, and avoid long caching for HTML/service-worker files. Asset filenames are hashed. Deploy the Supabase SQL and Edge Function separately. Add the deployment URL to Supabase Auth settings. All navigation stays in the SPA; no custom frontend server is needed.

No credit card, paid API, AI service or trial is required by the application. Provider terms and quotas can change; verify current [Supabase pricing](https://supabase.com/pricing) and your static host before deployment. At the time of implementation typical Supabase Free quotas include a 500 MB database, limited egress/storage/Edge invocations and inactivity pausing; the pricing page/dashboard is authoritative. Full-account cache refreshes, JSON source payloads and operation receipts consume those quotas. Keep backups, avoid excessive libraries, and periodically review database size. Applied-operation receipts are intentionally retained for idempotency: deleting them requires ensuring no old device queue can replay them. The app sends no diary or homemade recipe to OFF and never writes to OFF.

## Verification

```bash
npm test                 # calculations, dashboard, fixtures, offline state and real PostgreSQL RLS
npm run test:security    # same migration in PGlite PostgreSQL with two simulated Auth users
npm run build            # TypeScript and production PWA build
npx playwright install chromium  # only if a Chromium browser isn't already present
npm run test:e2e         # desktop/mobile and explicit fake-Supabase HTTP integration
```

Playwright uses installed `/usr/bin/chromium` when present, otherwise its downloaded browser. `PLAYWRIGHT_CHROMIUM_PATH` overrides that path. Test credentials are synthetic fixtures and never connect to a real hosted database. PostgreSQL tests execute actual migration/RLS/constraints/restore RPCs in PGlite while stubbing only `auth.uid()`/Auth users. These are not a substitute for a hosted Auth/Edge deployment check.

**No real phone camera is available in this workspace.** Image fixtures exercise the actual WASM decoder for EAN-13, EAN-8, UPC-A and UPC-E; mocked scanner lifecycle tests verify late-permission cleanup/unsupported/denial flows. Phone checklist:

- Open the HTTPS app, sign in, allow camera permission; verify rear-camera preference, camera switching and stop/cancel.
- Scan an Indian EAN-13 package and a UPC/EAN-8 fixture; hold it in view and confirm only one review form opens.
- Test a missing product, manual entry, confirmation/save, and rescan on both phone and laptop. Turn off external connectivity: saved products should still log.
- Deny permission, retry after enabling permission, and check the manual fallback. Close the scanner and verify the camera indicator turns off, including after delayed permission.
- Install the PWA, visit a diary online, turn on airplane mode, add a cached food/custom product, reopen, reconnect, and confirm exactly one entry appears on the second device.
- With two real test accounts, check that diary, foods, recipes/children, targets and backups are isolated. Test a direct cross-owner recipe reference and ensure it is rejected.
- Deploy `food-lookup` with OFF staging first; verify invalid/missing bearer tokens return 401, saved barcode skips OFF, 404 means not found, and 429/unavailability allows manual creation.

Current-instance automated results and remaining hosted checks are recorded in `VERIFICATION.md`.

## Licences

Application source is MIT licensed; see `LICENSE`. Dependency and data-source licence notices are in `THIRD_PARTY_NOTICES.md`. Imported Open Food Facts data is ODbL/DbCL and requires attribution; its product source link is retained and shown. The app doesn't fetch product images. If you redistribute an imported database or exports publicly, review ODbL share-alike requirements. Private user-entered foods/recipes are not contributed to OFF.

### Optional hosted integration command (after connection)

Create **two separate disposable confirmed test accounts**, then set `SUPABASE_TEST_EMAIL_A`, `SUPABASE_TEST_PASSWORD_A`, `SUPABASE_TEST_EMAIL_B`, and `SUPABASE_TEST_PASSWORD_B` in ignored `.env.local` alongside the public project settings. Run `npm run test:hosted`. The script uses their normal authenticated public clients, verifies isolation/child ownership/duplicates/idempotency/history and Edge caller authentication, and cleans up only its own fixture IDs. It never requires a service-role key and doesn't call OFF (the barcode is pre-saved). Run against a test project; the fixed all-zero test barcode must be unused. Credential values are never printed. This command is **not run** without those credentials.

## Searchable food library

Foods and Add Food include a bundled, offline-searchable starter catalog of 68 common ingredients and everyday foods, including dry soya chunks, dal ingredients, rice, atta, paneer, vegetables, fruit, oils and nuts. English, common Indian names and selected Hindi aliases are searchable. It is a limited catalog, not an internet-wide nutrition database.

All catalog nutrition is **rounded sample estimates**, not verified brand labels or authoritative food composition data. Calories, protein, carbohydrates and fat are supplied per **100 g of the named food state**. Fibre remains unknown. The generic dry soya-chunk estimate is 345 kcal, 52 g protein, 33 g carbs and 0.5 g fat per 100 g; confirm your own package, and never apply dry values to hydrated weight. Foods with preparation/brand differences should be corrected before saving. Household measures, weight/volume conversions and hydrated-soya yield are not invented. Use recipes for dishes such as dal or sabzi, with all ingredients including oil and final cooked weight.

Review a starter item in Foods and save it, or select it in Add Food and review the estimate notice and macros before logging. Logging saves the private library copy and diary snapshot together through the existing account-scoped offline queue and transactional Supabase RPC. The reference estimate remains in `source_data` when you make private corrections. Starter items are not inserted into your diary automatically. No new database migration is needed. Scanning and Open Food Facts lookup remain available for brand-specific packaged products.

### USDA reference library

The library now also includes **8,789 USDA SR28 food records**, for **8,857 total reference/starter entries**. It is not every food on the internet: SR28 is a historical US reference dataset (2015/2016), and packaged brands, regional dishes and newer formulations may differ. USDA values are separate from the labelled Indian starter estimates. Missing nutrients remain `null`. The source's exact food description and NDB identifier are retained, along with the original macro values in `source_data` after private corrections.

The 812 KB compact reference data loads in a separate frontend chunk and is precached by the PWA. Search is local with multiword matching and 12-result pagination. Only selected foods are saved to the user's Supabase account; the full reference database is **not** uploaded to Supabase. Homemade dishes require the user's recipe and actual ingredients/finished weight rather than assuming a universal serving. USDA legacy brand references are not current product-label verification and have no inferred barcodes.

`src/data/usda-sr28.meta.json` records the pinned public mirror, source hashes, nutrient IDs and format. To regenerate, obtain `FOOD_DES.txt` and `NUT_DATA.txt` from USDA SR28 ASCII data or the recorded mirror commit, then run `python3 scripts/build-usda-catalog.py /path/to/files`. The downloaded source files are not included in the app.

### Barcode lookup troubleshooting

The camera reads a barcode; the nutrition lookup is a separate authenticated Supabase Edge Function. **Deploying the GitHub Pages website does not deploy that function.** If a scan asks for manual nutrition, read the notice above the form: a genuine OFF miss, undeployed function, rejected session, unconfigured contact, and unavailable network are distinct cases. Saved products never need OFF again.

The corrected function uses OFF's documented product v2 endpoint and requests `nutriments` as well as newer `nutrition`, preserving energy/protein/carbohydrate/fat/fibre values instead of requesting only the new schema. The adapter accepts finite numeric strings, retains genuine zero and unknown values, and reads explicit serving/liquid bases. It never derives nutrition from a barcode. External values must still be reviewed.

Follow [BARCODE_SETUP.md](BARCODE_SETUP.md) to deploy the function to the **same project configured in GitHub Actions variables**. For the live site this was `umwcdvonjlyqohgrvqnv` at the last check; the cloud's older environment variables referenced a different project. Check your own GitHub setting before deploying. `OFF_STAGING` must be **false for actual packaged products**; staging uses a test database. Real phone camera testing was unavailable; use the checklist above. Browser tests verify decoded fixture formats and the populated lookup/re-scan flow against an explicit synthetic backend, not a real OFF match.

## Logging on a phone

In Add Food, choosing a saved or reference food opens the portion step immediately. Enter its quantity and unit, review the live calorie/protein/carbohydrate/fat preview, then add it. Use **Change food** to return to your search. The source/portion detail remains available, and estimates are labelled before logging. Meal headers and diary rows show protein beside calories; incomplete totals and unknown values are explicit.

Mobile inputs use at least 16 px text to prevent Safari's input-focus auto-zoom without disabling accessible pinch zoom. Dialog headers and the logging action stay available while scrolling, and the background page stays in place. Reference search caches normalized text, defers expensive result updates, and uses a set for saved-food membership. Account refresh uses at most three table queries concurrently with the existing 500-row pagination/ownership filters. Repeated form submissions are guarded during saving; pending offline data and historical snapshots are unchanged. Real iPhone Safari keyboard/zoom testing still needs the user's device.

### iPhone home-screen app

Open the HTTPS site in Safari, then **Share → Add to Home Screen** (enable **Open as Web App** if offered). The manifest uses standalone display, and Apple home-screen metadata/icons are included. Full-screen layouts reserve the notch/status-bar and home-indicator safe areas, including bottom navigation and dialogs. Inputs retain accessible pinch zoom; dialogs scroll within the available viewport.

The PWA caches the application and reference library after initial online use. The service worker checks for new versions and installs updates automatically; after a deployment, open the app online, then close and reopen it if the old layout remains. Never clear website data to force an update while changes are pending: wait for **Synced** first. Resuming the app refreshes account data. On your iPhone, check portrait/landscape, opening and dismissing the quantity keyboard, reaching Add food with the keyboard open, and keeping navigation clear of the home indicator. Automated Chromium viewport/offline tests cannot verify the real iOS standalone shell or keyboard.

## Logging and UX recovery

- **Recent** contains foods actually logged, **Favourites** stays filtered while searching, and **Library** shows reference items. Starting a search from Recent switches to **All** so first-time searches can find the reference catalog. Saved results have Show more pagination.
- Creating a food from the diary and scanning a new product now use **Save & log food**: review/save the product, then enter its portion with the original date and meal retained. Library-only saves remain available from Foods. Saving a product never logs an assumed portion automatically.
- Food, recipe, and portion forms ask before discarding changed inputs on Close, Escape, or backdrop tap. Keep editing returns keyboard focus to the previous control. This is an in-session draft guard, not draft autosave: a browser/device shutdown or reload can still lose an unsubmitted draft.
- A save must reach account-scoped IndexedDB before a form reports success or closes. Device-storage failure retains the form for retry and does not queue or submit that failed change. Supabase outages still retain successfully cached pending operations. Short serialized state commits protect writes made while a background sync is running.
- When a server rejects a queued product, open **Pending changes → Correct product**, correct its data (including a conflicting barcode), and save. This replaces that row's rejected queued upserts at their original position with a fresh operation ID. An in-flight request is never rewritten. Retries themselves retain stable IDs. Transactions and ownership checks remain unchanged; this does not bypass constraints or automatically skip dependent changes. Other unresolved rejected operations may still block their batch. Export pending edits before choosing Discard pending & reload.
- Changing nutrition basis requires explicit review of the numeric values; no automatic gram/millilitre conversion is made. Source provenance and diary snapshots remain separate.
- Recipe ingredients can be searched in saved/reference foods. Reference copies and ingredient records are saved with the recipe; inline custom ingredient creation returns to the same recipe draft. Ingredient quantities can be edited in place using their stored nutrition snapshot. Batch summaries include all macros and preserve unknown values.
- **Add Food → Saved meals** previews original items and nutrition; a multiplier scales all portions. **Settings → Saved meals** supports rename/delete. Diary snapshots survive changes/deletion of a saved meal.
- History has horizontally scrollable 44 px date controls, readable labels, and native buttons grouped with accessible date/value descriptions. Empty averages show no data rather than implying zero intake. Mobile dialogs track the visual viewport to accommodate on-screen keyboards without disabling pinch zoom.
- Today advances on local midnight/resume when the selected date was Today. Browsing a historical date keeps that date selected. Real iPhone Safari/home-screen keyboard testing remains required.
