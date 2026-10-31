# Diagnóstico de Instagram en Test97

Esta versión no cambia WhatsApp, Flow, la base de datos ni las credenciales. El webhook de Instagram sigue contestando HTTP 200 a eventos válidos, pero ahora registra por qué puede no generar respuestas.

## Procedimiento

1. Sube **este proyecto completo** a Git y despliega en Vercel Test97. No ejecutes migraciones.
2. Abre Vercel > proyecto Test97 > Logs > Request Logs. Filtra por ruta `/api/instagram/webhook` y busca un POST nuevo.
3. Desde `kiara.alcibiades` (o una cuenta tester) envía un **nuevo** mensaje `Hola` a `yo.me.encargo_`. Los eventos anteriores no se reproducen automáticamente.
4. Abre ese POST y lee los registros con prefijo `[Instagram]`. No compartas tokens ni los cuerpos de los eventos.

## Cómo interpretar los registros

- `[Instagram][webhook]` con `accepted:0` y `messagingEvents:0`: Meta no envió un evento de mensaje legible. Revisa la suscripción y el evento real.
- `accepted:0` y `ignored.accountMismatch > 0`: el identificador de destinatario del evento **no** coincide con `INSTAGRAM_ACCOUNT_ID`. Antes de cambiar variables, compara el ID de la cuenta profesional autorizada en Meta.
- `accepted:1`: el mensaje pasó el parser. Sigue con `[Instagram][motor]`.
- `[Instagram][motor]` con `decision:"welcome"`: el bot eligió enviar la bienvenida. Si no llega, busca `[Instagram][envio]` o `[Instagram] Error procesando DM`.
- `[Instagram][motor] Mensaje duplicado`: el mismo identificador ya estaba procesado. Prueba con un mensaje nuevo.
- `[Instagram][envio] Error Graph API`: el mensaje no salió; el `status`, `code` y `subcode` explican el bloqueo de Meta.
- `[Instagram][envio] Respuesta aceptada`: Meta aceptó la solicitud de salida. Confirma que llegó al buzón de Instagram.

**Privacidad:** los nuevos logs no incluyen texto del cliente, sus identificadores completos, imágenes, ni credenciales.

En modo de pruebas, el remitente debe tener los permisos/rol de evaluación que corresponda. La revisión de acceso público en Meta es un trámite separado.
