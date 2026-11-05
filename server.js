import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'summit-data.json');
const BACKUP_FILE = path.join(__dirname, 'data', 'summit-data.backup.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function readSummitData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading data:', err);
    return null;
  }
}

function writeSummitData(data) {
  try {
    const serialized = JSON.stringify(data, null, 2);
    // Write backup first if main exists
    if (fs.existsSync(DATA_FILE)) {
      fs.copyFileSync(DATA_FILE, BACKUP_FILE);
    }
    fs.writeFileSync(DATA_FILE, serialized, 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing data:', err);
    return false;
  }
}

const server = http.createServer((req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // API Endpoints
  if (pathname === '/api/data' && req.method === 'GET') {
    const data = readSummitData();
    if (!data) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No se pudo cargar la información del Summit' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const ok = writeSummitData(payload);
        if (ok) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Datos guardados correctamente' }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Error al persistir datos en disco' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload JSON inválido: ' + e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Allow up to 25MB for high-res images
      if (body.length > 30 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const { filename, dataUrl } = JSON.parse(body);
        if (!filename || !dataUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Faltan parámetros filename o dataUrl' }));
          return;
        }

        const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Formato de imagen Base64 inválido' }));
          return;
        }

        const ext = path.extname(filename) || '.jpg';
        const cleanName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = `${Date.now()}-${cleanName}`;
        const filePath = path.join(UPLOADS_DIR, uniqueName);

        const imageBuffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(filePath, imageBuffer);

        const publicUrl = `/uploads/${uniqueName}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          url: publicUrl,
          filename: uniqueName,
          sizeBytes: imageBuffer.length
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error al procesar archivo: ' + e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/preset' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { preset } = JSON.parse(body);
        let presetPath = path.join(__dirname, 'data', 'presets', 'esg-summit.json');
        if (preset === 'tech' || preset === 'default') {
          presetPath = path.join(__dirname, 'data', 'summit-data.backup.json');
        }
        if (fs.existsSync(presetPath)) {
          const raw = fs.readFileSync(presetPath, 'utf-8');
          const data = JSON.parse(raw);
          writeSummitData(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: `Plantilla ${preset} aplicada con éxito`, data }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Plantilla ${preset} no encontrada` }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/reset' && req.method === 'POST') {
    if (fs.existsSync(BACKUP_FILE)) {
      fs.copyFileSync(BACKUP_FILE, DATA_FILE);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Datos restaurados desde respaldo' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No existe archivo de respaldo' }));
    }
    return;
  }

  // Descarga empaquetada de todas las imágenes en ZIP
  if (pathname === '/api/download-assets-zip' && req.method === 'GET') {
    const exportDir = path.join(PUBLIC_DIR, 'export');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const zipPath = path.join(exportDir, 'summit-assets.zip');

    import('node:child_process').then(({ exec }) => {
      exec(`cd "${UPLOADS_DIR}" && zip -r "${zipPath}" ./*`, (err) => {
        if (err || !fs.existsSync(zipPath)) {
          console.error('Error generating ZIP:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No se pudo generar el archivo ZIP de imágenes' }));
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="summit-assets.zip"'
        });
        fs.createReadStream(zipPath).pipe(res);
      });
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Static File Serving
  if (pathname === '/' || pathname === '/index.html') {
    pathname = '/index.html';
  } else if (pathname === '/admin' || pathname === '/admin/') {
    pathname = '/admin.html';
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // Fallback checks
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>404 Not Found</h1><p>Ruta no encontrada: ${pathname}</p>`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 CMS Summit iniciado exitosamente!`);
  console.log(`🌐 Landing Page Pública:  http://localhost:${PORT}/`);
  console.log(`⚙️ Panel de Control CMS: http://localhost:${PORT}/admin`);
  console.log(`===============================================`);
});
