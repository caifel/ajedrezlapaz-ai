import torneos from '../data/torneos.json';

export const TOURNAMENT_STATUS = {
  abierto: { label: 'Inscripciones abiertas', className: 'status-abierto' },
  lleno: { label: 'Cupo lleno', className: 'status-lleno' },
  finalizado: { label: 'Finalizado', className: 'status-finalizado' },
  cancelado: { label: 'Cancelado', className: 'status-cancelado' }
};

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
  return torneos.map((torneo) => {
    const explicit = typeof torneo.estado === 'string' ? torneo.estado : '';
    const dateEnd = new Date(`${torneo.fecha}T23:59:59-04:00`);
    let key = 'abierto';

    if (explicit === 'cancelado') {
      key = 'cancelado';
    } else if (explicit === 'finalizado' || dateEnd < now) {
      key = 'finalizado';
    } else if (explicit === 'lleno') {
      key = 'lleno';
    }

    const status = TOURNAMENT_STATUS[key];
    return {
      ...torneo,
      esPasado: dateEnd < now,
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
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: 'es-BO',
    location: EVENT_LOCATION,
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
