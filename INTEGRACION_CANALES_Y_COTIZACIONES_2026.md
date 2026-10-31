# Yo Me Encargo — integración incremental (sin migraciones nuevas)

## Entrega
Esta versión parte del ZIP completo **CORRECCION-ATOMICA-INVENTARIO**, preserva el cotizador, sus 5 minutos de inactividad, 15 minutos totales, la lógica de corrección atómica del inventario, el PDF y la pasarela **Flow**. No es necesario mezclar parches ni ejecutar SQL.

## Enlace para pruebas de Tommy
El botón de cotización enviado desde WhatsApp y los callbacks de Flow usan por defecto `https://yo-me-encargo-test97.vercel.app`. Conservan `session` y `token` para retomar la cotización en `/cotizador`. El ajuste posterior a `https://yomeencargo.cl` se hace estableciendo `WHATSAPP_QUOTE_BASE_URL` en Vercel (por ejemplo `https://yomeencargo.cl`) y redeplegando. La ruta `/cotizador` sigue siendo la misma.

**Importante:** Si `WHATSAPP_QUOTE_BASE_URL` ya existe en Vercel, prevalece sobre test97. Revisarlo antes de probar pagos. No confundir prueba del flujo con cargos reales: Flow puede procesar pagos según las credenciales ambientales.

## Fotografías
Las imágenes se almacenan en Supabase Storage, bucket **bookings** ya existente, con ruta `photos/whatsapp/<quote_session_id>/<message_id>.<ext>`. El `state` JSONB de `quote_sessions` conserva cada `storagePath`, identificación y estado. Las URLs de la colección se incorporan al expediente de `quote_prospects` y se exponen en la sesión web como antes. El PDF de WhatsApp incorpora un anexo fotográfico (hasta 12 imágenes) y el panel **Conversaciones IA** permite abrir originales con enlaces firmados temporalmente.

No se crean buckets ni columnas. Las fotografías originales solo se conservarán para mensajes recibidos **después** de desplegar esta versión; no se pueden reconstruir de registros anteriores que solo conservaron etiquetas.

## Distancias e impuestos
El PDF muestra recorrido estimado en km y distancias de acarreo camión-puerta en metros para retiro y entrega. En la pregunta 1 se solicita boleta o factura. Para factura se solicitan datos empresariales. La elección documental no aplica automáticamente un aumento de 19%; los impuestos y emisiones tributarias reales se gestionan por el sistema de facturación que utilice el negocio. **La entrega NO implementa emisión de boleta/factura electrónica** (eso requiere un proveedor autorizado y credenciales fiscales).

## Número de secretaría
1. Meta Business Manager → WhatsApp Manager: registrar/verificar el número adicional en la **misma cuenta de WhatsApp Business** que utiliza el token actual.
2. Confirmar que la aplicación esté suscrita al campo `messages` de la cuenta.
3. Obtener el *Phone Number ID* del nuevo número y definir en Vercel `WHATSAPP_SECRETARY_PHONE_NUMBER_ID` con ese ID (no el número telefónico visible).
4. El webhook existente `/api/whatsapp/webhook` acepta ambos números y responde desde el identificador que recibió el mensaje, manteniendo sesiones separadas para el mismo cliente.

Si el número de Tommy pertenece a otra cuenta empresarial, debe obtenerse autorización de Meta para que el token acceda a ese activo; esta versión no acepta arbitrariamente números sin autorización.

## Instagram
1. Habilitar Instagram API (Instagram Login / mensajes), conectar una **cuenta profesional** y obtener permisos `instagram_business_basic` y `instagram_business_manage_messages`. Meta puede exigir revisión para conversaciones reales fuera de los roles de prueba.
2. En Vercel definir `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_VERIFY_TOKEN` y mantener `META_APP_SECRET` (debe corresponder a la app configurada).
3. Configurar callback de mensajes en Meta: `https://yo-me-encargo-test97.vercel.app/api/instagram/webhook`. Usar `INSTAGRAM_VERIFY_TOKEN` al verificar. Suscribir el evento `messages` según el producto de Instagram activado.
4. Las conversaciones usan el mismo enrutador y las mismas preguntas/estimaciones que WhatsApp. Para respetar las restricciones de base de datos existentes, se identifican internamente con la clave `ig:<cuenta>:<cliente>` y el canal `whatsapp`; el panel las muestra como Instagram. Instagram entrega PDFs mediante enlace (no como documento WhatsApp).
5. Instagram solicita además un teléfono de contacto en la etapa 1 porque los DMs no revelan automáticamente el teléfono del cliente.

La integración **requiere** estos valores de Meta y la aprobación correspondiente. Un redeploy por sí solo no conecta la cuenta de Instagram.

## Panel de Tommy
`/admin/login` → **Conversaciones IA**. Se añadieron galería de fotografías y contador de conversaciones activas, derivadas, cotizadas, cerradas, con error, e identificaciones del origen Instagram. Los contadores no se limitan a las últimas 150 filas listadas.

## Prueba de aceptación recomendada
- Desde número nuevo de WhatsApp: menú (COTIZAR / ASESOR / SALIR), COTIZAR, datos personales, documento tributario, acarreo y cuatro fotos. Revisar lista, corregir QUITAR + AGREGAR y CONFIRMAR.
- Abrir PDF: fotografías y distancias de acarreo visibles. Abrir `/admin` y comprobar las imágenes originales.
- Abrir enlace `/cotizador?session=...&token=...` de test97 y elegir **abono 50%**; verificar URL de retorno y confirmación de Flow con las credenciales de prueba.
- Conectar posteriormente Meta al segundo número y a Instagram; comprobar que mensajes de un mismo cliente no se mezclen entre canales.

## Validación
Las pruebas unitarias locales no sustituyen un `next build` con dependencias ni pruebas reales de Meta, Supabase y Flow. Ejecutar `npm ci`, `npm run test:whatsapp-bot`, `npm run build` en CI / Vercel. Nunca subir `.env` al repositorio.
