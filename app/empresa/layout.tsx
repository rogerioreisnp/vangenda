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
  const [menuPerfil, setMenuPerfil] = useState(false)
  const [nomeGestor, setNomeGestor] = useState('')
  const [emailGestor, setEmailGestor] = useState('')

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
      .select('id, nome, email')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) {
      router.push('/')
      return
    }

    setNomeGestor(gestor.nome || '')
    setEmailGestor(gestor.email || session.user.email || '')
    setChecando(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
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

      {/* Backdrop do menu de perfil */}
      {menuPerfil && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuPerfil(false)}
        />
      )}

      {/* Dropdown de perfil — aparece acima do botão Perfil */}
      {menuPerfil && (
        <div
          className="fixed right-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          style={{ bottom: '70px', minWidth: '220px' }}
        >
          {/* Cabeçalho do perfil */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: '#0F6E56' }}
              >
                {nomeGestor ? nomeGestor[0].toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{nomeGestor}</p>
                <p className="text-xs text-gray-400 truncate">{emailGestor}</p>
              </div>
            </div>
          </div>

          {/* Opções */}
          <Link
            href="/empresa/configuracoes"
            onClick={() => setMenuPerfil(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 border-b border-gray-50"
            style={{ background: '#fff' }}
          >
            <span className="text-base">✏️</span>
            Editar perfil
          </Link>

          <button
            onClick={sair}
            className="flex items-center gap-3 px-4 py-3 text-sm font-semibold w-full text-left"
            style={{ color: '#DC2626', background: '#fff' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-50">
        <div className="grid grid-cols-6 max-w-lg mx-auto">
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

          {/* Botão de perfil */}
          <button
            onClick={() => setMenuPerfil(v => !v)}
            className="flex flex-col items-center py-2 pb-3 gap-0.5 transition-colors"
            style={{ color: menuPerfil ? '#0F6E56' : '#aaa' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <span className="text-[9px] font-medium">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
