# MVP v1 — Cotizador Yo Me Encargo

> Documento histórico de v1. Para la versión actual, ver `MVP_V1_2.md`.

## Qué incluye

### 1) Asistente comercial en la portada
- `src/components/ui/ChatBot.tsx`
- API: `POST /api/ai/sales-chat`
- Prompt separado para orientación comercial.
- Lleva al cotizador online o a la cotización a domicilio cuando corresponde.
- Si OpenAI no está disponible, ofrece continuar al cotizador sin bloquear la página.

### 2) Inventario rápido con IA
- Aparece únicamente en el paso de selección de items.
- Botón flotante pulsante con el mensaje: **“¿Quieres hacer esta parte más rápido y cómodo?”**
- Acepta texto natural y hasta 5 fotografías.
- API: `POST /api/ai/inventory`.
- El modelo solo puede devolver IDs que existan en `catalog_items`.
- El backend vuelve a validar los IDs antes de aplicar resultados.
- El volumen y peso provienen del catálogo existente: la IA no inventa m³.
- Si una variante es ambigua, puede pedir una aclaración corta en vez de adivinar.
- Las fotos se reducen/comprimen en el navegador para limitar transferencia y costo.

### 3) Handoff comercial por WhatsApp
Se agregó un CTA de seguimiento con mensaje prellenado:
- al terminar/cerrar una cotización;
- después de un pago de mudanza;
- después de pagar una cotización a domicilio.

El número se centraliza en `NEXT_PUBLIC_WHATSAPP_NUMBER`. El botón flotante global usa la misma configuración.

### 4) Cotización a domicilio premium
- Precio inicial/fallback MVP: **$80.000 CLP**.
- El precio se puede editar desde **Admin → Configuración de precios**.
- Se muestra la leyenda **“IDEAL PARA MUDANZAS GRANDES”** en la selección y página de cotización a domicilio.
- Pago, prospecto, reserva y PDF toman el valor dinámico.
- Para no exigir una migración de base de datos en este MVP, `homeQuotePrice` se guarda dentro del JSON `pricing_config.additional_services` y la API lo expone como propiedad de primer nivel.

## IA / variables de entorno

Agregar al entorno de despliegue:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
NEXT_PUBLIC_WHATSAPP_NUMBER=569XXXXXXXX
```

El código usa la Responses API directamente mediante `fetch`; no se agregó otra dependencia npm.

## Seguridad y costo
- La API de IA está rate-limited por IP: 30 solicitudes cada 10 minutos.
- La clave de OpenAI solo se lee en el servidor.
- El parser de inventario no ejecuta consola, SQL ni endpoints arbitrarios.
- Las fotografías no se persisten por este código; se envían en la solicitud de análisis con `store: false` hacia la API configurada.

## Validación realizada en este entorno
- Parseo sintáctico TypeScript/TSX de todos los archivos modificados: OK.
- Búsqueda de antiguos hardcodes `$23.000` / `23000`: el único `$23.000` restante corresponde al precio independiente de **Fletes** en la landing, no a la cotización a domicilio.
- No fue posible ejecutar `npm ci`/`next build` en este entorno porque faltan paquetes npm en caché y la instalación de red no completó. Antes de desplegar, ejecutar localmente:

```bash
npm ci
npm run build
```

## Prueba funcional sugerida
1. Configurar las variables de entorno.
2. Abrir `/` y probar el asistente comercial.
3. Entrar a `/cotizador?start=online`, avanzar a Inventario y probar texto + fotos.
4. Verificar que los items detectados se agreguen al mismo inventario manual.
5. En Admin, cambiar el precio de cotización a domicilio y confirmar que `/domicilio` y el checkout reflejen el nuevo valor.
6. Verificar los CTA de WhatsApp en resumen y páginas de pago exitoso.
