# 🚀 Guía de Configuración - Landing Page "Yo me Encargo"

## ✅ ¿Qué se ha implementado?

Se ha creado una **landing page completa y profesional** con las siguientes secciones:

1. ✅ **Navbar** - Navegación fija con logo y menú responsive
2. ✅ **Hero** - Sección principal con CTAs destacados
3. ✅ **Cómo Funciona** - Proceso en 4 pasos simples
4. ✅ **Servicios** - 6 tipos de servicios detallados
5. ✅ **Por Qué Elegirnos** - 8 beneficios clave + estadísticas
6. ✅ **Cobertura** - Todas las regiones de Chile
7. ✅ **Testimonios** - 6 testimonios de clientes (editables)
8. ✅ **FAQ** - 8 preguntas frecuentes con acordeón
9. ✅ **Contacto** - Formulario + datos de contacto
10. ✅ **Footer** - Enlaces, redes sociales y datos corporativos

## 🎨 Sistema de Colores Corporativos

Los colores se pueden editar en **UN SOLO LUGAR** y se aplicarán automáticamente en toda la web:

📁 **Archivo:** `tailwind.config.ts` (líneas 13-23)

```typescript
brand: {
  blue: '#2563eb',      // Azul principal - EDITA AQUÍ
  'blue-light': '#3b82f6', 
  cyan: '#06b6d4',      // Celeste - EDITA AQUÍ
  'cyan-light': '#22d3ee',
  green: '#10b981',     // Verde - EDITA AQUÍ
  'green-light': '#34d399',
  gray: '#6b7280',      // Gris - EDITA AQUÍ
  'gray-light': '#9ca3af',
  'gray-dark': '#374151',
}
```

**Para cambiar colores:**
1. Abre `tailwind.config.ts`
2. Modifica los valores hexadecimales
3. Guarda y recarga la página

---

## 📦 Imágenes a Subir

### 1. **Logo de la Empresa**
- **Archivo:** `logo.png`
- **Ubicación:** `/public/logo.png`
- **Tamaño recomendado:** 500x500px (formato cuadrado)
- **Formato:** PNG con fondo transparente

### 2. **Imagen del Hero (Principal)**
- **Archivo:** `hero-truck.jpg` o `hero-truck.png`
- **Ubicación:** `/public/images/hero-truck.jpg`
- **Tamaño:** 1200x800px aprox
- **Contenido sugerido:** Camión de la empresa, equipo de trabajo, o mudanza en acción

### 3. **Imágenes de Servicios** (Opcionales)
Si quieres personalizar las tarjetas de servicios:
- `/public/images/servicio-flete.jpg` (400x300px)
- `/public/images/servicio-mudanza.jpg` (400x300px)
- `/public/images/servicio-oficina.jpg` (400x300px)

### 4. **Mapa de Cobertura** (Opcional)
- **Archivo:** `cobertura-mapa.jpg`
- **Ubicación:** `/public/images/cobertura-mapa.jpg`
- **Tamaño:** 800x600px
- **Contenido:** Mapa de Chile con zonas de cobertura destacadas

---

## 🔧 Cómo Subir las Imágenes

### Opción 1: Manualmente
1. Ve a la carpeta `/public/` en tu proyecto
2. Crea la carpeta `/public/images/` si no existe
3. Arrastra tus imágenes a las ubicaciones indicadas

### Opción 2: Desde VS Code
1. Abre el explorador de archivos (Ctrl+Shift+E)
2. Navega a `/public/`
3. Crea carpeta `images`
4. Arrastra las imágenes desde tu computador

---

## 📝 Datos de Contacto Configurados

Los siguientes datos ya están integrados en toda la web:

