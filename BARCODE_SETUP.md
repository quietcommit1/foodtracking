# Enable automatic barcode nutrition

GitHub Pages hosts the frontend. It cannot execute the server-side food lookup. Deploy the corrected `food-lookup` function to the Supabase project used by your website, then configure its identification email. No paid API or service-role frontend key is needed.

## Supabase Dashboard editor

1. Open your Supabase project. Check that its project URL matches `VITE_SUPABASE_URL` in GitHub repository → Settings → Secrets and variables → Actions → Variables. At the last live-site check its project reference was `umwcdvonjlyqohgrvqnv`.
2. Open **Edge Functions**. Edit `food-lookup` if it already exists, or choose **Deploy a new function → Via Editor** (wording may vary). Name it exactly **`food-lookup`**.
3. Copy the entire current [`supabase/functions/food-lookup/index.ts`](https://github.com/quietcommit1/foodtracking/blob/main/supabase/functions/food-lookup/index.ts) into the function's `index.ts`. It is a standalone file. Deploy it.
4. In the function's settings, turn off the gateway's **Verify JWT / Enforce JWT verification** option if enabled. This matches `supabase/config.toml`: the legacy gateway verification is incompatible with newer key formats. **The function itself verifies every caller with `auth.getUser` and rejects unauthenticated requests.** Keep Supabase email confirmation and database RLS enabled. Do not remove the function's caller checks.
5. Under **Edge Functions → Secrets**, set:
   - `OFF_CONTACT_EMAIL`: your real contact email for Open Food Facts API identification.
   - `OFF_STAGING`: `false`, so actual products are looked up in the production database.
6. Apply the SQL migration in README if not already installed. The function needs the personal `foods` table and `claim_food_lookup` RPC. Supabase supplies its own `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Edge Functions; don't put administrator keys into frontend settings.
7. Follow the [Open Food Facts official API registration/identification guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/) before use. The application sends read-only requests and identifies itself as `EverydayDiary/1.0 (your email)`.
8. Reload the site, sign in, and scan/enter a real product barcode. Known products open a review form with whatever nutrients the source supplies. Save, then scan again: it should use your private saved product.

## CLI alternative

From the repository, using your own authenticated Supabase CLI session:

```bash
npx supabase login
npx supabase functions deploy food-lookup --project-ref YOUR_PROJECT_REF
npx supabase secrets set --project-ref YOUR_PROJECT_REF OFF_CONTACT_EMAIL=YOUR_REAL_EMAIL OFF_STAGING=false
```

The function deployment reads `verify_jwt=false` from the committed configuration. Do not pass personal management tokens in chat or commit them. This document does not assert that the live function has been deployed.

## Diagnose a failed lookup

- **Not deployed:** check exact function name and project. Deploying Pages alone is insufficient.
- **Rejected session:** sign out/in when online; if it persists, check gateway settings and keep the handler's authentication checks.
- **Contact not configured:** set `OFF_CONTACT_EMAIL` in the function project's Secrets.
- **Product not found:** check digits and leading zeros. OFF does not contain every Indian product; manually save its package nutrition once.
- **Product found, some macros blank:** the source is incomplete. Enter only values printed on the label, or leave them unknown.
- **Database or throttle errors:** verify the migration is installed and inspect Edge Function logs. Keep any queued private edits; don't clear IndexedDB to fix server configuration.
- **Camera permission/decoder error:** allow the camera over HTTPS, try the rear camera or manual entry. Hold the full barcode in focus with good light.

The website has no automatic way to obtain Supabase administrator access from a publishable key. Server deployment still needs your project-owner Dashboard/CLI session.

## Nakpro barcode investigated

On 2026-10-11, barcode **8906133020187** passed the EAN-13 check digit and returned a found record from both Open Food Facts v2 and v3.6. Neither response contained a product name, brand or structured nutrition/macros. OFF has a nutrition-label photo, but the API cannot populate macros from an image. The application does not guess label values or run paid/AI image recognition. Enter the exact package values once and save them privately; subsequent scans use that saved record. Different Nakpro variants must not share assumed nutrition.

At that check, the live project's `food-lookup` endpoint also returned HTTP 404, `Requested function was not found`. Deploy the function using the steps above. Fixing its deployment enables other products with structured OFF nutrition; it does not fill absent source data for this barcode.

For iPhone Safari, the scanner requests a high-resolution rear camera, attempts continuous focus only when supported, and alternates centre-strip/full-frame decoding. A locally decoded **Scan from a barcode photo** option provides a sharper-image fallback. Optional flashlight controls appear only when the camera reports support. Camera device enumeration errors no longer stop decoding. Real iPhone camera verification remains pending; test on your actual package in good light, keeping all bars and white margins visible.
