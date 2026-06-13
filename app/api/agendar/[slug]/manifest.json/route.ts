import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: motorista } = await supabase
    .from('motoristas')
    .select('nome')
    .eq('id', slug)
    .single()

  const nomeApp = motorista
    ? `RotaGenda - ${motorista.nome}`
    : 'RotaGenda'

  const shortName = motorista
    ? motorista.nome.split(' ')[0].substring(0, 12)
    : 'RotaGenda'

  const manifest = {
    name: nomeApp,
    short_name: shortName,
    description: motorista
      ? `Agende sua viagem com ${motorista.nome}`
      : 'Agendamento de viagem',
    start_url: `/agendar/${slug}`,
    scope: `/agendar/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f0f0ec',
    theme_color: '#0F6E56',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
