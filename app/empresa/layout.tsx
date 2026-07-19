'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import OneSignalInit from '@/components/OneSignalInit'

const navItems = [
  { href: '/empresa', label: 'Painel', emoji: '⌂' },
  { href: '/empresa/agendamentos', label: 'Agendamentos', emoji: '📋' },
  { href: '/empresa/motoristas', label: 'Motoristas', emoji: '🚗' },
  { href: '/empresa/financeiro', label: 'Financeiro', emoji: '💰' },
  { href: '/empresa/rotas', label: 'Rotas', emoji: '🛣️' },
  { href: '/empresa/configuracoes', label: 'Config.', emoji: '⚙' },
]

const PLANO_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', fleet: 'Fleet', business: 'Business' }
const STATUS_LABEL: Record<string, string> = { trial: 'Trial', ativo: 'Ativo', inativo: 'Inativo' }

export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checando, setChecando] = useState(true)
  const [menuPerfil, setMenuPerfil] = useState(false)
  const [gestorUserId, setGestorUserId] = useState<string | null>(null)
  const [nomeGestor, setNomeGestor] = useState('')
  const [emailGestor, setEmailGestor] = useState('')
  const [planoEmpresa, setPlanoEmpresa] = useState('')
  const [statusEmpresa, setStatusEmpresa] = useState('')
  const [trialExpirado, setTrialExpirado] = useState(false)
  const [tipoOperacao, setTipoOperacao] = useState('')

  useEffect(() => {
    verificarGestor()
  }, [])

  async function verificarGestor() {
    if (pathname === '/empresa/registro') { setChecando(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }

    const { data: gestor } = await supabase
      .from('gestores')
      .select('id, nome, email, empresa_id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) { router.push('/'); return }

    setGestorUserId(session.user.id)
    setNomeGestor(gestor.nome || '')
    setEmailGestor(gestor.email || session.user.email || '')

    const { data: empresa } = await supabase
      .from('empresas')
      .select('plano, status, trial_fim, tipo_operacao')
      .eq('id', gestor.empresa_id)
      .single()

    if (empresa) {
      setPlanoEmpresa(empresa.plano || '')
      setStatusEmpresa(empresa.status || '')
      setTipoOperacao(empresa.tipo_operacao || '')
      const agora = new Date()
      const ativa =
        empresa.status === 'ativo' ||
        (empresa.status === 'trial' && !!empresa.trial_fim && new Date(empresa.trial_fim) > agora)
      if (!ativa) setTrialExpirado(true)
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

  if (pathname === '/empresa/registro') {
    return <div className="min-h-dvh" style={{ background: '#f0f0ec' }}>{children}</div>
  }

  if (checando) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#f0f0ec' }}>
        <div className="animate-pulse">
          <svg width="64" height="64" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
            <rect width="192" height="192" rx="42" fill="#04342C"/>
            <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
            <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
            <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
            <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    )
  }

  if (trialExpirado) {
    return <TelaTrialExpirado onSair={sair} />
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#f0f0ec' }}>
      {gestorUserId && <OneSignalInit motoristaId={gestorUserId} />}
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
        <div className="grid grid-cols-6 max-w-lg mx-auto">
          {navItems.map((item) => {
  const href = item.href === '/empresa/agendamentos' && tipoOperacao !== 'rota_fixa'
    ? '/empresa/agendamentos/fretamentos'
    : item.href
  const ativo = item.href === '/empresa/agendamentos'
    ? pathname.startsWith('/empresa/agendamentos')
    : pathname === item.href
  return (
    <Link key={item.href} href={href}
      className="flex flex-col items-center py-2 pb-3 gap-0.5 transition-colors"
      style={{ color: ativo ? '#0F6E56' : '#aaa' }}>
      <span className="text-lg leading-none">{item.emoji}</span>
      <span className="text-[9px] font-medium">
        {item.href === '/empresa/agendamentos' && tipoOperacao !== 'rota_fixa' ? 'Corridas' : item.label}
      </span>
    </Link>
  )
})}
        </div>
      </nav>
    </div>
  )
}

// Planos por período — mesmo modelo simplificado do /empresa/registro:
// todo mundo tem acesso completo, a única diferença é o período de pagamento.
// Reflete o pricing atual: mensal R$127, semestral R$97/mês, anual R$77/mês.
const PLANOS_TRIAL = [
  {
    id: 'mensal' as const,
    nome: 'Mensal',
    preco: 127,
    precoLabel: '/mês',
    subtitulo: 'Pague mês a mês, sem compromisso',
    destaque: false,
    badge: null as string | null,
    badgeStyle: undefined as { bg: string; text: string } | undefined,
    kiwifyUrl: 'https://pay.kiwify.com.br/EsShhQI',
  },
  {
    id: 'anual' as const,
    nome: 'Anual',
    preco: 924,
    precoLabel: '/ano',
    subtitulo: 'equivale a R$ 77/mês · economia de 39%',
    destaque: true,
    badge: 'MAIS ESCOLHIDO' as string | null,
    badgeStyle: { bg: '#FAC775', text: '#7C3E00' } as { bg: string; text: string } | undefined,
    kiwifyUrl: 'https://pay.kiwify.com.br/9VEuUrk',
  },
  {
    id: 'semestral' as const,
    nome: 'Semestral',
    preco: 582,
    precoLabel: '/semestre',
    subtitulo: 'equivale a R$ 97/mês · economia de 24%',
    destaque: false,
    badge: 'MELHOR CUSTO-BENEFÍCIO' as string | null,
    badgeStyle: { bg: '#E1F5EE', text: '#085041' } as { bg: string; text: string } | undefined,
    kiwifyUrl: 'https://pay.kiwify.com.br/B7F8FFO',
  },
]

const BENEFICIOS_TRIAL = [
  'Motoristas ilimitados',
  'Acesso completo a todos os recursos',
  'Rotas fixas e transfer/turismo',
  'Agenda e controle financeiro',
  'Suporte incluso',
]

function waAssinar(nomePlano: string) {
  const msg = encodeURIComponent(`Olá Rogério, quero assinar o plano ${nomePlano} do RotaGenda Empresarial`)
  return `https://wa.me/5595984143839?text=${msg}`
}

function TelaTrialExpirado({ onSair }: { onSair: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-5">
        <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Trial encerrado</p>
        <p style={{ color: '#9FE1CB' }} className="text-xs mt-0.5">RotaGenda Empresarial</p>
      </div>

      <div className="px-4 py-5 flex flex-col gap-4 flex-1">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
          <p className="text-4xl mb-3">⏰</p>
          <p className="text-base font-bold text-gray-800 mb-2">Período de avaliação encerrado</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            Seu trial de 10 dias chegou ao fim. Assine um plano para continuar
            usando o RotaGenda Empresarial com todos os seus dados preservados.
          </p>
        </div>

        {/* Benefícios (mesma lista pra qualquer período) */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Todos os planos incluem</p>
          {BENEFICIOS_TRIAL.map((b, i) => (
            <p key={i} className="text-sm text-gray-700 mb-1">✅ {b}</p>
          ))}
        </div>

        {/* Cards de plano — só varia o período */}
        <div className="flex flex-col gap-2">
          {PLANOS_TRIAL.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border overflow-hidden"
              style={{ borderColor: p.destaque ? '#0F6E56' : '#e5e7eb' }}>
              {p.badge && (
                <div className="py-1 text-center text-xs font-bold"
                  style={{ background: p.badgeStyle?.bg || '#0F6E56', color: p.badgeStyle?.text || '#E1F5EE' }}>
                  ⭐ {p.badge}
                </div>
              )}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800">{p.nome}</p>
                  <p className="text-xs text-gray-400 leading-snug mt-0.5">{p.subtitulo}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold leading-none" style={{ color: '#0F6E56' }}>
                      R$ {p.preco}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.precoLabel}</p>
                  </div>
                  <a href={p.kiwifyUrl} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                    style={{ background: p.destaque ? '#0F6E56' : '#1D9E75', color: '#fff' }}>
                    Assinar
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
          <span className="text-xl flex-shrink-0">💬</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700">Dúvidas sobre os planos?</p>
            <p className="text-xs text-gray-400">Fale com a gente pelo WhatsApp</p>
          </div>
          <a href={waAssinar('empresarial')} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
            style={{ background: '#E1F5EE', color: '#0F6E56' }}>
            Contato
          </a>
        </div>

        <button onClick={onSair} className="text-sm text-gray-400 text-center py-2">
          Sair da conta
        </button>
      </div>
    </div>
  )
}
