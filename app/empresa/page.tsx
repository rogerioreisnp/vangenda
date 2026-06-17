'use client'
import { useEffect, useState } from 'react'
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
  confirmada:             { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
  em_andamento:           { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
  concluida:              { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
  cancelada:              { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
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

export default function EmpresaPage() {
  const [nomeGestor, setNomeGestor] = useState<string | null>(null)
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

  useEffect(() => { carregarDados() }, [])
  useEffect(() => {
    if (empresaId && tipoOperacao && tipoOperacao !== 'rota_fixa') {
      carregarGraficoTransfer(periodoGraficoTransfer, empresaId)
    }
  }, [periodoGraficoTransfer])

  async function carregarDados() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

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
      supabase.from('motoristas_empresa').select('id')
        .eq('empresa_id', eid).eq('status', 'ativo'),
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
        <div className="text-4xl animate-pulse">🚐</div>
      </div>
    )
  }

  if (tipoOperacao === 'rota_fixa' && empresaId) {
    return <DashboardRotaFixa nomeGestor={nomeGestor} nomeEmpresa={nomeEmpresa} empresaId={empresaId} />
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

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* Banner boas-vindas (primeira vez, sem motoristas) */}
        {!loading && motoristasAtivos === 0 && corridasHoje === 0 && (
          <BannerBoasVindas />
        )}

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <CardMetrica label="Corridas hoje" valor={corridasHoje} emoji="📋" cor="#0F6E56" />
          <CardMetrica label="Motoristas ativos" valor={motoristasAtivos} emoji="🚐" cor="#0F6E56" />
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
            <Link href="/empresa/agendamentos"
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
                    <div key={c.id} className="bg-white rounded-2xl px-4 py-3 border border-gray-100"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
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
                    </div>
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
          <div className="grid grid-cols-3 gap-2">
            {[
              { emoji: '📋', label: 'Nova corrida', href: '/empresa/agendamentos?nova=1' },
              { emoji: '💰', label: 'Financeiro', href: '/empresa/financeiro' },
              { emoji: '🚐', label: 'Motoristas', href: '/empresa/motoristas' },
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
        Seu trial de 7 dias começou. Siga os passos abaixo para configurar sua conta.
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
}

type MotEmpresa = {
  id: string
  user_id: string | null
  nome: string
  veiculo: string | null
  placa: string | null
  status: string
}

function DashboardRotaFixa({
  nomeGestor,
  nomeEmpresa,
  empresaId,
}: {
  nomeGestor: string | null
  nomeEmpresa: string | null
  empresaId: string
}) {
  const [loading, setLoading] = useState(true)
  const [viagensHoje, setViagensHoje] = useState(0)
  const [passageirosHoje, setPassageirosHoje] = useState(0)
  const [receitaMes, setReceitaMes] = useState(0)
  const [aReceber, setAReceber] = useState(0)
  const [despesasMes, setDespesasMes] = useState(0)
  const [motoristas, setMotoristas] = useState<MotEmpresa[]>([])
  const [agsHoje, setAgsHoje] = useState<AgRF[]>([])
  const [proximas, setProximas] = useState<AgRF[]>([])
  const [grafico, setGrafico] = useState<DiaSemanaRF[]>([])
  const [periodoGrafico, setPeriodoGrafico] = useState<'semana' | 'mes' | 'ano'>('semana')
  const [loadingGrafico, setLoadingGrafico] = useState(false)
  const [userIdsCache, setUserIdsCache] = useState<string[]>([])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  useEffect(() => { carregarDados() }, [])
  useEffect(() => {
    if (userIdsCache.length > 0) carregarGrafico(periodoGrafico, userIdsCache)
  }, [periodoGrafico])

  async function carregarDados() {
    const agora = new Date()
    const hojeStr = format(agora, 'yyyy-MM-dd')
    const em7Dias = format(addDays(agora, 7), 'yyyy-MM-dd')
    const inicioMes = format(startOfMonth(agora), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(agora), 'yyyy-MM-dd')

    const { data: mots } = await supabase
      .from('motoristas_empresa')
      .select('id, user_id, nome, veiculo, placa, status')
      .eq('empresa_id', empresaId)
      .eq('status', 'ativo')
      .order('nome')

    const motsAtivos = (mots ?? []) as MotEmpresa[]
    setMotoristas(motsAtivos)

    const userIds = motsAtivos.map(m => m.user_id).filter(Boolean) as string[]

    if (userIds.length === 0) {
      setLoading(false)
      return
    }

    const [
      { data: agsHojeData },
      { data: proximasData },
      { data: recMesData },
      { data: aReceberData },
      { data: cobMesData },
    ] = await Promise.all([
      supabase.from('agendamentos').select('*')
        .in('motorista_id', userIds).eq('data_viagem', hojeStr).neq('status', 'cancelado'),
      supabase.from('agendamentos').select('*')
        .in('motorista_id', userIds).gte('data_viagem', hojeStr).lte('data_viagem', em7Dias)
        .neq('status', 'cancelado').order('data_viagem').order('turno'),
      supabase.from('agendamentos').select('valor')
        .in('motorista_id', userIds).gte('data_viagem', inicioMes).lte('data_viagem', fimMes)
        .neq('status', 'cancelado'),
      supabase.from('agendamentos').select('valor')
        .in('motorista_id', userIds).eq('forma_pagamento', 'pendente').neq('status', 'cancelado'),
      supabase.from('cobrancas_empresa').select('tipo, valor, data')
        .eq('empresa_id', empresaId).in('tipo', ['receita', 'despesa'])
        .gte('data', inicioMes).lte('data', fimMes),
    ])

    const hojeAgs = (agsHojeData ?? []) as AgRF[]
    const rotasUnicas = new Set(hojeAgs.map(a => `${a.parada_origem}|${a.parada_destino}|${a.turno}`))

    const cobMes = cobMesData ?? []
    const receitaAgs = (recMesData ?? []).reduce((s, a) => s + Number(a.valor), 0)
    const receitaCob = cobMes.filter(c => c.tipo === 'receita').reduce((s, c) => s + Number(c.valor), 0)
    const despesaCob = cobMes.filter(c => c.tipo === 'despesa').reduce((s, c) => s + Number(c.valor), 0)

    setAgsHoje(hojeAgs)
    setViagensHoje(rotasUnicas.size)
    setPassageirosHoje(hojeAgs.length)
    setReceitaMes(receitaAgs + receitaCob)
    setDespesasMes(despesaCob)
    setAReceber((aReceberData ?? []).reduce((s, a) => s + Number(a.valor), 0))
    setProximas((proximasData ?? []) as AgRF[])

    setUserIdsCache(userIds)
    await carregarGrafico('semana', userIds)

    setLoading(false)
  }

  async function carregarGrafico(periodo: 'semana' | 'mes' | 'ano', uIds: string[]) {
    setLoadingGrafico(true)
    const agora = new Date()
    const anoAtual = agora.getFullYear()

    if (periodo === 'semana') {
      const ha7 = format(subDays(agora, 6), 'yyyy-MM-dd')
      const hoje = format(agora, 'yyyy-MM-dd')
      const [{ data: agsData }, { data: cobData }] = await Promise.all([
        supabase.from('agendamentos').select('data_viagem, valor')
          .in('motorista_id', uIds).gte('data_viagem', ha7).lte('data_viagem', hoje)
          .neq('status', 'cancelado'),
        supabase.from('cobrancas_empresa').select('tipo, valor, data')
          .eq('empresa_id', empresaId).in('tipo', ['receita', 'despesa'])
          .gte('data', ha7).lte('data', hoje),
      ])
      const cob = cobData ?? []
      const pontos: DiaSemanaRF[] = []
      for (let i = 6; i >= 0; i--) {
        const d = subDays(agora, i)
        const dStr = format(d, 'yyyy-MM-dd')
        const raw = format(d, 'EEE', { locale: ptBR })
        const label = raw.charAt(0).toUpperCase() + raw.slice(1, 3)
        const recAgs = (agsData ?? []).filter(r => r.data_viagem === dStr).reduce((s, r) => s + Number(r.valor), 0)
        const recCob = cob.filter(c => c.data === dStr && c.tipo === 'receita').reduce((s, c) => s + Number(c.valor), 0)
        const despCob = cob.filter(c => c.data === dStr && c.tipo === 'despesa').reduce((s, c) => s + Number(c.valor), 0)
        pontos.push({ data: dStr, receita: recAgs + recCob, despesa: despCob, label })
      }
      setGrafico(pontos)

    } else if (periodo === 'mes') {
      const ini = format(startOfMonth(agora), 'yyyy-MM-dd')
      const fim = format(endOfMonth(agora), 'yyyy-MM-dd')
      const [{ data: agsData }, { data: cobData }] = await Promise.all([
        supabase.from('agendamentos').select('data_viagem, valor')
          .in('motorista_id', uIds).gte('data_viagem', ini).lte('data_viagem', fim)
          .neq('status', 'cancelado'),
        supabase.from('cobrancas_empresa').select('tipo, valor, data')
          .eq('empresa_id', empresaId).in('tipo', ['receita', 'despesa'])
          .gte('data', ini).lte('data', fim),
      ])
      const ags = agsData ?? []
      const cob = cobData ?? []
      const totalDias = endOfMonth(agora).getDate()
      const semanasConf = [
        { label: 'Sem 1', ini: 1,  fim: 7  },
        { label: 'Sem 2', ini: 8,  fim: 14 },
        { label: 'Sem 3', ini: 15, fim: 21 },
        { label: 'Sem 4', ini: 22, fim: 28 },
        ...(totalDias > 28 ? [{ label: 'Sem 5', ini: 29, fim: totalDias }] : []),
      ]
      const pontos: DiaSemanaRF[] = semanasConf.map(s => {
        const inRange = (dateStr: string) => { const d = +dateStr.slice(8, 10); return d >= s.ini && d <= s.fim }
        const recAgs  = ags.filter(a => inRange(a.data_viagem)).reduce((sum, a) => sum + Number(a.valor), 0)
        const recCob  = cob.filter(c => inRange(c.data) && c.tipo === 'receita').reduce((sum, c) => sum + Number(c.valor), 0)
        const despCob = cob.filter(c => inRange(c.data) && c.tipo === 'despesa').reduce((sum, c) => sum + Number(c.valor), 0)
        return { data: s.label, receita: recAgs + recCob, despesa: despCob, label: s.label }
      })
      setGrafico(pontos)

    } else {
      const inicioAno = `${anoAtual}-01-01`
      const fimAno   = `${anoAtual}-12-31`
      const [{ data: agsData }, { data: cobData }] = await Promise.all([
        supabase.from('agendamentos').select('data_viagem, valor')
          .in('motorista_id', uIds).gte('data_viagem', inicioAno).lte('data_viagem', fimAno)
          .neq('status', 'cancelado'),
        supabase.from('cobrancas_empresa').select('tipo, valor, data')
          .eq('empresa_id', empresaId).in('tipo', ['receita', 'despesa'])
          .gte('data', inicioAno).lte('data', fimAno),
      ])
      const ags = agsData ?? []
      const cob = cobData ?? []
      const mesesLabel = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const pontos: DiaSemanaRF[] = mesesLabel.map((label, idx) => {
        const prefix = `${anoAtual}-${String(idx + 1).padStart(2, '0')}`
        const recAgs  = ags.filter(a => a.data_viagem.startsWith(prefix)).reduce((s, a) => s + Number(a.valor), 0)
        const recCob  = cob.filter(c => c.data.startsWith(prefix) && c.tipo === 'receita').reduce((s, c) => s + Number(c.valor), 0)
        const despCob = cob.filter(c => c.data.startsWith(prefix) && c.tipo === 'despesa').reduce((s, c) => s + Number(c.valor), 0)
        return { data: prefix, receita: recAgs + recCob, despesa: despCob, label }
      })
      setGrafico(pontos)
    }

    setLoadingGrafico(false)
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#f0f0ec' }}>
        <div className="text-4xl animate-pulse">🚐</div>
      </div>
    )
  }

  const motPorUserId = Object.fromEntries(
    motoristas.filter(m => m.user_id).map(m => [m.user_id!, m])
  )
  const agsHojePorMot = agsHoje.reduce<Record<string, AgRF[]>>((acc, ag) => {
    if (!acc[ag.motorista_id]) acc[ag.motorista_id] = []
    acc[ag.motorista_id].push(ag)
    return acc
  }, {})

  // Agrupa próximas por (data_viagem, origem, destino, turno, motorista_id)
  type GrupoViagem = {
    key: string; data_viagem: string; parada_origem: string; parada_destino: string
    turno: string; motorista_id: string; count: number; valor_total: number
  }
  const gruposMap = new Map<string, GrupoViagem>()
  for (const ag of proximas) {
    const key = `${ag.data_viagem}|${ag.parada_origem}|${ag.parada_destino}|${ag.turno}|${ag.motorista_id}`
    if (!gruposMap.has(key)) {
      gruposMap.set(key, {
        key, data_viagem: ag.data_viagem, parada_origem: ag.parada_origem,
        parada_destino: ag.parada_destino, turno: ag.turno, motorista_id: ag.motorista_id,
        count: 0, valor_total: 0,
      })
    }
    const g = gruposMap.get(key)!
    g.count++
    g.valor_total += Number(ag.valor)
  }
  const grupos = Array.from(gruposMap.values())

  const maxBar = Math.max(...grafico.map(d => Math.max(d.receita, d.despesa)), 1)
  const temDadosGrafico = grafico.some(d => d.receita > 0 || d.despesa > 0)
  const totalRecSemana = grafico.reduce((s, d) => s + d.receita, 0)
  const totalDespSemana = grafico.reduce((s, d) => s + d.despesa, 0)
  const lucroSemana = totalRecSemana - totalDespSemana
  const hojeStr = format(new Date(), 'yyyy-MM-dd')
  const lucroMes = receitaMes - despesasMes

  return (
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

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <CardMetrica label="Viagens hoje" valor={viagensHoje} emoji="🛣️" cor="#0F6E56" />
          <CardMetrica label="Passageiros hoje" valor={passageirosHoje} emoji="👥" cor="#0F6E56" />
          <CardMetrica
            label="Receita do mês"
            valor={`R$ ${receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            emoji="💰"
            cor="#1D9E75"
          />
          <CardMetrica
            label="Despesas do mês"
            valor={`R$ ${despesasMes.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            emoji="📤"
            cor="#A32D2D"
          />
        </div>

        {/* Lucro do mês */}
        <div className="rounded-2xl px-4 py-3 border flex items-center justify-between"
          style={{
            background: lucroMes >= 0 ? '#E1F5EE' : '#FCEBEB',
            borderColor: lucroMes >= 0 ? '#9FE1CB' : '#FECACA',
          }}>
          <div>
            <p className="text-xs font-medium" style={{ color: lucroMes >= 0 ? '#085041' : '#A32D2D' }}>
              {lucroMes >= 0 ? '📈 Lucro do mês' : '📉 Prejuízo do mês'}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: lucroMes >= 0 ? '#1D9E75' : '#C0392B', opacity: 0.8 }}>
              Receita − Despesas lançadas
            </p>
          </div>
          <p className="text-xl font-bold" style={{ color: lucroMes >= 0 ? '#0F6E56' : '#A32D2D' }}>
            R$ {Math.abs(lucroMes).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Frota hoje */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Frota hoje</p>
          {motoristas.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
              <p className="text-3xl mb-2">🚐</p>
              <p className="text-sm font-medium text-gray-700">Nenhum motorista cadastrado</p>
              <Link href="/empresa/motoristas"
                className="inline-block mt-3 px-5 py-2 rounded-xl text-xs font-semibold"
                style={{ background: '#1D9E75', color: '#fff' }}>
                + Cadastrar motorista
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {motoristas.map(mot => {
                const uid = mot.user_id ?? ''
                const agsMotHoje = agsHojePorMot[uid] ?? []
                const emRota = agsMotHoje.length > 0
                const iniciais = mot.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                const rotaLabel = emRota
                  ? `${agsMotHoje[0].parada_origem} → ${agsMotHoje[0].parada_destino}`
                  : null
                return (
                  <div key={mot.id}
                    className="bg-white rounded-2xl px-4 py-3 border border-gray-100 flex items-center gap-3"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: emRota ? '#E1F5EE' : '#f0f0ec', color: emRota ? '#0F6E56' : '#9ca3af' }}>
                      {iniciais}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{mot.nome}</p>
                      {rotaLabel ? (
                        <p className="text-xs text-gray-400 truncate">
                          {rotaLabel} · {agsMotHoje.length} passageiro{agsMotHoje.length !== 1 ? 's' : ''}
                        </p>
                      ) : mot.veiculo ? (
                        <p className="text-xs text-gray-400">{mot.veiculo}{mot.placa ? ` · ${mot.placa}` : ''}</p>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                      style={emRota
                        ? { background: '#E1F5EE', color: '#0F6E56' }
                        : { background: '#f0f0ec', color: '#9ca3af' }}>
                      {emRota ? 'Em rota' : 'Disponível'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Próximas viagens */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Próximas viagens</p>
            <Link href="/empresa/agendamentos"
              className="text-xs font-medium" style={{ color: '#0F6E56' }}>
              Ver todas →
            </Link>
          </div>
          {grupos.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm font-medium text-gray-700">Nenhuma viagem nos próximos 7 dias</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {grupos.map(g => {
                const mot = motPorUserId[g.motorista_id]
                const dataFmt = format(new Date(g.data_viagem + 'T00:00:00'), "dd/MM", { locale: ptBR })
                const isHoje = g.data_viagem === hojeStr
                return (
                  <div key={g.key}
                    className="bg-white rounded-2xl px-4 py-3 border border-gray-100"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {g.parada_origem} → {g.parada_destino}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {isHoje ? 'Hoje' : dataFmt}
                          {' · '}{g.turno === 'ida' ? 'Ida' : 'Volta'}
                          {mot && <> · <span className="text-gray-500">{mot.nome}</span></>}
                        </p>
                        <p className="text-xs mt-0.5 font-medium" style={{ color: '#1D9E75' }}>
                          {g.count} passageiro{g.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold flex-shrink-0" style={{ color: '#0F6E56' }}>
                        R$ {g.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
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

          {/* Seletor de período */}
          <div className="flex gap-1.5 mb-3">
            {(['semana', 'mes', 'ano'] as const).map(p => (
              <button key={p} onClick={() => setPeriodoGrafico(p)}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                style={periodoGrafico === p
                  ? { background: '#0F6E56', color: '#fff' }
                  : { background: '#f3f4f6', color: '#9ca3af' }}>
                {p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>

          {/* Título + legenda */}
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

          {loadingGrafico ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-2xl animate-pulse">📊</div>
            </div>
          ) : !temDadosGrafico ? (
            <div className="text-center py-5">
              <p className="text-xs text-gray-400">Nenhum dado no período</p>
            </div>
          ) : (
            <div>
              {/* Barras agrupadas */}
              <div className="flex items-end" style={{ height: '64px', gap: grafico.length > 7 ? '2px' : '6px' }}>
                {grafico.map((d, i) => {
                  const recH  = maxBar > 0 ? Math.max(Math.round((d.receita  / maxBar) * 60), d.receita  > 0 ? 4 : 0) : 0
                  const despH = maxBar > 0 ? Math.max(Math.round((d.despesa  / maxBar) * 60), d.despesa  > 0 ? 4 : 0) : 0
                  const anoMesAtual = format(new Date(), 'yyyy-MM')
                  const eHoje = periodoGrafico === 'semana'
                    ? d.data === hojeStr
                    : periodoGrafico === 'ano'
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
              {/* Labels */}
              <div className="flex mt-1.5" style={{ gap: grafico.length > 7 ? '2px' : '6px' }}>
                {grafico.map((d, i) => {
                  const anoMesAtual = format(new Date(), 'yyyy-MM')
                  const eHoje = periodoGrafico === 'semana'
                    ? d.data === hojeStr
                    : periodoGrafico === 'ano'
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
              {/* Rodapé */}
              <div className="flex justify-around mt-3 pt-3 border-t border-gray-50">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">Receita</p>
                  <p className="text-xs font-bold" style={{ color: '#1D9E75' }}>
                    R$ {totalRecSemana.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">Despesa</p>
                  <p className="text-xs font-bold" style={{ color: '#E24B4A' }}>
                    R$ {totalDespSemana.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">Lucro</p>
                  <p className="text-xs font-bold" style={{ color: lucroSemana >= 0 ? '#0F6E56' : '#E24B4A' }}>
                    R$ {Math.abs(lucroSemana).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
