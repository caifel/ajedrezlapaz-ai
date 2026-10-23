import organizaciones from '../data/organizaciones.json';

/**
 * Registro único de organizaciones (ADALP, instituciones y clubes).
 *
 * Campos:
 *   id       identificador usado en torneos.json
 *   nombre   nombre completo
 *   corto    nombre breve para espacios reducidos (opcional)
 *   tipo     etiqueta que se muestra en las tarjetas de aliados
 *   logo     ruta pública del logo
 *   url      sitio del que es dueña la organización ('/' para ADALP)
 *   width    ancho del logo en píxeles
 *   height   alto del logo en píxeles
 *   aliado   true si aparece en la sección "Instituciones y clubes"
 */

/** Si un torneo no declara organizadores, se atribuye a ADALP. */
const ORGANIZADORES_POR_DEFECTO = ['adalp'];

const CAMPOS_REQUERIDOS = ['id', 'nombre', 'logo', 'url', 'width', 'height'];

const organizacionesPorId = new Map();

for (const organizacion of organizaciones) {
  const faltantes = CAMPOS_REQUERIDOS.filter((campo) => organizacion[campo] === undefined);

  if (faltantes.length > 0) {
    throw new Error(
      `Organización "${organizacion.id ?? '(sin id)'}" incompleta en src/data/organizaciones.json: falta ${faltantes.join(', ')}.`
    );
  }

  if (organizacionesPorId.has(organizacion.id)) {
    throw new Error(`Id de organización duplicado en src/data/organizaciones.json: "${organizacion.id}".`);
  }

  organizacionesPorId.set(organizacion.id, organizacion);
}

/** Instituciones y clubes que se muestran en la sección de aliados. */
export function getAliados() {
  return organizaciones.filter((organizacion) => organizacion.aliado);
}

/** Resuelve ids (o entradas ya resueltas) a organizaciones completas. */
export function getOrganizadores(lista) {
  const ids = Array.isArray(lista) && lista.length > 0 ? lista : ORGANIZADORES_POR_DEFECTO;

  return ids.map((item) => {
    // Torneos ya resueltos por getTorneos() traen la organización completa.
    if (item && typeof item === 'object') return item;

    const organizacion = organizacionesPorId.get(item);

    if (!organizacion) {
      throw new Error(
        `Organización desconocida "${item}". Revisa src/data/organizaciones.json y el campo "organizadores" de torneos.json.`
      );
    }

    return organizacion;
  });
}
