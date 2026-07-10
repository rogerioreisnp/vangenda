import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { motorista_id, empresa_id, gestor_id: gestor_id_direto, nome_cliente, nome_passageiro, origem, destino, data_viagem, turno, teste } = await req.json()

  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_API_KEY

  if (!appId || !apiKey) {
    return NextResponse.json({ error: 'OneSignal não configurado' }, { status: 500 })
  }

  // Resolver gestor_id via empresa_id se não foi passado diretamente
  let gestor_id = gestor_id_direto
  if (!gestor_id && empresa_id) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('gestores')
      .select('user_id')
      .eq('empresa_id', empresa_id)
      .limit(1)
      .single()
    gestor_id = data?.user_id ?? null
  }

  // ── Notificação empresarial (gestor) ────────────────────────────────────────
  if (gestor_id) {
    const nome = nome_cliente || nome_passageiro || 'Cliente'
    const heading = teste ? '🔔 Notificação de teste' : '🚗 Nova solicitação!'
    const body = teste
      ? 'Se você recebeu isso, as notificações do RotaGenda estão ativas ✅'
      : `${nome} solicitou: ${origem} → ${destino}`

    const payload = {
      app_id: appId,
      filters: [
        { field: 'tag', key: 'motorista_id', relation: '=', value: gestor_id }
      ],
      headings: { pt: heading, en: heading },
      contents: { pt: body, en: body },
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://vangenda.vercel.app'}/empresa/agendamentos/fretamentos`,
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log('[notificar-agendamento][empresa]', {
      empresa_id,
      gestor_id,
      status: response.status,
      onesignal: data,
    })
    return NextResponse.json({ ...data, _target: 'gestor', _tag_value: gestor_id })
  }

  // ── Notificação individual (motorista) ──────────────────────────────────────
  const turnoTexto = turno === 'ida' ? 'Ida' : 'Volta'
  const dataFormatada = data_viagem
    ? new Date(data_viagem + 'T00:00:00').toLocaleDateString('pt-BR')
    : ''

  const heading = teste ? '🔔 Notificação de teste' : '📅 Novo agendamento!'
  const body = teste
    ? 'Se você recebeu isso, as notificações do RotaGenda estão ativas ✅'
    : `${nome_passageiro} agendou ${origem} → ${destino} — ${turnoTexto} ${dataFormatada}`

  const payload = {
    app_id: appId,
    filters: [
      { field: 'tag', key: 'motorista_id', relation: '=', value: motorista_id }
    ],
    headings: { pt: heading, en: heading },
    contents: { pt: body, en: body },
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://vangenda.vercel.app'}/dashboard/agenda`,
  }

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  console.log('[notificar-agendamento][individual]', {
    motorista_id,
    status: response.status,
    onesignal: data,
  })
  return NextResponse.json({ ...data, _target: 'motorista', _tag_value: motorista_id })
}
