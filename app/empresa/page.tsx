'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'

type ProximaCorrida = {
  id: string
  origem: string
  destino: string
  data_hora: string
  valor: number
  status: string
  cliente_nome: string
  motoristas_empresa: { nome: string } | null
}

type DiaSemana = { data: string; total: number; label: string }

const STATUS_COR: Record<string, { bg: string; text: string; label: string }> = {
  confirmada:   { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
  em_andamento: { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
  concluida:    { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
  cancelada:    { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
}

const PLANO_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', fleet: 'Fleet' }
const STATUS_EMPRESA_LABEL: Record<string, string> = { trial: 'Trial', ativo: 'Ativo', inativo: 'Inativo' }

export default function EmpresaPage() {
  const [nomeGestor, setNomeGestor] = useState<string | null>(null)
  const [nomeEmpresa, setNomeEmpresa] = useState<string | null>(null)
  const [plano, setPlano] = useState('')
  const [statusEmpresa, setStatusEmpresa] = useState('')

  const [corridasHoje, setCorridasHoje] = useState(0)
  const [motoristasAtivos, setMotoristasAtivos] = useState(0)
  const [receitaMes, setReceitaMes] = useState(0)
  const [corridasConfirmadas, setCorridasConfirmadas] = useState(0)
  const [corridasSemMotorista, setCorridasSemMotorista] = useState(0)

  const [proximas, setProximas] = useState<ProximaCorrida[]>([])
  const [grafico, setGrafico] = useState<DiaSemana[]>([])

  const [loading, setLoading] = useState(true)

  useEffect(() => { carregarDados() }, [])

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
      .select('nome, plano, status')
      .eq('id', eid)
      .single()

    if (empresa) {
      setNomeEmpresa(empresa.nome)
      setPlano(empresa.plano)
      setStatusEmpresa(empresa.status)
    }

    const agora = new Date()
    const agoraISO = agora.toISOString()
    const hoje = format(agora, 'yyyy-MM-dd')
    const inicioMes = format(startOfMonth(agora), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(agora), 'yyyy-MM-dd')
    const ha7Dias = format(subDays(agora, 6), 'yyyy-MM-dd')

    const [
      { data: cHoje },
      { data: mAtivos },
      { data: recMes },
      { data: cConf },
      { data: cSemMot },
      { data: prox },
      { data: rec7d },
    ] = await Promise.all([
      supabase.from('corridas_empresa').select('id').eq('empresa_id', eid)
        .gte('data_hora', `${hoje}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`)
        .neq('status', 'cancelada'),
      supabase.from('motoristas_empresa').select('id')
        .eq('empresa_id', eid).eq('status', 'ativo'),
      supabase.from('corridas_empresa').select('valor').eq('empresa_id', eid)
        .neq('status', 'cancelada')
        .gte('data_hora', `${inicioMes}T00:00:00`).lte('data_hora', `${fimMes}T23:59:59`),
      supabase.from('corridas_empresa').select('id').eq('empresa_id', eid)
        .eq('status', 'confirmada').gte('data_hora', agoraISO),
      supabase.from('corridas_empresa').select('id').eq('empresa_id', eid)
        .is('motorista_id', null).eq('status', 'confirmada').gte('data_hora', agoraISO),
      supabase.from('corridas_empresa')
        .select('id, origem, destino, data_hora, valor, status, cliente_nome, motoristas_empresa(nome)')
        .eq('empresa_id', eid).gte('data_hora', agoraISO)
        .order('data_hora').limit(5),
      supabase.from('corridas_empresa').select('data_hora, valor').eq('empresa_id', eid)
        .neq('status', 'cancelada').gte('data_hora', `${ha7Dias}T00:00:00`),
    ])

    setCorridasHoje(cHoje?.length ?? 0)
    setMotoristasAtivos(mAtivos?.length ?? 0)
    setReceitaMes(recMes?.reduce((s, c) => s + (Number(c.valor) || 0), 0) ?? 0)
    setCorridasConfirmadas(cConf?.length ?? 0)
    setCorridasSemMotorista(cSemMot?.length ?? 0)
    setProximas((prox as any) ?? [])

    // Monta os 7 dias com totais
    const dias: DiaSemana[] = []
    for (let i = 6; i >= 0; i--) {
      const d = subDays(agora, i)
      const dStr = format(d, 'yyyy-MM-dd')
      const raw = format(d, 'EEE', { locale: ptBR })
      const label = raw.charAt(0).toUpperCase() + raw.slice(1, 3)
      const total = (rec7d ?? [])
        .filter(r => format(new Date(r.data_hora), 'yyyy-MM-dd') === dStr)
        .reduce((s, r) => s + (Number(r.valor) || 0), 0)
      dias.push({ data: dStr, total, label })
    }
    setGrafico(dias)

    setLoading(false)
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

  const maxReceita = Math.max(...grafico.map(d => d.total), 1)
  const temDadosGrafico = grafico.some(d => d.total > 0)
  const totalSemana = grafico.reduce((s, d) => s + d.total, 0)

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
          {plano && (
            <div style={{ background: '#085041' }} className="px-3 py-1.5 rounded-lg text-right">
              <p style={{ color: '#5DCAA5' }} className="text-[11px] font-semibold leading-snug">
                {PLANO_LABEL[plano] || plano}
              </p>
              <p style={{ color: '#9FE1CB' }} className="text-[10px] leading-snug">
                {STATUS_EMPRESA_LABEL[statusEmpresa] || statusEmpresa}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

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
          <CardMetrica label="Confirmadas" valor={corridasConfirmadas} emoji="✅" cor="#1D4ED8" />
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
              {proximas.map(c => {
                const cor = STATUS_COR[c.status] ?? STATUS_COR.confirmada
                const dt = new Date(c.data_hora)
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
                          {format(dt, "dd/MM 'às' HH:mm", { locale: ptBR })}
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
              })}
            </div>
          )}
        </div>

        {/* Gráfico de barras — receita 7 dias */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Receita — últimos 7 dias</p>
            {temDadosGrafico && (
              <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>
                R$ {totalSemana.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            )}
          </div>

          {!temDadosGrafico ? (
            <div className="text-center py-5">
              <p className="text-xs text-gray-400">Nenhuma receita registrada nos últimos 7 dias</p>
            </div>
          ) : (
            <div className="flex gap-1.5" style={{ height: '80px' }}>
              {grafico.map((d, i) => {
                const barH = maxReceita > 0
                  ? Math.round((d.total / maxReceita) * 56)
                  : 0
                const eHoje = d.data === format(new Date(), 'yyyy-MM-dd')
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    {/* área da barra */}
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className="w-full rounded-t-sm transition-all"
                        style={{
                          height: d.total > 0 ? `${Math.max(barH, 4)}px` : '2px',
                          background: d.total > 0
                            ? (eHoje ? '#0F6E56' : '#1D9E75')
                            : '#f0f0ec',
                        }}
                      />
                    </div>
                    {/* label dia */}
                    <p className="mt-1.5 leading-none"
                      style={{
                        fontSize: '8px',
                        color: eHoje ? '#0F6E56' : '#9ca3af',
                        fontWeight: eHoje ? 700 : 400,
                      }}>
                      {d.label}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Atalhos rápidos */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Atalhos rápidos</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { emoji: '📋', label: 'Nova corrida', href: '/empresa/agendamentos' },
              { emoji: '🚐', label: 'Motoristas', href: '/empresa/motoristas' },
              { emoji: '🛣️', label: 'Rotas', href: '/empresa/rotas' },
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
