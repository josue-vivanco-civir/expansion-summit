// Eventos (una landing por summit), versiones, publicación por URL, equipo, tareas y papelera.
// Todo se guarda en DATA_DIR:
//   eventos.json                     índice de eventos, tareas, equipo y actividad
//   versiones/<eventoId>/<n>.json    contenido de cada versión guardada
//   uploads/                         imágenes subidas (se sirven en /uploads/)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { httpError } from './errores.js';
import { leerJson, escribirJson, borrarCarpeta } from './almacen.js';

export const DIAS_PAPELERA = Number(process.env.DIAS_PAPELERA || 30);
const MAX_VERSIONES = Number(process.env.MAX_VERSIONES || 200);
const MAX_ACTIVIDAD = 3000;
const SOLO_ADMIN_PUBLICA = process.env.SOLO_ADMIN_PUBLICA === 'true';

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esId = (v) => typeof v === 'string' && ID_RE.test(v);

// URL de publicación: summit.expansion.mx/<ruta>
export const RUTA_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RUTAS_RESERVADAS = new Set([
  'admin', 'login', 'logout', 'eventos', 'api', 'uploads', 'css', 'js', 'img', 'images', 'imagenes',
  'fonts', 'assets', 'static', 'vista-previa', 'preview', 'index', 'robots', 'favicon', 'sitemap',
]);

const ESTADOS = ['borrador', 'en_revision', 'archivado']; // "publicado" depende de la publicación, no se elige
const ESTADOS_TAREA = ['pendiente', 'en_progreso', 'listo'];
const REF_UPLOADS = /\/uploads\/([A-Za-z0-9._-]+)/g;

let ARCHIVO = '';
let DIR_VERSIONES = '';
let DIR_UPLOADS = '';
let DIR_UPLOADS_LEGADO = '';
let nombresDeUsuarios = () => [];
let db = { eventos: [], actividad: [] };

const ahora = () => new Date().toISOString();
const guardar = () => escribirJson(ARCHIVO, db, { legible: true });

function nombreDe(usuarioId) {
  if (!usuarioId) return null;
  const u = nombresDeUsuarios().find((x) => x.id === usuarioId);
  return u ? u.name : 'Usuario eliminado';
}

function slugify(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60);
}

function rutaOcupada(ruta, excluirId) {
  return RUTAS_RESERVADAS.has(ruta)
    || db.eventos.some((e) => e.id !== excluirId && !e.eliminadoEn && e.ruta === ruta);
}

function rutaLibre(base, excluirId) {
  const inicio = base && base.length >= 2 ? base : 'summit';
  let ruta = inicio;
  for (let i = 2; rutaOcupada(ruta, excluirId); i++) ruta = `${inicio}-${i}`;
  return ruta;
}

function registrarActividad(eventoId, usuarioId, accion, detalle = {}) {
  db.actividad.push({ id: crypto.randomUUID(), eventoId, usuarioId: usuarioId || null, accion, detalle, creadoEn: ahora() });
  if (db.actividad.length > MAX_ACTIVIDAD) db.actividad.splice(0, db.actividad.length - MAX_ACTIVIDAD);
}

function buscar(eventoId) {
  const e = esId(eventoId) ? db.eventos.find((x) => x.id === eventoId) : null;
  if (!e) throw httpError(404, 'Evento no encontrado');
  return e;
}

function buscarActivo(eventoId) {
  const e = buscar(eventoId);
  if (e.eliminadoEn) throw httpError(404, 'El evento está en la papelera');
  return e;
}

const archivoVersion = (eventoId, numero) => path.join(DIR_VERSIONES, eventoId, `${numero}.json`);

function leerVersion(eventoId, numero) {
  const contenido = leerJson(archivoVersion(eventoId, numero));
  if (!contenido) throw httpError(404, `No se encontró la versión ${numero}`);
  return contenido;
}

function referencias(contenido) {
  const texto = typeof contenido === 'string' ? contenido : JSON.stringify(contenido || {});
  return new Set([...texto.matchAll(REF_UPLOADS)].map((m) => m[1]));
}

// ---------- Inicio y migración ----------

