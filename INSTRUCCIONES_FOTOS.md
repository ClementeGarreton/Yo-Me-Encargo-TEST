# 📸 Sistema de Fotos - Instrucciones de Configuración

## ✅ ¿Qué se implementó?

Se ha creado un **sistema completo de gestión de fotos** para que los clientes puedan subir imágenes de sus items/propiedades durante el proceso de cotización.

### Características:
- ✅ Subida de múltiples fotos (JPG, PNG, WEBP)
- ✅ Almacenamiento en Supabase Storage
- ✅ Preview de fotos en el formulario
- ✅ Galería de fotos en el panel de Admin
- ✅ Validación de formato y tamaño (max 5MB por foto)
- ✅ URLs guardadas en la base de datos

---

## 🛠️ Pasos de Configuración

### 1️⃣ Aplicar Migración SQL

**Ve a Supabase Dashboard → SQL Editor y ejecuta:**

```sql
-- Migration: Add photo URLs to bookings table
-- Date: 2025-11-28

-- Add photo_urls field (JSON array)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_has_photos ON bookings((jsonb_array_length(photo_urls) > 0));

-- Add comment
COMMENT ON COLUMN bookings.photo_urls IS 'Array JSON con URLs de fotos subidas por el cliente desde Supabase Storage';
```

### 2️⃣ Verificar Bucket de Storage

El bucket `bookings` **ya debería existir** (lo creaste para los PDFs).

**Verifica que tenga:**
- ✅ Carpeta `photos/` (se creará automáticamente al subir la primera foto)
- ✅ Políticas de acceso público configuradas

Si necesitas verificar/actualizar las políticas:

```sql
-- Ver políticas actuales
SELECT * FROM storage.policies WHERE bucket_id = 'bookings';
```

**Las políticas necesarias son:**

```sql
-- Política de subida (INSERT)
CREATE POLICY "Permitir subida de archivos al bucket bookings"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'bookings');

-- Política de lectura (SELECT) 
CREATE POLICY "Acceso público de lectura al bucket bookings"
ON storage.objects
FOR SELECT
USING (bucket_id = 'bookings');
```

### 3️⃣ Verificar Variables de Entorno

Asegúrate de tener estas variables en tu `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon
SUPABASE_SERVICE_ROLE_KEY=tu_clave_service_role
```

---

## 🧪 Probar el Sistema

### Paso 1: Subir Fotos desde el Cotizador

1. Ve a: `http://localhost:3000/cotizador`
2. Completa todos los pasos hasta **"Servicios Adicionales"**
3. En la sección "Fotos de Items (Opcional)":
   - Haz clic en el área de subida
   - Selecciona 1 o más fotos (JPG, PNG, WEBP)
   - Máximo 5MB por foto
4. Verás un **preview de las fotos** en formato grid
5. Continúa con el proceso hasta crear la reserva

### Paso 2: Ver Fotos en el Admin

1. Ve a: `http://localhost:3000/admin`
2. Busca la reserva que acabas de crear
3. Haz clic en el botón **👁️ Ver** (ojo)
4. En el modal de detalles verás:
   - 📸 **Galería de Fotos del Cliente** (si hay fotos)
   - Grid con todas las fotos subidas
   - Haz clic en cualquier foto para verla en tamaño completo

---

## 📁 Estructura de Archivos

### Nuevos archivos creados:

```
database/
  └── migrations/
      └── add_photo_urls_to_bookings.sql    ← Migración SQL

src/
  └── app/
      └── api/
          └── photos/
              └── upload/
                  └── route.ts              ← API endpoint para subir fotos
```

### Archivos modificados:

```
src/
  ├── components/
  │   ├── steps/
  │   │   ├── AdditionalServicesStep.tsx   ← Subida de fotos real + preview
  │   │   └── SummaryStep.tsx              ← Envía photo_urls al crear booking
  │   └── admin/
  │       └── BookingsManagement.tsx       ← Galería de fotos en modal
  └── app/
      └── api/
          ├── bookings/
          │   └── create/
          │       └── route.ts              ← Guarda photo_urls en DB
          └── admin/
              └── bookings/
                  └── route.ts              ← Fetch photo_urls
```

