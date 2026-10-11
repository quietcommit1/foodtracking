import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ status: 'unavailable', message: 'POST required' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return reply({ message: 'Authentication required' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
    error,
  } = await db.auth.getUser(auth.slice(7));
  if (error || !user) return reply({ message: 'Invalid session' }, 401);
  try {
    const body = await req.json();
    let code = String(body.barcode ?? '').trim();
    if (!/^\d{8}$|^\d{12,14}$/.test(code)) return reply({ message: 'Invalid barcode' }, 400);
    if (code.length === 12) code = '0' + code;
    if (code.length === 14 && code[0] === '0') code = code.slice(1);
    const saved = await db
      .from('foods')
      .select('*')
      .eq('user_id', user.id)
      .eq('barcode', code)
      .maybeSingle();
    if (saved.error) throw saved.error;
    if (saved.data) return reply({ status: 'saved', food: saved.data });
    const { data: allowed, error: rateError } = await db.rpc('claim_food_lookup');
    if (rateError) throw rateError;
    if (!allowed)
      return reply(
        {
          status: 'unavailable',
          message: 'Lookup limit reached. Retry in a minute or enter manually.',
        },
        429,
      );
    const contact = Deno.env.get('OFF_CONTACT_EMAIL');
    if (!contact)
      return reply(
        {
          status: 'unavailable',
          message:
            'External barcode lookup is not configured yet. Configure the lookup contact email in Supabase; saved products still work.',
        },
        503,
      );
    const staging = Deno.env.get('OFF_STAGING') === 'true';
    const host = staging ? 'world.openfoodfacts.net' : 'world.openfoodfacts.org';
    const response = await fetch(
      `https://${host}/api/v2/product/${code}.json?fields=code,product_name,product_name_en,brands,nutrition,nutriments,nutrition_data_per,serving_size,serving_quantity,serving_quantity_unit,quantity`,
      {
        headers: {
          'User-Agent': `EverydayDiary/1.0 (${contact})`,
          ...(staging ? { Authorization: 'Basic ' + btoa('off:off') } : {}),
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (response.status === 404) return reply({ status: 'not_found', barcode: code });
    if (!response.ok)
      return reply(
        {
          status: 'unavailable',
          message:
            response.status === 429
              ? 'Open Food Facts is rate limited. Try later.'
              : 'Open Food Facts is temporarily unavailable.',
        },
        503,
      );
    const result = await response.json();
    if (result.status === 0 || !result.product)
      return reply({ status: 'not_found', barcode: code });
    return reply({
      status: 'found',
      barcode: code,
      product: result.product,
      source_url: `https://world.openfoodfacts.org/product/${code}`,
      source_id: code,
    });
  } catch (e) {
    console.error('Food lookup failed', e instanceof Error ? e.name : 'error');
    return reply(
      {
        status: 'unavailable',
        message: 'Lookup unavailable. Check your connection or enter the product manually.',
      },
      503,
    );
  }
});
