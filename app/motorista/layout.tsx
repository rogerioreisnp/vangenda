'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import OneSignalInit from '@/components/OneSignalInit'

// Rota dedicada pro motorista funcionário de EMPRESA TRANSFER.
// Motorista funcionário do rota_fixa continua em /dashboard (que já tem
// integração com agendamentos rota_fixa). Gestor vai pra /empresa.

const NAV_ITEMS = [
  { href: '/motorista',                label: 'Início', emoji: '⌂' },
  { href: '/motorista/agenda',         label: 'Agenda', emoji: '📅' },
  { href: '/motorista/configuracoes',  label: 'Config.', emoji: '⚙' },
]

type Estado = 'checando' | 'ok' | 'sem_vinculo' | 'empresa_errada' | 'trial_expirado'

export default function MotoristaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [estado, setEstado] = useState<Estado>('checando')
  const [motoristaId, setMotoristaId] = useState<string | null>(null)

  useEffect(() => {
    verificarAcesso()
  }, [])

  async function verificarAcesso() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }

    const uid = session.user.id
    setMotoristaId(uid)

    // Precisa ser motorista de empresa (não gestor, não individual)
    const { data: motEmp } = await supabase
      .from('motoristas_empresa')
      .select('empresa_id, status')
      .eq('user_id', uid)
      .maybeSingle()

    if (!motEmp || motEmp.status !== 'ativo') {
      setEstado('sem_vinculo')
      return
    }

    // Empresa precisa ser transfer/turismo (não rota_fixa)
    const { data: empresa } = await supabase
      .from('empresas')
      .select('tipo_operacao, status, trial_fim')
      .eq('id', motEmp.empresa_id)
      .single()

    if (!empresa) { setEstado('sem_vinculo'); return }

    if (empresa.tipo_operacao === 'rota_fixa') {
      // Motorista rota_fixa continua usando /dashboard
      router.replace('/dashboard')
      return
    }

    // Checa se a empresa tem plano ativo (mesmo padrão de /empresa/layout)
    const agora = new Date()
    const ativa = empresa.status === 'ativo' ||
      (empresa.status === 'trial' && !!empresa.trial_fim && new Date(empresa.trial_fim) > agora)
    if (!ativa) { setEstado('trial_expirado'); return }

    setEstado('ok')
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (estado === 'checando') {
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

  if (estado === 'sem_vinculo') {
    return (
      <TelaMensagem
        titulo="Sem vínculo com empresa"
        texto="Sua conta não está vinculada a nenhuma empresa ativa. Peça ao gestor para te cadastrar como motorista da empresa."
        onSair={sair}
      />
    )
  }

  if (estado === 'trial_expirado') {
    return (
      <TelaMensagem
        titulo="Empresa com plano suspenso"
        texto="O plano da sua empresa expirou. Peça ao gestor para renovar. Assim que ele renovar, você volta a acessar os atendimentos."
        onSair={sair}
      />
    )
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#f0f0ec' }}>
      {motoristaId && <OneSignalInit motoristaId={motoristaId} />}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-50">
        <div className="grid grid-cols-3 max-w-lg mx-auto">
          {NAV_ITEMS.map(item => {
            const ativo = pathname === item.href ||
              (item.href !== '/motorista' && pathname.startsWith(item.href))
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
      </nav>
    </div>
  )
}

function TelaMensagem({ titulo, texto, onSair }: { titulo: string; texto: string; onSair: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-14 pb-6 text-center">
        <svg width="64" height="64" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-3">
          <rect width="192" height="192" rx="42" fill="#04342C"/>
          <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
        </svg>
        <h1 style={{ color: '#E1F5EE' }} className="text-lg font-bold">{titulo}</h1>
      </div>
      <div className="flex-1 px-4 py-6 flex flex-col gap-4 max-w-md mx-auto w-full">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">{texto}</p>
        </div>
        <button onClick={onSair}
          className="text-sm text-gray-400 py-2">
          Sair da conta
        </button>
      </div>
    </div>
  )
}
