# BALKANBITE — DOCUMENTACIÓN DE HANDOFF TÉCNICO

**Versión del documento:** 1.1.0  
**Última actualización técnica:** 20 de Septiembre, 2026  
**Aplicación:** BalkanBite (Smart AI Pantry Tracker, Recipe Engine & Meal Planner)

---

## 1. RESUMEN EJECUTIVO Y ESTADO DE APLICACIÓN

BalkanBite es una aplicación web full-stack construida con React 18 (Vite), TypeScript, Express.js y OpenAI GPT-5.6 Luna, enfocada en la gestión inteligente de la despensa, generación de recetas saludables de tradición balcánica/mediterránea, planificación de menús semanales sin desperdicio y compras optimizadas por presupuesto.

### Clasificación de Componentes Clave:
- **FUNCIONA REALMENTE E2E (Servidor + IA + Firebase):**
  - Autenticación con Firebase Auth (Google Sign-In, Email/Password).
  - Proxy de Inteligencia Artificial en Express (`server.ts`) mediante OpenAI Responses API, fijado a `gpt-5.6-luna` para texto y visión (análisis de imágenes de refrigerador y tickets). No existe fallback a otro proveedor/modelo.
  - Escáner de código de barras conectado a la API externa de OpenFoodFacts (`/api/barcode/:code`).
  - Asistente de Cocina por Voz ("Chef IA") con procesamiento de lenguaje natural y extracción estructurada de intención (JSON).
  - Exportación de menús a PDF con `jspdf` y `html2canvas`.

- **LOCAL ONLY (Persistencia React + LocalStorage):**
  - Estado principal de la despensa, recetas, lista de la compra, historial de comidas y perfil de usuario persistidos en `localStorage`.
  - Sincronización secundaria en nube con Firestore mediante `useFirebaseSync` cuando el usuario inicia sesión.

- **MOCK / DEMO / SOLO UI:**
  - Pasarela de pago / suscripción PRO (`ProModal.tsx` cambia la bandera en perfil pero no procesa tarjetas reales con Stripe/PayPal).
  - Notificaciones Push del sistema (interfaz lista con Notification API del navegador, sin servidor de push como FCM/WebPush configurado).

---

## 2. ARQUITECTURA TÉCNICA

- **Frontend:** React 18, Vite 6, Tailwind CSS v4, Motion (framer-motion v12), Lucide React Icons.
- **Backend (API Server):** Express.js ejecutado con `tsx` en desarrollo y empaquetado en `dist/server.cjs` mediante `esbuild` para producción en Node.js (puerto 3000).
- **IA / Visión / NLP:** OpenAI Responses API mediante un adaptador HTTP propio en servidor Node.js, fijado a `gpt-5.6-luna`. La clave nunca se expone al cliente.
- **Base de Datos & Auth:** Firebase Web SDK v12 (Authentication + Firestore).
- **Estructura de Archivos Backend / Frontend:**
  - `server.ts`: Servidor Express centralizado con endpoints `/api/ai/*` y `/api/barcode/*`.
  - `src/App.tsx`: Orquestador principal de estado global en el cliente.
  - `src/hooks/useFirebaseSync.ts`: Hook de sincronización bidireccional en tiempo real Firestore <-> LocalState.
  - `src/utils/menuAutoPlanner.ts`: Lógica de emparejamiento de ingredientes y cálculo nutricional.
  - `src/utils/shoppingAdvisor.ts`: Comparador de ingredientes requeridos vs. despensa actual.

---

## 3. INSTALACIÓN Y EJECUCIÓN LOCAL

### Requisitos Previos:
- Node.js 18+ o 20+
- npm / bun

### Comandos:
```bash
# Instalar dependencias
npm install

# Modo Desarrollo (Inicia Express + Middleware Vite en el puerto 3000)
npm run dev

# Verificación de Tipos (Linter)
npm run lint

# Build de Producción (Compila frontend a dist/ y bundling de server.ts con esbuild)
npm run build

# Iniciar Servidor de Producción
npm run start
```

---

## 4. VARIABLES DE ENTORNO (`.env.example`)

```env
# Clave de OpenAI API. Solo servidor; nunca usar VITE_ ni exponerla al navegador.
OPENAI_API_KEY="MY_OPENAI_API_KEY"

# URL base de la aplicación en Cloud Run / Hosting
APP_URL="MY_APP_URL"
```

---

## 5. RECOMENDACIONES DE DESARROLLO (SIGUIENTES PASOS)

1. **Pasarela de Pagos Real:** Integrar Stripe Elements o SDK oficial para procesar suscripciones del plan PRO.
2. **Pruebas Automatizadas:** Configurar Vitest / React Testing Library para unit tests de `menuAutoPlanner.ts` y `shoppingAdvisor.ts`, y Playwright/Cypress para flujos E2E.
3. **Optimización de Modelo de Datos:** Migrar el estado gigante de `App.tsx` a React Context o Zustand para prevenir renderizados innecesarios.
