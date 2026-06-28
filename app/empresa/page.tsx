'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, subDays, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'

type ProximaCorrida = {
  id: string
  origem: string
  destino: string
  data_hora: string
  created_at: string
  valor: number
  status: string
  cliente_nome: string
  motoristas_empresa: { nome: string } | null
}

type ProximaAgrupada =
  | { tipo: 'simples'; corrida: ProximaCorrida }
  | { tipo: 'par'; ida: ProximaCorrida; volta: ProximaCorrida }

type DiaSemana = { data: string; total: number; label: string }
type DiaSemanaRF = { data: string; receita: number; despesa: number; label: string }

const STATUS_COR: Record<string, { bg: string; text: string; label: string }> = {
  pendente:               { bg: '#FEF3C7', text: '#92400E', label: 'Pendente' },
  confirmada:             { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
  em_andamento:           { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
  concluida:              { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
  cancelada:              { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
  recusada:               { bg: '#FCEBEB', text: '#A32D2D', label: 'Recusada' },
  parcialmente_cancelada: { bg: '#FEF3C7', text: '#92400E', label: 'Parc. cancelada' },
}

const PLANO_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', fleet: 'Fleet' }
const STATUS_EMPRESA_LABEL: Record<string, string> = { trial: 'Trial', ativo: 'Ativo', inativo: 'Inativo' }

function statusParProxima(ida: ProximaCorrida, volta: ProximaCorrida): string {
  if (ida.status === volta.status) return ida.status
  if (ida.status === 'cancelada' || volta.status === 'cancelada') return 'parcialmente_cancelada'
  return ida.status
}

function agruparProximas(corridas: ProximaCorrida[]): ProximaAgrupada[] {
  const usados = new Set<string>()
  const resultado: ProximaAgrupada[] = []
  for (let i = 0; i < corridas.length; i++) {
    if (usados.has(corridas[i].id)) continue
    const a = corridas[i]
    let parIdx = -1
    for (let j = i + 1; j < corridas.length; j++) {
      if (usados.has(corridas[j].id)) continue
      const b = corridas[j]
      if (
        a.cliente_nome === b.cliente_nome &&
        Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 30000
      ) { parIdx = j; break }
    }
    if (parIdx !== -1) {
      const b = corridas[parIdx]
      usados.add(a.id); usados.add(b.id)
      const ida = a.data_hora <= b.data_hora ? a : b
      const volta = a.data_hora <= b.data_hora ? b : a
      resultado.push({ tipo: 'par', ida, volta })
    } else {
      usados.add(a.id)
      resultado.push({ tipo: 'simples', corrida: a })
    }
  }
  return resultado
}

function contarContratos(corridas: { id: string; created_at: string; cliente_nome: string; origem: string; destino: string; data_hora?: string }[]): number {
  const usados = new Set<string>()
  let total = 0
  for (let i = 0; i < corridas.length; i++) {
    if (usados.has(corridas[i].id)) continue
    const a = corridas[i]
    let parEncontrado = false
    for (let j = i + 1; j < corridas.length; j++) {
      if (usados.has(corridas[j].id)) continue
      const b = corridas[j]
      if (
        a.cliente_nome === b.cliente_nome &&
        Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 30000
      ) {
        usados.add(a.id)
        usados.add(b.id)
        total++
        parEncontrado = true
        break
      }
    }
    if (!parEncontrado) {
      usados.add(a.id)
      total++
    }
  }
  return total
}

type SolicitacaoTransfer = {
  id: string
  empresa_id: string
  numero_reserva: number | null
  nome_cliente: string
  telefone_cliente: string
  data: string
  horario: string
  origem: string
  destino: string
  numero_voo: string | null
  forma_pagamento: string
  observacoes: string | null
  nome_passageiro2: string | null
  telefone_passageiro2: string | null
  origem_passageiro2: string | null
  destino_passageiro2: string | null
  retorno_data: string | null
  retorno_horario: string | null
  retorno_origem: string | null
  retorno_destino: string | null
  motorista_id: string | null
  valor: number | null
  status: string
  created_at: string
}

type MotoristaTransfer = {
  id: string
  nome: string
  telefone: string | null
  veiculo: string | null
  placa: string | null
  cor: string | null
}

export default function EmpresaPage() {
  const [nomeGestor, setNomeGestor] = useState<string | null>(null)
  const [gestorUserId, setGestorUserId] = useState<string | null>(null)
  const [nomeEmpresa, setNomeEmpresa] = useState<string | null>(null)
  const [plano, setPlano] = useState('')
  const [statusEmpresa, setStatusEmpresa] = useState('')

  const [corridasHoje, setCorridasHoje] = useState(0)
  const [motoristasAtivos, setMotoristasAtivos] = useState(0)
  const [receitaMes, setReceitaMes] = useState(0)
  const [aReceberMes, setAReceberMes] = useState(0)
  const [corridasConfirmadas, setCorridasConfirmadas] = useState(0)
  const [corridasSemMotorista, setCorridasSemMotorista] = useState(0)

  const [proximas, setProximas] = useState<ProximaCorrida[]>([])
  const [periodoGraficoTransfer, setPeriodoGraficoTransfer] = useState<'semana' | 'mes' | 'ano'>('semana')
  const [graficoTransfer, setGraficoTransfer] = useState<DiaSemanaRF[]>([])
  const [loadingGraficoTransfer, setLoadingGraficoTransfer] = useState(false)

  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [tipoOperacao, setTipoOperacao] = useState<string | null>(null)
  const [abaTransfer, setAbaTransfer] = useState<'painel' | 'solicitacoes'>('painel')
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoTransfer[]>([])
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false)
  const [motoristasTransfer, setMotoristasTransfer] = useState<MotoristaTransfer[]>([])
  const [fichaAberta, setFichaAberta] = useState<SolicitacaoTransfer | null>(null)
  const [motoristaIdModal, setMotoristaIdModal] = useState('')
  const [enviandoFicha, setEnviandoFicha] = useState(false)
  const [editandoValor, setEditandoValor] = useState(false)
  const [valorModal, setValorModal] = useState('')
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  useEffect(() => { carregarDados() }, [])
  useEffect(() => {
    if (empresaId && tipoOperacao && tipoOperacao !== 'rota_fixa') {
      carregarGraficoTransfer(periodoGraficoTransfer, empresaId)
    }
  }, [periodoGraficoTransfer])
  useEffect(() => {
    if (abaTransfer === 'solicitacoes' && empresaId) carregarSolicitacoes(empresaId)
  }, [abaTransfer, empresaId])

  async function carregarSolicitacoes(eid: string) {
    setLoadingSolicitacoes(true)
    const { data } = await supabase
      .from('solicitacoes_transfer')
      .select('*')
      .eq('empresa_id', eid)
      .order('created_at', { ascending: false })
    setSolicitacoes((data as SolicitacaoTransfer[]) ?? [])
    setLoadingSolicitacoes(false)
  }

  function montarMsgWhatsApp(sol: SolicitacaoTransfer, motoristaId: string): string {
    const motorista = motoristasTransfer.find(m => m.id === motoristaId)
    const dataFmt = sol.data.split('-').reverse().join('/')
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
    const diaSemana = diasSemana[new Date(sol.data + 'T12:00:00').getDay()]
    const passageiros = [sol.nome_cliente, sol.nome_passageiro2].filter(Boolean).join(', ')
    const telefones = [sol.telefone_cliente, sol.telefone_passageiro2].filter(Boolean).join(', ')

    let msg = `Olá, tudo bem?\nSegue a confirmação do *Transfer: #${sol.numero_reserva ?? ''}*\n*Data/Hora:* ${dataFmt} às ${sol.horario.slice(0, 5)} (${diaSemana})\n*Passageiros:* ${passageiros}\n*Telefones:* ${telefones}`
    if (sol.numero_voo) msg += `\n*Numero Voo:* ${sol.numero_voo}`
    msg += `\n*Origem:* ${sol.origem}\n*Destino:* ${sol.destino}`
    if (motorista) {
      msg += `\nMotorista ${motorista.nome}`
      if (motorista.veiculo) msg += `\nVeículo ${motorista.veiculo}`
      if (motorista.cor) msg += `\nCor ${motorista.cor}`
      if (motorista.placa) msg += `\nPlaca ${motorista.placa}`
      if (motorista.telefone) msg += `\nTel ${motorista.telefone}`
    }
    if (nomeEmpresa) msg += `\n*${nomeEmpresa}*`
    return msg
  }

  function abrirWhatsApp(telefone: string, msg: string) {
    const raw = telefone.replace(/\D/g, '')
    const tel = raw.startsWith('55') ? raw : `55${raw}`
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function enviarConfirmacaoWhatsApp(sol: SolicitacaoTransfer, motoristaId: string) {
    abrirWhatsApp(sol.telefone_cliente, montarMsgWhatsApp(sol, motoristaId))
  }

  async function atribuirMotorista(sol: SolicitacaoTransfer, motoristaId: string) {
    if (!motoristaId) return
    setEnviandoFicha(true)
    await supabase.from('solicitacoes_transfer').update({ motorista_id: motoristaId }).eq('id', sol.id)
    setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, motorista_id: motoristaId } : s))
    setFichaAberta(prev => prev ? { ...prev, motorista_id: motoristaId } : prev)
    setEnviandoFicha(false)
  }

  async function marcarComoConfirmado(sol: SolicitacaoTransfer, motoristaId: string) {
    setEnviandoFicha(true)
    const updateData: Record<string, unknown> = { status: 'confirmado' }
    if (motoristaId) updateData.motorista_id = motoristaId
    await supabase.from('solicitacoes_transfer').update(updateData).eq('id', sol.id)
    setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, status: 'confirmado', motorista_id: motoristaId || null } : s))
    setFichaAberta(prev => prev ? { ...prev, status: 'confirmado', motorista_id: motoristaId || null } : prev)
    setEnviandoFicha(false)
  }

  function enviarDadosMotorista(sol: SolicitacaoTransfer) {
    const mId = sol.motorista_id ?? motoristaIdModal
    abrirWhatsApp(sol.telefone_cliente, montarMsgWhatsApp(sol, mId))
  }

  async function salvarValor(sol: SolicitacaoTransfer, valorStr: string) {
    const num = parseFloat(valorStr.replace(',', '.'))
    if (isNaN(num) || num < 0) return
    setEnviandoFicha(true)
    await supabase.from('solicitacoes_transfer').update({ valor: num }).eq('id', sol.id)
    setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, valor: num } : s))
    setFichaAberta(prev => prev ? { ...prev, valor: num } : prev)
    setEditandoValor(false)
    setEnviandoFicha(false)
  }

  async function excluirSolicitacao(sol: SolicitacaoTransfer) {
    await supabase.from('solicitacoes_transfer').delete().eq('id', sol.id)
    setSolicitacoes(prev => prev.filter(s => s.id !== sol.id))
    setFichaAberta(null)
    setConfirmandoExclusao(false)
  }

  async function recusarSolicitacao(sol: SolicitacaoTransfer) {
    setEnviandoFicha(true)
    await supabase.from('solicitacoes_transfer').update({ status: 'recusado' }).eq('id', sol.id)
    setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, status: 'recusado' } : s))
    setEnviandoFicha(false)
    setFichaAberta(null)
    const dataFmt = sol.data.split('-').reverse().join('/')
    const msg = `Olá ${sol.nome_cliente}, infelizmente não conseguimos atender sua solicitação de transfer para ${dataFmt}. Entre em contato conosco para verificar disponibilidade.`
    abrirWhatsApp(sol.telefone_cliente, msg)
  }

  async function carregarDados() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setGestorUserId(session.user.id)

    const { data: gestor } = await supabase
      .from('gestores')
      .select('nome, empresa_id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) return
    setNomeGestor(gestor.nome)

    const eid = gestor.empresa_id

    const { data: empresa } = await supabase
      .from('empresas')
      .select('nome, plano, status, tipo_operacao')
      .eq('id', eid)
      .single()

    if (empresa) {
      setNomeEmpresa(empresa.nome)
      setPlano(empresa.plano)
      setStatusEmpresa(empresa.status)
    }

    if (empresa?.tipo_operacao === 'rota_fixa') {
      setEmpresaId(eid)
      setTipoOperacao('rota_fixa')
      setLoading(false)
      return
    }
    setEmpresaId(eid)
    setTipoOperacao(empresa?.tipo_operacao || 'transfer')

    await supabase.from('corridas_empresa')
      .update({ status: 'concluida' })
      .eq('empresa_id', eid)
      .eq('status', 'confirmada')
      .lt('data_hora', new Date().toISOString())

    const agora = new Date()
    const agoraISO = agora.toISOString()
    const hoje = format(agora, 'yyyy-MM-dd')
    const inicioMes = format(startOfMonth(agora), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(agora), 'yyyy-MM-dd')
    const [
      { data: cHoje },
      { data: mAtivos },
      { data: recMes },
      { data: aReceberMesData },
      { data: cConf },
      { data: cSemMot },
      { data: prox },
    ] = await Promise.all([
      supabase.from('corridas_empresa').select('id, created_at, cliente_nome, origem, destino').eq('empresa_id', eid)
        .gte('data_hora', `${hoje}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`)
        .neq('status', 'cancelada'),
      supabase.from('motoristas_empresa').select('id, nome, telefone, veiculo, placa, cor')
        .eq('empresa_id', eid).eq('status', 'ativo').order('nome'),
      supabase.from('corridas_empresa').select('valor').eq('empresa_id', eid)
        .eq('status', 'concluida')
        .gte('data_hora', `${inicioMes}T00:00:00`).lte('data_hora', `${fimMes}T23:59:59`),
      supabase.from('corridas_empresa').select('valor').eq('empresa_id', eid)
        .eq('status', 'confirmada')
        .gte('data_hora', `${inicioMes}T00:00:00`).lte('data_hora', `${fimMes}T23:59:59`),
      supabase.from('corridas_empresa').select('id, created_at, cliente_nome, origem, destino, data_hora').eq('empresa_id', eid)
        .eq('status', 'confirmada').gte('data_hora', agoraISO),
      supabase.from('corridas_empresa').select('id').eq('empresa_id', eid)
        .is('motorista_id', null).eq('status', 'confirmada').gte('data_hora', agoraISO),
      supabase.from('corridas_empresa')
        .select('id, origem, destino, data_hora, created_at, valor, status, cliente_nome, motoristas_empresa(nome)')
        .eq('empresa_id', eid).gte('data_hora', agoraISO)
        .order('data_hora').limit(5),
    ])

    setCorridasHoje(contarContratos(cHoje ?? []))
    setMotoristasAtivos(mAtivos?.length ?? 0)
    setMotoristasTransfer((mAtivos as unknown as MotoristaTransfer[]) ?? [])
    setReceitaMes(recMes?.reduce((s, c) => s + (Number(c.valor) || 0), 0) ?? 0)
    setAReceberMes(aReceberMesData?.reduce((s, c) => s + (Number(c.valor) || 0), 0) ?? 0)
    setCorridasConfirmadas(contarContratos(cConf ?? []))
    setCorridasSemMotorista(cSemMot?.length ?? 0)
    setProximas((prox as any) ?? [])

    await carregarGraficoTransfer('semana', eid)

    setLoading(false)
  }

  async function carregarGraficoTransfer(periodo: 'semana' | 'mes' | 'ano', eid: string) {
    setLoadingGraficoTransfer(true)
    const agora = new Date()
    const anoAtual = agora.getFullYear()

    if (periodo === 'semana') {
      const ha7 = format(subDays(agora, 6), 'yyyy-MM-dd')
      const hoje = format(agora, 'yyyy-MM-dd')
      const [{ data: corrData }, { data: despData }] = await Promise.all([
        supabase.from('corridas_empresa').select('data_hora, valor')
          .eq('empresa_id', eid).neq('status', 'cancelada')
          .gte('data_hora', `${ha7}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`),
        supabase.from('despesas_empresa').select('data, valor')
          .eq('empresa_id', eid).gte('data', ha7).lte('data', hoje),
      ])
      const pontos: DiaSemanaRF[] = []
      for (let i = 6; i >= 0; i--) {
        const d = subDays(agora, i)
        const dStr = format(d, 'yyyy-MM-dd')
        const raw = format(d, 'EEE', { locale: ptBR })
        const label = raw.charAt(0).toUpperCase() + raw.slice(1, 3)
        const receita = (corrData ?? []).filter(r => r.data_hora.slice(0, 10) === dStr).reduce((s, r) => s + Number(r.valor), 0)
        const despesa = (despData ?? []).filter(d => d.data === dStr).reduce((s, d) => s + Number(d.valor), 0)
        pontos.push({ data: dStr, receita, despesa, label })
      }
      setGraficoTransfer(pontos)

    } else if (periodo === 'mes') {
      const ini = format(startOfMonth(agora), 'yyyy-MM-dd')
      const fim = format(endOfMonth(agora), 'yyyy-MM-dd')
      const [{ data: corrData }, { data: despData }] = await Promise.all([
        supabase.from('corridas_empresa').select('data_hora, valor')
          .eq('empresa_id', eid).neq('status', 'cancelada')
          .gte('data_hora', `${ini}T00:00:00`).lte('data_hora', `${fim}T23:59:59`),
        supabase.from('despesas_empresa').select('data, valor')
          .eq('empresa_id', eid).gte('data', ini).lte('data', fim),
      ])
      const totalDias = endOfMonth(agora).getDate()
      const semanasConf = [
        { label: 'Sem 1', ini: 1,  fim: 7  },
        { label: 'Sem 2', ini: 8,  fim: 14 },
        { label: 'Sem 3', ini: 15, fim: 21 },
        { label: 'Sem 4', ini: 22, fim: 28 },
        ...(totalDias > 28 ? [{ label: 'Sem 5', ini: 29, fim: totalDias }] : []),
      ]
      const pontos: DiaSemanaRF[] = semanasConf.map(s => {
        const inRange = (dateStr: string) => { const day = +dateStr.slice(8, 10); return day >= s.ini && day <= s.fim }
        const receita = (corrData ?? []).filter(r => inRange(r.data_hora.slice(0, 10))).reduce((sum, r) => sum + Number(r.valor), 0)
        const despesa = (despData ?? []).filter(d => inRange(d.data)).reduce((sum, d) => sum + Number(d.valor), 0)
        return { data: s.label, receita, despesa, label: s.label }
      })
      setGraficoTransfer(pontos)

    } else {
      const inicioAno = `${anoAtual}-01-01`
      const fimAno   = `${anoAtual}-12-31`
      const [{ data: corrData }, { data: despData }] = await Promise.all([
        supabase.from('corridas_empresa').select('data_hora, valor')
          .eq('empresa_id', eid).neq('status', 'cancelada')
          .gte('data_hora', `${inicioAno}T00:00:00`).lte('data_hora', `${fimAno}T23:59:59`),
        supabase.from('despesas_empresa').select('data, valor')
          .eq('empresa_id', eid).gte('data', inicioAno).lte('data', fimAno),
      ])
      const mesesLabel = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const pontos: DiaSemanaRF[] = mesesLabel.map((label, idx) => {
        const prefix = `${anoAtual}-${String(idx + 1).padStart(2, '0')}`
        const receita = (corrData ?? []).filter(r => r.data_hora.startsWith(prefix)).reduce((s, r) => s + Number(r.valor), 0)
        const despesa = (despData ?? []).filter(d => d.data.startsWith(prefix)).reduce((s, d) => s + Number(d.valor), 0)
        return { data: prefix, receita, despesa, label }
      })
      setGraficoTransfer(pontos)
    }

    setLoadingGraficoTransfer(false)
  }

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  if (loading) {
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

  if (tipoOperacao === 'rota_fixa' && empresaId) {
    return <DashboardRotaFixa nomeGestor={nomeGestor} nomeEmpresa={nomeEmpresa} empresaId={empresaId} gestorUserId={gestorUserId} />
  }

  const hojeStr = format(new Date(), 'yyyy-MM-dd')
  const maxBarTransfer = Math.max(...graficoTransfer.map(d => Math.max(d.receita, d.despesa)), 1)
  const temDadosGraficoTransfer = graficoTransfer.some(d => d.receita > 0 || d.despesa > 0)
  const totalRecTransfer = graficoTransfer.reduce((s, d) => s + d.receita, 0)
  const totalDespTransfer = graficoTransfer.reduce((s, d) => s + d.despesa, 0)
  const lucroTransfer = totalRecTransfer - totalDespTransfer

  return (
    <div className="pb-24">
      {/* Header verde */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-5">
        <div className="flex justify-between items-start">
          <div>
            <p style={{ color: '#9FE1CB' }} className="text-xs">{saudacao},</p>
            <p style={{ color: '#E1F5EE' }} className="text-xl font-bold leading-tight">
              {nomeGestor?.split(' ')[0] || '...'}
            </p>
            {nomeEmpresa && (
              <p style={{ color: '#9FE1CB' }} className="text-xs mt-0.5">{nomeEmpresa}</p>
            )}
          </div>
        </div>
      </div>

      {/* Abas Painel / Solicitações (só transfer) */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1">
        {([
          { key: 'painel', label: 'Painel' },
          { key: 'solicitacoes', label: `Solicitações${solicitacoes.filter(s => s.status === 'pendente').length > 0 ? ` (${solicitacoes.filter(s => s.status === 'pendente').length})` : ''}` },
        ] as { key: 'painel' | 'solicitacoes'; label: string }[]).map(aba => (
          <button key={aba.key} onClick={() => setAbaTransfer(aba.key)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
            style={abaTransfer === aba.key
              ? { background: '#0F6E56', color: '#fff' }
              : { background: '#f3f4f6', color: '#9ca3af' }}>
            {aba.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4" style={abaTransfer === 'solicitacoes' ? { display: 'none' } : {}}>

        {/* Banner boas-vindas (primeira vez, sem motoristas) */}
        {!loading && motoristasAtivos === 0 && corridasHoje === 0 && (
          <BannerBoasVindas />
        )}

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <CardMetrica label="Corridas hoje" valor={corridasHoje} emoji="📋" cor="#0F6E56" />
          <CardMetrica label="Motoristas ativos" valor={motoristasAtivos} emoji="🚗" cor="#0F6E56" />
          <CardMetrica
            label="Receita do mês"
            valor={`R$ ${receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            emoji="💰"
            cor="#1D9E75"
          />
          <CardMetrica
            label="A receber"
            valor={`R$ ${aReceberMes.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            emoji="🕐"
            cor="#1D4ED8"
          />
        </div>

        {/* Alertas */}
        {corridasSemMotorista > 0 ? (
          <Link href="/empresa/agendamentos"
            className="rounded-xl px-4 py-3 flex items-center gap-3 active:opacity-80"
            style={{ background: '#FAEEDA', border: '1px solid #FAC775' }}>
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#854F0B' }}>
                {corridasSemMotorista} corrida{corridasSemMotorista !== 1 ? 's' : ''} sem motorista atribuído
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#A0622A' }}>
                Toque para ver os agendamentos
              </p>
            </div>
            <span style={{ color: '#FAC775' }} className="text-lg flex-shrink-0">›</span>
          </Link>
        ) : (
          <div className="rounded-xl px-4 py-3 flex items-center gap-2"
            style={{ background: '#E1F5EE', border: '1px solid #9FE1CB' }}>
            <span className="text-base">✓</span>
            <p className="text-sm font-medium" style={{ color: '#085041' }}>Tudo em ordem</p>
          </div>
        )}

        {/* Próximas corridas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Próximas corridas</p>
            <Link href="/empresa/agendamentos?todos=1"
              className="text-xs font-medium" style={{ color: '#0F6E56' }}>
              Ver todas →
            </Link>
          </div>

          {proximas.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm font-medium text-gray-700">Nenhuma corrida agendada</p>
              <p className="text-xs text-gray-400 mt-1 mb-3">Que tal agendar a primeira?</p>
              <Link href="/empresa/agendamentos"
                className="inline-block px-5 py-2 rounded-xl text-xs font-semibold"
                style={{ background: '#1D9E75', color: '#fff' }}>
                + Nova corrida
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {agruparProximas(proximas).map(grupo => {
                if (grupo.tipo === 'simples') {
                  const c = grupo.corrida
                  const cor = STATUS_COR[c.status] ?? STATUS_COR.confirmada
                  const motoristaNome = (c.motoristas_empresa as any)?.nome ?? null
                  return (
                    <Link key={c.id} href={`/empresa/agendamentos?ficha=${c.id}`}
                      className="block bg-white rounded-2xl px-4 py-3 border border-gray-100"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)', borderColor: c.status === 'pendente' ? '#FCD34D' : undefined }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {c.origem} → {c.destino}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {c.data_hora.slice(8, 10)}/{c.data_hora.slice(5, 7)} às {c.data_hora.slice(11, 16)}
                            {motoristaNome
                              ? <> · <span className="text-gray-500">{motoristaNome}</span></>
                              : <> · <span style={{ color: '#A32D2D' }}>Sem motorista</span></>
                            }
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: cor.bg, color: cor.text }}>
                            {cor.label}
                          </span>
                          <p className="text-xs font-bold" style={{ color: '#0F6E56' }}>
                            R$ {Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                }
                const { ida, volta } = grupo
                const statusKey = statusParProxima(ida, volta)
                const cor = STATUS_COR[statusKey] ?? STATUS_COR.confirmada
                const valorTotal = Number(ida.valor) + Number(volta.valor)
                const motoristaNome = (ida.motoristas_empresa as any)?.nome ?? (volta.motoristas_empresa as any)?.nome ?? null
                return (
                  <div key={`${ida.id}-${volta.id}`} className="bg-white rounded-2xl px-4 py-3 border border-gray-100"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {ida.origem} → {ida.destino}
                          </p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                            ↔ Ida e volta
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {ida.data_hora.slice(8, 10)}/{ida.data_hora.slice(5, 7)} · Ida {ida.data_hora.slice(11, 16)} · Volta {volta.data_hora.slice(11, 16)}
                          {motoristaNome
                            ? <> · <span className="text-gray-500">{motoristaNome}</span></>
                            : <> · <span style={{ color: '#A32D2D' }}>Sem motorista</span></>
                          }
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: cor.bg, color: cor.text }}>
                          {cor.label}
                        </span>
                        <p className="text-xs font-bold" style={{ color: '#0F6E56' }}>
                          R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Gráfico comparativo Receita x Despesa */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

          <div className="flex gap-1.5 mb-3">
            {(['semana', 'mes', 'ano'] as const).map(p => (
              <button key={p} onClick={() => setPeriodoGraficoTransfer(p)}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                style={periodoGraficoTransfer === p
                  ? { background: '#0F6E56', color: '#fff' }
                  : { background: '#f3f4f6', color: '#9ca3af' }}>
                {p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Receita x Despesa</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#1D9E75' }} />
                <span className="text-[10px] text-gray-500">Receita</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#E24B4A' }} />
                <span className="text-[10px] text-gray-500">Despesa</span>
              </div>
            </div>
          </div>

          {loadingGraficoTransfer ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-2xl animate-pulse">📊</div>
            </div>
          ) : !temDadosGraficoTransfer ? (
            <div className="text-center py-5">
              <p className="text-xs text-gray-400">Nenhum dado no período</p>
            </div>
          ) : (
            <div>
              <div className="flex items-end" style={{ height: '64px', gap: graficoTransfer.length > 7 ? '2px' : '6px' }}>
                {graficoTransfer.map((d, i) => {
                  const recH  = maxBarTransfer > 0 ? Math.max(Math.round((d.receita / maxBarTransfer) * 60), d.receita  > 0 ? 4 : 0) : 0
                  const despH = maxBarTransfer > 0 ? Math.max(Math.round((d.despesa / maxBarTransfer) * 60), d.despesa > 0 ? 4 : 0) : 0
                  const anoMesAtual = format(new Date(), 'yyyy-MM')
                  const eHoje = periodoGraficoTransfer === 'semana'
                    ? d.data === hojeStr
                    : periodoGraficoTransfer === 'ano'
                      ? d.data === anoMesAtual
                      : false
                  return (
                    <div key={i} className="flex-1 flex items-end gap-px">
                      <div className="flex-1 rounded-t-sm"
                        style={{
                          height: d.receita > 0 ? `${recH}px` : '2px',
                          background: d.receita > 0 ? '#1D9E75' : '#e5e7eb',
                          opacity: eHoje ? 1 : 0.72,
                        }} />
                      <div className="flex-1 rounded-t-sm"
                        style={{
                          height: d.despesa > 0 ? `${despH}px` : '2px',
                          background: d.despesa > 0 ? '#E24B4A' : '#e5e7eb',
                          opacity: eHoje ? 1 : 0.72,
                        }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex mt-1.5" style={{ gap: graficoTransfer.length > 7 ? '2px' : '6px' }}>
                {graficoTransfer.map((d, i) => {
                  const anoMesAtual = format(new Date(), 'yyyy-MM')
                  const eHoje = periodoGraficoTransfer === 'semana'
                    ? d.data === hojeStr
                    : periodoGraficoTransfer === 'ano'
                      ? d.data === anoMesAtual
                      : false
                  return (
                    <p key={i} className="flex-1 text-center leading-none"
                      style={{ fontSize: '8px', color: eHoje ? '#0F6E56' : '#9ca3af', fontWeight: eHoje ? 700 : 400 }}>
                      {d.label}
                    </p>
                  )
                })}
              </div>
              <div className="flex justify-around mt-3 pt-3 border-t border-gray-50">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">Receita</p>
                  <p className="text-xs font-bold" style={{ color: '#1D9E75' }}>
                    R$ {totalRecTransfer.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">Despesa</p>
                  <p className="text-xs font-bold" style={{ color: '#E24B4A' }}>
                    R$ {totalDespTransfer.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">Lucro</p>
                  <p className="text-xs font-bold" style={{ color: lucroTransfer >= 0 ? '#0F6E56' : '#E24B4A' }}>
                    R$ {Math.abs(lucroTransfer).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Atalhos rápidos */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Atalhos rápidos</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { emoji: '📋', label: 'Nova corrida', href: '/empresa/agendamentos?nova=1' },
              { emoji: '💰', label: 'Financeiro', href: '/empresa/financeiro' },
              { emoji: '🚗', label: 'Motoristas', href: '/empresa/motoristas' },
              { emoji: '🛣️', label: 'Operar rota', href: '/dashboard/agenda' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="bg-white rounded-2xl flex flex-col items-center justify-center py-4 gap-1.5 active:opacity-75"
                style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <span className="text-2xl leading-none">{item.emoji}</span>
                <span className="text-[11px] font-semibold text-gray-600 text-center leading-tight px-1">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* Solicitações de Transfer */}
      {abaTransfer === 'solicitacoes' && (
        <div className="px-4 py-4 flex flex-col gap-3">
          {loadingSolicitacoes ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-3xl">📋</div>
            </div>
          ) : solicitacoes.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm font-medium text-gray-700">Nenhuma solicitação recebida</p>
              <p className="text-xs text-gray-400 mt-1">
                Compartilhe o link de transfer para começar a receber solicitações
              </p>
            </div>
          ) : (
            solicitacoes.map(sol => {
              const statusBadge =
                sol.status === 'confirmado'
                  ? { bg: '#E1F5EE', text: '#085041', label: 'Confirmado' }
                  : sol.status === 'recusado'
                  ? { bg: '#FCEBEB', text: '#A32D2D', label: 'Recusado' }
                  : { bg: '#FAEEDA', text: '#854F0B', label: 'Pendente' }

              const dataFmt = sol.data.split('-').reverse().join('/')

              return (
                <button
                  key={sol.id}
                  onClick={() => { setFichaAberta(sol); setMotoristaIdModal(sol.motorista_id ?? ''); setValorModal(sol.valor?.toString() ?? ''); setEditandoValor(false); setConfirmandoExclusao(false) }}
                  className="w-full bg-white rounded-2xl p-4 border border-gray-100 text-left flex flex-col gap-2 active:opacity-75"
                  style={{ borderColor: sol.status === 'pendente' ? '#FCD34D' : undefined }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {sol.numero_reserva && (
                        <p className="text-[10px] font-semibold text-gray-400 mb-0.5">#{sol.numero_reserva}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-800 truncate">{sol.nome_cliente}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">📍 {sol.origem} → {sol.destino}</p>
                      <p className="text-xs text-gray-400">📅 {dataFmt} às {sol.horario.slice(0, 5)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
                        style={{ background: statusBadge.bg, color: statusBadge.text }}>
                        {statusBadge.label}
                      </span>
                      <span className="text-gray-300 text-sm">›</span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* Modal ficha completa */}
      {fichaAberta && (
        <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setFichaAberta(null)} style={{ color: '#9FE1CB' }} className="text-2xl leading-none">‹</button>
            <div className="flex-1 min-w-0">
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
                Transfer{fichaAberta.numero_reserva ? ` #${fichaAberta.numero_reserva}` : ''}
              </p>
              <p style={{ color: '#9FE1CB' }} className="text-[10px] mt-0.5">
                Solicitado em {fichaAberta.created_at.slice(8,10)}/{fichaAberta.created_at.slice(5,7)}/{fichaAberta.created_at.slice(0,4)} às {fichaAberta.created_at.slice(11,16)}
              </p>
            </div>
            <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full"
              style={{
                background: fichaAberta.status === 'confirmado' ? '#E1F5EE' : fichaAberta.status === 'recusado' ? '#FCEBEB' : '#FAEEDA',
                color: fichaAberta.status === 'confirmado' ? '#085041' : fichaAberta.status === 'recusado' ? '#A32D2D' : '#854F0B',
              }}>
              {fichaAberta.status === 'confirmado' ? 'Confirmado' : fichaAberta.status === 'recusado' ? 'Recusado' : 'Pendente'}
            </span>
            <button
              onClick={() => setConfirmandoExclusao(true)}
              className="ml-1 p-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              title="Excluir solicitação">
              🗑️
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 flex flex-col gap-3">
            {/* Viagem */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Viagem</p>
              <p className="text-sm font-semibold text-gray-800">{fichaAberta.origem} → {fichaAberta.destino}</p>
              <p className="text-xs text-gray-500">📅 {fichaAberta.data.split('-').reverse().join('/')} às {fichaAberta.horario.slice(0, 5)}</p>
              {fichaAberta.numero_voo && <p className="text-xs text-gray-500">✈️ Voo: {fichaAberta.numero_voo}</p>}
              <p className="text-xs text-gray-500">
                {fichaAberta.forma_pagamento === 'cartao' ? '💳 Cartão' : fichaAberta.forma_pagamento === 'pix' ? '📱 Pix' : '📄 Faturado'}
              </p>
            </div>

            {/* Cliente */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Cliente</p>
              <p className="text-sm font-semibold text-gray-800">{fichaAberta.nome_cliente}</p>
              <p className="text-xs text-gray-500">📱 {fichaAberta.telefone_cliente}</p>
            </div>

            {/* Passageiro adicional */}
            {fichaAberta.nome_passageiro2 && (
              <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: '#EFF6FF' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#1D4ED8' }}>👥 2º Passageiro</p>
                <p className="text-sm font-semibold" style={{ color: '#1D4ED8' }}>{fichaAberta.nome_passageiro2}</p>
                {fichaAberta.telefone_passageiro2 && <p className="text-xs" style={{ color: '#1D4ED8' }}>📱 {fichaAberta.telefone_passageiro2}</p>}
                {fichaAberta.origem_passageiro2 && (
                  <p className="text-xs" style={{ color: '#1D4ED8' }}>📍 {fichaAberta.origem_passageiro2} → {fichaAberta.destino_passageiro2}</p>
                )}
              </div>
            )}

            {/* Retorno */}
            {fichaAberta.retorno_data && (
              <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: '#F0FDF4' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#166534' }}>🔄 Retorno</p>
                <p className="text-xs" style={{ color: '#166534' }}>
                  📅 {fichaAberta.retorno_data.split('-').reverse().join('/')} às {(fichaAberta.retorno_horario ?? '').slice(0, 5)}
                </p>
                {fichaAberta.retorno_origem && (
                  <p className="text-xs" style={{ color: '#166534' }}>📍 {fichaAberta.retorno_origem} → {fichaAberta.retorno_destino}</p>
                )}
              </div>
            )}

            {/* Observações */}
            {fichaAberta.observacoes && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Observações</p>
                <p className="text-sm text-gray-700">{fichaAberta.observacoes}</p>
              </div>
            )}

            {/* Motorista */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Motorista</p>
              {motoristasTransfer.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum motorista ativo cadastrado</p>
              ) : (
                <select
                  value={motoristaIdModal}
                  onChange={e => setMotoristaIdModal(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white outline-none"
                >
                  <option value="">Selecione o motorista...</option>
                  {motoristasTransfer.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome}{m.veiculo ? ` — ${m.veiculo}` : ''}{m.placa ? ` (${m.placa})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Valor */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Valor</p>
                {!editandoValor && (
                  <button onClick={() => { setEditandoValor(true); setValorModal(fichaAberta.valor?.toString() ?? '') }}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ color: '#0F6E56', background: '#E1F5EE' }}>
                    ✏️ Editar
                  </button>
                )}
              </div>
              {editandoValor ? (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valorModal}
                      onChange={e => setValorModal(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white outline-none"
                      placeholder="0,00"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => salvarValor(fichaAberta, valorModal)}
                    disabled={enviandoFicha}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                    style={{ background: '#0F6E56', color: '#fff' }}>
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditandoValor(false)}
                    className="px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: '#F3F4F6', color: '#6B7280' }}>
                    ✕
                  </button>
                </div>
              ) : (
                <p className="text-sm font-semibold text-gray-800">
                  {fichaAberta.valor != null
                    ? `R$ ${fichaAberta.valor.toFixed(2).replace('.', ',')}`
                    : <span className="text-gray-400 font-normal">Não informado</span>}
                </p>
              )}
            </div>
          </div>

          {/* Confirmação de exclusão */}
          {confirmandoExclusao && (
            <div className="fixed inset-0 z-[300] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <div className="bg-white rounded-t-3xl p-6 w-full max-w-md flex flex-col gap-4">
                <p className="text-base font-bold text-gray-800 text-center">Excluir solicitação?</p>
                <p className="text-sm text-gray-500 text-center">Esta ação não pode ser desfeita. A solicitação de {fichaAberta.nome_cliente} será removida permanentemente.</p>
                <button
                  onClick={() => excluirSolicitacao(fichaAberta)}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#DC2626', color: '#fff' }}>
                  Sim, excluir
                </button>
                <button
                  onClick={() => setConfirmandoExclusao(false)}
                  className="w-full py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#F3F4F6', color: '#374151' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex-shrink-0 px-4 py-4 border-t border-gray-100 flex flex-col gap-2">
            {fichaAberta.status !== 'recusado' && motoristaIdModal && motoristaIdModal !== fichaAberta.motorista_id && (
              <button
                onClick={() => atribuirMotorista(fichaAberta, motoristaIdModal)}
                disabled={enviandoFicha}
                className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: '#0F6E56', color: '#fff' }}>
                {enviandoFicha ? 'Salvando...' : '✓ Salvar motorista'}
              </button>
            )}
            {fichaAberta.status === 'pendente' && (
              <>
                <button
                  onClick={() => enviarConfirmacaoWhatsApp(fichaAberta, motoristaIdModal)}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#25D366', color: '#fff' }}>
                  💬 Enviar confirmação via WhatsApp
                </button>
                <button
                  onClick={() => marcarComoConfirmado(fichaAberta, motoristaIdModal)}
                  disabled={enviandoFicha}
                  className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: '#E1F5EE', color: '#085041' }}>
                  {enviandoFicha ? 'Salvando...' : '✓ Marcar como confirmado'}
                </button>
                <button
                  onClick={() => recusarSolicitacao(fichaAberta)}
                  disabled={enviandoFicha}
                  className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                  Recusar solicitação
                </button>
              </>
            )}
            {fichaAberta.status === 'confirmado' && (
              <button
                onClick={() => enviarDadosMotorista(fichaAberta)}
                className="w-full py-3.5 rounded-xl text-sm font-semibold"
                style={{ background: '#25D366', color: '#fff' }}>
                💬 Enviar dados do motorista via WhatsApp
              </button>
            )}
            {fichaAberta.status === 'recusado' && (
              <div className="rounded-xl px-3 py-3 text-center" style={{ background: '#FCEBEB' }}>
                <p className="text-sm font-medium" style={{ color: '#A32D2D' }}>✕ Solicitação recusada</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BannerBoasVindas() {
  const passos = [
    { num: '1', label: 'Configure sua empresa',   href: '/empresa/configuracoes' },
    { num: '2', label: 'Cadastre seus motoristas', href: '/empresa/motoristas'   },
    { num: '3', label: 'Adicione suas rotas',      href: '/empresa/rotas'        },
  ]
  return (
    <div className="rounded-2xl p-4 border"
      style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
      <p className="text-sm font-bold mb-1" style={{ color: '#085041' }}>
        🎉 Bem-vindo ao RotaGenda Empresarial!
      </p>
      <p className="text-xs mb-3" style={{ color: '#0F6E56' }}>
        Seu trial de 15 dias começou. Siga os passos abaixo para configurar sua conta.
      </p>
      <div className="flex flex-col gap-2">
        {passos.map(p => (
          <Link key={p.num} href={p.href}
            className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 active:opacity-75"
            style={{ border: '1px solid #9FE1CB' }}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: '#0F6E56', color: '#fff' }}>
              {p.num}
            </span>
            <p className="text-xs font-semibold flex-1" style={{ color: '#085041' }}>{p.label}</p>
            <span style={{ color: '#9FE1CB' }} className="text-sm">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function CardMetrica({
  label,
  valor,
  emoji,
  cor,
}: {
  label: string
  valor: number | string
  emoji: string
  cor: string
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400 leading-tight">{label}</p>
        <span className="text-base leading-none">{emoji}</span>
      </div>
      <p className="text-2xl font-bold leading-none" style={{ color: cor }}>
        {valor}
      </p>
    </div>
  )
}

// ─── Dashboard rota_fixa ──────────────────────────────────────────────────────

type AgRF = {
  id: string
  motorista_id: string
  nome_passageiro: string
  parada_origem: string
  parada_destino: string
  turno: string
  data_viagem: string
  valor: number
  forma_pagamento: string | null
  status: string
  telefone_passageiro?: string | null
}

type MotEmpresa = {
  id: string
  user_id: string | null
  nome: string
  veiculo: string | null
  placa: string | null
  status: string
}

type RotaRFPainel = {
  id: string
  nome: string | null
  horario_ida: string | null
  horario_volta: string | null
  capacidade: number | null
  motorista_id: string | null
  dias_semana: number[] | null
}

function DashboardRotaFixa({
  nomeGestor,
  nomeEmpresa,
  empresaId,
  gestorUserId,
}: {
  nomeGestor: string | null
  nomeEmpresa: string | null
  empresaId: string
  gestorUserId: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [motById, setMotById] = useState<Record<string, MotEmpresa>>({})
  const [rotasHoje, setRotasHoje] = useState<RotaRFPainel[]>([])
  const [agsHoje, setAgsHoje] = useState<AgRF[]>([])
  const [corridasPubHoje, setCorridasPubHoje] = useState<{ id: string; rota_id: string | null; valor: number }[]>([])
  const [passageirosHoje, setPassageirosHoje] = useState(0)
  const [receitaDia, setReceitaDia] = useState(0)
  const [naoConfirmados, setNaoConfirmados] = useState(0)
  const [fiadoVencido, setFiadoVencido] = useState(0)
  // Reativar quando a tela de preenchimento de checklist existir:
  // const [checklistPendentes, setChecklistPendentes] = useState(0)
  const [receitaMes, setReceitaMes] = useState(0)
  const [despesasMes, setDespesasMes] = useState(0)
  const [aReceber, setAReceber] = useState(0)
  const [chartPeriodo, setChartPeriodo] = useState<'semana' | 'mes' | 'ano'>('mes')
  const [chartDados, setChartDados] = useState<DiaSemanaRF[]>([])
  const [loadingChart, setLoadingChart] = useState(false)
  const [modalPendentes, setModalPendentes] = useState(false)
  const [pendentes, setPendentes] = useState<AgRF[]>([])
  const motUserIdsRef = useRef<string[]>([])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  useEffect(() => { carregarDados() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loading) carregarGrafico(chartPeriodo) }, [loading, chartPeriodo])

  async function carregarDados() {
    const agora = new Date()
    const hojeStr = format(agora, 'yyyy-MM-dd')
    const amanhaStr = format(addDays(agora, 1), 'yyyy-MM-dd')
    const inicioMes = format(startOfMonth(agora), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(agora), 'yyyy-MM-dd')
    const diaHoje = agora.getDay()

    const [{ data: mots }, { data: rotasData }, { data: cobMesData }] = await Promise.all([
      supabase.from('motoristas_empresa')
        .select('id, user_id, nome, veiculo, placa, status')
        .eq('empresa_id', empresaId).eq('status', 'ativo').order('nome'),
      supabase.from('rotas_empresa')
        .select('id, nome, horario_ida, horario_volta, capacidade, motorista_id, dias_semana')
        .eq('empresa_id', empresaId).eq('ativa', true),
      supabase.from('cobrancas_empresa')
        .select('tipo, valor')
        .eq('empresa_id', empresaId).in('tipo', ['receita', 'despesa'])
        .gte('data', inicioMes).lte('data', fimMes),
    ])

    const motsAtivos = (mots ?? []) as MotEmpresa[]
    const motByIdMap = Object.fromEntries(motsAtivos.map(m => [m.id, m]))
    setMotById(motByIdMap)

    const rotasHojeArr = ((rotasData ?? []) as RotaRFPainel[])
      .filter(r => r.dias_semana?.some(d => Number(d) === diaHoje) ?? false)
    setRotasHoje(rotasHojeArr)

    const cob = cobMesData ?? []
    const recCob = cob.filter((c: any) => c.tipo === 'receita').reduce((s: number, c: any) => s + Number(c.valor), 0)
    const despCob = cob.filter((c: any) => c.tipo === 'despesa').reduce((s: number, c: any) => s + Number(c.valor), 0)
    setDespesasMes(despCob)

    const motoristasUserIds = motsAtivos.map(m => m.user_id).filter(Boolean) as string[]
    motUserIdsRef.current = motoristasUserIds
    // Inclui o próprio gestor para que agendamentos criados por ele também apareçam
    const userIds = gestorUserId && !motoristasUserIds.includes(gestorUserId)
      ? [...motoristasUserIds, gestorUserId]
      : motoristasUserIds

    // Sempre busca corridas_empresa independente de ter motoristas ativos
    const { data: corrPubHojeData, error: corrPubErr } = await supabase.from('corridas_empresa')
      .select('id, rota_id, valor')
      .eq('empresa_id', empresaId)
      .gte('data_hora', hojeStr)
      .lt('data_hora', amanhaStr)
      .neq('status', 'cancelada')

    if (corrPubErr) console.error('corridas_empresa erro:', corrPubErr)

    const corrPub = (corrPubHojeData ?? []) as { id: string; rota_id: string | null; valor: number }[]
    setCorridasPubHoje(corrPub)

    if (userIds.length === 0) {
      setPassageirosHoje(corrPub.length)
      setReceitaDia(corrPub.reduce((s, c) => s + Number(c.valor), 0))
      setReceitaMes(recCob)
      setLoading(false)
      return
    }

    const [
      { data: agsHojeData },
      { data: naoConfData },
      { data: fiadoData },
      { data: aReceberData },
      { data: recMesData },
    ] = await Promise.all([
      supabase.from('agendamentos')
        .select('id, motorista_id, nome_passageiro, parada_origem, parada_destino, turno, data_viagem, valor, forma_pagamento, status')
        .in('motorista_id', userIds).eq('data_viagem', hojeStr).neq('status', 'cancelado'),
      supabase.from('agendamentos').select('id')
        .in('motorista_id', userIds).in('data_viagem', [hojeStr, amanhaStr]).eq('status', 'agendado'),
      supabase.from('agendamentos').select('id, motorista_id, nome_passageiro, telefone_passageiro, parada_origem, parada_destino, turno, data_viagem, valor')
        .in('motorista_id', userIds).eq('forma_pagamento', 'pendente').neq('status', 'cancelado').lt('data_viagem', hojeStr).order('data_viagem'),
      supabase.from('agendamentos').select('valor')
        .in('motorista_id', userIds).eq('forma_pagamento', 'pendente').neq('status', 'cancelado'),
      supabase.from('agendamentos').select('valor')
        .in('motorista_id', userIds).gte('data_viagem', inicioMes).lte('data_viagem', fimMes).neq('status', 'cancelado'),
    ])

    const hojeAgs = (agsHojeData ?? []) as AgRF[]
    setAgsHoje(hojeAgs)
    setPassageirosHoje(hojeAgs.length + corrPub.length)
    setReceitaDia(
      hojeAgs.reduce((s, a) => s + Number(a.valor), 0) +
      corrPub.reduce((s, c) => s + Number(c.valor), 0)
    )
    setNaoConfirmados(naoConfData?.length ?? 0)
    setFiadoVencido(fiadoData?.length ?? 0)
    setPendentes((fiadoData ?? []) as AgRF[])
    setReceitaMes((recMesData ?? []).reduce((s, a) => s + Number(a.valor), 0) + recCob)
    setAReceber((aReceberData ?? []).reduce((s, a) => s + Number(a.valor), 0))

    setLoading(false)
  }

  async function carregarGrafico(periodo: 'semana' | 'mes' | 'ano') {
    setLoadingChart(true)
    const agora = new Date()
    const userIds = motUserIdsRef.current

    let grupos: { inicio: string; fim: string; label: string }[] = []

    if (periodo === 'semana') {
      grupos = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(agora, 6 - i)
        const ds = format(d, 'yyyy-MM-dd')
        return { inicio: ds, fim: ds, label: format(d, 'EEE', { locale: ptBR }).slice(0, 3) }
      })
    } else if (periodo === 'mes') {
      const mesInicio = startOfMonth(agora)
      const mesFim = endOfMonth(agora)
      let cur = new Date(mesInicio)
      let sem = 1
      while (cur <= mesFim) {
        const wEnd = new Date(cur)
        wEnd.setDate(wEnd.getDate() + 6)
        if (wEnd > mesFim) wEnd.setTime(mesFim.getTime())
        grupos.push({
          inicio: format(cur, 'yyyy-MM-dd'),
          fim: format(wEnd, 'yyyy-MM-dd'),
          label: `S${sem}`,
        })
        sem++
        const next = new Date(wEnd)
        next.setDate(next.getDate() + 1)
        cur = next
      }
    } else {
      const ano = agora.getFullYear()
      grupos = Array.from({ length: 12 }, (_, i) => {
        const start = new Date(ano, i, 1)
        const end = new Date(ano, i + 1, 0)
        return {
          inicio: format(start, 'yyyy-MM-dd'),
          fim: format(end, 'yyyy-MM-dd'),
          label: format(start, 'MMM', { locale: ptBR }).slice(0, 3),
        }
      })
    }

    const globalInicio = grupos[0].inicio
    const globalFim = grupos[grupos.length - 1].fim

    const [cobsRes, agsRes] = await Promise.all([
      supabase.from('cobrancas_empresa')
        .select('tipo, valor, data')
        .eq('empresa_id', empresaId)
        .in('tipo', ['receita', 'despesa'])
        .gte('data', globalInicio).lte('data', globalFim),
      userIds.length > 0
        ? supabase.from('agendamentos')
            .select('valor, data_viagem')
            .in('motorista_id', userIds)
            .neq('status', 'cancelado')
            .gte('data_viagem', globalInicio).lte('data_viagem', globalFim)
        : { data: [] as { valor: number; data_viagem: string }[] },
    ])

    const cobsList = (cobsRes.data ?? []) as { tipo: string; valor: number; data: string }[]
    const agsList = (agsRes.data ?? []) as { valor: number; data_viagem: string }[]

    const dados: DiaSemanaRF[] = grupos.map(g => {
      const recCob = cobsList
        .filter(c => c.tipo === 'receita' && c.data >= g.inicio && c.data <= g.fim)
        .reduce((s, c) => s + Number(c.valor), 0)
      const despCob = cobsList
        .filter(c => c.tipo === 'despesa' && c.data >= g.inicio && c.data <= g.fim)
        .reduce((s, c) => s + Number(c.valor), 0)
      const recAgs = agsList
        .filter(a => a.data_viagem >= g.inicio && a.data_viagem <= g.fim)
        .reduce((s, a) => s + Number(a.valor), 0)
      return {
        data: g.inicio,
        receita: recCob + recAgs,
        despesa: despCob,
        label: g.label,
      }
    })

    setChartDados(dados)
    setLoadingChart(false)
  }

  if (loading) {
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

  const saldo = receitaMes - despesasMes
  const rotasSemMot = rotasHoje.filter(r => !r.motorista_id).length
  // Reativar quando a tela de preenchimento de checklist existir: || checklistPendentes > 0
  const temAlertas = rotasSemMot > 0 || naoConfirmados > 0 || fiadoVencido > 0
  const mesLabel = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })
  const mesLabelCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)

  const agsHojePorUid = agsHoje.reduce<Record<string, AgRF[]>>((acc, ag) => {
    if (!acc[ag.motorista_id]) acc[ag.motorista_id] = []
    acc[ag.motorista_id].push(ag)
    return acc
  }, {})

  const fmt = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  function fmtHora(t: string | null) {
    if (!t) return ''
    return t.slice(0, 5)
  }

  const motByUserId = Object.fromEntries(
    Object.values(motById).filter(m => m.user_id).map(m => [m.user_id!, m])
  )

  async function marcarComoPago(id: string) {
    await supabase.from('agendamentos').update({ forma_pagamento: 'dinheiro' }).eq('id', id)
    setPendentes(prev => prev.filter(p => p.id !== id))
    setFiadoVencido(prev => Math.max(0, prev - 1))
  }

  return (
    <>
    <div className="pb-24">
      {/* Cabeçalho */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-5">
        <p style={{ color: '#9FE1CB' }} className="text-xs">{saudacao},</p>
        <p style={{ color: '#E1F5EE' }} className="text-xl font-bold leading-tight">
          {nomeGestor?.split(' ')[0] || '...'}
        </p>
        {nomeEmpresa && (
          <p style={{ color: '#9FE1CB' }} className="text-xs mt-0.5">{nomeEmpresa}</p>
        )}
        <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">
          {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-5">

        {/* ── ALERTAS ─────────────────────────────────────────── */}
        {temAlertas && (
          <div className="flex flex-col gap-2">
            {rotasSemMot > 0 && (
              <Link href="/empresa/rotas"
                className="rounded-xl px-4 py-3 flex items-center gap-3 active:opacity-80"
                style={{ background: '#FCEBEB', border: '1px solid #FECACA' }}>
                <span className="text-lg flex-shrink-0">🔴</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#A32D2D' }}>
                    {rotasSemMot} rota{rotasSemMot !== 1 ? 's' : ''} sem motorista hoje
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#C0392B', opacity: 0.8 }}>
                    Toque para atribuir motorista
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
                  style={{ background: '#A32D2D', color: '#fff' }}>
                  Atribuir
                </span>
              </Link>
            )}
            {naoConfirmados > 0 && (
              <Link href="/empresa/agendamentos"
                className="rounded-xl px-4 py-3 flex items-center gap-3 active:opacity-80"
                style={{ background: '#FAEEDA', border: '1px solid #FAC775' }}>
                <span className="text-lg flex-shrink-0">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#854F0B' }}>
                    {naoConfirmados} passageiro{naoConfirmados !== 1 ? 's' : ''} não confirmado{naoConfirmados !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#A0622A', opacity: 0.8 }}>
                    Hoje e amanhã · status: agendado
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
                  style={{ background: '#854F0B', color: '#fff' }}>
                  Ver
                </span>
              </Link>
            )}
            {fiadoVencido > 0 && (
              <button onClick={() => setModalPendentes(true)}
                className="rounded-xl px-4 py-3 flex items-center gap-3 active:opacity-80 w-full text-left"
                style={{ background: '#FAEEDA', border: '1px solid #FAC775' }}>
                <span className="text-lg flex-shrink-0">💸</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#854F0B' }}>
                    {fiadoVencido} pagamento{fiadoVencido !== 1 ? 's' : ''} pendente{fiadoVencido !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#A0622A', opacity: 0.8 }}>
                    Passagens de datas passadas não pagas
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
                  style={{ background: '#854F0B', color: '#fff' }}>
                  Cobrar
                </span>
              </button>
            )}
            {/* Alerta de checklist removido — reativar quando a tela de preenchimento existir */}
          </div>
        )}

        {/* ── OPERAÇÃO DE HOJE ────────────────────────────────── */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Operação de hoje</p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {([
              { label: 'Rotas', valor: String(rotasHoje.length), cor: '#0F6E56' },
              { label: 'Passageiros', valor: String(passageirosHoje), cor: '#0F6E56' },
              { label: 'Receita esp.', valor: fmt(receitaDia), cor: '#1D9E75' },
            ] as const).map(m => (
              <div key={m.label} className="bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] text-gray-400 leading-tight mb-1">{m.label}</p>
                <p className="text-sm font-bold leading-none" style={{ color: m.cor }}>{m.valor}</p>
              </div>
            ))}
          </div>

          {rotasHoje.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
              <p className="text-3xl mb-2">🛣️</p>
              <p className="text-sm font-medium text-gray-700">Nenhuma rota programada para hoje</p>
              <p className="text-xs text-gray-400 mt-1">Verifique a configuração de dias das rotas</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rotasHoje.map(rota => {
                const mot = rota.motorista_id ? motById[rota.motorista_id] : null
                const uid = mot?.user_id ?? null
                const agsRota = uid ? (agsHojePorUid[uid] ?? []) : []
                const corrRota = corridasPubHoje.filter(c => c.rota_id === rota.id)
                const totalPass = agsRota.length + corrRota.length
                const recRota = agsRota.reduce((s, a) => s + Number(a.valor), 0) + corrRota.reduce((s, c) => s + Number(c.valor), 0)
                const semMot = !rota.motorista_id
                const horarios = [
                  rota.horario_ida ? `Ida ${fmtHora(rota.horario_ida)}` : null,
                  rota.horario_volta ? `Volta ${fmtHora(rota.horario_volta)}` : null,
                ].filter(Boolean).join(' · ')

                return (
                  <Link key={rota.id} href="/dashboard/agenda"
                    className="bg-white rounded-2xl px-4 py-3 border flex items-center gap-3 active:opacity-75"
                    style={{ borderColor: semMot ? '#FECACA' : '#f0f0f0', background: semMot ? '#FFFBFB' : '#fff' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: semMot ? '#FCEBEB' : '#E1F5EE' }}>
                      🚗
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {rota.nome ?? 'Rota sem nome'}
                      </p>
                      <p className="text-xs mt-0.5 truncate"
                        style={{ color: semMot ? '#A32D2D' : '#6b7280' }}>
                        {semMot ? 'Sem motorista atribuído' : (mot?.nome ?? '')}
                      </p>
                      {horarios ? (
                        <p className="text-[10px] text-gray-400 mt-0.5">{horarios}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 gap-0.5 text-right">
                      <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                        {totalPass} pass.
                      </p>
                      <p className="text-xs text-gray-400">{fmt(recRota)}</p>
                    </div>
                    <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── FINANCEIRO DO MÊS ───────────────────────────────── */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">{mesLabelCap}</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] text-gray-400 mb-1">💰 Receitas</p>
              <p className="text-base font-bold" style={{ color: '#0F6E56' }}>{fmt(receitaMes)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] text-gray-400 mb-1">📤 Despesas</p>
              <p className="text-base font-bold" style={{ color: '#A32D2D' }}>{fmt(despesasMes)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] text-gray-400 mb-1">{saldo >= 0 ? '📈' : '📉'} Saldo</p>
              <p className="text-base font-bold" style={{ color: saldo >= 0 ? '#0F6E56' : '#A32D2D' }}>
                {saldo < 0 ? '- ' : ''}{fmt(Math.abs(saldo))}
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] text-gray-400 mb-1">🕐 A receber</p>
              <p className="text-base font-bold" style={{ color: '#1D4ED8' }}>{fmt(aReceber)}</p>
            </div>
          </div>

          {/* ── GRÁFICO RECEITA x DESPESA ───────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600">Receita × Despesa</p>
              <div className="flex gap-1">
                {(['semana', 'mes', 'ano'] as const).map(p => (
                  <button key={p} onClick={() => setChartPeriodo(p)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                    style={chartPeriodo === p
                      ? { background: '#0F6E56', color: '#fff' }
                      : { background: '#f0f0ec', color: '#6b7280' }}>
                    {p === 'semana' ? 'Sem' : p === 'mes' ? 'Mês' : 'Ano'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#1D9E75' }} />
                <span className="text-[10px] text-gray-500">Receita</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#FAC775' }} />
                <span className="text-[10px] text-gray-500">Despesa</span>
              </div>
            </div>
            <GraficoBarrasRF dados={chartDados} loading={loadingChart} />
          </div>

          <Link href="/empresa/financeiro"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium active:opacity-75"
            style={{ background: '#fff', borderColor: '#e5e7eb', color: '#374151' }}>
            <span>📄</span>
            Financeiro completo e relatórios
          </Link>
        </div>

        {/* ── OPERAR ROTA ─────────────────────────────────────── */}
        <Link href="/dashboard/agenda"
          className="rounded-2xl px-4 py-3 flex items-center justify-between active:opacity-75"
          style={{ background: '#0F6E56', boxShadow: '0 2px 8px rgba(15,110,86,0.25)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)' }}>🛣️</div>
            <div>
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Operar rota</p>
              <p style={{ color: '#9FE1CB' }} className="text-xs mt-0.5">Selecionar rota e ver passageiros do dia</p>
            </div>
          </div>
          <span style={{ color: '#9FE1CB' }} className="text-xs">›</span>
        </Link>

      </div>
    </div>

    {/* Modal pagamentos pendentes */}
    {modalPendentes && (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={e => { if (e.target === e.currentTarget) setModalPendentes(false) }}>
        <div className="bg-white flex-1 mt-20 rounded-t-3xl flex flex-col overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-base font-semibold text-gray-800">Pagamentos pendentes</p>
              {pendentes.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Total: R$ {pendentes.reduce((s, p) => s + Number(p.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <button onClick={() => setModalPendentes(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 text-lg"
              style={{ background: '#f0f0ec' }}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {pendentes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">Nenhum pagamento pendente</p>
            ) : pendentes.map(ag => {
              const mot = motByUserId[ag.motorista_id]
              const rawTel = (ag.telefone_passageiro ?? '').replace(/\D/g, '')
              const tel = rawTel ? (rawTel.startsWith('55') ? rawTel : `55${rawTel}`) : null
              const dataFmt = ag.data_viagem.split('-').reverse().join('/')
              const msg = encodeURIComponent(
                `Olá ${ag.nome_passageiro.split(' ')[0]}, tudo bem? A sua passagem de ${ag.parada_origem} → ${ag.parada_destino} do dia ${dataFmt} no valor de R$${Number(ag.valor).toFixed(2).replace('.', ',')} está pendente de pagamento. Poderia realizar o pagamento?`
              )
              return (
                <div key={ag.id} className="rounded-xl p-3 flex flex-col gap-2 border border-gray-100"
                  style={{ background: '#FAFAF8' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{ag.nome_passageiro}</p>
                      {ag.telefone_passageiro && (
                        <p className="text-xs text-gray-400">{ag.telefone_passageiro}</p>
                      )}
                      {mot && (
                        <p className="text-xs text-gray-400">Motorista: {mot.nome}</p>
                      )}
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: '#0F6E56' }}>
                      R$ {Number(ag.valor).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">{ag.parada_origem} → {ag.parada_destino}</p>
                  <p className="text-xs text-gray-400">{dataFmt} · {ag.turno === 'ida' ? 'Ida' : 'Volta'}</p>
                  <div className="flex gap-2 mt-1">
                    {tel ? (
                      <a href={`https://wa.me/${tel}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 py-2 rounded-xl text-center text-xs font-semibold"
                        style={{ background: '#25D366', color: '#fff' }}>
                        📱 WhatsApp
                      </a>
                    ) : (
                      <div className="flex-1 py-2 rounded-xl text-center text-xs text-gray-300 border border-gray-100">
                        Sem telefone
                      </div>
                    )}
                    <button onClick={() => marcarComoPago(ag.id)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200"
                      style={{ background: '#f0f0ec', color: '#0F6E56' }}>
                      ✓ Marcar como pago
                    </button>
                  </div>
                </div>
              )
            })}
            <div className="h-6" />
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function GraficoBarrasRF({ dados, loading }: { dados: DiaSemanaRF[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="h-24 flex items-center justify-center">
        <p className="text-xs text-gray-400">Carregando...</p>
      </div>
    )
  }

  const hasData = dados.some(d => d.receita > 0 || d.despesa > 0)
  if (!hasData) {
    return (
      <div className="h-24 flex items-center justify-center">
        <p className="text-xs text-gray-400">Sem dados para o período</p>
      </div>
    )
  }

  const maxVal = Math.max(...dados.flatMap(d => [d.receita, d.despesa]), 1)
  const H = 80
  const LH = 18
  const W = 280
  const n = dados.length
  const groupW = W / n
  const barW = Math.max(5, Math.min(16, groupW * 0.38))
  const gap = Math.max(1, barW * 0.15)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + LH}`} preserveAspectRatio="none">
      {[0.25, 0.5, 0.75, 1].map(frac => (
        <line
          key={frac}
          x1={0} y1={H * (1 - frac)}
          x2={W} y2={H * (1 - frac)}
          stroke="#f3f4f6"
          strokeWidth={0.8}
        />
      ))}
      {dados.map((d, i) => {
        const cx = i * groupW + groupW / 2
        const totalBarsW = 2 * barW + gap
        const x1 = cx - totalBarsW / 2
        const x2 = x1 + barW + gap
        const recH = (d.receita / maxVal) * H
        const despH = (d.despesa / maxVal) * H
        return (
          <g key={i}>
            {recH > 0 && (
              <rect x={x1} y={H - recH} width={barW} height={recH} fill="#1D9E75" rx={2} />
            )}
            {despH > 0 && (
              <rect x={x2} y={H - despH} width={barW} height={despH} fill="#FAC775" rx={2} />
            )}
            <text
              x={cx} y={H + LH - 3}
              textAnchor="middle"
              fontSize={7}
              fill="#9ca3af"
              fontFamily="system-ui, sans-serif"
            >
              {d.label}
            </text>
          </g>
        )
      })}
      <line x1={0} y1={H} x2={W} y2={H} stroke="#e5e7eb" strokeWidth={0.5} />
    </svg>
  )
}
