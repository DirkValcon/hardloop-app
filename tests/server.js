// Kleine statische server voor de browsertests en om lokaal te bekijken.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

export function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    const pad = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const bestand = join(ROOT, pad.endsWith('/') ? pad + 'index.html' : pad);
    try {
      const inhoud = await readFile(bestand);
      res.writeHead(200, { 'content-type': TYPES[extname(bestand)] ?? 'application/octet-stream' });
      res.end(inhoud);
    } catch {
      res.writeHead(404).end('niet gevonden');
    }
  });
  return new Promise((ok) => server.listen(port, 'localhost', () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.env.PORT ?? 8080));
  console.log(`http://127.0.0.1:${server.address().port}/`);
}
