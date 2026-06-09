'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, subDays, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Despesa = {
  id: string
  descricao: string
  categoria: string
  valor: number
  data_despesa: string
}

type Receita = {
  id: string
  descricao: string
  categoria: string
  valor: number
  data_receita: string
}

type AgendamentoReceita = {
  valor: number
  data_viagem: string
  nome_passageiro: string
  parada_origem: string
  parada_destino: string
}

type AgendamentoFiado = {
  id: string
  nome_passageiro: string
  telefone_passageiro?: string
  parada_origem: string
  parada_destino: string
  valor: number
  data_viagem: string
  fiado_valor_pago: number
  fiado_data_combinada?: string
}

const categoriasReceita = [
  { value: 'rota_diaria', label: 'Rota diária', emoji: '🚐' },
  { value: 'passagens_avulsas', label: 'Passagens avulsas', emoji: '💵' },
  { value: 'frete_empresarial', label: 'Frete empresarial', emoji: '🏢' },
  { value: 'tour_passeio', label: 'Tour / Passeio', emoji: '🎉' },
  { value: 'entrega', label: 'Entrega', emoji: '📦' },
  { value: 'outros', label: 'Outros', emoji: '➕' },
]

const categoriasDespesa = [
  { value: 'combustivel', label: 'Combustível', emoji: '⛽' },
  { value: 'manutencao', label: 'Manutenção', emoji: '🔧' },
  { value: 'pedagio', label: 'Pedágio', emoji: '🛣️' },
  { value: 'pneu', label: 'Pneu', emoji: '🔄' },
  { value: 'outros', label: 'Outros', emoji: '📦' },
]

type Filtro = 'hoje' | '7dias' | '30dias' | 'mes'
type Aba = 'geral' | 'fiado'

