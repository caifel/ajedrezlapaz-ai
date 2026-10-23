export const BOLIVIA_TIME_ZONE = 'America/La_Paz';

const DAY_MS = 86400000;

const DATE_KEY = new Intl.DateTimeFormat('en-CA', {
  timeZone: BOLIVIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Devuelve la fecha de Bolivia como YYYY-MM-DD. */
export function getBoliviaDateKey(date = new Date()) {
  return DATE_KEY.format(date);
}

/** Convierte una clave YYYY-MM-DD en sus partes y en una fecha UTC. */
export function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).slice(0, 10).split('-').map(Number);

  return {
    year,
    month,
    day,
    date: new Date(Date.UTC(year, month - 1, day))
  };
}

/** Diferencia en días entre dos claves YYYY-MM-DD. */
export function getDiasEntre(desdeKey, hastaKey) {
  const desde = parseDateKey(desdeKey).date.getTime();
  const hasta = parseDateKey(hastaKey).date.getTime();

  if (Number.isNaN(desde) || Number.isNaN(hasta)) return null;

  return Math.round((hasta - desde) / DAY_MS);
}

/** Días que faltan desde todayKey hasta fecha (ambas YYYY-MM-DD). */
export function getDiasHasta(fecha, todayKey) {
  return getDiasEntre(todayKey, fecha);
}
