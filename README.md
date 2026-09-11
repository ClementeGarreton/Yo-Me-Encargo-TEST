# 🚚 Cotizador de Mudanzas - Yo Me Encargo

Sistema de cotización web basado en Next.js 14 (App Router) y TypeScript.

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
```

## Variables de entorno (crear `.env.local`)

```env
# URL pública de la app
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Geoapify (mapas, geocoding y distancia)
NEXT_PUBLIC_GEOAPIFY_API_KEY=tu_api_key

# Supabase (base de datos y auth)
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

Notas:
- Sin `NEXT_PUBLIC_GEOAPIFY_API_KEY` la app usará fallbacks limitados (distancias por defecto); para funcionamiento completo de direcciones, configura la key.
- Supabase es requerido por `src/lib/supabase.ts` (cliente público y admin). Asegúrate de que las tres variables estén presentes.

## Desarrollo

```bash
npm run dev
```

Abrir `http://localhost:3000`.

## Producción

```bash
npm run build
npm start
```

## Estructura mínima relevante

```
src/
├─ app/            # Páginas y API routes
├─ components/     # UI y pasos del flujo
├─ config/         # Configuración (e.g., mapas)
├─ data/           # Catálogo de ítems
├─ lib/            # Servicios (maps, pricing, supabase)
└─ store/          # Estado global (Zustand)
```
