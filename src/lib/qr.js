const DEFAULT_VERIFIER_URL = 'https://verifier.ajedrezlapaz.com/verify';

/**
 * Convierte el campo opcional `qr` de un torneo en una URL pública.
 * Acepta una URL absoluta o el nombre del archivo dentro de `qr/`.
 */
export function getQrUrl(torneo, verifierUrl = DEFAULT_VERIFIER_URL) {
  const value = typeof torneo?.qr === 'string' ? torneo.qr.trim() : '';

  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  return new URL(`/qr/${encodeURIComponent(value)}`, verifierUrl).href;
}
