import { cookies } from 'next/headers'
import {
  getDriverAccessToken,
  getUpcomingDriverJobs,
  DRIVER_WINDOW_DAYS,
  type DriverJob,
} from '@/lib/driverJobs'
import { DRIVER_SESSION_COOKIE, verifyDriverSessionToken } from '@/lib/driverSession'
import DriverPinGate from '@/components/trabajos/DriverPinGate'
import { formatParkingDistance } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function dateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function floorLine(floor: number | null, elevator: boolean | null, parking: number | null): string | null {
  const parts: string[] = []
  if (floor !== null && floor !== undefined) parts.push(`Piso ${floor}`)
  if (elevator !== null && elevator !== undefined) parts.push(elevator ? 'con ascensor' : 'sin ascensor')
  const parkingLabel = formatParkingDistance(parking ?? undefined)
  if (parkingLabel) parts.push(`acarreo: ${parkingLabel}`)
  return parts.length ? parts.join(' · ') : null
}

function AddressBlock({
  label,
  address,
  floor,
  elevator,
  parking,
}: {
  label: string
  address: string
  floor?: number | null
  elevator?: boolean | null
  parking?: number | null
}) {
  if (!address) return null
  const meta = floorLine(floor ?? null, elevator ?? null, parking ?? null)
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <a
        href={mapsUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-blue-700 underline underline-offset-2"
      >
        {address}
      </a>
      {meta && <div className="text-xs text-gray-500">{meta}</div>}
    </div>
  )
}

function JobCard({ job }: { job: DriverJob }) {
  const isDomicilio = job.booking_type === 'domicilio'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-gray-900">
          {job.scheduled_time ? job.scheduled_time.slice(0, 5) : 'Sin hora'} hrs
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isDomicilio
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {isDomicilio ? 'Visita a domicilio' : 'Mudanza'}
        </span>
      </div>

      <div className="mt-1 text-sm font-medium text-gray-900">{job.client_name}</div>
      {job.client_phone && (
        <a href={`tel:${job.client_phone}`} className="text-sm text-blue-700 underline underline-offset-2">
          {job.client_phone}
        </a>
      )}

      {isDomicilio && job.visit_address ? (
        <AddressBlock label="Dirección" address={job.visit_address} />
      ) : (
        <>
          <AddressBlock
            label="Origen"
            address={job.origin_address}
            floor={job.origin_floor}
            elevator={job.origin_has_elevator}
            parking={job.origin_parking_distance}
          />
          <AddressBlock
            label="Destino"
            address={job.destination_address}
            floor={job.destination_floor}
            elevator={job.destination_has_elevator}
            parking={job.destination_parking_distance}
          />
        </>
      )}

      {job.items.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Items</div>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {job.items.map((it, i) => (
              <li key={i} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {it.quantity}× {it.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {job.notes && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Notas: </span>
          {job.notes}
        </div>
      )}
    </div>
  )
}

export default async function DriverJobsPage({ params }: { params: { token: string } }) {
  const validToken = await getDriverAccessToken()
  const authorized = Boolean(validToken) && params.token === validToken

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">Enlace no válido</h1>
          <p className="mt-1 text-sm text-gray-600">
            Este link de trabajos no es válido o fue reemplazado. Pedile el link actualizado al
            administrador.
          </p>
        </div>
      </div>
    )
  }

  // Segunda capa: además del link con token, hay que ingresar el PIN. La sesión vive
  // en una cookie firmada (12h), así que no se pide en cada carga durante la jornada.
  const pinOk = await verifyDriverSessionToken(cookies().get(DRIVER_SESSION_COOKIE)?.value)
  if (!pinOk) {
    return <DriverPinGate token={params.token} />
  }

  const jobs = await getUpcomingDriverJobs()

  // Agrupar por fecha, en orden.
  const groups: { date: string; items: DriverJob[] }[] = []
  for (const job of jobs) {
    let g = groups.find((x) => x.date === job.scheduled_date)
    if (!g) {
      g = { date: job.scheduled_date, items: [] }
      groups.push(g)
    }
    g.items.push(job)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        <header className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Trabajos por hacer</h1>
          <p className="text-sm text-gray-500">
            Yo Me Encargo · próximos {DRIVER_WINDOW_DAYS} días
          </p>
        </header>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-600">
              No hay trabajos programados en los próximos {DRIVER_WINDOW_DAYS} días.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.date}>
                <h2 className="mb-2 text-sm font-semibold capitalize text-gray-500">
                  {dateLabel(group.date)}
                </h2>
                <div className="space-y-3">
                  {group.items.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-8 text-center text-[11px] text-gray-400">
          Actualizá la página para ver los últimos trabajos.
        </footer>
      </div>
    </div>
  )
}
