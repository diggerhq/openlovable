// Cloudflare Worker: SSL-terminating proxy for OpenComputer SDK.
// Routes: https://WORKER/http/IP:PORT/path -> http://IP.nip.io:PORT/path
// Uses nip.io to turn raw IPs into hostnames (CF blocks direct IP fetch).
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
    const match = url.pathname.match(/^\/http\/([^/:]+):(\d+)(\/.*)?$/);
    if (!match) {
      return new Response(
        JSON.stringify({ error: "Usage: /http/HOST:PORT/path" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const ip = match[1];
    const port = match[2];
    const targetPath = (match[3] || "/") + url.search;
    // Use nip.io to give the IP a hostname so Cloudflare allows the fetch
    const hostname = `${ip}.nip.io`;
    const targetUrl = `http://${hostname}:${port}${targetPath}`;

    // WebSocket upgrade — use Cloudflare's native WebSocket proxy pattern
    if (request.headers.get("upgrade") === "websocket") {
      // Cloudflare requires fetching with Upgrade header to proxy WebSockets
      const resp = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "host": `${hostname}:${port}`,
          "upgrade": "websocket",
          "connection": "Upgrade",
          "sec-websocket-version": request.headers.get("sec-websocket-version") || "13",
          "sec-websocket-key": request.headers.get("sec-websocket-key") || "",
          "sec-websocket-protocol": request.headers.get("sec-websocket-protocol") || "",
          // Forward auth token if present
          "authorization": request.headers.get("authorization") || "",
        },
      });
      return resp;
    }

    // Regular HTTP proxy
    const headers = new Headers(request.headers);
    headers.set("host", `${hostname}:${port}`);
    // Remove Cloudflare-specific headers
    for (const key of [...headers.keys()]) {
      if (key.startsWith("cf-") || key.startsWith("x-forwarded") || key === "x-real-ip") {
        headers.delete(key);
      }
    }

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
