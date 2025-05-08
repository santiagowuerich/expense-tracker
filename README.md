# Expense Tracker & Inventory (Nombre Tentativo)

## Descripción del Proyecto

**Expense Tracker & Inventory Pro (ETIP)** es una aplicación web integral diseñada para ofrecer a individuos y pequeñas empresas una solución robusta para el **seguimiento detallado de gastos y la gestión eficiente de inventario.** Permite a los usuarios registrar, categorizar, analizar y visualizar sus flujos financieros y movimientos de stock, facilitando una toma de decisiones informada.

**Funcionalidades Clave Implementadas:**
*   Registro y categorización de gastos.
*   Gestión de pagos (incluyendo cuotas y diferentes métodos de pago).
*   Administración de inventario (productos, stock).
*   Registro de ventas y asociación con productos del inventario.
*   Generación de resúmenes financieros y de pagos.
*   Eliminación segura de transacciones (gastos, pagos, ventas).
*   Autenticación de usuarios.
*   Interfaz responsiva adaptada a dispositivos móviles.

**Propósito:** El objetivo principal de ETIP es **centralizar y simplificar la gestión financiera y de inventario.** Busca eliminar la complejidad de usar múltiples herramientas o hojas de cálculo dispersas, proporcionando una plataforma única, intuitiva y potente que permita a los usuarios tener un control claro sobre sus ingresos, egresos y el estado de su inventario, optimizando así su planificación y operación.

**Motivación:** La creación de ETIP surge de la necesidad común de contar con una herramienta personalizable y fácil de usar que no solo registre transacciones, sino que también ofrezca insights valiosos y ayude a mantener una salud financiera y un control de stock óptimos, especialmente para emprendedores o usuarios que buscan mejorar su organización personal.

**Estado Actual:** En desarrollo activo, con un conjunto sólido de funcionalidades centrales ya implementadas y enfocándose en la mejora continua de la experiencia de usuario y la adición de nuevas características.

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

*   `app/`: **El corazón de la aplicación (App Router de Next.js).**
    *   `layout.tsx`: Define la estructura principal (layout raíz) que envuelve todas las páginas. Aquí se suelen colocar elementos comunes como cabeceras, barras laterales, providers de contexto, etc.
    *   `page.tsx`: El punto de entrada principal, la página que se muestra en la ruta `/` (Dashboard o página de inicio).
    *   `globals.css`: Estilos globales aplicados a toda la aplicación. Mantenido aquí por convención de algunos proyectos Next.js aunque `styles/globals.css` es más común.
    *   `inventario/`: Contiene las páginas y componentes relacionados con la gestión de inventario (ej. listar, añadir, editar productos).
        *   `page.tsx`: Página principal de la sección de inventario.
        *   Probablemente subcarpetas para acciones específicas como `añadir-producto/`, `editar-producto/`, `eliminar-productos/`.
    *   `resumen/`: Se encarga de las páginas y componentes para mostrar resúmenes financieros o de actividad.
        *   `page.tsx`: Página principal de la sección de resúmenes.
        *   `eliminar-pagos/page.tsx`: Página específica para la eliminación de pagos.
        *   `eliminar-ventas/page.tsx`: Página específica para la eliminación de ventas.
    *   `ventas/`: Contiene las páginas y lógica relacionada con el registro y gestión de ventas.
        *   `page.tsx`: Página principal de la sección de ventas.
        *   `registrar/page.tsx`: Página para registrar nuevas ventas.
        *   `historial/page.tsx`: Página para ver el historial de ventas.
    *   `reporte-inventario/`: Dedicada a los reportes específicos del inventario.
        *   `page.tsx`: Página principal para los reportes de inventario.
    *   `api/`: Contiene **Route Handlers (API Routes)**. Son endpoints de backend para tareas como interactuar con la base de datos de forma segura, procesar formularios, etc.
        *   Ejemplos pueden ser: `api/productos/route.ts`, `api/ventas/route.ts`.

*   `components/`: **Componentes React reutilizables.**
    *   Contiene bloques de UI que se usan en múltiples lugares.
    *   `ui/`: Componentes de UI genéricos, probablemente de `shadcn/ui` (ej. `button.tsx`, `dialog.tsx`, `card.tsx`).
    *   `ventas/`: Componentes específicos para la sección de ventas.
    *   Archivos como `expense-modal.tsx`, `add-product-dialog.tsx`, `purchase-details-dialog.tsx`: Componentes modales y de diálogo para diversas funcionalidades.
    *   `theme-provider.tsx`: Provider para la gestión de temas (ej. claro/oscuro).
    *   `toaster.tsx`: Componente para mostrar notificaciones (toasts).
    *   `providers.tsx`: Agrupa diferentes providers de contexto para la aplicación.
    *   `empty-state.tsx`: Componente para mostrar cuando no hay datos.
    *   `expense-summary.tsx`: Componente para mostrar un resumen de gastos.

