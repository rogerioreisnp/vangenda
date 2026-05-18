import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VanGenda',
  description: 'Sistema de agendamento para motoristas de van',
  manifest: '/manifest.json',
  themeColor: '#0F6E56',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
