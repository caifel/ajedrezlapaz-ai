export const TOURNAMENT_STATUS = {
  abierto: { label: 'Inscripciones abiertas', className: 'status-abierto' },
  en_curso: { label: 'En curso', className: 'status-en-curso' },
  lleno: { label: 'Cupo lleno', className: 'status-lleno' },
  finalizado: { label: 'Finalizado', className: 'status-finalizado' },
  cancelado: { label: 'Cancelado', className: 'status-cancelado' }
};

export const TOURNAMENT_STATUS_CLASSES = Object.values(TOURNAMENT_STATUS).map(
  (status) => status.className
);

export function getTournamentStartDate(torneo) {
  return new Date(torneo.inicio);
}

export function getTournamentEndDate(torneo) {
  return new Date(torneo.fin);
}

export function resolveStatusKey(torneo, now = new Date()) {
  const explicit = typeof torneo?.estado === 'string' ? torneo.estado : '';

  if (explicit === 'cancelado') return 'cancelado';
  if (explicit === 'finalizado' || getTournamentEndDate(torneo) < now) return 'finalizado';
  if (explicit === 'lleno') return 'lleno';
  if (getTournamentStartDate(torneo) <= now) return 'en_curso';

  return 'abierto';
}

export function resolveStatus(torneo, now = new Date()) {
  const key = resolveStatusKey(torneo, now);
  return { key, ...TOURNAMENT_STATUS[key] };
}

export function formatDiasHasta(dias) {
  if (!Number.isFinite(dias) || dias <= 0) return '';
  return dias === 1 ? 'Falta 1 día' : `Faltan ${dias} días`;
}
