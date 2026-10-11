// Never emit credentials; only public Supabase configuration belongs in a static build.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key)
  throw new Error(
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in GitHub repository Settings → Secrets and variables → Actions → Variables.',
  );
const parsed = new URL(url);
if (parsed.protocol !== 'https:') throw new Error('Production Supabase URL must use HTTPS.');
let publicKey = key.startsWith('sb_publishable_');
if (!publicKey) {
  try {
    publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon';
  } catch {}
}
if (!publicKey)
  throw new Error(
    'Only a publishable key or legacy anon key is permitted. Never deploy a secret/service-role key.',
  );
console.log('Public deployment configuration validated.');