export function initEventos({ dataDir, uploadsDir, uploadsLegadoDir, listarUsuarios }) {
  ARCHIVO = path.join(dataDir, 'eventos.json');
  DIR_VERSIONES = path.join(dataDir, 'versiones');
  DIR_UPLOADS = uploadsDir;
  DIR_UPLOADS_LEGADO = uploadsLegadoDir;
  nombresDeUsuarios = listarUsuarios;
  fs.mkdirSync(DIR_VERSIONES, { recursive: true });
  fs.mkdirSync(DIR_UPLOADS, { recursive: true });

  const guardado = leerJson(ARCHIVO);
  if (guardado) {
    db = { eventos: guardado.eventos || [], actividad: guardado.actividad || [] };
    return;
  }

  // Primer arranque: la landing actual (summit-data.json) se convierte en el primer evento,
  // publicada en la raíz del dominio para que el sitio siga igual.
  const anterior = leerJson(path.join(dataDir, 'summit-data.json'));
  guardar();
  if (!anterior) return;

  const admin = listarUsuarios().find((u) => u.role === 'admin');
  const nombre = process.env.EVENTO_INICIAL || anterior?.appearance?.eventTitle || 'Summit';
  const evento = crearEvento({ nombre, usuarioId: admin?.id, contenidoInicial: anterior, nota: 'Migrado desde summit-data.json' });
  evento.esPrincipal = true;
  for (const archivo of referencias(anterior)) {
    evento.assets.push({ archivo, nombreOriginal: archivo, bytes: null, subidoPor: null, creadoEn: ahora() });
  }
  publicar({ eventoId: evento.id, numero: 1, usuario: admin || { role: 'admin' } });
  console.log(`📦 La landing actual se migró como “${nombre}”, publicada en / y en /${evento.ruta}`);
}

// ---------- Lectura para el tablero ----------

function etapa(e) {
  if (e.estado === 'archivado') return 'archivado';
  if (e.versionPublicada) return 'publicado';
  return e.estado;
}

function visiblePublicamente(e) {
  return !e.eliminadoEn && e.estado !== 'archivado' && Boolean(e.versionPublicada);
}

function resumen(e) {
  const ultima = e.versiones[e.versiones.length - 1];
  const visible = visiblePublicamente(e);
  return {
    id: e.id,
    nombre: e.nombre,
    ruta: e.ruta,
    esPrincipal: e.esPrincipal,
    fechaEvento: e.fechaEvento,
    estado: e.estado,
    etapa: etapa(e),
    creadoEn: e.creadoEn,
    actualizadoEn: e.actualizadoEn,
    eliminadoEn: e.eliminadoEn,
    versionActual: e.versionActual || null,
    versionPublicada: e.versionPublicada,
    publicadoEn: e.publicadoEn,
    publicadoPor: nombreDe(e.publicadoPor),
    cambiosSinPublicar: Boolean(e.versionActual) && e.versionActual !== e.versionPublicada,
    ultimaEdicion: ultima?.creadoEn || null,
    ultimoEditor: ultima ? nombreDe(ultima.autorId) : null,
    tareasPendientes: e.tareas.filter((t) => t.estado !== 'listo').length,
    miembros: e.miembros.length,
    urlsPublicas: visible ? [...(e.esPrincipal ? ['/'] : []), `/${e.ruta}`] : [],
  };
}

export function listarEventos({ papelera = false } = {}) {
  return db.eventos
    .filter((e) => (papelera ? e.eliminadoEn : !e.eliminadoEn))
    .sort((a, b) => String(b.actualizadoEn).localeCompare(String(a.actualizadoEn)))
    .map(resumen);
}

export function obtenerEvento(eventoId) {
  const e = buscar(eventoId);
  return {
    ...resumen(e),
    miembros: e.miembros.map((m) => ({ ...m, nombre: nombreDe(m.usuarioId) })),
    tareas: e.tareas.map((t) => ({ ...t, asignadoNombre: nombreDe(t.asignadoA) })),
    actividad: db.actividad
      .filter((a) => a.eventoId === e.id).slice(-30).reverse()
      .map((a) => ({ ...a, usuarioNombre: nombreDe(a.usuarioId) })),
  };
}

// ---------- Qué evento usa el editor ----------
// ?evento=<id> es estricto; la cookie del editor es orientativa; sin nada, el último editado.
export function resolverEventoId(candidato, { estricto = false } = {}) {
  if (candidato) {
    const e = esId(candidato) && db.eventos.find((x) => x.id === candidato && !x.eliminadoEn);
    if (e) return e.id;
    if (estricto) throw httpError(404, 'El evento no existe o está en la papelera');
  }
  const ultimo = listarEventos()[0];
  if (!ultimo) throw httpError(404, 'Aún no hay eventos. Crea el primero en /eventos');
  return ultimo.id;
}

