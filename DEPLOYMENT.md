# Live deployment

Application source is committed on `main` in `quietcommit1/foodtracking`. No private credentials are committed. The GitHub Pages workflow builds/test-checks the application and refuses missing or private Supabase keys. It supports the `/foodtracking/` subpath, including the PWA, local font/icon assets and scanner WASM.

## GitHub Pages on the Free plan

This option requires a **public repository** for GitHub Free. A private repository generally requires a paid GitHub plan for Pages. Do not change repository visibility without deciding whether you want the source public. If this repository is private and you want to keep it private on free tiers, connect it to your own free Cloudflare Pages/Netlify account instead; build with `npm ci && npm run build`, publish `dist`, and keep `VITE_BASE_PATH=/`.

For a public repository:

1. GitHub repository → Settings → Secrets and variables → Actions → **Variables**: add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The latter must be a public/publishable or legacy anon key; never a secret/service-role key.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Actions → Deploy Everyday to GitHub Pages → Run workflow on `main`. Future `main` pushes redeploy automatically. Successful deployment outputs the live URL; until the deployment completes, the anticipated `https://quietcommit1.github.io/foodtracking/` is not evidence the website is live.
4. In Supabase Auth configuration set the Site URL/allowed redirect URL to the actual HTTPS Pages URL. Create your initial confirmed account, apply the SQL migration and deploy `food-lookup` as described in README.md.
5. Sign in on the deployed site and confirm a diary entry persists after reload and from another device. Verify camera permissions/scanning over HTTPS.

## Current external prerequisites

The cloud has a Supabase project URL and a publishable key, but the current egress policy prevents checking that project and accessing GitHub's deployment API. Domain additions were saved to the cloud draft for `api.github.com`, `ealpcvbfzlkskqubmpyt.supabase.co`, and `quietcommit1.github.io`. Save them in environment settings and publish the environment update. This does not itself deploy the website.

No Supabase management credential or database connection was supplied, so applying migrations/deploying Edge Functions remains unverified. A publishable frontend key cannot administer the database. Use the SQL Editor/CLI instructions in README.md; don't put management credentials into frontend variables or send them in chat.
