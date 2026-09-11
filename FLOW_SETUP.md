# Guía de Configuración - Integración Flow

Esta guía te ayudará a configurar Flow en tu aplicación de cotización de mudanzas.

## 🎯 Inicio Rápido - Estás en gateway.flow.cl/setting

Si estás viendo la página de configuración de Flow con los campos API KEY y SECRET KEY, sigue estos pasos:

1. **📋 Copia tus credenciales** (ver sección 1 abajo)
2. **⚙️ Configura tu proyecto** (ver sección 2 abajo)
3. **🗄️ Configura la base de datos** (ver sección 3 abajo)
4. **✅ Prueba la integración** (ver sección "Probar en Sandbox" abajo)

---

## 📋 Requisitos Previos

1. ✅ Cuenta en Flow.cl
2. ✅ Acceso al portal de integración (`gateway.flow.cl`)
3. ✅ Credenciales de API (apiKey y secretKey)

## 🚀 Pasos de Configuración

### 1. Obtener Credenciales de Flow

#### ✅ ESTÁS AQUÍ: En la página de configuración (gateway.flow.cl/setting)

**Paso a paso desde donde estás ahora:**

1. **Verifica que estás en la sección "Integración"** (debería estar resaltada en verde en el menú lateral)

2. **Copia tus credenciales:**
   - **API KEY**: Haz clic en el campo que muestra `759A77CF-C80B-45F4-ACF3-79828C9L193E` (o el valor que veas)
   - Selecciona todo el texto y cópialo (Ctrl+C)
   - **SECRET KEY**: Haz clic en el campo que muestra `bbeb64d7d92dfc9ab7c4acef2d22fb7a12d0add1` (o el valor que veas)
   - Selecciona todo el texto y cópialo (Ctrl+C)

3. **Guarda las credenciales temporalmente** en un archivo de texto o bloc de notas (solo para copiarlas después, luego bórralo por seguridad)

4. **Opcional - Probar la integración:**
   - Puedes hacer clic en el botón **"Probar integración"** para verificar que las credenciales funcionan
   - Esto te dirá si hay algún problema con tu configuración

5. **Guarda la configuración:**
   - Haz clic en el botón **"Guardar"** (botón verde grande) para asegurarte de que los cambios estén guardados

> ⚠️ **IMPORTANTE**: Las credenciales que ves son únicas y privadas. No las compartas con nadie.

#### Para Ambiente de Pruebas (Sandbox):

Si las credenciales que ves son de Sandbox (ambiente de pruebas), ya las tienes. Si necesitas credenciales de producción más adelante:

1. Completa el proceso de verificación de tu cuenta en Flow
2. Solicita acceso a producción
3. Obtén las credenciales de **Producción** (diferentes a las de Sandbox)

#### Para Producción:

1. Completa el proceso de verificación de tu cuenta en Flow
2. Solicita acceso a producción
3. Obtén las credenciales de **Producción** (diferentes a las de Sandbox)

### 2. Configurar Variables de Entorno en tu Proyecto

Ahora que tienes las credenciales copiadas, necesitas agregarlas a tu proyecto:

1. **Abre tu proyecto** en tu editor de código (VS Code, etc.)

2. **Busca o crea el archivo `.env.local`** en la raíz de tu proyecto:
   - Si ya existe `.env.local`, ábrelo
   - Si no existe, créalo (puedes copiar desde `.env.example` si existe)

3. **Agrega las credenciales de Flow** al archivo `.env.local`:

   ```env
   # Flow Payment Gateway - SANDBOX (para pruebas)
   FLOW_API_KEY=759A77CF-C80B-45F4-ACF3-79828C9L193E
   FLOW_SECRET_KEY=bbeb64d7d92dfc9ab7c4acef2d22fb7a12d0add1
   FLOW_API_URL=https://sandbox.flow.cl/api
   
   # Application URL (para callbacks de Flow)
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   > 📝 **Reemplaza** los valores de ejemplo con las credenciales que copiaste de Flow. Pega exactamente los valores que viste en la página de configuración.

4. **Guarda el archivo** `.env.local`

   > ⚠️ **IMPORTANTE**: 
   > - Nunca subas el archivo `.env.local` a Git (ya está en `.gitignore`)
   > - No compartas estas credenciales con nadie
   > - Si trabajas en equipo, cada desarrollador debe tener sus propias credenciales

### 3. Ejecutar Migración de Base de Datos

Necesitas agregar los campos de Flow a tu tabla de bookings en Supabase:

1. Abre tu proyecto en [Supabase](https://supabase.com)
2. Ve a "SQL Editor"
3. Copia y pega el contenido del archivo `database/migrations/add_flow_payment_fields.sql`
4. Ejecuta la migración

Alternativamente, puedes ejecutar estos comandos SQL:

```sql
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS flow_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS flow_order BIGINT,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_bookings_flow_token ON bookings(flow_token);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
```

### 4. Verificar Configuración

Ejecuta la aplicación en modo desarrollo:

```bash
npm run dev
```

Abre http://localhost:3000 y completa una cotización hasta llegar al paso de pago.

## 🧪 Probar en Sandbox

Flow proporciona tarjetas de prueba para el ambiente Sandbox:

### Tarjetas de Prueba

- **Aprobada**: 
  - Número: `4051 8842 3993 7763`
  - CVV: `123`
  - Fecha: Cualquier fecha futura

- **Rechazada**:
  - Número: `5186 0595 3805 6613`
  - CVV: `123`
  - Fecha: Cualquier fecha futura

### Flujo de Prueba

1. Completa una cotización en tu aplicación
2. Haz clic en "Pagar 100%" o "Abonar 50%"
3. Serás redirigido a la página de pago de Flow (Sandbox)
4. Usa una de las tarjetas de prueba
5. Completa el pago
6. Deberías ser redirigido de vuelta a tu aplicación con el resultado

## 🔄 Callbacks de Flow

Flow necesita poder comunicarse con tu aplicación para confirmar pagos. Esto funciona automáticamente en localhost para pruebas, pero para producción necesitas:

### Para Desarrollo Local:

- Flow puede enviar notificaciones a `http://localhost:3000/api/payment/confirm`
- Esto funciona en Sandbox

