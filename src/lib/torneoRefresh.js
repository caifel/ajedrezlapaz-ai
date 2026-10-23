import {
  TOURNAMENT_STATUS_CLASSES,
  formatDiasHasta,
  getTournamentEndDate,
  resolveStatus
} from './torneoStatus.js';
import { getBoliviaDateKey, getDiasHasta } from './fechas.js';

const CARD_SELECTOR = '.news-card[data-inicio]';

/**
 * Refresca un torneo ya renderizado: estado, contador de días, badge HOY y CTA.
 * Sirve tanto para las tarjetas como para la cabecera de la página de detalle.
 */
export function refreshTorneo(root) {
  const { inicio, fin, estado } = root.dataset;
  const status = resolveStatus({ inicio, fin, estado });
  const diasHasta = getDiasHasta(getBoliviaDateKey(new Date(inicio)), getBoliviaDateKey());

  // Refleja el estado actual para los estilos que dependen de él.
  root.dataset.estado = status.key;

  // La tarjeta usa el estado también para el color del borde izquierdo.
  if (root.matches('.news-card')) {
    root.classList.remove(...TOURNAMENT_STATUS_CLASSES);
    root.classList.add(status.className);
  }

  const statusBadge = root.querySelector('[data-status-badge]');
  if (statusBadge) {
    statusBadge.classList.remove(...TOURNAMENT_STATUS_CLASSES);
    statusBadge.classList.add(status.className);
    statusBadge.textContent = status.label;
  }

  const days = root.querySelector('[data-days]');
  if (days) {
    const showDays = Number.isFinite(diasHasta) && diasHasta > 0;
    days.hidden = !showDays;
    days.textContent = showDays ? formatDiasHasta(diasHasta) : '';
  }

  const today = root.querySelector('[data-today]');
  if (today) today.hidden = diasHasta !== 0;

  const cta = root.querySelector('[data-cta="inscribirme"]');
  if (cta) cta.hidden = status.key !== 'abierto';
}

const sortGrid = (grid, direction) => {
  const cards = [...grid.querySelectorAll(CARD_SELECTOR)];

  cards.sort((a, b) =>
    direction === 'asc'
      ? a.dataset.inicio.localeCompare(b.dataset.inicio)
      : b.dataset.inicio.localeCompare(a.dataset.inicio)
  );

  cards.forEach((card) => grid.append(card));
};

/**
 * Reubica las tarjetas entre "Próximos" y "Torneos anteriores" usando la fecha
 * real, porque el HTML se generó en el último despliegue. En la portada, que no
 * tiene sección de anteriores, oculta las tarjetas ya finalizadas.
 */
export function syncTorneosLayout(now = new Date()) {
  const proximos = document.querySelector('[data-torneos-grid="proximos"]');
  const anteriores = document.querySelector('[data-torneos-grid="anteriores"]');

  if (!proximos && !anteriores) return;

  document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
    const { inicio, fin } = card.dataset;
    const esPasado = getTournamentEndDate({ inicio, fin }) < now;

    if (esPasado) {
      if (anteriores) {
        card.hidden = false;
        if (card.parentElement !== anteriores) anteriores.append(card);
      } else if (card.parentElement === proximos) {
        card.hidden = true;
      }
    } else if (proximos && card.parentElement !== proximos) {
      card.hidden = false;
      proximos.append(card);
    }
  });

  if (proximos) sortGrid(proximos, 'asc');
  if (anteriores) sortGrid(anteriores, 'desc');

  [proximos, anteriores].forEach((grid) => {
    if (!grid) return;

    const hasCards = [...grid.querySelectorAll(CARD_SELECTOR)].some((card) => !card.hidden);
    const empty = grid.parentElement.querySelector('[data-empty]');

    if (empty) empty.hidden = hasCards;
    grid.hidden = !hasCards;
  });
}
