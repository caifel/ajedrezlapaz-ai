const DEFAULT_VERIFIER_URL = 'https://verifier.ajedrezlapaz.com/verify';

/**
 * Convierte el campo opcional `convocatoria` de un torneo en una URL pública.
 * Acepta una URL absoluta o el nombre del PDF dentro de `convocatorias/`.
 */
export function getConvocatoriaUrl(torneo, verifierUrl = DEFAULT_VERIFIER_URL) {
  const value =
    typeof torneo?.convocatoria === 'string' ? torneo.convocatoria.trim() : '';

  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  return new URL(`/convocatorias/${encodeURIComponent(value)}`, verifierUrl).href;
}
