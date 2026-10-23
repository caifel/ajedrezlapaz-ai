import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { getTorneos } from '../../lib/torneos.js';
import { getNombreLugarCorto, quitarEmojis } from '../../lib/seo.js';

type Torneo = ReturnType<typeof getTorneos>[number];

const WIDTH = 1200;
const HEIGHT = 630;
const BG = '#fafafa';
const TEXT = '#111111';
const MUTED = '#666666';
const GOLD = '#c4a77d';
const FONT = 'Arial, Helvetica, sans-serif';

const XML_ESCAPES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;'
};

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => XML_ESCAPES[char] ?? char);

const wrapText = (text: string, maxChars: number, maxLines: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;

  const trimmed = lines.slice(0, maxLines);
  trimmed[trimmed.length - 1] = `${trimmed[trimmed.length - 1].slice(0, maxChars - 1).trimEnd()}…`;
  return trimmed;
};

const buildSvg = (torneo: Torneo, logoBase64: string) => {
  const title = quitarEmojis(torneo.titulo);
  const fecha = torneo.fecha_texto.replace(/^Del /, 'del ');
  const lugar = torneo.esOnline ? 'Online · Lichess' : getNombreLugarCorto(torneo) || 'La Paz, Bolivia';

  let titleSize = 68;
  let titleMaxChars = 28;
  let titleMaxLines = 2;

  if (title.length <= 23) {
    titleSize = 84;
    titleMaxChars = 23;
    titleMaxLines = 1;
  } else if (title.length > 55) {
    titleSize = 54;
    titleMaxChars = 34;
    titleMaxLines = 3;
  }

  const titleLines = wrapText(title, titleMaxChars, titleMaxLines);
  const lineHeight = Math.round(titleSize * 1.1);
  const titleStartY = 270 - ((titleLines.length - 1) * lineHeight) / 2;
  const titleBottom = titleStartY + (titleLines.length - 1) * lineHeight;
  const dateY = Math.round(titleBottom + 110);
  const locationY = dateY + 54;
  const titleSpans = titleLines
    .map(
      (line, index) =>
        `<tspan x="600" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}" />
  <rect y="${HEIGHT - 10}" width="${WIDTH}" height="10" fill="${GOLD}" />
  <image href="data:image/png;base64,${logoBase64}" x="568" y="28" width="64" height="64" />
  <text x="600" y="132" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="700" letter-spacing="6" fill="${TEXT}">ADALP</text>
  <text x="600" y="${titleStartY}" text-anchor="middle" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="${TEXT}">${titleSpans}</text>
  <rect x="564" y="${dateY - 62}" width="72" height="4" fill="${GOLD}" />
  <text x="600" y="${dateY}" text-anchor="middle" font-family="${FONT}" font-size="48" font-weight="700" fill="${TEXT}">${escapeXml(fecha)}</text>
  <text x="600" y="${locationY}" text-anchor="middle" font-family="${FONT}" font-size="36" font-weight="400" fill="${MUTED}">${escapeXml(lugar)}</text>
</svg>`;
};

export function getStaticPaths() {
  return getTorneos().map((torneo) => ({
    params: { id: torneo.id },
    props: { torneo }
  }));
}

export async function GET({ props }: { props: { torneo: Torneo } }) {
  const logo = await readFile(join(process.cwd(), 'public/assets/logo-adalp.png'));
  const svg = buildSvg(props.torneo, logo.toString('base64'));
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