*   `hooks/`: **Hooks personalizados de React.**
    *   Contienen lógica de estado o efectos secundarios reutilizables extraídos de los componentes.
    *   `useProductos.ts`: Hook para la lógica relacionada con productos.
    *   `useVentas.ts`: Hook para la lógica relacionada con ventas.
    *   `useResumenCompras.ts`: Hook para obtener y procesar datos de resumen de compras/pagos.
    *   `usePdfActions.ts`: Hook para funcionalidades relacionadas con la generación o manejo de PDFs.
    *   `use-mobile.tsx`: Hook para detectar si la aplicación se visualiza en un dispositivo móvil.
    *   `use-toast.ts`: Hook personalizado para la gestión de notificaciones toast, probablemente interactuando con `sonner`.

*   `lib/`: **Funciones de utilidad, lógica compartida y clientes de servicios.**
    *   `utils.ts`: Funciones auxiliares genéricas (formateo de fechas, cálculos, validaciones, etc.).
    *   `supabase-browser.ts`: Configuración del cliente de Supabase para usar en el **navegador** (Componentes de Cliente). Usa la `anon key` pública.
    *   `supabase-server.ts`: Configuración del cliente de Supabase para usar en el **servidor** (Server Components, API Routes, Server Actions). Puede usar la `anon key` o la `service_role key`.
    *   `queries.ts`: Contiene las funciones asíncronas que realizan las llamadas a Supabase (SELECT, INSERT, UPDATE, DELETE) y que son usadas por TanStack Query.
    *   `actions/`: Probablemente contiene Server Actions de Next.js para mutaciones de datos del lado del servidor.
    *   `types/`: Definiciones de tipos TypeScript específicas de la lógica de `lib/` (si las hay, a veces los tipos globales están en `types/` raíz).

*   `public/`: **Archivos estáticos.**
    *   Servidos directamente desde la raíz del sitio (ej. `/placeholder-logo.svg`). Contiene imágenes, fuentes, `favicon.ico`, `robots.txt`, etc.
    *   Los archivos `placeholder-*.svg/jpg/png` son ejemplos de imágenes estáticas.

*   `styles/`: **Archivos de estilos globales.**
    *   `globals.css`: Contiene estilos CSS globales, reseteos, o estilos base que se aplican a toda la aplicación. Es importado típicamente en `app/layout.tsx`.

*   `supabase/`: **Configuración y migraciones de la base de datos Supabase.**
    *   `migrations/`: Contiene archivos SQL que definen el esquema de la base de datos y sus cambios a lo largo del tiempo. Son gestionados por Supabase CLI.
    *   `setup.sql`, `update_schema.sql`, `verify_tables.sql`: Scripts SQL auxiliares, posiblemente para configuración inicial, actualizaciones manuales o verificaciones.

*   `types/`: **Definiciones globales de TypeScript.**
    *   Contiene interfaces y tipos que se utilizan en varias partes de la aplicación.
    *   `venta.ts`: Define la estructura del tipo `Venta`.

*   `__tests__/`: **Archivos de pruebas.**
    *   Contiene los tests unitarios y de integración para componentes y lógica de la aplicación.
    *   Utiliza Vitest y React Testing Library.
    *   Ejemplos: `register-transaction.test.tsx`, `resumen.test.tsx`.

*   **Archivos de Configuración Raíz:**
    *   `package.json`: Define metadatos del proyecto, dependencias (producción y desarrollo) y scripts (`dev`, `build`, `start`, `lint`, etc.).
    *   `package-lock.json` / `pnpm-lock.yaml`: Fijan las versiones exactas de las dependencias instaladas para asegurar builds consistentes. **No editar manualmente.** (Parece que tienes ambos, idealmente deberías usar solo uno, probablemente `pnpm-lock.yaml` si `pnpm` es tu gestor de paquetes preferido).
    *   `tailwind.config.ts`: Configuración de Tailwind CSS (colores personalizados, fuentes, plugins, rutas de contenido a escanear).
    *   `postcss.config.mjs`: Configuración de PostCSS (Tailwind es un plugin de PostCSS).
    *   `next.config.mjs`: Configuración específica de Next.js (redirecciones, headers, configuración de build, etc.).
    *   `tsconfig.json`: Configuración del compilador de TypeScript (opciones de compilación, rutas base, archivos a incluir/excluir).
    *   `next-env.d.ts`: Declaraciones de tipos globales para Next.js.
    *   `components.json`: Archivo de configuración para `shadcn/ui`, define dónde se ubican los componentes y otras preferencias.
    *   `.eslintrc.json`: Configuración de ESLint para el análisis estático del código.
    *   `.gitignore`: Especifica qué archivos y carpetas Git debe ignorar (ej. `node_modules`, `.env.local`, `.next`).
    *   `.vscode/`: Configuraciones específicas para el editor Visual Studio Code.
    *   `.idx/`: Archivos generados por IDX (si estás usando este entorno).

