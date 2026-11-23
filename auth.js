import crypto from 'node:crypto';
import { supabase } from './lib/supabase.js';

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

// Los usuarios y sesiones viven en Supabase; estas cachés en memoria mantienen
// las verificaciones síncronas y rápidas. Toda escritura va primero a la base.
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

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role, createdAt: u.createdAt };
}

// ---------- Conversión entre la base de datos y el formato interno ----------
const desdeBD = (r) => ({
  id: r.id,
  username: r.username,
  name: r.nombre,
  role: r.rol,
  salt: r.salt,
  iterations: r.iterations,
  passwordHash: r.password_hash,
  createdAt: r.creado_en,
});

const haciaBD = (u) => ({
  id: u.id,
  username: u.username,
  nombre: u.name,
  rol: u.role,
  salt: u.salt,
  iterations: u.iterations,
  password_hash: u.passwordHash,
  creado_en: u.createdAt,
});

// Escrituras que no deben frenar la respuesta (sesiones, re-hash); los errores se registran.
function enSegundoPlano(operacion, contexto) {
  Promise.resolve(operacion)
    .then((r) => { if (r && r.error) console.error(`[auth] ${contexto}:`, r.error.message); })
    .catch((e) => console.error(`[auth] ${contexto}:`, e.message));
}

function guardarSesionBD(key, s) {
  enSegundoPlano(supabase.from('sesiones').upsert({
    token_hash: key,
    usuario_id: s.userId,
    creado_ms: s.createdAt,
    ultimo_uso_ms: s.lastSeen,
    expira_ms: s.expiresAt,
  }), 'guardar sesión');
}

function borrarSesionBD(key) {
  enSegundoPlano(supabase.from('sesiones').delete().eq('token_hash', key), 'borrar sesión');
}

function limpiarSesionesVencidas() {
  const now = Date.now();
  for (const [key, s] of sessionsCache.entries()) {
    if (s.expiresAt <= now || now - s.lastSeen > SESSION_IDLE_MS) sessionsCache.delete(key);
  }
  enSegundoPlano(
    supabase.from('sesiones').delete().or(`expira_ms.lt.${now},ultimo_uso_ms.lt.${now - SESSION_IDLE_MS}`),
    'limpiar sesiones'
  );
}

async function guardarPassword(user, newPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(newPassword, salt);
  const { error } = await supabase
    .from('usuarios')
    .update({ salt, iterations: PBKDF2_ITERATIONS, password_hash: passwordHash })
    .eq('id', user.id);
  if (error) throw new Error('No se pudo guardar la contraseña. Intenta de nuevo.');
  user.salt = salt;
  user.iterations = PBKDF2_ITERATIONS;
  user.passwordHash = passwordHash;
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
// Inicialización (ahora asíncrona: lee de Supabase)
// ==========================================
export async function initAuth() {
  DUMMY_HASH = hashPassword('dummy-password', DUMMY_SALT);

  const { data: filas, error } = await supabase.from('usuarios').select('*');
  if (error) {
    console.error('❌ No se pudieron leer los usuarios de la base de datos.', error);
    process.exit(1);
  }
  usersCache = filas.map(desdeBD);

  // Elimina cuentas que aún usan las contraseñas de demostración de la versión anterior
  const DEMO_PASSWORDS = ['Admin@Summit2026!', 'Editor@Summit2026!'];
  const demo = usersCache.filter(u => DEMO_PASSWORDS.some(pw =>
    safeEqualHex(hashPassword(pw, u.salt, u.iterations || 100000), u.passwordHash)
  ));
  if (demo.length) {
    const { error: e } = await supabase.from('usuarios').delete().in('id', demo.map(u => u.id));
    if (e) console.error('No se pudieron eliminar las cuentas de demostración:', e.message);
    else {
      usersCache = usersCache.filter(u => !demo.includes(u));
      console.warn(`⚠️  Se eliminaron ${demo.length} cuenta(s) con contraseñas de demostración.`);
    }
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
    const admin = {
      id: `usr_${crypto.randomUUID()}`,
      username,
      name: process.env.ADMIN_NAME || 'Administrador Principal',
      role: 'admin',
      salt,
      iterations: PBKDF2_ITERATIONS,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString()
    };
    const { error: e } = await supabase.from('usuarios').insert(haciaBD(admin));
    if (e) {
      console.error('❌ No se pudo crear el administrador inicial.', e);
      process.exit(1);
    }
    usersCache.push(admin);

    console.log('===============================================');
    console.log(`👑 Administrador inicial creado: ${username}`);
    if (generated) {
      console.log(`🔑 Contraseña generada (solo se muestra esta vez): ${password}`);
      console.log('   Cámbiala al entrar o define ADMIN_PASSWORD en el entorno.');
    }
    console.log('===============================================');
  }

  // Sesiones vigentes (sobreviven a los redeploys de Render)
  const now = Date.now();
  const { data: sesiones, error: e2 } = await supabase.from('sesiones').select('*').gt('expira_ms', now);
  if (e2) {
    console.error('Error al cargar sesiones:', e2.message);
  } else {
    for (const s of sesiones) {
      const lastSeen = Number(s.ultimo_uso_ms);
      if (now - lastSeen < SESSION_IDLE_MS) {
        sessionsCache.set(s.token_hash, {
          userId: s.usuario_id,
          createdAt: Number(s.creado_ms),
          lastSeen,
          expiresAt: Number(s.expira_ms)
        });
      }
    }
  }
  limpiarSesionesVencidas();
  setInterval(limpiarSesionesVencidas, 60 * 60 * 1000).unref();
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
    enSegundoPlano(
      supabase.from('usuarios')
        .update({ salt: user.salt, iterations: user.iterations, password_hash: user.passwordHash })
        .eq('id', user.id),
      're-hash de contraseña'
    );
  }
  return publicUser(user);
}

