'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Contadores = { passageirosHoje: number; corridasAgendadas: number }

export default function AgendamentosHub() {
  const router = useRouter()
  const [empresaNome, setEmpresaNome] = useState('')
  const [contadores, setContadores] = useState<Contadores>({ passageirosHoje: 0, corridasAgendadas: 0 })
  const [loading, setLoading] = useState(true)
  const [podeExibirHub, setPodeExibirHub] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: gestor } = await supabase
        .from('gestores')
        .select('empresa_id, empresas(nome, tipo_operacao)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (gestor?.empresas) {
        const empresa: any = Array.isArray(gestor.empresas) ? gestor.empresas[0] : gestor.empresas
        setEmpresaNome(empresa?.nome || '')
        if (empresa?.tipo_operacao !== 'rota_fixa') {
          router.replace('/empresa/agendamentos/fretamentos')
          return
        }
      }
      setPodeExibirHub(true)
      if (!gestor?.empresa_id) { setLoading(false); return }

      const hoje = new Date().toISOString().slice(0, 10)

      const [{ count: passageirosHoje }, { count: corridas }] = await Promise.all([
        supabase.from('agendamentos').select('id', { count: 'exact', head: true })
          .eq('motorista_id', user.id)
          .eq('data_viagem', hoje)
          .neq('status', 'cancelado'),
        supabase.from('corridas_empresa').select('id', { count: 'exact', head: true })
          .eq('empresa_id', gestor.empresa_id)
          .neq('status', 'cancelada')
          .gte('data_hora', `${hoje}T00:00:00`),
      ])

      setContadores({
        passageirosHoje: passageirosHoje || 0,
        corridasAgendadas: corridas || 0,
      })
      setLoading(false)
    })()
  }, [])

  if (!podeExibirHub) {
    return <div className="min-h-dvh" style={{ background: '#f0f0ec' }} />
  }

  return (
    <div className="min-h-dvh pb-20" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-8 pb-4">
        <p style={{ color: '#9FE1CB' }} className="text-xs">Painel do gestor</p>
        <h1 style={{ color: '#E1F5EE' }} className="text-lg font-bold mt-0.5">Agendamentos</h1>
        {empresaNome && (
          <p style={{ color: '#9FE1CB' }} className="text-xs mt-1">{empresaNome}</p>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3 max-w-lg mx-auto">
        <Link href="/dashboard/agenda"
          className="bg-white rounded-2xl p-4 flex items-center gap-4 active:opacity-75"
          style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: '#E1F5EE' }}>
            📅
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800">Agendamento de passageiros</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              Calendário com passageiros do dia, criar novo agendamento
            </p>
            {!loading && (
              <p className="text-xs mt-1.5 font-semibold" style={{ color: '#0F6E56' }}>
                {contadores.passageirosHoje} agendado{contadores.passageirosHoje !== 1 ? 's' : ''} hoje
              </p>
            )}
          </div>
          <span className="text-gray-300 text-xl">›</span>
        </Link>

        <Link href="/empresa/agendamentos/fretamentos"
          className="bg-white rounded-2xl p-4 flex items-center gap-4 active:opacity-75"
          style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: '#FEF3C7' }}>
            🚌
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800">Fretamentos</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              Corridas contratadas, tabela completa, filtros e busca
            </p>
            {!loading && (
              <p className="text-xs mt-1.5 font-semibold" style={{ color: '#92400E' }}>
                {contadores.corridasAgendadas} corrida{contadores.corridasAgendadas !== 1 ? 's' : ''} agendada{contadores.corridasAgendadas !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <span className="text-gray-300 text-xl">›</span>
        </Link>

        <p className="text-center text-xs text-gray-400 mt-3">
          Escolha qual tipo de agendamento quer gerenciar
        </p>
      </div>
    </div>
  )
}
