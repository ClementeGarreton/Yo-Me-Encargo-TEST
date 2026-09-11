# Activar WhatsApp Cloud API — Yo Me Encargo

## 1. Meta Business / Developers

Usar el Business Portfolio de Yo Me Encargo y crear (o reutilizar) una app de tipo Business en Meta for Developers. Agregar el producto **WhatsApp**.

Si el +56 9 5439 0267 está actualmente en WhatsApp Business App, intentar primero el flujo de **Coexistence** para conservar la app del teléfono y la Cloud API simultáneamente, si Meta lo ofrece para la cuenta.

## 2. Variables

Copiar a `.env.local` / Vercel:

```env
WHATSAPP_GRAPH_VERSION=v26.0
WHATSAPP_ACCESS_TOKEN=TOKEN_PERMANENTE
WHATSAPP_PHONE_NUMBER_ID=PHONE_NUMBER_ID
WHATSAPP_VERIFY_TOKEN=elige-un-token-largo-y-secreto
META_APP_SECRET=APP_SECRET
NEXT_PUBLIC_SITE_URL=https://yomeencargo.cl
```

No usar `NEXT_PUBLIC_` para tokens de Meta.

## 3. Webhook

En Meta configurar como Callback URL:

`https://yomeencargo.cl/api/whatsapp/webhook`

Verify Token: exactamente el mismo valor de `WHATSAPP_VERIFY_TOKEN`.

Suscribir el WABA a eventos de mensajes (`messages`).

El POST valida `x-hub-signature-256` con `META_APP_SECRET` en producción.

## 4. Base de datos

Ejecutar primero:

`database/migrations/add_ai_conversations_and_quote_sessions.sql`

## 5. Prueba de punta a punta

Desde un teléfono externo escribir al número comercial:

`Hola, quiero cotizar una mudanza`

Debe responder con **1/7 · Tus datos**. Completar las secciones hasta responder `CONFIRMAR`. El resultado esperado es:

1. mensaje con precio/volumen/distancia;
2. PDF adjunto;
3. conversación visible en **Admin → Conversaciones IA**;
4. prospecto visible con `source=whatsapp`;
5. link de reanudación web con los forms precargados.

## 6. Handoff

En cualquier momento escribir `EJECUTIVO`. La conversación pasa a `handoff`. Con Coexistence, el equipo puede seguir contestando desde la app de WhatsApp Business usando el mismo chat.


## 7. Nueva cotización desde el mismo número

Si un cliente ya terminó una cotización o quedó derivado a ejecutivo, puede escribir `NUEVA COTIZACIÓN` o `cotizar de nuevo`. El backend cierra la sesión anterior y abre una nueva, conservando ambos historiales por separado en Admin.
