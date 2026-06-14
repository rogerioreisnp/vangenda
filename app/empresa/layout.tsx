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

const PLANO_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', fleet: 'Fleet' }
const STATUS_LABEL: Record<string, string> = { trial: 'Trial', ativo: 'Ativo', inativo: 'Inativo' }

export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checando, setChecando] = useState(true)
  const [menuPerfil, setMenuPerfil] = useState(false)
  const [nomeGestor, setNomeGestor] = useState('')
  const [emailGestor, setEmailGestor] = useState('')
  const [planoEmpresa, setPlanoEmpresa] = useState('')
  const [statusEmpresa, setStatusEmpresa] = useState('')

  useEffect(() => {
    verificarGestor()
  }, [])

  async function verificarGestor() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }

    const { data: gestor } = await supabase
      .from('gestores')
      .select('id, nome, email, empresa_id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) { router.push('/'); return }

    setNomeGestor(gestor.nome || '')
    setEmailGestor(gestor.email || session.user.email || '')

    const { data: empresa } = await supabase
      .from('empresas')
      .select('plano, status')
      .eq('id', gestor.empresa_id)
      .single()

    if (empresa) {
      setPlanoEmpresa(empresa.plano || '')
      setStatusEmpresa(empresa.status || '')
    }

    setChecando(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const inicial = nomeGestor ? nomeGestor[0].toUpperCase() : '?'

  const badgeStyle = statusEmpresa === 'ativo'
    ? { background: '#E1F5EE', color: '#0F6E56' }
    : statusEmpresa === 'trial'
    ? { background: '#FAEEDA', color: '#854F0B' }
    : { background: '#FEE2E2', color: '#DC2626' }

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

      {/* Avatar fixo no canto superior direito do header verde */}
      <button
        onClick={() => setMenuPerfil(v => !v)}
        className="fixed z-50 flex items-center justify-center rounded-full text-white text-sm font-bold shadow-md"
        style={{
          top: '56px',
          right: '16px',
          width: '36px',
          height: '36px',
          background: menuPerfil ? '#085041' : '#0a5c47',
          border: '2px solid rgba(255,255,255,0.35)',
        }}
      >
        {inicial}
      </button>

      {/* Backdrop */}
      {menuPerfil && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuPerfil(false)} />
      )}

      {/* Dropdown de perfil */}
      {menuPerfil && (
        <div
          className="fixed z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          style={{ top: '100px', right: '12px', minWidth: '230px' }}
        >
          {/* Avatar + nome + email */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: '#0F6E56' }}
              >
                {inicial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{nomeGestor}</p>
                <p className="text-xs text-gray-400 truncate">{emailGestor}</p>
              </div>
            </div>

            {/* Badge do plano */}
            {planoEmpresa && (
              <div className="mt-2.5 flex items-center gap-1.5">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={badgeStyle}
                >
                  {PLANO_LABEL[planoEmpresa] || planoEmpresa}
                </span>
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={badgeStyle}
                >
                  {STATUS_LABEL[statusEmpresa] || statusEmpresa}
                </span>
              </div>
            )}
          </div>

          {/* Editar perfil */}
          <Link
            href="/empresa/configuracoes"
            onClick={() => setMenuPerfil(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 border-b border-gray-50 hover:bg-gray-50 transition-colors"
          >
            <span className="text-base">✏️</span>
            Editar perfil
          </Link>

          {/* Sair */}
          <button
            onClick={sair}
            className="flex items-center gap-3 px-4 py-3 text-sm font-semibold w-full text-left hover:bg-gray-50 transition-colors"
            style={{ color: '#DC2626' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
        </div>
      )}

      {/* Bottom navigation — 5 itens */}
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
