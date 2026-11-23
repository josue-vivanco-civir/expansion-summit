import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ==========================================
// Configuración
// ==========================================
const SESSION_IDLE_MS = (Number(process.env.SESSION_IDLE_HOURS) || 8) * 60 * 60 * 1000;      // inactividad
const SESSION_ABSOLUTE_MS = (Number(process.env.SESSION_MAX_DAYS) || 7) * 24 * 60 * 60 * 1000; // máximo absoluto
const PBKDF2_ITERATIONS = 210000;
const MIN_PASSWORD_LENGTH = 10;
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

// Bloqueo por intentos fallidos
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export const SESSION_COOKIE = 'summit_session';

let USERS_FILE = '';
let SESSIONS_FILE = '';
let usersCache = [];
const sessionsCache = new Map(); // key: sha256(token)
const failedAttempts = new Map(); // key: "ip" o "user:<name>"

// Hash ficticio para que un usuario inexistente tarde lo mismo que uno real
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
let DUMMY_HASH = '';

function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  return crypto.pbkdf2Sync(String(password), salt, iterations, 64, 'sha512').toString('hex');
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role, createdAt: u.createdAt };
}

export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  if (password.length > 200) throw new Error('La contraseña es demasiado larga');
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(re => re.test(password)).length;
  if (classes < 3) {
    throw new Error('La contraseña debe combinar al menos 3 de: minúsculas, mayúsculas, números y símbolos');
  }
}

// ==========================================
// Inicialización
// ==========================================
export function initAuth(dataDir) {
  USERS_FILE = path.join(dataDir, 'users.json');
  SESSIONS_FILE = path.join(dataDir, 'sessions.json');
  DUMMY_HASH = hashPassword('dummy-password', DUMMY_SALT);

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(USERS_FILE)) {
    try {
      usersCache = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    } catch (e) {
      console.error('❌ No se pudo leer data/users.json. Revisa el archivo antes de continuar.', e);
      process.exit(1);
    }
  }

  // Elimina cuentas que aún usan las contraseñas de demostración de la versión anterior
  const DEMO_PASSWORDS = ['Admin@Summit2026!', 'Editor@Summit2026!'];
  const before = usersCache.length;
  usersCache = usersCache.filter(u => !DEMO_PASSWORDS.some(pw =>
    safeEqualHex(hashPassword(pw, u.salt, u.iterations || 100000), u.passwordHash)
  ));
  if (usersCache.length !== before) {
    writeJsonAtomic(USERS_FILE, usersCache);
    console.warn(`⚠️  Se eliminaron ${before - usersCache.length} cuenta(s) con contraseñas de demostración.`);
  }

  // Sin administradores → se crea el primero a partir de variables de entorno
  if (!usersCache.some(u => u.role === 'admin')) {
    const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    let password = process.env.ADMIN_PASSWORD || '';
    let generated = false;

    if (!password) {
      password = crypto.randomBytes(12).toString('base64url') + 'aA1!';
      generated = true;
    }
    validatePasswordStrength(password);

    const salt = crypto.randomBytes(16).toString('hex');
    usersCache.push({
      id: `usr_${crypto.randomUUID()}`,
      username,
      name: process.env.ADMIN_NAME || 'Administrador Principal',
      role: 'admin',
      salt,
      iterations: PBKDF2_ITERATIONS,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString()
    });
    writeJsonAtomic(USERS_FILE, usersCache);

    console.log('===============================================');
    console.log(`👑 Administrador inicial creado: ${username}`);
    if (generated) {
      console.log(`🔑 Contraseña generada (solo se muestra esta vez): ${password}`);
      console.log('   Cámbiala al entrar o define ADMIN_PASSWORD en el entorno.');
    }
    console.log('===============================================');
  }

  // Sesiones persistidas (solo se guardan hashes de los tokens)
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      const now = Date.now();
      for (const [key, s] of Object.entries(saved)) {
        // Descarta formatos antiguos (token en claro, sin lastSeen)
        if (key.length === 64 && s && s.lastSeen && s.expiresAt > now) sessionsCache.set(key, s);
      }
    } catch (e) {
      console.error('Error loading sessions.json:', e);
    }
  }
  persistSessions();
}

