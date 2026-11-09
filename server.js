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
  makeLogoutCookie
} from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'summit-data.json');
const BACKUP_FILE = path.join(DATA_DIR, 'summit-data.backup.json');
const PRESETS_DIR = path.join(__dirname, 'data', 'presets');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

// La vista previa de la landing en "/" es privada salvo que se active explícitamente
const PUBLIC_LANDING = process.env.PUBLIC_LANDING === 'true';
// Detrás de Render/Nginx/Cloudflare la IP real y el protocolo vienen en cabeceras
const TRUST_PROXY = process.env.TRUST_PROXY !== 'false';

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
// Si DATA_DIR apunta a un disco persistente vacío, se siembra con los datos del repositorio
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of ['summit-data.json', 'summit-data.backup.json']) {
  const src = path.join(__dirname, 'data', f);
  const dst = path.join(DATA_DIR, f);
  if (!fs.existsSync(dst) && fs.existsSync(src) && src !== dst) fs.copyFileSync(src, dst);
}
initAuth(DATA_DIR);

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
  '.ico': 'image/x-icon'
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

// Rutas que no requieren sesión
const PUBLIC_EXACT = new Set(['/login', '/login/', '/login.html', '/robots.txt', '/favicon.ico',
  '/api/auth/login', '/api/auth/me', '/api/auth/logout']);
const PUBLIC_PREFIXES = ['/uploads/'];
const LANDING_PUBLIC_EXACT = new Set(['/', '/index.html', '/css/landing.css', '/js/landing.js']);

function isPublicRoute(pathname, method) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true;
  if (PUBLIC_LANDING) {
    if (LANDING_PUBLIC_EXACT.has(pathname)) return true;
    if (pathname === '/api/data' && method === 'GET') return true;
  }
  return false;
}

function readSummitData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (err) {
    console.error('Error reading data:', err);
    return null;
  }
}

function writeSummitData(data) {
  try {
    if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, BACKUP_FILE);
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Error writing data:', err);
    return false;
  }
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

  // Los assets subidos se pueden incrustar desde otros dominios (la landing exportada)
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

  const sendJson = (statusCode, data, extraHeaders = {}) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    });
    res.end(JSON.stringify(data));
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

  const isApi = pathname.startsWith('/api/');

  // CSRF: toda escritura debe originarse en este mismo dominio
  if (req.method !== 'GET' && req.method !== 'HEAD' && !isSameOrigin(req)) {
    return sendJson(403, { error: 'Origen de la petición no permitido' });
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
  // DATOS Y ASSETS
  // ==========================================
  if (pathname === '/api/data' && req.method === 'GET') {
    const data = readSummitData();
    if (!data) return sendJson(500, { error: 'No se pudo cargar la información del Summit' });
    return sendJson(200, data);
  }

  if (pathname === '/api/data' && req.method === 'POST') {
    readJsonBody(25 * 1024 * 1024)
      .then(payload => {
        if (writeSummitData(payload)) {
          sendJson(200, { success: true, message: 'Datos guardados correctamente' });
        } else {
          sendJson(500, { error: 'Error al persistir datos en disco' });
        }
      })
      .catch(err => sendJson(400, { error: 'Payload JSON inválido: ' + err.message }));
    return;
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    readJsonBody(Math.ceil(MAX_UPLOAD_BYTES * 1.4))
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

        // El nombre se conserva, pero la extensión siempre refleja el contenido real
        const stem = path.basename(filename).replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'imagen';
        const cleanName = stem + realExt;

        const uniqueName = `${Date.now()}-${cleanName}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, uniqueName), buffer);
        sendJson(200, { success: true, url: `/uploads/${uniqueName}`, filename: uniqueName, sizeBytes: buffer.length });
      })
      .catch(err => sendJson(400, { error: 'Error al procesar archivo: ' + err.message }));
    return;
  }

  if (pathname === '/api/preset' && req.method === 'POST') {
    if (!requireAdmin()) return;
    readJsonBody()
      .then(({ preset }) => {
        let presetPath = path.join(PRESETS_DIR, 'esg-summit.json');
        if (preset === 'tech' || preset === 'default') presetPath = BACKUP_FILE;
        if (!fs.existsSync(presetPath)) return sendJson(404, { error: 'Plantilla no encontrada' });
        const data = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
        writeSummitData(data);
        sendJson(200, { success: true, message: 'Plantilla aplicada con éxito', data });
      })
      .catch(err => sendJson(400, { error: err.message }));
    return;
  }

  if (pathname === '/api/reset' && req.method === 'POST') {
    if (!requireAdmin()) return;
    if (!fs.existsSync(BACKUP_FILE)) return sendJson(404, { error: 'No existe archivo de respaldo' });
    fs.copyFileSync(BACKUP_FILE, DATA_FILE);
    return sendJson(200, { success: true, message: 'Datos restaurados desde respaldo' });
  }

  if (pathname === '/api/download-assets-zip' && req.method === 'GET') {
    // Se genera fuera de /public para que nunca quede accesible sin sesión
    const zipPath = path.join(os.tmpdir(), `summit-assets-${Date.now()}-${process.pid}.zip`);
    execFile('zip', ['-r', '-q', zipPath, '.', '-x', '.DS_Store'], { cwd: UPLOADS_DIR }, (err) => {
      if (err || !fs.existsSync(zipPath)) {
        console.error('Error generating ZIP:', err);
        return sendJson(500, { error: 'No se pudo generar el archivo ZIP de imágenes' });
      }
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="summit-assets.zip"',
        'Cache-Control': 'no-store'
      });
      const stream = fs.createReadStream(zipPath);
      stream.pipe(res);
      stream.on('close', () => fs.unlink(zipPath, () => {}));
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

  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin.html') {
    pathname = '/admin.html';
  }

  if (pathname === '/login' || pathname === '/login/' || pathname === '/login.html') {
    if (currentUser) {
      res.writeHead(302, { Location: '/admin', 'Cache-Control': 'no-store' });
      return res.end();
    }
    pathname = '/login.html';
  }

  if (pathname === '/') pathname = '/index.html';

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

server.listen(PORT, '0.0.0.0', () => {
  console.log('===============================================');
  console.log('🚀 CMS Summit iniciado');
  console.log('🔒 Acceso restringido a usuarios autenticados');
  console.log('🚫 noindex activo (X-Robots-Tag en todas las respuestas)');
  console.log(`🔑 Login:  http://localhost:${PORT}/login`);
  console.log(`⚙️  Panel:  http://localhost:${PORT}/admin`);
  console.log(`🌐 Vista previa landing: ${PUBLIC_LANDING ? 'pública' : 'privada (requiere sesión)'}`);
  console.log('===============================================');
});
