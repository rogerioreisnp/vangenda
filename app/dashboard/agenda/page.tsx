'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import ModalNovaEncomenda from '@/components/ModalNovaEncomenda'

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
  ordem?: number | null
}

type Encomenda = {
  id: string
  nome: string
  telefone?: string
  valor: number
  observacao?: string
  pago: boolean
  valor_pago: number
  forma_pagamento?: string
  data_entrega?: string
  horario_entrega?: string
}

export default function AgendaPage() {
  console.log('AGENDA CARREGADA v2')
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [modalEncomenda, setModalEncomenda] = useState(false)
  const [modalPDF, setModalPDF] = useState(false)
  const [rotas, setRotas] = useState<any[]>([])
  const [agendamentoDetalhe, setAgendamentoDetalhe] = useState<Agendamento | null>(null)
  const [diasTrabalho, setDiasTrabalho] = useState<number[]>([])
  const [nomeMotorista, setNomeMotorista] = useState('')
  const [encomendasDoDia, setEncomendasDoDia] = useState<Encomenda[]>([])
  const [empresaCtx, setEmpresaCtx] = useState<{ empresaId: string; motEmpresaId?: string } | null | undefined>(undefined)
  const [rotasEmpresa, setRotasEmpresa] = useState<{ id: string; nome: string | null; origem: string | null; destino: string | null }[]>([])
  const [isGestor, setIsGestor] = useState(false)
  const [gestorUserIds, setGestorUserIds] = useState<string[]>([])
  const [empresaReady, setEmpresaReady] = useState(false)

  useEffect(() => { detectarEmpresa().then(() => setEmpresaReady(true)) }, [])
  useEffect(() => { if (empresaReady) carregarMes() }, [empresaReady, mesAtual])
  useEffect(() => { carregarEncomendasDoDia(diaSelecionado) }, [diaSelecionado])

  async function carregarMes() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const inicio = format(startOfMonth(mesAtual), 'yyyy-MM-dd')
    const fim = format(endOfMonth(mesAtual), 'yyyy-MM-dd')

    if (isGestor) {
      if (gestorUserIds.length > 0) {
        const { data } = await supabase.from('agendamentos').select('*')
          .in('motorista_id', gestorUserIds)
          .gte('data_viagem', inicio).lte('data_viagem', fim).neq('status', 'cancelado')
        if (data) setAgendamentos([...data].sort((a, b) => {
          if (a.ordem != null && b.ordem != null) return a.ordem - b.ordem
          if (a.ordem != null) return -1
          if (b.ordem != null) return 1
          return 0
        }))
      }
      setLoading(false)
      return
    }

    const [{ data }, { data: rts }, { data: mot }] = await Promise.all([
      supabase.from('agendamentos').select('*').eq('motorista_id', user.id)
        .gte('data_viagem', inicio).lte('data_viagem', fim).neq('status', 'cancelado'),
      supabase.from('rotas').select('*').eq('motorista_id', user.id),
      supabase.from('motoristas').select('dias_trabalho, nome').eq('id', user.id).single(),
    ])

    if (data) setAgendamentos([...data].sort((a, b) => {
      if (a.ordem != null && b.ordem != null) return a.ordem - b.ordem
      if (a.ordem != null) return -1
      if (b.ordem != null) return 1
      return 0
    }))
    if (rts) setRotas(rts)
    if (mot?.dias_trabalho) setDiasTrabalho(mot.dias_trabalho)
    if (mot?.nome) setNomeMotorista(mot.nome)

    setLoading(false)
  }

  async function carregarEncomendasDoDia(data: Date) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: encs } = await supabase
      .from('encomendas')
      .select('id, nome, telefone, valor, observacao, pago, valor_pago, forma_pagamento, data_entrega, horario_entrega')
      .eq('motorista_id', user.id)
      .eq('data_entrega', format(data, 'yyyy-MM-dd'))
      .order('criado_em', { ascending: true })
    setEncomendasDoDia(encs || [])
  }

  async function detectarEmpresa() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1) Verifica se é gestor
    const { data: gestorRow } = await supabase
      .from('gestores').select('nome, empresa_id').eq('user_id', user.id).maybeSingle()
    if (gestorRow) {
      setIsGestor(true)
      setNomeMotorista(gestorRow.nome || '')
      setEmpresaCtx({ empresaId: gestorRow.empresa_id })
      const { data: rts } = await supabase
        .from('rotas_empresa').select('id, nome, origem, destino, ativa')
        .eq('empresa_id', gestorRow.empresa_id).order('created_at', { ascending: true })
      setRotasEmpresa((rts || []).filter(r => r.ativa !== false))
      const { data: motsEmp } = await supabase
        .from('motoristas_empresa').select('user_id')
        .eq('empresa_id', gestorRow.empresa_id).eq('status', 'ativo')
      const uIds = [
        ...((motsEmp || []).map(m => m.user_id).filter(Boolean) as string[]),
        user.id,
      ]
      setGestorUserIds(uIds)
      return
    }

    // 2) Verifica se é motorista de empresa
    const { data: motEmp } = await supabase
      .from('motoristas_empresa')
      .select('id, empresa_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (motEmp) {
      setEmpresaCtx({ empresaId: motEmp.empresa_id, motEmpresaId: motEmp.id })
      const { data: rts } = await supabase
        .from('rotas_empresa')
        .select('id, nome, origem, destino, ativa')
        .eq('empresa_id', motEmp.empresa_id)
        .order('created_at', { ascending: true })
      setRotasEmpresa((rts || []).filter(r => r.ativa !== false))
    } else {
      setEmpresaCtx(null)
    }
  }

  async function concluirEncomenda(enc: Encomenda) {
    await supabase.from('encomendas').update({
      pago: true,
      valor_pago: enc.valor,
      data_pago: format(new Date(), 'yyyy-MM-dd'),
    }).eq('id', enc.id)
    carregarEncomendasDoDia(diaSelecionado)
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

  const rotaPrimaria = rotas[0]
  const horarioIda = rotaPrimaria?.horario_ida?.slice(0, 5) || '05:00'
  const horarioVolta = rotaPrimaria?.horario_volta?.slice(0, 5) || '14:00'
  const isDiaTrabalhoSelecionado = diasTrabalho.length === 0 || diasTrabalho.includes(diaSelecionado.getDay())

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-0">
        {isGestor && (
          <Link href="/empresa" className="inline-flex items-center gap-1 text-xs font-medium mb-2" style={{ color: '#9FE1CB' }}>
            ‹ Voltar ao painel
          </Link>
        )}
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
            const isDiaTrabalho = diasTrabalho.length === 0 || diasTrabalho.includes(dia.getDay())
            const opacity = isOutro ? 0.3 : !isDiaTrabalho ? 0.3 : 1
            return (
              <button key={i} onClick={() => setDiaSelecionado(dia)}
                className="h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors"
                style={{
                  background: isSel ? '#E1F5EE' : isHoje ? '#085041' : !isDiaTrabalho && !isOutro ? '#062e26' : 'transparent',
                  opacity,
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
        ) : agsDoDia.length === 0 && encomendasDoDia.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400 text-sm">Nenhum passageiro neste dia</p>
          </div>
        ) : (
          <>
            {ida.length > 0 && (
              <BlocoTurno turno="ida" horario={horarioIda + 'h'} passageiros={ida} onAtualizar={carregarMes} onVerDetalhe={setAgendamentoDetalhe} />
            )}
            {volta.length > 0 && (
              <BlocoTurno turno="volta" horario={horarioVolta + 'h'} passageiros={volta} onAtualizar={carregarMes} onVerDetalhe={setAgendamentoDetalhe} />
            )}
            {encomendasDoDia.length > 0 && (
              <BlocoEncomendas encomendas={encomendasDoDia} onConcluir={concluirEncomenda} />
            )}
          </>
        )}

        {agsDoDia.length > 0 && (
          <button
            onClick={() => setModalPDF(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold mt-3 flex items-center justify-center gap-2"
            style={{ background: '#E6F1FB', color: '#185FA5' }}>
            📋 Gerar lista de passageiros (PDF)
          </button>
        )}

        {!isDiaTrabalhoSelecionado && (
          <div style={{ background: '#FCEBEB', borderColor: '#F5BCBC' }}
            className="border rounded-xl px-4 py-3 mt-3">
            <p className="text-sm font-semibold" style={{ color: '#A32D2D' }}>
              🚫 Você não trabalha neste dia
            </p>
            <p className="text-xs mt-1" style={{ color: '#7f1d1d' }}>
              Altere os dias de trabalho nas Configurações se necessário.
            </p>
          </div>
        )}
        <button
          onClick={() => { if (isDiaTrabalhoSelecionado) setMostrarForm(true) }}
          disabled={!isDiaTrabalhoSelecionado}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold mt-3 flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: isDiaTrabalhoSelecionado ? '#1D9E75' : '#9ca3af' }}>
          {isDiaTrabalhoSelecionado ? '+ Agendar passageiro neste dia' : '🚫 Sem rota neste dia'}
        </button>
        <button onClick={() => setModalEncomenda(true)}
          className="w-full py-3 rounded-xl text-sm font-semibold mt-2 flex items-center justify-center gap-2"
          style={{ background: '#FAEEDA', color: '#854F0B' }}>
          📦 Agendar encomenda neste dia
        </button>
        <div className="h-20" />
      </div>

      {agendamentoDetalhe && (
        <DetalhePassageiro
          p={agendamentoDetalhe}
          horarioIda={horarioIda}
          horarioVolta={horarioVolta}
          onVoltar={() => setAgendamentoDetalhe(null)}
          onAtualizar={() => { setAgendamentoDetalhe(null); carregarMes() }}
        />
      )}

      {mostrarForm && (
        <FormAgendamento
          data={diaSelecionado}
          rotas={rotas}
          empresaCtx={empresaCtx ?? null}
          rotasEmpresa={rotasEmpresa}
          onFechar={() => setMostrarForm(false)}
          onSalvo={() => { setMostrarForm(false); carregarMes() }}
        />
      )}

      {modalEncomenda && (
        <ModalNovaEncomenda
          dataSelecionada={diaSelecionado}
          onFechar={() => setModalEncomenda(false)}
          onSalvo={() => { setModalEncomenda(false); carregarEncomendasDoDia(diaSelecionado) }}
        />
      )}

      {modalPDF && (
        <ModalListaPDF
          diaSelecionado={diaSelecionado}
          agsDoDia={agsDoDia}
          nomeMotorista={nomeMotorista}
          rotaPrimaria={rotaPrimaria}
          onFechar={() => setModalPDF(false)}
        />
      )}
    </div>
  )
}

