# Plan de mejoras — Web + Panel Admin (julio 2026)

Basado en exploración del código al 2026-07-16 (HEAD `aaf1f33`). 8 pedidos + 1 hallazgo de seguridad.

## Estado de ejecución

- **Fase 1 — HECHA** (2026-07-16, en working tree sin commit). Build de producción OK (`tsc` y `next build` en verde). Cubre pedidos 1 (acarreo), 3 (CSV fecha/hora), 8 (flota) + cierre de seguridad.
  - **1 paso manual obligatorio:** aplicar `database/migrations/add_fleet_vehicles.sql` en Supabase prod. Sin esa columna, el toggle de mantenimiento no persiste (el resto degrada a `num_vehicles`, sin romperse).
  - **Env opcional:** `ADMIN_SESSION_SECRET` para firmar la sesión; si falta, se deriva de `ADMIN_PASSWORD`.
  - **Efecto en deploy:** el admin logueado se redirige a login una vez (la cookie vieja `'true'` deja de ser válida).
- **Fase 2 — HECHA** (2026-07-16, sin commit). Build OK. Cubre pedidos 6 (cambios masivos) y 4 (empresa/persona visible).
  - Selección múltiple (checkbox por fila + "seleccionar todo") con barra de acciones en Leads (Contactado / Sin respuesta / Perdido) y Reservas (Confirmado / Completado / No atendido / Cancelado). Aplica vía los endpoints PATCH existentes (loop `Promise.allSettled`, un toast con conteo ok/error). Sin endpoint nuevo ni migración.
  - Badge Empresa/Persona en ambas listas (RUT/razón social en tooltip), filtro "Tipo de cliente", y columnas Tipo/Razón social/RUT en ambos CSV. El dato `is_company` ya existía; no se adivina por email.
  - Nota: fragmento inicial de `clientTypeFilter` en Leads lo dejó el intern de LM Studio; el resto (UI, badges, bulk, bookings) se completó directo (el intern no converge en edición multi-paso sobre TSX grandes → descartado por regla del 70%).
- **Fase 3 — HECHA** (2026-07-16, sin commit). Build OK. Cubre pedidos 5 (gráficos dashboard) y 7 (clientes atendidos).
  - Dashboard con gráficos (recharts): reservas+ingresos por mes (últimos 6, ComposedChart), leads por origen, embudo Leads→Reservas→Completadas. Endpoint `/api/admin/analytics`.
  - Sección "Clientes Atendidos" (nueva tab): cartera desde reservas `completed` agrupadas por email (nº mudanzas, primera/última, total gastado, empresa/persona, frecuente), buscador y export CSV. Endpoint `/api/admin/customers/attended`.
  - `occupancyRate` del dashboard ya no es `6*30` hardcodeado: usa vehículos activos × franjas configuradas × días del mes.
  - Helpers puros `src/lib/adminAnalytics.ts` los generó el intern de LM Studio (qwen3-coder-30b) en una sola escritura — buen encaje esta vez. Le corregí 2 bugs de lógica (identidad del cliente no tomaba el booking más reciente; source vacío sin label) + tipos.
- **Fase 4 — HECHA** (2026-07-16, sin commit). Build OK. Cubre pedido 2 (acceso choferes).
  - Link público **común** `/trabajos/<token>` (decisión de Francisco: común, porque a veces 2 camiones por trabajo). Solo lectura, **sin precios**: fecha/hora, cliente + teléfono (tel:), origen/destino con piso/ascensor/acarreo, items a mover, notas, y links a Google Maps. Mobile-first. Server component en `src/app/trabajos/[token]/page.tsx` + lib `src/lib/driverJobs.ts` (nunca selecciona precios).
  - Admin: tarjeta "Acceso Choferes" en la pestaña Flota (`DriverAccessCard`): generar/ver/copiar link, **enviar por WhatsApp** (wa.me), y **regenerar** (invalida el anterior). API `/api/admin/driver-link` (protegida por el middleware admin).
  - **Migración nueva:** `database/migrations/add_driver_access_token.sql` (columna `driver_access_token` en fleet_config). El código degrada sin romperse si no está aplicada (link inválido hasta generarlo).

