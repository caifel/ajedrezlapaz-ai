# ADALP - Ajedrez La Paz

Sitio estático en Astro con verificador de certificados en Cloudflare Workers.

## Desarrollo

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Despliegue

- Push a `main` despliega el sitio en GitHub Pages.
- Push a `main` con cambios en `worker/` despliega el Worker.
- Las fechas y celulares se actualizan manualmente como secreto `DATOS`.
- `PUBLIC_VERIFIER_URL` debe estar en las variables del repositorio, no solo en el environment `github-pages`.

El detalle completo de qué es automático y qué es manual está en:

[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
