'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

export default function DashboardPage() {
  const hoje = new Date()
  const amanha = new Date(); amanha.setDate(hoje.getDate() + 1)
  const hojeStr = format(hoje, 'yyyy-MM-dd')
  const amanhaStr = format(amanha, 'yyyy-MM-dd')

  const [motorista, setMotorista] = useState<{ nome: string } | null>(null)
  const [passageirosHoje, setPassageirosHoje] = useState(0)
  const [receitaHoje, setReceitaHoje] = useState(0)
  const [capacidade, setCapacidade] = useState(0)
  const [temAmanha, setTemAmanha] = useState(false)
  const [qtdAmanha, setQtdAmanha] = useState(0)
  const [encomendasPendentes, setEncomendasPendentes] = useState(0)
  const [receitaMes, setReceitaMes] = useState(0)
  const [despesasMes, setDespesasMes] = useState(0)
  const [fiados, setFiados] = useState<{ count: number; total: number; temVencido: boolean } | null>(null)

  const hora = hoje.getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const diaSemana = format(hoje, "EEE, dd 'de' MMM", { locale: ptBR })
  const mesAtual = format(hoje, "MMMM 'de' yyyy", { locale: ptBR })

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(hoje), 'yyyy-MM-dd')

    const [
      { data: mot },
      { data: rot },
      { data: agsHoje },
      { data: agsAmanha },
      { data: recs },
      { data: desps },
      { data: agsMes },
      { data: fiadosAbertos },
    ] = await Promise.all([
      supabase.from('motoristas').select('nome').eq('id', user.id).single(),
      supabase.from('rotas').select('capacidade').eq('motorista_id', user.id).limit(1).single(),
      supabase.from('agendamentos').select('valor').eq('motorista_id', user.id).eq('data_viagem', hojeStr).neq('status', 'cancelado'),
      supabase.from('agendamentos').select('id').eq('motorista_id', user.id).eq('data_viagem', amanhaStr).neq('status', 'cancelado'),
      supabase.from('receitas').select('valor').eq('motorista_id', user.id).gte('data_receita', inicioMes).lte('data_receita', fimMes),
      supabase.from('despesas').select('valor').eq('motorista_id', user.id).gte('data_despesa', inicioMes).lte('data_despesa', fimMes),
      supabase.from('agendamentos').select('valor').eq('motorista_id', user.id).neq('status', 'cancelado').gte('data_viagem', inicioMes).lte('data_viagem', fimMes),
      supabase.from('agendamentos').select('valor, fiado_data_combinada').eq('motorista_id', user.id).eq('forma_pagamento', 'fiado').neq('fiado_pago', true).neq('status', 'cancelado'),
    ])

    if (mot) setMotorista(mot)
    if (rot) setCapacidade(rot.capacidade || 0)

    const totalHoje = agsHoje?.reduce((s, a) => s + (a.valor || 0), 0) || 0
    setPassageirosHoje(agsHoje?.length || 0)
    setReceitaHoje(totalHoje)

    setQtdAmanha(agsAmanha?.length || 0)
    setTemAmanha((agsAmanha?.length || 0) > 0)

    const { data: encAbertos } = await supabase
      .from('encomendas').select('id').eq('motorista_id', user.id).neq('pago', true)
    setEncomendasPendentes(encAbertos?.length || 0)

    const totalRecs = (recs?.reduce((s, r) => s + (r.valor || 0), 0) || 0)
                    + (agsMes?.reduce((s, a) => s + (a.valor || 0), 0) || 0)
    const totalDesps = desps?.reduce((s, d) => s + (d.valor || 0), 0) || 0
    setReceitaMes(totalRecs)
    setDespesasMes(totalDesps)

    if (fiadosAbertos && fiadosAbertos.length > 0) {
      const total = fiadosAbertos.reduce((s, f) => s + (f.valor || 0), 0)
      const temVencido = fiadosAbertos.some(f =>
        f.fiado_data_combinada && new Date(f.fiado_data_combinada + 'T23:59:59') < hoje
      )
      setFiados({ count: fiadosAbertos.length, total, temVencido })
    }
  }

  const saldoMes = receitaMes - despesasMes
  const vagasRestantes = capacidade > 0 ? Math.max(0, capacidade - passageirosHoje) : null
  const ocupacao = capacidade > 0 ? Math.min((passageirosHoje / capacidade) * 100, 100) : 0

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-5">
        <div className="flex justify-between items-start">
          <div>
            <p style={{ color: '#9FE1CB' }} className="text-xs">{saudacao},</p>
            <p style={{ color: '#E1F5EE' }} className="text-lg font-bold">
              {motorista?.nome?.split(' ')[0] || '...'}
            </p>
          </div>
          <span style={{ background: '#085041', color: '#5DCAA5' }}
            className="text-xs px-3 py-1.5 rounded-lg capitalize">{diaSemana}</span>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {/* Card Hoje */}
        <Link href="/dashboard/agenda"
          className="bg-white rounded-2xl p-4 block active:opacity-75"
          style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🚐</span>
              <p className="text-sm font-semibold text-gray-700">Hoje</p>
            </div>
            <span className="text-gray-300 text-xs">›</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-2xl font-bold" style={{ color: '#0F6E56' }}>{passageirosHoje}</p>
              <p className="text-xs text-gray-400">passageiro{passageirosHoje !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#0F6E56' }}>
                R$ {receitaHoje.toFixed(0)}
              </p>
              <p className="text-xs text-gray-400">receita esperada</p>
            </div>
          </div>
          {vagasRestantes !== null && (
            <div className="pt-3" style={{ borderTop: '1px solid #f5f5f5' }}>
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-xs text-gray-400">Vagas disponíveis</p>
                <p className="text-xs font-semibold" style={{ color: vagasRestantes === 0 ? '#A32D2D' : '#1D9E75' }}>
                  {vagasRestantes} de {capacidade}
                </p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f0f0ec' }}>
                <div className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${ocupacao}%`,
                    background: ocupacao >= 100 ? '#A32D2D' : ocupacao >= 80 ? '#FAC775' : '#1D9E75'
                  }} />
              </div>
            </div>
          )}
        </Link>

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { emoji: '✅', label: 'Receita', href: '/dashboard/financeiro?modal=receita' },
            { emoji: '⛽', label: 'Despesa', href: '/dashboard/financeiro?modal=despesa' },
            { emoji: '💸', label: 'A receber', href: '/dashboard/financeiro?aba=fiado' },
            { emoji: '📦', label: 'Encomenda', href: '/dashboard/financeiro?aba=encomendas' },
          ].map((item) => (
            <Link key={item.label} href={item.href}
              className="bg-white rounded-2xl flex flex-col items-center justify-center py-5 gap-2 active:opacity-75"
              style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <span className="text-3xl leading-none">{item.emoji}</span>
              <span className="text-base font-semibold text-gray-600">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Card Encomendas — só aparece se houver pendentes */}
        {encomendasPendentes > 0 && (
          <Link href="/dashboard/financeiro"
            className="bg-white rounded-2xl p-4 block active:opacity-75"
            style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: '#FAEEDA' }}>📦</div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Encomendas pendentes</p>
                  <p className="text-xs mt-0.5" style={{ color: '#854F0B' }}>
                    {encomendasPendentes} encomenda{encomendasPendentes !== 1 ? 's' : ''} aguardando pagamento
                  </p>
                </div>
              </div>
              <span className="text-gray-300 text-xs">›</span>
            </div>
          </Link>
        )}

        {/* Card Mês */}
        <Link href="/dashboard/financeiro"
          className="rounded-2xl p-4 block active:opacity-75"
          style={{ background: '#0F6E56', boxShadow: '0 2px 8px rgba(15,110,86,0.25)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📊</span>
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold capitalize">{mesAtual}</p>
            </div>
            <span style={{ color: '#9FE1CB' }} className="text-xs">›</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p style={{ color: '#9FE1CB' }} className="text-[10px] mb-1">Receitas</p>
              <p style={{ color: '#E1F5EE' }} className="text-base font-bold">
                R$ {receitaMes.toFixed(0)}
              </p>
            </div>
            <div>
              <p style={{ color: '#9FE1CB' }} className="text-[10px] mb-1">Despesas</p>
              <p style={{ color: '#FAC775' }} className="text-base font-bold">
                R$ {despesasMes.toFixed(0)}
              </p>
            </div>
            <div>
              <p style={{ color: '#9FE1CB' }} className="text-[10px] mb-1">Saldo</p>
              <p style={{ color: saldoMes >= 0 ? '#E1F5EE' : '#FAC775' }} className="text-base font-bold">
                R$ {saldoMes.toFixed(0)}
              </p>
            </div>
          </div>
        </Link>

        {/* Card Fiado — só aparece se houver em aberto */}
        {fiados && (
          <Link href="/dashboard/financeiro"
            className="rounded-2xl p-4 block active:opacity-75"
            style={{ background: '#FFF5F5', border: '1px solid #FDE8E8', boxShadow: '0 1px 4px rgba(163,45,45,0.08)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: '#FCEBEB' }}>
                  {fiados.temVencido ? '⚠️' : '💸'}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#A32D2D' }}>Fiado em aberto</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fiados.count} lançamento{fiados.count !== 1 ? 's' : ''} · R$ {fiados.total.toFixed(2).replace('.', ',')}
                  </p>
                  {fiados.temVencido && (
                    <p className="text-xs font-semibold mt-1" style={{ color: '#A32D2D' }}>
                      Há valores com data vencida
                    </p>
                  )}
                </div>
              </div>
              <span className="text-gray-300 text-xs">›</span>
            </div>
          </Link>
        )}

        {/* Alerta amanhã */}
        {temAmanha && (
          <div style={{ background: '#FAEEDA', border: '1px solid #FAC775' }}
            className="rounded-xl p-3 flex gap-3">
            <span className="text-lg flex-shrink-0">🔔</span>
            <p style={{ color: '#633806' }} className="text-xs leading-relaxed">
              <strong>Amanhã</strong> você tem {qtdAmanha} passageiro{qtdAmanha > 1 ? 's' : ''} agendado{qtdAmanha > 1 ? 's' : ''}.
              Ligue para confirmar!
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
