// Rutas /api/eventos, /api/tareas y /api/equipo para el servidor http nativo.
import * as ev from './eventos.js';
import { httpError } from './errores.js';

export function esRutaEventos(pathname) {
  return pathname === '/api/equipo' || pathname === '/api/eventos'
    || pathname.startsWith('/api/eventos/') || pathname.startsWith('/api/tareas/');
}

function id(valor, mensaje = 'Evento no encontrado') {
  if (!ev.esId(valor)) throw httpError(404, mensaje);
  return valor;
}

export async function manejarApiEventos({ req, pathname, searchParams, usuario, leerJson, enviar, listarEquipo, cargarPlantilla }) {
  const metodo = req.method;
  const coincide = (re) => pathname.match(re);
  let r;

  try {
    if (pathname === '/api/equipo' && metodo === 'GET') return enviar(200, listarEquipo());

    if (pathname === '/api/eventos') {
      if (metodo === 'GET') return enviar(200, ev.listarEventos({ papelera: searchParams.get('papelera') === '1' }));
      if (metodo === 'POST') {
        const { nombre, fechaEvento, basadoEn } = await leerJson();
        let contenidoInicial = cargarPlantilla() ?? {};
        let nota = 'Versión inicial desde la plantilla';
        if (basadoEn) {
          const origen = ev.obtenerContenidoActual(id(basadoEn, 'El evento de origen no existe'));
          contenidoInicial = origen.contenido;
          nota = `Creado a partir de “${origen.nombre}”`;
        }
        const nuevo = ev.crearEvento({
          nombre, fechaEvento, usuarioId: usuario.id, contenidoInicial, nota, copiarDe: basadoEn || null,
        });
        return enviar(201, ev.obtenerEvento(nuevo.id));
      }
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)$/))) {
      const eventoId = id(r[1]);
      if (metodo === 'GET') return enviar(200, ev.obtenerEvento(eventoId));
      if (metodo === 'PATCH') return enviar(200, ev.actualizarEvento(eventoId, await leerJson(), usuario.id));
      if (metodo === 'DELETE') {
        const { confirmacion } = await leerJson();
        return enviar(200, ev.eliminarDefinitivo({ eventoId, confirmacion, usuario }));
      }
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/versiones$/)) && metodo === 'GET') {
      return enviar(200, ev.listarVersiones(id(r[1])));
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/versiones\/(\d+)\/restaurar$/)) && metodo === 'POST') {
      return enviar(200, ev.restaurarVersion({ eventoId: id(r[1]), numero: Number(r[2]), usuarioId: usuario.id }));
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/publicar$/)) && metodo === 'POST') {
      const { numero } = await leerJson();
      return enviar(200, ev.publicar({ eventoId: id(r[1]), numero, usuario }));
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/despublicar$/)) && metodo === 'POST') {
      return enviar(200, ev.despublicar({ eventoId: id(r[1]), usuario }));
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/assets$/)) && metodo === 'GET') {
      return enviar(200, ev.archivosDelEvento(id(r[1])).map((a) => ({ nombre: a.nombre, url: `/uploads/${a.nombre}` })));
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/miembros$/)) && metodo === 'POST') {
      const { usuarioId, rol } = await leerJson();
      ev.agregarMiembro({ eventoId: id(r[1]), usuarioId, rol, agregadoPor: usuario.id });
      return enviar(200, { success: true });
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/miembros\/([^/]+)$/)) && metodo === 'DELETE') {
      ev.quitarMiembro({ eventoId: id(r[1]), usuarioId: r[2], quitadoPor: usuario.id });
      return enviar(200, { success: true });
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/tareas$/)) && metodo === 'POST') {
      const { titulo, seccion, asignadoA } = await leerJson();
      return enviar(201, ev.crearTarea({ eventoId: id(r[1]), titulo, seccion, asignadoA, usuarioId: usuario.id }));
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/resumen-eliminacion$/)) && metodo === 'GET') {
      return enviar(200, ev.resumenParaEliminar(id(r[1])));
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/papelera$/)) && metodo === 'POST') {
      return enviar(200, ev.moverAPapelera({ eventoId: id(r[1]), usuarioId: usuario.id }));
    }

    if ((r = coincide(/^\/api\/eventos\/([^/]+)\/restaurar$/)) && metodo === 'POST') {
      return enviar(200, ev.restaurarDePapelera({ eventoId: id(r[1]), usuarioId: usuario.id }));
    }

    if ((r = coincide(/^\/api\/tareas\/([^/]+)$/))) {
      const tareaId = id(r[1], 'Tarea no encontrada');
      if (metodo === 'PATCH') return enviar(200, ev.actualizarTarea(tareaId, await leerJson(), usuario.id));
      if (metodo === 'DELETE') {
        ev.eliminarTarea(tareaId);
        return enviar(200, { success: true });
      }
    }

    return enviar(404, { error: 'Endpoint no encontrado' });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[eventos]', err);
    enviar(status, { error: status >= 500 ? 'Error interno del servidor' : err.message, ...(err.extra || {}) });
  }
}
