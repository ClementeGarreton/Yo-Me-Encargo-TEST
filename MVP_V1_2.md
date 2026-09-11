# MVP v1.2 — Cotizador Yo Me Encargo

Esta versión es una iteración de corrección y conversión sobre MVP v1. No cambia la arquitectura principal del cotizador.

## Cambios de v1.2

### 1) Cotización a domicilio: corrección visual
- `/domicilio` usa el mismo `Navbar`, separación superior y `Footer` que el cotizador online.
- La barra `ProgressBar` queda alineada bajo el Navbar y ya no se superpone con el encabezado del servicio al hacer scroll.
- Se mantiene el precio dinámico editable desde Admin y la leyenda **IDEAL PARA MUDANZAS GRANDES**.

### 2) Inventario IA mucho más visible
- El acceso dejó de depender de un pequeño botón flotante.
- Ahora aparece como un callout grande en la esquina superior derecha del bloque de Inventario.
- Copy directo: **“¿Quieres terminar el inventario mucho más rápido?”** y CTA **“PROBAR NUESTRA MEJOR HERRAMIENTA”**.
- El panel abierto queda fijo a la derecha en desktop y ocupa una hoja cómoda en mobile.

### 3) Ambigüedades resolubles con un clic
La API `POST /api/ai/inventory` ahora puede devolver `pendingResolutions` además de los items seguros.

Cada objeto dudoso incluye:
- nombre entendido por la IA;
- cantidad;
- explicación breve de la duda;
- hasta 5 opciones reales de `catalog_items`.

La UI muestra botones con nombre, volumen y peso. Al elegir uno se agrega directamente al inventario y desaparece el pendiente. También existen **Buscar en catálogo** y **Omitir**.

El backend vuelve a filtrar todos los IDs sugeridos contra el catálogo activo. Si el modelo detecta un pendiente pero no entrega una opción válida, se intenta una búsqueda textual aproximada contra el mismo catálogo; nunca se inventan objetos ni IDs.

### 4) WhatsApp como siguiente paso dominante
Después de cotizar, confirmar o pagar, el handoff se presenta como un bloque de alta jerarquía:

**DEJA UN MENSAJE DE CONSTANCIA EN NUESTRO WHATSAPP**

El beneficio se explica explícitamente: mantener la mudanza/cotización identificada en el chat y reducir olvidos, cambios de último minuto y problemas de coordinación.

El botón abre WhatsApp con el mensaje ya preparado. El cliente solo debe tocar **Enviar**.

### 5) Número de WhatsApp sin configuración duplicada
El proyecto ya tenía el número comercial `+56 9 5439 0267`. En v1.2 el helper `src/lib/whatsapp.ts` usa directamente ese mismo número y se eliminó `NEXT_PUBLIC_WHATSAPP_NUMBER` de `.env.example`, de modo que no hace falta configurar otra variable para el handoff nuevo.

## Variables nuevas/obligatorias para IA

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-luna
```

La API key debe vivir en `.env.local` en desarrollo o en las variables privadas del hosting. Nunca usar `NEXT_PUBLIC_` para la clave de OpenAI.

## Rutas de prueba útiles

Pago aprobado visual:

```text
http://localhost:3000/pago/exito?order=TEST-001&amount=100000
```

Cotización a domicilio aprobada visual:

```text
http://localhost:3000/domicilio/exito?order=TEST-002&amount=80000&clientName=Prueba&visitAddress=Providencia
```

Estas rutas sirven para probar UI y WhatsApp; no marcan pagos reales en Supabase.

## Checklist antes de desplegar

1. Copiar `.env.example` a `.env.local` y completar las claves reales.
2. Ejecutar `npm install` o `npm ci`.
3. Ejecutar `npm run build`.
4. Probar `/domicilio` haciendo scroll en los tres pasos.
5. Probar inventario IA con texto ambiguo: por ejemplo “un sillón y una lámpara”.
6. Confirmar que las sugerencias seleccionables usan objetos existentes del catálogo.
7. Probar texto + fotos y revisar cantidades/m³ antes de continuar.
8. Probar los CTA de WhatsApp en resumen, `/pago/exito` y `/domicilio/exito`.