export function obtenerContenidoActual(eventoId) {
  const e = buscar(eventoId);
  if (!e.versionActual) throw httpError(404, 'Este evento aún no tiene contenido guardado');
  return { eventoId: e.id, nombre: e.nombre, numero: e.versionActual, contenido: leerVersion(e.id, e.versionActual) };
}

export function obtenerContenido(eventoId, numero) {
  const e = buscar(eventoId);
  const n = Number(numero) || e.versionActual;
  if (!n) throw httpError(404, 'Este evento aún no tiene contenido guardado');
  return { evento: resumen(e), numero: n, contenido: leerVersion(e.id, n) };
}

// ---------- Landing pública ----------

export function eventoPublicoPorRuta(pathname) {
  const visibles = db.eventos.filter(visiblePublicamente);
  if (pathname === '/') return visibles.find((e) => e.esPrincipal) || null;
  const ruta = pathname.replace(/^\/+|\/+$/g, '');
  return visibles.find((e) => e.ruta === ruta) || null;
}

export function eventoPublicoPorId(eventoId) {
  const e = esId(eventoId) && db.eventos.find((x) => x.id === eventoId);
  return e && visiblePublicamente(e) ? e : null;
}

export function contenidoPublicado(e) {
  return leerVersion(e.id, e.versionPublicada);
}

// ---------- Crear y editar ----------

export function crearEvento({ nombre, fechaEvento, usuarioId, contenidoInicial, nota, copiarDe }) {
  const limpio = String(nombre || '').trim().slice(0, 120);
  if (!limpio) throw httpError(400, 'Escribe el nombre del evento');

  const e = {
    id: crypto.randomUUID(),
    nombre: limpio,
    ruta: rutaLibre(slugify(limpio)),
    esPrincipal: false,
    fechaEvento: fechaEvento || null,
    estado: 'borrador',
    creadoPor: usuarioId || null,
    creadoEn: ahora(),
    actualizadoEn: ahora(),
    eliminadoEn: null,
    eliminadoPor: null,
    versionActual: 0,
    versionPublicada: null,
    publicadoEn: null,
    publicadoPor: null,
    versiones: [],
    miembros: usuarioId ? [{ usuarioId, rol: 'responsable' }] : [],
    tareas: [],
    // La copia comparte las imágenes del original; se registran para no borrarlas por error
    assets: copiarDe ? buscar(copiarDe).assets.map((a) => ({ ...a })) : [],
  };
  db.eventos.push(e);
  registrarActividad(e.id, usuarioId, 'creo_evento', { nombre: e.nombre });

  if (contenidoInicial !== undefined) {
    guardarVersion({ eventoId: e.id, contenido: contenidoInicial || {}, nota: nota || 'Versión inicial', usuarioId, forzar: true });
  } else {
    guardar();
  }
  return e;
}

export function actualizarEvento(eventoId, cambios, usuarioId) {
  const e = buscarActivo(eventoId);
  const hechos = {};

  if (cambios.nombre !== undefined) {
    const nombre = String(cambios.nombre).trim().slice(0, 120);
    if (!nombre) throw httpError(400, 'El nombre no puede quedar vacío');
    e.nombre = hechos.nombre = nombre;
  }
  if (cambios.fechaEvento !== undefined) e.fechaEvento = hechos.fechaEvento = cambios.fechaEvento || null;
  if (cambios.estado !== undefined) {
    if (!ESTADOS.includes(cambios.estado)) throw httpError(400, 'Estado no válido');
    e.estado = hechos.estado = cambios.estado;
  }
  if (cambios.ruta !== undefined) {
    const ruta = String(cambios.ruta).trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    if (ruta.length < 2 || ruta.length > 60 || !RUTA_RE.test(ruta)) {
      throw httpError(400, 'La URL solo puede llevar minúsculas, números y guiones (2 a 60 caracteres), por ejemplo mujeres-2026');
    }
    if (RUTAS_RESERVADAS.has(ruta)) throw httpError(400, `“${ruta}” está reservada por el CMS; elige otra`);
    if (rutaOcupada(ruta, e.id)) throw httpError(409, `La URL /${ruta} ya la usa otro evento`);
    e.ruta = hechos.ruta = ruta;
  }
  if (cambios.esPrincipal !== undefined) {
    const principal = Boolean(cambios.esPrincipal);
    if (principal) for (const otro of db.eventos) otro.esPrincipal = false;
    e.esPrincipal = hechos.esPrincipal = principal;
  }

  e.actualizadoEn = ahora();
  registrarActividad(e.id, usuarioId, 'actualizo_evento', hechos);
  guardar();
  return resumen(e);
}

