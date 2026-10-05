# BALKANBITE — OPERATING STATUS

**Actualizado:** 2026-10-05  
**Documento:** estado operativo actualizable; no sustituye la visión de producto.  
**Fuente técnica principal:** código y comportamiento verificable del repositorio GitHub.  
**Checkpoint operativo:** issue #340.

## 1. Producción y main

- `main`: `dae3b606a7c81a8d9b90d2430137f827b7897364`.
- Vercel Production: `dpl_HPJHwRexVNd8L5vT6i52MSuFqpsY`, READY sobre ese SHA.
- Consulta post-deploy de logs `error|fatal`: sin entradas en la ventana comprobada.
- El deployment READY no demuestra por sí solo que los writes autenticados funcionen contra Firestore alojado.

## 2. QA vigente del árbol integrado

Último gate completo antes de integrar el hardening de release (#375):

- TypeScript/lint: PASS.
- Suite determinista: **1006/1006 PASS**.
- Build: PASS.
- Serverless bundle + cold-start: PASS.
- Browser startup acceptance: PASS.
- Async cook confirmation: PASS.
- Server-confirmed inventory propagation: PASS.
- Shortage → shopping browser acceptance: PASS.
- Voice exact-lot review: PASS.
- Firestore emulator con writers de cook, inventory adjustment/creation, voice, purchase, clear-all y shopping/shortage reconciliation: PASS.

Esto valida código + runtime local/emulado. No sustituye QA alojada autenticada.

## 3. Loop central

Estado del circuito:

`COMPRA → DESPENSA → MENÚ/RECETAS → COCINAR → CONSUMO → DESCUENTO DESPENSA → FALTANTES → LISTA → NUEVA COMPRA`

- PURCHASE → PANTRY: REAL E2E dentro del boundary QA del repo.
- PANTRY → RECIPES/MENU: REAL tras snapshot autoritativo.
- COOK → CONSUMPTION → PANTRY: REAL E2E dentro del boundary QA.
- VOICE REMOVAL → PANTRY: REAL E2E dentro del boundary QA.
- PANTRY MUTATION → RECIPES/MENU: REAL tras snapshot server-confirmed.
- SHORTFALL CALCULATION: REAL determinístico para cantidades comparables; unknown/expiry-review siguen conservadores.
- SHORTFALL → SHOPPING LIST: integrado con reconciliación determinista v1.
- SHOPPING → REVIEWED PURCHASE → PANTRY: REAL E2E dentro del boundary QA.

La reconciliación de shortage usa identidad estable, create/update/remove determinista, preserva filas manuales, evita auto-oscilación, falla cerrado ante baseline stale y no fabrica precio/cantidad para datos no verificables.

## 4. Inventario y lotes

`purchaseHistory` es evidencia histórica inmutable; no es remaining ledger.

`PantryItem` mantiene:
- `activeLots`;
- `unallocatedQuantity`;
- invariante `quantity = unallocatedQuantity + sum(activeLots.remainingQuantity)`.

Reglas:
- creación manual = stock unallocated, sin inventar compra/lote;
- edición absoluta manual conserva historial, elimina precisión física restante y deja nueva cantidad unallocated;
- expiry deriva de evidencia de adquisición;
- `lotState` explícitamente inválido o versión desconocida falla cerrado;
- mutación agregada sin evidencia física colapsa precisión restante a unallocated;
- exact-lot solo con evidencia humana explícita;
- no FEFO como hecho físico;
- food-use bloquea lote explícitamente expirado; discard puede retirarlo.

Cook y Voice soportan revisión explícita multi-lot. Unknown conserva semántica agregada.

## 5. Firestore alojado — gate actual

La inspección read-only `37331797509` sobre `main` recuperó el baseline real sin publicar nada.

Target único:
- proyecto: `gen-lang-client-0319723351`;
- database: `ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6`.

Hosted actual:
- ruleset: `projects/gen-lang-client-0319723351/rulesets/51c4d056-ded7-4f62-9f1b-b5e77136f917`;
- normalized SHA-256: `e1cad13cb208615b2fe8520c7f300bf09cac1637eadce3820a13f128b3a43927`.

Desired `main/firestore.rules`:
- normalized SHA-256: `9b7bb26ad3f5f61a77f1736a9bde711a1dc0f8b0ea21292f7f96d1a446cf62b7`;
- raw SHA-256: `67b935c58fab2bd7711abbd7b242077fdd04947c8983d4eca139dc615fd6785a`.

Conclusión: hosted Rules siguen en la política owner-scoped anterior y **no** contienen todavía los journals/transacciones/revision guards integrados.

Por tanto, signed-in cook / voice removal / purchase→pantry / clear-all / derived replacements / shortage transactional persistence en Production quedan **NO VERIFICADOS / BLOQUEADOS POR RELEASE DE RULES**.

## 6. Release gate

PR #375 corrigió el workflow para upgrades sucesivos:
- baseline autoritativo = ruleset inmutable + SHA normalizado obtenidos por inspección fresca;
- desired source = SHA raw exacto;
- target proyecto/database fijo;
- recheck inmediato antes de PATCH;
- verificación exacta post-PATCH;
- rollback al ruleset anterior si la publicación propia queda activa y falla la verificación;
- full writer emulator antes de tocar Google.

El manifest activo en `main` está en `mode: inspect`, no publish.

DRAFT PR #376 prepara los pines frescos para una futura publicación. **NO MERGEAR #376 sin decisión explícita de release de Rules**, porque su merge dispararía el workflow alojado.

## 7. QA alojada

El antiguo PR QA #206 quedó cerrado sin merge porque su contrato quedó obsoleto:
- cubría solo las cuatro colecciones sincronizadas antiguas;
- esperaba poder borrar `users/{uid}`;
- no cubría journals/transacciones/revision guards actuales.

No ejecutar ese harness sin rediseñarlo. Una futura QA alojada debe evitar tocar datos reales, mantener aislamiento A/B y resolver de forma explícita la limpieza/no-polución de evidencia append-only antes de clasificar Production como REAL E2E.

## 8. Coste, seguridad y reversibilidad

- No se activó ningún servicio de pago.
- TinyFish Agent no fue necesario para el release gate; la inspección se ejecutó con GitHub Actions y lectura pública gratuita de metadata.
- GitHub conserva ramas/checkpoints; no borrar checkpoints antiguos solo por limpieza.
- Vercel conserva deployments previos utilizables como referencia de rollback.
- La publicación de Rules es una acción separada del deploy Vercel y permanece pendiente.
- No usar cuentas personales/reales para QA destructiva.

## 9. Siguiente gate

1. Dejar #376 DRAFT hasta revisar CI + emulator.
2. No publicar hosted Rules sin decisión explícita.
3. Antes de esa decisión, definir QA alojada compatible con journals append-only y limpieza segura.
4. Si se aprueba release: merge #376 → verificar workflow/Rules exactas → esperar propagación → QA alojada segura → revisar logs → solo entonces reclasificar Production E2E.
