// Contexto de evento para la landing (pública o vista previa) y para el editor (admin.html).
//
// En la landing lo inserta el servidor automáticamente, junto con window.__SUMMIT__:
//   - hace que /js/landing.js pida el contenido del evento correcto (publicado o vista previa)
//   - oculta cualquier acceso al CMS (CTA "Panel CMS", enlaces a /admin o /login)
//   - en vista previa muestra una franja que avisa que no es la versión pública
//
// En el editor se carga desde admin.html, antes de /js/admin.js:
//   - asocia cada guardado y cada imagen al evento que se edita
//   - detecta si otra persona guardó mientras editabas
//   - muestra el evento, su versión y su estado de publicación, y permite publicar
(function () {
  if (window.__eventoContexto) return;
  window.__eventoContexto = true;

  const fetchOriginal = window.fetch.bind(window);
  const landing = window.__SUMMIT__ || null;

  // =====================================================================
  // LANDING (pública o vista previa)
  // =====================================================================
  if (landing) {
    window.fetch = function (input, init) {
      if (typeof input === 'string' || input instanceof URL) {
        const u = new URL(String(input), location.origin);
        if (u.origin === location.origin && u.pathname === '/api/data') {
          u.searchParams.set('evento', landing.evento);
          u.searchParams.set('modo', landing.modo);
          if (landing.version) u.searchParams.set('version', String(landing.version));
          return fetchOriginal(u.pathname + u.search, init);
        }
      }
      return fetchOriginal(input, init);
    };

    // Ninguna URL pública debe llevar al CMS
    const estilo = document.createElement('style');
    estilo.textContent = 'a[href^="/admin"],a[href^="/login"],a[href^="/eventos"],a[href*="/admin.html"],[data-cms-link]{display:none!important}';
    document.head.append(estilo);
    const PANEL_RE = /panel\s*(del\s*)?cms|ir\s+al\s+cms|acceso\s+cms/i;
    const limpiar = (raiz) => {
      for (const el of raiz.querySelectorAll('a, button')) {
        if (PANEL_RE.test(el.textContent || '') || /^\/(admin|login|eventos)/.test(el.getAttribute('href') || '')) el.remove();
      }
    };
    const vigilar = () => {
      limpiar(document);
      new MutationObserver((cambios) => {
        for (const c of cambios) for (const n of c.addedNodes) if (n.nodeType === 1) limpiar(n.parentNode || n);
      }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigilar, { once: true });
    else vigilar();

    if (landing.modo === 'preview') {
      const ponerFranja = () => {
        const franja = document.createElement('div');
        franja.setAttribute('role', 'status');
        franja.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px 16px;background:#0f172a;color:#e2e8f0;font:600 13px/1.4 Inter,system-ui,sans-serif;border-top:2px solid #f59e0b;box-shadow:0 -6px 20px rgba(0,0,0,.25)';
        const texto = document.createElement('span');
        texto.textContent = landing.aviso || 'Vista previa (no publicada)';
        const cerrar = document.createElement('button');
        cerrar.type = 'button';
        cerrar.textContent = 'Ocultar';
        cerrar.style.cssText = 'font:inherit;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:4px 10px;cursor:pointer';
        cerrar.addEventListener('click', () => franja.remove());
        franja.append(texto, cerrar);
        document.body.append(franja);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ponerFranja, { once: true });
      else ponerFranja();
    }
    return;
  }

  // =====================================================================
  // EDITOR (admin.html)
  // =====================================================================
  const COOKIE = 'summit_evento';
  const RUTAS = ['/api/data', '/api/upload', '/api/preset', '/api/reset', '/api/download-assets-zip'];
  const params = new URLSearchParams(location.search);

  let eventoId = params.get('evento');
  let nombreEvento = null;
  let version = null;
  let detalle = null; // datos de publicación del evento

  // Lectura para admin.js (vista previa, nombre del respaldo)
  window.summitEvento = {
    get id() { return eventoId; },
    get nombre() { return nombreEvento; },
    get version() { return version; },
    get detalle() { return detalle; },
  };

  const recordarEvento = (id) => {
    document.cookie = `${COOKIE}=${encodeURIComponent(id)}; Path=/; SameSite=Strict`;
  };
  if (eventoId) recordarEvento(eventoId);

  function conEvento(url) {
    const u = new URL(url, location.origin);
    if (u.origin !== location.origin || !RUTAS.includes(u.pathname)) return url;
    if (eventoId && !u.searchParams.has('evento')) u.searchParams.set('evento', eventoId);
    return u.pathname + u.search + u.hash;
  }

  function leerCabeceras(resp) {
    const id = resp.headers.get('X-Evento-Id');
    const n = resp.headers.get('X-Evento-Nombre');
    const v = resp.headers.get('X-Version');
    if (id && !eventoId) {
      eventoId = id;
      recordarEvento(id);
      params.set('evento', id);
      history.replaceState(history.state, '', `${location.pathname}?${params}${location.hash}`);
    }
    if (n) { try { nombreEvento = decodeURIComponent(n); } catch { nombreEvento = n; } }
    if (v) actualizarVersion(Number(v));
  }

  function leerVersionDelCuerpo(resp) {
    resp.clone().json().then((d) => { if (d && d.version) actualizarVersion(d.version); }).catch(() => {});
  }

  async function guardar(url, init, forzar) {
    const headers = new Headers(init.headers || {});
    if (version != null) headers.set('X-Version-Base', String(version));
    if (forzar) headers.set('X-Forzar', '1');
    const resp = await fetchOriginal(url, { ...init, headers });

    if (resp.status === 409) {
      const info = await resp.clone().json().catch(() => ({}));
      const hora = info.fecha
        ? new Date(info.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        : '';
      const quien = info.autor || 'Otra persona';
      const seguir = window.confirm(
        `${quien} guardó la versión ${info.version_actual}${hora ? ` a las ${hora}` : ''} mientras editabas.\n\n` +
        'Si guardas ahora, tus cambios quedarán como la versión actual y los suyos seguirán en el historial del evento.\n\n' +
        '¿Guardar tus cambios de todos modos?'
      );
      if (seguir) return guardar(url, init, true);
      return resp;
    }
    if (resp.ok) leerVersionDelCuerpo(resp);
    return resp;
  }

  window.fetch = async function (input, init = {}) {
    if (input instanceof Request) return fetchOriginal(input, init);
    const url = conEvento(String(input));
    const ruta = new URL(url, location.origin).pathname;
    const metodo = String(init.method || 'GET').toUpperCase();

    if (ruta === '/api/data' && metodo === 'POST') return guardar(url, init, false);

    const resp = await fetchOriginal(url, init);
    if (ruta === '/api/data' && metodo === 'GET' && resp.ok) leerCabeceras(resp);
    if ((ruta === '/api/preset' || ruta === '/api/reset') && resp.ok) leerVersionDelCuerpo(resp);
    return resp;
  };

  // ---------- Tarjeta del evento en el menú lateral ----------

  function alListo(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  const avisar = (texto, tipo = 'success') => {
    if (typeof window.showToast === 'function') window.showToast(texto, tipo);
    else window.alert(texto);
  };

  async function cargarDetalle() {
    if (!eventoId) return;
    try {
      const r = await fetchOriginal(`/api/eventos/${encodeURIComponent(eventoId)}`, { credentials: 'same-origin' });
      if (r.ok) detalle = await r.json();
    } catch {}
    pintar();
  }

  function urlPublica() {
    if (!detalle || !detalle.urlsPublicas || !detalle.urlsPublicas.length) return null;
    const ruta = detalle.urlsPublicas.find((u) => u !== '/') || detalle.urlsPublicas[0];
    return location.origin + ruta;
  }

  function pintar() {
    alListo(() => {
      if (nombreEvento) document.title = `${nombreEvento} · CMS Summit`;
      const tarjeta = document.getElementById('evento-actual');
      const publica = urlPublica();
      const previa = eventoId ? `/vista-previa/${encodeURIComponent(eventoId)}` : '/vista-previa';

      // "Ver Landing" abre la URL pública si existe; si no, la vista previa
      for (const a of document.querySelectorAll('a[href="/"], a[href="/index.html"], a[data-ver-landing]')) {
        a.dataset.verLanding = '';
        a.href = publica || previa;
        a.title = publica ? `Abrir ${publica}` : 'El evento no está publicado: se abre la vista previa';
      }
      if (eventoId) {
        for (const a of document.querySelectorAll('a[href^="/api/download-assets-zip"]')) {
          a.href = `/api/download-assets-zip?evento=${encodeURIComponent(eventoId)}`;
        }
      }
      if (!tarjeta) return;

      const q = (sel) => tarjeta.querySelector(sel);
      q('[data-evento-nombre]').textContent = nombreEvento || 'Evento';
      q('[data-evento-version]').textContent = version ? `Versión guardada: ${version}` : '';
      const enlaceEventos = q('a[href^="/eventos"]');
      if (enlaceEventos && eventoId) enlaceEventos.href = `/eventos?evento=${encodeURIComponent(eventoId)}`;

      const estado = q('[data-evento-publicacion]');
      const boton = q('[data-evento-publicar]');
      if (!estado || !boton) return;
      if (!detalle) { estado.textContent = ''; boton.hidden = true; return; }

      boton.hidden = false;
      if (detalle.versionPublicada) {
        const donde = detalle.urlsPublicas.length ? detalle.urlsPublicas.join(' y ') : 'oculto (archivado)';
        estado.textContent = detalle.versionPublicada === version
          ? `Publicada: versión ${detalle.versionPublicada} en ${donde}`
          : `Publicada: versión ${detalle.versionPublicada} en ${donde}. Tienes cambios sin publicar.`;
        estado.style.color = detalle.versionPublicada === version ? '#86efac' : '#fcd34d';
      } else {
        estado.textContent = 'Sin publicar: solo se ve en la vista previa';
        estado.style.color = '#fcd34d';
      }
      boton.disabled = Boolean(detalle.versionPublicada && detalle.versionPublicada === version);
      boton.querySelector('span').textContent = boton.disabled ? '✓ Todo publicado' : '🚀 Publicar';
    });
  }

  async function publicarDesdeEditor() {
    if (!eventoId) return;
    // Primero se guarda lo que haya en pantalla, para publicar exactamente eso
    if (typeof window.saveAllData === 'function') {
      const ok = await window.saveAllData();
      if (ok === false) return;
    }
    await cargarDetalle();
    const ruta = detalle?.ruta ? `${location.origin}/${detalle.ruta}` : 'su URL';
    const extra = detalle?.esPrincipal ? `\ny en la raíz: ${location.origin}/` : '';
    if (!window.confirm(`Se publicará la versión ${version} de “${nombreEvento}” en:\n${ruta}${extra}\n\nCualquier persona con el enlace la verá. ¿Publicar?`)) return;

    const r = await fetchOriginal(`/api/eventos/${encodeURIComponent(eventoId)}/publicar`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: version }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return avisar(d.error || 'No se pudo publicar', 'error');
    detalle = { ...detalle, ...d };
    pintar();
    avisar(`¡Publicado! Versión ${version} en ${d.urlsPublicas?.join(' y ') || 'su URL'}`, 'success');
  }

  function actualizarVersion(v) {
    const cambio = v !== version;
    version = v;
    pintar();
    if (cambio) cargarDetalle();
  }

  alListo(() => {
    const boton = document.querySelector('#evento-actual [data-evento-publicar]');
    if (boton) boton.addEventListener('click', () => publicarDesdeEditor().catch((e) => avisar(e.message, 'error')));
    pintar();
  });
})();
