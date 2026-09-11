# Yo Me Encargo — MVP 1.3

## Qué cambia

La versión 1.3 convierte WhatsApp en un segundo canal del cotizador y agrega auditoría de IA en Admin.

### 1. WhatsApp como cotizador conversacional

Endpoint de Meta:

- `GET /api/whatsapp/webhook`: verificación del webhook.
- `POST /api/whatsapp/webhook`: recepción firmada de mensajes.

El bot recorre las mismas 7 secciones del cotizador:

1. Nombre + correo (el teléfono se toma del número de WhatsApp).
2. Fecha y hora, validando disponibilidad de agenda.
3. Direcciones de origen/destino.
4. Detalles de ambas propiedades.
5. Inventario por texto o foto, con resolución de ambigüedades.
6. Servicios adicionales.
7. Confirmación y generación automática de cotización.

Al confirmar:

- calcula con el mismo esquema de precios del sitio;
- crea/actualiza el prospecto con `source=whatsapp`;
- genera un PDF de la cotización;
- lo guarda en Supabase Storage;
- envía el PDF al cliente por WhatsApp;
- devuelve un link para revisar la misma sesión en `/cotizador`.

Si el usuario escribe `EJECUTIVO` (o pide una persona), la conversación queda en estado `handoff` para continuar manualmente. Si más adelante escribe `NUEVA COTIZACIÓN` / `cotizar de nuevo`, se abre una sesión nueva sin mezclarla con la anterior.

### 2. Sesión compartida WhatsApp → Web

El bot guarda una `quote_session`. El enlace enviado por WhatsApp incluye un token de reanudación y precarga los forms de la web con los datos ya recopilados.

### 3. Admin → Conversaciones IA

Nueva pestaña **Conversaciones IA** con:

- canal (`web` / `whatsapp`);
- estado (`active`, `quoted`, `handoff`, etc.);
- transcript completo;
- acciones estructuradas ejecutadas por IA;
- cotización asociada;
- input/output tokens;
- costo estimado de IA;
- indicador de conversión;
- estado de configuración de WhatsApp Cloud API.

El chatbot comercial de Home y el asistente de inventario web también se auditan en estas tablas de manera best-effort. Durante una misma sesión del navegador comparten el mismo ID de conversación, para que Admin muestre un historial continuo en vez de fragmentos separados.

### 4. Nuevo copy comercial de WhatsApp

Se reemplazó el concepto de “dejar constancia” por:

> **Afina los detalles de tu mudanza con nuestro ejecutivo**

El beneficio sigue enfatizando evitar olvidos, cambios de último minuto y problemas de coordinación.

## Migración obligatoria

Antes de activar WhatsApp, ejecutar en Supabase SQL Editor:

`database/migrations/add_ai_conversations_and_quote_sessions.sql`

Crea:

- `quote_sessions`
- `ai_conversations`
- `ai_messages`
- `ai_actions`

También habilita `source='whatsapp'` en `quote_prospects`.

## Variables nuevas

```env
WHATSAPP_GRAPH_VERSION=v26.0
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...
META_APP_SECRET=...
NEXT_PUBLIC_SITE_URL=https://yomeencargo.cl
```

OpenAI sigue usando:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-luna
```

## Qué queda pendiente de credenciales externas

El código no puede hacer una prueba real de envío/recepción con el número de Tommy hasta que Meta entregue el `WHATSAPP_ACCESS_TOKEN`, `PHONE_NUMBER_ID` y el App Secret. Sin esas credenciales el sitio y los asistentes web siguen funcionando; la pestaña de Admin mostrará WhatsApp como pendiente.


## Privacidad y auditoría

La Política de Privacidad del sitio fue ajustada para informar que los asistentes pueden procesar y almacenar mensajes, respuestas y fotografías de cotización, y que el historial puede revisarse para mejorar el servicio. Admin guarda el transcript y las acciones estructuradas, no razonamiento interno del modelo.

## Validación realizada en este paquete

- Parseo sintáctico de todos los archivos TS/TSX del proyecto: sin errores.
- Chequeo TypeScript estricto aislado del núcleo nuevo de servidor (WhatsApp, sesiones, IA, PDF y APIs): sin errores.
- El build completo de Next.js no se ejecutó en este runtime porque las dependencias npm no estaban disponibles en caché y el entorno no pudo descargarlas. Antes de producción: `npm ci && npm run build`.
