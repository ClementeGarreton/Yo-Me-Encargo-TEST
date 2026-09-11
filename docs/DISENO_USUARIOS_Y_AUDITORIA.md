# Diseño — Múltiples usuarios y log de actividad (trazabilidad)

> **Estado: propuesta de diseño, sin implementar.** Documento para revisar y aprobar
> antes de escribir código. Julio 2026.

Objetivo: que entren varios personas al panel (mismos permisos) y que quede registrado
**quién hizo qué y cuándo**.

---

## 1. El problema de base: hoy la sesión es anónima

Estado actual verificado:

| Pieza | Cómo está hoy |
|---|---|
| Usuarios | **Uno solo**, definido por env: `ADMIN_USERNAME` (default `admin`) + `ADMIN_PASSWORD` |
| Validación | `src/lib/adminAuth.ts`, comparación en tiempo constante |
| Sesión | Cookie `admin_authenticated` firmada (HMAC). Payload: **`v1.<exp>`** |

**El payload no contiene identidad.** La cookie solo prueba "alguien válido inició
sesión", no *quién*. Por eso el log de actividad no es un agregado independiente: primero
hay que poder identificar al actor.

Orden obligado: **usuarios → identidad en la sesión → log**.

---

## 2. Usuarios: dos caminos

### Opción A — Usuarios por variable de entorno (rápido)

```
ADMIN_USERS='tomas:<hash>,francisco:<hash>'
```

- ✅ Sin migración de BD, poca superficie nueva, se implementa en horas.
- ❌ Agregar/quitar una persona o cambiar una contraseña **requiere redeploy**.
- ❌ Nadie puede cambiar su propia contraseña.

### Opción B — Tabla `admin_users` en Supabase (recomendada)

```sql
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,          -- PBKDF2-SHA256, con salt por usuario
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
```

- ✅ Alta/baja de usuarios **desde el panel**, sin tocar código ni desplegar.
- ✅ Deja lugar para roles más adelante (hoy todos iguales, como pediste).
- ✅ `last_login_at` y desactivar sin borrar (importante para conservar el historial).
- ❌ Una migración + pantalla de gestión de usuarios.

**Recomendación: opción B.** El costo extra es una migración y una pantalla simple, y
evita depender de un redeploy cada vez que entra o sale alguien del equipo.

**Hash de contraseñas:** PBKDF2-SHA256 vía Web Crypto (≥100k iteraciones, salt aleatorio
por usuario). Se elige por sobre bcrypt/argon2 para **no agregar dependencias nativas**,
y porque ya usamos Web Crypto para firmar sesiones. Nunca guardar contraseñas en texto.

### Migración desde el usuario actual

El `ADMIN_USERNAME`/`ADMIN_PASSWORD` de hoy se conserva como **fallback de emergencia**
(si la tabla está vacía o la BD no responde, se puede entrar igual). Se registra en el log
como actor `admin (env)` para distinguirlo.

---

## 3. Identidad en la sesión

El payload firmado pasa de `v1.<exp>` a:

```
v2.<userId>.<username>.<exp>.<firma>
```

- Va **dentro del HMAC**, así que el usuario no puede alterarlo desde el navegador.
- Bump de versión `v1 → v2`: las sesiones abiertas se invalidan y todos vuelven a entrar
  una vez. Es un efecto esperado del cambio, conviene avisarlo.
- El middleware expone el actor a los endpoints vía header interno (`x-admin-user`), para
  que cada ruta sepa quién actúa sin volver a verificar la cookie.

---

## 4. Modelo de datos del log