function persistSessions() {
  try {
    const now = Date.now();
    const obj = {};
    for (const [key, s] of sessionsCache.entries()) {
      if (s.expiresAt > now && now - s.lastSeen < SESSION_IDLE_MS) obj[key] = s;
      else sessionsCache.delete(key);
    }
    writeJsonAtomic(SESSIONS_FILE, obj);
  } catch (e) {
    console.error('Error persisting sessions:', e);
  }
}

function persistUsers() {
  writeJsonAtomic(USERS_FILE, usersCache);
}

// ==========================================
// Bloqueo por fuerza bruta
// ==========================================
function attemptKeyState(key) {
  const now = Date.now();
  let st = failedAttempts.get(key);
  if (!st || (now - st.first > ATTEMPT_WINDOW_MS && (!st.lockedUntil || st.lockedUntil < now))) {
    st = { count: 0, first: now, lockedUntil: 0 };
    failedAttempts.set(key, st);
  }
  return st;
}

export function getLockoutRemaining(ip, username) {
  const now = Date.now();
  const keys = [`ip:${ip}`, `user:${String(username || '').trim().toLowerCase()}`];
  let max = 0;
  for (const k of keys) {
    const st = failedAttempts.get(k);
    if (st && st.lockedUntil > now) max = Math.max(max, st.lockedUntil - now);
  }
  return max;
}

function registerFailure(ip, username) {
  for (const k of [`ip:${ip}`, `user:${String(username || '').trim().toLowerCase()}`]) {
    const st = attemptKeyState(k);
    st.count += 1;
    if (st.count >= MAX_FAILED_ATTEMPTS) st.lockedUntil = Date.now() + LOCKOUT_MS;
  }
}

function clearFailures(ip, username) {
  failedAttempts.delete(`ip:${ip}`);
  failedAttempts.delete(`user:${String(username || '').trim().toLowerCase()}`);
}

// Limpieza periódica de memoria
setInterval(() => {
  const now = Date.now();
  for (const [k, st] of failedAttempts.entries()) {
    if (now - st.first > ATTEMPT_WINDOW_MS && st.lockedUntil < now) failedAttempts.delete(k);
  }
}, 10 * 60 * 1000).unref();

// ==========================================
// Autenticación y sesiones
// ==========================================
export function authenticateUser(username, password, ip = 'unknown') {
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) return null;
  const clean = username.trim().toLowerCase();
  const user = usersCache.find(u => u.username === clean);

  if (!user) {
    hashPassword(password, DUMMY_SALT); // iguala el tiempo de respuesta
    safeEqualHex(DUMMY_HASH, DUMMY_HASH);
    registerFailure(ip, clean);
    return null;
  }

  const iterations = user.iterations || 100000; // usuarios creados con la versión anterior
  const ok = safeEqualHex(hashPassword(password, user.salt, iterations), user.passwordHash);
  if (!ok) {
    registerFailure(ip, clean);
    return null;
  }

  clearFailures(ip, clean);

  // Re-hash transparente si el usuario venía de la versión con menos iteraciones
  if (iterations !== PBKDF2_ITERATIONS) {
    user.salt = crypto.randomBytes(16).toString('hex');
    user.iterations = PBKDF2_ITERATIONS;
    user.passwordHash = hashPassword(password, user.salt);
    persistUsers();
  }
  return publicUser(user);
}

export function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessionsCache.set(hashToken(token), {
    userId: user.id,
    createdAt: now,
    lastSeen: now,
    expiresAt: now + SESSION_ABSOLUTE_MS
  });
  persistSessions();
  return token;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string' || token.length !== 64) return null;
  const key = hashToken(token);
  const s = sessionsCache.get(key);
  if (!s) return null;

  const now = Date.now();
  if (s.expiresAt <= now || now - s.lastSeen > SESSION_IDLE_MS) {
    sessionsCache.delete(key);
    persistSessions();
    return null;
  }

  const user = usersCache.find(u => u.id === s.userId);
  if (!user) {
    sessionsCache.delete(key);
    persistSessions();
    return null;
  }

  // Ventana deslizante; se persiste como máximo una vez por minuto
  if (now - s.lastSeen > 60 * 1000) {
    s.lastSeen = now;
    persistSessions();
  }
  return publicUser(user);
}

