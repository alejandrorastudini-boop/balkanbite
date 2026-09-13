# BALKANBITE — OPERATING STATUS

**Fecha:** 2026-09-13  
**Documento:** estado operativo actualizable; no sustituye la visión de producto.  
**Fuente técnica principal:** código y comportamiento verificable del repositorio GitHub.

## 1. Producción

- `main` / producción siguen en `66b6384b56626e48707dc7e41df01186916d1bed`.
- Draft PR de integración acumulada: `#18` (`integration/pr2-pr17-2026-09-13`).
- PR #18 se mantiene sin merge hasta cerrar el gate alojado de Firebase.

## 2. Circuito cuantitativo acumulado

- Persistencia invitado de despensa vacía: validada.
- Normalización de cantidades/unidades: determinista para kg/g, L/ml, conteo y unidades discretas compatibles; unidades incompatibles no se convierten.
- Despensa → disponibilidad de recetas: quantity/unit-aware.
- Menú/receta → faltantes → Compras: faltantes cuantitativos sin fabricar precio.
- Cocinar → descuento de despensa: **REAL E2E invitado**.
- Voz → descuento de despensa: **REAL E2E invitado** para los casos verificados.
- Compras → despensa: merge determinista para unidades compatibles; incompatibles quedan en lotes separados; **REAL E2E invitado**.
- Reconciliación de compra por voz/texto: frontera autoritativa endurecida; **REAL E2E invitado**.
- Disponibilidad de recetas se deriva de la despensa viva, evitando flags `inPantry` obsoletos.

## 3. Integración PR #18

### Estructura

- Base/main: `66b6384b56626e48707dc7e41df01186916d1bed`.
- PR de integración mantiene un único commit sobre `main`.
- Checkpoint previo a trazabilidad Firebase: `checkpoint/integration-pre-hosted-firebase-config-2026-09-13`.
- Checkpoint de gate Firebase: `checkpoint/integration-hosted-firebase-gate-2026-09-13`.

### QA acumulada cerrada

- TypeScript/lint: **PASS**.
- Suite determinista: **52/52 PASS**.
- Build: **PASS**.
- Chromium/Playwright circuito guest acumulado: **PASS**.
- Firestore Rules Emulator: **PASS**.
- Auth + `useFirebaseSync` + Firestore app E2E contra emuladores oficiales: **PASS**.

La QA autenticada emulada cubre snapshot remoto vacío autoritativo para inventory, guest separado, demo pantry no subido, IDs namespaced, logout restaura guest, aislamiento A/B, legacy, precedencia scoped, tombstones, reactivación, clear-all y persistencia del vacío después de relogin.

Run adicional `34768045704` validó el riesgo de nube secundaria vacía. Tras un primer login contra Auth + Firestore emulados con nube vacía, los conteos fueron:

- `recipesWrittenFromEmptyCloud: 0`;
- `mealPlansWrittenFromEmptyCloud: 0`;
- `shoppingItemsWrittenFromEmptyCloud: 0`.

Resultado: `BalkanBite empty-cloud secondary collection guard: PASS`. No se observó auto-subida silenciosa de estado local/default a esas colecciones en el escenario probado.

## 4. Defectos descubiertos por QA integrada y corregidos

### Firestore ownership rules

El patrón anterior `resource.data.userId || request.resource.data.userId` fallaba en `create`. Las reglas ahora distinguen operación:

- create: propietario entrante = usuario autenticado;
- read/delete: propietario existente = usuario autenticado;
- update: propietario existente e incoming = usuario autenticado.

Esto bloquea además transferencia de ownership.

### Layering UI

QA autenticada detectó que `AutoMenuToast` podía interceptar modales. Estado final:

- bottom navigation: z-40;
- auto-menu toast: z-[45];
- modales normales: z-50;
- auth modal: z-[60].

## 5. Estado real Firebase alojado

Comprobación manual de solo lectura realizada el 2026-09-13:

