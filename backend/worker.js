export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/games') {
      const { results } = await env.DB.prepare(
        'SELECT id, name, cover_url, download_url FROM games'
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

      const game = results[0];

      // Try to probe the remote download URL for a Content-Length.
      // First try HEAD; if that doesn't provide content-length, try a ranged GET.
      try {
        const headRes = await fetch(game.download_url, { method: 'HEAD' });
        let size = null;
        const cl = headRes.headers.get('content-length');
        if (cl) {
          size = Number(cl);
        } else {
          // Fallback: request a single byte to coax a Content-Range header
          const rangeRes = await fetch(game.download_url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
          const cr = rangeRes.headers.get('content-range');
          if (cr) {
            // Content-Range: bytes 0-0/123456
            const m = cr.match(/\/(\d+)$/);
            if (m) size = Number(m[1]);
          }
        }

        if (size !== null && !Number.isNaN(size)) {
          game.size_bytes = size;
        }
      } catch (err) {
        // Network probing failed; ignore and return the game without size
        // (client will simply not show size)
        // NOTE: Cloudflare Workers may restrict some outbound requests in dev.
      }

      return new Response(JSON.stringify(game), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response('not found', { status: 404 });
  }
};
