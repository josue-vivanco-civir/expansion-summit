# CMS Summit

CMS para crear y publicar las landing pages de los Summit de Expansión. Permite trabajar varios eventos a la vez, guarda cada cambio como versión, publica cada evento en su propia URL y deja ver los cambios en vista previa antes de publicarlos. No necesita base de datos externa: todo se guarda en archivos dentro de `DATA_DIR`.

## Cómo funciona

| Dirección | Quién la ve | Qué muestra |
|---|---|---|
| `/` | Todo el público | La landing del evento marcado como raíz del dominio |
| `/<ruta>` (ej. `/mujeres-2026`) | Todo el público | La landing publicada de ese evento |
| `/login` | Todo el público | Entrada para editores |
| `/eventos` | Con sesión | Tablero: eventos, publicación, versiones, tareas, equipo y papelera |
| `/admin` | Con sesión | Editor de la landing (sin sesión manda a `/login`) |
| `/vista-previa/<id>` | Con sesión | Lo último guardado, aunque no esté publicado |

**Guardar no es publicar.** Cada “Guardar cambios” crea una versión nueva que solo se ve en la vista previa. La URL pública muestra la versión publicada hasta que alguien pulsa **Publicar**, desde el editor (tarjeta “Evento” del menú) o desde `/eventos`. Cualquier versión anterior se puede ver, volver a publicar o restaurar.

**URL de cada evento.** Al crear un evento se le asigna una ruta a partir de su nombre (`Summit Mujeres 2026` → `/summit-mujeres-2026`), que se puede cambiar en `/eventos`. Cualquier evento puede marcarse además como **raíz del dominio**; solo uno a la vez, y sigue disponible en su ruta propia. Las rutas del CMS (`admin`, `login`, `eventos`, `api`, `uploads`, `css`, `js`…) están reservadas.

**Landing pública sin rastro del CMS.** En las URLs públicas y en la vista previa se ocultan los enlaces y botones hacia el CMS (`/admin`, `/login`, `/eventos` o con texto como “Panel CMS”). Lo recomendable es quitar ese botón también de `public/index.html`.

**Roles.** La creación de usuarios funciona igual que antes (`auth.js` no cambia): los administradores crean usuarios, restablecen contraseñas, aplican plantillas y eliminan definitivamente; los editores editan, guardan, publican y usan la papelera. Con `SOLO_ADMIN_PUBLICA=true` solo los administradores publican.

## Qué incluye este paquete

```
server.js                          servidor (reemplaza al actual)
auth.js                            sin cambios respecto al tuyo
package.json                       sin dependencias externas; requiere Node 20+
render.yaml                        blueprint opcional para Render
.env.example, .gitignore
lib/
  eventos.js                       eventos, versiones, publicación, tareas, papelera
  api-eventos.js                   rutas /api/eventos, /api/tareas, /api/equipo
  publicacion.js                   arma la landing pública o la vista previa desde index.html
  almacen.js                       lectura y escritura de archivos (lo único a cambiar al pasar a una base de datos)
  errores.js
public/
  admin.html                       tu editor + tarjeta del evento con botón Publicar
  eventos.html                     tablero de eventos (usa /css/admin.css)
  js/admin.js                      tu editor con ajustes de guardado, vista previa y exportación
  js/evento-contexto.js            conecta landing y editor con el evento correcto
  js/confirmar-eliminacion.js      advertencia antes de eliminar
```

**Se conservan de tu repositorio, sin cambios:** `public/index.html`, `public/login.html`, `public/css/` (incluidos `admin.css` y `landing.css`), `public/js/landing.js`, `public/uploads/`, `data/summit-data.json`, `data/summit-data.backup.json` y `data/presets/`. Si tu `package.json` tiene otros campos, basta con conservar `"type": "module"` y el script `start`.

## Despliegue provisional en Render