### Para Producción:

1. Tu aplicación debe estar desplegada y accesible públicamente
2. Configura `NEXT_PUBLIC_APP_URL` con tu dominio real:
   ```env
   NEXT_PUBLIC_APP_URL=https://tudominio.com
   ```
3. Flow enviará notificaciones a `https://tudominio.com/api/payment/confirm`

## 🚀 Pasar a Producción

Cuando estés listo para aceptar pagos reales:

1. **Obtén credenciales de producción** de Flow
2. **Actualiza `.env.local`** (o variables de entorno en tu hosting):
   ```env
   FLOW_API_KEY=tu_api_key_de_produccion
   FLOW_SECRET_KEY=tu_secret_key_de_produccion
   FLOW_API_URL=https://www.flow.cl/api
   NEXT_PUBLIC_APP_URL=https://tudominio.com
   ```
3. **Despliega** tu aplicación
4. **Prueba** con una transacción real pequeña
5. **Monitorea** los logs para asegurarte de que todo funciona

## 🔒 Seguridad

### Buenas Prácticas:

✅ **Nunca expongas** tus Secret Keys en el código frontend
✅ **Usa HTTPS** en producción (obligatorio para Flow)
✅ **Verifica las firmas** de Flow en los callbacks (ya implementado)
✅ **Mantén actualizadas** tus dependencias
✅ **Monitorea** transacciones sospechosas

### Variables de Entorno Seguras:

- `FLOW_API_KEY` y `FLOW_SECRET_KEY` solo se usan en el servidor (API routes)
- Nunca se envían al navegador del usuario
- Flow maneja todos los datos sensibles de tarjetas

## 📊 Monitoreo

### En el Portal de Flow:

1. Ingresa a [gateway.flow.cl](https://gateway.flow.cl)
2. Ve a "Transacciones" para ver todos los pagos
3. Puedes ver detalles, hacer reembolsos, etc.

### En tu Base de Datos:

Consulta la tabla `bookings` para ver el estado de los pagos:

```sql
SELECT 
  quote_id,
  client_name,
  payment_status,
  flow_order,
  payment_date,
  total_price
FROM bookings
WHERE payment_status = 'approved'
ORDER BY payment_date DESC;
```

## ❓ Solución de Problemas

### Error: "apiKey not found" o "Flow API error: 401"

Este error significa que las variables de entorno no se están leyendo correctamente:

1. **Verifica que las variables estén en `.env.local`** sin espacios al inicio:
   ```env
   FLOW_API_KEY=tu_api_key_aqui
   FLOW_SECRET_KEY=tu_secret_key_aqui
   ```
   ❌ **INCORRECTO** (con espacios):
   ```env
      FLOW_API_KEY=tu_api_key_aqui
   ```

2. **Reinicia el servidor de desarrollo** después de cambiar variables de entorno:
   - Detén el servidor (Ctrl+C)
   - Ejecuta `npm run dev` nuevamente

3. **Verifica que no haya espacios** alrededor del signo `=`:
   ```env
   FLOW_API_KEY=valor  ✅ Correcto
   FLOW_API_KEY = valor  ❌ Incorrecto
   ```

### Error: "Flow no está configurado"

- Verifica que `FLOW_API_KEY` y `FLOW_SECRET_KEY` estén en `.env.local`
- Reinicia el servidor de desarrollo después de cambiar variables de entorno
- Asegúrate de que las variables no tengan espacios al inicio de la línea

### El pago no se confirma

- Verifica que la URL de callback sea accesible
- Revisa los logs del servidor para ver si Flow está enviando notificaciones
- En Sandbox, las notificaciones pueden tardar unos segundos

### Error de firma inválida

- Verifica que estés usando el Secret Key correcto
- Asegúrate de que no haya espacios extra en las variables de entorno

## 📞 Soporte

- **Documentación de Flow**: [flow.cl/docs](https://www.flow.cl/docs/api.html)
- **Soporte Flow**: Disponible en el portal de integración
- **Preguntas frecuentes**: [flow.cl/preguntas-frecuentes](https://www.flow.cl/preguntas-frecuentes)

## 🎉 ¡Listo!

Tu aplicación ahora está integrada con Flow y lista para aceptar pagos de forma segura. 

Recuerda:
1. ✅ Probar en Sandbox primero
2. ✅ Verificar que los callbacks funcionan
3. ✅ Pasar a producción cuando estés listo
4. ✅ Monitorear las transacciones regularmente
