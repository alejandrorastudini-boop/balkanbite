# Gate alojado: Firestore con nombre propio (22-09-2026)

## Fuente de verdad y evidencia

- Proyecto Firebase: `gen-lang-client-0319723351`.
- Base de BalkanBite existente, confirmada por el propietario en Firebase Console:
  `ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6`.
- Ubicación mostrada: `europe-west2`; edición Enterprise / Native; cuota compartida de AI Studio.
- La producción anterior usaba `(default)`; la prueba alojada en PR #206 mostró repetidamente
  `Firestore (12.19.0): Database '(default)' not found`.
- Security de la base con nombre propio mostraba `allow read, write: if false;`.
  **No se han publicado reglas nuevas en este cambio.**
- No activar Blaze, añadir otra base ni sustituir el proyecto Firebase.

## Alcance de la rama de integración

`src/lib/firebase.ts`: inicializar Firestore con memoria y el Database ID exacto usando
`initializeFirestore(app, settings, databaseId)`. Firebase Auth mantiene la configuración
existente; no modificar proveedores de acceso.

`firebase.json`: asociar `firestore.rules` exclusivamente con esa base existente.
`firestore.rules` conserva las fronteras previamente validadas en emulador: denegar
acceso anónimo y autorizar solo documentos de su propietario, sin transferencias de
`userId`.

`tests/namedFirestoreBoundary.test.ts`: detectar desalineación de proyecto, cliente
y destino de reglas. El lint/build y estos tests NO prueban que Firestore alojado acepte
las reglas ni que la sincronización funcione.

## Seguridad y publicación: pasos separados

1. Revisar diff y CI completo en un PR. Comprobar especialmente que no cambian Auth,
   `firestore.rules`, colecciones de otros productos ni secretos.
2. Antes de cualquier publicación, revisar el estado alojado actual de la base con
   nombre y conservar un respaldo del ruleset activo (deny-all) para rollback.
3. Solo tras autorización del propietario, integrar y publicar el cliente con el
   Database ID correcto. Mientras deny-all siga activo, la sincronización autenticada
   debe continuar no autoritativa, sin sobreescribir datos de la nube ni presentar
   valores locales como sincronizados.
4. Separadamente, revisar el ruleset y autorizar/publicar reglas owner-scoped SOLO
   en la base nombrada. No publicar reglas al proyecto entero por suposición.
   El CLI oficial documenta la forma `firebase deploy --only
   firestore:<databaseId> --project <projectId> --config firebase.json`,
   pero puede incluir índices y versiones de `firebase-tools` han tenido bugs de
   despliegue silencioso con el filtro `firestore:rules` y config en array.
   **No usar un exit code 0 del CLI como prueba de publicación.**
   Seleccionar un procedimiento confirmado contra la versión real del CLI y
   comparar reglas y versión en Firebase Console después del despliegue.
5. Antes de declarar REAL E2E: probar en Firebase alojado con identidades sintéticas
   aisladas: rechazo anónimo, lectura/escritura propia, rechazo cross-user,
   perfil/onboarding, despensa vacía y recarga, logout/login y recuperación de cuenta;
   inspeccionar logs del navegador para distinguir auth de errores de Firestore.
   Limpiar únicamente cuentas/documentos QA con verificación posterior.
6. Si falla el acceso o aislamiento: restaurar inmediatamente el ruleset deny-all
   anterior para esa base y revisar los datos QA. El rollback de reglas no elimina
   documentos ya creados.

## Estado pendiente, no asumir como comprobado

- La UI del nuevo cliente y el runtime real con la base nombrada aún no se han probado.
- Reglas alojadas owner-scoped: NO publicadas.
- PR #206 contiene QA para producción anterior y debe adaptarse a la base nombrada
  cuando corresponda; NO fusionar ese PR QA de forma accidental.
- Investigar si la cuenta sintética creada inicialmente por la automatización
  visual anterior sigue existiendo; no afirmar limpieza sin verificación.
- No reclamar coste o cuota garantizados: comprobar condiciones actuales del
  proyecto antes de operaciones con impacto de facturación.
