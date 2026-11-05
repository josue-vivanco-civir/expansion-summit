# 🚀 Summit CMS & Landing Page Engine

CMS completo y ligero (sin dependencias externas pesadas) diseñado específicamente para eventos tipo **Summit / Cumbre Internacional**. Permite gestionar en tiempo real todos los contenidos, paleta de colores, tipografías y recursos multimedia para una Landing Page de alto impacto.

---

## 📌 Enlaces Rápidos

- 🌐 **Landing Page Pública:** [http://localhost:3000/](http://localhost:3000/)
- ⚙️ **Panel de Administración CMS:** [http://localhost:3000/admin](http://localhost:3000/admin)

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

## 🛠️ Cómo Iniciar el Servidor

```bash
cd /Users/josuevivanco/.gemini/antigravity/scratch/summit-cms
npm start
# o directamente:
node server.js
```
