import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File | null
    const prospectIdRaw = (formData.get('prospectId') as string) || ''
    const prospectEmailRaw = (formData.get('prospectEmail') as string) || ''

    const prospectId = prospectIdRaw.trim()
    const prospectEmail = prospectEmailRaw.trim()

    if (!prospectId && !prospectEmail) {
      return NextResponse.json(
        { error: 'prospectId o prospectEmail es requerido' },
        { status: 400 }
      )
    }

    let resolvedRowId: string | null = null

    if (prospectId) {
      const { data: byId, error: errId } = await supabaseAdmin
        .from('quote_prospects')
        .select('id, pdf_url')
        .eq('id', prospectId)
        .maybeSingle()

      if (errId) {
        console.error('[prospect-pdf] Error leyendo prospecto por ID:', errId)
      } else if (byId) {
        const url = byId.pdf_url?.trim()
        if (url) {
          console.log('[prospect-pdf] Ya existe PDF para prospecto, omitiendo subida:', byId.id)
          return NextResponse.json({ success: true, pdfUrl: url, skipped: true })
        }
        resolvedRowId = byId.id
      }
    }

    if (!resolvedRowId && prospectEmail) {
      const emailNorm = prospectEmail.toLowerCase().trim()
      const { data: rows, error: pickErr } = await supabaseAdmin
        .from('quote_prospects')
        .select('id, pdf_url')
        .eq('email', emailNorm)
        .order('created_at', { ascending: false })
        .limit(1)

      const latest = rows?.[0]
      if (pickErr) {
        console.error('[prospect-pdf] Error buscando por email:', pickErr)
      } else if (latest) {
        const url = latest.pdf_url?.trim()
        if (url) {
          console.log('[prospect-pdf] Ya existe PDF (último lead por email), omitiendo:', latest.id)
          return NextResponse.json({ success: true, pdfUrl: url, skipped: true })
        }
        resolvedRowId = latest.id
      }
    }

    if (!pdfFile || pdfFile.size === 0) {
      return NextResponse.json(
        { error: 'Archivo PDF requerido' },
        { status: 400 }
      )
    }

    const arrayBuffer = await pdfFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const identifier = resolvedRowId || prospectId || prospectEmail || 'unknown'
    const fileName = `prospect_${identifier}_${Date.now()}.pdf`
    const filePath = `prospect-pdfs/${fileName}`

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('bookings')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('[prospect-pdf] Error subiendo a Storage:', uploadError)
      return NextResponse.json(
        { error: 'Error al subir el PDF' },
        { status: 500 }
      )
    }

    const { data: urlData } = supabaseAdmin
      .storage
      .from('bookings')
      .getPublicUrl(filePath)

    const pdfUrl = urlData.publicUrl
    console.log('[prospect-pdf] PDF subido, URL:', pdfUrl)

    const updatePayload = {
      pdf_url: pdfUrl,
      pdf_generated_at: new Date().toISOString(),
    }

    if (resolvedRowId) {
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('quote_prospects')
        .update(updatePayload)
        .eq('id', resolvedRowId)
        .select('id')

      if (!updErr && updated && updated.length > 0) {
        console.log('[prospect-pdf] Prospecto actualizado:', updated[0].id)
        return NextResponse.json({ success: true, pdfUrl })
      }
      console.error('[prospect-pdf] Error actualizando fila resuelta:', updErr)
    }

    if (prospectId) {
      const { data: byId, error: errById } = await supabaseAdmin
        .from('quote_prospects')
        .update(updatePayload)
        .eq('id', prospectId)
        .select('id')

      if (!errById && byId && byId.length > 0) {
        console.log('[prospect-pdf] Prospecto actualizado por ID (fallback):', byId[0].id)
        return NextResponse.json({ success: true, pdfUrl })
      }
      console.warn('[prospect-pdf] No se encontró por ID, intentando por email...')
    }

    if (prospectEmail) {
      const emailNorm = prospectEmail.toLowerCase().trim()
      const { data: latestRows, error: pickErr } = await supabaseAdmin
        .from('quote_prospects')
        .select('id')
        .eq('email', emailNorm)
        .order('created_at', { ascending: false })
        .limit(1)

      const latestId = latestRows?.[0]?.id
      if (!pickErr && latestId) {
        const { data: byEmail, error: errByEmail } = await supabaseAdmin
          .from('quote_prospects')
          .update(updatePayload)
          .eq('id', latestId)
          .select('id')

        if (!errByEmail && byEmail && byEmail.length > 0) {
          console.log('[prospect-pdf] Prospecto actualizado por email:', byEmail[0].id)
          return NextResponse.json({ success: true, pdfUrl })
        }
        console.error('[prospect-pdf] Error actualizando por id derivado del email:', errByEmail)
      } else if (pickErr) {
        console.error('[prospect-pdf] Error buscando prospecto por email:', pickErr)
      }
    }

    console.error('[prospect-pdf] No se pudo vincular el PDF a ningún prospecto')
    return NextResponse.json({ success: true, pdfUrl, warning: 'PDF subido pero no vinculado' })
  } catch (error) {
    console.error('[prospect-pdf] Exception:', error)
    return NextResponse.json(
      { error: 'Error al procesar el PDF' },
      { status: 500 }
    )
  }
}
