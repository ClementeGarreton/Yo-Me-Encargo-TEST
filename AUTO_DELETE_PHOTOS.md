# 🗑️ Sistema de Auto-Eliminación de Fotos

## ✅ ¿Qué se implementó?

Se ha implementado un sistema **automático** que elimina las fotos de las reservas cuando se marcan como **"Completadas"**.

---

## 🔄 ¿Cómo funciona?

### **Flujo automático:**

1. **Cliente sube fotos** → Se guardan en Supabase Storage (bucket `bookings/photos/`)
2. **Se crea la reserva** → URLs de las fotos se guardan en `photo_urls`
3. **Durante la mudanza** → Las fotos están disponibles en el admin
4. **Admin marca como "Completada"** → 🔥 **Las fotos se eliminan automáticamente**

### **¿Qué se elimina?**

✅ **Archivos físicos** en Supabase Storage  
✅ **URLs en la base de datos** (campo `photo_urls` se limpia)

### **¿Cuándo se eliminan?**

- ⏰ **Inmediatamente** cuando cambias el status a "Completada"
- 🔒 **Solo de reservas completadas**, no afecta a pendientes/confirmadas
- ✅ **Automático** - no requiere acción manual

---

## 🧪 Cómo Probar

### **Paso 1: Crear reserva con fotos**

1. Ve al cotizador
2. Completa todos los pasos
3. En "Servicios Adicionales", **sube 2-3 fotos**
4. Completa la reserva y paga

### **Paso 2: Ver fotos en el admin**

1. Ve al panel de admin
2. Busca la reserva
3. Haz clic en **👁️ Ver**
4. Deberías ver la galería de fotos

### **Paso 3: Completar la reserva**

1. En el admin, haz clic en **✏️ Editar** en la reserva
2. Cambia el estado a **"Completado"**
3. Guarda los cambios

### **Paso 4: Verificar eliminación**

1. Vuelve a abrir los detalles de la reserva (👁️ Ver)
2. **La galería de fotos ya NO debería aparecer**
3. En la terminal verás logs como:
   ```
   [PATCH Booking] Reserva marcada como completada, eliminando fotos...
   [deletePhotos] Intentando eliminar 3 foto(s)...
   [deletePhotos] ✓ Eliminado: photos/filename1.jpg
   [deletePhotos] ✓ Eliminado: photos/filename2.jpg
   [deletePhotos] ✓ Eliminado: photos/filename3.jpg
   [PATCH Booking] ✓ 3 foto(s) eliminada(s) exitosamente
   ```

### **Paso 5: Verificar en Supabase Storage**

1. Ve a **Supabase Dashboard → Storage → bookings → photos/**
2. Los archivos de esa reserva **ya NO deberían estar**

---

## 📁 Archivos Nuevos

### **Creados:**
- `src/lib/deletePhotos.ts` - Función helper para eliminar fotos

### **Modificados:**
- `src/app/api/admin/bookings/[id]/route.ts` - Detecta "completed" y elimina fotos

---

## 🔍 Logs para Depuración

Cuando marques una reserva como completada, verás en la terminal:

```bash
# ✅ CON FOTOS:
[PATCH Booking] Reserva marcada como completada, eliminando fotos...
[deletePhotos] Iniciando eliminación de fotos...
[deletePhotos] Intentando eliminar 2 foto(s)...
[deletePhotos] Rutas a eliminar: [ 'photos/1764375929793_1.jpg', 'photos/1764375929793_2.jpg' ]
[deletePhotos] ✓ Eliminado: photos/1764375929793_1.jpg
[deletePhotos] ✓ Eliminado: photos/1764375929793_2.jpg
[deletePhotos] Resultado: 2/2 eliminadas, 0 errores
[PATCH Booking] ✓ 2 foto(s) eliminada(s) exitosamente

# ✅ SIN FOTOS:
[PATCH Booking] Reserva marcada como completada, eliminando fotos...
[PATCH Booking] No hay fotos para eliminar

# ❌ CON ERROR:
[PATCH Booking] Reserva marcada como completada, eliminando fotos...
[deletePhotos] Error eliminando photos/xxx.jpg: File not found
[PATCH Booking] Error eliminando fotos: ['Error eliminando photos/xxx.jpg: File not found']
```

---

## 💡 Características

### ✅ **Seguro:**
- No afecta PDFs (solo elimina fotos)
- No rompe la reserva si falla la eliminación
- Logs detallados para debugging

### ✅ **Eficiente:**
- Elimina múltiples fotos en paralelo
- No bloquea la actualización de la reserva
- Maneja errores gracefully

### ✅ **Automático:**
- Cero configuración adicional
- Funciona inmediatamente
- No requiere cron jobs ni tareas programadas

---

## 🔧 Configuración

**No requiere configuración adicional**. El sistema funciona automáticamente con tu configuración actual de Supabase.

---

## ⚠️ Consideraciones

### **¿Qué pasa si quiero conservar las fotos?**
- No marques la reserva como "Completada"
- Déjala en estado "Confirmada" hasta que no necesites las fotos

### **¿Puedo recuperar fotos eliminadas?**
- ❌ No, la eliminación es **permanente**
- ✅ Supabase tiene backups automáticos (revisa tu plan)
- 💡 Considera descargar fotos importantes antes de completar

### **¿Qué pasa con reservas antiguas?**
- Solo afecta a reservas que se marquen como "Completadas" **después** de esta actualización
- Reservas completadas anteriormente mantienen sus fotos (si las tenían)

---

## 🎯 Resumen

| Acción | Resultado |
|--------|-----------|
| Crear reserva con fotos | ✅ Fotos guardadas en Storage |
| Ver reserva en admin | ✅ Galería de fotos visible |
| Marcar como "Completada" | 🔥 Fotos eliminadas automáticamente |
| Ver reserva completada | ❌ Galería ya no aparece |

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs de la terminal
2. Verifica que el bucket `bookings` existe
3. Verifica las políticas de Storage
4. Revisa que las URLs sean válidas en la BD

---

¡El sistema de auto-limpieza está listo! 🎉