export function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const key = hashToken(token);
  const s = { userId: user.id, createdAt: now, lastSeen: now, expiresAt: now + SESSION_ABSOLUTE_MS };
  sessionsCache.set(key, s);
  guardarSesionBD(key, s);
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
    borrarSesionBD(key);
    return null;
  }

  const user = usersCache.find(u => u.id === s.userId);
  if (!user) {
    sessionsCache.delete(key);
    borrarSesionBD(key);
    return null;
  }

  // Ventana deslizante; se persiste como máximo una vez por minuto
  if (now - s.lastSeen > 60 * 1000) {
    s.lastSeen = now;
    enSegundoPlano(
      supabase.from('sesiones').update({ ultimo_uso_ms: now }).eq('token_hash', key),
      'actualizar sesión'
    );
  }
  return publicUser(user);
}

export function destroySession(token) {
  if (!token) return;
  const key = hashToken(token);
  sessionsCache.delete(key);
  borrarSesionBD(key);
}

function destroySessionsForUser(userId, exceptToken = null) {
  const exceptKey = exceptToken ? hashToken(exceptToken) : null;
  for (const [key, s] of sessionsCache.entries()) {
    if (s.userId === userId && key !== exceptKey) sessionsCache.delete(key);
  }
  let q = supabase.from('sesiones').delete().eq('usuario_id', userId);
  if (exceptKey) q = q.neq('token_hash', exceptKey);
  enSegundoPlano(q, 'cerrar sesiones del usuario');
}

// ==========================================
// Gestión de usuarios (solo admin) — ahora asíncrona
// ==========================================
export function getUsersList() {
  return usersCache.map(publicUser);
}

export async function createUser({ username, name, password, role }) {
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

  const { error } = await supabase.from('usuarios').insert(haciaBD(newUser));
  if (error) {
    if (error.code === '23505') throw new Error('El nombre de usuario ya está registrado');
    console.error('[auth] crear usuario:', error.message);
    throw new Error('No se pudo guardar el usuario. Intenta de nuevo.');
  }
  usersCache.push(newUser);
  return publicUser(newUser);
}

export async function deleteUser(userId, currentUserId) {
  if (userId === currentUserId) throw new Error('No puedes eliminar tu propia cuenta activa');
  const index = usersCache.findIndex(u => u.id === userId);
  if (index === -1) throw new Error('Usuario no encontrado');

  const target = usersCache[index];
  if (target.role === 'admin' && usersCache.filter(u => u.role === 'admin').length <= 1) {
    throw new Error('Debe existir al menos un Administrador');
  }

  // Sus sesiones se borran en cascada; sus versiones y tareas quedan sin autor
  const { error } = await supabase.from('usuarios').delete().eq('id', userId);
  if (error) {
    console.error('[auth] eliminar usuario:', error.message);
    throw new Error('No se pudo eliminar el usuario. Intenta de nuevo.');
  }
  destroySessionsForUser(userId);
  usersCache.splice(usersCache.indexOf(target), 1);
  return true;
}

export async function adminResetPassword(userId, newPassword) {
  const user = usersCache.find(u => u.id === userId);
  if (!user) throw new Error('Usuario no encontrado');
  validatePasswordStrength(newPassword);
  await guardarPassword(user, newPassword);
  destroySessionsForUser(userId); // cierra sus sesiones abiertas
  return true;
}

export async function changePassword(userId, oldPassword, newPassword, currentToken) {
  const user = usersCache.find(u => u.id === userId);
  if (!user) throw new Error('Usuario no encontrado');

  const ok = safeEqualHex(hashPassword(oldPassword || '', user.salt, user.iterations || 100000), user.passwordHash);
  if (!ok) throw new Error('La contraseña actual es incorrecta');
  if (oldPassword === newPassword) throw new Error('La nueva contraseña debe ser distinta de la actual');
  validatePasswordStrength(newPassword);

  await guardarPassword(user, newPassword);
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