## Uso del Proyecto

ETIP está diseñado para ser intuitivo, permitiendo a los usuarios gestionar eficientemente sus finanzas e inventario.

*   **Autenticación:**
    *   Los usuarios pueden registrarse para crear una nueva cuenta o iniciar sesión si ya poseen una.
    *   La autenticación es gestionada de forma segura por Supabase Auth.

*   **Panel Principal (Dashboard):**
    *   Al iniciar sesión, el usuario es recibido con un resumen visual de su información financiera clave y posiblemente alertas de inventario (ej. stock bajo).
    *   Acceso rápido a las principales secciones: Gastos, Inventario, Ventas, Resúmenes.

*   **Gestión de Gastos:**
    *   **Registrar Gasto:**
        *   Formulario para ingresar detalles del gasto: descripción, monto, fecha, categoría (seleccionable o nueva), método de pago.
        *   Opción para registrar gastos recurrentes o pagos en cuotas.
    *   **Listar/Ver Gastos:**
        *   Visualización de gastos con filtros (por fecha, categoría, método de pago) y paginación.
        *   Posibilidad de editar o eliminar gastos existentes.
    *   **Gestión de Pagos (especialmente tarjetas y cuotas):**
        *   Registro detallado de pagos con tarjeta, incluyendo la posibilidad de diferir en cuotas.
        *   Seguimiento de cuotas pendientes y pagadas.
        *   Página específica para la eliminación de pagos individuales o agrupados (cuotas).

*   **Gestión de Inventario:**
    *   **Añadir Producto:** Formulario para agregar nuevos productos al inventario (nombre, descripción, categoría, SKU, precio de costo, precio de venta, stock inicial, proveedor, etc.).
    *   **Listar Inventario:** Vista general del inventario con información clave de cada producto (stock actual, valor del inventario, etc.). Búsqueda y filtros disponibles.
    *   **Editar Producto:** Modificar detalles de productos existentes.
    *   **Ajustar Stock:** Registrar entradas (compras a proveedores) y salidas (ajustes manuales, mermas) de stock.
    *   **Eliminar Productos:** Opción para dar de baja productos del inventario (con consideraciones sobre el historial de ventas).

*   **Gestión de Ventas:**
    *   **Registrar Venta:**
        *   Selección de productos del inventario para añadir al carrito de venta.
        *   Cálculo automático de totales.
        *   Selección de método de pago.
        *   Actualización automática del stock de los productos vendidos.
    *   **Historial de Ventas:** Listado de todas las ventas realizadas, con filtros y posibilidad de ver detalles de cada transacción.
    *   **Eliminar Ventas:** Interfaz para la eliminación de registros de ventas, con las debidas confirmaciones.

*   **Reportes y Resúmenes:**
    *   **Resumen Financiero:** Visualización de ingresos vs. egresos, flujo de caja, gastos por categoría (con gráficos `recharts`).
    *   **Resumen de Pagos:** Detalle de pagos realizados, agrupados por método o por mes.
    *   **Reporte de Inventario:** Estado actual del inventario, productos con bajo stock, valorización del inventario, rotación de productos.

**Flujo Típico (Ejemplo de un Gasto y una Venta):**
1.  Un usuario se registra o inicia sesión.
2.  **Registro de Gasto:**
    *   Navega a la sección "Gastos" y selecciona "Registrar Gasto".
    *   Completa el formulario (React Hook Form + Zod) con detalles como: "Compra de papelería para oficina", $50, fecha actual, categoría "Suministros de Oficina", método "Efectivo".
    *   Los datos se envían (posiblemente vía Server Action o API Route) al backend, que usa el cliente Supabase (`supabase-server.ts`) para insertar el registro en la tabla `pagos` o `gastos`.
    *   La lista de gastos (obtenida con TanStack Query desde `queries.ts`) se actualiza, mostrando el nuevo gasto.
3.  **Registro de Venta:**
    *   Navega a "Inventario" y verifica que el producto "Cuaderno Profesional" tiene stock.
    *   Navega a "Ventas" y selecciona "Registrar Venta".
    *   Añade 2 unidades de "Cuaderno Profesional" al carrito.
    *   Procede al pago, seleccionando "Tarjeta de Crédito" como método.
    *   Confirma la venta. El sistema registra la venta, descuenta 2 unidades del stock de "Cuaderno Profesional" y actualiza los registros financieros.
4.  **Consulta de Resumen:**
    *   El usuario navega a "Resumen" para ver gráficos (`recharts`) que muestran los gastos del mes por categoría, donde ahora figura "Suministros de Oficina".
    *   También puede ver un incremento en los ingresos por ventas.

