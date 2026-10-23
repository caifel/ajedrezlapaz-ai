export const SITE_DESCRIPTION =
  'Sitio oficial de la ADALP: torneos de ajedrez en La Paz, categorías de jugadores, certificados y enlaces a resultados.';

export const PAGE_DESCRIPTIONS = {
  home: 'Calendario oficial de torneos de ajedrez en La Paz, Bolivia. Consulta próximos eventos de la ADALP, categorías de jugadores y certificados oficiales.',
  jugadores:
    'Registro oficial de jugadores de ajedrez de la ADALP en La Paz. Consulta nombres, categorías y descarga el certificado oficial de cada jugador.',
  torneos:
    'Calendario de torneos de ajedrez en La Paz: fechas, horarios, ritmo de juego, ubicación e inscripciones. Consulta los próximos eventos de la ADALP.',
  noEncontrada:
    'La página que buscas no existe o fue movida. Visita el sitio oficial de la Asociación Departamental de Ajedrez de La Paz.'
};

const quitarEmojis = (texto) =>
  String(texto)
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizarFecha = (fecha = '') => {
  const texto = String(fecha).trim();
  return texto.startsWith('Del ') ? `del ${texto.slice(4)}` : texto;
};

const getNombreLugar = (torneo) =>
  String(torneo.lugar ?? '')
    .split(',')[0]
    .replace(/\s*\([^)]*\)/g, '')
    .trim();

const getOrganizadoresTexto = (torneo) =>
  (torneo.organizadores ?? [])
    .map((organizacion) =>
      typeof organizacion === 'string'
        ? organizacion
        : organizacion.corto ?? organizacion.nombre
    )
    .filter(Boolean)
    .join(' y ');

export function getDescripcionTorneo(torneo) {
  const esOnline = Boolean(torneo.esOnline);
  const base = esOnline ? 'Torneo online de ajedrez' : 'Torneo de ajedrez en La Paz';
  const fecha = normalizarFecha(torneo.fecha_texto);
  const lugar = getNombreLugar(torneo);
  const organizadores = getOrganizadoresTexto(torneo);
  const contexto = [
    organizadores ? `Organizado por ${organizadores}` : '',
    !esOnline && lugar ? `en ${lugar}` : ''
  ]
    .filter(Boolean)
    .join(' ');
  const contextoTexto = contexto ? ` ${contexto}.` : '';
  const organizadorTexto = organizadores ? ` Organizado por ${organizadores}.` : '';

  switch (torneo.estado) {
    case 'cancelado':
      return `Evento cancelado: ${base.toLowerCase()} (${fecha}). Consulta detalles y próximos torneos.`;
    case 'finalizado': {
      const cierre = torneo.enlace
        ? 'Consulta resultados y detalles del evento.'
        : 'Consulta horarios y detalles del evento.';

      return `${base} (${fecha}).${organizadorTexto} ${cierre}`;
    }
    case 'lleno':
      return `${base} (${fecha}).${contextoTexto} Cupo lleno; consulta detalles.`;
    case 'en_curso':
      return `${base} (${fecha}).${contextoTexto} En curso; consulta horarios y detalles.`;
    default:
      if (esOnline) {
        return `${base} (${fecha}). Inscripciones abiertas; consulta horarios, ritmo de juego y cómo participar desde Lichess.`;
      }

      return `${base} (${fecha}). Inscripciones abiertas${lugar ? ` en ${lugar}` : ''}; consulta horarios y ritmo de juego.`;
  }
}

export function getDescripcionEvento(torneo) {
  const base = torneo.esOnline ? 'Torneo online de ajedrez' : 'Torneo de ajedrez en La Paz';
  const fecha = normalizarFecha(torneo.fecha_texto);
  const organizadores = getOrganizadoresTexto(torneo);
  const detalles = (torneo.detalles ?? [])
    .filter((detalle) => !detalle.includes('📍'))
    .map(quitarEmojis)
    .filter(Boolean)
    .join('. ');
  const lugar = torneo.esOnline ? 'Lichess' : getNombreLugar(torneo);

  const partes = [`${base} (${fecha})`];

  if (organizadores) partes.push(`Organizado por ${organizadores}`);
  if (detalles) partes.push(detalles);
  if (lugar) partes.push(torneo.esOnline ? `Plataforma: ${lugar}` : `Lugar: ${lugar}`);

  return `${partes.join('. ')}.`;
}
