# Despliegue y mantenimiento

Este documento explica qué se despliega automáticamente y qué requiere una acción manual.

## Datos del proyecto

- Repositorio: `caifel/ajedrezlapaz-ai`
- Sitio: `https://ajedrezlapaz.com`
- Worker: `https://verifier.ajedrezlapaz.com`
- Endpoint de verificación: `https://verifier.ajedrezlapaz.com/verify`
- Endpoint de descarga: `https://verifier.ajedrezlapaz.com/certificado`
- URL alterna: `https://adalp-verifier.mariomedranomaldonado.workers.dev`

## Arquitectura

- El sitio es estático y se genera con Astro.
- GitHub Pages publica el contenido de `dist/`.
- Cloudflare Workers ejecuta el verificador de certificados.
- Las fechas de nacimiento y los celulares viven únicamente en el secreto `DATOS` del Worker.
- `src/data/jugadores.json` es público y no contiene fechas ni celulares.
- Los certificados PNG viven en el bucket R2 privado `adalp`, dentro de `cc-2026/`.
- El Worker valida la fecha y entrega el PNG mediante el binding `CERTIFICADOS`; el bucket no es público.
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

El sitio se despliega **solo con push a `main`** (o ejecución manual). No hay cron: los estados visibles no dependen del build porque la portada, `/torneos/` y la página de detalle recalculan y reubican en el navegador; un torneo que termina entre dos despliegues se muestra como finalizado al instante. Los metadatos (JSON-LD, `sitemap.xml`) se actualizan en el siguiente push.

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
PUBLIC_VERIFIER_URL = https://verifier.ajedrezlapaz.com/verify
```

El frontend usa esta URL para `/verify` y deriva `/certificado` cambiando solo la ruta.

Importante: si aparece con la etiqueta `github-pages`, está en el environment, no en las variables del repositorio. El job `build` de Pages no declara `environment`, así que no verá esa variable y el sitio se construirá con la URL vacía. En ese caso el modal mostrará "El servicio de certificados no está configurado".

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
| Subir o reemplazar certificados PNG | **No** | Dashboard de R2 o `npx wrangler r2 object put` |
| Cambiar `PUBLIC_VERIFIER_URL` | **No** | GitHub Variables + re-ejecutar Pages |
| Cambiar el token o Account ID | **No** | GitHub Environment secrets |
| Dominio del Worker, DNS, rate limiting | **No** | Dashboard de Cloudflare |
| Aprobaciones del environment | **No** | GitHub Environments |
| Respaldar `worker/datos.json` y el CSV | **No** | Copia privada local |

### Bucket R2 `adalp`

El Worker tiene este binding en `worker/wrangler.toml`:

```toml
[[r2_buckets]]
binding = "CERTIFICADOS"
bucket_name = "adalp"
```

Los certificados deben estar en el bucket privado `adalp` con este formato de clave:

```text
cc-2026/ADALP-0001-CC-2026.png
```

Para subir o reemplazar uno:

```bash
npx wrangler r2 object put "adalp/cc-2026/ADALP-0001-CC-2026.png" \
  --file "ruta/al/certificado.png" \
  --content-type "image/png"
```

Para comprobar una clave concreta:

```bash
npx wrangler r2 object get "adalp/cc-2026/ADALP-0001-CC-2026.png" \
  --file "/tmp/certificado.png"
```

Wrangler no tiene un comando `r2 object list`. Para ver todas las claves, usa el dashboard de Cloudflare:

**R2 > adalp > Objects > prefijo `cc-2026/`**

También se puede listar con la API S3 de R2 usando `aws s3 ls` y credenciales S3, pero no es necesario para operar el sitio.

El bucket no debe tener acceso público. La única forma de descargar un certificado es pasar por el Worker, que valida `id` + `fecha` antes de leer el objeto.

### Rate limiting

Configurar en el dashboard de Cloudflare, seleccionando la zona `ajedrezlapaz.com`:

**Security > WAF > Rate limiting rules > Create rule**

Regla sugerida:

- Nombre: `ADALP certificados`
- Expresión:

  ```txt
  (http.request.uri.path eq "/certificado") or (http.request.uri.path eq "/verify")
  ```

- Límite: `10` solicitudes por `1 minuto`
- Contador: por IP
- Acción: `Block` durante `10 minutos` o `Managed Challenge`

El rate limiting solo aplica si `verifier.ajedrezlapaz.com` está proxied por Cloudflare; los dominios `workers.dev` no pasan por las reglas WAF de la zona.

## Checklist: agregar o actualizar un jugador con certificado

1. Agregar o editar el jugador en `src/data/jugadores.json` con `"certificado": true`.
2. Agregar o editar su fecha y celular en `worker/datos.json`.
3. Subir el PNG a R2 como `cc-2026/ADALP-XXXX-CC-2026.png`.
4. Actualizar el secreto:

   ```bash
   cd worker
   jq -c . datos.json | npx wrangler secret put DATOS
   ```

5. Hacer commit y push de los cambios públicos.
6. Verificar `/verify` con la fecha correcta.
7. Probar la descarga desde el modal del sitio.

No agregues fechas ni celulares a `src/data/jugadores.json`. Ese archivo se publica en el HTML.

## Checklist: cambiar el token de Cloudflare

1. Crear el token en Cloudflare con la plantilla **Edit Cloudflare Workers**.
2. Agregar el permiso de cuenta **Workers R2 Storage: Edit**, necesario para desplegar el binding `CERTIFICADOS`.
3. Actualizar el secret `CLOUDFLARE_API_TOKEN` en el environment `github-pages`.
4. Verificar que `CLOUDFLARE_ACCOUNT_ID` sea el ID correcto.
5. Ejecutar `Deploy Worker` manualmente.
6. Revisar el paso `Check Cloudflare secrets`; debe mostrar `PRESENTE`.

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
curl -i -X POST "https://verifier.ajedrezlapaz.com/verify" \
  -H "Content-Type: application/json" \
  -H "Origin: https://ajedrezlapaz.com" \
  -d '{"id":"ADALP-0001","fecha":"1946-01-01"}'
```

