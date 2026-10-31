# Instagram DM → Yo Me Encargo · Test97

Esta entrega **no añade tablas ni migraciones**, ni modifica el flujo de WhatsApp ni la pasarela Flow. La ruta ya existía en la versión integral; aquí se reforzó el tratamiento de eventos, deduplicación, fotos y errores, reutilizando `processIncoming` y la misma lógica de cotización.

## 1. Variables de entorno en Vercel Test97

En el proyecto `yo-me-encargo-test97` → Settings → Environment Variables (entorno correspondiente al deployment):

| Variable | Valor que corresponde |
| --- | --- |
| `INSTAGRAM_VERIFY_TOKEN` | La cadena **elegida por ustedes** para verificar el webhook; debe coincidir literalmente con el campo en Meta |
| `INSTAGRAM_ACCESS_TOKEN` | Token de **acceso a la API de Instagram** generado en Meta; **no** el verify token |
| `INSTAGRAM_ACCOUNT_ID` | ID numérico de la cuenta profesional `yo.me.encargo_`, mostrado en el paso 2 de Meta |
| `META_APP_SECRET` | Secreto de la misma app «Cotizador Por Teléfono» en Meta → App Settings → Basic; ya usado por el webhook de WhatsApp |
| `INSTAGRAM_GRAPH_VERSION` | Opcional; por defecto `v26.0` |

No subir credenciales a Git ni compartirlas en chats. Guardar cambios y **redeploy** antes de verificar desde Meta. Si cambia un verify token, actualizar tanto Meta como Vercel.

## 2. Verificación en Meta

En «API de Instagram → 3. Configura los webhooks»:

- **URL de devolución de llamada**: `https://yo-me-encargo-test97.vercel.app/api/instagram/webhook`
- **Identificador de verificación**: valor de `INSTAGRAM_VERIFY_TOKEN` (no el token de acceso)
- Pulsar **Verificar y guardar**. El servidor debe responder el `hub.challenge` de Meta. Una respuesta 403 indica verify token incorrecto; 404 indica despliegue sin la ruta.
- Suscribir el campo **`messages`** y en la sección «2. Genera identificadores de acceso» activar **Suscripción a webhook** para `yo.me.encargo_` cuando Meta lo permita.

No utilizar la URL de redirección OAuth como callback del webhook; son funciones distintas.

## 3. Prueba controlada

1. Usar una cuenta de Instagram de prueba habilitada en la aplicación si la app sigue en modo desarrollo.
2. Enviar un DM **Hola** a `yo.me.encargo_`: debe recibir la bienvenida con opciones, sin consultar OpenAI.
3. Enviar **COTIZAR**: se inicia el mismo cuestionario de WhatsApp. A diferencia de WhatsApp, Instagram solicitará el teléfono del cliente.
4. Completar las preguntas, enviar una foto en el inventario, escribir **LISTO**, revisar, **CONFIRMAR** y recibir enlace al PDF y cotización web Test97. Instagram no adjunta PDFs como WhatsApp: se comparte el enlace.
5. Comprobar que respuestas propias, reacciones, eventos duplicados y mensajes de otras cuentas **no** activan la IA.
6. Comprobar **ASESOR** y **SALIR**, inactividad de 5 minutos y duración máxima de 15 minutos.

**Nota:** los `POST 200` en Vercel solo prueban recepción y acuse del webhook. Verificar que haya mensajes nuevos, salientes y registros de cotización. Para conversar con usuarios externos fuera de roles de prueba, puede ser necesaria la revisión y autorización de Meta.

## 4. Cómo diagnosticar si no responde

- Verificar las dos suscripciones: campo `messages` y cuenta `yo.me.encargo_`.
- Revisar las variables de entorno **del deployment activo** en Test97; no basta con guardarlas sin redeploy.
- En el panel Instagram, permitir acceso a mensajes para herramientas conectadas si la cuenta lo requiere.
- Revisar Request Logs y Runtime Logs de Vercel. `401`: firma inválida; `503`: faltan credenciales; `200` con silencio: revisar evento/suscripción/estado del bot. No pegar tokens ni cuerpos completos de mensajes en capturas.

## 5. Limitaciones

Esta entrega reutiliza `ai_conversations` y `quote_sessions` existentes, con claves de sesión IG separadas y canal lógico `whatsapp` por compatibilidad con el esquema actual. **No cambia los requisitos de Meta**: autenticar la cuenta, activar las suscripciones y autorizar los permisos adecuados sigue siendo necesario. No hay verificación extremo a extremo con la cuenta real ni compilación completa en esta entrega.
