// Persistencia en archivos JSON. Es la única pieza que habría que reemplazar
// para mover los datos a una base de datos (por ejemplo, en AWS).
import fs from 'node:fs';
import path from 'node:path';

export function leerJson(archivo, porDefecto = null) {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return porDefecto;
    throw err;
  }
}

// Escribe primero un temporal y luego lo renombra: nunca queda un archivo a medias
export function escribirJson(archivo, datos, { legible = false } = {}) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const tmp = `${archivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, legible ? JSON.stringify(datos, null, 2) : JSON.stringify(datos), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, archivo);
}

export function borrarCarpeta(carpeta) {
  fs.rmSync(carpeta, { recursive: true, force: true });
}
