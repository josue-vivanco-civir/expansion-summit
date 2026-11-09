# 🚀 Summit CMS & Landing Page Engine

CMS completo y ligero (sin dependencias externas pesadas) diseñado específicamente para eventos tipo **Summit / Cumbre Internacional**. Permite gestionar en tiempo real todos los contenidos, paleta de colores, tipografías y recursos multimedia para una Landing Page de alto impacto.

---

## 📌 Enlaces Rápidos

- 🔑 **Login:** [http://localhost:3000/login](http://localhost:3000/login)
- ⚙️ **Panel de Administración CMS:** [http://localhost:3000/admin](http://localhost:3000/admin)
- 🌐 **Vista previa de la landing:** [http://localhost:3000/](http://localhost:3000/) (requiere sesión, salvo `PUBLIC_LANDING=true`)

---

## 🏗️ Arquitectura de la Landing Page (8 Módulos Fijos)

1. **Header:**
   - Logotipo personalizable.
   - Menú de navegación con anclas internas (`#hero`, `#video`, `#agenda`, `#speakers`, `#broadcast`, `#faq`).
   - Botón CTA de registro directo.
   - Acceso directo al panel CMS.

2. **Portada (Hero):**
   - Imagen de portada en proporción oficial **1920px × 938px** optimizada para web.
   - Detector y recortador automático integrado vía Canvas HTML5 si la imagen subida no tiene esa dimensión exacta.
   - Badge con pulso de estado del evento.
   - Título de impacto, subtítulo, botones de llamada a la acción y métricas clave.

3. **Sección de Video:**
   - Tráiler oficial o video promocional.
   - Vinculación directa con ID de YouTube o URL completa.

4. **Agenda (Timeline Cronológico):**
   - Publicación para cada ponencia con:
     - Imagen descriptiva
     - Hora / Franja horaria
     - Categoría temática (con pestañas interactivas de filtrado)
     - Título de la ponencia
     - Descripción detallada
     - Ponente(s)
     - Moderador(es)

5. **Ponentes (Speakers):**
   - Directorio de ponentes magistrales y panelistas.
   - Foto, nombre, cargo, empresa/institución, badge de rol y biografía.

6. **Broadcast (Transmisiones en Vivo):**
   - Slider / carrusel interactivo horizontal para salas y transmisiones.
   - Cada entrada incluye: Imagen, título, hora, descripción opcional, ponentes, moderadores.
   - Botón de reproducción con indicador **"En Vivo"** que abre un modal con el reproductor oficial de **YouTube Live** (importado mediante el ID configurado en el CMS).
   - Botón de prueba directa en el CMS para previsualizar el streaming antes de publicar.

7. **Preguntas Frecuentes (FAQ):**
   - Acordeón accesible y animado.
   - Soporte para enlaces en el texto mediante sintaxis Markdown: `[Texto del enlace](#ancla)` o `[Sitio Web](https://url.com)`.
   - Botón asistente en el CMS para insertar enlaces con un solo clic.

8. **Footer:**
   - Logotipo dedicado para el pie de página.
   - Descripción institucional, derechos de autor, enlaces rápidos y redes sociales.

---

## 🎨 Personalización de Apariencia

Desde la pestaña **"Apariencia y Marca"** del CMS se puede configurar:
- **Tipografías:** Selector de Google Fonts cargadas dinámicamente (`Outfit`, `Plus Jakarta Sans`, `Inter`, `Montserrat`, `Poppins`, `Space Grotesk`, `Playfair Display`) para:
  - Títulos de módulos
  - Títulos de ponencias
  - Textos y descripciones
- **Paleta de Colores:** Pickers visuales y códigos hexadecimales para:
  - Color de títulos de módulos
  - Color de títulos de ponencias
  - Color de descripciones y párrafos
  - Color primario y de acento
  - Color de fondo de la landing, header y footer
- **Logotipos:** Subida y previsualización de logos independientes para Header y Footer.

---

## 💾 Persistencia y Respaldos

- Todos los datos se guardan en `data/summit-data.json`.
- Cada guardado genera automáticamente un respaldo en `data/summit-data.backup.json`.
- En el panel de control dispones de botones para:
  - **Exportar Respaldo:** Descarga inmediata del archivo `.json`.
  - **Importar Respaldo:** Carga un archivo `.json` previo y sincroniza todo al instante.

---

## 🔒 Acceso y Seguridad

**Todo el CMS es privado.** Sin sesión solo responden `/login`, `/robots.txt` y `/uploads/*` (las imágenes deben ser públicas porque la landing exportada las referencia desde otro dominio).

| Rol | Puede |
|---|---|
| **Admin** | Todo: contenidos, plantillas, CSS, crear/eliminar usuarios, restablecer contraseñas |
| **Editor** | Editar contenidos, subir imágenes, exportar HTML. No ve usuarios ni plantillas |

### Primer arranque
Si `data/users.json` no tiene administradores, se crea uno con `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Si no defines `ADMIN_PASSWORD`, se genera una aleatoria y se imprime **una sola vez** en la consola. Después, el admin da de alta a los editores desde la pestaña **Usuarios**.

### Qué está protegido
- Contraseñas con PBKDF2-SHA512 (210 000 iteraciones), mínimo 10 caracteres y 3 tipos de carácter.
- Sesión en cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` en HTTPS). El token nunca llega a JavaScript.
- Expiración: 8 h sin actividad, 7 días máximo. Cambiar o restablecer una contraseña cierra las demás sesiones.
- Bloqueo de 15 min tras 5 intentos fallidos (por IP y por usuario).
- CSRF: toda escritura exige `Origin` del mismo dominio.
- Uploads: solo imágenes, validadas por su contenido real; los SVG se sirven con CSP `sandbox`.
- Las cuentas que aún usen las contraseñas de demostración anteriores se eliminan automáticamente al arrancar.

### noindex
Todas las respuestas llevan `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` (incluye imágenes), además del `<meta name="robots">` en las páginas. `robots.txt` **no** bloquea el rastreo a propósito: si lo bloqueara, Google no podría leer la directiva noindex.

> El HTML exportado conserva su propia directiva robots, configurable en **SEO → Directiva Meta Robots** (por defecto `noindex, nofollow`).

## 🛠️ Cómo Iniciar el Servidor

```bash
cp .env.example .env   # opcional, para definir el admin inicial
ADMIN_PASSWORD='Tu-Clave-Segura-2026' node server.js
```

Variables disponibles: ver `.env.example`.

### Producción (Render u otro)
- Usa **HTTPS** siempre.
- Define `ADMIN_PASSWORD` en las variables de entorno del servicio.
- El disco de Render es efímero: monta un **disco persistente** y apunta `DATA_DIR` a él; si no, usuarios, sesiones y contenidos se pierden en cada deploy. (Lo mismo aplica a `public/uploads`.)
