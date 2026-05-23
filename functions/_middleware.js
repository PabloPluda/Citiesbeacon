const SUPABASE_URL = 'https://ielaccsufrrafhcssqpu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ujF_WvkXfx_4sbW_gN8dWg_UWroCm3K';

const DEFAULTS = {
  meta_title:       'CityHero Academy',
  meta_description: 'Mini-juegos educativos para chicos de 5 a 8 años. ¡Completá misiones y ganá puntos!',
  og_image_url:     'https://cityheroacademy.com/ImageforSEO.jpg',
};

async function fetchSeoSettings() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?select=key,value`,
      {
        headers: {
          apikey:        SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept:        'application/json',
        },
      }
    );
    if (!res.ok) return DEFAULTS;
    const rows = await res.json();
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
      meta_title:       map.meta_title       || DEFAULTS.meta_title,
      meta_description: map.meta_description || DEFAULTS.meta_description,
      og_image_url:     map.og_image_url     || DEFAULTS.og_image_url,
    };
  } catch {
    return DEFAULTS;
  }
}

function buildMetaTags(seo) {
  const title = seo.meta_title;
  const desc  = seo.meta_description;
  const img   = seo.og_image_url || DEFAULTS.og_image_url;
  const url   = 'https://cityheroacademy.com';

  return `
    <title>${title}</title>
    <meta name="description" content="${desc}">
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:site_name" content="CityHero Academy" />
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${img}">`;
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  // Only intercept HTML document requests (not assets, API calls, etc.)
  const accept = request.headers.get('Accept') || '';
  const isHtml = accept.includes('text/html') || url.pathname === '/' || url.pathname.endsWith('.html');
  const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|json|webp|mp4|webm)$/i.test(url.pathname);

  if (!isHtml || isAsset) {
    return next();
  }

  const [response, seo] = await Promise.all([next(), fetchSeoSettings()]);

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  // Remove any existing title/description/og/twitter tags injected at build time
  html = html
    .replace(/<title>[^<]*<\/title>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '');

  const tags = buildMetaTags(seo);
  html = html.replace('</head>', `${tags}\n  </head>`);

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Content-Type', 'text/html; charset=utf-8');
  // Tell WhatsApp / other scrapers not to use a stale cached version
  newHeaders.set('Cache-Control', 'public, max-age=300, s-maxage=300');

  return new Response(html, {
    status: response.status,
    headers: newHeaders,
  });
}
