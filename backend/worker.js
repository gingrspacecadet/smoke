export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/games') {
      const { results } = await env.DB.prepare(
        'SELECT id, name, cover_url, download_url FROM games ORDER BY name COLLATE NOCASE'
      ).all();

      return new Response(JSON.stringify(results), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const match = url.pathname.match(/^\/api\/games\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      const { results } = await env.DB.prepare(
        'SELECT id, name, cover_url, download_url FROM games WHERE id = ?'
      ).bind(id).all();

      if (!results.length) {
        return new Response('not found', { status: 404 });
      }

      return new Response(JSON.stringify(results[0]), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response('not found', { status: 404 });
  }
};
