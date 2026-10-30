# Corrección de silencios en WhatsApp — sin migraciones

Cambios localizados: `src/app/api/whatsapp/webhook/route.ts`, `src/lib/ai/whatsappQuoteAssistant.ts` y `src/lib/ai/openai.ts`.

- Mantiene `COTIZAR` como única activación de IA, con coincidencia exacta. `Quiero cotizar` NO la activa.
- No responde automáticamente a mensajes ordinarios fuera de una sesión activa; conserva una sola bienvenida inicial.
- Si pasan 5 minutos sin respuesta, o 15 minutos desde COTIZAR, la sesión termina. Al siguiente mensaje del cliente avisa una sola vez que debe escribir COTIZAR para empezar de nuevo. No envía avisos espontáneos.
- Si falla el parser/servicio de IA durante una sesión autorizada, ya no se pierde silenciosamente: comunica que debe reenviar el texto o pedir ASESOR; el error técnico queda en Vercel Logs.
- Aumenta el límite para el JSON estructurado de OpenAI de 650 a 1600 tokens; detecta respuestas truncadas.
- Para audios o adjuntos no soportados durante la cotización, solicita respuesta escrita, sin llamar a OpenAI.

## Despliegue

1. Reemplaza los archivos de tu repositorio con el contenido del proyecto corregido.
2. Haz push al Git conectado con Vercel y comprueba que el deployment quede listo.
3. Prueba: COTIZAR → nombre y correo (antes de 5 minutos) → debe avanzar a 2/7. Prueba también ASESOR y SALIR.
4. Si aún falla, revisa Vercel > Logs buscando `[WhatsApp webhook] Error procesando mensaje:`. El error preciso permite distinguir API OpenAI, base de datos y mensajes salientes de Meta.

**Sin migraciones SQL, sin cambios en variables de entorno, sin instalaciones adicionales.**

Los saludos automáticos configurados en la aplicación WhatsApp Business son independientes del webhook de Vercel y pueden producir mensajes que el proyecto no controla.

Validación local: 9 tests y análisis de sintaxis de los 3 archivos editados. No se pudo probar conexión real a Meta, Supabase o OpenAI por ausencia de credenciales.
