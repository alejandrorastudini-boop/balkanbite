# BalkanBite — ejecución sostenida y continuidad entre chats

## Regla obligatoria

Cuando el propietario diga «continúa», «sigue», «dale» o equivalente, interpretar la orden como una ventana de trabajo sostenido. No cerrar voluntariamente tras un microhito, PR, commit, test verde o actualización de estado si todavía hay trabajo local seguro y capacidad disponible.

Encadenar: comprobar estado vivo → elegir microhito reversible → implementar → tests/CI → corregir → revisar/merge cuando proceda → verificar runtime/Production cuando proceda → checkpoint → siguiente microhito seguro.

Esperar una CI no justifica cerrar por sí solo: revisar dependencias, preparar documentación o abordar otro trabajo independiente seguro. No ejecutar cambios que interfieran con una validación pendiente.

Las actualizaciones de progreso deben ser breves, ocasionales y sin cerrar la ejecución. Una pregunta «¿cómo vas?» requiere estado real; no debe convertirse automáticamente en despedida.

Solo finalizar ante un límite real de herramientas/tiempo/contexto, bloqueo técnico que impida avanzar con seguridad, decisión sustantiva, riesgo irreversible, gasto no aprobado o ausencia real de trabajo seguro. No prometer actividad en segundo plano después de cerrar.

## Inicio de un chat o agente nuevo

1. Leer las instrucciones permanentes del Proyecto y el protocolo de continuidad.
2. Consultar el índice de fuentes y la documentación permanente 00–04 pertinente.
3. Leer el handoff más reciente como pista, nunca como autoridad superior al código.
4. Consultar GitHub main, PRs, ramas, CI y runtime vivos; reconciliar cualquier discrepancia.
5. Continuar el trabajo abierto sin repetir auditorías cerradas ni pedir al propietario que recuerde decisiones ya documentadas.
6. Todo nuevo handoff debe ordenar expresamente leer primero este protocolo y reconstruir el estado vivo, y recordar la regla de ejecución sostenida.

## Cierre recuperable

Registrar completado, en curso, bloqueado, validaciones reales, pruebas no realizadas, referencias exactas de rama/commit/PR/CI, Production cuando corresponda y siguiente acción concreta. La información temporal pertenece al handoff/checkpoint operativo, no a las instrucciones permanentes.

La fuente de verdad sigue siendo: código GitHub actual → comportamiento real → documentación vigente → decisiones posteriores. Un build verde no demuestra runtime. No degradar seguridad, privacidad, trazabilidad ni fiabilidad por acelerar.

Este documento complementa el protocolo permanente 05 y no sustituye las demás reglas del proyecto.