- **Email:** contacto@yomeencargo.cl
- **Teléfono/WhatsApp:** +56 9 5439 0267
- **Instagram:** [@yo.me.encargo_](https://www.instagram.com/yo.me.encargo_)
- **Ubicación:** Región Metropolitana, Santiago, Chile
- **Horario:** Lunes a Domingo, 9:00 - 19:00 hrs

**Para cambiarlos:**
- Email y teléfono aparecen en: `Contact.tsx`, `Footer.tsx`, `Navbar.tsx`
- Busca y reemplaza el valor antiguo por el nuevo en todo el proyecto

---

## 🎯 CTAs (Llamados a la Acción)

La landing tiene múltiples CTAs estratégicos que dirigen a:

1. **"Cotizar Ahora"** → `/cotizador` ✅
2. **"Hablar con Asesor"** → WhatsApp (se abre en nueva pestaña) ✅
3. **"Contacto"** → Formulario de contacto en la misma página ✅

**Todas las rutas de `/admin` y `/cotizador` siguen funcionando exactamente igual.**

---

## 🌐 SEO Optimizado

Se han implementado las siguientes mejoras de SEO:

✅ Meta título optimizado con palabras clave
✅ Meta descripción persuasiva (160 caracteres)
✅ Keywords relevantes para Chile
✅ Open Graph tags para redes sociales
✅ Twitter Card configurado
✅ Estructura semántica HTML5
✅ Alt text en imágenes
✅ Jerarquía correcta de headings (H1, H2, H3)

**Ubicación:** `src/app/layout.tsx` (líneas 8-41)

---

## 📱 Responsive 100%

La landing está completamente optimizada para:
- 📱 **Mobile** (320px - 767px)
- 📱 **Tablet** (768px - 1023px)
- 💻 **Desktop** (1024px+)

Prueba en diferentes dispositivos usando:
- Chrome DevTools (F12 → Toggle device toolbar)
- Responsive Design Mode (Ctrl+Shift+M)

---

## 🎨 Personalizar Contenido

### Cambiar Testimonios
📁 **Archivo:** `src/components/landing/Testimonials.tsx` (líneas 7-48)

```typescript
const testimonials = [
  {
    name: 'Nombre del Cliente',
    service: 'Tipo de Servicio',
    rating: 5,
    comment: 'El comentario aquí...',
    date: 'Mes 2024',
  },
  // Agrega más testimonios...
]
```

### Cambiar Preguntas Frecuentes
📁 **Archivo:** `src/components/landing/FAQ.tsx` (líneas 11-52)

### Modificar Servicios
📁 **Archivo:** `src/components/landing/Services.tsx` (líneas 8-72)

---

## ⚡ Comandos Útiles

```bash
# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Iniciar en producción
npm start

# Verificar errores
npm run lint
```

---

## ✅ Verificación de Rutas

Las siguientes rutas **NO han sido modificadas** y siguen funcionando:

- ✅ `/admin` - Panel de administración intacto
- ✅ `/cotizador` - Cotizador funcionando perfectamente
- ✅ Todas las APIs y rutas backend intactas

---

## 🚀 Próximos Pasos

1. **Sube el logo:** `/public/logo.png`
2. **Sube las imágenes:** Carpeta `/public/images/`
3. **Ajusta colores** (si es necesario): `tailwind.config.ts`
4. **Personaliza testimonios:** `src/components/landing/Testimonials.tsx`
5. **Integra formulario de contacto:** Backend para envío de emails (opcional)
6. **Prueba en móvil y desktop**
7. **¡Lanza tu web!** 🎉

---

## 📞 Formulario de Contacto

Por ahora, el formulario redirige a **WhatsApp** con los datos precargados.

**Para integrar envío de emails:**
1. Crea un endpoint API en `/src/app/api/contact/route.ts`
2. Implementa envío con Resend, SendGrid, o NodeMailer
3. Actualiza `src/components/landing/Contact.tsx` línea 21

---

## 🎉 ¡Listo!

Tu landing page está completamente funcional y optimizada. Solo falta:
1. Subir tus imágenes
2. (Opcional) Ajustar colores corporativos
3. (Opcional) Personalizar testimonios

**Todo el código es limpio, comentado y fácil de mantener.**

---

## 📄 Estructura de Archivos Nuevos

```
src/
├── app/
│   ├── page.tsx                    # ✨ ACTUALIZADO - Home completo
│   └── layout.tsx                  # ✨ ACTUALIZADO - Metadata SEO
├── components/
│   └── landing/                    # 🆕 NUEVA CARPETA
│       ├── Navbar.tsx              # Navegación principal
│       ├── Hero.tsx                # Sección hero
│       ├── HowItWorks.tsx          # Cómo funciona
│       ├── Services.tsx            # Servicios
│       ├── WhyChooseUs.tsx         # Beneficios
│       ├── Coverage.tsx            # Cobertura
│       ├── Testimonials.tsx        # Testimonios
│       ├── FAQ.tsx                 # Preguntas frecuentes
│       ├── Contact.tsx             # Formulario contacto
│       └── Footer.tsx              # Footer
└── tailwind.config.ts              # ✨ ACTUALIZADO - Colores corporativos
```

---

**¿Dudas o necesitas ajustes?** ¡Contáctame! 🚀

