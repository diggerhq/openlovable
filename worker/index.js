// Cloudflare Worker: SSL-terminating proxy for OpenComputer SDK.
// Routes: https://WORKER/http/IP:PORT/path -> http://IP:PORT/path
// Supports both HTTP fetch and WebSocket upgrades.

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Parse target from path: /http/IP:PORT/rest/of/path
    const match = url.pathname.match(/^\/http\/([^/]+)(\/.*)?$/);
    if (!match) {
      return new Response(
        JSON.stringify({ error: "Usage: /http/HOST:PORT/path" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const targetHost = match[1];
    const targetPath = (match[2] || "/") + url.search;
    const targetUrl = `http://${targetHost}${targetPath}`;

    // WebSocket upgrade
    if (request.headers.get("upgrade") === "websocket") {
      const wsUrl = `ws://${targetHost}${targetPath}`;
      const resp = await fetch(wsUrl, {
        headers: request.headers,
      });
      // Cloudflare automatically handles the WS upgrade when we return
      // the upstream 101 response
      return resp;
    }

    // Regular HTTP proxy
    const headers = new Headers(request.headers);
    headers.delete("host");

    const resp = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });

    // Clone response with CORS headers
    const respHeaders = new Headers(resp.headers);
    for (const [k, v] of Object.entries(corsHeaders())) {
      respHeaders.set(k, v);
    }

    return new Response(resp.body, {
      status: resp.status,
      headers: respHeaders,
    });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
  };
}
