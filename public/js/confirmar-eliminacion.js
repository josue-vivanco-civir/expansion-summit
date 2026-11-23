// Modal de advertencia para eliminar eventos.
// Lo usa /eventos.html: <script src="/js/confirmar-eliminacion.js"></script>
//
//   // Mover a la papelera (cualquier editor)
//   const ok = await confirmarEliminacion({ eventoId });
//   // Eliminar definitivamente (admin, desde la papelera; pide escribir el nombre)
//   const ok = await confirmarEliminacion({ eventoId, definitivo: true });
//
// Devuelve true si se eliminó y false si se canceló.
(function () {
  // Misma paleta que el panel (admin.css)
  const ESTILOS = `
  .cms-confirm{border:1px solid #334155;border-radius:12px;padding:0;width:min(460px,calc(100% - 32px));
    background:#0f172a;color:#e2e8f0;font:14px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.5)}
  .cms-confirm::backdrop{background:rgba(2,6,23,.7)}
  .cms-confirm form{padding:22px 22px 18px;margin:0}
  .cms-confirm h2{margin:0 0 8px;font:700 19px/1.3 Outfit,Inter,sans-serif;color:#fff}
  .cms-confirm p{margin:0 0 12px;color:#94a3b8}
  .cms-confirm ul{margin:0 0 14px;padding-left:20px;color:#cbd5e1}
  .cms-confirm .aviso{background:rgba(245,158,11,.12);border-left:4px solid #f59e0b;color:#fcd34d;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:13px}
  .cms-confirm label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#cbd5e1}
  .cms-confirm input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#e2e8f0;font:inherit}
  .cms-confirm input:focus{outline:none;border-color:#38bdf8}
  .cms-confirm .error{color:#fca5a5;font-size:13px;min-height:1.2em;margin:8px 0 0}
  .cms-confirm .acciones{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
  .cms-confirm button{font:600 14px/1 Inter,system-ui,sans-serif;padding:10px 16px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer}
  .cms-confirm button.peligro{background:#dc2626;border-color:#dc2626;color:#fff}
  .cms-confirm button:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
  .cms-confirm button:disabled{opacity:.45;cursor:not-allowed}`;

  function inyectarEstilos() {
    if (document.getElementById('cms-confirm-estilos')) return;
    const s = document.createElement('style');
    s.id = 'cms-confirm-estilos';
    s.textContent = ESTILOS;
    document.head.append(s);
  }

  function el(tag, props = {}, ...hijos) {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...hijos);
    return n;
  }

  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  async function confirmarEliminacion({ apiBase = '/api', eventoId, definitivo = false }) {
    const r = await fetch(`${apiBase}/eventos/${eventoId}/resumen-eliminacion`, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('No se pudo obtener la información del evento');
    const info = await r.json();
    inyectarEstilos();

    return new Promise((resolve) => {
      let resuelto = false;
      const terminar = (valor) => { if (!resuelto) { resuelto = true; resolve(valor); } dlg.close(); dlg.remove(); };

      const dlg = el('dialog', { className: 'cms-confirm' });
      const form = el('form', { method: 'dialog' });
      const error = el('p', { className: 'error' });
      const btnCancelar = el('button', { type: 'button', textContent: 'Cancelar' });
      const btnOk = el('button', {
        type: 'submit',
        className: 'peligro',
        textContent: definitivo ? 'Eliminar para siempre' : 'Mover a la papelera',
      });

      form.append(
        el('h2', { textContent: definitivo ? `¿Eliminar “${info.nombre}” para siempre?` : `¿Mover “${info.nombre}” a la papelera?` }),
        el('p', { textContent: 'Este evento contiene:' }),
        el('ul', {},
          el('li', { textContent: plural(info.versiones, 'versión guardada', 'versiones guardadas') }),
          el('li', { textContent: plural(info.imagenes, 'imagen', 'imágenes') }),
          el('li', { textContent: plural(info.tareasPendientes, 'tarea pendiente', 'tareas pendientes') }),
        ),
      );
      if (info.publicado && !definitivo) {
        const donde = (info.urlsPublicas || []).map((u) => location.origin + u).join(' y ');
        form.append(el('div', { className: 'aviso', textContent: `Está publicada en ${donde}. Al moverla a la papelera esa dirección dejará de mostrarla${info.esPrincipal ? ' y la raíz del dominio quedará sin landing hasta que asignes otra' : ''}.` }));
      }
      form.append(el('p', {
        textContent: definitivo
          ? 'Esta acción no se puede deshacer: se borrarán todas sus versiones, tareas e imágenes.'
          : `Podrás restaurarlo desde la papelera durante ${info.diasPapelera} días.`,
      }));

      let input = null;
      if (definitivo) {
        input = el('input', { type: 'text', autocomplete: 'off', spellcheck: false });
        form.append(el('label', { textContent: `Escribe “${info.nombre}” para confirmar` }), input);
        btnOk.disabled = true;
        input.addEventListener('input', () => { btnOk.disabled = input.value.trim() !== info.nombre; });
      }

      form.append(error, el('div', { className: 'acciones' }, btnCancelar, btnOk));
      dlg.append(form);

      btnCancelar.addEventListener('click', () => terminar(false));
      dlg.addEventListener('cancel', () => terminar(false));

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnOk.disabled = true;
        error.textContent = '';
        try {
          const resp = definitivo
            ? await fetch(`${apiBase}/eventos/${eventoId}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmacion: input.value.trim() }),
              })
            : await fetch(`${apiBase}/eventos/${eventoId}/papelera`, { method: 'POST', credentials: 'same-origin' });
          if (!resp.ok) {
            const cuerpo = await resp.json().catch(() => ({}));
            throw new Error(cuerpo.error || 'No se pudo eliminar');
          }
          terminar(true);
        } catch (err) {
          error.textContent = err.message;
          btnOk.disabled = definitivo ? input.value.trim() !== info.nombre : false;
        }
      });

      document.body.append(dlg);
      dlg.showModal();
      (input || btnCancelar).focus();
    });
  }

  window.confirmarEliminacion = confirmarEliminacion;
})();
