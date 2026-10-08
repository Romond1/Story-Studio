import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function serve(port = 0) {
  const allowed = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
    ['/ui.mjs', ['ui.mjs', 'text/javascript']], ['/route.mjs', ['route.mjs', 'text/javascript']]]);
  const server = createServer(async (request, response) => {
    const entry = allowed.get(new URL(request.url, 'http://localhost').pathname);
    if (!entry) { response.writeHead(404); response.end(); return; }
    try {
      const body = await readFile(new URL(entry[0], import.meta.url));
      response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' }); response.end(body);
    } catch { response.writeHead(500); response.end('Unable to read prototype file'); }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await serve(Number(process.argv[2] || 5176));
  console.log(`Isolated audio harness: http://127.0.0.1:${server.address().port}`);
}
