# Despliegue y mantenimiento

Este documento explica qué se despliega automáticamente y qué requiere una acción manual.

## Datos del proyecto

- Repositorio: `caifel/ajedrezlapaz-ai`
- Sitio: `https://ajedrezlapaz.com`
- Worker: `https://adalp-verifier.mariomedranomaldonado.workers.dev`
- Endpoint de verificación: `https://adalp-verifier.mariomedranomaldonado.workers.dev/verify`

## Arquitectura

- El sitio es estático y se genera con Astro.
- GitHub Pages publica el contenido de `dist/`.
- Cloudflare Workers ejecuta el verificador de certificados.
- Las fechas de nacimiento y los celulares viven únicamente en el secreto `DATOS` del Worker.
- `src/data/jugadores.json` es público y no contiene fechas ni celulares.
- GitHub Actions tiene dos workflows:
  - `Deploy to GitHub Pages`: compila y publica el sitio.
  - `Deploy Worker`: despliega el código del Worker.

## Qué se despliega automáticamente

Al hacer push a `main`:

| Cambio | Workflow | Resultado |
|---|---|---|
| `src/pages/`, `src/components/`, `src/styles/` | `Deploy to GitHub Pages` | Sitio actualizado |
| `src/data/jugadores.json` | `Deploy to GitHub Pages` | Sitio actualizado |
| `public/` (logos, imágenes, `CNAME`) | `Deploy to GitHub Pages` | Archivos estáticos actualizados |
| `worker/src/index.js` | `Deploy Worker` | Worker actualizado |
| `worker/wrangler.toml` | `Deploy Worker` | Worker actualizado |
| `.github/workflows/deploy-worker.yml` | `Deploy Worker` | Worker actualizado |

Ambos workflows también se pueden ejecutar manualmente desde **Actions > [workflow] > Run workflow**.

El workflow del Worker se dispara únicamente con cambios en `worker/**` o en su propio archivo. Un cambio en `worker/datos.json` **no** lo dispara porque ese archivo está en `.gitignore`.

## Configuración de GitHub

### Environment `github-pages`

El environment `github-pages` contiene los secrets que usa el job del Worker:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Estos secrets solo están disponibles para jobs que declaren:

```yaml
environment: github-pages
```

El job `Deploy Worker` ya lo declara. El job `build` de Pages no lo declara, y eso es intencional para no exponer los secrets de Cloudflare al proceso de build.

### Variable `PUBLIC_VERIFIER_URL`

Debe estar en:

**Settings > Secrets and variables > Actions > Variables** (nivel repositorio)

```text
PUBLIC_VERIFIER_URL = https://adalp-verifier.mariomedranomaldonado.workers.dev/verify
```

Importante: si aparece con la etiqueta `github-pages`, está en el environment, no en las variables del repositorio. El job `build` de Pages no declara `environment`, así que no verá esa variable y el sitio se construirá con la URL vacía. En ese caso el modal mostrará "El verificador no está configurado".

No pongas `PUBLIC_VERIFIER_URL` en Secrets. Es una URL pública y el workflow la lee con `vars`, no con `secrets`.

Si se cambia la URL del Worker, actualiza esta variable y vuelve a ejecutar `Deploy to GitHub Pages`.

## Configuración de Cloudflare

Worker: `adalp-verifier`

El archivo `worker/wrangler.toml` define:

```toml
name = "adalp-verifier"
main = "src/index.js"
compatibility_date = "2024-11-01"
workers_dev = true
```

También define los orígenes permitidos:

```toml
[vars]
ALLOWED_ORIGINS = "https://ajedrezlapaz.com,https://www.ajedrezlapaz.com,http://localhost:4321,http://localhost:8791"
```

Si se agrega otro dominio, actualiza `ALLOWED_ORIGINS` y haz push. El workflow del Worker lo desplegará.

### Secreto `DATOS`

El Worker lee `env.DATOS`, no el archivo `worker/datos.json`. El formato es:

```json
{
  "ADALP-0001": {
    "fecha_nacimiento": "1946-01-01",
    "celular": "79580818"
  }
}
```

Para cargarlo o actualizarlo:

```bash
cd worker
jq -c . datos.json | npx wrangler secret put DATOS
npx wrangler secret list
```

`worker/datos.json` está en `.gitignore`. No se commitea, no se sube a GitHub y no se despliega con `wrangler deploy`.

## Qué es manual

| Acción | ¿Automático? | Cómo se hace |
|---|---|---|
| Cambiar páginas, estilos o componentes | Sí | Push a `main` |
| Cambiar `src/data/jugadores.json` | Sí | Push a `main` |
| Agregar o cambiar imágenes en `public/` | Sí | Push a `main` |
| Cambiar el código del Worker | Sí | Push a `main` |
| Cambiar `wrangler.toml` | Sí | Push a `main` |
| Cambiar fechas o celulares | **No** | `jq -c . datos.json \| npx wrangler secret put DATOS` |
| Cambiar `PUBLIC_VERIFIER_URL` | **No** | GitHub Variables + re-ejecutar Pages |
| Cambiar el token o Account ID | **No** | GitHub Environment secrets |
| Dominio del Worker, DNS, rate limiting | **No** | Dashboard de Cloudflare |
| Aprobaciones del environment | **No** | GitHub Environments |
| Respaldar `worker/datos.json` y el CSV | **No** | Copia privada local |

