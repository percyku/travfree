// 在 http://localhost:8081 提供 Swagger UI，每次請求都重新讀取 docs/openapi.yaml，改 spec 後重新整理即可。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = join(ROOT, 'docs', 'openapi.yaml');
const DIST = join(ROOT, 'node_modules', 'swagger-ui-dist');
const PORT = Number(process.env.PORT ?? 8081);

const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.map': 'application/json' };

const INDEX = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FreeTrav API</title>
  <link rel="stylesheet" href="./swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="./swagger-ui-bundle.js"></script>
  <script src="./swagger-ui-standalone-preset.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: './openapi.yaml',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout',
      deepLinking: true,
      persistAuthorization: true,
      tryItOutEnabled: false,
      docExpansion: 'list',
    });
  </script>
</body>
</html>`;

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  try {
    if (path === '/' || path === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(INDEX);
    } else if (path === '/openapi.yaml') {
      res.writeHead(200, { 'Content-Type': 'application/yaml; charset=utf-8', 'Cache-Control': 'no-store' })
        .end(await readFile(SPEC));
    } else {
      const file = normalize(join(DIST, path));
      if (!file.startsWith(DIST + sep)) throw Object.assign(new Error('forbidden'), { code: 'ENOENT' });
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    }
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end(e.code === 'ENOENT' ? 'Not found' : String(e));
  }
}).on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.error(`port ${PORT} 已被佔用，可能已有 Swagger UI 在執行，直接開啟 http://localhost:${PORT}/ 即可。`);
  console.error(`要改用其他 port：PORT=8082 npm run openapi:preview`);
  process.exit(1);
}).listen(PORT, 'localhost', () => {
  console.log(`Swagger UI：http://localhost:${PORT}/  （spec：docs/openapi.yaml）`);
});
