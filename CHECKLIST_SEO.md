# ✅ Checklist de SEO - Yo me Encargo

## 🎯 Implementado y Configurado

### Archivos Principales
- [x] **robots.txt** - Configurado en `/public/robots.txt`
- [x] **sitemap.ts** - Generador dinámico en `/src/app/sitemap.ts`
- [x] **manifest.ts** - PWA manifest en `/src/app/manifest.ts`
- [x] **browserconfig.xml** - Para Windows tiles

### Metadatos por Página

#### ✅ Layout Principal (`/src/app/layout.tsx`)
- [x] metadataBase configurado
- [x] Title template (`%s | Yo me Encargo`)
- [x] Description optimizada
- [x] Keywords principales
- [x] Open Graph tags
- [x] Twitter Cards
- [x] Canonical URL
- [x] JSON-LD Schema (MovingCompany)
- [x] lang="es" en HTML
- [x] robots configurado
- [x] Imágenes OG configuradas

#### ✅ Cotizador (`/cotizador`)
- [x] Layout con metadata específico
- [x] Title personalizado
- [x] Description optimizada
- [x] Keywords relevantes
- [x] Canonical URL
- [x] Open Graph

#### ✅ Domicilio (`/domicilio`)
- [x] Layout con metadata específico
- [x] Title personalizado
- [x] Description optimizada
- [x] Keywords relevantes
- [x] Canonical URL
- [x] Open Graph

#### ✅ Nuestros Servicios (`/nuestros-servicios`)
- [x] Layout con metadata específico
- [x] Title personalizado
- [x] Description optimizada
- [x] Keywords relevantes
- [x] Canonical URL
- [x] Open Graph

#### ✅ Contáctanos (`/contactanos`)
- [x] Metadata en la página
- [x] Canonical URL
- [x] Keywords de contacto

#### ✅ Políticas
- [x] `/politica-de-privacidad` - Metadata completo
- [x] `/terminos-y-condiciones` - Metadata completo

### Configuración Técnica

#### ✅ next.config.js
- [x] reactStrictMode habilitado
- [x] Optimización de imágenes (AVIF, WebP)
- [x] Headers de seguridad (X-Frame-Options, etc.)
- [x] X-DNS-Prefetch-Control
- [x] Referrer-Policy

#### ✅ Schema.org Structured Data
- [x] Tipo: MovingCompany
- [x] Nombre, descripción, URL
- [x] Teléfono de contacto
- [x] Área servida (Chile)
- [x] Servicios listados
- [x] Rating agregado

### SEO On-Page
- [x] Títulos H1 únicos en cada página
- [x] Estructura de encabezados jerárquica
- [x] URLs amigables (slug-based)
- [x] Contenido relevante y keywords
- [x] Enlaces internos optimizados

## 📋 Tareas Post-Deploy en Vercel

### Inmediatamente después del deploy:

1. **Verificar archivos públicos:**
   ```bash
   curl https://yomeencargo.cl/robots.txt
   curl https://yomeencargo.cl/sitemap.xml
   curl https://yomeencargo.cl/manifest.json
   ```

2. **Ejecutar script de verificación:**
   ```bash
   node scripts/verify-seo.js https://yomeencargo.cl
   ```

3. **Verificar metadatos:**
   - Inspeccionar el `<head>` de cada página
   - Verificar que JSON-LD esté presente
   - Comprobar Open Graph tags

### Herramientas de Validación:

- [ ] **Google PageSpeed Insights**
  - URL: https://pagespeed.web.dev/
  - Analizar: `https://yomeencargo.cl`
  - Meta: >90 en móvil y desktop

- [ ] **Google Rich Results Test**
  - URL: https://search.google.com/test/rich-results
  - Validar schema.org
  - Verificar MovingCompany type

- [ ] **Open Graph Checker**
  - URL: https://www.opengraph.xyz/
  - Verificar preview de redes sociales
  - Comprobar imagen 1200x630px

- [ ] **Twitter Card Validator**
  - URL: https://cards-dev.twitter.com/validator
  - Verificar preview de Twitter

- [ ] **Lighthouse Audit**
  - Chrome DevTools > Lighthouse
  - Ejecutar audit completo
  - Verificar score SEO > 95

## 🔧 Configuración de Google Search Console

