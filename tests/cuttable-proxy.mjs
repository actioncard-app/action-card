// Minimal HTTPS (CONNECT) forward proxy for the live offline test. cut() destroys every open tunnel and refuses new
// ones, so the browser really cannot reach the site any more (unlike route() mocks, this also covers requests made by
// the service worker and works the same in Chromium and WebKit). It only tunnels bytes; it never sees decrypted data.
import http from 'node:http';
import net from 'node:net';

export function startCuttableProxy() {
  let up = true, count = 0;
  const sockets = new Set();
  const track = (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); s.on('error', () => {}); };
  const server = http.createServer((req, res) => { res.writeHead(up ? 501 : 502); res.end(); });
  server.on('connect', (req, client, head) => {
    track(client);
    if (!up) { client.destroy(); return; }
    const [host, port] = req.url.split(':');
    const upstream = net.connect(Number(port) || 443, host, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head?.length) upstream.write(head);
      upstream.pipe(client); client.pipe(upstream);
    });
    track(upstream);
    count++;
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    port: server.address().port,
    tunnels: () => count,
    cut: () => { up = false; for (const s of sockets) s.destroy(); },
    close: () => { up = false; for (const s of sockets) s.destroy(); server.close(); },
  })));
}
