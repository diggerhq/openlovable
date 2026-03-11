// Cloudflare Worker: SSL-terminating proxy for OpenComputer SDK.
// Routes: https://WORKER/http/IP/PORT/path -> http://IP:PORT/path
// HTTP: uses nip.io hostname with fetch()
// WebSocket: uses raw TCP connect() to bridge WS frames between
//   browser (WSS via WebSocketPair) and upstream (WS via TCP)

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

    // Parse target from path: /http/IP/PORT/path or /http/IP:PORT/path
    const match = url.pathname.match(/^\/http\/([^/:]+)[/:](\d+)(\/.*)?$/);
    if (!match) {
      return new Response(
        JSON.stringify({ error: "Usage: /http/HOST/PORT/path" }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders() } }
      );
    }

    const ip = match[1];
    const port = parseInt(match[2], 10);
    const targetPath = (match[3] || "/") + url.search;
    const hostname = `${ip}.nip.io`;
    const targetUrl = `http://${hostname}:${port}${targetPath}`;

    // WebSocket upgrade — bridge browser WSS <-> upstream WS via raw TCP
    if (request.headers.get("upgrade") === "websocket") {
      const [clientWs, serverWs] = Object.values(new WebSocketPair());
      serverWs.accept();

      // Open raw TCP connection to upstream
      const tcp = connect({ hostname: ip, port });
      const writer = tcp.writable.getWriter();
      const reader = tcp.readable.getReader();

      // Send HTTP upgrade request to upstream
      const wsKey = request.headers.get("sec-websocket-key") || "";
      const wsVersion = request.headers.get("sec-websocket-version") || "13";
      let upgradeReq = `GET ${targetPath} HTTP/1.1\r\n`;
      upgradeReq += `Host: ${ip}:${port}\r\n`;
      upgradeReq += `Upgrade: websocket\r\n`;
      upgradeReq += `Connection: Upgrade\r\n`;
      upgradeReq += `Sec-WebSocket-Key: ${wsKey}\r\n`;
      upgradeReq += `Sec-WebSocket-Version: ${wsVersion}\r\n`;
      const proto = request.headers.get("sec-websocket-protocol");
      if (proto) upgradeReq += `Sec-WebSocket-Protocol: ${proto}\r\n`;
      upgradeReq += `\r\n`;

      await writer.write(new TextEncoder().encode(upgradeReq));

      // Read HTTP response headers
      const headerChunks = [];
      let headerStr = "";
      let bodyLeftover = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          serverWs.close(1011, "upstream closed during handshake");
          return new Response(null, { status: 101, webSocket: clientWs });
        }
        headerChunks.push(value);
        headerStr += new TextDecoder().decode(value);
        const idx = headerStr.indexOf("\r\n\r\n");
        if (idx !== -1) {
          // Calculate byte offset of body start
          const headerBytes = new TextEncoder().encode(headerStr.slice(0, idx + 4));
          const totalBytes = concatUint8(headerChunks);
          if (totalBytes.length > headerBytes.length) {
            bodyLeftover = totalBytes.slice(headerBytes.length);
          }
          headerStr = headerStr.slice(0, idx);
          break;
        }
      }

      // Verify 101 Switching Protocols
      if (!headerStr.startsWith("HTTP/1.1 101")) {
        console.log("WS upgrade rejected:", headerStr.slice(0, 300));
        serverWs.close(1011, "upstream rejected WebSocket upgrade");
        writer.releaseLock();
        reader.releaseLock();
        return new Response(null, { status: 101, webSocket: clientWs });
      }

      console.log("WS upgrade succeeded, bridging TCP<->WS");

      // ---- Bridge: upstream TCP -> browser WS ----
      // Upstream sends raw WebSocket frames over TCP.
      // We need to parse them and forward the payload to the browser via serverWs.
      (async () => {
        try {
          const parser = new WsFrameParser();
          const sendFrame = (opcode, payload) => {
            if (opcode === 0x01) {
              // Text frame
              serverWs.send(new TextDecoder().decode(payload));
            } else if (opcode === 0x02) {
              // Binary frame
              serverWs.send(payload.buffer);
            } else if (opcode === 0x08) {
              // Close frame
              serverWs.close(1000);
            } else if (opcode === 0x09) {
              // Ping — respond with pong
              serverWs.send(payload.buffer);
            }
            // Ignore pong (0x0A) and other opcodes
          };

          if (bodyLeftover && bodyLeftover.length > 0) {
            for (const frame of parser.push(bodyLeftover)) {
              sendFrame(frame.opcode, frame.payload);
            }
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const frame of parser.push(value)) {
              sendFrame(frame.opcode, frame.payload);
            }
          }
        } catch (e) {
          console.log("TCP->WS error:", e.message);
        }
        try { serverWs.close(1000); } catch {}
      })();

      // ---- Bridge: browser WS -> upstream TCP ----
      // Browser sends deframed messages. We need to re-frame them as
      // WebSocket frames (masked, per client->server requirement).
      serverWs.addEventListener("message", async (event) => {
        try {
          let payload;
          if (event.data instanceof ArrayBuffer) {
            payload = new Uint8Array(event.data);
          } else {
            payload = new TextEncoder().encode(event.data);
          }
          const opcode = (event.data instanceof ArrayBuffer) ? 0x02 : 0x01;
          const frame = encodeWsFrame(opcode, payload, true); // masked
          await writer.write(frame);
        } catch (e) {
          console.log("WS->TCP error:", e.message);
        }
      });

      serverWs.addEventListener("close", async () => {
        try {
          // Send close frame
          const frame = encodeWsFrame(0x08, new Uint8Array(0), true);
          await writer.write(frame);
          await writer.close();
        } catch {}
      });

      return new Response(null, { status: 101, webSocket: clientWs });
    }

    // Regular HTTP proxy
    const headers = new Headers(request.headers);
    headers.set("host", `${hostname}:${port}`);
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