// ---------- Versiones ----------

export function guardarVersion({ eventoId, versionBase, contenido, nota, usuarioId, forzar = false }) {
  const e = buscarActivo(eventoId);
  if (!contenido || typeof contenido !== 'object' || Array.isArray(contenido)) {
    throw httpError(400, 'Falta el contenido de la landing');
  }

  const ultimo = e.versionActual || 0;
  if (!forzar && ultimo > (Number(versionBase) || 0)) {
    const meta = e.versiones.find((v) => v.numero === ultimo);
    const autor = nombreDe(meta?.autorId) || 'Otra persona';
    throw httpError(409, `${autor} guardó la versión ${ultimo} mientras editabas`, {
      conflicto: true, version_actual: ultimo, autor, fecha: meta?.creadoEn || null,
    });
  }

  const numero = ultimo + 1;
  const texto = JSON.stringify(contenido);
  fs.mkdirSync(path.join(DIR_VERSIONES, e.id), { recursive: true });
  escribirJson(archivoVersion(e.id, numero), contenido);

  e.versiones.push({
    numero,
    nota: nota ? String(nota).slice(0, 300) : null,
    autorId: usuarioId || null,
    creadoEn: ahora(),
    bytes: Buffer.byteLength(texto),
  });
  e.versionActual = numero;
  e.actualizadoEn = ahora();
  podarVersiones(e);
  registrarActividad(e.id, usuarioId, 'guardo_version', { numero, nota: nota || null });
  guardar();
  return { numero, eventoId: e.id };
}

// Conserva las últimas MAX_VERSIONES, sin tocar nunca la publicada ni la actual
function podarVersiones(e) {
  while (e.versiones.length > MAX_VERSIONES) {
    const i = e.versiones.findIndex((v) => v.numero !== e.versionPublicada && v.numero !== e.versionActual);
    if (i < 0) break;
    const [vieja] = e.versiones.splice(i, 1);
    fs.rm(archivoVersion(e.id, vieja.numero), { force: true }, () => {});
  }
}

export function listarVersiones(eventoId) {
  const e = buscar(eventoId);
  return [...e.versiones].reverse().map((v) => ({
    numero: v.numero,
    nota: v.nota,
    autor: nombreDe(v.autorId),
    creadoEn: v.creadoEn,
    actual: v.numero === e.versionActual,
    publicada: v.numero === e.versionPublicada,
  }));
}

export function restaurarVersion({ eventoId, numero, usuarioId }) {
  const contenido = leerVersion(buscarActivo(eventoId).id, numero);
  return guardarVersion({ eventoId, contenido, nota: `Restaurada desde la versión ${numero}`, usuarioId, forzar: true });
}

export function restaurarAnterior({ eventoId, usuarioId }) {
  const e = buscarActivo(eventoId);
  const anteriores = e.versiones.filter((v) => v.numero < e.versionActual);
  if (!anteriores.length) throw httpError(404, 'No hay una versión anterior a la que volver');
  return restaurarVersion({ eventoId, numero: anteriores[anteriores.length - 1].numero, usuarioId });
}

// ---------- Publicación ----------

export function publicar({ eventoId, numero, usuario }) {
  if (SOLO_ADMIN_PUBLICA && usuario.role !== 'admin') throw httpError(403, 'Solo un administrador puede publicar');
  const e = buscarActivo(eventoId);
  const n = Number(numero) || e.versionActual;
  if (!n || !e.versiones.some((v) => v.numero === n)) throw httpError(404, 'Esa versión no existe');
  if (e.estado === 'archivado') throw httpError(409, 'El evento está archivado; cámbialo a Borrador o En revisión para publicarlo');

  e.versionPublicada = n;
  e.publicadoEn = ahora();
  e.publicadoPor = usuario.id || null;
  e.actualizadoEn = ahora();
  registrarActividad(e.id, usuario.id, 'publico_version', { numero: n });
  guardar();
  return resumen(e);
}

