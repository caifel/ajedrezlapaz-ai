#!/usr/bin/env node
/**
 * Reporte privado de jugadores por categoría de edad y sexo.
 *
 * Uso:
 *   npm run reporte:jugadores
 *   npm run reporte:jugadores -- --year=2026
 *   npm run reporte:jugadores -- --sexo=F
 *   npm run reporte:jugadores -- --sub=14
 *   npm run reporte:jugadores -- --sub=14 --elegibles
 *   npm run reporte:jugadores -- --json
 *   npm run reporte:jugadores -- --plantilla > worker/sexo.json
 *
 * Fuentes:
 *   src/data/jugadores.json  -> id, nombre, categoría competitiva
 *   worker/datos.json        -> fecha_nacimiento y, opcionalmente, sexo
 *   worker/sexo.json         -> mapa opcional { "ADALP-0001": "M" }
 *
 * El reporte nunca imprime la fecha de nacimiento ni escribe en src/ o public/.
 * No está pensado para ejecutarse en CI.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_PATH = path.join(ROOT, 'src/data/jugadores.json');
const PRIVATE_PATH = path.join(ROOT, 'worker/datos.json');
const SEXO_PATH = path.join(ROOT, 'worker/sexo.json');

const args = new Map();
for (const raw of process.argv.slice(2)) {
  if (!raw.startsWith('--')) continue;
  const [key, value] = raw.slice(2).split('=');
  args.set(key, value ?? true);
}

const referenceYear = Number(args.get('year') ?? new Date().getFullYear());
const seniorMinAge = Number(args.get('senior') ?? 56);

if (process.env.CI && !args.has('force')) {
  console.error('Este reporte contiene datos personales. No se ejecuta en CI (usa --force solo si es intencional).');
  process.exit(1);
}

if (!Number.isInteger(referenceYear) || referenceYear < 1900) {
  console.error('Año de referencia inválido. Usa por ejemplo --year=2026.');
  process.exit(1);
}

if (!Number.isInteger(seniorMinAge) || seniorMinAge < 21) {
  console.error('Edad mínima de Senior inválida. Usa por ejemplo --senior=56.');
  process.exit(1);
}

const SEX_ORDER = { M: 0, F: 1, '': 2 };

const BRACKETS = [
  { key: 'sub-10', label: `Sub-10 (no cumple 11 en ${referenceYear})`, maxAge: 10 },
  { key: 'sub-12', label: `Sub-12 (no cumple 13 en ${referenceYear})`, maxAge: 12 },
  { key: 'sub-14', label: `Sub-14 (no cumple 15 en ${referenceYear})`, maxAge: 14 },
  { key: 'sub-16', label: `Sub-16 (no cumple 17 en ${referenceYear})`, maxAge: 16 },
  { key: 'sub-18', label: `Sub-18 (no cumple 19 en ${referenceYear})`, maxAge: 18 },
  { key: 'sub-20', label: `Sub-20 (no cumple 21 en ${referenceYear})`, maxAge: 20 },
  {
    key: 'absoluta',
    label: `Absoluta (21–${seniorMinAge - 1} años en ${referenceYear})`,
    maxAge: seniorMinAge - 1
  },
  { key: 'senior', label: `Senior (${seniorMinAge}+ años en ${referenceYear})`, maxAge: Infinity }
];

const GROUP_ORDER = [...BRACKETS.map((bracket) => bracket.key), 'sin'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(file, label) {
  if (!existsSync(file)) {
    fail(`No existe ${label}: ${path.relative(ROOT, file)}`);
  }

  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`No se pudo leer ${label} (${path.relative(ROOT, file)}): ${error.message}`);
  }
}

function normalizeSexo(value) {
  if (typeof value !== 'string') return '';

  const normalized = value.trim().toUpperCase();
  if (['M', 'MASCULINO', 'HOMBRE', 'VARON', 'VARÓN'].includes(normalized)) return 'M';
  if (['F', 'FEMENINO', 'MUJER'].includes(normalized)) return 'F';
  return '';
}

function getBirthYear(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;

  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return year;
}

function getBracket(age) {
  if (!Number.isInteger(age) || age < 0) return null;
  return BRACKETS.find((bracket) => age <= bracket.maxAge) ?? null;
}

function normalizeSubFilter(value) {
  const normalized = String(value).toLowerCase();

  if (['sin', 'sin-categoria', 'sin-categoría'].includes(normalized)) return 'sin';
  if (['absoluta', 'absoluto', 'mayores'].includes(normalized)) return 'absoluta';
  if (normalized === 'senior') return 'senior';

  const match = normalized.match(/^(?:sub-?)?(\d{1,2})$/);
  return match ? `sub-${match[1]}` : normalized;
}

function esElegibleParaSub(row, subKey) {
  const match = /^sub-(\d+)$/.exec(subKey);
  if (!match || !Number.isInteger(row.age)) return false;
  return row.age <= Number(match[1]);
}

const players = readJson(PUBLIC_PATH, 'padrón público');

if (!Array.isArray(players)) {
  fail('El padrón público debe ser un arreglo.');
}

if (args.has('plantilla')) {
  const template = Object.fromEntries(
    players.map((player) => [player.id, ''])
  );

  console.log(JSON.stringify(template, null, 2));
  process.exit(0);
}

const privateData = readJson(PRIVATE_PATH, 'datos privados');
const sexoOverrides = existsSync(SEXO_PATH)
  ? readJson(SEXO_PATH, 'mapa de sexo')
  : {};

if (privateData === null || typeof privateData !== 'object' || Array.isArray(privateData)) {
  fail('Los datos privados deben ser un objeto indexado por ID.');
}

const publicIds = new Set(players.map((player) => player.id));
const privateIds = new Set(Object.keys(privateData));
const extraPrivate = [...privateIds].filter((id) => !publicIds.has(id));

const rows = players.map((player) => {
  const privateRecord = privateData[player.id] ?? {};
  const birthYear = getBirthYear(privateRecord.fecha_nacimiento);
  const age = birthYear === null ? null : referenceYear - birthYear;
  const bracket = getBracket(age);

  const sexoSource = privateRecord.sexo || sexoOverrides[player.id];
  const sexo = normalizeSexo(sexoSource);

  let motivo = '';
  if (!privateIds.has(player.id)) {
    motivo = 'sin registro privado';
  } else if (birthYear === null) {
    motivo = 'sin fecha de nacimiento válida';
  } else if (age < 0) {
    motivo = 'fecha de nacimiento futura';
  }

  return {
    id: player.id,
    nombre: player.nombre,
    categoria: player.categoria ?? '',
    sexo,
    age,
    bracket,
    motivo,
    sexoInvalido: Boolean(sexoSource) && !sexo
  };
});

const sexoFilter = args.has('sexo') ? String(args.get('sexo')).toUpperCase() : null;
const subFilter = args.has('sub') ? normalizeSubFilter(args.get('sub')) : null;
const soloElegibles = args.has('elegibles') && subFilter?.startsWith('sub-');

const filteredRows = rows.filter((row) => {
  if (sexoFilter === '?' || sexoFilter === 'SIN') {
    if (row.sexo !== '') return false;
  } else if (sexoFilter && row.sexo !== sexoFilter) {
    return false;
  }

  if (subFilter) {
    const key = row.bracket?.key ?? 'sin';
    if (soloElegibles) {
      if (!esElegibleParaSub(row, subFilter)) return false;
    } else if (key !== subFilter) {
      return false;
    }
  }

  return true;
});

const groups = new Map(
  GROUP_ORDER.map((key) => {
    const bracket = BRACKETS.find((item) => item.key === key);
    return [key, { label: bracket?.label ?? 'Sin categoría', rows: [] }];
  })
);

for (const row of filteredRows) {
  const key = row.bracket?.key ?? 'sin';
  groups.get(key).rows.push(row);
}

for (const group of groups.values()) {
  group.rows.sort(
    (a, b) => SEX_ORDER[a.sexo] - SEX_ORDER[b.sexo] || a.nombre.localeCompare(b.nombre, 'es')
  );
}

const totals = filteredRows.reduce(
  (accumulator, row) => {
    accumulator.total += 1;
    accumulator[row.sexo] += 1;
    return accumulator;
  },
  { total: 0, M: 0, F: 0, '': 0 }
);

const missingSexo = filteredRows.filter((row) => !row.sexo);
const invalidSexo = filteredRows.filter((row) => row.sexoInvalido);
const missingPrivate = players.filter((player) => !privateIds.has(player.id));

if (args.has('json')) {
  const payload = {
    referenceYear,
    seniorMinAge,
    elegibles: soloElegibles,
    total: totals.total,
    sexo: { M: totals.M, F: totals.F, sinDato: totals[''] },
    groups: Object.fromEntries(
      [...groups].map(([key, group]) => [
        key,
        {
          label: group.label,
          total: group.rows.length,
          players: group.rows.map((row) => ({
            id: row.id,
            nombre: row.nombre,
            categoria: row.categoria,
            sexo: row.sexo || null,
            edad: row.age,
            bracketActual: row.bracket?.key ?? 'sin',
            motivo: row.motivo || undefined
          }))
        }
      ])
    )
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const output = [];
output.push('# Reporte privado de jugadores');
output.push('');
output.push(`Referencia: ${referenceYear} · categorías por año de nacimiento`);
output.push(
  `Total: ${totals.total} · M: ${totals.M} · F: ${totals.F} · Sin dato: ${totals['']}`
);

if (soloElegibles) {
  const subAge = subFilter.replace('sub-', '');
  output.push(
    `Modo elegibilidad: Sub-${subAge} incluye brackets menores (no cumple ${Number(subAge) + 1} en ${referenceYear})`
  );
}

if (sexoFilter || subFilter) {
  output.push(
    `Filtros: sexo=${sexoFilter ?? 'todos'} · sub=${subFilter ?? 'todas'}${soloElegibles ? ' · modo=elegibles' : ''}`
  );
}

output.push('');

for (const key of GROUP_ORDER) {
  const group = groups.get(key);
  if (group.rows.length === 0) continue;

  output.push(`## ${group.label} (${group.rows.length})`);
  output.push('');

  if (key === 'sin') {
    output.push('| Sexo | ID | Nombre | Cat. | Motivo |');
    output.push('|---|---|---|---|---|');
    for (const row of group.rows) {
      output.push(
        `| ${row.sexo || '?'} | ${row.id} | ${row.nombre} | ${row.categoria || '—'} | ${row.motivo || '—'} |`
      );
    }
  } else if (soloElegibles) {
    output.push('| Sexo | ID | Nombre | Cat. | Edad | Bracket actual |');
    output.push('|---|---|---|---|---|---|');
    for (const row of group.rows) {
      output.push(
        `| ${row.sexo || '?'} | ${row.id} | ${row.nombre} | ${row.categoria || '—'} | ${row.age ?? '—'} | ${row.bracket?.key ?? 'sin'} |`
      );
    }
  } else {
    output.push('| Sexo | ID | Nombre | Cat. | Edad |');
    output.push('|---|---|---|---|---|');
    for (const row of group.rows) {
      output.push(
        `| ${row.sexo || '?'} | ${row.id} | ${row.nombre} | ${row.categoria || '—'} | ${row.age ?? '—'} |`
      );
    }
  }

  output.push('');
}

if (missingPrivate.length > 0) {
  output.push(
    `Aviso: ${missingPrivate.length} jugadores sin registro privado: ${missingPrivate.map((player) => player.id).join(', ')}`
  );
}

if (missingSexo.length > 0) {
  output.push(
    `Aviso: ${missingSexo.length} jugadores sin sexo. Agrega "sexo": "M"|"F" en worker/datos.json o crea worker/sexo.json.`
  );
  output.push('Puedes generar la plantilla con: npm run reporte:jugadores -- --plantilla > worker/sexo.json');
}

if (invalidSexo.length > 0) {
  output.push(
    `Aviso: ${invalidSexo.length} registros tienen un valor de sexo no reconocido: ${invalidSexo.map((row) => row.id).join(', ')}`
  );
}

if (extraPrivate.length > 0) {
  output.push(
    `Aviso: ${extraPrivate.length} registros privados no tienen ficha pública: ${extraPrivate.join(', ')}`
  );
}

output.push('');
output.push('Nota: el reporte normal asigna cada jugador a su bracket actual (un Sub-10 no se repite en Sub-12).');
output.push('Usa --elegibles junto a --sub=N para incluir también los brackets menores que pueden jugar esa categoría.');
output.push('Este reporte no debe publicarse ni compartirse fuera del ámbito de la asociación.');

console.log(output.join('\n'));
