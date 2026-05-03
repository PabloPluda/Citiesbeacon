export async function onRequest() {
  const resp = await fetch(
    'https://cityheroacademy.substack.com/api/v1/posts?limit=3',
    { headers: { 'Accept': 'application/json' } }
  );

  if (!resp.ok) {
    return new Response(JSON.stringify({ error: 'upstream failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await resp.json();

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=1800', // cache 30 min at edge
    },
  });
}
