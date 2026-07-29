import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RotaGenda',
  description: 'RotaGenda: Gestão de agendamentos, passagens e finanças para vans, táxis, transfers e operadores de turismo',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RotaGenda',
  },
  icons: {
    icon: [
      { url: '/favicon-16.svg', sizes: '16x16', type: 'image/svg+xml' },
      { url: '/favicon-32.svg', sizes: '32x32', type: 'image/svg+xml' },
    ],
    apple: '/icon-192.svg',
  },
}

// width/initialScale precisam ser explicitos: ao exportar `viewport` com
// so themeColor, o Next.js deixa de gerar a tag <meta name="viewport"> padrao
// (width=device-width, initial-scale=1), fazendo o navegador mobile abrir
// com zoom/escala arbitraria — o app parecia "destabilizado" ao entrar ou
// trocar de tela (relato AAJP Transportes 2026-07-29).
export const viewport: Viewport = {
  themeColor: '#04342C',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