Respuesta esperada:

```json
{"ok":true}
```

Descarga del certificado:

```bash
curl -X POST "https://verifier.ajedrezlapaz.com/certificado" \
  -H "Content-Type: application/json" \
  -H "Origin: https://ajedrezlapaz.com" \
  -d '{"id":"ADALP-0001","fecha":"1946-01-01"}' \
  -o certificado.png

file certificado.png
```

El archivo debe ser `PNG image data`.

## Diagnóstico

- `/verify` responde `{"ok":false}`: el ID no está en `DATOS` o la fecha no coincide.
- `/certificado` responde `403`: la fecha no coincide con `DATOS`.
- `/certificado` responde `404` con `certificate_not_found`: no existe el PNG en R2 para ese ID.
- `/certificado` responde `500` con `certificates_not_configured`: falta el binding `CERTIFICADOS` o el bucket no está configurado.
- `500` con `server_config`: falta el secreto `DATOS` o no es JSON válido.
- `404` con `not_found`: la ruta debe ser `/verify` o `/certificado`.
- `405`: debe ser `POST`.
- Sin `access-control-allow-origin`: el origen no está en `ALLOWED_ORIGINS`.
- El sitio muestra "El servicio de certificados no está configurado": `PUBLIC_VERIFIER_URL` no llegó al build o no es una URL absoluta.
- El workflow del Worker falla con "not authenticated": los secrets del environment no están disponibles. Revisar `environment: github-pages` y los nombres de los secrets.
- El workflow del Worker falla con "You are not authenticated" pero el secreto existe: confirmar que el job declara `environment: github-pages`.

### Error 1006: Could not resolve the host name

El error 1006 es de DNS, no del código del Worker. Suele ocurrir cuando se abre una URL de `workers.dev` que no existe o que la red no puede resolver.

Revisar en este orden:

1. Confirmar que el Worker está desplegado:

   ```bash
   npx wrangler deployments list
   ```

2. Confirmar el nombre real del Worker y el subdominio de la cuenta. La URL debe tener el formato:

   ```text
   https://<nombre-del-worker>.<subdominio-de-la-cuenta>.workers.dev
   ```

3. En el dashboard de Cloudflare, revisar **Workers & Pages > adalp-verifier > Settings > Domains & Routes**. El subdominio `workers.dev` debe estar habilitado.

4. Probar el DNS desde otra red o con datos móviles:

   ```bash
   nslookup adalp-verifier.mariomedranomaldonado.workers.dev
   curl -i https://adalp-verifier.mariomedranomaldonado.workers.dev/verify
   ```

   Un `GET` al endpoint debe responder `405`, no un error de DNS.

5. Si `workers.dev` está bloqueado por la red o el ISP, usar un dominio propio para el Worker. Por ejemplo:

   ```text
   verifier.ajedrezlapaz.com
   ```

   Se configura en **Workers & Pages > adalp-verifier > Settings > Domains & Routes > Add custom domain**. Luego se actualiza `PUBLIC_VERIFIER_URL` a:

   ```text
   https://verifier.ajedrezlapaz.com/verify
   ```

   y se vuelve a ejecutar el deploy de GitHub Pages.

## Seguridad

- Las fechas y celulares viven solo en el secreto `DATOS` de Cloudflare.
- El bucket R2 `adalp` debe ser privado. No debe tener dominio público ni acceso directo.
- La única vía de descarga es `/certificado`, que valida `id` + `fecha` antes de leer R2.
- El Worker no devuelve fechas ni celulares; solo entrega el PNG cuando la fecha coincide.
- Mantener un respaldo privado de `worker/datos.json` y del CSV. El secreto `DATOS` no se puede leer de vuelta desde Cloudflare.
- Si el token se expone, eliminarlo en Cloudflare y crear otro.
- Se recomienda configurar rate limiting en Cloudflare para `/certificado` y `/verify`, porque la fecha de nacimiento tiene poca entropía.

## Certificados

Los certificados son PNG generados previamente y almacenados en R2:

```text
Bucket: adalp
Clave: cc-2026/ADALP-XXXX-CC-2026.png
```

El flujo actual es:

1. El jugador abre su perfil y escribe su fecha de nacimiento.
2. El sitio hace `POST /certificado` al Worker.
3. El Worker verifica la fecha contra el secreto `DATOS`.
4. Si coincide, busca el PNG en R2 y lo devuelve con `Content-Disposition: attachment`.
5. El navegador descarga el archivo.

El bucket no debe ser público. Las imágenes no se guardan en `public/` ni en GitHub Pages.

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