1. **Registrar propiedad:**
   - Ir a https://search.google.com/search-console
   - Agregar propiedad: `https://yomeencargo.cl`
   - Método: HTML tag o DNS

2. **Verificar dominio:**
   - Copiar código de verificación
   - Agregar en `layout.tsx`:
     ```typescript
     verification: {
       google: 'tu-codigo-aqui',
     }
     ```
   - Redesplegar
   - Verificar en Search Console

3. **Enviar sitemap:**
   - En Search Console > Sitemaps
   - Agregar: `https://yomeencargo.cl/sitemap.xml`
   - Esperar indexación (1-2 semanas)

## 📊 Google Analytics (Opcional)

1. **Crear propiedad GA4:**
   - Ir a https://analytics.google.com
   - Crear nueva propiedad para `yomeencargo.cl`
   - Obtener ID de medición (G-XXXXXXXXX)

2. **Instalar en Next.js:**
   - Usar package `@next/third-parties/google`
   - Agregar componente `GoogleAnalytics`
   - O usar script en layout.tsx (ver SEO_DOCUMENTATION.md)

3. **Configurar eventos:**
   - Clic en "Cotizar"
   - Completar formulario
   - Pago completado
   - Contacto vía WhatsApp

## 🎨 Optimización de Imágenes

- [ ] Verificar `/public/images/hero-truck.jpg`:
  - Dimensiones: idealmente 1200x630px para OG
  - Formato: JPG optimizado o WebP
  - Tamaño: < 200KB
  - Incluir logo/marca visible

- [ ] Verificar `/public/images/logo.png`:
  - Fondo transparente
  - Dimensiones cuadradas (512x512px recomendado)
  - Formato: PNG

- [ ] Optimizar todas las imágenes:
  - Usar herramientas como TinyPNG
  - Considerar formato WebP/AVIF
  - Lazy loading implementado

## 📱 Mobile SEO

- [x] Viewport meta tag (por defecto en Next.js)
- [x] Responsive design (Tailwind)
- [x] Touch targets > 48px
- [x] PWA manifest
- [x] Theme color configurado
- [ ] Probar en dispositivos reales

## 🔗 Link Building (Próximos pasos)

- [ ] Crear perfil Google My Business
- [ ] Registrar en directorios locales
- [ ] Obtener backlinks de calidad
- [ ] Compartir en redes sociales
- [ ] Blog con contenido relevante

## 📝 Contenido SEO

- [ ] Crear blog de mudanzas (opcional)
- [ ] Guías y tips de mudanza
- [ ] FAQ detallado
- [ ] Testimonios de clientes
- [ ] Casos de éxito

## 🎯 Keywords a Seguir

Monitorear posicionamiento para:
1. mudanzas Santiago
2. fletes Chile
3. transporte región metropolitana
4. mudanzas oficina Santiago
5. mudanzas hogar Santiago
6. cotizador mudanzas online
7. fletes económicos Santiago
8. empresa de mudanzas Chile

## 📈 Métricas a Monitorear

- **Organic Traffic** (Google Analytics)
- **Posición en SERP** (Google Search Console)
- **CTR** (Click Through Rate)
- **Core Web Vitals** (PageSpeed Insights)
- **Conversiones** (formularios completados)
- **Bounce Rate**

## 🚀 Optimizaciones Avanzadas (Opcional)

- [ ] Implementar AMP (Accelerated Mobile Pages)
- [ ] Agregar breadcrumbs con Schema
- [ ] Implementar FAQ Schema
- [ ] Local Business Schema
- [ ] Review Schema
- [ ] Hreflang tags (si expandes a otros países)

## 🔄 Mantenimiento Regular

### Semanalmente:
- Revisar Google Search Console
- Verificar errores de rastreo
- Monitorear posiciones de keywords

### Mensualmente:
- Actualizar contenido
- Revisar backlinks
- Analizar competencia
- Optimizar páginas de bajo rendimiento

### Trimestralmente:
- Auditoría SEO completa
- Actualizar estrategia de keywords
- Revisar y actualizar contenido antiguo

---

**Nota:** Este checklist debe actualizarse conforme se implementen nuevas features o cambios en la estrategia SEO.

**Última actualización:** Diciembre 2, 2025