---

## 🔍 Verificación de la Base de Datos

Para verificar que todo está funcionando:

```sql
-- Ver columnas de la tabla bookings
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
AND column_name = 'photo_urls';

-- Ver bookings con fotos
SELECT 
  quote_id,
  client_name,
  photo_urls,
  jsonb_array_length(photo_urls) as num_fotos
FROM bookings
WHERE photo_urls IS NOT NULL 
  AND jsonb_array_length(photo_urls) > 0
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🎨 Experiencia del Usuario

### En el Formulario (Cliente):
- **Área de subida atractiva** con icono de cámara
- **Loading state** mientras se suben las fotos
- **Preview en grid** de las fotos subidas
- **Botón eliminar** por cada foto (antes de enviar)
- **Notificaciones** de éxito/error

### En el Admin:
- **Galería compacta** en grid 2x3
- **Hover effects** para mejor UX
- **Click para ver en tamaño completo**
- **Numeración** de fotos (#1, #2, etc.)
- **Indicador de cantidad** (ej: "📸 Fotos del Cliente (3)")

---

## 🚨 Solución de Problemas

### Error: "No se recibieron archivos"
- **Causa:** El input de archivos está vacío
- **Solución:** Asegúrate de seleccionar al menos 1 archivo

### Error: "Solo se permiten archivos JPG, PNG o WEBP"
- **Causa:** Formato de archivo inválido
- **Solución:** Convierte las imágenes a formatos soportados

### Error: "Cada foto debe pesar menos de 5MB"
- **Causa:** Archivo muy grande
- **Solución:** Comprime las imágenes antes de subirlas

### Las fotos no aparecen en el Admin
1. Verifica que la migración SQL se ejecutó correctamente
2. Verifica que las fotos se subieron (check en Supabase Storage)
3. Verifica que `photo_urls` tiene datos en la tabla `bookings`
4. Recarga la página del admin (F5)

### Error 500 al subir fotos
- Verifica que el bucket `bookings` existe
- Verifica que las políticas de Storage están configuradas
- Revisa los logs de la consola del navegador (F12)
- Revisa los logs del servidor (`npm run dev`)

---

## 📊 Capacidades del Sistema

- ✅ **Múltiples fotos** por reserva (sin límite)
- ✅ **Formatos soportados:** JPG, PNG, WEBP
- ✅ **Tamaño máximo:** 5MB por foto
- ✅ **Almacenamiento:** Supabase Storage (incluido en tu plan)
- ✅ **URLs públicas:** Accesibles desde el admin
- ✅ **Optimización:** Lazy loading de imágenes
- ✅ **UX:** Preview, eliminación, galería responsive

---

## ✨ Próximas Mejoras (Opcionales)

Si quieres mejorar el sistema en el futuro:
- 📷 Compresión automática de imágenes antes de subir
- 🖼️ Lightbox/Modal para ver fotos en el admin
- 🗑️ Eliminar fotos desde el admin
- 📱 Mejorar preview en mobile
- 🎯 Agregar fotos en miniatura a los PDFs generados

---

## 💡 Notas Importantes

1. **Las fotos NO se incluyen en los PDFs** (por ahora)
2. **Las fotos son opcionales** - el cliente puede omitirlas
3. **Las URLs son públicas** - cualquiera con el link puede verlas
4. **Storage de Supabase tiene límite** - revisa tu plan si subes muchas fotos

---

## ✅ Checklist de Verificación

- [ ] Migración SQL ejecutada
- [ ] Bucket `bookings` existe y es público
- [ ] Políticas de Storage configuradas
- [ ] Variables de entorno configuradas
- [ ] Probada subida de fotos desde cotizador
- [ ] Verificadas fotos en Supabase Storage
- [ ] Verificadas URLs en tabla `bookings`
- [ ] Probada galería en panel de admin
- [ ] Sin errores en consola del navegador
- [ ] Sin errores en terminal del servidor

---

¡El sistema de fotos está listo! 🎉
