# Yo Me Encargo — Activación explícita del cotizador de WhatsApp

## Cambio de comportamiento

- **Primer mensaje de un teléfono nuevo:** se envía una bienvenida con `COTIZAR`, `ASESOR`, `MENU` y `SALIR`, sin usar OpenAI. Los siguientes mensajes libres no reciben respuesta automática.
- **COTIZAR** (palabra aislada, sin importar mayúsculas): crea una sesión *nueva* y habilita el cotizador. Solo dentro de esta sesión pueden ejecutarse las llamadas de OpenAI para interpretar respuestas.
- **ASESOR** (también `EJECUTIVO` por compatibilidad): termina cualquier sesión activa y silencia permanentemente el bot hasta que el cliente escriba otro comando. El humano puede atender desde el canal que ya utiliza.
- **MENU/MENÚ:** cancela la cotización activa, si la hubiera, y vuelve a mostrar el menú sin OpenAI.
- **SALIR:** cancela la sesión activa y responde una confirmación, sin OpenAI.
- **Fin por inactividad:** 5 minutos desde el último mensaje de la sesión activa.
- **Fin por duración:** 15 minutos desde la activación, incluso si hubo actividad reciente.
- **Cotización PDF generada:** revoca la autorización de OpenAI antes de enviar el resultado.
- **Seguridad:** los eventos de otros números de Meta, los estados de entrega y los mensajes duplicados no inician cotizaciones.

**Semántica de caducidad:** no hay proceso permanente en Vercel. El plazo se comprueba contra marcas de tiempo persistentes al recibir cada mensaje. En consecuencia, aunque el registro todavía diga `quoting` hasta el próximo mensaje, después de 5/15 minutos **ningún mensaje libre volverá a llamar a OpenAI**. No se envía un aviso espontáneo al vencer el tiempo. Para borrar registros vencidos sin tráfico haría falta además una tarea programada, que no es necesaria para evitar llamadas a la IA.

## Cómo desplegar (orden indispensable)

1. **Preparar rollback:** guarda una copia del despliegue anterior de Vercel. Si el bot sigue molestando clientes en este momento, crea temporalmente la variable `WHATSAPP_BOT_ENABLED=false` en Vercel Production y redeploy; bloquea las respuestas del bot pero no corta WhatsApp ni la atención humana.
2. **Supabase:** en el **SQL Editor** del proyecto que utiliza Vercel, ejecuta **una sola vez** `database/migrations/add_whatsapp_bot_sessions.sql`. Esto crea las tablas de estado e idempotencia, y cierra cotizaciones WhatsApp incompletas antiguas. **No toca cotizaciones de la web.** Haz respaldo si necesitas conservar el estado anterior.
3. **Código:** sube al repositorio estos archivos (o el ZIP fuente completo):
   - `src/app/api/whatsapp/webhook/route.ts`
   - `src/lib/whatsapp/botRouter.ts` (nuevo)
   - `src/lib/whatsapp/botStateStore.ts` (nuevo)
   - `src/lib/quoteSession.ts` (pequeña validación adicional de errores)
4. **Variables de Vercel:** conserva `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET` y las credenciales existentes de Supabase y OpenAI. No es necesario volver a generar tokens. Para activar el bot, deja `WHATSAPP_BOT_ENABLED=true` o sin definir. Para **apagar todas las respuestas automáticas**, define `WHATSAPP_BOT_ENABLED=false` y vuelve a desplegar.
5. **Pruebas:** primero en un entorno de pruebas o con números de confianza. Ejecuta `npm run test:whatsapp-bot` usando Node 22+ y envía los mensajes listados abajo. Vercel debe tener el último redeploy activo.

## Prueba de aceptación manual

| Prueba | Resultado esperado |
| --- | --- |
| Primer `Hola` desde un teléfono no registrado en `whatsapp_bot_sessions` | Menú de cuatro opciones, ninguna llamada a OpenAI |
| Otro `Hola` | Silencio |
| `quiero cotizar` (frase, no comando) | Silencio |
| `COTIZAR` | Pregunta 1/7, nueva cotización |
| Responder nombre y correo | Continúa la cotización y se permite OpenAI |
| `ASESOR` mientras cotiza | Finaliza el control del bot; el siguiente mensaje libre no genera respuesta automática |
| `COTIZAR` nuevamente | Nueva cotización desde cero |
| `MENU` mientras cotiza | Cancela cotización y muestra menú |
| `COTIZAR` seguido de `SALIR` | Sesión terminada, no se interpreta ningún mensaje libre |
| `COTIZAR`, esperar más de 5 min, enviar una respuesta | No ejecuta OpenAI y silencia el bot |
| `COTIZAR`, actividad a menos de 5 min, superar 15 min desde activación, enviar respuesta | No ejecuta OpenAI |
| Cotización completada y PDF enviado, después mensaje libre | No ejecuta OpenAI |

## Notas técnicas

- `whatsapp_bot_sessions` es la autorización independiente de `quote_sessions`. Los estados heredados no activan IA.
- `whatsapp_inbound_receipts` guarda los IDs únicos recibidos, de modo que el reenvío de un webhook no genere otra respuesta.
- La bienvenida solo se envía al primer mensaje de un número, y puede recuperarse con `MENU`. Si se quieren nuevas bienvenidas después de cierto período, habrá que definir la política temporal antes de modificarla.
- Los mensajes de atención humana no se almacenan en `ai_messages` si están fuera de una cotización; permanecen en el canal de WhatsApp utilizado por el equipo.
- No se modificó el cotizador web, el cálculo de precios, los PDF ni las credenciales.
