'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Cell,
} from 'recharts'
import type { MonthlyPoint, SourceCount, FunnelStage } from '@/lib/adminAnalytics'

interface AnalyticsData {
  monthly: MonthlyPoint[]
  sources: SourceCount[]
  funnel: FunnelStage[]
}

const BRAND = '#ff6a2c'
const SOURCE_COLORS = [
  '#ff6a2c', '#2c7fff', '#22c55e', '#a855f7',
  '#eab308', '#ec4899', '#14b8a6', '#94a3b8',
]
const FUNNEL_COLORS = ['#ff6a2c', '#2c7fff', '#22c55e']

const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`

export default function DashboardCharts() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/admin/analytics')
        if (!res.ok) throw new Error('fetch failed')
        const json = await res.json()
        if (active) setData(json)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-500">Cargando gráficos…</p>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-500">No se pudo cargar la analítica.</p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Reservas e ingresos por mes
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Últimos 6 meses · por fecha de mudanza, excluye canceladas
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data.monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `$${Math.round(Number(v) / 1000).toLocaleString('es-CL')}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) =>
                name === 'Ingresos' ? clp(Number(value)) : String(value)
              }
            />
            <Bar yAxisId="left" dataKey="revenue" name="Ingresos" fill={BRAND} radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="count"
              name="Reservas"
              stroke="#2c7fff"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Leads por origen</h3>
        <p className="text-sm text-gray-500 mb-4">Histórico</p>
        {data.sources.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data.sources}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                {data.sources.map((_, i) => (
                  <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Embudo</h3>
        <p className="text-sm text-gray-500 mb-4">Leads → Reservas → Completadas</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.funnel} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" name="Cantidad" radius={[4, 4, 0, 0]}>
              {data.funnel.map((_, i) => (
                <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