## Checklist: agregar o actualizar un jugador con certificado

1. Agregar o editar el jugador en `src/data/jugadores.json` con `"certificado": true`.
2. Agregar o editar su fecha y celular en `worker/datos.json`.
3. Actualizar el secreto:

   ```bash
   cd worker
   jq -c . datos.json | npx wrangler secret put DATOS
   ```

4. Hacer commit y push de los cambios públicos.
5. Verificar el endpoint con la fecha correcta.
6. Probar el modal en el sitio.

No agregues fechas ni celulares a `src/data/jugadores.json`. Ese archivo se publica en el HTML.

## Checklist: cambiar el token de Cloudflare

1. Crear el token en Cloudflare con la plantilla **Edit Cloudflare Workers**.
2. Actualizar el secret `CLOUDFLARE_API_TOKEN` en el environment `github-pages`.
3. Verificar que `CLOUDFLARE_ACCOUNT_ID` sea el ID correcto.
4. Ejecutar `Deploy Worker` manualmente.
5. Revisar el paso `Check Cloudflare secrets`; debe mostrar `PRESENTE`.

## Comandos útiles

```bash
npm install
npm run dev
npm run build
npm run preview
```

Worker:

```bash
cd worker
npx wrangler deploy
npx wrangler secret list
npx wrangler tail adalp-verifier
```

Prueba del endpoint:

```bash
curl -i -X POST "https://adalp-verifier.mariomedranomaldonado.workers.dev/verify" \
  -H "Content-Type: application/json" \
  -H "Origin: https://ajedrezlapaz.com" \
  -d '{"id":"ADALP-0001","fecha":"1946-01-01"}'
```

Respuesta esperada:

```json
{"ok":true}
```

## Diagnóstico

- `{"ok":false}`: el ID no está en `DATOS`, la fecha no coincide, o el jugador no tiene certificado.
- `500`: falta el secreto `DATOS` o no es JSON válido.
- `404`: la ruta debe ser `/verify`.
- `405`: debe ser `POST`.
- Sin `access-control-allow-origin`: el origen no está en `ALLOWED_ORIGINS`.
- El sitio muestra "El verificador no está configurado": `PUBLIC_VERIFIER_URL` no llegó al build. Debe estar en Variables del repositorio, no solo en el environment `github-pages`.
- El workflow del Worker falla con "not authenticated": los secrets del environment no están disponibles. Revisar `environment: github-pages` y los nombres de los secrets.
- El workflow del Worker falla con "You are not authenticated" pero el secreto existe: confirmar que el job declara `environment: github-pages`.

## Seguridad

- Las fechas y celulares viven solo en el secreto `DATOS` de Cloudflare.
- El Worker responde únicamente `{"ok": true}` o `{"ok": false}`; no devuelve datos privados.
- La generación del certificado es del lado del cliente. El Worker es una compuerta de verificación, no una firma criptográfica.
- Si se colocan imágenes de certificados en `public/`, son públicamente accesibles sin verificar. Para protección real, servirlas desde el Worker o usar enlaces firmados.
- Mantener un respaldo privado de `worker/datos.json` y del CSV. El secreto `DATOS` no se puede leer de vuelta desde Cloudflare.
- Si el token se expone, eliminarlo en Cloudflare y crear otro.

## Certificados

Actualmente el certificado se genera como HTML y se abre el diálogo de impresión (`window.print()`). No se descarga un PNG/JPG.

Si se agregan imágenes, la carpeta prevista es:

```text
public/certificados/
```

Por ejemplo:

```text
public/certificados/ADALP-0001.png
```

Astro copia `public/` a `dist/`, por lo que la imagen quedaría disponible en:

```text
/certificados/ADALP-0001.png
```

La implementación de descarga de imágenes está pendiente de definir. Las opciones son:

1. Imágenes ya hechas, una por jugador, enlazadas desde el modal.
2. Generar un PNG en el navegador después de verificar la fecha.
3. Mantener el certificado actual y guardarlo como PDF desde el diálogo de impresión.

Ten en cuenta que las imágenes en `public/` son públicas y se pueden descargar sin pasar por el verificador.

## Estructura relevante

```text
src/
  components/       Header y Footer
  data/             JSON públicos (sin datos privados)
  layouts/          Layout base
  pages/            index, jugadores, galeria
  styles/           CSS global
public/             Archivos estáticos que se copian a dist/
worker/
  src/index.js      Worker verificador
  wrangler.toml     Configuración del Worker
.github/workflows/
  deploy.yml        Build y deploy de GitHub Pages
  deploy-worker.yml Deploy del Worker
```
