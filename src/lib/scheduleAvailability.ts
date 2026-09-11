import { supabaseAdmin } from '@/lib/supabase'
import { getActiveCapacity } from '@/lib/fleetCapacity'

export interface AvailableSlot {
  time: string
  label?: string
  recommended?: boolean
  availableSlots: number
}

export async function getAvailableSlotsForDate(date: string): Promise<AvailableSlot[]> {
  const { data: configData } = await supabaseAdmin.from('fleet_config').select('*').maybeSingle()
  if (!configData) return []
  const capacity = getActiveCapacity(configData)

  const { data: scheduleConfig } = await supabaseAdmin.from('schedule_config').select('time_slots').maybeSingle()
  const defaultSlots = [
    { time: '08:00', label: '08:00 hrs', recommended: true },
    { time: '09:00', label: '09:00 hrs', recommended: true },
    { time: '10:00', label: '10:00 hrs', recommended: true },
    { time: '11:00', label: '11:00 hrs', recommended: false },
    { time: '14:00', label: '14:00 hrs', recommended: true },
    { time: '15:00', label: '15:00 hrs', recommended: false },
  ]
  const slots = Array.isArray(scheduleConfig?.time_slots) ? scheduleConfig.time_slots : defaultSlots

  const availability = await Promise.all(slots.map(async (slot: any) => {
    const time = String(slot.time)
    const [{ count }, { data: blocked }] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('scheduled_date', date)
        .eq('scheduled_time', time)
        .in('status', ['confirmed', 'pending']),
      supabaseAdmin
        .from('blocked_slots')
        .select('id')
        .eq('date', date)
        .lte('start_time', time)
        .gt('end_time', time),
    ])
    const availableSlots = capacity - Number(count || 0)
    if (availableSlots <= 0 || (blocked?.length || 0) > 0) return null
    return { time, label: slot.label, recommended: Boolean(slot.recommended), availableSlots }
  }))

  return availability.filter(Boolean) as AvailableSlot[]
}
