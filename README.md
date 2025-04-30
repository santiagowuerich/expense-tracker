# Expense Tracker & Inventory (Nombre Tentativo)

## Descripción del Proyecto

_(Necesita descripción)_ - Una aplicación web diseñada para el seguimiento de gastos y potencialmente la gestión de inventario. Permite a los usuarios registrar, categorizar, visualizar y analizar sus finanzas y/o stock.

**Propósito:** _(Necesita descripción)_ - El objetivo principal es proporcionar una herramienta centralizada para que individuos o pequeñas empresas gestionen sus flujos financieros (gastos) y posiblemente el inventario de productos, generando reportes y resúmenes.

**Motivación:** _(Opcional: Añadir por qué se creó)_

**Estado Actual:** En desarrollo activo.

## Tecnologías Utilizadas

Este proyecto amalgama un conjunto de tecnologías modernas para construir una experiencia web robusta y eficiente. A continuación, se detallan las herramientas clave y la razón de su elección:

*   **Framework Frontend:** [**Next.js**](https://nextjs.org/) (v15.2.4)
    *   **¿Qué es?** Un framework de React que extiende sus capacidades, ofreciendo renderizado del lado del servidor (SSR), generación de sitios estáticos (SSG), optimización de imágenes, sistema de rutas basado en archivos (App Router), y más.
    *   **¿Por qué se utiliza?**
        *   **Rendimiento:** Permite pre-renderizar páginas (SSR/SSG) para cargas iniciales más rápidas y mejor SEO.
        *   **Experiencia de Desarrollo (DX):** Simplifica la configuración de React, el enrutamiento y ofrece características como Fast Refresh para un desarrollo más ágil.
        *   **Escalabilidad:** Su estructura basada en convenciones y sus optimizaciones lo hacen adecuado para crecer. El App Router (usado aquí, inferido por la carpeta `app/`) fomenta una mejor organización del código para rutas y layouts.
        *   **Ecosistema:** Amplia comunidad y compatibilidad con el ecosistema de React y JavaScript/TypeScript.
    *   **Lenguaje:** [**TypeScript**](https://www.typescriptlang.org/) (v5)
        *   **¿Qué es?** Un superset de JavaScript que añade tipado estático opcional.
        *   **¿Por qué se utiliza?**
            *   **Detección Temprana de Errores:** Atrapa errores comunes (ej. typos, tipos incorrectos) durante el desarrollo, antes de la ejecución.
            *   **Mejor Mantenibilidad y Refactorización:** El tipado hace el código más auto-documentado y fácil de entender y modificar con seguridad.
            *   **Autocompletado y Herramientas Mejoradas:** Los IDEs pueden ofrecer mejor inteligencia y asistencia al desarrollador.
    *   **UI Library:** [**React**](https://reactjs.org/) (v19)
        *   **¿Qué es?** Una biblioteca declarativa y basada en componentes para construir interfaces de usuario interactivas.
        *   **¿Por qué se utiliza?** Es la base sobre la que Next.js está construido. Su modelo de componentes reutilizables facilita la creación de UIs complejas y mantenibles. La versión 19 introduce mejoras potenciales en concurrencia y rendimiento.

*   **Estilos:**
    *   [**Tailwind CSS**](https://tailwindcss.com/) (v3.4.17)
        *   **¿Qué es?** Un framework CSS "utility-first". En lugar de clases semánticas predefinidas (como `.card`), proporciona clases de bajo nivel (como `p-4`, `bg-white`, `shadow-md`) que se componen directamente en el HTML/JSX.
        *   **¿Por qué se utiliza?**
            *   **Desarrollo Rápido:** Permite prototipar y construir UIs rápidamente sin cambiar de contexto entre HTML y CSS.
            *   **Personalización:** Altamente personalizable a través de su archivo de configuración (`tailwind.config.ts`).
            *   **Consistencia:** Ayuda a mantener un lenguaje de diseño consistente al usar un conjunto definido de utilidades.
            *   **Optimización:** Elimina el CSS no utilizado durante el build (PurgeCSS integrado), resultando en bundles más pequeños.
    *   [**shadcn/ui**](https://ui.shadcn.com/) (inferido)
        *   **¿Qué es?** No es una biblioteca de componentes tradicional, sino una colección de componentes React reutilizables (basados en Radix UI y Tailwind CSS) que copias y pegas en tu proyecto, dándote control total sobre el código.
        *   **¿Por qué se utiliza?** Ofrece componentes bien diseñados, accesibles y personalizables (botones, diálogos, formularios, etc.) que se integran perfectamente con Tailwind y TypeScript, acelerando el desarrollo de la UI. La presencia de `components.json` y múltiples dependencias `@radix-ui/*` son indicadores claros de su uso.
    *   `tailwindcss-animate`: Plugin para añadir animaciones predefinidas o personalizadas fácilmente con Tailwind.

*   **Gestión de Estado y Datos (Client-Side):**
    *   [**TanStack Query (React Query)**](https://tanstack.com/query/latest)
        *   **¿Qué es?** Una biblioteca para gestionar el estado del servidor en aplicaciones React. Simplifica el fetching, caching, sincronización y actualización de datos remotos.
        *   **¿Por qué se utiliza?**
            *   **Elimina Boilerplate:** Reduce la necesidad de escribir lógica compleja de carga, error y estado de datos manualmente (ej. con `useState` + `useEffect`).
            *   **Caching Inteligente:** Guarda en caché los datos para evitar peticiones redundantes y mejorar la experiencia del usuario.
            *   **Actualización en Segundo Plano:** Mantiene los datos frescos automáticamente.
            *   **Optimistic Updates:** Permite actualizar la UI instantáneamente antes de que la mutación en el servidor se complete.
            *   La presencia de `queries.ts` en `lib/` sugiere que aquí se definen las funciones de fetching usadas con TanStack Query.

*   **Backend y Base de Datos:**
    *   [**Supabase**](https://supabase.com/) (v `latest` via `@supabase/supabase-js`)
        *   **¿Qué es?** Una plataforma open-source que ofrece un conjunto de herramientas de backend: base de datos PostgreSQL, autenticación, APIs instantáneas, almacenamiento de archivos, funciones serverless (Edge Functions), y suscripciones en tiempo real.
        *   **¿Por qué se utiliza?**
            *   **Solución Integral (BaaS):** Proporciona la mayoría de los servicios de backend necesarios para una aplicación web moderna, reduciendo la necesidad de construir y gestionar un backend propio complejo desde cero.
            *   **Basado en PostgreSQL:** Utiliza una base de datos relacional potente y ampliamente conocida.
            *   **Facilidad de Uso:** Ofrece bibliotecas cliente (`@supabase/supabase-js` usada aquí) y una interfaz de usuario amigable para gestionar la base de datos y otros servicios.
            *   **Autenticación Integrada:** Simplifica la implementación de inicio de sesión, registro, gestión de usuarios y seguridad a nivel de fila (Row Level Security - RLS).
            *   **Escalabilidad:** Al estar basado en tecnologías estándar y ofrecer opciones cloud, permite escalar la aplicación.
            *   Los archivos `lib/supabase-browser.ts` y `lib/supabase-server.ts` indican que se han creado clientes específicos para interactuar con Supabase desde el navegador y el servidor (posiblemente en Server Components o API Routes de Next.js).

*   **Formularios:**
    *   [**React Hook Form**](https://react-hook-form.com/) (v7.54.1)
        *   **¿Qué es?** Una biblioteca para gestionar el estado, la validación y el envío de formularios en React de manera eficiente y sencilla.
        *   **¿Por qué se utiliza?**
            *   **Rendimiento:** Optimiza los re-renders controlando los inputs a través de `ref`s (no controlados) por defecto.
            *   **Facilidad de Integración:** Se integra bien con bibliotecas de componentes UI (como shadcn/ui) y de validación.
            *   **Validación:** Permite integrar fácilmente esquemas de validación.
    *   [**Zod**](https://zod.dev/) (v3.24.1)
        *   **¿Qué es?** Una biblioteca de declaración y validación de esquemas centrada en TypeScript. Permite definir la "forma" de los datos y validarlos.
        *   **¿Por qué se utiliza?** Se usa junto con React Hook Form (a través de `@hookform/resolvers`) para definir reglas de validación claras y robustas para los campos del formulario, aprovechando la inferencia de tipos de TypeScript.

*   **Componentes UI Adicionales y Utilidades:**
    *   **Radix UI (`@radix-ui/*`):** Primitivas de UI sin estilos y accesibles que sirven como base para muchos componentes de `shadcn/ui`. Proporcionan la lógica y la accesibilidad (WAI-ARIA) para elementos complejos como diálogos, menús desplegables, etc.
    *   `lucide-react`: Biblioteca de iconos SVG simple y consistente.
    *   `recharts`: Biblioteca para crear gráficos y visualizaciones de datos (sugiere la presencia de dashboards o reportes visuales).
    *   `sonner`: Para mostrar notificaciones "toast" (mensajes emergentes no intrusivos).
    *   `date-fns` / `react-day-picker`: Para el manejo, formato y selección de fechas.
    *   `class-variance-authority` / `clsx` / `tailwind-merge`: Utilidades para gestionar clases CSS condicionales y variantes de componentes de forma organizada, especialmente útiles con Tailwind y `shadcn/ui`.

*   **Linting/Formato:**
    *   [**ESLint**](https://eslint.org/) (v9.25.0): Herramienta esencial para mantener la calidad del código, encontrar problemas potenciales y asegurar un estilo consistente en todo el proyecto. La configuración (`.eslintrc.json`) define las reglas específicas.

*   **Testing:** (Configuración básica presente)
    *   [**Vitest**](https://vitest.dev/): Un framework de testing moderno y rápido, compatible con la configuración de Vite (aunque Next.js usa Webpack/Turbopack, Vitest puede configurarse).
    *   [**Testing Library**](https://testing-library.com/) (`@testing-library/react`): Proporciona utilidades para testear componentes React de la manera en que los usuarios interactuarían con ellos, fomentando tests más robustos y mantenibles.
    *   `happy-dom` / `jsdom`: Emuladores de entorno de navegador para ejecutar tests fuera de un navegador real.

*   **Gestor de Paquetes:** `npm` (inferido por `package-lock.json`) o `pnpm` (inferido por `pnpm-lock.yaml`). **Es crucial usar el mismo gestor de paquetes consistentemente en el proyecto para evitar problemas con las dependencias.** Si ambos archivos existen, verifica cuál está actualizado o cuál prefiere el equipo. `pnpm` es conocido por ser más rápido y eficiente con el espacio en disco.

## Instalación y Configuración

Sigue estos pasos para poner en marcha el proyecto en tu entorno local:

1.  **Requisitos Previos Esenciales:**
    *   **Node.js:** Asegúrate de tener instalada una versión compatible (generalmente la LTS más reciente o la especificada en un archivo `.nvmrc` si existe. Probablemente >= Node 18). Puedes usar [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) o [nvm-windows](https://github.com/coreybutler/nvm-windows) para gestionar múltiples versiones.
    *   **Gestor de Paquetes:** Instala `npm` (viene con Node.js) o [pnpm](https://pnpm.io/installation) globalmente, según el que utilice el proyecto.
        ```bash
        # Ejemplo para instalar pnpm globalmente si usas npm
        npm install -g pnpm
        ```
    *   **(MUY RECOMENDADO) Cuenta de Supabase:** Regístrate en [Supabase](https://supabase.com/) para obtener una instancia de base de datos y las claves de API necesarias. El plan gratuito es suficiente para empezar.

2.  **Clonar el Repositorio:**
    ```bash
    # Reemplaza con la URL real del repositorio
    git clone https://github.com/tu-usuario/tu-repositorio.git
    cd expense-tracker 
    ```

3.  **Instalar Dependencias:**
    Navega a la carpeta `expense-tracker` y ejecuta el comando de instalación correspondiente al gestor de paquetes elegido:
    *   Si usas `pnpm` (recomendado si `pnpm-lock.yaml` está presente y actualizado):
        ```bash
        pnpm install
        ```
    *   Si usas `npm`:
        ```bash
        npm install
        ```
    Esto descargará todas las bibliotecas listadas en `package.json` en la carpeta `node_modules/`.

4.  **Configuración del Entorno (¡Importante!):**
    *   Este proyecto necesita comunicarse con Supabase, lo cual requiere credenciales secretas. Nunca las guardes directamente en el código.
    *   Busca un archivo llamado `.env.example` en la raíz (`expense-tracker/`). Este archivo es una plantilla.
    *   **Crea una copia** de `.env.example` y renómbrala a `.env.local`. **El archivo `.env.local` está generalmente incluido en `.gitignore` para evitar subir secretos al repositorio.**
        ```bash
        cp .env.example .env.local
        ```
        (O hazlo manualmente en tu explorador de archivos).
    *   **Edita `.env.local`** y rellena los valores con tus propias credenciales de Supabase. Las encontrarás en la configuración de tu proyecto en Supabase (Settings -> API):
        ```env
        # Ejemplo de contenido de .env.local
        NEXT_PUBLIC_SUPABASE_URL=TU_URL_DE_PROYECTO_SUPABASE
        NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_ANONIMA_PUBLICA_DE_SUPABASE

        # Puede haber otras variables aquí, como una SERVICE_ROLE_KEY para operaciones de servidor.
        # ¡NUNCA expongas la SERVICE_ROLE_KEY en el lado del cliente (prefijo NEXT_PUBLIC_)!
        # SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_DE_SERVICIO_SECRETA
        ```
    *   `NEXT_PUBLIC_`: Las variables que empiezan con este prefijo son accesibles desde el código del navegador. Las que no lo tienen, solo son accesibles desde el lado del servidor (API Routes, Server Components con Server Actions, etc.).

5.  **(Opcional pero probable) Configuración de la Base de Datos Supabase:**
    *   El código de la aplicación espera que ciertas tablas y funciones existan en tu base de datos de Supabase.
    *   Si la carpeta `supabase/` existe y contiene archivos `.sql` (probablemente dentro de `supabase/migrations/`), significa que el proyecto utiliza las migraciones de Supabase para gestionar el esquema de la base de datos.
    *   Necesitarás instalar la [**Supabase CLI**](https://supabase.com/docs/guides/cli).
    *   Para configurar tu base de datos local (si trabajas con Supabase localmente) o para aplicar las migraciones a tu instancia cloud, sigue la documentación de Supabase CLI. Un comando común para aplicar migraciones pendientes es:
        ```bash
        # Asegúrate de estar conectado a tu proyecto Supabase (supabase login, supabase link)
        supabase db push
        ```
        **¡Ten mucho cuidado al ejecutar `db push` contra una base de datos en producción!** Asegúrate de entender lo que hace. Para desarrollo local, es más seguro usar `supabase start` y `supabase db reset`.

## Ejecución

Una vez instalado y configurado, puedes ejecutar la aplicación:

*   **Modo Desarrollo:**
    ```bash
    # Usando pnpm
    pnpm dev
    # O usando npm
    npm run dev
    ```
    Este comando inicia un servidor de desarrollo local (normalmente en `http://localhost:3000`). Incluye HMR (Hot Module Replacement) y Fast Refresh, lo que significa que los cambios en el código se reflejan en el navegador casi instantáneamente sin perder el estado de la aplicación. Ideal para trabajar en el día a día.

*   **Build de Producción:**
    ```bash
    # Usando pnpm
    pnpm build
    # O usando npm
    npm run build
    ```
    Este comando compila y optimiza la aplicación para producción. Genera archivos estáticos, optimiza el código JavaScript/CSS, etc., dejándolo listo para el despliegue en la carpeta `.next/`.

*   **Iniciar Servidor de Producción:**
    ```bash
    # Usando pnpm
    pnpm start
    # O usando npm
    npm run start
    ```
    Este comando inicia un servidor Node.js que sirve la aplicación optimizada generada por el comando `build`. Es como se ejecutaría en un entorno de producción real (aunque plataformas como Vercel manejan esto automáticamente).

## Estructura del Proyecto Detallada

La organización del código sigue las convenciones de Next.js (App Router) y buenas prácticas generales:

*   `app/`: **El corazón de la aplicación (App Router).**
    *   `layout.tsx`: Define la estructura principal (layout raíz) que envuelve todas las páginas. Aquí se suelen colocar elementos comunes como cabeceras, barras laterales, providers de contexto, etc.
    *   `page.tsx`: El punto de entrada principal, la página que se muestra en la ruta `/`.
    *   `(carpeta)/page.tsx`: Cada carpeta dentro de `app/` representa un segmento de ruta. El archivo `page.tsx` dentro de ella es la UI para esa ruta (ej. `app/inventario/page.tsx` es la página para `/inventario`).
    *   `(carpeta)/layout.tsx`: Layout específico para un segmento de ruta y sus hijos.
    *   `loading.tsx`: (Opcional) Componente React que se muestra mientras carga el contenido de una ruta.
    *   `error.tsx`: (Opcional) Componente React para manejar errores en una ruta específica.
    *   `template.tsx`: Similar a `layout.tsx`, pero re-renderiza en cada navegación.
    *   `api/`: Contiene **API Routes** (o Route Handlers en App Router). Son endpoints de backend que puedes crear dentro de tu proyecto Next.js para tareas como interactuar con la base de datos de forma segura, procesar formularios, etc. (ej. `app/api/expenses/route.ts`).
*   `components/`: **Componentes React reutilizables.**
    *   Contiene bloques de UI que se usan en múltiples lugares (botones, modales, tarjetas, etc.).
    *   Probablemente incluye tanto componentes personalizados como los componentes `shadcn/ui` que has añadido a tu proyecto. Organízalos en subcarpetas si es necesario (ej. `components/ui/`, `components/charts/`, `components/forms/`).
*   `lib/`: **Funciones de utilidad, lógica compartida y clientes.**
    *   `utils.ts`: Funciones auxiliares genéricas (formateo de fechas, cálculos, etc.).
    *   `supabase-browser.ts`: Configuración del cliente de Supabase para usar en el **navegador** (Componentes de Cliente). Usa la `anon key` pública.
    *   `supabase-server.ts`: Configuración del cliente de Supabase para usar en el **servidor** (Server Components, API Routes, Server Actions). Puede usar la `anon key` o la `service_role key` (si se necesita eludir RLS).
    *   `queries.ts`: Probablemente contiene las funciones asíncronas que realizan las llamadas a Supabase (SELECT, INSERT, UPDATE, DELETE) y que son usadas por TanStack Query.
*   `styles/`: Archivos CSS globales (ej. `globals.css` importado en `layout.tsx`). Generalmente contiene estilos base o reseteos, ya que la mayoría de los estilos provendrán de Tailwind.
*   `public/`: Archivos estáticos servidos directamente desde la raíz (imágenes, fuentes, `favicon.ico`, `robots.txt`).
*   `hooks/`: **Hooks personalizados de React.** Lógica de estado o efectos secundarios reutilizables que pueden ser extraídos de los componentes (ej. `useAuth`, `useTablePagination`).
*   `supabase/`: (Si existe y se usa Supabase CLI) Contiene la configuración local de Supabase, migraciones SQL (`supabase/migrations/`) y opcionalmente funciones Edge (`supabase/functions/`). Permite gestionar la infraestructura de Supabase como código.
*   `__tests__/`: Contiene los archivos de test (Vitest/Testing Library). La estructura interna puede replicar la de `app/` o `components/` para facilitar la localización de los tests correspondientes a cada módulo.
*   **Archivos de Configuración Raíz:**
    *   `package.json`: Define metadatos del proyecto, dependencias (producción y desarrollo) y scripts (`dev`, `build`, `start`, `lint`, etc.).
    *   `package-lock.json` / `pnpm-lock.yaml`: Fijan las versiones exactas de las dependencias instaladas para asegurar builds consistentes. **No editar manualmente.**
    *   `tailwind.config.ts`: Configuración de Tailwind CSS (colores personalizados, fuentes, plugins, rutas de contenido a escanear).
    *   `postcss.config.mjs`: Configuración de PostCSS (Tailwind es un plugin de PostCSS).
    *   `next.config.mjs`: Configuración específica de Next.js (redirecciones, headers, configuración de build, etc.).
    *   `tsconfig.json`: Configuración del compilador de TypeScript (opciones de compilación, rutas base, archivos a incluir/excluir).
    *   `.eslintrc.json`: Configuración de ESLint.
    *   `.gitignore`: Especifica qué archivos y carpetas Git debe ignorar (ej. `node_modules`, `.env.local`, `.next`).

## Uso del Proyecto

_(Necesita descripción detallada)_ - Basado en la estructura y dependencias, la aplicación probablemente permite:

*   **Autenticación:** Inicio de sesión/registro de usuarios (gestionado por Supabase Auth).
*   **Gestión de Gastos:**
    *   Registrar nuevos gastos (fecha, descripción, categoría, monto).
    *   Listar/ver gastos existentes (posiblemente con filtros y paginación).
    *   Editar/eliminar gastos.
*   **Gestión de Inventario:** (Inferido por rutas como `/inventario`)
    *   Añadir/editar productos (nombre, descripción, stock, precio).
    *   Ajustar niveles de stock.
    *   Listar inventario.
*   **Reportes y Resúmenes:** (Inferido por `/resumen`, `/reporte-inventario` y `recharts`)
    *   Visualizar gastos por categoría/tiempo (gráficos).
    *   Generar resúmenes financieros.
    *   Posiblemente reportes de estado de inventario.

**Flujo Típico (Ejemplo):**
1.  Usuario se registra o inicia sesión.
2.  Navega a la sección de "Gastos".
3.  Añade un nuevo gasto usando un formulario (React Hook Form + Zod para validación).
4.  Los datos se envían a una API Route o Server Action que usa el cliente Supabase (`supabase-server.ts`) para insertar el registro en la base de datos PostgreSQL.
5.  La lista de gastos (obtenida usando TanStack Query y `queries.ts`) se actualiza automáticamente o manualmente, mostrando el nuevo gasto.
6.  El usuario navega a "Resumen" para ver gráficos (`recharts`) que agregan los datos de gastos.

## Contribución

_(Necesita descripción)_ - Define cómo otros pueden contribuir:
*   **Reporte de Bugs:** ¿Usar Issues de GitHub? ¿Qué información incluir?
*   **Sugerencias:** ¿Cómo proponer nuevas funcionalidades?
*   **Desarrollo:**
    *   ¿Estilo de código preferido (usar ESLint/Prettier)?
    *   ¿Convenciones de nombrado?
    *   ¿Proceso de Pull Request (fork, crear rama, PR contra `main` o `develop`)?
    *   ¿Tests requeridos?

## Despliegue

_(Necesita descripción)_ - Next.js es muy flexible para el despliegue:
*   **Plataformas Recomendadas (Serverless/Edge):**
    *   [**Vercel**](https://vercel.com/): Creadores de Next.js, ofrece la mejor integración y experiencia. Despliegue automático desde Git. Plan gratuito generoso.
    *   [**Netlify**](https://www.netlify.com/): Otra excelente opción con características similares.
    *   [**AWS Amplify**](https://aws.amazon.com/amplify/): Integración con el ecosistema AWS.
    *   [**Cloudflare Pages**](https://pages.cloudflare.com/): Enfocado en rendimiento y Edge.
*   **Servidor Propio / VPS / Docker:**
    *   Puedes ejecutar la aplicación construida (`npm run build` luego `npm start`) en cualquier servidor Node.js.
    *   Es común usar [Docker](https://www.docker.com/) para empaquetar la aplicación y sus dependencias para un despliegue consistente. Necesitarías un `Dockerfile`.
*   **Consideraciones:**
    *   Asegúrate de configurar las variables de entorno (`.env.production` o en la configuración de la plataforma de hosting) para el entorno de producción.
    *   Configura el dominio personalizado.
    *   Monitoriza la aplicación desplegada.
