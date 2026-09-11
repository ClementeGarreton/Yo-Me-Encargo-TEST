# MVP v1.2.1

## Cambios

1. **Descubrimiento del chatbot en Home**
   - Se reemplazó el launcher discreto por un teaser visible con copy comercial y botón "Abrir asistente".
   - Se mantuvo el chat en la Home sin mover el template principal.

2. **Conversión más visible en Resumen**
   - El bloque de WhatsApp se compactó y subió dentro del sidebar del resumen.
   - El CTA de "Enviarme la cotización por correo" quedó inmediatamente después del bloque de WhatsApp.
   - La opción de pago 100% se mantuvo, pero pasó debajo de esos CTA de seguimiento.

## Variables de entorno

Solo necesitas estas variables nuevas para IA:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-luna
```

## Observación

Esta iteración no cambia la lógica de cálculo, pago ni catálogo. Se enfocó en **descubrimiento del asistente** y **visibilidad temprana de CTA de fidelización / seguimiento**.
