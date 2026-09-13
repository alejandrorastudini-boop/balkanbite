# BALKANBITE — OPERATING STATUS

**Fecha:** 2026-09-13  
**Documento:** estado operativo actualizable; no sustituye la visión de producto.  
**Fuente técnica principal:** código y comportamiento verificable del repositorio GitHub.

## 1. Producción

- `main` / producción permanecen sin cambios durante la serie de endurecimiento del circuito central.
- SHA de producción de referencia: `66b6384b56626e48707dc7e41df01186916d1bed`.
- No se deben integrar los PRs apilados a `main` sin revisión del árbol integrado y autorización de release.

## 2. Circuito cuantitativo desarrollado en ramas/PRs

Estado acumulado antes de integración a `main`:

- Persistencia y aislamiento de despensa invitado/auth: implementado en la pila de PRs de inventario; comportamiento auth/Firestore real sigue **NO VERIFICADO E2E** donde no hubo una sesión Firebase autorizada.
- Normalización de cantidades/unidades: determinista para kg/g, L/ml, conteo y unidades discretas compatibles; unidades incompatibles no se convierten.
- Despensa → disponibilidad de recetas: cantidad/unidad-aware.
- Menú → faltantes → Compras: faltantes cuantitativos sin fabricar precio.
- Cocinar → descuento de despensa: **REAL E2E invitado**; no descuenta unidades incompatibles ni hace consumo parcial ante stock insuficiente.
- Compras → despensa: merge determinista para unidades compatibles; incompatibles quedan en lotes separados; **REAL E2E invitado**.
- Disponibilidad de Recetas se deriva de la despensa viva, evitando flags `inPantry` obsoletos; **REAL E2E invitado**.

## 3. Slice cerrado: `fix/safe-shopping-reconciliation`

### Objetivo

Evitar que la reconciliación de compras por voz/texto convierta inferencias o defaults de IA/fallback en hechos autoritativos de despensa.

### Decisiones cerradas

1. Para artículos que ya existen en Compras, la cantidad y unidad autoritativas son las de la lista local actual, no las reconstruidas por IA.
2. Los extras detectados por IA/fallback son propuestas y empiezan sin seleccionar.
3. Un extra requiere confirmación humana explícita en la pantalla de revisión.
4. Cantidad/unidad de extras solo pueden pasar a revisión como verificables si aparecen explícitamente en el texto del usuario mediante extracción determinista.
5. Si falta cantidad o unidad, el extra queda bloqueado y no puede escribirse en despensa.
6. Precio y caducidad sugeridos por IA/fallback para extras se descartan; no se persisten como hechos.
7. El motor de escritura vuelve a validar nombre, cantidad y unidad antes de mutar despensa.
8. Unidades compatibles se fusionan de forma determinista; dimensiones incompatibles permanecen como lotes separados.
9. `reconciliationId` + `purchaseHistory` hacen la misma reconciliación idempotente.
10. No se introducen defaults silenciosos como `1 pcs`, `€1.50`, categoría `Produce` o 7 días de caducidad en la frontera autoritativa.

### Fallback del servidor

El fallback heredado de `/api/ai/reconcile-shopping` todavía puede producir campos estimados en su respuesta de propuesta. Se considera **no autoritativo**: la UI descarta su cantidad/unidad para extras y las reconstruye únicamente desde evidencia explícita del texto; descarta precio/caducidad; el usuario debe confirmar; y el motor vuelve a validar antes de escribir.

No se reescribió el parser completo del servidor en este slice para evitar ampliar alcance y riesgo. Una limpieza posterior puede simplificar su contrato de propuesta, pero los valores fabricados ya no pueden cruzar la frontera autoritativa probada.

### QA técnica

GitHub Actions, head funcional verificado:

