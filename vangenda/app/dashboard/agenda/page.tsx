'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, addMonths, subMonths, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Agendamento = {
  id: string
  nome_passageiro: string
  parada_origem: string
  parada_destino: string
  turno: 'ida' | 'volta'
  valor: number
  status: 'agendado' | 'confirmado' | 'cancelado'
  data_viagem: string
  telefone_passageiro?: string
}

export default function AgendaPage() {
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [rotas, setRotas] = useState<any[]>([])

  useEffect(() => { carregarMes() }, [mesAtual])

  async function carregarMes() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const inicio = format(startOfMonth(mesAtual), 'yyyy-MM-dd')
    const fim = format(endOfMonth(mesAtual), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('motorista_id', user.id)
      .gte('data_viagem', inicio)
      .lte('data_viagem', fim)
      .neq('status', 'cancelado')

    if (data) setAgendamentos(data)

    const { data: rts } = await supabase.from('rotas').select('*').eq('motorista_id', user.id).eq('ativa', true)
    if (rts) setRotas(rts)

    setLoading(false)
  }

  // Dias do calendário
  const inicioSemana = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 })
  const fimSemana = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 })
  const dias = eachDayOfInterval({ start: inicioSemana, end: fimSemana })

  const agsDoDia = agendamentos.filter(a => a.data_viagem === format(diaSelecionado, 'yyyy-MM-dd'))
  const ida = agsDoDia.filter(a => a.turno === 'ida')
  const volta = agsDoDia.filter(a => a.turno === 'volta')

  const diasComAgs = new Set(agendamentos.map(a => a.data_viagem))

  const amanha = new Date(); amanha.setDate(hoje.getDate() + 1)
  const isAmanha = isSameDay(diaSelecionado, amanha)

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-0">
        <p style={{ color: '#E1F5EE' }} className="text-base font-semibold mb-1">Agenda</p>
        <p style={{ color: '#5DCAA5' }} className="text-xs mb-3">Toque em um dia para ver os passageiros</p>

        {/* Navegação do mês */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMesAtual(m => subMonths(m, 1))}
            style={{ background: '#085041', color: '#9FE1CB' }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold">‹</button>
          <span style={{ color: '#E1F5EE' }} className="text-sm font-semibold capitalize">
            {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={() => setMesAtual(m => addMonths(m, 1))}
            style={{ background: '#085041', color: '#9FE1CB' }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold">›</button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 mb-1">
          {['D','S','T','Q','Q','S','S'].map((d, i) => (
            <div key={i} style={{ color: '#5DCAA5' }} className="text-[10px] text-center pb-1">{d}</div>
          ))}
        </div>

        {/* Grid de dias */}
        <div className="grid grid-cols-7 gap-0.5 pb-3">
          {dias.map((dia, i) => {
            const chave = format(dia, 'yyyy-MM-dd')
            const temAgs = diasComAgs.has(chave)
            const isHoje = isSameDay(dia, hoje)
            const isSel = isSameDay(dia, diaSelecionado)
            const isOutro = !isSameMonth(dia, mesAtual)
            return (
              <button key={i} onClick={() => setDiaSelecionado(dia)}
                className="h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors"
                style={{
                  background: isSel ? '#E1F5EE' : isHoje ? '#085041' : 'transparent',
                  opacity: isOutro ? 0.3 : 1,
                }}>
                <span className="text-xs leading-none font-medium"
                  style={{ color: isSel ? '#085041' : '#E1F5EE' }}>
                  {dia.getDate()}
                </span>
                {temAgs && (
                  <div className="w-1 h-1 rounded-full"
                    style={{ background: isSel ? '#1D9E75' : '#9FE1CB' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo do dia */}
      <div className="px-4 py-4">
        {isAmanha && (
          <div style={{ background: '#FAEEDA', borderColor: '#FAC775' }}
            className="border rounded-xl p-3 flex gap-3 mb-4">
            <span className="text-lg">🔔</span>
            <p style={{ color: '#633806' }} className="text-xs leading-relaxed">
              <strong>Amanhã:</strong> {agsDoDia.length} passageiro{agsDoDia.length !== 1 ? 's' : ''}. Ligue para confirmar antes de sair!
            </p>
          </div>
        )}

        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-gray-800 capitalize">
            {format(diaSelecionado, "EEEE, dd 'de' MMM", { locale: ptBR })}
          </p>
          {agsDoDia.length > 0 && (
            <span className="text-xs text-gray-400">{agsDoDia.length} passageiro{agsDoDia.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-6">Carregando...</p>
        ) : agsDoDia.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400 text-sm">Nenhum passageiro neste dia</p>
          </div>
        ) : (
          <>
            {ida.length > 0 && (
              <BlocoTurno turno="ida" horario="05:00h" passageiros={ida} onAtualizar={carregarMes} />
            )}
            {volta.length > 0 && (
              <BlocoTurno turno="volta" horario="14:00h" passageiros={volta} onAtualizar={carregarMes} />
            )}
          </>
        )}

        <button onClick={() => setMostrarForm(true)}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold mt-3 flex items-center justify-center gap-2"
          style={{ background: '#1D9E75' }}>
          + Agendar passageiro neste dia
        </button>
      </div>

      {/* Modal de agendamento */}
      {mostrarForm && (
        <FormAgendamento
          data={diaSelecionado}
          rotas={rotas}
          onFechar={() => setMostrarForm(false)}
          onSalvo={() => { setMostrarForm(false); carregarMes() }}
        />
      )}
    </div>
  )
}

function BlocoTurno({ turno, horario, passageiros, onAtualizar }: {
  turno: 'ida' | 'volta', horario: string, passageiros: Agendamento[], onAtualizar: () => void
}) {
  const sub = passageiros.reduce((s, a) => s + a.valor, 0)
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {turno === 'ida' ? 'Ida' : 'Volta'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
            style={turno === 'ida'
              ? { background: '#E1F5EE', color: '#0F6E56' }
              : { background: '#FAEEDA', color: '#854F0B' }}>
            {horario}
          </span>
        </div>
        <span className="text-xs text-gray-400">R$ {sub.toFixed(0)}</span>
      </div>
      {passageiros.map(p => <CardPassageiro key={p.id} p={p} onAtualizar={onAtualizar} />)}
    </div>
  )
}

function CardPassageiro({ p, onAtualizar }: { p: Agendamento, onAtualizar: () => void }) {
  const iniciais = p.nome_passageiro.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const cores = ['#E1F5EE|#0F6E56', '#FAEEDA|#854F0B', '#E6F1FB|#185FA5', '#EEEDFE|#534AB7']
  const cor = cores[p.nome_passageiro.charCodeAt(0) % cores.length].split('|')

  async function confirmar() {
    await supabase.from('agendamentos').update({ status: 'confirmado' }).eq('id', p.id)
    onAtualizar()
  }
  async function cancelar() {
    if (!confirm('Cancelar este agendamento?')) return
    await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', p.id)
    onAtualizar()
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 mb-2">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: cor[0], color: cor[1] }}>{iniciais}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{p.nome_passageiro}</p>
          <p className="text-xs text-gray-400">{p.parada_origem} → {p.parada_destino}</p>
          {p.telefone_passageiro && (
            <p className="text-xs text-gray-400">{p.telefone_passageiro}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold" style={{ color: '#1D9E75' }}>R$ {p.valor.toFixed(0)}</p>
          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
            style={p.status === 'confirmado'
              ? { background: '#E1F5EE', color: '#0F6E56' }
              : { background: '#f0f0f0', color: '#888' }}>
            {p.status === 'confirmado' ? 'Confirmado' : 'Agendado'}
          </span>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        {p.status !== 'confirmado' && (
          <button onClick={confirmar}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: '#E1F5EE', color: '#0F6E56' }}>✓ Confirmar</button>
        )}
        {p.telefone_passageiro && (
          <a href={`tel:${p.telefone_passageiro}`}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium text-center"
            style={{ background: '#f0f0f0', color: '#555' }}>📞 Ligar</a>
        )}
        <button onClick={cancelar}
          className="py-1.5 px-3 rounded-lg text-xs font-medium"
          style={{ background: '#FCEBEB', color: '#A32D2D' }}>Cancelar</button>
      </div>
    </div>
  )
}

function FormAgendamento({ data, rotas, onFechar, onSalvo }: {
  data: Date, rotas: any[], onFechar: () => void, onSalvo: () => void
}) {
  const [paradas, setParadas] = useState<any[]>([])
  const [precos, setPrecos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [form, setForm] = useState({
    rota_id: rotas[0]?.id || '',
    nome_passageiro: '',
    telefone_passageiro: '',
    parada_origem: '',
    parada_destino: '',
    turno: 'ida',
    valor: '',
    forma_pagamento: 'dinheiro',
  })
  const [valorAuto, setValorAuto] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [filtroCliente, setFiltroCliente] = useState('')

  useEffect(() => {
    if (form.rota_id) carregarRota(form.rota_id)
    carregarClientes()
  }, [form.rota_id])

  useEffect(() => {
    if (form.parada_origem && form.parada_destino) calcularValor()
  }, [form.parada_origem, form.parada_destino])

  async function carregarRota(rotaId: string) {
    const { data: pars } = await supabase.from('paradas').select('*').eq('rota_id', rotaId).order('ordem')
    const { data: prs } = await supabase.from('precos').select('*').eq('rota_id', rotaId)
    if (pars) setParadas(pars)
    if (prs) setPrecos(prs)
  }

  async function carregarClientes() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('clientes').select('*').eq('motorista_id', user!.id).order('nome')
    if (data) setClientes(data)
  }

  function calcularValor() {
    const preco = precos.find(p => p.parada_origem === form.parada_origem && p.parada_destino === form.parada_destino)
    if (preco) {
      setValorAuto(preco.valor)
      setForm(f => ({ ...f, valor: String(preco.valor) }))
    } else {
      setValorAuto(null)
    }
  }

  function selecionarCliente(c: any) {
    setForm(f => ({
      ...f,
      nome_passageiro: c.nome,
      telefone_passageiro: c.telefone || '',
      parada_origem: c.parada_origem_frequente || '',
      parada_destino: c.parada_destino_frequente || '',
    }))
    setFiltroCliente('')
  }

  async function salvar() {
    if (!form.nome_passageiro || !form.parada_origem || !form.parada_destino || !form.valor) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('agendamentos').insert({
      ...form,
      motorista_id: user!.id,
      data_viagem: format(data, 'yyyy-MM-dd'),
      valor: parseFloat(form.valor),
    })
    setSaving(false)
    onSalvo()
  }

  const clientesFiltrados = filtroCliente.length >= 2
    ? clientes.filter(c => c.nome.toLowerCase().includes(filtroCliente.toLowerCase()))
    : []

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      {/* Topbar */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Novo passageiro</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs capitalize">
            {format(data, "EEEE, dd 'de' MMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {/* Rota */}
        {rotas.length > 1 && (
          <Campo label="Rota">
            <select value={form.rota_id} onChange={e => setForm(f => ({ ...f, rota_id: e.target.value }))}
              className="campo-input">
              {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </Campo>
        )}

        {/* Nome */}
        <Campo label="Nome do passageiro">
          <input value={filtroCliente || form.nome_passageiro}
            onChange={e => { setFiltroCliente(e.target.value); setForm(f => ({ ...f, nome_passageiro: e.target.value })) }}
            placeholder="Digite o nome..." className="campo-input" />
          {clientesFiltrados.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mt-1">
              {clientesFiltrados.slice(0, 4).map(c => (
                <button key={c.id} onClick={() => selecionarCliente(c)}
                  className="w-full text-left px-3 py-2.5 flex gap-2 items-center border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">{c.nome}</span>
                  <span className="text-xs text-gray-400 ml-auto">{c.parada_origem_frequente} → {c.parada_destino_frequente}</span>
                </button>
              ))}
            </div>
          )}
        </Campo>

        {/* Telefone */}
        <Campo label="Telefone">
          <input value={form.telefone_passageiro} onChange={e => setForm(f => ({ ...f, telefone_passageiro: e.target.value }))}
            placeholder="(95) 99999-9999" type="tel" className="campo-input" />
        </Campo>

        {/* Turno */}
        <Campo label="Turno">
          <div className="grid grid-cols-2 gap-2">
            {(['ida', 'volta'] as const).map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, turno: t }))}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={form.turno === t
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                {t === 'ida' ? '↑ Ida (05:00h)' : '↓ Volta (14:00h)'}
              </button>
            ))}
          </div>
        </Campo>

        {/* Trecho */}
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Embarca em">
            <select value={form.parada_origem} onChange={e => setForm(f => ({ ...f, parada_origem: e.target.value }))}
              className="campo-input">
              <option value="">Selecione...</option>
              {paradas.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Desembarca em">
            <select value={form.parada_destino} onChange={e => setForm(f => ({ ...f, parada_destino: e.target.value }))}
              className="campo-input">
              <option value="">Selecione...</option>
              {paradas.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
            </select>
          </Campo>
        </div>

        {/* Valor */}
        <Campo label={valorAuto ? '✓ Valor automático da tabela' : 'Valor da passagem'}>
          <div className="flex gap-2">
            <span className="flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-white text-gray-400 text-sm">R$</span>
            <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              type="number" step="0.01" placeholder="0,00"
              className="campo-input rounded-l-none"
              style={{ borderColor: valorAuto ? '#9FE1CB' : undefined, background: valorAuto ? '#E1F5EE' : '#fff' }} />
          </div>
        </Campo>

        {/* Pagamento */}
        <Campo label="Forma de pagamento">
          <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
            className="campo-input">
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="cartao">Cartão</option>
            <option value="pendente">A cobrar na viagem</option>
          </select>
        </Campo>
      </div>

      {/* Botão salvar */}
      <div className="px-4 py-4 bg-white border-t border-gray-100">
        <button onClick={salvar} disabled={saving || !form.nome_passageiro || !form.parada_origem || !form.parada_destino || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : '✓ Salvar passageiro'}
        </button>
      </div>

      <style jsx>{`
        .campo-input {
          width: 100%; padding: 10px 12px; border-radius: 12px;
          border: 1px solid #e5e7eb; font-size: 14px; color: #222;
          background: #fff; outline: none;
        }
        .campo-input:focus { border-color: #1D9E75; }
      `}</style>
    </div>
  )
}

function Campo({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  )
}
