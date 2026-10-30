# Corrección del enrutador WhatsApp — 30 de octubre de 2026

Esta entrega modifica **solo código**. No se agregaron tablas, migraciones SQL, nuevas variables de entorno ni nuevos servicios.

## Qué fallaba

- El enrutador autorizaba `COTIZAR` antes de comprobar si había mostrado la bienvenida.
- Una marca persistente guardaba la bienvenida como ya enviada para siempre; después de horas el cliente no recibía menú.
- El vencimiento de 5/15 minutos se comprobaba solo cuando entraba un nuevo mensaje; no existe un proceso que envíe mensajes o cierre registros automáticamente a la hora exacta. **La autorización para ejecutar OpenAI sí expira por reloj y se comprueba antes de procesar el siguiente mensaje.**

## Comportamiento corregido

1. Primer mensaje en modo inactivo (incluso `COTIZAR`): bienvenida con las cuatro opciones. Sin consulta a OpenAI.
2. `COTIZAR` escrito **después** del menú: comienza la cotización; envía la pregunta 1/7 prerenderizada. El primer uso de OpenAI ocurre al interpretar la respuesta siguiente.
3. Respuestas durante la cotización: se procesan mientras no transcurran 5 min desde la última interacción ni 15 min desde la activación.
4. Al vencer uno de los límites, ningún texto (ni `COTIZAR` enviado sobre la cotización vencida) ejecuta OpenAI. El siguiente mensaje recibe aviso de expiración más menú y cierra la sesión guardada.
5. En modo inactivo, si pasan 5 min desde la última interacción, el siguiente mensaje vuelve a recibir menú sin ejecutar OpenAI. Mensajes adicionales en esos 5 min no repiten bienvenida.
6. `ASESOR` desactiva el bot para atención humana. `MENU` cancela la cotización y vuelve a presentar opciones. `SALIR` termina el modo automático. En modo humano no hay saludos automáticos periódicos.
7. `COTIZAR` exige coincidencia exacta; `Quiero cotizar` no abre una sesión por sí solo.

## Despliegue

- Sustituye los archivos del repositorio Git con los del ZIP; push y redeploy habitual de Vercel.
- No ejecutes SQL ni cambies `.env`.
- Prueba con un número: `Hola` -> menú -> `COTIZAR` -> pregunta 1/7 -> nombre + correo -> siguiente pregunta.
- Prueba otro ciclo dejando transcurrir 5 min: tras ese plazo, el siguiente mensaje obtiene aviso + menú, nunca la continuación de la cotización vieja.
- No hay cierre físico proactivo exacto a los 5 min si nadie escribe; para ese comportamiento haría falta un trabajo programado, que no está incluido. La autorización de IA sí queda vencida por cálculo de tiempo.

## Validación

11 pruebas unitarias de enrutamiento y parser aprobadas (`npm run test:whatsapp-bot`). No se ha verificado la ejecución remota con credenciales de Meta, OpenAI o Supabase.
