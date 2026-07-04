import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { motorista_id, empresa_id, gestor_id: gestor_id_direto, nome_cliente, nome_passageiro, origem, destino, data_viagem, turno } = await req.json()

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

  // Notificação para empresarial (gestor)
  if (gestor_id) {
    const nome = nome_cliente || nome_passageiro || 'Cliente'
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        filters: [
          { field: 'tag', key: 'motorista_id', relation: '=', value: gestor_id }
        ],
        headings: { pt: '🚗 Nova solicitação!' },
        contents: {
          pt: `${nome} solicitou: ${origem} → ${destino}`
        },
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://vangenda.vercel.app'}/empresa/agendamentos/fretamentos`,
      }),
    })
    const data = await response.json()
    return NextResponse.json(data)
  }

  // Notificação para individual (motorista)
  const turnoTexto = turno === 'ida' ? 'Ida' : 'Volta'
  const dataFormatada = data_viagem
    ? new Date(data_viagem + 'T00:00:00').toLocaleDateString('pt-BR')
    : ''

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      filters: [
        { field: 'tag', key: 'motorista_id', relation: '=', value: motorista_id }
      ],
      headings: { pt: '📅 Novo agendamento!' },
      contents: {
        pt: `${nome_passageiro} agendou ${origem} → ${destino} — ${turnoTexto} ${dataFormatada}`
      },
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://vangenda.vercel.app'}/dashboard/agenda`,
    }),
  })

  const data = await response.json()
  return NextResponse.json(data)
}