export function destroySession(token) {
  if (!token) return;
  sessionsCache.delete(hashToken(token));
  persistSessions();
}

function destroySessionsForUser(userId, exceptToken = null) {
  const exceptKey = exceptToken ? hashToken(exceptToken) : null;
  for (const [key, s] of sessionsCache.entries()) {
    if (s.userId === userId && key !== exceptKey) sessionsCache.delete(key);
  }
  persistSessions();
}

// ==========================================
// Gestión de usuarios (solo admin)
// ==========================================
export function getUsersList() {
  return usersCache.map(publicUser);
}

export function createUser({ username, name, password, role }) {
  const clean = String(username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(clean)) {
    throw new Error('El usuario debe tener 3–32 caracteres: letras minúsculas, números, punto, guion o guion bajo');
  }
  if (usersCache.some(u => u.username === clean)) {
    throw new Error('El nombre de usuario ya está registrado');
  }
  validatePasswordStrength(password);

  const salt = crypto.randomBytes(16).toString('hex');
  const newUser = {
    id: `usr_${crypto.randomUUID()}`,
    username: clean,
    name: String(name || clean).trim().slice(0, 80),
    role: role === 'admin' ? 'admin' : 'editor',
    salt,
    iterations: PBKDF2_ITERATIONS,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString()
  };
  usersCache.push(newUser);
  persistUsers();
  return publicUser(newUser);
}

export function deleteUser(userId, currentUserId) {
  if (userId === currentUserId) throw new Error('No puedes eliminar tu propia cuenta activa');
  const index = usersCache.findIndex(u => u.id === userId);
  if (index === -1) throw new Error('Usuario no encontrado');

  const target = usersCache[index];
  if (target.role === 'admin' && usersCache.filter(u => u.role === 'admin').length <= 1) {
    throw new Error('Debe existir al menos un Administrador');
  }

  destroySessionsForUser(userId);
  usersCache.splice(index, 1);
  persistUsers();
  return true;
}

export function adminResetPassword(userId, newPassword) {
  const user = usersCache.find(u => u.id === userId);
  if (!user) throw new Error('Usuario no encontrado');
  validatePasswordStrength(newPassword);
  user.salt = crypto.randomBytes(16).toString('hex');
  user.iterations = PBKDF2_ITERATIONS;
  user.passwordHash = hashPassword(newPassword, user.salt);
  persistUsers();
  destroySessionsForUser(userId); // cierra sus sesiones abiertas
  return true;
}

export function changePassword(userId, oldPassword, newPassword, currentToken) {
  const user = usersCache.find(u => u.id === userId);
  if (!user) throw new Error('Usuario no encontrado');

  const ok = safeEqualHex(hashPassword(oldPassword || '', user.salt, user.iterations || 100000), user.passwordHash);
  if (!ok) throw new Error('La contraseña actual es incorrecta');
  if (oldPassword === newPassword) throw new Error('La nueva contraseña debe ser distinta de la actual');
  validatePasswordStrength(newPassword);

  user.salt = crypto.randomBytes(16).toString('hex');
  user.iterations = PBKDF2_ITERATIONS;
  user.passwordHash = hashPassword(newPassword, user.salt);
  persistUsers();
  destroySessionsForUser(userId, currentToken); // cierra las demás sesiones
  return true;
}

// ==========================================
// Cookies
// ==========================================
export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    try {
      list[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      list[key] = part.slice(idx + 1).trim();
    }
  }
  return list;
}

export function getTokenFromRequest(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || null;
}

export function getSessionFromRequest(req) {
  return verifySession(getTokenFromRequest(req));
}

export function makeSessionCookie(token, secure) {
  const maxAge = Math.floor(SESSION_ABSOLUTE_MS / 1000);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function makeLogoutCookie(secure) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}
