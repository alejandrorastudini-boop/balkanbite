# Investigación de Node DEP0169 — incidencia #166

Fecha: 2026-10-14. Checkout investigado: `ac4ed7aab6ebc1d6acd94e39c129b12cbd15a909`.

## Resultado y límite

Se reprodujo un origen real: una petición HTTP en formato absoluto (por ejemplo,
`GET http://127.0.0.1:PORT/api/health`) pasa por Express 4.22.2 → parseurl 1.3.3
→ `url.parse()`. El servidor devuelve 200 y `status: ok` incluso cuando emite
DEP0169. La petición habitual `GET /api/health`, con y sin query string, no emite
DEP0169 en los procesos nuevos comprobados.

Esto **no identifica todavía el origen del aviso de producción de #166**. No se
dispone de su stack, del formato de URL recibido por el adaptador ni del artefacto
exacto generado por Vercel. El bundle de control descrito aquí es una prueba local
con esbuild, no una reproducción del runtime de Vercel. La incidencia permanece
abierta hasta obtener esa evidencia. No se alteró el código de aplicación ni se
actualizaron dependencias para corregir un origen no demostrado.

## Evidencia

Con source maps, la traza del control muestra:

```text
urlParse (node:url:136:13)
fastparse (node_modules/parseurl/index.js:97:12)
parseurl (node_modules/parseurl/index.js:51:12)
getPathname (node_modules/express/lib/router/index.js:539:12)
next (node_modules/express/lib/router/index.js:213:16)
router.handle (node_modules/express/lib/router/index.js:175:3)
app.handle (node_modules/express/lib/application.js:181:10)
app (node_modules/express/lib/express.js:39:9)
handler (api/index.ts:110:10)
```

Resultados de `node-deprecation-smoke.mjs`, que habilita
`--pending-deprecation --trace-deprecation --enable-source-maps` en cada proceso:

| Node | Dependencias del bundle | `/api/health` | Con query | URL absoluta |
| --- | --- | --- | --- | --- |
| 22.23.3 | Externas | 200, sin DEP0169 | 200, sin DEP0169 | 200, DEP0169 |
| 22.23.3 | Incluidas, excepto Vite | 200, sin DEP0169 | 200, sin DEP0169 | 200, DEP0169 |
| 24.19.0 | Externas | 200, sin DEP0169 | 200, sin DEP0169 | 200, sin DEP0169 |
| 24.19.0 | Incluidas, excepto Vite | 200, sin DEP0169 | 200, sin DEP0169 | 200, DEP0169 |

Los resultados anteriores provienen del informe de Codex. Node 22 necesita
`--pending-deprecation` para emitir este aviso. En Node 24, `url.parse` puede
excluir avisos de llamadas procedentes de `node_modules`; la inclusión de
dependencias en un bundle modifica esa procedencia. Por tanto, ausencia de
avisos no demuestra por sí sola ausencia de llamadas heredadas.

El resultado es diagnóstico, no una modificación de Express ni de producción.
Una sustitución global por WHATWG URL, una migración a Express 5 o normalizar
`req.url` cambiarían semántica de enrutamiento sin evidencia del caso original.

## Reproducción sin servicios externos

Desde el checkout con las dependencias instaladas:

```bash
npm run build
./node_modules/.bin/esbuild api/index.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/serverless-api.cjs
node --trace-deprecation qa/runtime/serverless-health-smoke.mjs dist/serverless-api.cjs
node qa/runtime/node-deprecation-smoke.mjs dist/serverless-api.cjs

# Diagnóstico MANUAL OPCIONAL: no es una condición de CI.
./node_modules/.bin/esbuild api/index.ts --bundle --platform=node --format=cjs --external:vite --sourcemap --outfile=dist/dep0169-api-inline.cjs
node qa/runtime/node-deprecation-smoke.mjs dist/dep0169-api-inline.cjs --expect-absolute-warning
```

Cada petición utiliza un proceso nuevo y un servidor HTTP loopback con puerto
efímero. El detector observa las trazas y exige HTTP 200, `status: ok` y
`Cache-Control: no-store`. CI exige ausencia de DEP0169 únicamente en las
peticiones normales, no exige perpetuar la deprecación en URLs absolutas.
La prueba sintética confirma que el detector falla al usar `url.parse`.
No se invocan servicios externos ni generación IA.

## Validación comunicada por Codex (no repetida de forma integral)

- Lint, typecheck, build: comunicados correctos; el build de Vite mostró el aviso
  conocido sobre chunks de más de 500 kB.
- Suite principal: 1.071 tests correctos según Codex (1.069 previos más 2 nuevos).
- Pruebas auxiliares offline: 10 comunicadas correctas.
- Servidor compilado y smoke serverless: comunicados correctos.
- Cinco harnesses locales de navegador: comunicados correctos, con un reintento
  de `cook-confirmation`; no prueban Firebase real ni producción.

Revisión posterior: las 2 pruebas del detector también pasaron con Node 22.16
usando `--experimental-strip-types`, sin el resto del checkout. La suite
completa y el smoke real modificado requieren CI en la rama revisada.

## Evidencia necesaria para cerrar #166

Faltaría una traza original de producción y la versión/configuración del runtime
afectado. La consulta histórica a Vercel respondió 400: el plan Hobby ya no
retiene logs de esa fecha. Este error de retención no confirma ni niega el
origen. No se recomienda contratar observabilidad de pago para esta deuda
técnica no bloqueante.

Mantener la incidencia ABIERTA. No desplegar ni cambiar Express sin trazabilidad.
