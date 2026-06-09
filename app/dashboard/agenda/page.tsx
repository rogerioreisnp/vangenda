'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'
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
  forma_pagamento?: string
  rua?: string
  numero?: string
  bairro?: string
  municipio?: string
  cep?: string
  referencia?: string
}

export default function AgendaPage() {
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [rotas, setRotas] = useState<any[]>([])
  const [agendamentoDetalhe, setAgendamentoDetalhe] = useState<Agendamento | null>(null)

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
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-0">
        <p style={{ color: '#E1F5EE' }} className="text-base font-semibold mb-1">Agenda</p>
        <p style={{ color: '#5DCAA5' }} className="text-xs mb-3">Toque em um dia para ver os passageiros</p>

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

        <div className="grid grid-cols-7 mb-1">
          {['D','S','T','Q','Q','S','S'].map((d, i) => (
            <div key={i} style={{ color: '#5DCAA5' }} className="text-[10px] text-center pb-1">{d}</div>
          ))}
        </div>

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
              <BlocoTurno turno="ida" horario="05:00h" passageiros={ida} onAtualizar={carregarMes} onVerDetalhe={setAgendamentoDetalhe} />
            )}
            {volta.length > 0 && (
              <BlocoTurno turno="volta" horario="14:00h" passageiros={volta} onAtualizar={carregarMes} onVerDetalhe={setAgendamentoDetalhe} />
            )}
          </>
        )}

        <button onClick={() => setMostrarForm(true)}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold mt-3 flex items-center justify-center gap-2"
          style={{ background: '#1D9E75' }}>
          + Agendar passageiro neste dia
        </button>
      </div>

      {agendamentoDetalhe && (
        <DetalhePassageiro
          p={agendamentoDetalhe}
          onVoltar={() => setAgendamentoDetalhe(null)}
          onAtualizar={() => { setAgendamentoDetalhe(null); carregarMes() }}
        />
      )}

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

function BlocoTurno({ turno, horario, passageiros, onAtualizar, onVerDetalhe }: {
  turno: 'ida' | 'volta', horario: string, passageiros: Agendamento[],
  onAtualizar: () => void, onVerDetalhe: (a: Agendamento) => void
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
      {passageiros.map(p => (
        <CardPassageiro key={p.id} p={p} onVerDetalhe={() => onVerDetalhe(p)} />
      ))}
    </div>
  )
}

function CardPassageiro({ p, onVerDetalhe }: { p: Agendamento, onVerDetalhe: () => void }) {
  const iniciais = p.nome_passageiro.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const cores = ['#E1F5EE|#0F6E56', '#FAEEDA|#854F0B', '#E6F1FB|#185FA5', '#EEEDFE|#534AB7']
  const cor = cores[p.nome_passageiro.charCodeAt(0) % cores.length].split('|')

  return (
    <button
      onClick={onVerDetalhe}
      className="w-full bg-white border border-gray-100 rounded-xl p-3 mb-2 flex items-center gap-3 text-left active:opacity-70 transition-opacity"
      style={{ cursor: 'pointer' }}>
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
      <span className="text-gray-300 text-sm ml-1">›</span>
    </button>
  )
}