// ---- Minimal WebSocket frame encoder/decoder ----

function concatUint8(arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// Encode a WebSocket frame
function encodeWsFrame(opcode, payload, masked = false) {
  const len = payload.length;
  let headerLen = 2;
  if (len > 65535) headerLen += 8;
  else if (len > 125) headerLen += 2;
  if (masked) headerLen += 4;

  const frame = new Uint8Array(headerLen + len);
  frame[0] = 0x80 | opcode; // FIN + opcode

  let offset = 1;
  if (len > 65535) {
    frame[offset] = masked ? (127 | 0x80) : 127;
    offset++;
    // 8-byte extended length (big-endian)
    const view = new DataView(frame.buffer);
    view.setBigUint64(offset, BigInt(len), false);
    offset += 8;
  } else if (len > 125) {
    frame[offset] = masked ? (126 | 0x80) : 126;
    offset++;
    frame[offset] = (len >> 8) & 0xFF;
    frame[offset + 1] = len & 0xFF;
    offset += 2;
  } else {
    frame[offset] = masked ? (len | 0x80) : len;
    offset++;
  }

  if (masked) {
    const mask = crypto.getRandomValues(new Uint8Array(4));
    frame.set(mask, offset);
    offset += 4;
    for (let i = 0; i < len; i++) {
      frame[offset + i] = payload[i] ^ mask[i % 4];
    }
  } else {
    frame.set(payload, offset);
  }

  return frame;
}

// Simple WebSocket frame parser (handles server->client unmasked frames)
class WsFrameParser {
  constructor() {
    this.buf = new Uint8Array(0);
  }

  push(data) {
    this.buf = concatUint8([this.buf, data]);
    const frames = [];
    while (true) {
      const frame = this._tryParse();
      if (!frame) break;
      frames.push(frame);
    }
    return frames;
  }

  _tryParse() {
    if (this.buf.length < 2) return null;

    const b0 = this.buf[0];
    const b1 = this.buf[1];
    const opcode = b0 & 0x0F;
    const masked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7F;
    let offset = 2;

    if (payloadLen === 126) {
      if (this.buf.length < 4) return null;
      payloadLen = (this.buf[2] << 8) | this.buf[3];
      offset = 4;
    } else if (payloadLen === 127) {
      if (this.buf.length < 10) return null;
      const view = new DataView(this.buf.buffer, this.buf.byteOffset);
      payloadLen = Number(view.getBigUint64(2, false));
      offset = 10;
    }

    if (masked) offset += 4;
    if (this.buf.length < offset + payloadLen) return null;

    let payload = this.buf.slice(offset, offset + payloadLen);
    if (masked) {
      const mask = this.buf.slice(offset - 4, offset);
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i % 4];
      }
    }

    this.buf = this.buf.slice(offset + payloadLen);
    return { opcode, payload };
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
  };
}