function BlocoTurno({ turno, horario, passageiros, onAtualizar, onVerDetalhe }: {
  turno: 'ida' | 'volta', horario: string, passageiros: Agendamento[],
  onAtualizar: () => void, onVerDetalhe: (a: Agendamento) => void
}) {
  const [lista, setLista] = useState(passageiros)
  const listaRef = useRef(passageiros)
  const dragIdx = useRef<number | null>(null)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const propSet = new Set(passageiros.map(p => p.id))
    const curSet = new Set(listaRef.current.map(p => p.id))
    const mudou = propSet.size !== curSet.size || Array.from(propSet).some(id => !curSet.has(id))
    if (mudou) {
      listaRef.current = passageiros
      setLista(passageiros)
    }
  }, [passageiros])

  const sub = lista.reduce((s, a) => s + a.valor, 0)

  async function salvarOrdem(novaLista: Agendamento[]) {
    await Promise.all(novaLista.map((a, i) =>
      supabase.from('agendamentos').update({ ordem: i }).eq('id', a.id)
    ))
  }

  function reordenar(de: number, para: number) {
    const novas = [...listaRef.current]
    const [item] = novas.splice(de, 1)
    novas.splice(para, 0, item)
    listaRef.current = novas
    setLista(novas)
    return novas
  }

  function onDragStart(idx: number) {
    dragIdx.current = idx
    setDraggingIdx(idx)
  }

  function onDragEnter(idx: number) {
    if (dragIdx.current === null || dragIdx.current === idx) return
    reordenar(dragIdx.current, idx)
    dragIdx.current = idx
    setDraggingIdx(idx)
  }

  function onDragEnd() {
    dragIdx.current = null
    setDraggingIdx(null)
    salvarOrdem(listaRef.current)
  }

  function handleTouchStart(e: React.TouchEvent, idx: number) {
    e.preventDefault()
    dragIdx.current = idx
    setDraggingIdx(idx)
    let currentDragIdx = idx

    function move(ev: TouchEvent) {
      ev.preventDefault()
      const touch = ev.touches[0]
      const el = document.elementFromPoint(touch.clientX, touch.clientY)
      if (!el || !containerRef.current?.contains(el)) return
      const itemEl = el.closest('[data-drag-idx]') as HTMLElement
      if (!itemEl) return
      const newIdx = parseInt(itemEl.dataset.dragIdx ?? '-1')
      if (isNaN(newIdx) || newIdx < 0 || newIdx === currentDragIdx) return
      reordenar(currentDragIdx, newIdx)
      currentDragIdx = newIdx
      dragIdx.current = newIdx
      setDraggingIdx(newIdx)
    }

    function end() {
      dragIdx.current = null
      setDraggingIdx(null)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      salvarOrdem(listaRef.current)
    }

    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end)
  }

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
      <div ref={containerRef}>
        {lista.map((p, i) => (
          <div key={p.id} draggable
            data-drag-idx={i}
            onDragStart={() => onDragStart(i)}
            onDragEnter={() => onDragEnter(i)}
            onDragEnd={onDragEnd}
            onDragOver={e => e.preventDefault()}
            style={{ marginBottom: 8, borderRadius: 12, background: draggingIdx === i ? '#E1F5EE' : 'transparent' }}>
            <CardPassageiro p={p} onVerDetalhe={() => onVerDetalhe(p)} onGripTouchStart={(e) => handleTouchStart(e, i)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CardPassageiro({ p, onVerDetalhe, onGripTouchStart }: {
  p: Agendamento, onVerDetalhe: () => void, onGripTouchStart?: (e: React.TouchEvent) => void
}) {
  const iniciais = p.nome_passageiro.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const cores = ['#E1F5EE|#0F6E56', '#FAEEDA|#854F0B', '#E6F1FB|#185FA5', '#EEEDFE|#534AB7']
  const cor = cores[p.nome_passageiro.charCodeAt(0) % cores.length].split('|')

  return (
    <button
      onClick={onVerDetalhe}
      className="w-full bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-2 text-left active:opacity-70 transition-opacity"
      style={{ cursor: 'pointer' }}>
      <div
        onTouchStart={onGripTouchStart}
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '2px 4px', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}>
        <div style={{ width: 14, height: 3, borderRadius: 2, background: '#1D9E75' }} />
        <div style={{ width: 14, height: 3, borderRadius: 2, background: '#1D9E75' }} />
        <div style={{ width: 14, height: 3, borderRadius: 2, background: '#1D9E75' }} />
      </div>
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

function DetalhePassageiro({ p, onVoltar, onAtualizar, horarioIda, horarioVolta }: {
  p: Agendamento, onVoltar: () => void, onAtualizar: () => void,
  horarioIda: string, horarioVolta: string
}) {
  const dataFmt = format(new Date(p.data_viagem + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })
  const turnoLabel = p.turno === 'ida' ? `Ida (${horarioIda}h)` : `Volta (${horarioVolta}h)`
  const formaLabel: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', pendente: 'A cobrar', fiado: 'Fiado'
  }
  const temEndereco = p.rua || p.numero || p.bairro || p.municipio || p.cep || p.referencia
  const [statusLocal, setStatusLocal] = useState(p.status)

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
    setStatusLocal('cancelado')
  }

  async function apagar() {
    if (!confirm('Tem certeza que deseja apagar este agendamento?')) return
    await supabase.from('agendamentos').delete().eq('id', p.id)
    onAtualizar()
  }

  const [editando, setEditando] = useState(false)
  const [contactsApiEdit, setContactsApiEdit] = useState(false)
  useEffect(() => { setContactsApiEdit('contacts' in navigator) }, [])
  async function selecionarContatoEdit() {
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false })
      if (!contacts?.length) return
      const c = contacts[0]
      setFormEdit(f => ({
        ...f,
        nome_passageiro: c.name?.[0] ?? f.nome_passageiro,
        telefone_passageiro: c.tel?.[0] ?? f.telefone_passageiro,
      }))
    } catch {}
  }
  const [formEdit, setFormEdit] = useState({
    nome_passageiro: p.nome_passageiro,
    telefone_passageiro: p.telefone_passageiro || '',
    data_viagem: p.data_viagem,
    parada_origem: p.parada_origem,
    parada_destino: p.parada_destino,
    turno: p.turno as 'ida' | 'volta',
    valor: String(p.valor),
    forma_pagamento: p.forma_pagamento || 'dinheiro',
    rua: p.rua || '',
    numero: p.numero || '',
    bairro: p.bairro || '',
    municipio: p.municipio || '',
    cep: p.cep || '',
    referencia: p.referencia || '',
  })
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  async function salvarEdicao() {
    setSalvandoEdit(true)
    await supabase.from('agendamentos').update({
      nome_passageiro: formEdit.nome_passageiro,
      telefone_passageiro: formEdit.telefone_passageiro || null,
      data_viagem: formEdit.data_viagem,
      parada_origem: formEdit.parada_origem,
      parada_destino: formEdit.parada_destino,
      turno: formEdit.turno,
      valor: parseFloat(formEdit.valor),
      forma_pagamento: formEdit.forma_pagamento,
      rua: formEdit.rua || null,
      numero: formEdit.numero || null,
      bairro: formEdit.bairro || null,
      municipio: formEdit.municipio || null,
      cep: formEdit.cep || null,
      referencia: formEdit.referencia || null,
    }).eq('id', p.id)
    setSalvandoEdit(false)
    setEditando(false)
    onAtualizar()
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#f0f0ec', zIndex: 100 }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onVoltar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <div className="flex-1 min-w-0">
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold truncate">{p.nome_passageiro}</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs capitalize">{dataFmt}</p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-lg font-medium"
          style={statusLocal === 'confirmado'
            ? { background: '#085041', color: '#9FE1CB' }
            : statusLocal === 'cancelado'
            ? { background: '#7a1f1f', color: '#FCEBEB' }
            : { background: '#0a5a48', color: '#9FE1CB' }}>
          {statusLocal === 'confirmado' ? 'Confirmado' : statusLocal === 'cancelado' ? 'Cancelado' : 'Agendado'}
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
          {statusLocal === 'agendado' && (
            <button onClick={confirmar}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#E1F5EE', color: '#0F6E56' }}>
              ✓ Confirmar presença
            </button>
          )}
          <button onClick={() => setEditando(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#E6F1FB', color: '#185FA5' }}>
            ✏️ Editar agendamento
          </button>
          <button onClick={apagar}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#FCEBEB', color: '#A32D2D' }}>
            🗑️ Apagar agendamento
          </button>
        </div>
        <div className="h-8" />
      </div>

      {editando && (
        <div className="fixed inset-0 flex flex-col" style={{ background: '#f0f0ec', zIndex: 60 }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
            <button onClick={() => setEditando(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <div>
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Editar agendamento</p>
              <p style={{ color: '#5DCAA5' }} className="text-xs truncate">{p.nome_passageiro}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Nome do passageiro</p>
              <div className="flex items-center gap-2">
                <input value={formEdit.nome_passageiro} onChange={e => setFormEdit(f => ({ ...f, nome_passageiro: e.target.value }))}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
                {contactsApiEdit && (
                  <button type="button" onClick={selecionarContatoEdit}
                    className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-green-700 border border-gray-200 bg-white whitespace-nowrap"
                    title="Importar da agenda do celular">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                    </svg>
                    <span>Buscar contato</span>
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Telefone</p>
              <input value={formEdit.telefone_passageiro} onChange={e => setFormEdit(f => ({ ...f, telefone_passageiro: e.target.value }))}
                type="tel" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Data da viagem</p>
              <input value={formEdit.data_viagem} onChange={e => setFormEdit(f => ({ ...f, data_viagem: e.target.value }))}
                type="date" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Turno</p>
              <div className="grid grid-cols-2 gap-2">
                {(['ida', 'volta'] as const).map(t => (
                  <button key={t} onClick={() => setFormEdit(f => ({ ...f, turno: t }))}
                    className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={formEdit.turno === t
                      ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                      : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                    {t === 'ida' ? '↑ Ida' : '↓ Volta'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Embarca em</p>
                <input value={formEdit.parada_origem} onChange={e => setFormEdit(f => ({ ...f, parada_origem: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Desembarca em</p>
                <input value={formEdit.parada_destino} onChange={e => setFormEdit(f => ({ ...f, parada_destino: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Valor (R$)</p>
              <input value={formEdit.valor} onChange={e => setFormEdit(f => ({ ...f, valor: e.target.value }))}
                type="number" step="0.01"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Forma de pagamento</p>
              <select value={formEdit.forma_pagamento} onChange={e => setFormEdit(f => ({ ...f, forma_pagamento: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white">
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao">Cartão</option>
                <option value="fiado">Fiado</option>
                <option value="pendente">A cobrar na viagem</option>
              </select>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Endereço de embarque</p>
            <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Rua / Logradouro</p>
                <input value={formEdit.rua} onChange={e => setFormEdit(f => ({ ...f, rua: e.target.value }))}
                  placeholder="Ex: Rua das Flores"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Número</p>
                <input value={formEdit.numero} onChange={e => setFormEdit(f => ({ ...f, numero: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Bairro</p>
              <input value={formEdit.bairro} onChange={e => setFormEdit(f => ({ ...f, bairro: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Município</p>
                <input value={formEdit.municipio} onChange={e => setFormEdit(f => ({ ...f, municipio: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">CEP</p>
                <input value={formEdit.cep} onChange={e => setFormEdit(f => ({ ...f, cep: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Ponto de referência</p>
              <input value={formEdit.referencia} onChange={e => setFormEdit(f => ({ ...f, referencia: e.target.value }))}
                placeholder="Ex: Próximo ao mercado Boa Ideia"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white" />
            </div>
            <div className="h-20" />
          </div>

          <div style={{ padding: '8px 16px 80px', background: 'white', borderTop: '1px solid #e5e7eb' }}>
            <button onClick={salvarEdicao} disabled={salvandoEdit}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvandoEdit ? 'Salvando...' : '✓ Salvar alterações'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FormAgendamento({ data, rotas, empresaCtx, rotasEmpresa, onFechar, onSalvo }: {
  data: Date, rotas: any[],
  empresaCtx: { empresaId: string; motEmpresaId?: string } | null,
  rotasEmpresa: { id: string; nome: string | null; origem: string | null; destino: string | null }[],
  onFechar: () => void, onSalvo: () => void
}) {
  const horarioIda = rotas[0]?.horario_ida?.slice(0, 5) || '05:00'
  const horarioVolta = rotas[0]?.horario_volta?.slice(0, 5) || '14:00'
  const [paradas, setParadas] = useState<any[]>([])
  const [precos, setPrecos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [paradasEmpresa, setParadasEmpresa] = useState<{ id: string; nome: string | null; preco: number | null }[]>([])
  const [rotaEmpresaId, setRotaEmpresaId] = useState(rotasEmpresa[0]?.id || '')
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
  const [contactsApi, setContactsApi] = useState(false)
  useEffect(() => { setContactsApi('contacts' in navigator) }, [])
  async function selecionarContato() {
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false })
      if (!contacts?.length) return
      const c = contacts[0]
      setForm(f => ({
        ...f,
        nome_passageiro: c.name?.[0] ?? f.nome_passageiro,
        telefone_passageiro: c.tel?.[0] ?? f.telefone_passageiro,
      }))
      setFiltroCliente('')
    } catch {}
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vangenda_form_agendamento')
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.form) setForm(f => ({ ...f, ...saved.form }))
        if (saved.rotaEmpresaId) setRotaEmpresaId(saved.rotaEmpresaId)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('vangenda_form_agendamento', JSON.stringify({ form, rotaEmpresaId }))
    } catch {}
  }, [form, rotaEmpresaId])

  useEffect(() => {
    if (!empresaCtx && form.rota_id) { carregarRota(form.rota_id); carregarVagas() }
    carregarClientes()
  }, [form.rota_id])

  useEffect(() => {
    if (!empresaCtx && form.rota_id) carregarVagas()
  }, [form.turno, form.data_viagem])

  useEffect(() => {
    if (empresaCtx && rotaEmpresaId) carregarParadasEmpresa(rotaEmpresaId)
  }, [rotaEmpresaId])

  useEffect(() => {
    if (rotasEmpresa.length > 0 && !rotaEmpresaId) setRotaEmpresaId(rotasEmpresa[0].id)
  }, [rotasEmpresa])

  useEffect(() => {
    if (form.parada_origem && form.parada_destino) calcularValor()
  }, [form.parada_origem, form.parada_destino])

  useEffect(() => {
    if (empresaCtx && paradasEmpresa.length > 0 && form.parada_origem && form.parada_destino) calcularValor()
  }, [paradasEmpresa])

  async function carregarVagas() {
    if (empresaCtx || !form.rota_id) return
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

  async function carregarParadasEmpresa(rotaId: string) {
    const { data, error } = await supabase
      .from('paradas_empresa')
      .select('id, nome, preco')
      .eq('rota_id', rotaId)
    if (data) setParadasEmpresa(data)
  }

  async function carregarClientes() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('clientes').select('*').eq('motorista_id', user!.id).order('nome')
    if (data) setClientes(data)
  }

  function calcularValor() {
    if (empresaCtx) {
      const trecho = paradasEmpresa.find(
        p => p.nome === `${form.parada_origem} → ${form.parada_destino}`
      )
      if (trecho?.preco != null) {
        setValorAuto(trecho.preco)
        setForm(f => ({ ...f, valor: String(trecho.preco) }))
      } else {
        setValorAuto(null)
      }
      return
    }
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

  const paradasUnicas = empresaCtx
    ? Array.from(new Set(
        paradasEmpresa.flatMap(p => {
          const partes = (p.nome || '').split(' → ')
          return partes.map((s: string) => s.trim()).filter(Boolean)
        })
      ))
    : []

  const rotaAtual = rotas.find(r => r.id === form.rota_id)
  const capacidade = rotaAtual?.capacidade || 15
  const vagasDisponiveis = Math.max(0, capacidade - vagasOcupadas)

  const podeSalvar = !saving && !!form.nome_passageiro && !!form.parada_origem && !!form.parada_destino && !!form.valor && form.quantidade > 0

  function fechar() {
    localStorage.removeItem('vangenda_form_agendamento')
    onFechar()
  }

  async function salvar() {
    if (!podeSalvar) return
    setSaving(true)
    setErroSalvar('')
    const { data: { user } } = await supabase.auth.getUser()
    const registros = Array.from({ length: form.quantidade }, (_, i) => ({
      rota_id: empresaCtx ? null : form.rota_id,
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
    localStorage.removeItem('vangenda_form_agendamento')
    onSalvo()
  }

  const clientesFiltrados = filtroCliente.length >= 2
    ? clientes.filter(c => c.nome.toLowerCase().includes(filtroCliente.toLowerCase()))
    : []

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={fechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Novo passageiro</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs capitalize">
            {format(data, "EEEE, dd 'de' MMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {empresaCtx && rotasEmpresa.length > 1 && (
          <Campo label="Rota">
            <select value={rotaEmpresaId} onChange={e => {
              setRotaEmpresaId(e.target.value)
              setForm(f => ({ ...f, parada_origem: '', parada_destino: '' }))
            }} className="campo-input">
              {rotasEmpresa.map(r => (
                <option key={r.id} value={r.id}>
                  {r.nome || `${r.origem} → ${r.destino}`}
                </option>
              ))}
            </select>
          </Campo>
        )}

        {!empresaCtx && rotas.length > 1 && (
          <Campo label="Rota">
            <select value={form.rota_id} onChange={e => setForm(f => ({ ...f, rota_id: e.target.value }))}
              className="campo-input">
              {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </Campo>
        )}

        <Campo label="Nome do passageiro">
          <div className="flex items-center gap-2">
            <input value={filtroCliente || form.nome_passageiro}
              onChange={e => { setFiltroCliente(e.target.value); setForm(f => ({ ...f, nome_passageiro: e.target.value })) }}
              placeholder="Digite o nome..." className="campo-input flex-1" />
            {contactsApi && (
              <button type="button" onClick={selecionarContato}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-green-700 border border-gray-200 bg-white whitespace-nowrap"
                title="Importar da agenda do celular">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                </svg>
                <span>Buscar contato</span>
              </button>
            )}
          </div>
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
                {t === 'ida' ? `↑ Ida (${horarioIda}h)` : `↓ Volta (${horarioVolta}h)`}
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
              {empresaCtx
                ? paradasUnicas.map(p => <option key={p} value={p}>{p}</option>)
                : paradas.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)
              }
            </select>
          </Campo>
          <Campo label="Desembarca em">
            <select value={form.parada_destino} onChange={e => setForm(f => ({ ...f, parada_destino: e.target.value }))}
              className="campo-input">
              <option value="">Selecione...</option>
              {empresaCtx
                ? paradasUnicas.map(p => <option key={p} value={p}>{p}</option>)
                : paradas.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)
              }
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

function BlocoEncomendas({ encomendas, onConcluir }: {
  encomendas: Encomenda[]
  onConcluir: (e: Encomenda) => void
}) {
  const pendentes = encomendas.filter(e => !e.pago)
  const concluidas = encomendas.filter(e => e.pago)
  const formaLabel: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão' }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Encomendas</span>
        <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
          style={{ background: '#FAEEDA', color: '#854F0B' }}>
          📦 {encomendas.length}
        </span>
      </div>

      {pendentes.map(e => (
        <div key={e.id} className="bg-white border border-gray-100 rounded-xl p-3 mb-2 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base"
            style={{ background: '#FAEEDA' }}>📦</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{e.nome}</p>
            {e.observacao && <p className="text-xs text-gray-400 truncate">{e.observacao}</p>}
            <p className="text-xs text-gray-400">
              {e.horario_entrega ? e.horario_entrega.slice(0, 5) + 'h · ' : ''}
              {e.forma_pagamento ? (formaLabel[e.forma_pagamento] || e.forma_pagamento) : 'A cobrar'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <p className="text-sm font-bold" style={{ color: '#854F0B' }}>R$ {e.valor.toFixed(0)}</p>
            <button onClick={() => onConcluir(e)}
              className="text-xs px-2.5 py-1 rounded-lg font-semibold"
              style={{ background: '#E1F5EE', color: '#0F6E56' }}>
              ✓ Concluir
            </button>
          </div>
        </div>
      ))}

      {concluidas.length > 0 && (
        <>
          <p className="text-xs font-medium text-gray-400 mt-3 mb-2 uppercase tracking-wide">Concluídas</p>
          {concluidas.map(e => (
            <div key={e.id} className="border border-gray-100 rounded-xl p-3 mb-2 flex items-center gap-3"
              style={{ background: '#f7f7f7', opacity: 0.7 }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base"
                style={{ background: '#e5e5e5' }}>📦</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-500 truncate">{e.nome}</p>
                {e.observacao && <p className="text-xs text-gray-400 truncate">{e.observacao}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <p className="text-sm text-gray-400">R$ {e.valor.toFixed(0)}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                  style={{ background: '#E1F5EE', color: '#0F6E56' }}>✓ Concluída</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function ModalListaPDF({
  diaSelecionado,
  agsDoDia,
  nomeMotorista,
  rotaPrimaria,
  onFechar,
}: {
  diaSelecionado: Date
  agsDoDia: Agendamento[]
  nomeMotorista: string
  rotaPrimaria: any
  onFechar: () => void
}) {
  const [form, setForm] = useState({
    turno_filtro: 'ida' as 'ida' | 'volta',
    nome_empresa: '',
    razao_social: '',
    cnpj: '',
    placa: '',
    motorista: nomeMotorista,
    origem: '',
    destino: '',
    horario_saida: rotaPrimaria?.horario_ida?.slice(0, 5) || '',
    horario_volta: rotaPrimaria?.horario_volta?.slice(0, 5) || '',
    data_saida: format(diaSelecionado, 'yyyy-MM-dd'),
    data_volta: '',
  })
  const [gerando, setGerando] = useState(false)
  const [documentos, setDocumentos] = useState<Record<string, string>>({})
  const documentosRef = useRef(documentos)
  useEffect(() => { documentosRef.current = documentos }, [documentos])

  const passageirosFiltrados = agsDoDia.filter(a => a.turno === form.turno_filtro)

  useEffect(() => {
    try {
      const savedPlaca = localStorage.getItem('vangenda_pdf_placa')
      const savedEmpresa = localStorage.getItem('vangenda_pdf_empresa')
      const updates: Partial<typeof form> = {}
      if (savedPlaca) updates.placa = savedPlaca
      if (savedEmpresa) {
        const parsed = JSON.parse(savedEmpresa)
        if (parsed.nome_empresa) updates.nome_empresa = parsed.nome_empresa
        if (parsed.razao_social) updates.razao_social = parsed.razao_social
        if (parsed.cnpj) updates.cnpj = parsed.cnpj
      }
      if (Object.keys(updates).length > 0) setForm(f => ({ ...f, ...updates }))
    } catch {}
  }, [])

  useEffect(() => {
    setForm(f => ({ ...f, motorista: nomeMotorista }))
  }, [nomeMotorista])

  async function gerarPDF() {
    setGerando(true)
    try {
      localStorage.setItem('vangenda_pdf_placa', form.placa)
      localStorage.setItem('vangenda_pdf_empresa', JSON.stringify({
        nome_empresa: form.nome_empresa,
        razao_social: form.razao_social,
        cnpj: form.cnpj,
      }))
    } catch {}

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    doc.setLineWidth(0.3)

    const pageW = 210
    const mg = 15
    const W = pageW - 2 * mg

    function trunc(s: string, max = 30) { return s.length > max ? s.slice(0, max - 1) + '…' : s }
    function fmtDate(d: string) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—' }

    function cell(cx: number, cy: number, cw: number, ch: number, lbl: string, val: string) {
      doc.setDrawColor(0, 0, 0)
      doc.rect(cx, cy, cw, ch)
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(120, 120, 120)
      doc.text(lbl, cx + 2, cy + 4.5)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 20, 20)
      doc.text(trunc(val || '—'), cx + 2, cy + 10.5)
    }

    let y = 15

    // Cabeçalho da empresa
    if (form.nome_empresa) {
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(form.nome_empresa.toUpperCase(), pageW / 2, y, { align: 'center' })
      y += 8
    }

    if (form.razao_social) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(form.razao_social, pageW / 2, y, { align: 'center' })
      y += 5
    }

    if (form.cnpj) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`CNPJ: ${form.cnpj}`, pageW / 2, y, { align: 'center' })
      y += 5
    }

    if (form.nome_empresa || form.razao_social || form.cnpj) {
      y += 10
    }

    doc.setFontSize(form.nome_empresa ? 10 : 12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 20, 20)
    doc.text('LISTA DE PASSAGEIROS — FRETAMENTO', pageW / 2, y, { align: 'center' })
    y += 9

    const rowH = 14
    const half = W / 2
    const third = W / 3

    cell(mg, y, half, rowH, 'PLACA', form.placa)
    cell(mg + half, y, half, rowH, 'MOTORISTA', form.motorista)
    y += rowH

    cell(mg, y, half, rowH, 'ORIGEM DA VIAGEM', form.origem)
    cell(mg + half, y, half, rowH, 'DESTINO', form.destino)
    y += rowH

    cell(mg, y, third, rowH, 'HORÁRIO DE SAÍDA', form.horario_saida)
    cell(mg + third, y, third, rowH, 'HORÁRIO DA VOLTA', form.horario_volta)
    cell(mg + 2 * third, y, third, rowH, 'QUANTIDADE DE PASSAGEIROS', String(passageirosFiltrados.length))
    y += rowH

    cell(mg, y, half, rowH, 'DATA DA SAÍDA', fmtDate(form.data_saida))
    cell(mg + half, y, half, rowH, 'DATA DA VOLTA', fmtDate(form.data_volta))
    y += rowH + 7

    const hdrH = 8
    const nameW = W * 0.65
    doc.setFillColor(15, 110, 86)
    doc.rect(mg, y, W, hdrH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('PASSAGEIROS', mg + 3, y + 5.5)
    doc.text('DOCUMENTO DE PORTE', mg + nameW + 3, y + 5.5)
    y += hdrH

    const passH = 9
    passageirosFiltrados.forEach((ag, i) => {
      if (y + passH > 280) { doc.addPage(); y = 20 }
      if (i % 2 === 1) { doc.setFillColor(245, 245, 245); doc.rect(mg, y, W, passH, 'F') }
      doc.setDrawColor(0, 0, 0)
      doc.rect(mg, y, W, passH)
      doc.line(mg + nameW, y, mg + nameW, y + passH)
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.text(`${i + 1}.  ${trunc(ag.nome_passageiro.replace(/\s*\(\d+\/\d+\)\s*$/, '').toUpperCase(), 40)}`, mg + 3, y + 6.2)
      const docText = documentosRef.current[ag.id] || ''
      if (docText) {
        doc.text(trunc(docText, 25), mg + nameW + 3, y + 6.2)
      } else {
        doc.setTextColor(180, 180, 180)
        doc.text('RG/CPF', mg + nameW + 3, y + 6.2)
        doc.setTextColor(30, 30, 30)
      }
      y += passH
    })

    y += 10
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} via RotaGenda`,
      pageW / 2, y, { align: 'center' }
    )

    const turnoLabel = form.turno_filtro === 'ida' ? 'ida' : 'volta'
    doc.save(`lista-passageiros-${turnoLabel}-${format(diaSelecionado, 'dd-MM-yyyy')}.pdf`)
    setGerando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Lista de Passageiros</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs">
            {format(diaSelecionado, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · {passageirosFiltrados.length} passageiro{passageirosFiltrados.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

        {/* Seletor de turno */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Turno</p>
          <div className="grid grid-cols-2 gap-2">
            {(['ida', 'volta'] as const).map(t => (
              <button key={t} onClick={() => setForm(f => ({
                ...f,
                turno_filtro: t,
                horario_saida: t === 'ida'
                  ? rotaPrimaria?.horario_ida?.slice(0, 5) || f.horario_saida
                  : rotaPrimaria?.horario_volta?.slice(0, 5) || f.horario_saida,
                origem: t !== f.turno_filtro ? f.destino : f.origem,
                destino: t !== f.turno_filtro ? f.origem : f.destino,
              }))}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={form.turno_filtro === t
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                {t === 'ida' ? '↑ Ida' : '↓ Volta'}
              </button>
            ))}
          </div>
        </div>

        {/* Preview dos passageiros filtrados */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Passageiros no PDF ({passageirosFiltrados.length})
          </p>
          {passageirosFiltrados.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum passageiro neste turno</p>
          ) : (
            passageirosFiltrados.map((ag, i) => (
              <div key={ag.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{i + 1}. {ag.nome_passageiro}</span>
                <input
                  value={documentos[ag.id] || ''}
                  onChange={e => setDocumentos(d => ({ ...d, [ag.id]: e.target.value }))}
                  placeholder="RG ou CPF"
                  className="w-28 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-green-600 bg-gray-50 flex-shrink-0"
                />
              </div>
            ))
          )}
        </div>

        {/* Dados da empresa */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Dados da empresa</p>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Nome da empresa</p>
          <input
            value={form.nome_empresa}
            onChange={e => setForm(f => ({ ...f, nome_empresa: e.target.value }))}
            placeholder="Ex: Transportes Silva"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Razão social</p>
          <input
            value={form.razao_social}
            onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))}
            placeholder="Ex: Silva Transportes ME"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">CNPJ</p>
          <input
            value={form.cnpj}
            onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
            placeholder="Ex: 00.000.000/0001-00"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
          />
        </div>

        {/* Dados da viagem */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Dados da viagem</p>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Placa do veículo</p>
          <input
            value={form.placa}
            onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))}
            placeholder="Ex: ABC-1234"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Motorista</p>
          <input
            value={form.motorista}
            onChange={e => setForm(f => ({ ...f, motorista: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Origem da viagem</p>
            <input
              value={form.origem}
              onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
              placeholder="Ex: Boa Vista"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Destino</p>
            <input
              value={form.destino}
              onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
              placeholder="Ex: Manaus"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Horário de saída</p>
            <input
              type="time"
              value={form.horario_saida}
              onChange={e => setForm(f => ({ ...f, horario_saida: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Horário de volta (opcional)</p>
            <input
              type="time"
              value={form.horario_volta}
              onChange={e => setForm(f => ({ ...f, horario_volta: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Data da saída</p>
            <input
              type="date"
              value={form.data_saida}
              onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Data da volta (opcional)</p>
            <input
              type="date"
              value={form.data_volta}
              onChange={e => setForm(f => ({ ...f, data_volta: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 bg-white"
            />
          </div>
        </div>

        <div className="h-24" />
      </div>

      <div style={{ padding: '8px 16px 80px', background: 'white', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={gerarPDF}
          disabled={gerando || passageirosFiltrados.length === 0}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: '#185FA5' }}>
          {gerando ? 'Gerando PDF...' : '📄 Gerar e baixar PDF'}
        </button>
      </div>
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
