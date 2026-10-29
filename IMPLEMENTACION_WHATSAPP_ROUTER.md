# Corrección WhatsApp SIN migración de Supabase

Esta versión sustituye el parche anterior. **NO ejecutar ninguna migración nueva.** En particular, NO usar `add_whatsapp_bot_sessions.sql`: no se incluye en la entrega.

## Qué se modifica

Solo tres archivos:
- `src/app/api/whatsapp/webhook/route.ts`: misma URL de Meta, recepción segura, registro de solicitudes y control de OpenAI.
- `src/lib/whatsapp/botRouter.ts`: reglas deterministas de cuatro comandos y plazos 5/15 minutos.
- `src/lib/whatsapp/botStateStore.ts`: usa las tablas preexistentes `quote_sessions`, `ai_conversations`, `ai_messages` y `ai_actions`.

No se agregan tablas, columnas, migraciones, credenciales ni paquetes. No se modifican los cálculos ni los PDF.

## Reglas

- Primer mensaje de un contacto nuevo: menú COTIZAR / ASESOR / MENU / SALIR, sin OpenAI.
- Mensajes libres fuera de cotización: silencio.
- Solo `COTIZAR` (palabra completa) habilita el cotizador y crea una sesión.
- `ASESOR`: cierra la cotización y deja libre el canal humano.
- `MENU`: cierra la cotización y muestra las cuatro opciones.
- `SALIR`: cierra la cotización y confirma.
- Más de 5 minutos sin interacción o más de 15 desde COTIZAR: sesión caducada. Se comprueba al recibir cada mensaje, no requiere proceso programado.
- Al generar el PDF, también se cierra la autorización del bot.
- Sesiones antiguas sin un registro explícito de COTIZAR no autorizan llamadas a OpenAI.
- Los mensajes duplicados se detectan por el índice único ya existente de `ai_messages.external_message_id`.

## Despliegue

1. **No ejecutar SQL.** Guardar un punto de restauración del despliegue actual de Vercel.
2. Copiar únicamente los tres archivos del parche o subir el proyecto completo corregido al repositorio.
3. Desplegar en Vercel. Mantener todas las variables existentes (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`, Supabase, OpenAI).
4. En Vercel Logs debe registrarse `[WhatsApp webhook] POST recibido` por cada solicitud POST que alcance la función. Este registro no revela datos de clientes ni secretos.
5. Probar con un número controlado (un primer HOLA y luego COTIZAR, ASESOR, MENU, SALIR), comprobando que OpenAI no se invoque sin COTIZAR.

### Interruptor de emergencia opcional

`WHATSAPP_BOT_ENABLED=false` apaga todas las respuestas automatizadas; requiere redeploy si se cambia como variable de entorno. No desconecta el número.

## Requisitos previos y límites

Las cuatro tablas `quote_sessions`, `ai_conversations`, `ai_messages` y `ai_actions` y el índice único `ai_messages.external_message_id` ya formaban parte del sistema de cotización original; esta corrección presupone que existen y funcionan en el Supabase asociado a Vercel. No hubo conexión directa a tu Supabase de producción durante estas pruebas: la compilación y las pruebas locales no sustituyen una prueba de integración real. Una simultaneidad excepcional de dos primeros mensajes de un teléfono nuevo podría duplicar el saludo, ya que el esquema existente carece de una restricción única por teléfono; no se añadió una tabla o índice nuevo para no alterar tu base de datos.
