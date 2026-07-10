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

  const { data: empresa } = await supabase
    .from('empresas')
    .select('nome, cor_destaque, logo_url')
    .eq('slug', slug)
    .single()

  const nomeApp = empresa
    ? `${empresa.nome} - Transfer`
    : 'RotaGenda - Transfer'

  const shortName = empresa
    ? empresa.nome.split(' ')[0].substring(0, 12)
    : 'Transfer'

  const themeColor = empresa?.cor_destaque || '#1D9E75'

  const manifest = {
    name: nomeApp,
    short_name: shortName,
    description: empresa
      ? `Solicite seu transfer com ${empresa.nome}`
      : 'Solicitação de transfer',
    start_url: `/transfer/${slug}`,
    scope: `/transfer/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f0f0ec',
    theme_color: themeColor,
    icons: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
