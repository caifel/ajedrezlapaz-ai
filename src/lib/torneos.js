import torneos from '../data/torneos.json';
import {
  TOURNAMENT_STATUS,
  getTournamentEndDate,
  getTournamentStartDate,
  resolveStatusKey
} from './torneoStatus.js';
import { getBoliviaDateKey, getDiasHasta } from './fechas.js';
import { formatFechaTexto, formatHorario } from './formatoFechas.js';
import { getOrganizadores } from './organizaciones.js';
import { getDescripcionEvento } from './seo.js';

export { TOURNAMENT_STATUS, formatDiasHasta } from './torneoStatus.js';
export { formatFechaTexto, formatHorario };

const VENUES = [
  {
    match: 'Estadio Hernando Siles',
    name: 'Estadio Hernando Siles',
    streetAddress: '5to piso, puerta #1'
  },
  {
    match: 'Hotel Torino',
    name: 'Hotel Torino',
    streetAddress: 'calle Socabaya #457'
  },
  {
    match: 'Unidad Educativa Naval',
    name: 'Unidad Educativa Naval',
    streetAddress: 'Av. Ismael Montes 421'
  }
];

const getLugarTorneo = (torneo) => {
  const detalle = (torneo.detalles ?? []).find((item) => item.includes('📍'));
  return detalle ? detalle.replace('📍', '').trim() : '';
};

const getEventLocation = (torneo) => {
  if (torneo.esOnline) {
    return {
      '@type': 'VirtualLocation',
      url: 'https://lichess.org'
    };
  }

  const lugar = torneo.lugar || getLugarTorneo(torneo);
  const venue = VENUES.find((item) => lugar.includes(item.match));

  return {
    '@type': 'Place',
    name: venue?.name || lugar || 'La Paz, Bolivia',
    address: {
      '@type': 'PostalAddress',
      ...(venue?.streetAddress ? { streetAddress: venue.streetAddress } : {}),
      addressLocality: 'La Paz',
      addressRegion: 'La Paz',
      addressCountry: 'BO'
    }
  };
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

export function getPrecioNumerico(precio) {
  if (typeof precio === 'number') return Number.isFinite(precio) ? precio : null;

  const texto = String(precio ?? '').trim();
  if (!texto) return null;

  const numero = Number(texto.replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

export function getPrecioTexto(precio) {
  const numero = getPrecioNumerico(precio);
  if (numero !== null) {
    const formateado = new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(numero);

    return `${formateado} Bs.`;
  }

  return String(precio ?? '').trim();
}

export function getTorneos(now = new Date()) {
  const todayKey = getBoliviaDateKey(now);

  return torneos.map((torneo) => {
    const dateEnd = getTournamentEndDate(torneo);
    const dateStart = getTournamentStartDate(torneo);

    if (Number.isNaN(dateStart.getTime()) || Number.isNaN(dateEnd.getTime())) {
      throw new Error(
        `Fechas inválidas en el torneo "${torneo.id}". Revisa "inicio" y "fin" en src/data/torneos.json.`
      );
    }

    if (dateEnd < dateStart) {
      throw new Error(
        `El torneo "${torneo.id}" termina antes de empezar. Revisa "inicio" y "fin" en src/data/torneos.json.`
      );
    }

    const diasHasta = getDiasHasta(getBoliviaDateKey(dateStart), todayKey);
    const key = resolveStatusKey(torneo, now);
    const status = TOURNAMENT_STATUS[key];
    return {
      ...torneo,
      fecha_texto: formatFechaTexto(torneo.inicio, torneo.fin),
      horario: formatHorario(torneo.inicio, torneo.fin),
      organizadores: getOrganizadores(torneo.organizadores),
      lugar: getLugarTorneo(torneo),
      precioTexto: getPrecioTexto(torneo.precio),
      precioNumero: getPrecioNumerico(torneo.precio),
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
  const organizadores = getOrganizadores(torneo.organizadores);
  const organizerSchema = organizadores.map((organizacion) => ({
    '@type': 'SportsOrganization',
    name: organizacion.nombre,
    ...(organizacion.corto ? { alternateName: organizacion.corto } : {}),
    url: new URL(organizacion.url, siteUrl).href
  }));
  const eventUrl = new URL(`/torneos/${torneo.id}/`, siteUrl).href;

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: torneo.titulo,
    description: getDescripcionEvento(torneo),
    startDate: torneo.inicio,
    endDate: torneo.fin,
    image: new URL(`/og/${torneo.id}.png`, siteUrl).href,
    eventStatus:
      torneo.estado === 'cancelado'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: torneo.esOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: 'es-BO',
    location: getEventLocation(torneo),
    organizer: organizerSchema.length === 1 ? organizerSchema[0] : organizerSchema,
    offers: {
      '@type': 'Offer',
      price: getPrecioNumerico(torneo.precio) ?? 0,
      priceCurrency: 'BOB',
      availability:
        torneo.estado === 'abierto'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      url: eventUrl
    },
    url: eventUrl,
    ...(torneo.enlace ? { sameAs: [torneo.enlace] } : {})
  };
}