export default function FinanceiroPage() {
  const [aba, setAba] = useState<Aba>('geral')
  const [filtro, setFiltro] = useState<Filtro>('mes')
  const [mes, setMes] = useState(new Date())
  const [receitasManuais, setReceitasManuais] = useState<Receita[]>([])
  const [receitasAgendamentos, setReceitasAgendamentos] = useState<AgendamentoReceita[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | 'receita' | 'despesa'>(null)
  const [editandoReceita, setEditandoReceita] = useState<Receita | null>(null)
  const [editandoDespesa, setEditandoDespesa] = useState<Despesa | null>(null)

  useEffect(() => { if (aba === 'geral') carregarDados() }, [filtro, mes, aba])

  function getPeriodo() {
    const hoje = new Date()
    if (filtro === 'hoje') return { inicio: format(startOfDay(hoje), 'yyyy-MM-dd'), fim: format(endOfDay(hoje), 'yyyy-MM-dd') }
    if (filtro === '7dias') return { inicio: format(subDays(hoje, 6), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') }
    if (filtro === '30dias') return { inicio: format(subDays(hoje, 29), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') }
    return { inicio: format(startOfMonth(mes), 'yyyy-MM-dd'), fim: format(endOfMonth(mes), 'yyyy-MM-dd') }
  }

  async function carregarDados() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { inicio, fim } = getPeriodo()

    const [{ data: recs }, { data: desps }, { data: agends }] = await Promise.all([
      supabase.from('receitas').select('*').eq('motorista_id', user.id)
        .gte('data_receita', inicio).lte('data_receita', fim).order('data_receita', { ascending: false }),
      supabase.from('despesas').select('*').eq('motorista_id', user.id)
        .gte('data_despesa', inicio).lte('data_despesa', fim).order('data_despesa', { ascending: false }),
      supabase.from('agendamentos').select('valor, data_viagem, nome_passageiro, parada_origem, parada_destino')
        .eq('motorista_id', user.id).neq('status', 'cancelado')
        .gte('data_viagem', inicio).lte('data_viagem', fim),
    ])

    if (recs) setReceitasManuais(recs)
    if (desps) setDespesas(desps)
    if (agends) setReceitasAgendamentos(agends)
    setLoading(false)
  }

  async function excluirReceita(id: string) {
    if (!confirm('Excluir esta receita?')) return
    const { error } = await supabase.from('receitas').delete().eq('id', id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    carregarDados()
  }

  async function excluirDespesa(id: string) {
    if (!confirm('Excluir esta despesa?')) return
    const { error } = await supabase.from('despesas').delete().eq('id', id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    carregarDados()
  }

  const totalReceitasManuais = receitasManuais.reduce((s, r) => s + r.valor, 0)
  const totalReceitasAgendamentos = receitasAgendamentos.reduce((s, r) => s + r.valor, 0)
  const totalReceitas = totalReceitasManuais + totalReceitasAgendamentos
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  const lucro = totalReceitas - totalDespesas

  const despPorCategoria = categoriasDespesa.map(c => ({
    ...c,
    total: despesas.filter(d => d.categoria === c.value).reduce((s, d) => s + d.valor, 0)
  })).filter(c => c.total > 0)

  const recPorCategoria = categoriasReceita.map(c => ({
    ...c,
    total: receitasManuais.filter(r => r.categoria === c.value).reduce((s, r) => s + r.valor, 0)
  })).filter(c => c.total > 0)

  const filtros: { key: Filtro, label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: '7dias', label: '7 dias' },
    { key: '30dias', label: '30 dias' },
    { key: 'mes', label: 'Mês' },
  ]

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Financeiro</p>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #085041' }}>
            <button onClick={() => setAba('geral')}
              className="px-4 py-1.5 text-xs font-semibold transition-all"
              style={aba === 'geral'
                ? { background: '#E1F5EE', color: '#0F6E56' }
                : { background: '#085041', color: '#9FE1CB' }}>
              Visão Geral
            </button>
            <button onClick={() => setAba('fiado')}
              className="px-4 py-1.5 text-xs font-semibold transition-all"
              style={aba === 'fiado'
                ? { background: '#E1F5EE', color: '#0F6E56' }
                : { background: '#085041', color: '#9FE1CB' }}>
              Fiado
            </button>
          </div>
        </div>

        {aba === 'geral' && (
          <>
            <div className="flex gap-2 mb-4">
              {filtros.map(f => (
                <button key={f.key} onClick={() => setFiltro(f.key)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={filtro === f.key
                    ? { background: '#E1F5EE', color: '#0F6E56' }
                    : { background: '#085041', color: '#9FE1CB' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {filtro === 'mes' && (
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setMes(m => subMonths(m, 1))}
                  style={{ background: '#085041', color: '#9FE1CB' }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold">‹</button>
                <span style={{ color: '#E1F5EE' }} className="text-sm font-semibold capitalize">
                  {format(mes, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button onClick={() => setMes(m => addMonths(m, 1))}
                  style={{ background: '#085041', color: '#9FE1CB' }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold">›</button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div style={{ background: '#085041' }} className="rounded-xl p-3">
                <p style={{ color: '#5DCAA5' }} className="text-[10px]">Receitas</p>
                <p style={{ color: '#E1F5EE' }} className="text-base font-bold mt-0.5">R$ {totalReceitas.toFixed(0)}</p>
              </div>
              <div style={{ background: '#085041' }} className="rounded-xl p-3">
                <p style={{ color: '#5DCAA5' }} className="text-[10px]">Despesas</p>
                <p style={{ color: '#FAC775' }} className="text-base font-bold mt-0.5">R$ {totalDespesas.toFixed(0)}</p>
              </div>
              <div style={{ background: lucro >= 0 ? '#085041' : '#6B1A1A' }} className="rounded-xl p-3">
                <p style={{ color: '#5DCAA5' }} className="text-[10px]">Lucro</p>
                <p style={{ color: lucro >= 0 ? '#E1F5EE' : '#FAC775' }} className="text-base font-bold mt-0.5">R$ {lucro.toFixed(0)}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {aba === 'fiado' ? (
        <AbaFiado />
      ) : (
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button onClick={() => setModal('receita')}
              className="py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: '#E1F5EE', color: '#0F6E56' }}>
              <span className="text-lg">💰</span> + Receita
            </button>
            <button onClick={() => setModal('despesa')}
              className="py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: '#FAEEDA', color: '#854F0B' }}>
              <span className="text-lg">🧾</span> + Despesa
            </button>
          </div>

          {loading ? (
            <p className="text-center text-gray-400 text-sm py-10">Carregando...</p>
          ) : (
            <>
              {recPorCategoria.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Receitas por categoria</p>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {recPorCategoria.map((c, i) => {
                      const pct = totalReceitasManuais > 0 ? (c.total / totalReceitasManuais) * 100 : 0
                      return (
                        <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0">
                          <div className="flex items-center mb-1.5">
                            <span className="text-lg mr-2">{c.emoji}</span>
                            <span className="flex-1 text-sm text-gray-700">{c.label}</span>
                            <span className="text-sm font-semibold" style={{ color: '#0F6E56' }}>R$ {c.total.toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: '#f0f0ec' }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: '#1D9E75' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {despPorCategoria.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Despesas por categoria</p>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {despPorCategoria.map((c, i) => {
                      const pct = totalDespesas > 0 ? (c.total / totalDespesas) * 100 : 0
                      return (
                        <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0">
                          <div className="flex items-center mb-1.5">
                            <span className="text-lg mr-2">{c.emoji}</span>
                            <span className="flex-1 text-sm text-gray-700">{c.label}</span>
                            <span className="text-sm font-semibold" style={{ color: '#854F0B' }}>R$ {c.total.toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: '#f0f0ec' }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: '#FAC775' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Receitas lançadas</p>
                {receitasManuais.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">Nenhuma receita lançada</div>
                ) : (
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {receitasManuais.map((r) => {
                      const cat = categoriasReceita.find(c => c.value === r.categoria)
                      return (
                        <div key={r.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2">
                          <span className="text-xl mr-1">{cat?.emoji || '💵'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{cat?.label || r.descricao}</p>
                            <p className="text-xs text-gray-400">{r.descricao} · {format(new Date(r.data_receita + 'T00:00:00'), "dd/MM/yyyy")}</p>
                          </div>
                          <span className="text-sm font-semibold shrink-0" style={{ color: '#0F6E56' }}>+ R$ {r.valor.toFixed(2).replace('.', ',')}</span>
                          <button
                            onClick={() => setEditandoReceita(r)}
                            className="p-1.5 rounded-lg shrink-0"
                            style={{ background: '#E1F5EE', color: '#0F6E56' }}
                            title="Editar">
                            ✏️
                          </button>
                          <button
                            onClick={() => excluirReceita(r.id)}
                            className="p-1.5 rounded-lg shrink-0"
                            style={{ background: '#FDE8E8', color: '#A32D2D' }}
                            title="Excluir">
                            🗑️
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {receitasAgendamentos.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Receitas via agendamento</p>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {receitasAgendamentos.slice(0, 10).map((r, i) => (
                      <div key={i} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
                        <span className="text-xl mr-3">🚐</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{r.nome_passageiro}</p>
                          <p className="text-xs text-gray-400">{r.parada_origem} → {r.parada_destino} · {format(new Date(r.data_viagem + 'T00:00:00'), 'dd/MM')}</p>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: '#0F6E56' }}>+ R$ {r.valor.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                    {receitasAgendamentos.length > 10 && (
                      <p className="text-center text-xs text-gray-400 py-2">+ {receitasAgendamentos.length - 10} registros</p>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Despesas</p>
                {despesas.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">Nenhuma despesa registrada</div>
                ) : (
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {despesas.map((d) => {
                      const cat = categoriasDespesa.find(c => c.value === d.categoria)
                      return (
                        <div key={d.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2">
                          <span className="text-xl mr-1">{cat?.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{d.descricao}</p>
                            <p className="text-xs text-gray-400">{format(new Date(d.data_despesa + 'T00:00:00'), "dd/MM/yyyy")}</p>
                          </div>
                          <span className="text-sm font-semibold shrink-0" style={{ color: '#A32D2D' }}>- R$ {d.valor.toFixed(2).replace('.', ',')}</span>
                          <button
                            onClick={() => setEditandoDespesa(d)}
                            className="p-1.5 rounded-lg shrink-0"
                            style={{ background: '#E1F5EE', color: '#0F6E56' }}
                            title="Editar">
                            ✏️
                          </button>
                          <button
                            onClick={() => excluirDespesa(d.id)}
                            className="p-1.5 rounded-lg shrink-0"
                            style={{ background: '#FDE8E8', color: '#A32D2D' }}
                            title="Excluir">
                            🗑️
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {totalReceitas > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resumo do período</p>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Despesas {Math.round((totalDespesas / totalReceitas) * 100)}%</span>
                    <span>Lucro {Math.round((lucro / totalReceitas) * 100)}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden flex" style={{ background: '#f0f0ec' }}>
                    <div className="h-3 transition-all" style={{ width: `${Math.min((totalDespesas / totalReceitas) * 100, 100)}%`, background: '#FAC775' }} />
                    <div className="h-3 transition-all" style={{ width: `${Math.max((lucro / totalReceitas) * 100, 0)}%`, background: '#1D9E75' }} />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs" style={{ color: '#854F0B' }}>R$ {totalDespesas.toFixed(2).replace('.', ',')}</span>
                    <span className="text-xs font-bold" style={{ color: lucro >= 0 ? '#0F6E56' : '#A32D2D' }}>R$ {lucro.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              )}

              <div className="h-24" />
            </>
          )}
        </div>
      )}

      {modal === 'receita' && (
        <FormReceita
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); carregarDados() }}
        />
      )}

      {modal === 'despesa' && (
        <FormDespesa
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); carregarDados() }}
        />
      )}

      {editandoReceita && (
        <FormReceita
          receita={editandoReceita}
          onFechar={() => setEditandoReceita(null)}
          onSalvo={() => { setEditandoReceita(null); carregarDados() }}
        />
      )}

      {editandoDespesa && (
        <FormDespesa
          despesa={editandoDespesa}
          onFechar={() => setEditandoDespesa(null)}
          onSalvo={() => { setEditandoDespesa(null); carregarDados() }}
        />
      )}
    </div>
  )
}

// ─── ABA FIADO ────────────────────────────────────────────────────────────────

function AbaFiado() {
  const [loading, setLoading] = useState(true)
  const [fiados, setFiados] = useState<AgendamentoFiado[]>([])
  const [modalViagem, setModalViagem] = useState<AgendamentoFiado | null>(null)

  useEffect(() => { carregarFiados() }, [])

  async function carregarFiados() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('agendamentos')
      .select('id, nome_passageiro, telefone_passageiro, parada_origem, parada_destino, valor, data_viagem, fiado_valor_pago, fiado_data_combinada')
      .eq('motorista_id', user.id)
      .eq('forma_pagamento', 'fiado')
      .neq('fiado_pago', true)
      .neq('status', 'cancelado')
      .order('data_viagem', { ascending: false })
    if (data) setFiados(data)
    setLoading(false)
  }

  const devedoresMap = fiados.reduce((acc, f) => {
    const key = f.nome_passageiro
    if (!acc[key]) acc[key] = { nome: f.nome_passageiro, telefone: f.telefone_passageiro, total: 0, viagens: [] }
    const saldo = f.valor - (f.fiado_valor_pago || 0)
    acc[key].total += saldo
    acc[key].viagens.push(f)
    return acc
  }, {} as Record<string, { nome: string; telefone?: string; total: number; viagens: AgendamentoFiado[] }>)

  const devedores = Object.values(devedoresMap).sort((a, b) => b.total - a.total)
  const totalGeral = devedores.reduce((s, d) => s + d.total, 0)

  if (loading) return <p className="text-center text-gray-400 text-sm py-10">Carregando...</p>

  return (
    <div className="px-4 py-4">
      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total em aberto</p>
        <p className="text-2xl font-bold" style={{ color: '#A32D2D' }}>
          R$ {totalGeral.toFixed(2).replace('.', ',')}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {fiados.length} viagem{fiados.length !== 1 ? 's' : ''} · {devedores.length} devedor{devedores.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {devedores.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-gray-600 font-medium text-sm">Nenhum fiado em aberto</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {devedores.map(devedor => (
            <div key={devedor.nome} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ background: '#FFF5F5', borderBottom: '1px solid #FDE8E8' }}>
                <div>
                  <p className="text-sm font-bold text-gray-800">{devedor.nome}</p>
                  {devedor.telefone && (
                    <p className="text-xs text-gray-400">{devedor.telefone}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase">Total devido</p>
                  <p className="text-base font-bold" style={{ color: '#A32D2D' }}>
                    R$ {devedor.total.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>

              {devedor.viagens.map(v => {
                const saldo = v.valor - (v.fiado_valor_pago || 0)
                return (
                  <div key={v.id} className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400">
                        {format(new Date(v.data_viagem + 'T00:00:00'), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-sm text-gray-700">{v.parada_origem} → {v.parada_destino}</p>
                      {(v.fiado_valor_pago || 0) > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: '#854F0B' }}>
                          Parcial: R$ {(v.fiado_valor_pago || 0).toFixed(2).replace('.', ',')} pago
                        </p>
                      )}
                      {v.fiado_data_combinada && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Combina: {format(new Date(v.fiado_data_combinada + 'T00:00:00'), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>
                        R$ {saldo.toFixed(2).replace('.', ',')}
                      </p>
                      <button
                        onClick={() => setModalViagem(v)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium mt-1"
                        style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                        Dar baixa
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div className="h-24" />

      {modalViagem && (
        <ModalDarBaixa
          viagem={modalViagem}
          onFechar={() => setModalViagem(null)}
          onSalvo={() => { setModalViagem(null); carregarFiados() }}
        />
      )}
    </div>
  )
}

// ─── MODAL DAR BAIXA ──────────────────────────────────────────────────────────

function ModalDarBaixa({ viagem, onFechar, onSalvo }: {
  viagem: AgendamentoFiado
  onFechar: () => void
  onSalvo: () => void
}) {
  const saldoRestante = viagem.valor - (viagem.fiado_valor_pago || 0)
  const [valorRecebido, setValorRecebido] = useState(saldoRestante.toFixed(2))
  const [dataCombinada, setDataCombinada] = useState(viagem.fiado_data_combinada || '')
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [saving, setSaving] = useState(false)

  const vr = parseFloat(valorRecebido) || 0
  const isTotal = vr >= saldoRestante - 0.001
  const novoSaldo = Math.max(0, saldoRestante - vr)

  async function confirmar() {
    if (!vr || vr <= 0) return
    setSaving(true)
    const novoPago = (viagem.fiado_valor_pago || 0) + vr
    const updates: Record<string, unknown> = {
      fiado_valor_pago: parseFloat(Math.min(novoPago, viagem.valor).toFixed(2)),
      fiado_forma_pagamento: formaPagamento,
    }
    if (isTotal) {
      updates.fiado_pago = true
    } else if (dataCombinada) {
      updates.fiado_data_combinada = dataCombinada
    }
    await supabase.from('agendamentos').update(updates).eq('id', viagem.id)
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Dar baixa no fiado</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="rounded-xl p-3" style={{ background: '#f0f0ec' }}>
          <p className="text-xs text-gray-500 mb-0.5">{viagem.nome_passageiro}</p>
          <p className="text-sm text-gray-700">
            {viagem.parada_origem} → {viagem.parada_destino} · {format(new Date(viagem.data_viagem + 'T00:00:00'), 'dd/MM/yyyy')}
          </p>
          <p className="text-sm font-bold mt-1" style={{ color: '#A32D2D' }}>
            Saldo em aberto: R$ {saldoRestante.toFixed(2).replace('.', ',')}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor recebido (R$)</p>
          <input
            type="number" step="0.01" value={valorRecebido}
            onChange={e => setValorRecebido(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {vr > 0 && !isTotal && (
          <div className="border rounded-xl px-4 py-3"
            style={{ background: '#FAEEDA', borderColor: '#FAC775' }}>
            <p className="text-xs" style={{ color: '#854F0B' }}>
              Pagando R$ {vr.toFixed(2).replace('.', ',')} — ainda ficará devendo R$ {novoSaldo.toFixed(2).replace('.', ',')}
            </p>
          </div>
        )}

        {vr > 0 && !isTotal && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Data combinada para pagar o restante (opcional)</p>
            <input
              type="date" value={dataCombinada}
              onChange={e => setDataCombinada(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Forma de recebimento</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'dinheiro', label: '💵 Dinheiro' },
              { value: 'pix', label: '📱 Pix' },
            ] as const).map(f => (
              <button key={f.value} onClick={() => setFormaPagamento(f.value)}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={formaPagamento === f.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {vr > 0 && isTotal && (
          <div className="border rounded-xl px-4 py-3"
            style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
            <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>
              ✓ Quitação total — fiado será marcado como pago
            </p>
          </div>
        )}

        <button onClick={confirmar} disabled={saving || vr <= 0}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving
            ? 'Salvando...'
            : isTotal
            ? '✓ Confirmar quitação'
            : '✓ Registrar pagamento parcial'}
        </button>
      </div>
    </div>
  )
}

// ─── FORM RECEITA ─────────────────────────────────────────────────────────────

function FormReceita({
  receita,
  onFechar,
  onSalvo,
}: {
  receita?: Receita
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({
    categoria: receita?.categoria ?? 'rota_diaria',
    descricao: receita?.descricao ?? '',
    valor: receita?.valor?.toString() ?? '',
    data_receita: receita?.data_receita ?? format(new Date(), 'yyyy-MM-dd'),
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!form.valor) return
    setSaving(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Usuário não autenticado.'); setSaving(false); return }

    const cat = categoriasReceita.find(c => c.value === form.categoria)
    const payload = {
      motorista_id: user.id,
      categoria: form.categoria,
      descricao: form.descricao || cat?.label || '',
      valor: parseFloat(form.valor),
      data_receita: form.data_receita,
    }

    let error
    if (receita) {
      ;({ error } = await supabase.from('receitas').update(payload).eq('id', receita.id))
    } else {
      ;({ error } = await supabase.from('receitas').insert(payload))
    }

    if (error) {
      console.error('Erro receita:', error)
      setErro('Erro ao salvar: ' + error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
          {receita ? 'Editar receita' : 'Lançar receita'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Tipo de receita</p>
          <div className="grid grid-cols-3 gap-2">
            {categoriasReceita.map(c => (
              <button key={c.value} onClick={() => setForm(f => ({ ...f, categoria: c.value }))}
                className="py-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition-all"
                style={form.categoria === c.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                <span className="text-lg">{c.emoji}</span>
                <span className="text-center leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Observação (opcional)</p>
          <input value={form.descricao}
            onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
            type="text" placeholder="Ex: empresa tal, grupo de amigos..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor (R$)</p>
          <input value={form.valor}
            onChange={e => setForm(prev => ({ ...prev, valor: e.target.value }))}
            type="number" placeholder="0,00"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Data</p>
          <input value={form.data_receita}
            onChange={e => setForm(prev => ({ ...prev, data_receita: e.target.value }))}
            type="date"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}
      </div>

      <div className="px-4 pb-16 pt-4 bg-white border-t border-gray-100">
        <button onClick={salvar} disabled={saving || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : receita ? '✓ Atualizar receita' : '💰 Salvar receita'}
        </button>
      </div>
    </div>
  )
}

// ─── FORM DESPESA ─────────────────────────────────────────────────────────────

function FormDespesa({
  despesa,
  onFechar,
  onSalvo,
}: {
  despesa?: Despesa
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({
    descricao: despesa?.descricao ?? '',
    categoria: despesa?.categoria ?? 'combustivel',
    valor: despesa?.valor?.toString() ?? '',
    data_despesa: despesa?.data_despesa ?? format(new Date(), 'yyyy-MM-dd'),
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!form.descricao || !form.valor) return
    setSaving(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Usuário não autenticado.'); setSaving(false); return }

    const payload = {
      motorista_id: user.id,
      descricao: form.descricao,
      categoria: form.categoria,
      valor: parseFloat(form.valor),
      data_despesa: form.data_despesa,
    }

    let error
    if (despesa) {
      ;({ error } = await supabase.from('despesas').update(payload).eq('id', despesa.id))
    } else {
      ;({ error } = await supabase.from('despesas').insert(payload))
    }

    if (error) {
      console.error('Erro despesa:', error)
      setErro('Erro ao salvar: ' + error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
          {despesa ? 'Editar despesa' : 'Nova despesa'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Categoria</p>
          <div className="grid grid-cols-3 gap-2">
            {categoriasDespesa.map(c => (
              <button key={c.value} onClick={() => setForm(f => ({ ...f, categoria: c.value }))}
                className="py-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition-all"
                style={form.categoria === c.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                <span className="text-lg">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {[
          { label: 'Descrição', key: 'descricao', type: 'text', placeholder: 'Ex: Abastecimento posto BR' },
          { label: 'Valor (R$)', key: 'valor', type: 'number', placeholder: '0,00' },
          { label: 'Data', key: 'data_despesa', type: 'date', placeholder: '' },
        ].map(f => (
          <div key={f.key}>
            <p className="text-xs font-medium text-gray-500 mb-1">{f.label}</p>
            <input value={(form as any)[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              type={f.type} placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        ))}

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}
      </div>

      <div className="px-4 pb-16 pt-4 bg-white border-t border-gray-100">
        <button onClick={salvar} disabled={saving || !form.descricao || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : despesa ? '✓ Atualizar despesa' : '✓ Salvar despesa'}
        </button>
      </div>
    </div>
  )
}