function DetalhePassageiro({ p, onVoltar, onAtualizar }: {
  p: Agendamento, onVoltar: () => void, onAtualizar: () => void
}) {
  const dataFmt = format(new Date(p.data_viagem + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })
  const turnoLabel = p.turno === 'ida' ? 'Ida (05:00h)' : 'Volta (14:00h)'
  const formaLabel: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', pendente: 'A cobrar', fiado: 'Fiado'
  }
  const temEndereco = p.rua || p.numero || p.bairro || p.municipio || p.cep || p.referencia

  function abrirWhatsApp() {
    if (!p.telefone_passageiro) return
    const tel = p.telefone_passageiro.replace(/\D/g, '')
    const dataMsg = format(new Date(p.data_viagem + 'T00:00:00'), 'dd/MM', { locale: ptBR })
    const msg = encodeURIComponent(
      `Olá ${p.nome_passageiro}! 👋\n\nConfirmando sua viagem:\n📍 ${p.parada_origem} → ${p.parada_destino}\n📅 ${dataMsg} - ${turnoLabel}\n💰 R$ ${p.valor.toFixed(2).replace('.', ',')}\n\nTudo certo? ✅`
    )
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
  }

  function abrirMaps() {
    const partes = [p.rua, p.numero, p.bairro, p.municipio, p.cep].filter(Boolean)
    if (!partes.length) return
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes.join(', '))}`, '_blank')
  }

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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onVoltar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <div className="flex-1 min-w-0">
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold truncate">{p.nome_passageiro}</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs capitalize">{dataFmt}</p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-lg font-medium"
          style={p.status === 'confirmado'
            ? { background: '#085041', color: '#9FE1CB' }
            : { background: '#0a5a48', color: '#9FE1CB' }}>
          {p.status === 'confirmado' ? 'Confirmado' : 'Agendado'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {/* Passageiro */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Passageiro</p>
          <p className="text-base font-bold text-gray-800 mb-2">{p.nome_passageiro}</p>
          {p.telefone_passageiro ? (
            <div className="flex gap-2">
              <a href={`tel:${p.telefone_passageiro}`}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center border border-gray-200"
                style={{ background: '#f0f0ec', color: '#333' }}>
                📞 {p.telefone_passageiro}
              </a>
              <button onClick={abrirWhatsApp}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: '#E7F9EE', color: '#128C7E' }}>
                💬
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sem telefone cadastrado</p>
          )}
        </div>

        {/* Viagem */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Viagem</p>
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs text-gray-400 mt-0.5 shrink-0">Rota</span>
              <span className="text-sm font-medium text-gray-800 text-right">{p.parada_origem} → {p.parada_destino}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-400">Turno</span>
              <span className="text-sm font-medium text-gray-800">{turnoLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-400">Valor</span>
              <span className="text-sm font-bold" style={{ color: '#1D9E75' }}>
                R$ {p.valor.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-400">Pagamento</span>
              <span className="text-sm font-medium text-gray-800">
                {formaLabel[p.forma_pagamento || ''] || p.forma_pagamento || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Endereço */}
        {temEndereco && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Endereço de embarque</p>
            <div className="flex flex-col gap-1 mb-3">
              {(p.rua || p.numero) && (
                <p className="text-sm text-gray-800">{[p.rua, p.numero].filter(Boolean).join(', ')}</p>
              )}
              {p.bairro && <p className="text-sm text-gray-800">{p.bairro}</p>}
              {p.municipio && <p className="text-sm text-gray-800">{p.municipio}</p>}
              {p.cep && <p className="text-xs text-gray-400">CEP: {p.cep}</p>}
              {p.referencia && (
                <p className="text-xs text-gray-500 mt-1">📌 {p.referencia}</p>
              )}
            </div>
            <button onClick={abrirMaps}
              className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 flex items-center justify-center gap-2"
              style={{ background: '#f0f0ec', color: '#185FA5' }}>
              📍 Abrir no Google Maps
            </button>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-2">
          {p.status !== 'confirmado' && (
            <button onClick={confirmar}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#E1F5EE', color: '#0F6E56' }}>
              ✓ Confirmar presença
            </button>
          )}
          <button onClick={cancelar}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#FCEBEB', color: '#A32D2D' }}>
            ✕ Cancelar agendamento
          </button>
        </div>
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
    data_viagem: format(data, 'yyyy-MM-dd'),
    valor: '',
    forma_pagamento: 'dinheiro',
    quantidade: 0,
    rua: '',
    numero: '',
    bairro: '',
    municipio: '',
    cep: '',
    referencia: '',
  })
  const [valorAuto, setValorAuto] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [vagasOcupadas, setVagasOcupadas] = useState(0)

  useEffect(() => {
    if (form.rota_id) { carregarRota(form.rota_id); carregarVagas() }
    carregarClientes()
  }, [form.rota_id])

  useEffect(() => {
    if (form.rota_id) carregarVagas()
  }, [form.turno, form.data_viagem])

  useEffect(() => {
    if (form.parada_origem && form.parada_destino) calcularValor()
  }, [form.parada_origem, form.parada_destino])

  async function carregarVagas() {
    if (!form.rota_id) return
    const { count } = await supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('rota_id', form.rota_id)
      .eq('data_viagem', form.data_viagem)
      .eq('turno', form.turno)
      .neq('status', 'cancelado')
    setVagasOcupadas(count || 0)
  }

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

  const rotaAtual = rotas.find(r => r.id === form.rota_id)
  const capacidade = rotaAtual?.capacidade || 15
  const vagasDisponiveis = Math.max(0, capacidade - vagasOcupadas)

  const podeSalvar = !saving && !!form.nome_passageiro && !!form.parada_origem && !!form.parada_destino && !!form.valor && form.quantidade > 0

  async function salvar() {
    if (!podeSalvar) return
    setSaving(true)
    setErroSalvar('')
    const { data: { user } } = await supabase.auth.getUser()
    const registros = Array.from({ length: form.quantidade }, (_, i) => ({
      rota_id: form.rota_id,
      motorista_id: user!.id,
      nome_passageiro: form.quantidade > 1 ? `${form.nome_passageiro} (${i + 1}/${form.quantidade})` : form.nome_passageiro,
      telefone_passageiro: form.telefone_passageiro || null,
      parada_origem: form.parada_origem,
      parada_destino: form.parada_destino,
      turno: form.turno,
      valor: parseFloat(form.valor),
      forma_pagamento: form.forma_pagamento,
      fiado_pago: false,
      data_viagem: form.data_viagem,
      rua: form.rua || null,
      numero: form.numero || null,
      bairro: form.bairro || null,
      municipio: form.municipio || null,
      cep: form.cep || null,
      referencia: form.referencia || null,
    }))
    const { error } = await supabase.from('agendamentos').insert(registros)
    setSaving(false)
    if (error) {
      setErroSalvar('Erro ao salvar: ' + error.message)
      return
    }
    onSalvo()
  }

  const clientesFiltrados = filtroCliente.length >= 2
    ? clientes.filter(c => c.nome.toLowerCase().includes(filtroCliente.toLowerCase()))
    : []

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
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
        {rotas.length > 1 && (
          <Campo label="Rota">
            <select value={form.rota_id} onChange={e => setForm(f => ({ ...f, rota_id: e.target.value }))}
              className="campo-input">
              {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </Campo>
        )}

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

        <Campo label="Telefone">
          <input value={form.telefone_passageiro} onChange={e => setForm(f => ({ ...f, telefone_passageiro: e.target.value }))}
            placeholder="(95) 99999-9999" type="tel" className="campo-input" />
        </Campo>

        <Campo label="Data da viagem">
          <input type="date" value={form.data_viagem}
            onChange={e => setForm(f => ({ ...f, data_viagem: e.target.value }))}
            className="campo-input" />
        </Campo>

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

        <Campo label="Quantidade de passageiros">
          <div className="flex items-center gap-3">
            <button onClick={() => setForm(f => ({ ...f, quantidade: Math.max(0, f.quantidade - 1) }))}
              className="w-10 h-10 rounded-xl text-xl font-bold border border-gray-200 flex items-center justify-center"
              style={{ background: '#f0f0ec', color: '#0F6E56' }}>
              −
            </button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-bold text-gray-800">{form.quantidade}</span>
              <p className="text-xs text-gray-400">{form.quantidade === 1 ? 'passageiro' : 'passageiros'}</p>
            </div>
            <button onClick={() => setForm(f => ({ ...f, quantidade: Math.min(vagasDisponiveis || 99, f.quantidade + 1) }))}
              className="w-10 h-10 rounded-xl text-xl font-bold border border-gray-200 flex items-center justify-center"
              style={{ background: '#0F6E56', color: '#fff' }}>
              +
            </button>
          </div>
          {vagasDisponiveis > 0 && (
            <p className="text-xs text-gray-400 mt-1 text-center">{vagasDisponiveis} vaga{vagasDisponiveis !== 1 ? 's' : ''} disponível{vagasDisponiveis !== 1 ? 'is' : ''}</p>
          )}
        </Campo>

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

        <Campo label={valorAuto ? '✓ Valor automático da tabela' : 'Valor da passagem'}>
          <div className="flex gap-2">
            <span className="flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-white text-gray-400 text-sm">R$</span>
            <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              type="number" step="0.01" placeholder="0,00"
              className="campo-input rounded-l-none"
              style={{ borderColor: valorAuto ? '#9FE1CB' : undefined, background: valorAuto ? '#E1F5EE' : '#fff' }} />
          </div>
        </Campo>

        <Campo label="Forma de pagamento">
          <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
            className="campo-input">
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="cartao">Cartão</option>
            <option value="fiado">Fiado</option>
            <option value="pendente">A cobrar na viagem</option>
          </select>
        </Campo>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Endereço de embarque</p>

        <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
          <Campo label="Rua / Logradouro">
            <input value={form.rua} onChange={e => setForm(f => ({ ...f, rua: e.target.value }))}
              placeholder="Ex: Rua das Flores" className="campo-input" />
          </Campo>
          <Campo label="Número">
            <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
              placeholder="123" className="campo-input" />
          </Campo>
        </div>

        <Campo label="Bairro">
          <input value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))}
            placeholder="Ex: Centro" className="campo-input" />
        </Campo>

        <div className="grid grid-cols-2 gap-2">
          <Campo label="Município">
            <input value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))}
              placeholder="Ex: São Paulo" className="campo-input" />
          </Campo>
          <Campo label="CEP (opcional)">
            <input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))}
              placeholder="00000-000" className="campo-input" />
          </Campo>
        </div>

        <Campo label="Ponto de referência">
          <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
            placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
        </Campo>
      </div>

      <div style={{ padding: '8px 16px 80px', background: 'white', borderTop: '1px solid #e5e7eb' }}>
        {erroSalvar && (
          <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-2">{erroSalvar}</p>
        )}
        <button onClick={salvar} disabled={!podeSalvar}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving
            ? 'Salvando...'
            : form.quantidade > 1
            ? `✓ Salvar ${form.quantidade} passageiros`
            : '✓ Salvar passageiro'}
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
