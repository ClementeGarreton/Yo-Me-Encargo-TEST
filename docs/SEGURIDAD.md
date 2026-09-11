# Protección contra abuso y picos de facturación

## Qué pasó (26-jul-2026)

El sitio quedó caído con `HTTP 402 · DEPLOYMENT_DISABLED`: Vercel pausó el proyecto por
límite de uso del plan. El disparador fue un pico de **~22 GB de "Fast Origin Transfer"
en un solo día** (contra un límite de 10 GB), que dejó el mes en 30,47 GB.

Evidencia de que **no** fue tráfico real de usuarios:
- Las sesiones de GA4 se mantuvieron normales (35–95/día) durante todo el período; un
  pico real de visitantes se habría visto ahí.
- O sea: el tráfico que consumió la transferencia nunca cargó una página. Golpeó rutas
  de API directamente → automatizado (bot/scanner).

Vector más probable: los endpoints públicos de subida de archivos, que no tenían
autenticación, ni tope de archivos por petición, ni rate limiting.

## Defensa en capas

El orden importa: **la capa 1 es la única que evita que el tráfico se facture**, porque
corta antes de llegar al cómputo de Vercel. Las capas 2 y 3 limitan el daño, no el gasto.

### Capa 1 — Delante del origen (PENDIENTE, acción de plataforma)

Estado actual del DNS de `yomeencargo.cl` (verificado 26-jul-2026):

| Host | Sirve | Proxy Cloudflare |
|---|---|---|
| `yomeencargo.cl` (apex) | `server: Vercel` | ❌ NO (DNS-only, nube gris) |
| `www.yomeencargo.cl` | `server: cloudflare` | ✅ sí, pero solo hace 301 al apex |

**El dominio ya usa Cloudflare como DNS** (nameservers `isla`/`guy.ns.cloudflare.com`),
pero el apex —donde va todo el tráfico real— apunta directo a Vercel. Cloudflare hoy no
filtra nada del tráfico que importa.

Acciones recomendadas (requieren acceso a Cloudflare y a la cuenta de Vercel):

1. **Activar el proxy (nube naranja) en el apex.** Todo el tráfico pasaría por Cloudflare
   antes de Vercel. Con el plan gratis ya se obtiene: caché de estáticos (reduce mucho el
   Origin Transfer), *Bot Fight Mode*, y **1 regla de rate limiting**.
   - Ojo al migrar: verificar que el certificado y los redirects sigan bien, y usar modo
     SSL *Full (strict)*.
2. **Regla de rate limiting en Cloudflare** apuntada a las rutas caras, p. ej.
   `/api/photos/upload`, `/api/*/upload-pdf`, `/api/maps/*`.
3. **Vercel Spend Management**: fijar un límite de gasto con **notificación por correo**
   antes del corte. Es la red de seguridad que evita enterarse del problema porque el
   sitio se cayó.
4. Opcional: **Vercel BotID** / WAF (requiere plan Pro) para reglas más finas.

### Capa 2 — Rate limiting en la aplicación (HECHO)

`src/lib/rateLimit.ts` + `src/middleware.ts`. Corre en el middleware, antes de la
comprobación de sesión, sobre todo `/api/*`.

Límites por IP (ver `RATE_LIMIT_RULES` para la fuente de verdad):

| Ruta | Límite | Motivo |
|---|---|---|
| `/api/admin/auth/login` | 10 / 15 min | Fuerza bruta |
| Subidas (`photos/upload`, `*/upload-pdf`) | 20 / hora | Vector del incidente |
| `/api/maps/*` | 100 / 5 min | Cuota de Geoapify (costo externo) |
| Escrituras públicas (crear prospecto/reserva, enviar cotización, PDF) | 15–40 / hora | Crean registros, mandan correos |
| Resto de `/api/*` | 300 / min | Contención general |

**Exentas a propósito** (`RATE_LIMIT_EXEMPT`) — no tocar sin pensarlo:
- `/api/payment`, `/api/payment/confirm`, `/api/payment/result`: webhooks de Flow, llegan
  siempre desde las mismas IPs. Limitarlas por IP haría **perder confirmaciones de pago
  reales**.
- `/api/admin/cleanup-bookings`: cron de Vercel.

Limitación honesta: el contador vive **en memoria del isolate**, no en un store
compartido. Frena un flood desde pocas IPs (con Fluid Compute las instancias se
reutilizan), pero no se comparte entre instancias/regiones y se pierde en cold start, así
que un ataque distribuido lo diluye. Para garantía dura haría falta Upstash Redis /
Vercel KV — no se hizo para no agregar dependencia ni costo, dado que la capa 1 cubre
mejor ese escenario.

### Capa 3 — Endurecimiento de endpoints (HECHO)

- Eliminado `/api/upload`: código muerto (ninguna pantalla lo usaba) que además escribía
  a un filesystem que no persiste en Vercel. Solo era superficie de ataque.
- `/api/photos/upload`: tope de **10 archivos por petición** y corte por `Content-Length`
  (**413** si supera ~60 MB) *antes* de leer el body. Antes solo validaba 5 MB por archivo
  individual, sin tope de cantidad.

## Pendientes conocidos

- Capa 1 completa (Cloudflare proxy + regla de rate limit + límite de gasto en Vercel).
- Los proxies de Geoapify (`/api/maps/*`) siguen siendo públicos sin autenticación: hoy
  solo los protege el rate limit. Si el gasto de Geoapify se vuelve un problema, valorar
  firmar las peticiones desde el cliente o exigir un token de sesión.
- Rate limiting durable (Redis/KV) si aparece abuso distribuido.
