import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  initAuth,
  authenticateUser,
  getLockoutRemaining,
  createSession,
  destroySession,
  getUsersList,
  createUser,
  deleteUser,
  adminResetPassword,
  changePassword,
  getTokenFromRequest,
  getSessionFromRequest,
  makeSessionCookie,
  makeLogoutCookie,
  parseCookies
} from './auth.js';
import { httpError } from './lib/errores.js';
import * as ev from './lib/eventos.js';
import { esRutaEventos, manejarApiEventos } from './lib/api-eventos.js';
import { htmlLanding, htmlSinPublicar } from './lib/publicacion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
// En Render, DATA_DIR debe apuntar a un disco persistente (p. ej. /var/data)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PRESETS_DIR = path.join(__dirname, 'data', 'presets');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');               // imágenes nuevas
const UPLOADS_LEGADO_DIR = path.join(PUBLIC_DIR, 'uploads');      // imágenes que ya vienen en el repositorio
const EVENTO_COOKIE = 'summit_evento';

// Detrás de Render/Nginx/Cloudflare la IP real y el protocolo vienen en cabeceras
const TRUST_PROXY = process.env.TRUST_PROXY !== 'false';
// Las landings publicadas solo se dejan indexar en buscadores si se activa explícitamente
const PERMITIR_INDEXACION = process.env.PERMITIR_INDEXACION === 'true';

