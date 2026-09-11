# Instrucciones para Aplicar la Migración de Base de Datos

## 📋 Resumen de Cambios

Se agregaron campos para almacenar:
- **Datos de facturación**: `is_company`, `company_name`, `company_rut`
- **PDF de reserva**: `pdf_url`, `pdf_generated_at`

## 🔧 Pasos para Aplicar la Migración

### 1. Acceder a Supabase

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a la sección **SQL Editor** en el menú lateral

### 2. Ejecutar el Script SQL

1. Abre el archivo: `database/migrations/add_company_and_pdf_fields.sql`
2. Copia todo el contenido del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** (o presiona Ctrl+Enter)

### 3. Configurar Supabase Storage

Para que los PDFs se puedan guardar, necesitas crear un bucket en Supabase Storage:

1. Ve a **Storage** en el menú lateral de Supabase
2. Crea un nuevo bucket llamado: `bookings`
3. Configura las políticas de acceso:
   - **Política de INSERT**: Permitir a usuarios autenticados subir archivos
   - **Política de SELECT**: Permitir acceso público para lectura

#### Script SQL para las Políticas de Storage:

```sql
-- Permitir subir archivos (solo para autenticados o desde el servidor con service_role)
CREATE POLICY "Permitir subir PDFs de reservas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bookings' AND (storage.foldername(name))[1] = 'booking-pdfs');

-- Permitir lectura pública de los PDFs
CREATE POLICY "Permitir lectura pública de PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bookings' AND (storage.foldername(name))[1] = 'booking-pdfs');
```

### 4. Verificar la Migración

Ejecuta esta consulta para verificar que los campos se agregaron correctamente:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
AND column_name IN ('is_company', 'company_name', 'company_rut', 'pdf_url', 'pdf_generated_at')
ORDER BY column_name;
```

Deberías ver 5 filas con los nuevos campos.

## ✅ Funcionalidades Implementadas

### 1. **Datos de Empresa en Base de Datos**
   - Se guardan `is_company`, `company_name`, `company_rut` al crear reservas
   - Se muestran en el panel de admin

### 2. **Generación y Almacenamiento de PDF**
   - El PDF se genera con **TODA** la información de la reserva
   - Se descarga automáticamente al usuario
   - Se sube a Supabase Storage
   - La URL se guarda en la base de datos

### 3. **Descarga desde Admin**
   - Botón azul de descarga (📥) al lado de cada reserva que tenga PDF
   - Click en el botón abre el PDF en una nueva pestaña

## 📄 Contenido del PDF

El PDF incluye **ABSOLUTAMENTE TODO**:
- ✅ Información del pago (orden, token, monto)
- ✅ Datos del cliente (nombre, email, teléfono)
- ✅ Datos de facturación (empresa, RUT) si aplica
- ✅ Fecha y hora programada
- ✅ Flexibilidad de fecha
- ✅ Direcciones completas (origen y destino)
  - Calle, número, comuna, región
  - Información adicional
  - Tipo de propiedad
  - Piso y ascensor
  - Distancia al estacionamiento
- ✅ Distancia total calculada
- ✅ Lista completa de items
  - Con cantidades, peso y volumen
  - Indicadores especiales (frágil, vidrio, pesado)
  - Información de embalaje especial
- ✅ Volumen total, peso total, vehículo recomendado
- ✅ Servicios adicionales seleccionados
- ✅ Observaciones del cliente
- ✅ Monto total pagado

## 🚨 Importante

- La migración es **no destructiva** (no elimina datos existentes)
- Las reservas antiguas tendrán `NULL` en los nuevos campos
- Los PDFs solo se generarán para nuevas reservas desde ahora

## 🐛 Solución de Problemas

### Error: "relation does not exist"
- Verifica que estés en la base de datos correcta
- Asegúrate de que la tabla `bookings` existe

### Error al subir PDF
- Verifica que el bucket `bookings` existe en Storage
- Revisa las políticas de acceso del bucket

### El botón de descarga no aparece en Admin
- El botón solo aparece si `pdf_url` tiene un valor
- Los PDFs anteriores no tendrán este botón (es normal)

## 📞 Soporte

Si tienes problemas, revisa:
1. Logs del navegador (F12 > Console)
2. Logs de la terminal donde corre `npm run dev`
3. Logs de Supabase (Dashboard > Logs)
