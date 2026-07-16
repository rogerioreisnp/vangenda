import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Notifica o motorista funcionário quando o gestor atribui uma corrida
// a ele. Push notification via OneSignal, filtrado pela tag
// motorista_id = user.id do motorista.
export async function POST(req: NextRequest) {
  const {
    motoristas_empresa_id,
    corrida_id,
    origem,
    destino,
    data_hora,
    tipo_servico,
  } = await req.json()

  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_API_KEY

  if (!appId || !apiKey) {
    return NextResponse.json({ error: 'OneSignal não configurado' }, { status: 500 })
  }
  if (!motoristas_empresa_id) {
    return NextResponse.json({ error: 'motoristas_empresa_id obrigatório' }, { status: 400 })
  }

  // Resolve user_id do motorista a partir do id em motoristas_empresa.
  // Usa service_role pra bypass do RLS (a API é chamada pelo gestor).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: motEmp } = await supabase
    .from('motoristas_empresa')
    .select('user_id, nome')
    .eq('id', motoristas_empresa_id)
    .maybeSingle()

  if (!motEmp?.user_id) {
    return NextResponse.json({ error: 'Motorista sem user_id (não tem login)' }, { status: 400 })
  }

  const primeiroNome = (motEmp.nome || '').split(' ')[0] || 'motorista'
  const dataFmt = data_hora
    ? new Date(data_hora).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : ''
  const rotula = tipo_servico === 'diaria' ? 'Diária'
    : tipo_servico === 'city_tour' ? 'City tour'
    : 'Corrida'
  const body = `${rotula} atribuída: ${origem || '...'} → ${destino || '...'}${dataFmt ? ` · ${dataFmt}` : ''}`
  const url = corrida_id
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://vangenda.vercel.app'}/motorista/corrida/${corrida_id}`
    : `${process.env.NEXT_PUBLIC_APP_URL || 'https://vangenda.vercel.app'}/motorista`

  const payload = {
    app_id: appId,
    filters: [
      { field: 'tag', key: 'motorista_id', relation: '=', value: motEmp.user_id },
    ],
    headings: { pt: `🚗 Olá ${primeiroNome}, nova corrida!`, en: 'New ride assigned' },
    contents: { pt: body, en: body },
    url,
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
  console.log('[notificar-motorista]', {
    corrida_id,
    motoristas_empresa_id,
    tag_target: motEmp.user_id,
    status: response.status,
    onesignal: data,
  })
  return NextResponse.json({ ...data, _target: 'motorista', _tag_value: motEmp.user_id })
}