## Hallazgos clave (cambian el enfoque de varios pedidos)

1. **Acarreo en PDF (pedido 1):** el código de los PDFs que sí imprimen el acarreo
   (`generateBookingPDF` en `src/lib/pdfGenerator.ts` y `generateAdminQuotePDF` en
   `src/lib/adminQuotePdf.ts`) es **simétrico** origen/destino. La causa del síntoma es
   `formatParkingDistance` (`src/lib/utils.ts:47-52`): devuelve `null` cuando el valor es 0
   ("en la puerta"), y esa línea se omite. Si el cliente dejó destino "en la puerta", no se
   imprime. Además `generateQuotePDF` (el PDF que descarga el cliente en el cotizador) no
   imprime el acarreo en ninguno de los dos.
2. **Persona natural vs empresa (pedido 4):** ya existe. El cotizador tiene checkbox
   "¿Necesitas Factura?" que guarda `is_company`, `company_name`, `company_rut` en
   `quote_prospects` y `bookings`. No hace falta adivinar por el Gmail: solo falta
   **mostrarlo** en el panel (badge, filtro, columna CSV). La heurística por dominio de
   email queda como complemento opcional para leads que no marcaron el checkbox.
3. **Flota/mantenimiento (pedido 8):** los vehículos del panel son **mock generados en el
   navegador** (`FleetManagement.tsx:52-60`); el botón "Mantenimiento" solo cambia estado
   local de React, no persiste nada. La disponibilidad (`/api/bookings/available`) usa solo
   `fleet_config.num_vehicles`. Por eso poner los 3 camiones en mantenimiento no cambia nada.
   Requiere migración de BD.
4. **Seguridad (no pedido, pero previo al link de choferes):** el middleware solo protege
   páginas `/admin/*`, **no las APIs `/api/admin/*`** (accesibles sin login), y la cookie
   `admin_authenticated='true'` es forjable (no está firmada). Hay que cerrar esto antes de
   exponer más superficie pública.

---

## Fase 1 — Bugs y quick wins

### 1.1 Acarreo origen y destino en PDFs (pedido 1)
- Imprimir siempre ambas líneas: para valor 0 mostrar "En la puerta" en vez de omitir
  (ajustar `formatParkingDistance` o mapear 0 explícitamente en los PDFs).
- Agregar el bloque de acarreo a `generateQuotePDF` y `generateCheckoutPDF`, que hoy no lo
  muestran (copiar patrón de `generateBookingPDF:578-609`).

### 1.2 CSV con fecha y hora (pedido 3)
- **Prospectos** (`ProspectsManagement.tsx:583-597`): agregar `scheduled_date` y
  `scheduled_time` (hoy no exporta la fecha/hora de la mudanza cotizada).
- **Ambos exports**: `created_at` formateado legible en zona `America/Santiago`
  (columnas separadas fecha y hora, formato compatible con Excel/Sheets).
- Reservas: agregar `booking_type`, `payment_status` de paso (hoy faltan).

### 1.3 Flota: mantenimiento real (pedido 8)
- Migración: tabla `vehicles` (`id, name, driver_name, driver_phone, status
  'active'|'maintenance', fleet_config_id/orden`) o, mínimo viable, columna
  `vehicles JSONB` en `fleet_config`. Recomendado: tabla, porque los choferes/teléfonos
  hoy son ficticios y esta tabla alimenta después la vista de choferes (Fase 4).
- `FleetManagement.tsx`: leer/persistir vehículos reales (CRUD vía `/api/admin/fleet-config`
  o endpoint nuevo `/api/admin/vehicles`).
- Disponibilidad: `capacity = vehículos activos` (no `num_vehicles`) en
  `src/app/api/bookings/available/route.ts:39` y en la validación de
  `src/app/api/admin/bookings/route.ts:221-243`.

### 1.4 Seguridad mínima
- Proteger `/api/admin/*` (extender matcher del middleware o helper de auth en cada ruta).
- Firmar la cookie de sesión (HMAC con secret) con expiración real.

## Fase 2 — Gestión masiva y empresa

