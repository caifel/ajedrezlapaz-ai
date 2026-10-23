#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if ! command -v jq >/dev/null 2>&1; then
  echo "Falta jq. Instálalo con: brew install jq" >&2
  exit 1
fi

if [ ! -f datos.json ]; then
  echo "No existe worker/datos.json" >&2
  exit 1
fi

payload="$(jq -c 'with_entries(.value |= {fecha_nacimiento})' datos.json)"
bytes="$(printf '%s' "$payload" | wc -c | tr -d ' ')"

if [ "$bytes" -gt 5100 ]; then
  echo "El payload pesa ${bytes} B y supera el límite de 5.1 kB." >&2
  echo "Revisa worker/datos.json o migra a KV/R2." >&2
  exit 1
fi

if [ "${1:-}" = "--dry-run" ]; then
  echo "Dry run OK: DATOS pesa ${bytes} B (límite 5.1 kB)."
  echo "No se subió nada a Cloudflare."
  exit 0
fi

echo "Subiendo DATOS (${bytes} B) a Cloudflare..."
printf '%s' "$payload" | npx wrangler secret put DATOS