```sql
CREATE TABLE admin_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),  -- fecha y hora del movimiento

  actor_username TEXT NOT NULL,        -- QUIÉN
  actor_id       UUID,                 -- FK lógica a admin_users (sin ON DELETE CASCADE:
                                       -- el historial sobrevive al borrado del usuario)

  action        TEXT NOT NULL,         -- QUÉ (ver catálogo, sección 5)
  entity_type   TEXT,                  -- booking | prospect | fleet | pricing | ...
  entity_id     TEXT,                  -- id del registro afectado
  entity_label  TEXT,                  -- etiqueta legible (ej. "Macarena Calderón · 16-07")

  summary       TEXT NOT NULL,         -- frase lista para mostrar en pantalla
  changes       JSONB,                 -- { campo: { from, to } } — solo lo que cambió

  ip            TEXT,
  user_agent    TEXT,
  request_path  TEXT,
  result        TEXT NOT NULL DEFAULT 'success'  -- success | denied | error
);

CREATE INDEX idx_activity_created    ON admin_activity_log (created_at DESC);
CREATE INDEX idx_activity_actor      ON admin_activity_log (actor_username, created_at DESC);
CREATE INDEX idx_activity_entity     ON admin_activity_log (entity_type, entity_id);
```

Decisiones y por qué:

- **`summary` pregenerado.** Se guarda la frase legible al momento del hecho ("Cambió el
  estado de Pendiente a Confirmado"). Si el registro original se borra o cambia, el log
  sigue siendo entendible sin cruzar tablas.
- **`entity_label` duplicado a propósito.** Mismo motivo: poder leer "quién era el
  cliente" aunque la reserva ya no exista.
- **`changes` solo con lo que cambió**, no el registro entero: hace el log legible y
  evita guardar datos personales de más.
- **El historial no se borra al borrar un usuario** (sin FK con cascade). Si alguien deja
  el equipo, se desactiva (`is_active = false`), no se elimina.
- **`result`** permite registrar también intentos fallidos o denegados (útil para
  seguridad: logins fallidos, acciones sin permiso).

---

## 5. Catálogo de eventos

Salió de recorrer los **16 endpoints que mutan datos**. Todo lo que cambia algo queda
cubierto:

### Sesión
| Acción | Cuándo |
|---|---|
| `auth.login` | Inicio de sesión correcto |
| `auth.login_failed` | Credenciales incorrectas (`result: denied`) |
| `auth.logout` | Cierre de sesión |

### Reservas — lo más sensible
| Acción | Origen |
|---|---|
| `booking.created` | `POST /api/admin/bookings` (alta manual, incl. método de cobro) |
| `booking.status_changed` | `PATCH .../bookings/[id]` — de → a |
| `booking.rescheduled` | `PATCH .../bookings/[id]` — fecha/hora anterior → nueva |
| `booking.payment_updated` | Cambios de `payment_type` / `payment_status` |
| `booking.deleted` | `DELETE .../bookings/[id]` |
| `booking.bulk_status_changed` | Cambios masivos (registra 1 evento por reserva) |
| `booking.payment_link_generated` | Generación de link de Flow |

### Prospectos / leads
| Acción | Origen |
|---|---|
| `prospect.status_changed` | `PATCH /api/admin/prospects` |
| `prospect.deleted` | `DELETE /api/admin/prospects` |
| `prospect.quote_sent` | `POST .../prospects/send-quote` (incl. precio ajustado) |
| `prospect.converted_to_booking` | `POST .../prospects/create-booking` |
| `customer.frequent_toggled` | `PATCH .../customers/toggle-frequent` |

### Configuración — cambios que afectan plata y operación
| Acción | Origen |
|---|---|
| `pricing.updated` | `PUT .../pricing-config` (**guardar valores antes/después**) |
| `schedule.updated` | `PUT .../schedule-config` |
| `fleet.updated` | `PATCH .../fleet-config` (incl. camión a mantenimiento) |
| `catalog.item_created/updated/deleted` | `POST/PUT/DELETE .../catalog-items` |
| `blocked_slot.created/updated/deleted` | Bloqueos de agenda |
| `driver_link.regenerated` | `POST .../driver-link` (invalida el link anterior) |

**Fuera del log:** las lecturas (`GET`) no se registran — inflarían la tabla sin aportar
trazabilidad de cambios. El cron (`cleanup-bookings`) sí se registra, con actor `system`.

---

## 6. Dónde se captura

**Helper explícito por endpoint**, no captura mágica en el middleware:

```ts
await logAdminAction({
  actor,                       // viene del header que inyecta el middleware
  action: 'booking.rescheduled',
  entityType: 'booking',
  entityId: booking.id,
  entityLabel: `${booking.client_name} · ${booking.scheduled_date}`,
  summary: `Reprogramó de ${prev.date} ${prev.time} a ${next.date} ${next.time}`,
  changes: { scheduled_date: { from: prev.date, to: next.date } },
  request,
})
```

Por qué no en el middleware: corre **antes** del handler, así que no sabe si la operación
tuvo éxito ni qué cambió realmente, y leer el body ahí lo consume. El registro tiene que
ocurrir donde se conoce el resultado.

Reglas para que sea confiable:
- **El log nunca rompe la operación.** Va en `try/catch`; si falla el registro se escribe
  a `console.error` pero la acción del usuario se completa igual.
- **Se registra después del éxito**, con el estado previo leído antes de mutar (varios
  endpoints ya hacen ese `select` previo, se reutiliza).
- **Escritura no bloqueante** donde se pueda, para no sumar latencia perceptible.

---

## 7. Vista en el panel

Nueva pestaña **"Actividad"** (junto a Clientes), con:

- Tabla: fecha y hora (America/Santiago) · usuario · acción · entidad · resumen.
- Filtros: por usuario, por rango de fechas, por tipo de acción, y búsqueda de texto.
- Detalle expandible con el `changes` (antes → después) en formato legible.
- **Exportar a CSV**, igual que Reservas, Leads y Clientes.
- Paginación real (server-side): esta tabla crece rápido, no se puede traer entera.

Además, en el detalle de cada reserva: un bloque **"Historial"** con los eventos de *esa*
reserva — que en la práctica es donde más se va a usar ("¿quién movió esta mudanza?").

---

## 8. Retención y privacidad

- **Retención sugerida: 12 meses.** Se limpia con el cron diario que ya existe
  (`cleanup-bookings`), agregando el borrado de registros más viejos.
- **Nunca se registran** contraseñas, hashes, tokens de sesión ni datos de tarjetas.
- **Se registra IP y user-agent**: son datos personales. Se justifican por seguridad
  (detectar accesos indebidos) y quedan cubiertos por la retención de 12 meses.
- El log es **solo lectura desde el panel**: no se puede editar ni borrar registros
  puntuales desde la interfaz. Un log que se puede editar no sirve como trazabilidad.

---

## 9. Plan de implementación sugerido

| Fase | Alcance | Nota |
|---|---|---|
| **1** | Tabla `admin_users` + hash PBKDF2 + login multi-usuario + `v2` con identidad | Habilita el segundo usuario. Invalida sesiones abiertas una vez. |
| **2** | Tabla `admin_activity_log` + helper + instrumentar reservas y prospectos | Cubre lo más sensible primero |
| **3** | Instrumentar configuración (precios, flota, agenda, catálogo) | Completa la cobertura |
| **4** | Pestaña "Actividad" + historial por reserva + CSV | La parte visible |
| **5** | Retención en el cron + pantalla de gestión de usuarios | Cierre |

Fases 1 y 2 ya entregan lo pedido: segundo usuario andando y trazabilidad de lo que más
importa.

---

## 10. Decisiones pendientes de Francisco

1. **¿Opción A (env) u opción B (tabla `admin_users`)?** Recomiendo B.
2. **Datos del segundo usuario**: nombre de usuario y a quién corresponde (¿Tomás?). La
   contraseña **no me la pases por chat** — se genera un hash y se carga, o la define esa
   persona en el primer ingreso.
3. **Retención**: ¿12 meses está bien o prefieres otro plazo?
4. **¿Registrar también logins fallidos?** Recomiendo que sí (detecta intentos de acceso).