- Firebase project: `gen-lang-client-0319723351`.
- Authentication: existe 1 usuario real/personal; no usar para QA destructiva.
- Google Sign-In: Enabled.
- Email/Password: no habilitado.
- SMS MFA: Disabled.
- Firestore Data: vacío; no se muestran colecciones/documentos.
- Firestore Rules alojadas: deny-all (`allow read, write: if false;`).

Conclusión: Firebase alojado no coincide todavía con el ruleset validado en emuladores.

Tanto `main` como PR #18 muestran actualmente login/registro Email/Password aunque el proveedor alojado está deshabilitado. El repositorio no implementa password reset ni enforcement de email verification. No se recomienda habilitar Email/Password permanentemente solo para hacer coincidir una UI incompleta. Postura recomendada de release: Google-only hasta productizar recovery/verificación.

## 6. Gate alojado de Firestore

El ruleset candidato de `firestore.rules` mantiene acceso anónimo bloqueado y permite únicamente operaciones owner-scoped sobre `users`, `inventory`, `recipes`, `mealPlans` y `shoppingList`.

Se añadió `firebase.json` para mapear explícitamente `firestore.rules`. No se añadió `.firebaserc` deliberadamente: cualquier publicación alojada debe indicar expresamente el proyecto `gen-lang-client-0319723351` y limitarse a rules.

Runbook operativo: `docs/qa/firestore-hosted-release.md`.

Publicar las rules no crea, modifica ni borra documentos por sí solo. Sin embargo, una sesión autenticada de BalkanBite posterior a la publicación puede activar escrituras de `useFirebaseSync`, incluido perfil y estado sincronizado. Por ello el único usuario personal existente no debe usarse como identidad QA.

Con Firestore alojado vacío y las guardas de nube vacía ya validadas en emulador, el riesgo técnico de la publicación de rules es bajo/moderado y controlado, sujeto a QA alojada inmediata y rollback si aparece una anomalía.

## 7. Estrategia de QA alojada

Usar dos identidades sintéticas A/B; nunca la cuenta personal existente.

Opción operativamente más simple para QA: habilitar Email/Password **temporalmente**, crear dos usuarios sintéticos desechables, ejecutar QA alojada, borrar solo datos/usuarios QA y volver a deshabilitar Email/Password. Esto requiere autorización explícita porque modifica Auth alojado. Email/Password no debe quedar habilitado para release mientras el flujo carezca de recuperación/verificación.

Alternativa: dos cuentas Google QA dedicadas creadas manualmente, evitando modificar proveedores pero con mayor fricción y posible CAPTCHA/2FA.

QA alojada mínima después de publicar rules:

- acceso anónimo sigue denegado;
- A con nube vacía hidrata vacío autoritativamente;
- guest/demo no se auto-sube;
- escritura de inventory crea ID namespaced;
- logout restaura guest;
- B queda aislado de A;
- legacy/scoped/tombstone/reactivación funcionan con datos QA;
- clear-all no resucita legacy;
- recarga y relogin mantienen el estado correcto;
- `recipes`, `mealPlans` y `shoppingList` no se auto-pueblan desde estado local/default en nube vacía.

## 8. Coste y reversibilidad

- No se ha activado ningún servicio de pago.
- La QA prevista requiere solo unas decenas de operaciones Firestore y dos identidades sintéticas; está muy por debajo de las cuotas gratuitas esperables.
- No se usará SMS/MFA.
- El ruleset deny-all previo queda disponible como rollback en el historial de Firebase y está documentado en `docs/qa/firestore-hosted-release.md`.
- Rollback de autorización no elimina documentos; cualquier dato QA se limpia de forma separada y explícita.

## 9. Deuda conocida fuera de este gate

- Alinear Auth UI con Google-only antes de release si Email/Password sigue deshabilitado.
- `handleVoiceAddItems` y otros caminos de IA conservan defaults/fabricaciones fuera de los slices ya cerrados.
- Existen precios/ahorros/claims estáticos o estimados en otras zonas de UI que no deben tratarse como datos verificados.
- Dependencias: 2 vulnerabilidades moderadas reportadas por `npm audit`; investigar separadamente, sin `npm audit fix` automático.
- Warnings no bloqueantes: selectores CSS de tema claro y chunk JS >500 kB.
