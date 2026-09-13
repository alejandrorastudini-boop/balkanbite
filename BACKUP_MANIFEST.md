# BACKUP MANIFEST — BalkanBite

- Proyecto: BalkanBite
- Fecha: 2026-09-13
- Repositorio: `alejandrorastudini-boop/balkanbite`
- Rama preservada: `fix/vercel-api-runtime`
- Commit SHA preservado: `026d03d8a58236fe41c7c003e391c94249f2fd8b`
- PR: `#1 — fix: restore Vercel API runtime` — DRAFT, sin merge
- Deployment validado: `dpl_DMAJPyV12SsdmayQxj4vfMw1HWDX` — READY
- Runtime validado: `/api/health` respondió HTTP 200 en un preview con el mismo árbol Git final (`48cb4f8865fb394aa5a11d9f5ec4e649c2c99ba1`).
- Estado de `main` al crear este backup: `835a334f709c7ad581b8edb672524479e9308d91`, intacta.

## Estado del microhito

Checkpoint estable de la reparación del runtime API de Vercel. `api/index.ts` usa `../server.js` y `vercel.json` incluye el módulo nativo de Rollup requerido por la Function. El deployment está READY y el health check fue validado con HTTP 200. El microhito no estaba mergeado a `main` al crear este backup.

Gates que seguían pendientes al crear el backup:

1. comprobar `/api/barcode/3017620422003?lang=es` en el preview por una vía que atraviese correctamente Vercel Preview Protection;
2. ejecutar `npm run lint` o una validación TypeScript equivalente.

## Archivos incluidos

El backup parte del contenido versionado del commit `026d03d8a58236fe41c7c003e391c94249f2fd8b` e incluye el código y archivos necesarios para reconstruir ese estado, entre ellos:

- código fuente de `src/`, `api/` y `server.ts`;
- `package.json` y `bun.lock`;
- `tsconfig.json`, `vite.config.ts` y `vercel.json`;
- configuración Firebase/Firestore versionada;
- `firestore.rules`;
- `firebase-blueprint.json`;
- assets de `public/` y `src/assets/`;
- documentación versionada, incluyendo `BALKANBITE_HANDOFF.md` y `BALKANBITE_HANDOFF.docx`;
- `.gitignore`;
- `.env.example`, que contiene placeholders y nombres de variables, no valores de producción.

Por seguridad, la copia de `firebase-applet-config.json` incluida en este backup conserva su estructura pero sustituye el campo `apiKey` por `__REDACTED__`. El resto del contenido corresponde al checkpoint indicado, salvo este manifest añadido específicamente al backup.

No se encontró un archivo de índices de Firestore separado en el árbol versionado del checkpoint; sí están presentes las reglas y el blueprint indicados arriba.

## Archivos y datos excluidos

- `.git/` e historial local;
- `.env` y variantes locales/de entorno con valores reales;
- secretos, claves API reales, tokens y credenciales privadas;
- `node_modules/`;
- `dist/` y `build/`;
- caches;
- cobertura, temporales y otros artefactos regenerables no versionados.

## Variables de entorno necesarias — solo nombres

- `GEMINI_API_KEY`
- `APP_URL`
- `NODE_ENV`
- `VERCEL`

No se almacena ningún valor real de estas variables en este manifest.

## Restauración mínima

1. Descomprimir el ZIP en una carpeta nueva.
2. Restaurar el valor autorizado del campo `apiKey` de `firebase-applet-config.json` desde la configuración legítima del proyecto Firebase antes de usar Firebase.
3. Configurar fuera del repositorio las variables de entorno necesarias por nombre.
4. Instalar dependencias respetando el lockfile del proyecto, preferentemente con `bun install`.
5. Ejecutar `npm run lint`.
6. Ejecutar `npm run build`.
7. Para desarrollo local, ejecutar `npm run dev`.

Para volver a enlazar este backup con Git, la referencia canónica del código es la rama `fix/vercel-api-runtime` en el commit completo `026d03d8a58236fe41c7c003e391c94249f2fd8b`.