// Si DATA_DIR apunta a un disco persistente vacío, se siembra con los datos del repositorio
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of ['summit-data.json', 'summit-data.backup.json']) {
  const src = path.join(__dirname, 'data', f);
  const dst = path.join(DATA_DIR, f);
  if (!fs.existsSync(dst) && fs.existsSync(src) && src !== dst) fs.copyFileSync(src, dst);
}
initAuth(DATA_DIR);
ev.initEventos({
  dataDir: DATA_DIR,
  uploadsDir: UPLOADS_DIR,
  uploadsLegadoDir: UPLOADS_LEGADO_DIR,
  listarUsuarios: getUsersList
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

// Tipos permitidos en /api/upload (extensión → MIME esperado)
const UPLOAD_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// ==========================================
// QUÉ ES PÚBLICO
// Las landings publicadas, sus estilos/scripts/imágenes y el login.
// Todo lo demás (editor, tablero de eventos, vista previa, API de escritura) pide sesión.
// ==========================================
const PUBLIC_EXACT = new Set(['/login', '/login/', '/login.html', '/robots.txt', '/favicon.ico',
  '/api/auth/login', '/api/auth/me', '/api/auth/logout']);
const PRIVATE_FILES = new Set(['admin.html', 'eventos.html', 'js/admin.js', 'index.html']);
const PUBLIC_STATIC_EXT = new Set(['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif',
  '.ico', '.woff', '.woff2', '.ttf', '.otf']);

function isPublicRoute(pathname, method) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/uploads/')) return true;
  // /api/data sin sesión solo entrega contenido publicado
  if (pathname === '/api/data' && method === 'GET') return true;
  if ((method === 'GET' || method === 'HEAD') && !PRIVATE_FILES.has(pathname)
    && PUBLIC_STATIC_EXT.has(path.extname(pathname).toLowerCase())) return true;
  return false;
}

// Una ruta de primer nivel que podría ser la URL de una landing: /mujeres-2026
const RUTA_LANDING_RE = /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

function leerJsonArchivo(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

// Contenido con el que nace un evento nuevo que no se copia de otro
function cargarPlantilla() {
  return leerJsonArchivo(path.join(PRESETS_DIR, 'esg-summit.json'))
    || leerJsonArchivo(path.join(__dirname, 'data', 'summit-data.json'));
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getClientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) {
    return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function isHttps(req) {
  if (req.socket.encrypted) return true;
  return TRUST_PROXY && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

// Protección CSRF: las peticiones que modifican datos deben venir del mismo host
function isSameOrigin(req) {
  const host = req.headers['x-forwarded-host'] && TRUST_PROXY ? req.headers['x-forwarded-host'] : req.headers.host;
  const source = req.headers.origin || req.headers.referer;
  if (!source || !host) return false;
  try {
    return new URL(source).host === String(host).split(',')[0].trim();
  } catch {
    return false;
  }
}

// Solo se aceptan destinos internos tras el login (evita redirecciones a otros sitios)
function destinoSeguro(next, porDefecto) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next : porDefecto;
}

// Detecta el tipo real del archivo por sus primeros bytes (no confía en el nombre)
function detectImageExt(buf) {
  const hex = buf.subarray(0, 12).toString('hex');
  if (hex.startsWith('89504e470d0a1a0a')) return '.png';
  if (hex.startsWith('ffd8ff')) return '.jpg';
  if (hex.startsWith('47494638')) return '.gif';
  if (hex.startsWith('52494646') && buf.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  if (buf.subarray(4, 12).toString('ascii').startsWith('ftypavi')) return '.avif';
  if (hex.startsWith('00000100')) return '.ico';
  const head = buf.subarray(0, 4096).toString('utf-8').replace(/^\uFEFF/, '').trim().toLowerCase();
  if ((head.startsWith('<?xml') || head.startsWith('<svg') || head.startsWith('<!--') || head.startsWith('<!doctype svg')) && head.includes('<svg')) {
    return '.svg';
  }
  return null;
}

const server = http.createServer((req, res) => {
  const secure = isHttps(req);

  // ==========================================
  // CABECERAS GLOBALES: noindex + seguridad
  // ==========================================
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400);
    return res.end();
  }
  let pathname;
  try {
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (pathname.includes('\0') || pathname.includes('\\')) {
    res.writeHead(400);
    return res.end();
  }
  // Se normaliza ANTES del control de acceso para que "/uploads/../admin.html" no se cuele
  pathname = path.posix.normalize(pathname);
  if (!pathname.startsWith('/') || pathname.split('/').includes('..')) {
    res.writeHead(400);
    return res.end();
  }

  // Los assets subidos se pueden incrustar desde otros dominios (la landing exportada a WordPress)
  if (pathname.startsWith('/uploads/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Un SVG abierto directamente no puede ejecutar scripts en este dominio
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const currentUser = getSessionFromRequest(req);
  const esLectura = req.method === 'GET' || req.method === 'HEAD';

  const sendJson = (statusCode, data, extraHeaders = {}) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    });
    res.end(JSON.stringify(data));
  };

  const sendHtml = (statusCode, html, extraHeaders = {}) => {
    res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
    res.end(req.method === 'HEAD' ? undefined : html);
  };

  // Convierte cualquier error (incluidos los de lib/eventos.js) en una respuesta JSON
  const fallo = (err) => {
    const status = err.status || 500;
    if (status >= 500) console.error(`[${req.method} ${pathname}]`, err);
    if (!res.headersSent) {
      sendJson(status, { error: status >= 500 ? 'Error interno del servidor' : err.message, ...(err.extra || {}) });
    }
  };

  const readJsonBody = (maxSize = 1024 * 1024) => new Promise((resolve, reject) => {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.toLowerCase().startsWith('application/json')) {
      return reject(new Error('Content-Type debe ser application/json'));
    }
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error('Payload demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      if (!body) return resolve({});
      try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        resolve(parsed);
      } catch {
        reject(new Error('Formato JSON inválido'));
      }
    });
    req.on('error', reject);
  });

  const leerJson = (maxSize) => readJsonBody(maxSize).catch(err => { throw httpError(400, err.message); });

  // Evento que edita el editor: ?evento=<id> → cookie del editor → último editado
  const eventoDeLaPeticion = () => {
    const solicitado = parsedUrl.searchParams.get('evento');
    if (solicitado) return ev.resolverEventoId(solicitado, { estricto: true });
    return ev.resolverEventoId(parseCookies(req.headers.cookie)[EVENTO_COOKIE]);
  };

  const isApi = pathname.startsWith('/api/');

  // CSRF: toda escritura debe originarse en este mismo dominio
  if (!esLectura && !isSameOrigin(req)) {
    return sendJson(403, { error: 'Origen de la petición no permitido' });
  }

  // ==========================================
  // LANDINGS PÚBLICAS: "/" y "/<ruta>" de cada evento publicado
  // ==========================================
  if (esLectura && (pathname === '/' || pathname === '/index.html' || RUTA_LANDING_RE.test(pathname.replace(/\/$/, '')))) {
    if (pathname === '/index.html') {
      res.writeHead(301, { Location: '/' + parsedUrl.search });
      return res.end();
    }
    // /mujeres-2026/ → /mujeres-2026 (con la barra final las rutas relativas se romperían)
    if (pathname.length > 1 && pathname.endsWith('/')) {
      const sinBarra = pathname.slice(0, -1);
      if (ev.eventoPublicoPorRuta(sinBarra)) {
        res.writeHead(301, { Location: sinBarra + parsedUrl.search });
        return res.end();
      }
    }
    const publico = ev.eventoPublicoPorRuta(pathname);
    if (publico) {
      try {
        const html = htmlLanding({ publicDir: PUBLIC_DIR, eventoId: publico.id, modo: 'publicado' });
        if (PERMITIR_INDEXACION) res.removeHeader('X-Robots-Tag');
        return sendHtml(200, html, { 'Cache-Control': 'no-cache' });
      } catch (err) {
        return fallo(err);
      }
    }
    if (pathname === '/') return sendHtml(200, htmlSinPublicar({ conSesion: !!currentUser }));
    // Una URL que no es del CMS ni de una landing publicada: 404 público, sin mandar al login
    const ruta = pathname.replace(/^\/|\/$/g, '');
    if (!ev.RUTAS_RESERVADAS.has(ruta)) {
      return sendHtml(404, `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Página no encontrada</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px"><main><h1 style="margin:0 0 8px">Página no encontrada</h1><p style="margin:0;opacity:.7">Esta dirección no corresponde a ningún evento publicado.</p>${currentUser ? '<p><a href="/eventos">Ir a Eventos</a></p>' : ''}</main></body></html>`);
    }
    // Rutas del CMS (/admin, /login, /eventos, /vista-previa…) siguen su camino
  }

  // ==========================================
  // CONTROL DE ACCESO POR DEFECTO
  // Todo es privado salvo lo listado en isPublicRoute()
  // ==========================================
  if (!currentUser && !isPublicRoute(pathname, req.method)) {
    if (isApi) return sendJson(401, { error: 'Acceso no autorizado. Inicia sesión en el CMS.' });
    const next = encodeURIComponent(pathname + parsedUrl.search);
    res.writeHead(302, { Location: `/login?next=${next}`, 'Cache-Control': 'no-store' });
    return res.end();
  }

  const requireAdmin = () => {
    if (currentUser.role !== 'admin') {
      sendJson(403, { error: 'Se requieren permisos de Administrador' });
      return false;
    }
    return true;
  };

  // ==========================================
  // AUTENTICACIÓN
  // ==========================================
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const ip = getClientIp(req);
    readJsonBody(16 * 1024)
      .then(({ username, password }) => {
        const wait = getLockoutRemaining(ip, username);
        if (wait > 0) {
          const minutes = Math.ceil(wait / 60000);
          return sendJson(429, { error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutes} min.` },
            { 'Retry-After': String(Math.ceil(wait / 1000)) });
        }
        const user = authenticateUser(username, password, ip);
        if (!user) return sendJson(401, { error: 'Usuario o contraseña incorrectos' });

        // Rota la sesión: invalida cualquier cookie previa
        const oldToken = getTokenFromRequest(req);
        if (oldToken) destroySession(oldToken);

        const token = createSession(user);
        console.log(`[auth] login ok: ${user.username} (${user.role}) desde ${ip}`);
        sendJson(200, { success: true, message: `Bienvenido ${user.name}`, user },
          { 'Set-Cookie': makeSessionCookie(token, secure) });
      })
      .catch(err => sendJson(400, { error: err.message }));
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    destroySession(getTokenFromRequest(req));
    return sendJson(200, { success: true, message: 'Sesión cerrada correctamente' },
      { 'Set-Cookie': makeLogoutCookie(secure) });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    return sendJson(200, { authenticated: !!currentUser, user: currentUser || null });
  }

  if (pathname === '/api/auth/users' && req.method === 'GET') {
    if (!requireAdmin()) return;
    return sendJson(200, { users: getUsersList() });
  }

  if (pathname === '/api/auth/users' && req.method === 'POST') {
    if (!requireAdmin()) return;
    readJsonBody()
      .then(payload => {
        const newUser = createUser(payload);
        console.log(`[auth] ${currentUser.username} creó al usuario ${newUser.username} (${newUser.role})`);
        sendJson(201, { success: true, message: 'Usuario creado exitosamente', user: newUser });
      })
      .catch(err => sendJson(400, { error: err.message }));
    return;
  }

  if (pathname === '/api/auth/users' && req.method === 'DELETE') {
    if (!requireAdmin()) return;
    readJsonBody()
      .then(({ userId }) => {
        deleteUser(userId, currentUser.id);
        console.log(`[auth] ${currentUser.username} eliminó al usuario ${userId}`);
        sendJson(200, { success: true, message: 'Usuario eliminado' });
      })
      .catch(err => sendJson(400, { error: err.message }));
    return;
  }

  if (pathname === '/api/auth/users/reset-password' && req.method === 'POST') {
    if (!requireAdmin()) return;
    readJsonBody()
      .then(({ userId, newPassword }) => {
        adminResetPassword(userId, newPassword);
        console.log(`[auth] ${currentUser.username} restableció la contraseña de ${userId}`);
        sendJson(200, { success: true, message: 'Contraseña restablecida. Se cerraron las sesiones de ese usuario.' });
      })
      .catch(err => sendJson(400, { error: err.message }));
    return;
  }

  if (pathname === '/api/auth/change-password' && req.method === 'POST') {
    readJsonBody()
      .then(({ oldPassword, newPassword }) => {
        changePassword(currentUser.id, oldPassword, newPassword, getTokenFromRequest(req));
        sendJson(200, { success: true, message: 'Contraseña actualizada exitosamente' });
      })
      .catch(err => sendJson(400, { error: err.message }));
    return;
  }

  // ==========================================
  // DATOS DE LA LANDING
  // ==========================================
  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      const modo = parsedUrl.searchParams.get('modo');
      const pedido = parsedUrl.searchParams.get('evento');

      // Sin sesión, o desde una URL pública: solo la versión publicada
      if (!currentUser || modo === 'publicado') {
        const publico = pedido ? ev.eventoPublicoPorId(pedido) : ev.eventoPublicoPorRuta('/');
        if (!publico) return sendJson(404, { error: 'Esta landing no está publicada' });
        return sendJson(200, ev.contenidoPublicado(publico));
      }

      // Vista previa: lo último guardado (o una versión concreta), sin publicar nada
      if (modo === 'preview') {
        const eventoId = eventoDeLaPeticion();
        return sendJson(200, ev.obtenerContenido(eventoId, parsedUrl.searchParams.get('version')).contenido);
      }

      // Editor: lo último guardado, con el número de versión para detectar conflictos
      const eventoId = eventoDeLaPeticion();
      const actual = ev.obtenerContenidoActual(eventoId);
      return sendJson(200, actual.contenido, {
        'X-Evento-Id': eventoId,
        'X-Evento-Nombre': encodeURIComponent(actual.nombre),
        'X-Version': String(actual.numero)
      });
    } catch (err) {
      return fallo(err);
    }
  }

  // Cada guardado crea una versión nueva. Con X-Version-Base (la pone js/evento-contexto.js)
  // se detecta si otra persona guardó mientras editabas.
  if (pathname === '/api/data' && req.method === 'POST') {
    leerJson(25 * 1024 * 1024)
      .then(payload => {
        const eventoId = eventoDeLaPeticion();
        const base = req.headers['x-version-base'];
        let nota = null;
        try { nota = req.headers['x-version-nota'] ? decodeURIComponent(req.headers['x-version-nota']) : null; } catch {}
        const v = ev.guardarVersion({
          eventoId,
          versionBase: base ? Number(base) : null,
          contenido: payload,
          nota,
          usuarioId: currentUser.id,
          forzar: !base || req.headers['x-forzar'] === '1'
        });
        sendJson(200, { success: true, message: `Datos guardados (versión ${v.numero})`, version: v.numero, eventoId });
      })
      .catch(fallo);
    return;
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    leerJson(Math.ceil(MAX_UPLOAD_BYTES * 1.4))
      .then(({ filename, dataUrl }) => {
        if (typeof filename !== 'string' || typeof dataUrl !== 'string') {
          return sendJson(400, { error: 'Faltan parámetros filename o dataUrl' });
        }
        const matches = dataUrl.match(/^data:([a-zA-Z0-9.+\/-]+);base64,([A-Za-z0-9+/=\s]+)$/);
        if (!matches) return sendJson(400, { error: 'Formato Base64 inválido' });

        const buffer = Buffer.from(matches[2], 'base64');
        if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
          return sendJson(413, { error: 'El archivo está vacío o supera los 20 MB' });
        }
        const realExt = detectImageExt(buffer);
        if (!realExt || !UPLOAD_TYPES[realExt]) {
          return sendJson(415, { error: 'Tipo de archivo no permitido. Solo imágenes (PNG, JPG, GIF, WEBP, AVIF, SVG, ICO).' });
        }

        const eventoId = eventoDeLaPeticion();
        // El nombre se conserva, pero la extensión siempre refleja el contenido real
        const stem = path.basename(filename).replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'imagen';
        const uniqueName = `${Date.now()}-${stem}${realExt}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, uniqueName), buffer);
        ev.registrarAsset(eventoId, { archivo: uniqueName, nombreOriginal: path.basename(filename), bytes: buffer.length, usuarioId: currentUser.id });
        sendJson(200, { success: true, url: `/uploads/${uniqueName}`, filename: uniqueName, sizeBytes: buffer.length });
      })
      .catch(fallo);
    return;
  }

  // Aplica una plantilla como versión nueva del evento (la anterior queda en el historial)
  if (pathname === '/api/preset' && req.method === 'POST') {
    if (!requireAdmin()) return;
    leerJson()
      .then(({ preset }) => {
        let presetPath = path.join(PRESETS_DIR, 'esg-summit.json');
        if (preset === 'tech' || preset === 'default') presetPath = path.join(__dirname, 'data', 'summit-data.backup.json');
        const data = leerJsonArchivo(presetPath);
        if (!data) return sendJson(404, { error: 'Plantilla no encontrada' });
        const v = ev.guardarVersion({
          eventoId: eventoDeLaPeticion(), contenido: data, nota: `Plantilla aplicada: ${preset || 'esg'}`,
          usuarioId: currentUser.id, forzar: true
        });
        sendJson(200, { success: true, message: 'Plantilla aplicada con éxito', data, version: v.numero });
      })
      .catch(fallo);
    return;
  }

  // Vuelve a la versión anterior del evento (la actual queda en el historial)
  if (pathname === '/api/reset' && req.method === 'POST') {
    if (!requireAdmin()) return;
    try {
      const v = ev.restaurarAnterior({ eventoId: eventoDeLaPeticion(), usuarioId: currentUser.id });
      return sendJson(200, { success: true, message: `Se restauró la versión anterior (ahora versión ${v.numero})`, version: v.numero });
    } catch (err) {
      return fallo(err);
    }
  }

  // ZIP con las imágenes del evento que se está editando
  if (pathname === '/api/download-assets-zip' && req.method === 'GET') {
    let archivos;
    try {
      archivos = ev.archivosDelEvento(eventoDeLaPeticion());
    } catch (err) {
      return fallo(err);
    }
    if (!archivos.length) return sendJson(404, { error: 'Este evento todavía no tiene imágenes' });

    // Todo se genera en la carpeta temporal del sistema, nunca dentro de /public
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'summit-assets-'));
    const zipPath = `${carpeta}.zip`;
    const limpiar = () => {
      fs.rm(carpeta, { recursive: true, force: true }, () => {});
      fs.unlink(zipPath, () => {});
    };
    for (const a of archivos) fs.copyFileSync(a.ruta, path.join(carpeta, a.nombre));

    execFile('zip', ['-r', '-q', zipPath, '.', '-x', '.DS_Store'], { cwd: carpeta }, (err) => {
      if (err || !fs.existsSync(zipPath)) {
        console.error('Error generating ZIP:', err);
        limpiar();
        return sendJson(500, { error: 'No se pudo generar el archivo ZIP de imágenes' });
      }
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="summit-assets.zip"',
        'Cache-Control': 'no-store'
      });
      const stream = fs.createReadStream(zipPath);
      stream.pipe(res);
      stream.on('close', limpiar);
    });
    return;
  }

  // ==========================================
  // TABLERO DE EVENTOS, PUBLICACIÓN, TAREAS Y PAPELERA
  // ==========================================
  if (esRutaEventos(pathname)) {
    manejarApiEventos({
      req,
      pathname,
      searchParams: parsedUrl.searchParams,
      usuario: currentUser,
      leerJson,
      enviar: sendJson,
      listarEquipo: () => getUsersList().map(u => ({ id: u.id, nombre: u.name, username: u.username, rol: u.role })),
      cargarPlantilla
    });
    return;
  }

  if (isApi) return sendJson(404, { error: 'Endpoint no encontrado' });

  // ==========================================
  // PÁGINAS
  // ==========================================
  if (pathname === '/robots.txt') {
    // No se usa "Disallow: /" a propósito: si el rastreador no puede leer la página,
    // tampoco ve la etiqueta noindex. La cabecera X-Robots-Tag hace el trabajo.
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('User-agent: *\nDisallow:\n');
  }

  // Vista previa (solo con sesión): lo último guardado o ?version=N, sin publicar
  const mPrevia = pathname.match(/^\/vista-previa(?:\/([^/]+))?\/?$/);
  if (mPrevia && esLectura) {
    try {
      const eventoId = mPrevia[1] ? ev.resolverEventoId(mPrevia[1], { estricto: true }) : eventoDeLaPeticion();
      const { evento, numero } = ev.obtenerContenido(eventoId, parsedUrl.searchParams.get('version'));
      const estado = numero === evento.versionPublicada
        ? 'es la versión publicada'
        : evento.versionPublicada ? `la publicada es la ${evento.versionPublicada}` : 'el evento aún no está publicado';
      const html = htmlLanding({
        publicDir: PUBLIC_DIR, eventoId, modo: 'preview', version: numero,
        aviso: `Vista previa de “${evento.nombre}”, versión ${numero} (${estado})`
      });
      return sendHtml(200, html);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error('[vista-previa]', err);
      return sendHtml(status, `<!doctype html><meta name="robots" content="noindex"><meta charset="utf-8"><p style="font:16px system-ui;padding:24px">${escapeHtml(status >= 500 ? 'No se pudo generar la vista previa' : err.message)}. <a href="/eventos">Volver a Eventos</a></p>`);
    }
  }

  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin.html') {
    pathname = '/admin.html';
  }

  if (pathname === '/eventos' || pathname === '/eventos/' || pathname === '/eventos.html') {
    pathname = '/eventos.html';
  }

  if (pathname === '/login' || pathname === '/login/' || pathname === '/login.html') {
    if (currentUser) {
      const destino = destinoSeguro(parsedUrl.searchParams.get('next'), '/eventos');
      res.writeHead(302, { Location: destino, 'Cache-Control': 'no-store' });
      return res.end();
    }
    pathname = '/login.html';
  }

  // Imágenes: primero las subidas (DATA_DIR/uploads), después las del repositorio (public/uploads)
  if (pathname.startsWith('/uploads/')) {
    const nombre = pathname.slice('/uploads/'.length);
    const candidato = path.resolve(UPLOADS_DIR, nombre);
    if (candidato.startsWith(UPLOADS_DIR + path.sep) && !path.basename(candidato).startsWith('.')) {
      let st = null;
      try { st = fs.statSync(candidato); } catch {}
      if (st && st.isFile()) {
        const ext = path.extname(candidato).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        return fs.createReadStream(candidato).pipe(res);
      }
    }
  }

  // Archivos estáticos con verificación estricta de contención
  const filePath = path.resolve(PUBLIC_DIR, '.' + path.posix.normalize('/' + pathname));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  const base = path.basename(filePath);
  if (base.startsWith('.')) {
    res.writeHead(404);
    return res.end();
  }

  let stat = null;
  try { stat = fs.statSync(filePath); } catch {}
  if (stat && stat.isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' };
    if (ext === '.html') headers['Cache-Control'] = 'no-store';
    res.writeHead(200, headers);
    return fs.createReadStream(filePath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta name="robots" content="noindex"><h1>404</h1><p>Ruta no encontrada: ${escapeHtml(pathname)}</p>`);
});

// La papelera se vacía sola: lo que lleva más de DIAS_PAPELERA días se elimina
const vaciarPapelera = () => {
  try { ev.purgarPapelera(); } catch (err) { console.error('[papelera]', err.message); }
};
vaciarPapelera();
setInterval(vaciarPapelera, 24 * 60 * 60 * 1000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log('===============================================');
  console.log('🚀 CMS Summit iniciado');
  console.log(`💾 Datos en: ${DATA_DIR}`);
  console.log('🌐 Landings publicadas: públicas en / y /<ruta>');
  console.log(`🔎 Indexación en buscadores: ${PERMITIR_INDEXACION ? 'permitida en landings publicadas' : 'bloqueada (noindex)'}`);
  console.log(`🔑 Login:   http://localhost:${PORT}/login`);
  console.log(`🗂️  Eventos: http://localhost:${PORT}/eventos`);
  console.log(`⚙️  Editor:  http://localhost:${PORT}/admin`);
  console.log('===============================================');
});
