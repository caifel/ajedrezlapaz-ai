import torneos from '../data/torneos.json';
import {
  TOURNAMENT_STATUS,
  getBoliviaDateKey,
  getDiasHasta,
  getTournamentEndDate,
  resolveStatusKey
} from './torneoStatus.js';

export { TOURNAMENT_STATUS, formatDiasHasta } from './torneoStatus.js';

const EVENT_LOCATION = {
  '@type': 'Place',
  name: 'Estadio Hernando Siles',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '5to piso, puerta #1',
    addressLocality: 'La Paz',
    addressRegion: 'La Paz',
    addressCountry: 'BO'
  }
};

export function getEventLinkLabel(url) {
  if (!url) return '';
  if (url.includes('lichess.org')) return 'Ver en Lichess';
  if (url.includes('chess-results.com')) return 'Chess-Results';
  return 'Ver evento';
}

export function getWhatsappUrl(whatsapp, message = '') {
  const digits = String(whatsapp ?? '').replace(/\D/g, '');
  if (!digits) return '';

  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function getTorneos(now = new Date()) {
  const todayKey = getBoliviaDateKey(now);

  return torneos.map((torneo) => {
    const dateEnd = getTournamentEndDate(torneo.fecha);
    const diasHasta = getDiasHasta(torneo.fecha, todayKey);
    const key = resolveStatusKey(torneo, now);
    const status = TOURNAMENT_STATUS[key];
    return {
      ...torneo,
      esPasado: dateEnd < now,
      esHoy: diasHasta === 0,
      diasHasta,
      esOnline: Boolean(torneo.online),
      estado: key,
      estadoLabel: status.label,
      estadoClass: status.className,
      enlaceLabel: getEventLinkLabel(torneo.enlace)
    };
  });
}

export function getEventSchema(torneo, siteUrl = 'https://ajedrezlapaz.com') {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: torneo.titulo,
    description: 'Torneo de ajedrez organizado por la Asociación Departamental de Ajedrez de La Paz.',
    startDate: torneo.fecha,
    eventStatus:
      torneo.estado === 'cancelado'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: torneo.esOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: 'es-BO',
    location: torneo.esOnline
      ? {
          '@type': 'VirtualLocation',
          url: 'https://lichess.org'
        }
      : EVENT_LOCATION,
    organizer: {
      '@type': 'SportsOrganization',
      name: 'Asociación Departamental de Ajedrez de La Paz',
      alternateName: 'ADALP',
      url: 'https://ajedrezlapaz.com'
    },
    url: new URL(`/torneos/${torneo.id}/`, siteUrl).href,
    ...(torneo.enlace ? { sameAs: [torneo.enlace] } : {})
  };
}
