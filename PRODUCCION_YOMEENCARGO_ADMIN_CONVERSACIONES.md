# Yo Me Encargo SPA — Panel operativo y dominio real

## Entrega

- **Dominio previsto:** `https://yomeencargo.cl`
- **Panel existente, ampliado:** `https://yomeencargo.cl/admin?tab=ai-conversations`
- **Webhook WhatsApp:** `https://yomeencargo.cl/api/whatsapp/webhook`
- **Webhook Instagram:** `https://yomeencargo.cl/api/instagram/webhook`
- **Flow, retorno:** `https://yomeencargo.cl/api/payment/result`
- **Flow, confirmación:** `https://yomeencargo.cl/api/payment/confirm`

**No requiere crear tablas, modificar restricciones ni ejecutar migraciones nuevas.**
Se reutilizan las tablas ya previstas en el proyecto: `ai_conversations`, `ai_messages`, `ai_actions`, `quote_sessions`, `bookings` y el bucket `bookings` de Storage. Si la instalación real no tiene esas tablas o el bucket, se debe resolver esa ausencia con el encargado de la base de datos; el ZIP no los crea automáticamente.

## Funcionalidad del panel

1. Bandeja con conversaciones de WhatsApp, Instagram (cuando Meta habilite los permisos) y web. También aparecen los registros técnicos de recepción, para auditar saludos y mensajes anteriores a `COTIZAR`.
2. Clasificación humana en `REVISAR` (predeterminada), `COTIZANDO`, `NEGOCIACION`, `RESERVADO`, `VENDIDO`, `RECLAMO` y `CERRADO`. Seleccionar y pulsar **Guardar estado**. Se registra autor, hora, estado anterior y nuevo, y nota opcional en `ai_actions` y `admin_activity_log`.
3. Estado de conversación técnica por separado (`active`, `quoted`, `handoff`, `closed`, `error`). El estado comercial no modifica el modo del bot ni el pago.
4. Imágenes de cotización conservadas en Supabase Storage. Imágenes recibidas fuera de una cotización se almacenan igualmente para auditoría desde la llegada de esta versión. El panel muestra enlaces **firmados y temporales** a los originales.
5. Historial de mensajes, auditoría de acciones y estado de reserva/pago leído de `bookings`. `VENDIDO` no significa pago confirmado: solo `payment_status=approved` registra aprobación de Flow.
6. Botón **Desactivar IA** por contacto: permanece en atención humana incluso si recibe `COTIZAR`. Botón **Permitir nueva cotización**: deja el contacto listo, pero **no** invoca OpenAI ni envía mensajes sin activación del cliente.
7. Si `WHATSAPP_SECRETARY_PHONE_NUMBER_ID` ya está configurado, su tráfico API se archiva sin activar la IA. Puede añadirse opcionalmente una lista de identificadores de números en `WHATSAPP_BOT_DISABLED_PHONE_IDS` separados por comas, para dejar canales enteros en atención humana.

## Variables de entorno de producción

**Asegúrate en la configuración de Vercel de producción de que las variables preexistentes no sigan apuntando a Test97:**

```text
WHATSAPP_QUOTE_BASE_URL=https://yomeencargo.cl
NEXT_PUBLIC_APP_URL=https://yomeencargo.cl
```

En código, los valores por defecto de los enlaces de cotización y de los retornos de Flow ya apuntan al dominio real para despliegues de producción. Si estas variables existen y conservan un valor de pruebas, tienen precedencia sobre el valor por defecto y debes actualizarlas. No se generaron ni cambiaron secretos, tokens, credenciales de Flow o IDs de Meta.

**Para usar el dominio real, es necesario que el DNS y el dominio de Vercel apunten al despliegue correcto.** El ZIP no puede configurar DNS, cambiar Meta/Flow ni publicar por sí mismo.

## Precauciones operativas

- El panel registra eventos que **llegan a sus webhooks**. No puede importar automáticamente el historial previo de WhatsApp Business ni mensajes humanos externos a la API si Meta no los entrega.
- Instagram necesita la aprobación correspondiente de Meta para atender cuentas públicas; la aprobación no se incluye en el ZIP.
- El sistema conserva fotos en el bucket existente y la consulta requiere cuenta de administrador. No poner URLs firmadas en logs públicos.
- La lista del panel trabaja sobre los últimos 250 registros por solicitud; el resumen no es un informe histórico exhaustivo de toda la base de datos.
- Usar respaldos y revisar políticas de retención de datos antes de producción. No utilizar estados manuales para asumir que Flow recibió un pago.

## Validación posterior al despliegue

1. Verifica `/admin/login` y entra a `?tab=ai-conversations`.
2. Desde un teléfono de prueba, envía `Hola`; verifica que aparece un registro en **REVISAR** y que la bienvenida se archiva.
3. `COTIZAR` debe abrir la cotización solamente cuando corresponda. Envía una foto y verifica su vista previa en la ficha.
4. Cambia a `NEGOCIACION`, guarda, y revisa la auditoría con el actor real.
5. Desactiva IA para el contacto, manda `COTIZAR` y comprueba que guarda la entrada pero no contesta. Reactiva desde el panel y prueba nuevo servicio.
6. Paga **únicamente en entorno de ensayo de Flow** y comprueba que el pago real es `approved` solo tras confirmación. No efectuar cargos reales en pruebas.
7. Comprueba que los enlaces de cotización, el retorno y la confirmación de Flow contienen el dominio `yomeencargo.cl`.
