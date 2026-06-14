'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/empresa', label: 'Painel', emoji: '⌂' },
  { href: '/empresa/agendamentos', label: 'Corridas', emoji: '📋' },
  { href: '/empresa/motoristas', label: 'Motoristas', emoji: '🚐' },
  { href: '/empresa/rotas', label: 'Rotas', emoji: '🛣️' },
  { href: '/empresa/configuracoes', label: 'Config.', emoji: '⚙' },
]

export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checando, setChecando] = useState(true)

  useEffect(() => {
    verificarGestor()
  }, [])

  async function verificarGestor() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }

    const { data: gestor } = await supabase
      .from('gestores')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) {
      router.push('/')
      return
    }

    setChecando(false)
  }

  if (checando) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#f0f0ec' }}>
        <div className="text-4xl animate-pulse">🚐</div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#f0f0ec' }}>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-50">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {navItems.map((item) => {
            const ativo = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center py-2 pb-3 gap-0.5 transition-colors"
                style={{ color: ativo ? '#0F6E56' : '#aaa' }}>
                <span className="text-lg leading-none">{item.emoji}</span>
                <span className="text-[9px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
