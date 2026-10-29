# WhatsApp — listo para Git + redeploy (SIN MIGRACIONES)

Esta versión **NO necesita SQL ni nuevas tablas**, ni cambiar tokens o variables existentes.

## Despliegue

1. Sube los archivos de este proyecto a tu repositorio Git (conserva tus `.env` fuera de Git).
2. Redeploy en Vercel (o deja que el despliegue automático por Git termine).
3. Prueba con un número propio antes de difundirlo.

Si necesitas apagar la automatización sin desconectar WhatsApp, define `WHATSAPP_BOT_ENABLED=false` en Vercel y haz redeploy. Para activarla, elimina esa variable o asígnale `true`. No es necesario definirla en condiciones normales.

## Reglas

- Primera vez que alguien escribe sin comando: recibe una bienvenida única con COTIZAR, ASESOR, MENU y SALIR, sin OpenAI.
- `COTIZAR`: solo esta palabra **exacta** inicia un cuestionario nuevo y permite usar OpenAI.
- `ASESOR`: cancela el bot y permite atender manualmente, sin OpenAI.
- `MENU`: muestra las opciones, cancela el flujo en curso, sin OpenAI.
- `SALIR`: desactiva el flujo de inmediato, sin OpenAI.
- Inactividad de **5 minutos** o duración total de **15 minutos**: revoca la autorización para OpenAI. No envía mensajes automáticos al vencer el plazo; se comprueba al recibir un nuevo mensaje.
- PDF completado: desactiva el cotizador automático.
- Sin sesión autorizada, cualquier texto ordinario queda en silencio; `quiero cotizar` NO equivale al comando COTIZAR.

## Persistencia sin cambios de esquema

El estado de activación se registra en las tablas existentes `ai_conversations` y `quote_sessions` y se distingue de las conversaciones antiguas por un marcador privado en el campo `model`.

El control de mensajes duplicados reutiliza el índice único preexistente `ai_messages.external_message_id`. Por tanto, **NO hay que ejecutar ningún script de Supabase**.

Se siguen usando las variables existentes `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET` y credenciales ya configuradas.

## Pruebas

Ejecuta `npm run test:whatsapp-bot` (Node 22+). Comprueba manualmente: bienvenida, silencio posterior, COTIZAR, ASESOR, SALIR, MENU, expiración a 5/15 minutos y cierre después del PDF. Los tests de lógica no sustituyen a una prueba del webhook real contra Meta/Supabase.
