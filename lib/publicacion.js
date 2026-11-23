// Sirve public/index.html como landing de un evento concreto.
// Inserta al inicio del <head> qué evento mostrar y en qué modo; js/evento-contexto.js
// hace que /js/landing.js pida exactamente ese contenido, sin modificar landing.js.
import fs from 'node:fs';
import path from 'node:path';

let plantilla = { mtime: 0, html: '' };

function leerIndex(publicDir) {
  const archivo = path.join(publicDir, 'index.html');
  const { mtimeMs } = fs.statSync(archivo);
  if (mtimeMs !== plantilla.mtime) plantilla = { mtime: mtimeMs, html: fs.readFileSync(archivo, 'utf-8') };
  return plantilla.html;
}

// JSON seguro dentro de <script>
const jsonEnScript = (obj) => JSON.stringify(obj)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// modo: "publicado" (URL pública) o "preview" (solo con sesión)
export function htmlLanding({ publicDir, eventoId, modo, version = null, aviso = null }) {
  const base = leerIndex(publicDir);
  const config = { evento: eventoId, modo, version, aviso };
  let cabecera = `\n<script>window.__SUMMIT__=${jsonEnScript(config)};</script>\n<script src="js/evento-contexto.js"></script>\n`;
  if (modo === 'preview') cabecera += '<meta name="robots" content="noindex, nofollow">\n';

  const head = base.match(/<head[^>]*>/i);
  if (!head) return cabecera + base;
  const i = head.index + head[0].length;
  return base.slice(0, i) + cabecera + base.slice(i);
}

export function htmlSinPublicar({ conSesion }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Próximamente</title>
<style>
  :root { color-scheme: light dark; --fondo: #f8fafc; --tinta: #0f172a; --suave: #64748b; }
  @media (prefers-color-scheme: dark) { :root { --fondo: #0f172a; --tinta: #e2e8f0; --suave: #94a3b8; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--fondo); color: var(--tinta);
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 24px; text-align: center; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  p { color: var(--suave); margin: 0; }
  a { color: inherit; }
</style>
</head>
<body>
  <main>
    <h1>Próximamente</h1>
    <p>Estamos preparando este sitio.</p>
    ${conSesion ? '<p style="margin-top:16px">Ningún evento está publicado en la raíz. <a href="/eventos">Elige uno en Eventos</a>.</p>' : ''}
  </main>
</body>
</html>`;
}
