'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import OneSignalInit from '@/components/OneSignalInit'

const NAV_ITEMS_TODOS = [
  { href: '/dashboard', label: 'Início', emoji: '⌂' },
  { href: '/dashboard/agenda', label: 'Agenda', emoji: '📅' },
  { href: '/dashboard/financeiro', label: 'Finanças', emoji: '💰', ocultarFuncionario: true },
  { href: '/dashboard/configuracoes', label: 'Config.', emoji: '⚙' },
]

type PlanoAssinatura = {
  id: string
  label: string
  preco: string
  periodo?: string
  precoVista?: string
  economia?: string
  badge?: string
  destaque: boolean
  kiwifyUrl: string
}

const PLANOS: PlanoAssinatura[] = [
  {
    id: 'mensal',
    label: 'Mensal',
    preco: 'R$ 49,90',
    periodo: '/mês',
    destaque: false,
    kiwifyUrl: 'https://pay.kiwify.com.br/XcKd7Q0',
  },
  {
    id: 'semestral',
    label: 'Semestral',
    preco: '6x de R$ 46,88',
    precoVista: 'ou R$ 249,90 à vista',
    economia: 'Economia de 30%',
    destaque: false,
    kiwifyUrl: 'https://pay.kiwify.com.br/CFhm0yy',
  },
  {
    id: 'anual',
    label: 'Anual',
    preco: '12x de R$ 37,11',
    precoVista: 'ou R$ 358,80 à vista',
    economia: 'Economia de 50%',
    badge: '⭐ Melhor custo-benefício',
    destaque: true,
    kiwifyUrl: 'https://pay.kiwify.com.br/js8Xv89',
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checando, setChecando] = useState(true)
  const [statusAcesso, setStatusAcesso] = useState<'ok' | 'aviso' | 'bloqueado' | 'bloqueado_empresa'>('ok')
  const [diasRestantes, setDiasRestantes] = useState(0)
  const [motoristaId, setMotoristaId] = useState<string | null>(null)
  const [isEmpresaUser, setIsEmpresaUser] = useState(false)
  // isFuncionario = motorista de empresa (funcionario). Gestor e individual = false.
  const [isFuncionario, setIsFuncionario] = useState(false)
  // Código de afiliado da Kiwify capturado no cadastro (?afid=) — usado pra
  // montar o link de pagamento na tela de bloqueio. Ver
  // supabase/migrations/afiliados_kiwify.sql.
  const [afidMotorista, setAfidMotorista] = useState<string | null>(null)

  useEffect(() => {
    verificarAcesso()
  }, [router])

  // Funcionario nao pode acessar /dashboard/financeiro - redirecionar pra home
  useEffect(() => {
    if (isFuncionario && pathname === '/dashboard/financeiro') {
      router.replace('/dashboard')
    }
  }, [isFuncionario, pathname, router])

  // Realtime só se aplica a motoristas individuais
  useEffect(() => {
    if (!motoristaId || isEmpresaUser) return

    const channel = supabase
      .channel(`assinatura-${motoristaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'motoristas',
          filter: `id=eq.${motoristaId}`,
        },
        (payload) => {
          const novo = payload.new as { assinatura_status: string; assinatura_expira: string }
          if (novo.assinatura_status === 'ativo') {
            const expira = new Date(novo.assinatura_expira)
            if (expira > new Date()) {
              setStatusAcesso('ok')
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [motoristaId, isEmpresaUser])

  function checarAcessoEmpresa(empresa: { status: string; trial_fim: string | null } | null) {
    if (!empresa) {
      console.warn('[acesso] empresa não encontrada — bloqueando')
      setStatusAcesso('bloqueado_empresa')
      setChecando(false)
      return
    }
    const agora = new Date()
    if (empresa.status === 'ativo') {
      console.log('[acesso] empresa ativa — liberando')
      setStatusAcesso('ok')
      setChecando(false)
      return
    }
    if (empresa.status === 'trial' && empresa.trial_fim && new Date(empresa.trial_fim) > agora) {
      console.log('[acesso] empresa em trial válido até', empresa.trial_fim, '— liberando')
      setStatusAcesso('ok')
      setChecando(false)
      return
    }
    console.warn('[acesso] plano da empresa expirado — bloqueando')
    setStatusAcesso('bloqueado_empresa')
    setChecando(false)
  }

  function checarAcessoIndividual(motorista: {
    trial_inicio: string | null
    assinatura_status: string | null
    assinatura_expira: string | null
    criado_em: string | null
  }) {
    console.log('[acesso] dados do motorista individual:', {
      assinatura_status: motorista.assinatura_status,
      assinatura_expira: motorista.assinatura_expira,
      trial_inicio: motorista.trial_inicio,
      criado_em: motorista.criado_em,
    })

    // assinatura_expira = null → tratar como expirado independente do status
    if (!motorista.assinatura_expira) {
      console.warn('[acesso] assinatura_expira null — bloqueando')
      setStatusAcesso('bloqueado')
      setChecando(false)
      return
    }

    if (motorista.assinatura_status === 'ativo') {
      const expira = new Date(motorista.assinatura_expira)
      const agora = new Date()
      console.log('[acesso] status=ativo | expira:', expira.toISOString(), '| expirou?', expira <= agora)
      if (expira > agora) {
        setStatusAcesso('ok')
        setChecando(false)
        return
      }
      console.warn('[acesso] assinatura expirada — bloqueando')
      setStatusAcesso('bloqueado')
      setChecando(false)
      return
    }

    if (motorista.assinatura_status === 'inativo') {
      console.warn('[acesso] status=inativo — bloqueando')
      setStatusAcesso('bloqueado')
      setChecando(false)
      return
    }

    // null / trial / qualquer outro valor → verifica trial
    const referenciaInicio = motorista.trial_inicio ?? motorista.criado_em
    const trialInicio = new Date(referenciaInicio!)
    const agora = new Date()
    const diasUsados = Math.floor((agora.getTime() - trialInicio.getTime()) / (1000 * 60 * 60 * 24))
    const diasRestantesTrial = 10 - diasUsados

    console.log('[acesso] trial | status:', motorista.assinatura_status, '| referência usada:', referenciaInicio,
      '| trialInicio:', trialInicio.toISOString(), '| agora:', agora.toISOString(),
      '| diasUsados:', diasUsados, '| diasRestantes:', diasRestantesTrial)

    if (diasRestantesTrial <= 0) {
      console.warn('[acesso] trial expirado — bloqueando')
      setStatusAcesso('bloqueado')
    } else if (diasRestantesTrial <= 3) {
      setStatusAcesso('aviso')
      setDiasRestantes(diasRestantesTrial)
    } else {
      setStatusAcesso('ok')
      setDiasRestantes(diasRestantesTrial)
    }

    setChecando(false)
  }

  async function verificarAcesso() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }

    const userId = session.user.id
    setMotoristaId(userId)

    // 1) É gestor?
    const { data: gestor } = await supabase
      .from('gestores')
      .select('empresa_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (gestor) {
      console.log('[acesso] usuário é gestor da empresa', gestor.empresa_id)
      setIsEmpresaUser(true)
      const { data: empresa } = await supabase
        .from('empresas')
        .select('status, trial_fim')
        .eq('id', gestor.empresa_id)
        .single()
      checarAcessoEmpresa(empresa)
      return
    }

    // 2) É motorista de empresa?
    const { data: motoristaEmpresa } = await supabase
      .from('motoristas_empresa')
      .select('empresa_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (motoristaEmpresa) {
      console.log('[acesso] usuário é motorista de empresa', motoristaEmpresa.empresa_id)
      setIsEmpresaUser(true)
      setIsFuncionario(true)
      const { data: empresa } = await supabase
        .from('empresas')
        .select('status, trial_fim')
        .eq('id', motoristaEmpresa.empresa_id)
        .single()
      checarAcessoEmpresa(empresa)
      return
    }

    // 3) É motorista individual?
    const { data: motorista } = await supabase
      .from('motoristas')
      .select('trial_inicio, assinatura_status, assinatura_expira, criado_em, afid')
      .eq('id', userId)
      .maybeSingle()

    if (motorista) {
      console.log('[acesso] usuário é motorista individual')
      setAfidMotorista(motorista.afid || null)
      checarAcessoIndividual(motorista)
      return
    }

    // 4) Nenhum vínculo encontrado
    console.warn('[acesso] usuário sem vínculo — bloqueando')
    setStatusAcesso('bloqueado')
    setChecando(false)
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

  if (statusAcesso === 'bloqueado_empresa') {
    return <TelaBloqueioEmpresa />
  }

  if (statusAcesso === 'bloqueado') {
    return <TelaBloqueio afid={afidMotorista} />
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#f0f0ec' }}>
      {motoristaId && <OneSignalInit motoristaId={motoristaId} />}

      {statusAcesso === 'aviso' && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-xs font-semibold"
          style={{ background: '#FAC775', color: '#854F0B' }}>
          ⚠️ Seu período gratuito expira em {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'}!{' '}
          <button
            onClick={() => setStatusAcesso('bloqueado')}
            className="underline font-bold ml-1">
            Assinar agora
          </button>
        </div>
      )}

      <main className={`flex-1 overflow-y-auto pb-20 ${statusAcesso === 'aviso' ? 'pt-8' : ''}`}>
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-50">
        {(() => {
          const navItens = NAV_ITEMS_TODOS.filter(it => !(isFuncionario && it.ocultarFuncionario))
          const gridCols = navItens.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
          return (
            <div className={`grid ${gridCols} max-w-lg mx-auto`}>
              {navItens.map((item) => {
                const ativo = pathname === item.href
                return (
                  <Link key={item.href} href={item.href}
                    className="flex flex-col items-center py-2 pb-3 gap-0.5 transition-colors"
                    style={{ color: ativo ? '#0F6E56' : '#aaa' }}>
                    <span className="text-xl leading-none">{item.emoji}</span>
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )
        })()}
      </nav>
    </div>
  )
}

function TelaBloqueio({ afid = null }: { afid?: string | null }) {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-14 pb-8 text-center">
        <svg width="80" height="80" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="mb-3 mx-auto">
          <rect width="192" height="192" rx="42" fill="#04342C"/>
          <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
          <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
          <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
          <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
        </svg>
        <h1 style={{ color: '#E1F5EE' }} className="text-xl font-bold">RotaGenda</h1>
        <p style={{ color: '#9FE1CB' }} className="text-sm mt-1">Gestão de agendamentos, passagens e finanças para vans, táxis, transfers e operadores de turismo</p>
      </div>

      <div className="px-4 py-6 flex flex-col gap-4 max-w-md mx-auto w-full">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <p className="text-2xl mb-2">⏰</p>
          <p className="text-base font-bold text-gray-800 mb-1">Seu período gratuito encerrou</p>
          <p className="text-sm text-gray-500">Escolha um plano para continuar usando o RotaGenda e não perder seus agendamentos!</p>
        </div>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Escolha seu plano</p>

        {PLANOS.map((plano) => (
          <div key={plano.id}
            className="rounded-2xl p-4 border-2 relative"
            style={{
              background: plano.destaque ? '#0F6E56' : '#fff',
              borderColor: plano.destaque ? '#0F6E56' : '#e5e7eb',
            }}>
            {plano.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                style={{ background: '#FAC775', color: '#854F0B' }}>
                {plano.badge}
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold" style={{ color: plano.destaque ? '#E1F5EE' : '#1a1a1a' }}>
                  {plano.label}
                </p>
                {plano.economia && (
                  <p className="text-xs" style={{ color: plano.destaque ? '#9FE1CB' : '#0F6E56' }}>
                    {plano.economia}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xl font-bold leading-tight" style={{ color: plano.destaque ? '#fff' : '#0F6E56' }}>
                  {plano.preco}
                </p>
                {plano.periodo && (
                  <p className="text-xs" style={{ color: plano.destaque ? '#9FE1CB' : '#888' }}>
                    {plano.periodo}
                  </p>
                )}
                {plano.precoVista && (
                  <p className="text-xs mt-0.5" style={{ color: plano.destaque ? '#9FE1CB' : '#999' }}>
                    {plano.precoVista}
                  </p>
                )}
              </div>
            </div>
            <a href={afid ? `${plano.kiwifyUrl}?afid=${encodeURIComponent(afid)}` : plano.kiwifyUrl}
              target="_blank" rel="noopener noreferrer"
              className="block w-full py-3 rounded-xl text-center text-sm font-bold transition-all"
              style={{
                background: plano.destaque ? '#E1F5EE' : '#0F6E56',
                color: plano.destaque ? '#0F6E56' : '#fff',
              }}>
              Assinar agora →
            </a>
          </div>
        ))}

        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">O que está incluído</p>
          {[
            '✅ Agendamentos ilimitados',
            '✅ Link exclusivo para passageiros',
            '✅ Controle financeiro completo',
            '✅ Pagamento via Pix integrado',
            '✅ Agenda organizada por dia',
          ].map((item, i) => (
            <p key={i} className="text-sm text-gray-700 mb-1.5">{item}</p>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 pb-6">
          Pagamento seguro via Kiwify · Cancele quando quiser
        </p>
      </div>
    </div>
  )
}

function TelaBloqueioEmpresa() {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-14 pb-8 text-center">
        <svg width="80" height="80" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="mb-3 mx-auto">
          <rect width="192" height="192" rx="42" fill="#04342C"/>
          <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
          <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
          <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
          <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
        </svg>
        <h1 style={{ color: '#E1F5EE' }} className="text-xl font-bold">RotaGenda</h1>
        <p style={{ color: '#9FE1CB' }} className="text-sm mt-1">Gestão de agendamentos para sua empresa</p>
      </div>

      <div className="px-4 py-6 flex flex-col gap-4 max-w-md mx-auto w-full">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-base font-bold text-gray-800 mb-1">Acesso suspenso</p>
          <p className="text-sm text-gray-500">
            A assinatura da sua empresa expirou. Entre em contato com o gestor para renovar o plano e recuperar o acesso.
          </p>
        </div>
      </div>
    </div>
  )
}
