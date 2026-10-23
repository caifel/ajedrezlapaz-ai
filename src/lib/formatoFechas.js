import {
  BOLIVIA_TIME_ZONE,
  getBoliviaDateKey,
  getDiasEntre,
  parseDateKey
} from './fechas.js';

const MESES = new Intl.DateTimeFormat('es-BO', { month: 'long', timeZone: 'UTC' });
const DIA_CORTO = new Intl.DateTimeFormat('es-BO', {
  weekday: 'short',
  day: 'numeric',
  timeZone: BOLIVIA_TIME_ZONE
});
const HORA = new Intl.DateTimeFormat('es-BO', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: BOLIVIA_TIME_ZONE
});

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const formatDiaAbrev = (iso) => capitalizar(DIA_CORTO.format(new Date(iso)));

const formatHora = (iso) =>
  HORA.format(new Date(iso))
    .replace(/\s*p\.\s*m\./i, ' pm')
    .replace(/\s*a\.\s*m\./i, ' am');

const crearTramo = (dia, hora) => [
  { texto: dia, fuerte: true },
  { texto: ' • ' },
  { texto: hora }
];

/** Ej.: "25 de octubre, 2026", "24 y 25 de octubre, 2026", "Del 10 al 13 de diciembre, 2026". */
export function formatFechaTexto(inicio, fin) {
  const desdeKey = getBoliviaDateKey(new Date(inicio));
  const hastaKey = getBoliviaDateKey(new Date(fin));
  const desde = parseDateKey(desdeKey);
  const hasta = parseDateKey(hastaKey);

  if (desdeKey === hastaKey) {
    return `${desde.day} de ${MESES.format(desde.date)}, ${desde.year}`;
  }

  const mesDesde = MESES.format(desde.date);
  const mesHasta = MESES.format(hasta.date);
  const mismoAnio = desde.year === hasta.year;

  if (mismoAnio && desde.month === hasta.month) {
    const dias = getDiasEntre(desdeKey, hastaKey);
    return dias === 1
      ? `${desde.day} y ${hasta.day} de ${mesDesde}, ${desde.year}`
      : capitalizar(`del ${desde.day} al ${hasta.day} de ${mesDesde}, ${desde.year}`);
  }

  if (mismoAnio) {
    return capitalizar(
      `del ${desde.day} de ${mesDesde} al ${hasta.day} de ${mesHasta}, ${desde.year}`
    );
  }

  return capitalizar(
    `del ${desde.day} de ${mesDesde} de ${desde.year} al ${hasta.day} de ${mesHasta} de ${hasta.year}`
  );
}

/** Horario en segmentos para poder resaltar los días en negrita. */
export function formatHorario(inicio, fin) {
  const inicioKey = getBoliviaDateKey(new Date(inicio));
  const finKey = getBoliviaDateKey(new Date(fin));
  const diaInicio = formatDiaAbrev(inicio);
  const diaFin = formatDiaAbrev(fin);
  const horaInicio = formatHora(inicio);
  const horaFin = formatHora(fin);

  if (inicioKey === finKey) {
    return [
      { texto: '🗓️ ' },
      ...crearTramo(diaInicio, horaInicio),
      { texto: ' — ' },
      { texto: horaFin }
    ];
  }

  return [
    { texto: '🗓️ ' },
    ...crearTramo(diaInicio, horaInicio),
    { texto: ' — ' },
    ...crearTramo(diaFin, horaFin)
  ];
}