export function despublicar({ eventoId, usuario }) {
  if (SOLO_ADMIN_PUBLICA && usuario.role !== 'admin') throw httpError(403, 'Solo un administrador puede despublicar');
  const e = buscarActivo(eventoId);
  if (!e.versionPublicada) throw httpError(409, 'El evento no está publicado');
  e.versionPublicada = null;
  e.publicadoEn = null;
  e.publicadoPor = null;
  e.actualizadoEn = ahora();
  registrarActividad(e.id, usuario.id, 'despublico', {});
  guardar();
  return resumen(e);
}

// ---------- Imágenes ----------

export function registrarAsset(eventoId, { archivo, nombreOriginal, bytes, usuarioId }) {
  const e = buscarActivo(eventoId);
  e.assets.push({ archivo, nombreOriginal, bytes, subidoPor: usuarioId || null, creadoEn: ahora() });
  guardar();
}

function rutaDeUpload(archivo) {
  for (const dir of [DIR_UPLOADS, DIR_UPLOADS_LEGADO]) {
    const p = path.join(dir, path.basename(archivo));
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Imágenes del evento: las que se subieron en él y las que usa su contenido actual o publicado
export function archivosDelEvento(eventoId) {
  const e = buscar(eventoId);
  const nombres = new Set(e.assets.map((a) => a.archivo));
  for (const n of [e.versionActual, e.versionPublicada]) {
    if (!n) continue;
    try { for (const r of referencias(leerVersion(e.id, n))) nombres.add(r); } catch {}
  }
  return [...nombres].map((nombre) => ({ nombre, ruta: rutaDeUpload(nombre) })).filter((a) => a.ruta);
}

// ---------- Equipo y tareas ----------

export function agregarMiembro({ eventoId, usuarioId, rol = 'editor', agregadoPor }) {
  const e = buscarActivo(eventoId);
  if (!nombresDeUsuarios().some((u) => u.id === usuarioId)) throw httpError(404, 'Usuario no encontrado');
  const existente = e.miembros.find((m) => m.usuarioId === usuarioId);
  if (existente) existente.rol = String(rol).slice(0, 30);
  else e.miembros.push({ usuarioId, rol: String(rol).slice(0, 30) });
  registrarActividad(e.id, agregadoPor, 'agrego_miembro', { usuarioId });
  guardar();
}

export function quitarMiembro({ eventoId, usuarioId, quitadoPor }) {
  const e = buscarActivo(eventoId);
  e.miembros = e.miembros.filter((m) => m.usuarioId !== usuarioId);
  registrarActividad(e.id, quitadoPor, 'quito_miembro', { usuarioId });
  guardar();
}

export function crearTarea({ eventoId, titulo, seccion, asignadoA, usuarioId }) {
  const e = buscarActivo(eventoId);
  const t = String(titulo || '').trim().slice(0, 200);
  if (!t) throw httpError(400, 'Escribe qué hay que hacer');
  const tarea = {
    id: crypto.randomUUID(),
    titulo: t,
    seccion: seccion ? String(seccion).trim().slice(0, 60) : null,
    asignadoA: asignadoA || null,
    estado: 'pendiente',
    creadoEn: ahora(),
  };
  e.tareas.push(tarea);
  registrarActividad(e.id, usuarioId, 'creo_tarea', { titulo: tarea.titulo });
  guardar();
  return tarea;
}

function buscarTarea(tareaId) {
  for (const e of db.eventos) {
    const t = e.tareas.find((x) => x.id === tareaId);
    if (t) return { e, t };
  }
  throw httpError(404, 'Tarea no encontrada');
}

export function actualizarTarea(tareaId, cambios, usuarioId) {
  const { e, t } = buscarTarea(tareaId);
  if (cambios.titulo !== undefined) {
    const titulo = String(cambios.titulo).trim().slice(0, 200);
    if (titulo) t.titulo = titulo;
  }
  if (cambios.seccion !== undefined) t.seccion = cambios.seccion ? String(cambios.seccion).trim().slice(0, 60) : null;
  if (cambios.asignadoA !== undefined) t.asignadoA = cambios.asignadoA || null;
  if (cambios.estado !== undefined) {
    if (!ESTADOS_TAREA.includes(cambios.estado)) throw httpError(400, 'Estado de tarea no válido');
    t.estado = cambios.estado;
    if (t.estado === 'listo') registrarActividad(e.id, usuarioId, 'completo_tarea', { titulo: t.titulo });
  }
  guardar();
  return { ...t, asignadoNombre: nombreDe(t.asignadoA) };
}

export function eliminarTarea(tareaId) {
  const { e, t } = buscarTarea(tareaId);
  e.tareas = e.tareas.filter((x) => x !== t);
  guardar();
}

// ---------- Papelera ----------

export function resumenParaEliminar(eventoId) {
  const e = buscar(eventoId);
  return {
    id: e.id,
    nombre: e.nombre,
    versiones: e.versiones.length,
    imagenes: archivosDelEvento(e.id).length,
    tareasPendientes: e.tareas.filter((t) => t.estado !== 'listo').length,
    publicado: visiblePublicamente(e),
    esPrincipal: e.esPrincipal,
    urlsPublicas: resumen(e).urlsPublicas,
    enPapelera: Boolean(e.eliminadoEn),
    diasPapelera: DIAS_PAPELERA,
  };
}

export function moverAPapelera({ eventoId, usuarioId }) {
  const e = buscarActivo(eventoId);
  e.eliminadoEn = ahora();
  e.eliminadoPor = usuarioId || null;
  e.esPrincipal = false; // la raíz del dominio no puede apuntar a la papelera
  registrarActividad(e.id, usuarioId, 'movio_a_papelera', { nombre: e.nombre });
  guardar();
  return { id: e.id, nombre: e.nombre };
}

export function restaurarDePapelera({ eventoId, usuarioId }) {
  const e = buscar(eventoId);
  if (!e.eliminadoEn) throw httpError(404, 'El evento no está en la papelera');
  e.eliminadoEn = null;
  e.eliminadoPor = null;
  if (rutaOcupada(e.ruta, e.id)) e.ruta = rutaLibre(e.ruta, e.id);
  e.actualizadoEn = ahora();
  registrarActividad(e.id, usuarioId, 'restauro_de_papelera', { nombre: e.nombre });
  guardar();
  return { id: e.id, nombre: e.nombre, ruta: e.ruta };
}

function borrarDefinitivamente(e) {
  const propias = archivosDelEvento(e.id).map((a) => a.nombre);
  db.eventos = db.eventos.filter((x) => x !== e);
  db.actividad = db.actividad.filter((a) => a.eventoId !== e.id);

  // Solo se borran imágenes que ningún otro evento usa, y nunca las del repositorio
  const enUso = new Set();
  for (const otro of db.eventos) for (const a of archivosDelEvento(otro.id)) enUso.add(a.nombre);
  let borradas = 0;
  for (const nombre of propias) {
    if (enUso.has(nombre)) continue;
    const p = path.join(DIR_UPLOADS, path.basename(nombre));
    if (fs.existsSync(p)) { fs.rmSync(p, { force: true }); borradas++; }
  }
  borrarCarpeta(path.join(DIR_VERSIONES, e.id));
  guardar();
  return borradas;
}

export function eliminarDefinitivo({ eventoId, confirmacion, usuario }) {
  if (usuario.role !== 'admin') throw httpError(403, 'Solo un administrador puede eliminar definitivamente');
  const e = buscar(eventoId);
  if (!e.eliminadoEn) throw httpError(409, 'Primero mueve el evento a la papelera');
  if (String(confirmacion || '').trim() !== e.nombre) throw httpError(400, 'El nombre escrito no coincide con el del evento');
  const imagenesBorradas = borrarDefinitivamente(e);
  console.log(`[eventos] ${usuario.username} eliminó definitivamente “${e.nombre}” (${imagenesBorradas} imágenes)`);
  return { eliminado: true, imagenesBorradas };
}

export function purgarPapelera(dias = DIAS_PAPELERA) {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  const vencidos = db.eventos.filter((e) => e.eliminadoEn && Date.parse(e.eliminadoEn) < limite);
  for (const e of vencidos) {
    borrarDefinitivamente(e);
    console.log(`[papelera] “${e.nombre}” se eliminó tras ${dias} días`);
  }
  return vencidos.length;
}
