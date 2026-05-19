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

const categorias = [
  { value: 'combustivel', label: 'Combustível', emoji: '⛽' },
  { value: 'manutencao', label: 'Manutenção', emoji: '🔧' },
  { value: 'pedagio', label: 'Pedágio', emoji: '🛣️' },
  { value: 'pneu', label: 'Pneu', emoji: '🔄' },
  { value: 'outros', label: 'Outros', emoji: '📦' },
]

type Filtro = 'hoje' | '7dias' | '30dias' | 'mes'

export default function FinanceiroPage() {
  const [filtro, setFiltro] = useState<Filtro>('mes')
  const [mes, setMes] = useState(new Date())
  const [receitasManuais, setReceitasManuais] = useState<Receita[]>([])
  const [receitasAgendamentos, setReceitasAgendamentos] = useState<AgendamentoReceita[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | 'receita' | 'despesa'>(null)

  useEffect(() => { carregarDados() }, [filtro, mes])

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

  const totalReceitasManuais = receitasManuais.reduce((s, r) => s + r.valor, 0)
  const totalReceitasAgendamentos = receitasAgendamentos.reduce((s, r) => s + r.valor, 0)
  const totalReceitas = totalReceitasManuais + totalReceitasAgendamentos
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  const lucro = totalReceitas - totalDespesas

  const despPorCategoria = categorias.map(c => ({
    ...c,
    total: despesas.filter(d => d.categoria === c.value).reduce((s, d) => s + d.valor, 0)
  })).filter(c => c.total > 0)

  const filtros: { key: Filtro, label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: '7dias', label: '7 dias' },
    { key: '30dias', label: '30 dias' },
    { key: 'mes', label: 'Mês' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <p style={{ color: '#E1F5EE' }} className="text-base font-semibold mb-3">Financeiro</p>

        {/* Filtros */}
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

        {/* Navegação mês (só aparece no filtro mês) */}
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

        {/* Cards resumo */}
        <div className="grid grid-cols-3 gap-2">
          <div style={{ background: '#085041' }} className="rounded-xl p-3">
            <p style={{ color: '#5DCAA5' }} className="text-[10px]">Receitas</p>
            <p style={{ color: '#E1F5EE' }} className="text-base font-bold mt-0.5">
              R$ {totalReceitas.toFixed(0)}
            </p>
          </div>
          <div style={{ background: '#085041' }} className="rounded-xl p-3">
            <p style={{ color: '#5DCAA5' }} className="text-[10px]">Despesas</p>
            <p style={{ color: '#FAC775' }} className="text-base font-bold mt-0.5">
              R$ {totalDespesas.toFixed(0)}
            </p>
          </div>
          <div style={{ background: lucro >= 0 ? '#085041' : '#6B1A1A' }} className="rounded-xl p-3">
            <p style={{ color: '#5DCAA5' }} className="text-[10px]">Lucro</p>
            <p style={{ color: lucro >= 0 ? '#E1F5EE' : '#FAC775' }} className="text-base font-bold mt-0.5">
              R$ {lucro.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">

        {/* Botões de lançamento */}
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
            {/* Despesas por categoria */}
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
                          <span className="text-sm font-semibold" style={{ color: '#854F0B' }}>
                            R$ {c.total.toFixed(2).replace('.', ',')}
                          </span>
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

            {/* Receitas manuais */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Receitas lançadas</p>
              {receitasManuais.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
                  Nenhuma receita lançada
                </div>
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                  {receitasManuais.map((r, i) => (
                    <div key={r.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
                      <span className="text-xl mr-3">💵</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.descricao}</p>
                        <p className="text-xs text-gray-400">{format(new Date(r.data_receita + 'T00:00:00'), "dd/MM/yyyy")}</p>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: '#0F6E56' }}>
                        + R$ {r.valor.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Receitas de agendamentos Pix */}
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
                      <span className="text-sm font-semibold" style={{ color: '#0F6E56' }}>
                        + R$ {r.valor.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  ))}
                  {receitasAgendamentos.length > 10 && (
                    <p className="text-center text-xs text-gray-400 py-2">+ {receitasAgendamentos.length - 10} registros</p>
                  )}
                </div>
              </div>
            )}

            {/* Despesas */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Despesas</p>
              {despesas.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
                  Nenhuma despesa registrada
                </div>
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                  {despesas.map((d) => {
                    const cat = categorias.find(c => c.value === d.categoria)
                    return (
                      <div key={d.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
                        <span className="text-xl mr-3">{cat?.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{d.descricao}</p>
                          <p className="text-xs text-gray-400">{format(new Date(d.data_despesa + 'T00:00:00'), "dd/MM/yyyy")}</p>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: '#A32D2D' }}>
                          - R$ {d.valor.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Barra de progresso lucro */}
            {totalReceitas > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resumo do período</p>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Despesas {totalReceitas > 0 ? Math.round((totalDespesas / totalReceitas) * 100) : 0}%</span>
                  <span>Lucro {totalReceitas > 0 ? Math.round((lucro / totalReceitas) * 100) : 0}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden flex" style={{ background: '#f0f0ec' }}>
                  <div className="h-3 transition-all" style={{ width: `${Math.min((totalDespesas / totalReceitas) * 100, 100)}%`, background: '#FAC775' }} />
                  <div className="h-3 transition-all" style={{ width: `${Math.max((lucro / totalReceitas) * 100, 0)}%`, background: '#1D9E75' }} />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs" style={{ color: '#854F0B' }}>R$ {totalDespesas.toFixed(2).replace('.', ',')}</span>
                  <span className="text-xs font-bold" style={{ color: lucro >= 0 ? '#0F6E56' : '#A32D2D' }}>
                    R$ {lucro.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Receita */}
      {modal === 'receita' && (
        <FormReceita
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); carregarDados() }}
        />
      )}

      {/* Modal Despesa */}
      {modal === 'despesa' && (
        <FormDespesa
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); carregarDados() }}
        />
      )}
    </div>
  )
}

function FormReceita({ onFechar, onSalvo }: { onFechar: () => void, onSalvo: () => void }) {
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    data_receita: format(new Date(), 'yyyy-MM-dd'),
  })
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!form.descricao || !form.valor) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('receitas').insert({
      motorista_id: user!.id,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      data_receita: form.data_receita,
    })
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Lançar receita</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div style={{ background: '#E1F5EE' }} className="rounded-2xl p-4 flex items-center gap-3">
          <span className="text-3xl">💵</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#085041' }}>Receita manual</p>
            <p className="text-xs" style={{ color: '#0F6E56' }}>Lance o total que você recebeu no dia</p>
          </div>
        </div>

        {[
          { label: 'Descrição', key: 'descricao', type: 'text', placeholder: 'Ex: Faturamento do dia, corrida extra...' },
          { label: 'Valor (R$)', key: 'valor', type: 'number', placeholder: '0,00' },
          { label: 'Data', key: 'data_receita', type: 'date', placeholder: '' },
        ].map(f => (
          <div key={f.key}>
            <p className="text-xs font-medium text-gray-500 mb-1">{f.label}</p>
            <input value={(form as any)[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              type={f.type} placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        ))}
      </div>

      <div className="px-4 py-4 bg-white border-t border-gray-100">
        <button onClick={salvar} disabled={saving || !form.descricao || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : '💰 Salvar receita'}
        </button>
      </div>
    </div>
  )
}

function FormDespesa({ onFechar, onSalvo }: { onFechar: () => void, onSalvo: () => void }) {
  const [form, setForm] = useState({
    descricao: '', categoria: 'combustivel', valor: '',
    data_despesa: format(new Date(), 'yyyy-MM-dd'),
  })
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!form.descricao || !form.valor) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('despesas').insert({
      ...form,
      motorista_id: user!.id,
      valor: parseFloat(form.valor)
    })
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Nova despesa</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Categoria</p>
          <div className="grid grid-cols-3 gap-2">
            {categorias.map(c => (
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
      </div>

      <div className="px-4 py-4 bg-white border-t border-gray-100">
        <button onClick={salvar} disabled={saving || !form.descricao || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : '✓ Salvar despesa'}
        </button>
      </div>
    </div>
  )
}