- TypeScript `tsc --noEmit`: **PASS**.
- Tests deterministas: **52/52 PASS**.
- Build frontend + servidor: **PASS**.
- Warnings conocidos no bloqueantes: selectores CSS de tema claro y chunk JS >500 kB.
- `npm audit` informa 2 vulnerabilidades moderadas de dependencias; no se modificaron a ciegas dentro de este slice.
- Vercel alcanzó el límite diario gratuito de builds durante la verificación final; no se compró capacidad adicional. La validación final se trasladó a GitHub Actions.

### QA E2E de navegador

GitHub Actions + Playwright Chromium, app levantada localmente en el runner y `GEMINI_API_KEY` ausente:

- `/api/health` confirmó `aiConfigured:false`, por lo que se ejercitó el fallback real.
- Producto ya existente en Compras: Tomate 2 uds sobre Tomate 4 uds → una fila de 6 uds.
- Cantidad/unidad usadas desde la lista de Compras, no desde el parser.
- Persistencia después de recarga: PASS.
- Línea comprada permanece eliminada después de recarga: PASS.
- Repetición práctica de la misma frase sin línea pendiente: no duplica stock.
- Extra válido `2 uds de aguacate`: requiere revisión/confirmación; se guarda 2 uds.
- Precio/caducidad del fallback no aparecen como hechos de despensa.
- Extra válido persiste después de recarga.
- Unidad compatible: `1 unidad` se fusiona con el lote de `uds`.
- Unidad incompatible: `500 g` frente a lote de `uds` crea un lote separado.
- Frase vaga `Compré aguacate`: bloqueada, sin mutación.
- Cantidad sin unidad `Compré 2 aguacates`: bloqueada, sin mutación.
- Unidad sin cantidad `Compré uds de aguacate`: bloqueada, sin mutación.

**Clasificación:** reconciliación de compras → despensa en modo invitado = **REAL E2E** para los casos anteriores.  
**Auth/Firestore después de reconciliación:** **NO VERIFICADO E2E**.

### Evidencia QA

- QA técnica final: workflow GitHub Actions `34761671317` — success.
- QA navegador final: workflow GitHub Actions `34762055230` — success; log final: `safe shopping reconciliation browser E2E v2: PASS`.
- La primera versión del arnés E2E produjo un falso fallo de persistencia porque el fixture limpiaba `localStorage` en cada reload; se corrigió el arnés sin modificar runtime y la v2 pasó.

### Cierre administrativo

- Draft PR: `#17` — `fix: make shopping reconciliation authoritative and quantity-safe`.
- Base del slice: `fix/pantry-dependent-reconciliation` / Draft PR #16.
- Checkpoint limpio: `checkpoint/safe-shopping-reconciliation-2026-09-13`.
- Backup pre-squash preservado: `backup/safe-shopping-reconciliation-pre-squash-2026-09-13`.
- El slice debe conservar un único commit funcional/documental sobre el head de PR #16; no debe mergearse aislado a `main`.

## 4. Estado de integración

Este slice depende del árbol acumulado que termina en `fix/pantry-dependent-reconciliation` / PR #16. No está destinado a merge aislado sobre `main` sin sus dependencias.

Antes de integrar a `main` se debe revisar la acumulación completa de PRs #2 en adelante, ordenar dependencias, revisar conflictos y repetir QA sobre el árbol integrado. Producción no debe modificarse como parte de esa revisión sin autorización explícita de release.

## 5. Deuda conocida fuera de este slice

- Auth/Firestore sigue necesitando QA E2E autorizada para varios flujos de inventario.
- Otras colecciones Firestore todavía requieren endurecimiento multiusuario/empty snapshot/delete reconciliation.
- `handleVoiceAddItems` y otros caminos de IA conservan defaults/fabricaciones que deben endurecerse en slices separados.
- Existen precios/ahorros/claims estáticos o estimados en otras zonas de UI que no deben tratarse como datos verificados.
- El flujo `Cook` necesita mejorar UX cuando hay ingredientes no verificables aunque la deducción de datos sea conservadora.
- Dependencias: 2 vulnerabilidades moderadas reportadas por `npm audit`; investigar de forma separada antes de aplicar fixes automáticos.
