import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { motorista_id, nome_passageiro, origem, destino, data_viagem, turno } = await req.json()

  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_API_KEY

  if (!appId || !apiKey) {
    return NextResponse.json({ error: 'OneSignal não configurado' }, { status: 500 })
  }

  const turnoTexto = turno === 'ida' ? 'Ida' : 'Volta'
  const dataFormatada = new Date(data_viagem + 'T00:00:00').toLocaleDateString('pt-BR')

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
      headings: { pt: '🚐 Novo agendamento!' },
      contents: {
        pt: `${nome_passageiro} agendou ${origem} → ${destino} — ${turnoTexto} ${dataFormatada}`
      },
      url: 'https://vangenda.vercel.app/dashboard/agenda',
    }),
  })

  const data = await response.json()
  return NextResponse.json(data)
}