### 2.1 Cambios masivos de estado (pedido 6)
- Checkboxes por fila + "seleccionar todo (filtrado)" en `ProspectsManagement` y
  `BookingsManagement`, con barra de acciones flotante: cambiar estado (sin respuesta,
  perdido, contactado / confirmar, completar, no atendido) para N seleccionados.
- API: aceptar `ids: []` en los PATCH existentes o endpoint `bulk-update`.

### 2.2 Persona natural / empresa visible (pedido 4)
- Badge "Empresa" (con razón social/RUT en tooltip o detalle) en listados de leads y reservas.
- Filtro tipo de cliente en ambos paneles.
- Columnas `tipo_cliente`, `razon_social`, `rut_empresa` en ambos CSV.
- Opcional: marcar "posible empresa" cuando el dominio del email no es
  gmail/hotmail/outlook/yahoo y no marcaron el checkbox.

## Fase 3 — Dashboard y cartera

### 3.1 Gráficos en dashboard (pedido 5)
- Instalar `recharts` (única librería nueva; hoy no hay ninguna de gráficos).
- Análisis descriptivo: (a) reservas e ingresos por semana (últimas 8–12), (b) leads por
  fuente (`source`), (c) embudo lead → reserva → completada del mes.
- De paso: arreglar `occupancyRate` que hoy usa `totalSlots = 6 * 30` hardcodeado
  (`src/app/api/admin/stats/route.ts:66`) — leer `schedule_config` y flota real.

### 3.2 Sección "Clientes Atendidos" (pedido 7)
- Nueva tab en el admin: agregación de `bookings` con `status='completed'` agrupada por
  `client_email`: nombre, teléfono, tipo (empresa/persona), nº de mudanzas, última fecha,
  total histórico, flag frecuente.
- Exportable a CSV (base de la futura cartera / remarketing).
- Sin tabla nueva al inicio (query agregada server-side); si la cartera crece o se quiere
  editar datos del cliente, se materializa una tabla `customers` en una fase posterior.

## Fase 4 — Vista para choferes (pedido 2)

**Recomendación: link público con token, sin login.** Comparación:

| Opción | Esfuerzo | Contras |
|---|---|---|
| A. Plataforma con login por chofer | Alto (hoy el auth es 1 solo admin con cookie; habría que construir usuarios/roles) | Sobredimensionado para 3 choferes |
| **B. Página pública `/trabajos/[token]` (recomendada)** | Medio-bajo | Quien tenga el link ve direcciones/nombres → token largo + rotación desde admin |
| C. PDF al calendario | Bajo (los links `.ics`/GCal ya existen en admin) | No responde "¿qué hay por hacer?"; PDF OT trae precio; depende de que cada chofer use bien su calendario |

- Página `B`: solo lectura, trabajos de hoy + próximos (bookings `confirmed`/`pending` no
  provisionales): fecha/hora, direcciones con piso/ascensor/acarreo, items, notas,
  **sin precios**, link a Google Maps por dirección.
- Token aleatorio largo guardado en `fleet_config` (o tabla `vehicles` por chofer),
  regenerable desde el panel. Se comparte por WhatsApp una sola vez.
- Requiere 1.4 (APIs cerradas) hecho antes.
- Complemento barato: versión "OT sin precio" del PDF admin para adjuntar al calendario si
  igual quieren la opción C.

---

## Orden y dependencias

1. Fase 1 (independientes entre sí; 1.3 incluye migración SQL).
2. Fase 2 (independiente de Fase 1 salvo compartir componentes de tabla).
3. Fase 3 (3.1 depende de datos existentes; 3.2 independiente).
4. Fase 4 (depende de 1.4 y se apoya en tabla `vehicles` de 1.3).

## Decisiones confirmadas (2026-07-16)

1. **Vista choferes:** opción B (link público con token) + botón **"enviar por WhatsApp"**
   (quick send) desde el panel. Común vs por camión: se define en Fase 4 junto con `vehicles`.
2. **Clientes Atendidos:** solo reservas con `status='completed'`.
3. **Dashboard:** granularidad **mensual** para el gráfico principal.
