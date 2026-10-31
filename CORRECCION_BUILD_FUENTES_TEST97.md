# Reparación de compilación de Test97 (31-10-2026)

## Motivo

En Vercel, Next.js 14.1.0 falló en `next/font/google` durante la compilación de `Hanken_Grotesk` (`Cannot read properties of null (reading '1')`). La integración de Instagram no produjo este error.

## Cambios realizados

- `src/app/layout.tsx`: retiradas las importaciones y llamadas a `next/font/google` para `Archivo` y `Hanken_Grotesk`; el `<body>` deja de depender de las variables generadas en compilación.
- `src/app/globals.css`: declarados fallbacks del sistema para `--font-archivo` y `--font-hanken`, que ya consume Tailwind y el CSS existente.

La tipografía puede diferir levemente de la original. No se cambian rutas, scripts, variables de entorno, pagos, APIs, sesiones, base de datos ni reglas del bot. No se añaden migraciones.

## Despliegue

Usar el proyecto completo de este ZIP y reemplazar el contenido del repositorio TEST97. Hacer `git push`; Vercel compilará de nuevo. Si aparece otro error distinto, utilizar el nuevo registro, sin mezclar parches.
