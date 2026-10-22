export const TOURNAMENT_STATUS = {
  abierto: { label: 'Inscripciones abiertas', className: 'status-abierto' },
  lleno: { label: 'Cupo lleno', className: 'status-lleno' },
  finalizado: { label: 'Finalizado', className: 'status-finalizado' },
  cancelado: { label: 'Cancelado', className: 'status-cancelado' }
};

export const TOURNAMENT_STATUS_CLASSES = Object.values(TOURNAMENT_STATUS).map(
  (status) => status.className
);

const DAY_MS = 86400000;

export function getTournamentEndDate(fecha) {
  return new Date(`${fecha}T23:59:59-04:00`);
}

export function resolveStatusKey(torneo, now = new Date()) {
  const explicit = typeof torneo?.estado === 'string' ? torneo.estado : '';

  if (explicit === 'cancelado') return 'cancelado';
  if (explicit === 'finalizado' || getTournamentEndDate(torneo.fecha) < now) return 'finalizado';
  if (explicit === 'lleno') return 'lleno';

  return 'abierto';
}

export function resolveStatus(torneo, now = new Date()) {
  const key = resolveStatusKey(torneo, now);
  return { key, ...TOURNAMENT_STATUS[key] };
}

export function getBoliviaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function getDiasHasta(fecha, todayKey) {
  const target = Date.parse(`${fecha}T00:00:00Z`);
  const today = Date.parse(`${todayKey}T00:00:00Z`);

  if (Number.isNaN(target) || Number.isNaN(today)) return null;

  return Math.round((target - today) / DAY_MS);
}

export function formatDiasHasta(dias) {
  if (!Number.isFinite(dias) || dias <= 0) return '';
  return dias === 1 ? 'Falta 1 día' : `Faltan ${dias} días`;
}