1. Copia los archivos de este paquete sobre tu repositorio y súbelos a GitHub.
2. En Render, en tu Web Service, configura *Build Command* `npm install` y *Start Command* `node server.js`.
3. **Disco persistente.** En *Disks*, agrega un disco montado en `/var/data` (1 GB alcanza para empezar). Requiere un plan de pago. Sin disco, Render borra usuarios, eventos, versiones e imágenes en cada deploy o reinicio.
4. En *Environment* define al menos `DATA_DIR=/var/data`, `ADMIN_PASSWORD` (mínimo 10 caracteres combinando mayúsculas, minúsculas, números o símbolos) y `EVENTO_INICIAL`. El resto está en `.env.example`.
5. Haz el deploy. En el primer arranque:
   - se crea el administrador inicial si no hay ninguno;
   - la landing actual (`summit-data.json`) se convierte en el primer evento, **publicado en `/` y en su ruta propia**, para que el sitio se vea igual que antes.

   En los logs debe aparecer `📦 La landing actual se migró…`.
6. Entra a `/login` y después a `/eventos`.

Mientras siga en `onrender.com`, deja `PERMITIR_INDEXACION=false`: todas las respuestas llevan `noindex`. Cuando el sitio esté en el dominio definitivo, cámbialo a `true` para que Google indexe las landings publicadas; el CMS, el login y las vistas previas siempre llevan `noindex`.

### Probar en local

```bash
node server.js                 # usa ./data
# o con variables:
node --env-file=.env server.js
```

## Dónde se guarda cada cosa

```
DATA_DIR/
  users.json, sessions.json        usuarios y sesiones (auth.js)
  eventos.json                     eventos, URLs, publicación, equipo, tareas, actividad
  versiones/<evento>/<n>.json      contenido de cada versión guardada
  uploads/                         imágenes subidas desde el editor (se sirven en /uploads/)
```

Las imágenes que ya vienen en `public/uploads/` se siguen sirviendo. Las URLs de imagen no cambian (`/uploads/…`), así que el exportador de HTML para WordPress funciona igual.

Para respaldar todo basta con copiar la carpeta `DATA_DIR`.

## Pasar a AWS más adelante

El servidor no depende de Render. En AWS puede correr igual en una instancia (EC2 o Lightsail) con `DATA_DIR` en un volumen persistente, detrás de un balanceador o CloudFront con el dominio propio.

Si después se quiere una base de datos administrada (RDS) y S3 para imágenes, el trabajo se concentra en `lib/almacen.js`, `lib/eventos.js` y la subida de imágenes en `server.js`; las pantallas y las rutas no cambian.

## API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/data` | Sin sesión: versión publicada (raíz o `?evento=`). Con sesión: lo último guardado del evento que se edita; `?modo=preview&version=N` para una versión concreta |
| POST | `/api/data` | Guarda una versión (cabecera `X-Version-Base` para detectar conflictos) |
| POST | `/api/upload` | Sube una imagen al evento que se edita |
| GET | `/api/eventos` · `?papelera=1` | Eventos en curso o en la papelera |
| POST | `/api/eventos` | `{ nombre, fechaEvento, basadoEn? }` |
| GET / PATCH / DELETE | `/api/eventos/:id` | Detalle / `{ nombre, fechaEvento, estado, ruta, esPrincipal }` / borrado definitivo `{ confirmacion }` |
| POST | `/api/eventos/:id/publicar` | `{ numero? }`; sin número publica la última versión guardada |
| POST | `/api/eventos/:id/despublicar` | Retira el evento de sus URLs públicas |
| GET | `/api/eventos/:id/versiones` | Historial |
| POST | `/api/eventos/:id/versiones/:n/restaurar` | Copia esa versión como versión nueva |
| POST | `/api/eventos/:id/papelera` · `/restaurar` | Papelera |
| POST / DELETE | `/api/eventos/:id/miembros[/:usuarioId]` | Equipo |
| POST | `/api/eventos/:id/tareas` · PATCH / DELETE `/api/tareas/:id` | Tareas |
| GET | `/api/equipo` | Personas para asignar |