## Contribución

¡Las contribuciones son bienvenidas! Si deseas ayudar a mejorar ETIP, sigue estas directrices:

*   **Reporte de Bugs:**
    *   Utiliza la sección de "Issues" en GitHub para reportar bugs.
    *   Describe el bug detalladamente: pasos para reproducirlo, comportamiento esperado vs. comportamiento actual.
    *   Incluye capturas de pantalla o GIFs si ayudan a ilustrar el problema.
    *   Especifica la versión del navegador o entorno si es relevante.

*   **Sugerencias de Funcionalidades:**
    *   También puedes usar "Issues" para proponer nuevas funcionalidades o mejoras.
    *   Describe claramente la funcionalidad y por qué crees que sería útil para la aplicación.

*   **Desarrollo:**
    *   **Fork y Clone:** Haz un fork del repositorio y clónalo en tu máquina local.
    *   **Rama:** Crea una nueva rama descriptiva para tus cambios (ej. `feature/nueva-funcionalidad` o `fix/bug-login`).
        ```bash
        git checkout -b feature/nombre-descriptivo
        ```
    *   **Código:** Asegúrate de seguir el estilo de código existente. Ejecuta el linter para verificar tu código:
        ```bash
        # Usando pnpm
        pnpm lint
        # O usando npm
        npm run lint
        ```
        Considera configurar ESLint para que se ejecute automáticamente al guardar en tu editor.
    *   **Commits:** Escribe mensajes de commit claros y concisos.
    *   **Tests:** Si añades nueva funcionalidad, incluye tests unitarios o de integración. Si corriges un bug, considera añadir un test que cubra ese caso.
    *   **Pull Request (PR):** Una vez que tus cambios estén listos y probados, haz un push de tu rama a tu fork y crea un Pull Request contra la rama `main` (o `develop` si existe como rama principal de desarrollo) del repositorio original.
        *   En la descripción del PR, explica los cambios realizados y enlaza cualquier Issue relevante.

## Despliegue

Next.js es muy flexible para el despliegue. ETIP puede desplegarse en diversas plataformas:

*   **Plataformas Recomendadas (Serverless/Edge):**
    *   [**Vercel**](https://vercel.com/): Creadores de Next.js, ofrece la mejor integración y experiencia. Despliegue automático desde Git. Plan gratuito generoso.
    *   [**Netlify**](https://www.netlify.com/): Otra excelente opción con características similares.
    *   [**AWS Amplify**](https://aws.amazon.com/amplify/): Integración con el ecosistema AWS.
    *   [**Cloudflare Pages**](https://pages.cloudflare.com/): Enfocado en rendimiento y Edge.

*   **Servidor Propio / VPS / Docker:**
    *   Puedes ejecutar la aplicación construida (`pnpm build` luego `pnpm start`) en cualquier servidor Node.js.
    *   Es común usar [Docker](https://www.docker.com/) para empaquetar la aplicación y sus dependencias para un despliegue consistente. Necesitarías un `Dockerfile`.

*   **Consideraciones Importantes para Producción:**
    *   **Variables de Entorno:** Asegúrate de configurar TODAS las variables de entorno necesarias (especialmente `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` si la usas) en la configuración de tu plataforma de hosting. **Nunca subas tu archivo `.env.local` o `.env.production` al repositorio Git.**
    *   **Dominio Personalizado:** Configura tu dominio personalizado según las guías de tu proveedor de hosting.
    *   **Monitorización:** Implementa herramientas de monitorización para supervisar el rendimiento y los errores de la aplicación en producción.

## Roadmap y Funcionalidades Futuras (Ideas)

ETIP tiene potencial para crecer. Algunas ideas para futuras versiones incluyen:

*   **Presupuestos:** Permitir a los usuarios crear presupuestos mensuales/anuales por categoría y hacer seguimiento.
*   **Objetivos de Ahorro:** Funcionalidad para establecer y monitorear metas de ahorro.
*   **Importación/Exportación de Datos:** Permitir importar datos desde CSV/Excel y exportar reportes.
*   **Gestión de Múltiples Negocios/Perfiles:** Para usuarios que gestionan finanzas de más de una entidad.
*   **Notificaciones Avanzadas:** Alertas personalizadas (ej. facturas por vencer, stock bajo crítico, presupuesto excedido).
*   **Integración con Bancos (Plaid u similar):** Sincronización automática de transacciones bancarias (considerar complejidad y seguridad).
*   **Gestión de Proveedores y Clientes:** Módulos básicos de CRM.
*   **Roles y Permisos de Usuario:** Para equipos o familias que comparten la gestión.
*   **Internacionalización (i18n):** Soporte para múltiples idiomas y monedas.
*   **App Móvil Nativa o PWA Mejorada:** Para una mejor experiencia en dispositivos móviles.
