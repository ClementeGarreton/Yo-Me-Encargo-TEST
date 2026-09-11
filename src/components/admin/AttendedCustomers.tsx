'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Users, Download, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import type { AttendedCustomer } from '@/lib/adminAnalytics'

interface Customer extends AttendedCustomer {
  isFrequent?: boolean
}

const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return y && m && day ? `${day}-${m}-${y}` : d
}
const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`

const escapeCsv = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function AttendedCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/customers/attended')
      if (!res.ok) throw new Error('fetch failed')
      setCustomers(await res.json())
    } catch (error) {
      console.error('Error fetching attended customers:', error)
      toast.error('Error al cargar clientes atendidos')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.companyName || '').toLowerCase().includes(q)
    )
  }, [customers, search])

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
    [filtered]
  )

  const handleExportCSV = () => {
    const columns: { header: string; value: (c: Customer) => unknown }[] = [
      { header: 'Nombre', value: (c) => c.name },
      { header: 'Email', value: (c) => c.email },
      { header: 'Teléfono', value: (c) => c.phone },
      { header: 'Tipo cliente', value: (c) => (c.isCompany ? 'Empresa' : 'Persona') },
      { header: 'Razón social', value: (c) => c.companyName },
      { header: 'RUT empresa', value: (c) => c.companyRut },
      { header: 'Mudanzas', value: (c) => c.movesCount },
      { header: 'Primera mudanza', value: (c) => fmtDate(c.firstMoveDate) },
      { header: 'Última mudanza', value: (c) => fmtDate(c.lastMoveDate) },
      { header: 'Total gastado', value: (c) => c.totalSpent },
      { header: 'Frecuente', value: (c) => (c.isFrequent ? 'Sí' : 'No') },
    ]
    const header = columns.map((c) => escapeCsv(c.header)).join(',')
    const rows = filtered.map((c) =>
      columns.map((col) => escapeCsv(col.value(c))).join(',')
    )
    const csv = '﻿' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes_atendidos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando clientes atendidos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clientes Atendidos</h2>
          <p className="text-gray-600">
            Cartera de clientes con al menos una mudanza completada
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" size="sm" disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Clientes</p>
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Mudanzas completadas</p>
          <p className="text-2xl font-bold text-gray-900">
            {customers.reduce((s, c) => s + c.movesCount, 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Ingresos históricos (filtrado)</p>
          <p className="text-2xl font-bold text-gray-900">{clp(totalRevenue)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, teléfono o razón social..."
        />
      </Card>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay clientes atendidos todavía</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mudanzas
                  </th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((c) => (
                  <tr key={c.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900">
                          {c.name || c.email}
                        </span>
                        {c.isFrequent && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> Frecuente
                          </span>
                        )}
                        {c.isCompany ? (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200"
                            title={`${c.companyName || ''} ${c.companyRut ? `(${c.companyRut})` : ''}`.trim()}
                          >
                            Empresa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                            Persona
                          </span>
                        )}
                      </div>
                      <div className="md:hidden text-xs text-gray-500">{c.email}</div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 align-top">
                      <div className="text-sm text-gray-500">{c.email}</div>
                      <div className="text-xs text-gray-400">{c.phone}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-sm font-semibold text-gray-900">{c.movesCount}</span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 align-top text-sm text-gray-600">
                      {fmtDate(c.lastMoveDate)}
                    </td>
                    <td className="px-4 py-3 align-top text-sm font-medium text-gray-900">
                      {clp(c.totalSpent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
