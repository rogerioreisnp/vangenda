'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

type Periodo = 'mes_atual' | 'ultimos_7' | 'ultimos_30' | 'personalizado'
type Aba = 'resumo' | 'receitas' | 'despesas' | 'veiculo'

type CorridaFin = {
  id: string
  origem: string
  destino: string
  data_hora: string
  valor: number
  status: string
  cliente_nome: string
  motorista_id: string | null
  valor_recebido: number | null
  status_pagamento: string | null
  data_pagamento: string | null
  numero_reserva: string | null
  motoristas_empresa: { nome: string; veiculo: string | null; placa: string | null } | null
  valor_repasse_motorista: number | null
}

type Despesa = {
  id: string
  motorista_id: string | null
  veiculo: string | null
  categoria: string
  descricao: string
  valor: number
  km_odometro: number | null
  data: string
  tipo: 'receita' | 'despesa'
  forma_pagamento: string | null
  cartao_banco?: string | null
  cartao_final?: string | null
  pix_banco?: string | null
  corrida_id?: string | null
  reembolsavel?: boolean | null
  reembolsado_em?: string | null
}

type Motorista = {
  id: string
  nome: string
  veiculo: string | null
  placa: string | null
}

type FormDespesa = {
  tipo: 'receita' | 'despesa'
  categoria: string
  descricao: string
  valor: string
  veiculo: string
  km_odometro: string
  data: string
  motorista_id: string
  forma_pagamento: string
  cartao_banco: string
  cartao_final: string
  pix_banco: string
  corrida_id: string
  reembolsavel: boolean
}

const FORM_VAZIO: FormDespesa = {
  tipo: 'despesa',
  categoria: 'combustivel',
  descricao: '',
  valor: '',
  veiculo: '',
  km_odometro: '',
  data: '',
  motorista_id: '',
  forma_pagamento: 'pix',
  cartao_banco: '',
  cartao_final: '',
  pix_banco: '',
  corrida_id: '',
  reembolsavel: false,
}

const CATEGORIAS = [
  { valor: 'combustivel',       label: 'Combustível',         emoji: '⛽' },
  { valor: 'manutencao',        label: 'Manutenção',          emoji: '🔧' },
  { valor: 'pneus',             label: 'Pneus',               emoji: '⭕' },
  { valor: 'seguro',            label: 'Seguro',              emoji: '🛡️' },
  { valor: 'ipva_licenciamento',label: 'IPVA/Licenciamento',  emoji: '📄' },
  { valor: 'lavagem',           label: 'Lavagem',             emoji: '🚿' },
  { valor: 'pedagio',           label: 'Pedágio',             emoji: '🛂' },
  { valor: 'estacionamento',    label: 'Estacionamento',      emoji: '🅿️' },
  { valor: 'alimentacao',       label: 'Alimentação',         emoji: '🍽️' },
  { valor: 'hospedagem',        label: 'Hospedagem/Hotel',    emoji: '🏨' },
  { valor: 'financiamento',     label: 'Financiamento/Parcela', emoji: '🚙' },
  { valor: 'multa',             label: 'Multa',               emoji: '⚠️' },
  { valor: 'contas',            label: 'Contas',              emoji: '🧾' },
  { valor: 'outros',            label: 'Outros',              emoji: '📦' },
] as const

type CatValor = typeof CATEGORIAS[number]['valor']
const catMap = Object.fromEntries(CATEGORIAS.map(c => [c.valor, c])) as Record<string, { valor: string; label: string; emoji: string }>

const FORMA_PAGAMENTO_LABEL: Record<string, string> = { pix: '📱 Pix', cartao: '💳 Cartão', dinheiro: '💵 Dinheiro' }

const CATEGORIAS_RECEITA = [
  { valor: 'corrida_extra', label: 'Atendimento extra (fora do app)', emoji: '🚗' },
  { valor: 'gorjeta',       label: 'Gorjeta',                     emoji: '💵' },
  { valor: 'diaria',        label: 'Diária/pacote fechado',       emoji: '📦' },
  { valor: 'outros',        label: 'Outros',                      emoji: '➕' },
] as const
const catReceitaMap = Object.fromEntries(CATEGORIAS_RECEITA.map(c => [c.valor, c])) as Record<string, { valor: string; label: string; emoji: string }>

// ─── Tipos e constantes para financeiro rota_fixa ────────────────────────────

type LancamentoEmpresa = {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  observacao: string | null
  valor: number
  data: string | null
  created_at: string
  quilometragem: number | null
  forma_pagamento: string | null
}

type FiltroRF = 'hoje' | '7dias' | '30dias' | 'mes' | 'personalizado'

const categoriasReceitaRF = [
  { value: 'rota_diaria',       label: 'Rota diária',      emoji: '🚗' },
  { value: 'passagens_avulsas', label: 'Passagens avulsas', emoji: '💵' },
  { value: 'fretamento',        label: 'Fretamento',        emoji: '🏢' },
  { value: 'excursao',          label: 'Excursão',          emoji: '🎉' },
  { value: 'entrega',           label: 'Entrega',           emoji: '📦' },
  { value: 'outros',            label: 'Outros',            emoji: '➕' },
]

const categoriasDespesaRF = [
  // Mao de obra — sem essas categorias o gestor nao tinha onde lancar o que
  // paga a motorista/cobrador, e o lucro saia inflado (caso Elson/CE,
  // 2026-08-04: paga a equipe por DIARIA e precisava saber o lucro real).
  { value: 'repasse_motorista', label: 'Repasse / diária motorista', emoji: '🚐' },
  { value: 'equipe',            label: 'Equipe (cobrador, auxiliar)', emoji: '👥' },
  { value: 'combustivel',   label: 'Combustível',      emoji: '⛽' },
  { value: 'manutencao',    label: 'Manutenção',       emoji: '🔧' },
  { value: 'pedagio',       label: 'Pedágio',          emoji: '🛣️' },
  { value: 'estacionamento',label: 'Estacionamento',   emoji: '🅿️' },
  { value: 'alimentacao',   label: 'Alimentação',      emoji: '🍽️' },
  { value: 'hospedagem',    label: 'Hospedagem/Hotel', emoji: '🏨' },
  { value: 'financiamento', label: 'Financiamento/Parcela', emoji: '🚙' },
  { value: 'pneu',          label: 'Pneu',             emoji: '🔄' },
  { value: 'contas',        label: 'Contas',           emoji: '🧾' },
  { value: 'outros',        label: 'Outros',           emoji: '📦' },
]

// Categorias que representam mao de obra — separadas no breakdown do lucro
// liquido pro gestor enxergar quanto foi pra equipe vs custo de veiculo.
const CATEGORIAS_MAO_DE_OBRA_RF = ['repasse_motorista', 'equipe']

const ABAS_VALIDAS: Aba[] = ['resumo', 'receitas', 'despesas', 'veiculo']

export default function FinanceiroPage() {
  const searchParams = useSearchParams()
  const abaInicial = ABAS_VALIDAS.includes(searchParams.get('aba') as Aba)
    ? (searchParams.get('aba') as Aba)
    : 'resumo'

  const [empresaId, setEmpresaId]   = useState<string | null>(null)
  const [tipoOperacao, setTipoOperacao] = useState<string | null>(null)
  const [periodo, setPeriodo]       = useState<Periodo>('mes_atual')
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dataFimPersonalizada, setDataFimPersonalizada]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [aba, setAba]               = useState<Aba>(abaInicial)
  const [corridas, setCorridas]     = useState<CorridaFin[]>([])
  const [corridasRecebidasPeriodo, setCorridasRecebidasPeriodo] = useState<CorridaFin[]>([])
  const [corridasAReceberTotal, setCorridasAReceberTotal] = useState<CorridaFin[]>([])
  const [despesas, setDespesas]     = useState<Despesa[]>([])
  const [receitasManuais, setReceitasManuais] = useState<Despesa[]>([])
  const [veiculoExpandido, setVeiculoExpandido] = useState<string | null>(null)
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [loading, setLoading]       = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando]     = useState<Despesa | null>(null)
  const [form, setForm]             = useState<FormDespesa>(FORM_VAZIO)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')

  /* ── Filtros das listagens (client-side sobre dados ja carregados) ──
     Nao alteram nenhuma query: filtram em memoria o que ja veio do banco.
     Isso garante zero risco de quebrar o carregamento e resposta instantanea.
     Os totais do RESUMO continuam sempre do periodo inteiro (visao geral);
     so os cabecalhos das listagens refletem o filtro aplicado. */
  const [filtroRecMotorista, setFiltroRecMotorista] = useState('')
  const [filtroRecCliente, setFiltroRecCliente]     = useState('')
  const [filtroDespCategoria, setFiltroDespCategoria] = useState('')
  const [filtroDespMotorista, setFiltroDespMotorista] = useState('')
  const [filtroDespVeiculo, setFiltroDespVeiculo]     = useState('')
  const [filtroDespForma, setFiltroDespForma]         = useState('')
  const [filtroDespReembolso, setFiltroDespReembolso] = useState<'todas' | 'a_cobrar' | 'reembolsadas'>('todas')

  useEffect(() => { inicializar() }, [])
  useEffect(() => {
    if (empresaId && tipoOperacao && tipoOperacao !== 'rota_fixa') carregar(empresaId)
  }, [empresaId, periodo, tipoOperacao, dataInicioPersonalizada, dataFimPersonalizada])

  async function inicializar() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: gestor } = await supabase
      .from('gestores').select('empresa_id').eq('user_id', session.user.id).single()
    if (!gestor) return

    setEmpresaId(gestor.empresa_id)

    const [{ data: mots }, { data: emp }] = await Promise.all([
      supabase
        .from('motoristas_empresa')
        .select('id, nome, veiculo, placa')
        .eq('empresa_id', gestor.empresa_id)
        .eq('status', 'ativo')
        .order('nome'),
      supabase
        .from('empresas')
        .select('tipo_operacao')
        .eq('id', gestor.empresa_id)
        .single(),
    ])

    if (mots) setMotoristas(mots)
    if (emp) setTipoOperacao(emp.tipo_operacao || 'transfer')
  }

  function intervalo(): { inicio: string; fim: string } {
    const hoje = new Date()
    if (periodo === 'personalizado') {
      return { inicio: dataInicioPersonalizada, fim: dataFimPersonalizada }
    }
    if (periodo === 'mes_atual') {
      return {
        inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'),
        fim:    format(endOfMonth(hoje),   'yyyy-MM-dd'),
      }
    }
    const dias = periodo === 'ultimos_7' ? 6 : 29
    return {
      inicio: format(subDays(hoje, dias), 'yyyy-MM-dd'),
      fim:    format(hoje,                'yyyy-MM-dd'),
    }
  }

  async function carregar(eid: string) {
    setLoading(true)

    // MODELO 100% MANUAL — não muda status ao carregar. Corrida fica em
    // 'confirmada' até alguém clicar ▶️ Iniciar. Padrão consistente com
    // /empresa/page.tsx e /empresa/agendamentos/fretamentos após a
    // decisão de 2026-07-16 (Smart Car style).

    const { inicio, fim } = intervalo()
    const selectCorrida = 'id, origem, destino, data_hora, valor, status, cliente_nome, motorista_id, valor_recebido, status_pagamento, data_pagamento, numero_reserva, valor_repasse_motorista, motoristas_empresa(nome, veiculo, placa)'

    const [{ data: corr }, { data: desp }, { data: recebidas }, { data: aReceber }] = await Promise.all([
      // Corridas concluídas no período (atividade/operação, não é a conta de receita)
      supabase
        .from('corridas_empresa')
        .select(selectCorrida)
        .eq('empresa_id', eid)
        .gte('data_hora', `${inicio}T00:00:00`)
        .lte('data_hora', `${fim}T23:59:59`)
        .order('data_hora', { ascending: false }),
      supabase
        .from('despesas_empresa')
        .select('id, motorista_id, veiculo, categoria, descricao, valor, km_odometro, data, tipo, forma_pagamento, cartao_banco, cartao_final, pix_banco, corrida_id, reembolsavel, reembolsado_em')
        .eq('empresa_id', eid)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false }),
      // Receita do período: só o que foi de fato recebido nesse período (data do
      // recebimento, não da viagem) — faturado só entra aqui quando confirmado pago.
      supabase
        .from('corridas_empresa')
        .select(selectCorrida)
        .eq('empresa_id', eid)
        .eq('status_pagamento', 'recebido')
        .gte('data_pagamento', inicio)
        .lte('data_pagamento', fim),
      // A receber: saldo corrente, toda corrida já concluída e ainda não recebida.
      // Mais antigas primeiro — prioriza cobrar quem está devendo há mais tempo.
      supabase
        .from('corridas_empresa')
        .select(selectCorrida)
        .eq('empresa_id', eid)
        .eq('status', 'concluida')
        .neq('status_pagamento', 'recebido')
        .order('data_hora', { ascending: true }),
    ])

    setCorridas((corr as any) ?? [])
    setCorridasRecebidasPeriodo((recebidas as any) ?? [])
    setCorridasAReceberTotal((aReceber as any) ?? [])
    const todosLancamentos = (desp as Despesa[]) ?? []
    setDespesas(todosLancamentos.filter(d => d.tipo !== 'receita'))
    setReceitasManuais(todosLancamentos.filter(d => d.tipo === 'receita'))
    setLoading(false)
  }

  function abrirNova(tipo: 'receita' | 'despesa' = 'despesa') {
    setEditando(null)
    setForm({
      ...FORM_VAZIO,
      tipo,
      categoria: tipo === 'receita' ? CATEGORIAS_RECEITA[0].valor : 'combustivel',
      data: format(new Date(), 'yyyy-MM-dd'),
    })
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(d: Despesa) {
    setEditando(d)
    setForm({
      tipo:         d.tipo,
      categoria:    d.categoria,
      descricao:    d.descricao,
      valor:        String(d.valor),
      veiculo:      d.veiculo ?? '',
      km_odometro:  d.km_odometro != null ? String(d.km_odometro) : '',
      data:         d.data,
      motorista_id: d.motorista_id ?? '',
      forma_pagamento: d.forma_pagamento ?? 'pix',
      cartao_banco: (d as any).cartao_banco ?? '',
      cartao_final: (d as any).cartao_final ?? '',
      pix_banco:    (d as any).pix_banco    ?? '',
      corrida_id:   (d as any).corrida_id   ?? '',
      reembolsavel: !!(d as any).reembolsavel,
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.descricao.trim()) { setErro('Descrição é obrigatória'); return }
    const valor = parseFloat(form.valor)
    if (isNaN(valor) || valor <= 0) { setErro('Valor inválido'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    if (!empresaId) return

    setSalvando(true)
    setErro('')

    const payload = {
      empresa_id:   empresaId,
      tipo:         form.tipo,
      categoria:    form.categoria,
      descricao:    form.descricao.trim(),
      valor,
      veiculo:      form.veiculo.trim() || null,
      km_odometro:  form.km_odometro ? parseInt(form.km_odometro) : null,
      data:         form.data,
      motorista_id: form.motorista_id || null,
      forma_pagamento: form.tipo === 'despesa' ? form.forma_pagamento : null,
      cartao_banco: (form.tipo === 'despesa' && form.forma_pagamento === 'cartao') ? (form.cartao_banco.trim() || null) : null,
      cartao_final: (form.tipo === 'despesa' && form.forma_pagamento === 'cartao') ? (form.cartao_final.trim() || null) : null,
      pix_banco:    (form.tipo === 'despesa' && form.forma_pagamento === 'pix')    ? (form.pix_banco.trim()    || null) : null,
      corrida_id:   (form.tipo === 'despesa' && form.corrida_id) ? form.corrida_id : null,
      // Reembolsavel so faz sentido pra despesa vinculada a atendimento.
      // Sem corrida vinculada, nao tem cliente pra reembolsar.
      reembolsavel: (form.tipo === 'despesa' && form.corrida_id) ? !!form.reembolsavel : false,
    }

    const { error } = editando
      ? await supabase.from('despesas_empresa').update(payload).eq('id', editando.id)
      : await supabase.from('despesas_empresa').insert(payload)

    setSalvando(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    setModalAberto(false)
    carregar(empresaId)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('despesas_empresa').delete().eq('id', id)
    if (empresaId) carregar(empresaId)
  }

  // Marca despesa reembolsavel como paga (cliente reembolsou). Depois disso
  // ela nao aparece mais no relatorio consolidado. Toggle: se ja estiver
  // marcada como paga, desmarca pra voltar pro relatorio (caso Julimar
  // clique errado).
  async function toggleReembolsada(d: Despesa) {
    const jaPago = !!d.reembolsado_em
    await supabase.from('despesas_empresa')
      .update({ reembolsado_em: jaPago ? null : new Date().toISOString() })
      .eq('id', d.id)
    if (empresaId) carregar(empresaId)
  }

  /* ── Cálculos ── */
  // Corridas concluídas no período: só pra mostrar atividade (quantas rodaram),
  // não é usada pra receita — a receita depende de quando foi RECEBIDA, não da viagem.
  const corridasConcluidas = corridas.filter(c => c.status === 'concluida')
  const corridasAReceber   = corridasAReceberTotal
  const totalRecCorridas = corridasRecebidasPeriodo.reduce((s, c) => s + Number(c.valor), 0)
  const totalRecManual   = receitasManuais.reduce((s, r) => s + Number(r.valor), 0)
  const totalRec      = totalRecCorridas + totalRecManual
  const totalValorConcluidas = corridasConcluidas.reduce((s, c) => s + Number(c.valor), 0)
  const totalAReceber = corridasAReceber.reduce((s, c) => s + (Number(c.valor) - Number(c.valor_recebido || 0)), 0)
  const totalDesp     = despesas.reduce((s, d) => s + Number(d.valor), 0)
  // Repasses pagos a motoristas parceiros das corridas RECEBIDAS no periodo —
  // reduzem o lucro real do gestor. Sem isso, o "lucro" fica inflado porque
  // ignora o que o gestor efetivamente repassou pros motoristas agregados.
  const totalRepasseMotoristas = corridasRecebidasPeriodo.reduce(
    (s, c) => s + Number((c as any).valor_repasse_motorista || 0), 0
  )
  const lucro         = totalRec - totalDesp - totalRepasseMotoristas
  const motMap        = Object.fromEntries(motoristas.map(m => [m.id, m]))

  /* ── Listas filtradas (so pras ABAS de listagem; resumo usa os totais
        cheios do periodo acima). Filtro vazio ('') = sem restricao. ── */
  const passaFiltroRec = (motoristaId: string | null, clienteNome: string | null) => {
    if (filtroRecMotorista && motoristaId !== filtroRecMotorista) return false
    if (filtroRecCliente && !(clienteNome || '').toLowerCase().includes(filtroRecCliente.toLowerCase())) return false
    return true
  }
  const corridasRecebidasFiltradas = corridasRecebidasPeriodo.filter(c => passaFiltroRec(c.motorista_id, c.cliente_nome))
  const corridasAReceberFiltradas  = corridasAReceber.filter(c => passaFiltroRec(c.motorista_id, c.cliente_nome))
  const receitasManuaisFiltradas   = receitasManuais.filter(r => passaFiltroRec(r.motorista_id, r.descricao))
  const totalRecCorridasFiltrado = corridasRecebidasFiltradas.reduce((s, c) => s + Number(c.valor), 0)
  const totalAReceberFiltrado    = corridasAReceberFiltradas.reduce((s, c) => s + (Number(c.valor) - Number(c.valor_recebido || 0)), 0)
  const totalRecManualFiltrado   = receitasManuaisFiltradas.reduce((s, r) => s + Number(r.valor), 0)

  const despesasFiltradas = despesas.filter(d => {
    if (filtroDespCategoria && d.categoria !== filtroDespCategoria) return false
    if (filtroDespMotorista && d.motorista_id !== filtroDespMotorista) return false
    if (filtroDespVeiculo && (d.veiculo || '') !== filtroDespVeiculo) return false
    if (filtroDespForma && d.forma_pagamento !== filtroDespForma) return false
    if (filtroDespReembolso === 'a_cobrar'     && !(d.reembolsavel && !d.reembolsado_em)) return false
    if (filtroDespReembolso === 'reembolsadas' && !(d.reembolsavel && d.reembolsado_em))  return false
    return true
  })
  const totalDespFiltrado = despesasFiltradas.reduce((s, d) => s + Number(d.valor), 0)

  // Opcoes dos dropdowns — derivadas dos dados reais do periodo, entao so
  // aparece o que de fato existe (nao polui com opcao que retorna vazio).
  const categoriasComDespesa = Array.from(new Set(despesas.map(d => d.categoria).filter(Boolean)))
  const veiculosComDespesa   = Array.from(new Set(despesas.map(d => d.veiculo).filter(Boolean))) as string[]
  const formasComDespesa     = Array.from(new Set(despesas.map(d => d.forma_pagamento).filter(Boolean))) as string[]
  const temFiltroDesp = !!(filtroDespCategoria || filtroDespMotorista || filtroDespVeiculo || filtroDespForma || filtroDespReembolso !== 'todas')
  const temFiltroRec  = !!(filtroRecMotorista || filtroRecCliente)

  /* ── Agrupar por veículo ── */
  type VItem = { key: string; nome: string; veiculo: string; receita: number; despesa: number; qtd: number }
  const vMap = new Map<string, VItem>()

  corridasRecebidasPeriodo.forEach(c => {
    const key  = c.motorista_id ?? '__sem__'
    const mot  = c.motoristas_empresa as any
    const nome = mot?.nome ?? 'Sem motorista'
    const veic = [mot?.veiculo, mot?.placa].filter(Boolean).join(' · ') || 'Sem veículo'
    if (!vMap.has(key)) vMap.set(key, { key, nome, veiculo: veic, receita: 0, despesa: 0, qtd: 0 })
    const item = vMap.get(key)!
    item.receita += Number(c.valor)
    item.qtd++
  })

  receitasManuais.forEach(r => {
    const key = r.motorista_id ?? '__sem__'
    if (!vMap.has(key)) {
      const m   = r.motorista_id ? motMap[r.motorista_id] : undefined
      const veic = [m?.veiculo, m?.placa].filter(Boolean).join(' · ') || r.veiculo || 'Sem veículo'
      vMap.set(key, { key, nome: m?.nome ?? 'Sem motorista', veiculo: veic, receita: 0, despesa: 0, qtd: 0 })
    }
    vMap.get(key)!.receita += Number(r.valor)
  })

  despesas.forEach(d => {
    const key = d.motorista_id ?? '__sem__'
    if (!vMap.has(key)) {
      const m   = d.motorista_id ? motMap[d.motorista_id] : undefined
      const veic = [m?.veiculo, m?.placa].filter(Boolean).join(' · ') || d.veiculo || 'Sem veículo'
      vMap.set(key, { key, nome: m?.nome ?? 'Sem motorista', veiculo: veic, receita: 0, despesa: 0, qtd: 0 })
    }
    vMap.get(key)!.despesa += Number(d.valor)
  })

  const veiculos = Array.from(vMap.values())
    .sort((a, b) => (b.receita - b.despesa) - (a.receita - a.despesa))

  const periodoLabel = periodo === 'mes_atual'
    ? format(new Date(), 'MMMM yyyy', { locale: ptBR })
    : periodo === 'ultimos_7' ? 'Últimos 7 dias'
    : periodo === 'ultimos_30' ? 'Últimos 30 dias'
    : dataInicioPersonalizada === dataFimPersonalizada
      ? dataInicioPersonalizada.split('-').reverse().join('/')
      : `${dataInicioPersonalizada.split('-').reverse().join('/')} até ${dataFimPersonalizada.split('-').reverse().join('/')}`

  const fmt = (v: number) =>
    `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  if (!tipoOperacao) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-pulse">💰</div>
      </div>
    )
  }

  if (tipoOperacao === 'rota_fixa' && empresaId) {
    return <FinanceiroRotaFixa empresaId={empresaId} />
  }

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-0">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
          <div className="flex-1 min-w-0">
            <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Financeiro</p>
            <p style={{ color: '#5DCAA5' }} className="text-xs capitalize">{periodoLabel}</p>
          </div>
        </div>

        {/* Filtro de período */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {(['mes_atual', 'ultimos_7', 'ultimos_30', 'personalizado'] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
              style={periodo === p
                ? { background: '#E1F5EE', color: '#085041' }
                : { background: '#085041', color: '#9FE1CB' }}>
              {p === 'mes_atual' ? 'Este mês' : p === 'ultimos_7' ? '7 dias' : p === 'ultimos_30' ? '30 dias' : '📅 Personalizado'}
            </button>
          ))}
        </div>

        {/* Período personalizado — De / Até, tipo Google/Facebook Ads */}
        {periodo === 'personalizado' && (
          <div className="bg-white rounded-xl flex flex-wrap items-center gap-2 px-3 py-2 mb-3">
            <span className="text-xs font-semibold text-gray-500">De</span>
            <input type="date" value={dataInicioPersonalizada}
              onChange={e => {
                setDataInicioPersonalizada(e.target.value)
                if (e.target.value > dataFimPersonalizada) setDataFimPersonalizada(e.target.value)
              }}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 outline-none" />
            <span className="text-gray-400 text-sm">até</span>
            <input type="date" value={dataFimPersonalizada} min={dataInicioPersonalizada}
              onChange={e => setDataFimPersonalizada(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 outline-none" />
            <button onClick={() => { const h = format(new Date(), 'yyyy-MM-dd'); setDataInicioPersonalizada(h); setDataFimPersonalizada(h) }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500">
              Hoje
            </button>
          </div>
        )}

        {/* Abas */}
        <div className="flex">
          {(['resumo', 'receitas', 'despesas', 'veiculo'] as Aba[]).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className="flex-1 py-2.5 text-[11px] font-semibold border-b-2"
              style={aba === a
                ? { borderColor: '#9FE1CB', color: '#E1F5EE', background: 'transparent' }
                : { borderColor: 'transparent', color: '#5DCAA5', background: 'transparent' }}>
              {a === 'resumo' ? 'Resumo' : a === 'receitas' ? 'Receitas' : a === 'despesas' ? 'Despesas' : 'Veículos'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-4xl animate-pulse">💰</div>
          </div>

        ) : aba === 'resumo' ? (
          /* ── Resumo ── */
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">💰 Receita realizada</p>
                <p className="text-xl font-bold" style={{ color: '#0F6E56' }}>{fmt(totalRec)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">🕐 A receber</p>
                <p className="text-xl font-bold" style={{ color: '#1D4ED8' }}>{fmt(totalAReceber)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">📤 Despesas</p>
                <p className="text-xl font-bold" style={{ color: '#A32D2D' }}>{fmt(totalDesp)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">📊 Ticket médio</p>
                <p className="text-xl font-bold" style={{ color: '#185FA5' }}>
                  {corridasConcluidas.length > 0 ? fmt(totalValorConcluidas / corridasConcluidas.length) : 'R$ 0'}
                </p>
              </div>

              {/* Lucro liquido — destaque com breakdown transparente. Cliente do
                  Parana pediu 2026-07-28: mostrar que o lucro real ja desconta
                  o repasse aos motoristas parceiros (senao ficava inflado). */}
              <div className="col-span-2 rounded-2xl p-4 border"
                style={{
                  background:   lucro >= 0 ? '#E1F5EE' : '#FCEBEB',
                  borderColor:  lucro >= 0 ? '#9FE1CB' : '#FECACA',
                }}>
                <p className="text-xs mb-2" style={{ color: lucro >= 0 ? '#085041' : '#A32D2D' }}>
                  {lucro >= 0 ? '📈' : '📉'} Lucro líquido
                </p>
                {/* Breakdown so aparece quando ha repasses ou despesas pra
                    somar (evita ruido em empresas simples que so tem receita) */}
                {(totalRepasseMotoristas > 0 || totalDesp > 0) && (
                  <div className="text-[11px] mb-2" style={{ color: lucro >= 0 ? '#085041' : '#A32D2D' }}>
                    <div className="flex justify-between">
                      <span>Receita</span>
                      <span>{fmt(totalRec)}</span>
                    </div>
                    {totalRepasseMotoristas > 0 && (
                      <div className="flex justify-between">
                        <span>(-) Repasse motoristas</span>
                        <span>{fmt(totalRepasseMotoristas)}</span>
                      </div>
                    )}
                    {totalDesp > 0 && (
                      <div className="flex justify-between">
                        <span>(-) Despesas</span>
                        <span>{fmt(totalDesp)}</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-2xl font-bold" style={{ color: lucro >= 0 ? '#0F6E56' : '#A32D2D' }}>
                  {lucro < 0 ? '-' : ''}{fmt(lucro)}
                </p>
              </div>

              <div className="col-span-2 bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">🚗 Atendimentos concluídos</p>
                <p className="text-xl font-bold" style={{ color: '#6B7280' }}>{corridasConcluidas.length}</p>
              </div>
            </div>
          </div>

        ) : aba === 'receitas' ? (
          /* ── Receitas ── */
          <div className="flex flex-col gap-4">
            <button onClick={() => abrirNova('receita')}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#1D9E75', color: '#fff' }}>
              + Adicionar receita
            </button>

            {/* Filtros da listagem — client-side, nao refazem query */}
            <div className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">🔍 Filtrar</p>
                {temFiltroRec && (
                  <button onClick={() => { setFiltroRecMotorista(''); setFiltroRecCliente('') }}
                    className="text-[11px] font-medium underline" style={{ color: '#A32D2D' }}>
                    limpar filtros
                  </button>
                )}
              </div>
              <input value={filtroRecCliente} onChange={e => setFiltroRecCliente(e.target.value)}
                placeholder="Buscar por cliente..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600" />
              {motoristas.length > 0 && (
                <select value={filtroRecMotorista} onChange={e => setFiltroRecMotorista(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600">
                  <option value="">Todos os motoristas</option>
                  {motoristas.map(m => (
                    <option key={m.id} value={m.id}>🚗 {m.nome}{m.veiculo ? ` · ${m.veiculo}` : ''}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Recebidas no período (o que efetivamente virou dinheiro) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#0F6E56' }}>
                  ✅ Recebidas no período · {corridasRecebidasFiltradas.length}
                </p>
                {corridasRecebidasFiltradas.length > 0 && (
                  <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>{fmt(totalRecCorridasFiltrado)}</p>
                )}
              </div>
              {corridasRecebidasFiltradas.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400">
                    {temFiltroRec ? 'Nenhum atendimento recebido com esse filtro' : 'Nenhum atendimento recebido no período'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {corridasRecebidasFiltradas.map(c => {
                    const mot = c.motoristas_empresa as any
                    return (
                      <div key={c.id} className="bg-white rounded-2xl p-3 border border-gray-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{c.origem} → {c.destino}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {c.data_hora.slice(8, 10)}/{c.data_hora.slice(5, 7)} · {c.cliente_nome}
                            </p>
                            {mot?.nome && <p className="text-xs text-gray-400">🚗 {mot.nome}</p>}
                          </div>
                          <p className="text-sm font-bold flex-shrink-0" style={{ color: '#0F6E56' }}>{fmt(Number(c.valor))}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* A receber (saldo corrente — corridas já concluídas, ainda não recebidas) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>
                  🕐 A receber · {corridasAReceberFiltradas.length}
                </p>
                {corridasAReceberFiltradas.length > 0 && (
                  <p className="text-sm font-bold" style={{ color: '#1D4ED8' }}>{fmt(totalAReceberFiltrado)}</p>
                )}
              </div>
              {corridasAReceberFiltradas.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400">
                    {temFiltroRec ? 'Nenhum pendente com esse filtro' : 'Nenhum atendimento concluído pendente de recebimento'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {corridasAReceberFiltradas.map(c => {
                    const mot = c.motoristas_empresa as any
                    return (
                      <div key={c.id} className="rounded-2xl p-3 border" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{c.origem} → {c.destino}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {c.data_hora.slice(8, 10)}/{c.data_hora.slice(5, 7)} às {c.data_hora.slice(11, 16)} · {c.cliente_nome}
                            </p>
                            {mot?.nome && <p className="text-xs text-gray-400">🚗 {mot.nome}</p>}
                          </div>
                          <p className="text-sm font-bold flex-shrink-0" style={{ color: '#1D4ED8' }}>{fmt(Number(c.valor))}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Receitas manuais (fora do fluxo automático de corridas) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#0F6E56' }}>
                  ➕ Lançadas manualmente · {receitasManuaisFiltradas.length}
                </p>
                {receitasManuaisFiltradas.length > 0 && (
                  <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>{fmt(totalRecManualFiltrado)}</p>
                )}
              </div>
              {receitasManuaisFiltradas.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400">
                    {temFiltroRec ? 'Nenhuma receita manual com esse filtro' : 'Nenhuma receita lançada manualmente no período'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {receitasManuaisFiltradas.map(r => {
                    const cat = catReceitaMap[r.categoria] ?? { label: r.categoria, emoji: '➕' }
                    const m = r.motorista_id ? motMap[r.motorista_id] : undefined
                    return (
                      <div key={r.id} className="bg-white rounded-2xl p-3 border border-gray-100">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                            style={{ background: '#E1F5EE' }}>
                            {cat.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{r.descricao}</p>
                            <p className="text-xs text-gray-400">
                              {cat.label} · {r.data.slice(8, 10)}/{r.data.slice(5, 7)}
                            </p>
                            {(m || r.veiculo) && (
                              <p className="text-xs text-gray-400">
                                🚗 {[m?.nome, r.veiculo].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                              {fmt(Number(r.valor))}
                            </p>
                            <div className="flex gap-1">
                              <button onClick={() => abrirEditar(r)}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium"
                                style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                                ✏️
                              </button>
                              <button onClick={() => excluir(r.id)}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium"
                                style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        ) : aba === 'despesas' ? (
          /* ── Despesas ── */
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {despesasFiltradas.length} despesa{despesasFiltradas.length !== 1 ? 's' : ''}
                {temFiltroDesp && despesas.length !== despesasFiltradas.length && (
                  <span className="normal-case font-normal"> de {despesas.length}</span>
                )}
              </p>
              {despesasFiltradas.length > 0 && (
                <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>{fmt(totalDespFiltrado)}</p>
              )}
            </div>
            <button onClick={() => abrirNova('despesa')}
              className="w-full py-3 rounded-xl text-sm font-semibold mb-3"
              style={{ background: '#1D9E75', color: '#fff' }}>
              + Adicionar despesa
            </button>

            {/* Filtros da listagem — client-side, nao refazem query.
                Dropdowns so listam valores que existem no periodo. */}
            {despesas.length > 0 && (
              <div className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">🔍 Filtrar</p>
                  {temFiltroDesp && (
                    <button onClick={() => {
                      setFiltroDespCategoria(''); setFiltroDespMotorista('')
                      setFiltroDespVeiculo(''); setFiltroDespForma(''); setFiltroDespReembolso('todas')
                    }}
                      className="text-[11px] font-medium underline" style={{ color: '#A32D2D' }}>
                      limpar filtros
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {categoriasComDespesa.length > 1 && (
                    <select value={filtroDespCategoria} onChange={e => setFiltroDespCategoria(e.target.value)}
                      className="px-2 py-2 rounded-xl border border-gray-200 text-xs outline-none bg-white focus:border-green-600">
                      <option value="">Todas categorias</option>
                      {categoriasComDespesa.map(cv => {
                        const c = catMap[cv]
                        return <option key={cv} value={cv}>{c ? `${c.emoji} ${c.label}` : cv}</option>
                      })}
                    </select>
                  )}
                  {motoristas.length > 0 && (
                    <select value={filtroDespMotorista} onChange={e => setFiltroDespMotorista(e.target.value)}
                      className="px-2 py-2 rounded-xl border border-gray-200 text-xs outline-none bg-white focus:border-green-600">
                      <option value="">Todos motoristas</option>
                      {motoristas.map(m => <option key={m.id} value={m.id}>🚗 {m.nome}</option>)}
                    </select>
                  )}
                  {veiculosComDespesa.length > 1 && (
                    <select value={filtroDespVeiculo} onChange={e => setFiltroDespVeiculo(e.target.value)}
                      className="px-2 py-2 rounded-xl border border-gray-200 text-xs outline-none bg-white focus:border-green-600">
                      <option value="">Todos veículos</option>
                      {veiculosComDespesa.map(v => <option key={v} value={v}>🚙 {v}</option>)}
                    </select>
                  )}
                  {formasComDespesa.length > 1 && (
                    <select value={filtroDespForma} onChange={e => setFiltroDespForma(e.target.value)}
                      className="px-2 py-2 rounded-xl border border-gray-200 text-xs outline-none bg-white focus:border-green-600">
                      <option value="">Todas formas pgto</option>
                      {formasComDespesa.map(f => (
                        <option key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f] ?? f}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Toggle de reembolso — so aparece se a empresa usa reembolsaveis */}
                {despesas.some(d => d.reembolsavel) && (
                  <div className="flex gap-1.5">
                    {([
                      { id: 'todas' as const,        label: 'Todas' },
                      { id: 'a_cobrar' as const,     label: '🟡 A cobrar' },
                      { id: 'reembolsadas' as const, label: '🟢 Reembolsadas' },
                    ]).map(f => (
                      <button key={f.id} onClick={() => setFiltroDespReembolso(f.id)}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                        style={filtroDespReembolso === f.id
                          ? { background: '#0F6E56', color: '#fff' }
                          : { background: '#f3f4f6', color: '#6b7280' }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Totalizador por categoria — so quando ha mais de uma categoria
                no resultado filtrado. Ajuda o gestor a ver onde o dinheiro foi. */}
            {despesasFiltradas.length > 1 && (() => {
              const porCat = new Map<string, number>()
              despesasFiltradas.forEach(d => {
                porCat.set(d.categoria, (porCat.get(d.categoria) || 0) + Number(d.valor))
              })
              if (porCat.size < 2) return null
              const linhas = Array.from(porCat.entries()).sort((a, b) => b[1] - a[1])
              return (
                <div className="rounded-2xl p-3 mb-3" style={{ background: '#FCEBEB', border: '1px solid #F5BCBC' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#A32D2D' }}>
                    Total por categoria
                  </p>
                  {linhas.map(([cv, total]) => {
                    const c = catMap[cv]
                    const pct = totalDespFiltrado > 0 ? (total / totalDespFiltrado) * 100 : 0
                    return (
                      <div key={cv} className="flex items-center justify-between text-xs py-0.5" style={{ color: '#A32D2D' }}>
                        <span>{c ? `${c.emoji} ${c.label}` : cv}</span>
                        <span className="font-semibold">{fmt(total)} <span className="font-normal opacity-60">({pct.toFixed(0)}%)</span></span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {despesasFiltradas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-gray-400">
                  {temFiltroDesp ? 'Nenhuma despesa com esse filtro' : 'Nenhuma despesa no período'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {despesasFiltradas.map(d => {
                  const cat = catMap[d.categoria] ?? { label: d.categoria, emoji: '📦' }
                  const m = d.motorista_id ? motMap[d.motorista_id] : undefined
                  return (
                    <div key={d.id} className="bg-white rounded-2xl p-3 border border-gray-100">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                          style={{ background: '#FCEBEB' }}>
                          {cat.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{d.descricao}</p>
                          <p className="text-xs text-gray-400">
                            {cat.label} · {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                          </p>
                          {(m || d.veiculo) && (
                            <p className="text-xs text-gray-400">
                              🚗 {[m?.nome, d.veiculo].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {d.km_odometro != null && (
                            <p className="text-xs text-gray-400">
                              📏 {d.km_odometro.toLocaleString('pt-BR')} km
                            </p>
                          )}
                          {d.forma_pagamento && (
                            <p className="text-xs text-gray-400">
                              {FORMA_PAGAMENTO_LABEL[d.forma_pagamento] ?? d.forma_pagamento}
                              {d.forma_pagamento === 'cartao' && (d.cartao_banco || d.cartao_final)
                                ? ` (${[d.cartao_banco, d.cartao_final ? `final ${d.cartao_final}` : null].filter(Boolean).join(' · ')})`
                                : d.forma_pagamento === 'pix' && d.pix_banco
                                ? ` (${d.pix_banco})`
                                : ''}
                            </p>
                          )}
                          {d.corrida_id && (() => {
                            const c = corridas.find(x => x.id === d.corrida_id)
                            if (!c) return null
                            const num = c.numero_reserva || `#${c.id.slice(-5).toUpperCase()}`
                            return (
                              <Link href={`/empresa/agendamentos/fretamentos?ficha=${c.id}`}
                                className="text-xs underline block"
                                style={{ color: '#0F6E56' }}>
                                🔗 Atendimento {num} · {c.cliente_nome} · {c.origem} → {c.destino}
                              </Link>
                            )
                          })()}
                          {/* Badge de reembolso: amarelo = a cobrar, verde = paga */}
                          {d.reembolsavel && (
                            <div className="mt-1 flex items-center gap-1.5">
                              {d.reembolsado_em ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ background: '#E1F5EE', color: '#085041' }}>
                                  🟢 Reembolsada em {d.reembolsado_em.slice(8,10)}/{d.reembolsado_em.slice(5,7)}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ background: '#FEF9E7', color: '#854F0B' }}>
                                  🟡 Reembolso a cobrar
                                </span>
                              )}
                              <button onClick={() => toggleReembolsada(d)}
                                className="text-[10px] font-medium underline"
                                style={{ color: '#0F6E56' }}
                                title={d.reembolsado_em ? 'Desmarcar (voltar pro relatório)' : 'Marcar como paga pelo cliente'}>
                                {d.reembolsado_em ? 'desmarcar' : 'marcar paga'}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>
                            {fmt(Number(d.valor))}
                          </p>
                          <div className="flex gap-1">
                            <button onClick={() => abrirEditar(d)}
                              className="px-2 py-1 rounded-lg text-[10px] font-medium"
                              style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                              ✏️
                            </button>
                            <button onClick={() => excluir(d.id)}
                              className="px-2 py-1 rounded-lg text-[10px] font-medium"
                              style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        ) : (
          /* ── Veículos ── */
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Resultado por veículo
            </p>
            {veiculos.length === 0 ? (
              <div className="text-center py-12">
                <svg width="48" height="48" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="mb-2 mx-auto">
                  <rect width="192" height="192" rx="42" fill="#04342C"/>
                  <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
                  <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
                  <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
                  <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
                </svg>
                <p className="text-sm text-gray-400">Nenhum dado no período</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {veiculos.map(v => {
                  const lv = v.receita - v.despesa
                  const expandido = veiculoExpandido === v.key
                  // Lançamentos deste veículo especificamente, pro drill-down
                  const corridasDoVeiculo = corridasRecebidasPeriodo.filter(c => (c.motorista_id ?? '__sem__') === v.key)
                  const receitasManuaisDoVeiculo = receitasManuais.filter(r => (r.motorista_id ?? '__sem__') === v.key)
                  const despesasDoVeiculo = despesas.filter(d => (d.motorista_id ?? '__sem__') === v.key)
                  return (
                    <div key={v.key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <button type="button" onClick={() => setVeiculoExpandido(expandido ? null : v.key)}
                        className="w-full text-left p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{v.nome}</p>
                            <p className="text-xs text-gray-400">{v.veiculo}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[11px] font-bold px-2 py-1 rounded-lg"
                              style={lv >= 0
                                ? { background: '#E1F5EE', color: '#0F6E56' }
                                : { background: '#FCEBEB', color: '#A32D2D' }}>
                              {lv >= 0 ? '+' : '-'}{fmt(lv)}
                            </span>
                            <span className="text-gray-300 text-sm">{expandido ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-50">
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 mb-0.5">Receita</p>
                            <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>{fmt(v.receita)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 mb-0.5">Despesas</p>
                            <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>{fmt(v.despesa)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 mb-0.5">Corridas</p>
                            <p className="text-sm font-bold text-gray-700">{v.qtd}</p>
                          </div>
                        </div>
                      </button>

                      {expandido && (
                        <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: '1px solid #f5f5f5' }}>
                          {/* Receitas do veículo */}
                          <div className="pt-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#0F6E56' }}>
                              💰 Receitas
                            </p>
                            {corridasDoVeiculo.length === 0 && receitasManuaisDoVeiculo.length === 0 ? (
                              <p className="text-xs text-gray-400">Nenhuma receita no período</p>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {corridasDoVeiculo.map(c => (
                                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="text-gray-600 truncate">{c.origem} → {c.destino} · {c.data_hora.slice(8,10)}/{c.data_hora.slice(5,7)}</span>
                                    <span className="font-semibold flex-shrink-0" style={{ color: '#0F6E56' }}>{fmt(Number(c.valor))}</span>
                                  </div>
                                ))}
                                {receitasManuaisDoVeiculo.map(r => (
                                  <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="text-gray-600 truncate">➕ {r.descricao} · {r.data.slice(8,10)}/{r.data.slice(5,7)}</span>
                                    <span className="font-semibold flex-shrink-0" style={{ color: '#0F6E56' }}>{fmt(Number(r.valor))}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Despesas do veículo */}
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#A32D2D' }}>
                              🧾 Despesas
                            </p>
                            {despesasDoVeiculo.length === 0 ? (
                              <p className="text-xs text-gray-400">Nenhuma despesa no período</p>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {despesasDoVeiculo.map(d => {
                                  const cat = catMap[d.categoria] ?? { label: d.categoria, emoji: '📦' }
                                  return (
                                    <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                                      <span className="text-gray-600 truncate">{cat.emoji} {d.descricao} · {d.data.slice(8,10)}/{d.data.slice(5,7)}</span>
                                      <span className="font-semibold flex-shrink-0" style={{ color: '#A32D2D' }}>{fmt(Number(d.valor))}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        <div className="h-20" />
      </div>

      {/* Modal nova/editar despesa */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
              {editando
                ? (form.tipo === 'receita' ? 'Editar receita' : 'Editar despesa')
                : (form.tipo === 'receita' ? 'Nova receita' : 'Nova despesa')}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 flex flex-col gap-3">
            <Campo label="Categoria">
              <select value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                className="campo-input">
                {(form.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS).map(c => (
                  <option key={c.valor} value={c.valor}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Descrição *">
              <input value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder={form.tipo === 'receita' ? 'Ex: Atendimento combinado direto com o cliente' : 'Ex: Abastecimento — posto BR km 45'}
                className="campo-input" />
            </Campo>

            <Campo label="Valor (R$) *">
              <input type="number" step="0.01" min={0}
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
                className="campo-input" />
            </Campo>

            <Campo label="Data *">
              <input type="date" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                className="campo-input" />
            </Campo>

            {form.tipo === 'despesa' && (
              <Campo label="Como foi pago">
                <select value={form.forma_pagamento}
                  onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                  className="campo-input">
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </Campo>
            )}

            {/* Detalhes do cartão — só quando despesa paga no cartão. Banco
                + últimos 4 dígitos, nunca o número completo. */}
            {form.tipo === 'despesa' && form.forma_pagamento === 'cartao' && (
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>💳 Detalhes do cartão <span className="font-normal text-gray-500">— opcional</span></p>
                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Banco / cartão">
                    <input value={form.cartao_banco}
                      onChange={e => setForm(f => ({ ...f, cartao_banco: e.target.value }))}
                      placeholder="Ex: Nubank" className="campo-input" />
                  </Campo>
                  <Campo label="Final (4 dígitos)">
                    <input value={form.cartao_final}
                      onChange={e => setForm(f => ({ ...f, cartao_final: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="1234" inputMode="numeric" maxLength={4} className="campo-input" />
                  </Campo>
                </div>
              </div>
            )}

            {/* Banco do Pix — pedido do Julimar pra bater com extrato bancario
                no fim do mes ("qual banco recebeu esses R$ do Pix?"). */}
            {form.tipo === 'despesa' && form.forma_pagamento === 'pix' && (
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}>
                <p className="text-xs font-semibold" style={{ color: '#166534' }}>📱 Banco do Pix <span className="font-normal text-gray-500">— opcional</span></p>
                <input value={form.pix_banco}
                  onChange={e => setForm(f => ({ ...f, pix_banco: e.target.value }))}
                  placeholder="Ex: Nubank, Itaú, Sicoob" className="campo-input" />
              </div>
            )}

            <Campo label="Motorista (opcional)">
              <select value={form.motorista_id}
                onChange={e => {
                  const id = e.target.value
                  const m = motoristas.find(m => m.id === id)
                  setForm(f => ({
                    ...f,
                    motorista_id: id,
                    veiculo: id && m ? [m.veiculo, m.placa].filter(Boolean).join(' ') : f.veiculo,
                  }))
                }}
                className="campo-input">
                <option value="">Selecionar...</option>
                {motoristas.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nome}{m.veiculo ? ` · ${m.veiculo}` : ''}
                  </option>
                ))}
              </select>
            </Campo>

            {/* Vincular despesa a um atendimento — pedido do Julimar pra saber
                quanto uma corrida especifica custou (combustivel + pedagio etc).
                So aparece pra despesa. Corridas ordenadas por data desc — mais
                recente primeiro. */}
            {form.tipo === 'despesa' && (
              <Campo label="Vincular a atendimento (opcional)">
                <select value={form.corrida_id}
                  onChange={e => setForm(f => ({ ...f, corrida_id: e.target.value, reembolsavel: e.target.value ? f.reembolsavel : false }))}
                  className="campo-input">
                  <option value="">Nenhum</option>
                  {[...corridas].sort((a, b) => b.data_hora.localeCompare(a.data_hora)).map(c => {
                    const num = c.numero_reserva || `#${c.id.slice(-5).toUpperCase()}`
                    const dt = `${c.data_hora.slice(8,10)}/${c.data_hora.slice(5,7)}`
                    return (
                      <option key={c.id} value={c.id}>
                        {num} · {dt} · {c.origem} → {c.destino}
                      </option>
                    )
                  })}
                </select>
              </Campo>
            )}

            {/* Checkbox de reembolso — so aparece quando ha atendimento
                vinculado (sem corrida, nao tem cliente pra reembolsar).
                Padrao QuickBooks/Bling: despesa marcada entra no relatorio
                consolidado do cliente ate ser marcada como reembolsada. */}
            {form.tipo === 'despesa' && form.corrida_id && (
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: '#FEF9E7', border: '1px solid #FAC775' }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.reembolsavel}
                    onChange={e => setForm(f => ({ ...f, reembolsavel: e.target.checked }))} />
                  <span className="text-sm font-semibold" style={{ color: '#854F0B' }}>
                    🔄 Reembolsável pelo cliente
                  </span>
                </label>
                <p className="text-[10px]" style={{ color: '#854F0B' }}>
                  Marque quando a despesa foi combinada como reembolsável (estacionamento,
                  pedágio extra, etc). Ela vai aparecer no relatório consolidado do cliente
                  até você marcar como paga.
                </p>
              </div>
            )}

            <Campo label="Veículo">
              <input value={form.veiculo}
                onChange={e => setForm(f => ({ ...f, veiculo: e.target.value }))}
                placeholder="Ex: Sprinter · ABC-1234"
                className="campo-input" />
            </Campo>

            <Campo label="KM odômetro (opcional)">
              <input type="number" min={0}
                value={form.km_odometro}
                onChange={e => setForm(f => ({ ...f, km_odometro: e.target.value }))}
                placeholder="Ex: 125000"
                className="campo-input" />
            </Campo>

            {erro && (
              <div className="rounded-xl px-4 py-3 text-sm border"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                ⚠️ {erro}
              </div>
            )}
          </div>

          <div style={{ padding: '12px 16px 80px', background: 'white', borderTop: '1px solid #e5e7eb' }}>
            <button onClick={salvar} disabled={salvando}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvando
                ? 'Salvando...'
                : editando
                  ? 'Salvar alterações'
                  : (form.tipo === 'receita' ? '✓ Registrar receita' : '✓ Registrar despesa')}
            </button>
          </div>

          <style jsx>{`
            .campo-input {
              width: 100%; padding: 10px 12px; border-radius: 12px;
              border: 1px solid #e5e7eb; font-size: 16px; color: #222;
              background: #fff; outline: none;
            }
            .campo-input:focus { border-color: #1D9E75; }
          `}</style>
        </div>
      )}
    </div>
  )
}

// ─── FINANCEIRO ROTA FIXA ────────────────────────────────────────────────────

type ReceitaAgendamento = {
  id: string
  valor: number
  data_viagem: string
  nome_passageiro: string | null
  parada_origem: string | null
  parada_destino: string | null
  forma_pagamento: string | null
}

type ReceitaEncomenda = {
  id: string
  nome: string | null
  valor: number
  data_pago: string | null
  criado_em: string
  forma_pagamento: string | null
}

// Atendimentos que vivem em corridas_empresa e ate agora NAO entravam no
// financeiro do rota fixa: fretamento, excursao e as reservas vindas do link
// publico. O gestor via esse dinheiro na agenda mas nunca no caixa.
type ReceitaCorridaRF = {
  id: string
  origem: string
  destino: string
  data_hora: string
  valor: number
  cliente_nome: string | null
  tipo_servico: string | null
  valor_repasse_motorista: number | null
}

function FinanceiroRotaFixa({ empresaId }: { empresaId: string }) {
  const [filtro, setFiltro] = useState<FiltroRF>('mes')
  const [mes, setMes] = useState(new Date())
  const [dataInicioCustom, setDataInicioCustom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dataFimCustom, setDataFimCustom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [lancamentos, setLancamentos] = useState<LancamentoEmpresa[]>([])
  const [receitasAgendamentos, setReceitasAgendamentos] = useState<ReceitaAgendamento[]>([])
  const [receitasEncomendas, setReceitasEncomendas] = useState<ReceitaEncomenda[]>([])
  const [receitasCorridas, setReceitasCorridas] = useState<ReceitaCorridaRF[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | 'receita' | 'despesa'>(null)
  const [editando, setEditando] = useState<LancamentoEmpresa | null>(null)
  /* Filtros das listagens (client-side, nao refazem query) */
  const [filtroCategoriaRF, setFiltroCategoriaRF] = useState('')
  const [filtroFormaRF, setFiltroFormaRF]         = useState('')
  const [buscaEncomendaRF, setBuscaEncomendaRF]   = useState('')

  useEffect(() => { carregar() }, [filtro, mes, dataInicioCustom, dataFimCustom])

  function getPeriodo() {
    const hoje = new Date()
    if (filtro === 'hoje')  return { inicio: format(startOfDay(hoje), 'yyyy-MM-dd'),  fim: format(endOfDay(hoje), 'yyyy-MM-dd') }
    if (filtro === '7dias') return { inicio: format(subDays(hoje, 6), 'yyyy-MM-dd'),   fim: format(hoje, 'yyyy-MM-dd') }
    if (filtro === '30dias') return { inicio: format(subDays(hoje, 29), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') }
    if (filtro === 'personalizado') return { inicio: dataInicioCustom, fim: dataFimCustom }
    return { inicio: format(startOfMonth(mes), 'yyyy-MM-dd'), fim: format(endOfMonth(mes), 'yyyy-MM-dd') }
  }

  async function carregar() {
    setLoading(true)
    const { inicio, fim } = getPeriodo()

    // Pega os user_ids dos motoristas da empresa — precisamos deles pra buscar
    // agendamentos/encomendas, ja que essas tabelas guardam motorista_id = user_id
    // do funcionario, nao empresa_id. Nao filtramos por status pra nao perder
    // historico de motorista que foi desativado depois.
    const { data: mots } = await supabase
      .from('motoristas_empresa')
      .select('user_id')
      .eq('empresa_id', empresaId)
    const userIds = (mots ?? []).map(m => m.user_id).filter(Boolean) as string[]

    const [{ data: cobrancas, error: errCobr }, { data: agends }, { data: encs }, { data: corrs, error: errCorr }] = await Promise.all([
      supabase
        .from('cobrancas_empresa')
        .select('id, tipo, categoria, observacao, valor, data, created_at, quilometragem, forma_pagamento, cartao_banco, cartao_final')
        .eq('empresa_id', empresaId)
        .in('tipo', ['receita', 'despesa'])
        .order('created_at', { ascending: false }),
      // Receitas automaticas: viagens realizadas pelos motoristas da empresa.
      // Mesmo filtro do individual: exclui cancelado e nao conta fiado ainda-nao-pago.
      userIds.length > 0
        ? supabase
            .from('agendamentos')
            .select('id, valor, data_viagem, nome_passageiro, parada_origem, parada_destino, forma_pagamento')
            .in('motorista_id', userIds)
            .neq('status', 'cancelado')
            .gte('data_viagem', inicio)
            .lte('data_viagem', fim)
            .or('forma_pagamento.neq.fiado,forma_pagamento.is.null,fiado_pago.eq.true')
        : Promise.resolve({ data: [] as ReceitaAgendamento[] }),
      // Encomendas pagas dos motoristas (mesmo padrao do individual)
      userIds.length > 0
        ? supabase
            .from('encomendas')
            .select('id, nome, valor, data_pago, criado_em, forma_pagamento')
            .in('motorista_id', userIds)
            .eq('pago', true)
        : Promise.resolve({ data: [] as ReceitaEncomenda[] }),
      // Fretamento/excursao criados pelo gestor + reservas do link publico.
      // Ficavam de fora do caixa do rota fixa ate 2026-08-04 — o gestor via na
      // agenda mas nao no financeiro, entao o lucro nascia incompleto.
      supabase
        .from('corridas_empresa')
        .select('id, origem, destino, data_hora, valor, cliente_nome, tipo_servico, valor_repasse_motorista')
        .eq('empresa_id', empresaId)
        .neq('status', 'cancelada')
        .gte('data_hora', `${inicio}T00:00:00`)
        .lte('data_hora', `${fim}T23:59:59`)
        .order('data_hora', { ascending: false }),
    ])

    if (errCobr) console.error('[RF] Erro na query cobrancas:', errCobr.message)
    if (errCorr) console.error('[RF] Erro na query corridas:', errCorr.message)

    const todos = (cobrancas as LancamentoEmpresa[]) ?? []
    const filtrados = todos
      .filter(r => {
        const dataEfetiva = r.data ?? r.created_at.slice(0, 10)
        return dataEfetiva >= inicio && dataEfetiva <= fim
      })
      .sort((a, b) => {
        const da = a.data ?? a.created_at.slice(0, 10)
        const db = b.data ?? b.created_at.slice(0, 10)
        return db.localeCompare(da)
      })
    setLancamentos(filtrados)
    setReceitasAgendamentos((agends as ReceitaAgendamento[]) ?? [])
    // Encomendas: filtro por data_pago (fallback criado_em) — igual o individual
    const encsFiltradas = ((encs as ReceitaEncomenda[]) ?? []).filter(e => {
      const d = e.data_pago ?? e.criado_em.slice(0, 10)
      return d >= inicio && d <= fim
    })
    setReceitasEncomendas(encsFiltradas)
    setReceitasCorridas((corrs as ReceitaCorridaRF[]) ?? [])
    setLoading(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('cobrancas_empresa').delete().eq('id', id)
    carregar()
  }

  const receitasManuais = lancamentos.filter(l => l.tipo === 'receita')
  const despesas = lancamentos.filter(l => l.tipo === 'despesa')
  const totalReceitasManuais = receitasManuais.reduce((s, r) => s + Number(r.valor), 0)
  const totalReceitasAgendamentos = receitasAgendamentos.reduce((s, r) => s + Number(r.valor), 0)
  const totalReceitasEncomendas = receitasEncomendas.reduce((s, e) => s + Number(e.valor), 0)
  const totalReceitasCorridas = receitasCorridas.reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalReceitas = totalReceitasManuais + totalReceitasAgendamentos + totalReceitasEncomendas + totalReceitasCorridas
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0)
  // Repasse gravado no proprio atendimento (fretamento/excursao com motorista
  // parceiro) — mesmo desconto que o transfer ja faz. Diaria de motorista/
  // cobrador o gestor lanca como despesa nas categorias de mao de obra.
  const totalRepasseCorridas = receitasCorridas.reduce(
    (s, c) => s + Number(c.valor_repasse_motorista || 0), 0
  )
  // Quebra das despesas entre mao de obra e custo operacional — o gestor
  // precisa enxergar quanto foi pra equipe (pedido Elson/CE, dizimista:
  // "preciso saber o que sobrou pra mim").
  const totalMaoDeObra = despesas
    .filter(d => CATEGORIAS_MAO_DE_OBRA_RF.includes(d.categoria))
    .reduce((s, d) => s + Number(d.valor), 0) + totalRepasseCorridas
  const totalOperacional = totalDespesas - (totalMaoDeObra - totalRepasseCorridas)
  const lucro = totalReceitas - totalDespesas - totalRepasseCorridas

  /* ── Listas filtradas (so pras listagens; os cards de topo continuam
        mostrando os totais cheios do periodo). ── */
  const despesasFiltradasRF = despesas.filter(d => {
    if (filtroCategoriaRF && d.categoria !== filtroCategoriaRF) return false
    if (filtroFormaRF && d.forma_pagamento !== filtroFormaRF) return false
    return true
  })
  const totalDespesasFiltradasRF = despesasFiltradasRF.reduce((s, d) => s + Number(d.valor), 0)
  const encomendasFiltradasRF = receitasEncomendas.filter(e =>
    !buscaEncomendaRF || (e.nome || '').toLowerCase().includes(buscaEncomendaRF.toLowerCase())
  )
  const totalEncomendasFiltradasRF = encomendasFiltradasRF.reduce((s, e) => s + Number(e.valor), 0)
  // Opcoes derivadas do que existe no periodo
  const categoriasComDespesaRF = Array.from(new Set(despesas.map(d => d.categoria).filter(Boolean)))
  const formasComDespesaRF     = Array.from(new Set(despesas.map(d => d.forma_pagamento).filter(Boolean))) as string[]
  const temFiltroRF = !!(filtroCategoriaRF || filtroFormaRF)

  const filtros: { key: FiltroRF; label: string }[] = [
    { key: 'hoje',   label: 'Hoje'    },
    { key: '7dias',  label: '7 dias'  },
    { key: '30dias', label: '30 dias' },
    { key: 'mes',    label: 'Mês'     },
    { key: 'personalizado', label: '📅' },
  ]

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <p style={{ color: '#E1F5EE' }} className="text-base font-semibold mb-3">Financeiro</p>

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

        {filtro === 'personalizado' && (
          <div className="rounded-xl mb-4 p-2.5 flex items-center gap-2" style={{ background: '#085041' }}>
            <span className="text-[11px] flex-shrink-0" style={{ color: '#9FE1CB' }}>De:</span>
            <input type="date" value={dataInicioCustom}
              onChange={e => setDataInicioCustom(e.target.value)}
              max={dataFimCustom}
              className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs outline-none"
              style={{ background: '#E1F5EE', color: '#0F6E56' }} />
            <span className="text-[11px] flex-shrink-0" style={{ color: '#9FE1CB' }}>até</span>
            <input type="date" value={dataFimCustom}
              onChange={e => setDataFimCustom(e.target.value)}
              min={dataInicioCustom}
              className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs outline-none"
              style={{ background: '#E1F5EE', color: '#0F6E56' }} />
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
            <p style={{ color: '#5DCAA5' }} className="text-[10px]">Lucro líquido</p>
            <p style={{ color: lucro >= 0 ? '#E1F5EE' : '#FAC775' }} className="text-base font-bold mt-0.5">R$ {lucro.toFixed(0)}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button onClick={() => setModal('receita')}
            className="py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: '#0F6E56', color: '#fff' }}>
            <span className="text-lg">💰</span> + Receita
          </button>
          <button onClick={() => setModal('despesa')}
            className="py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: '#A32D2D', color: '#fff' }}>
            <span className="text-lg">🧾</span> + Despesa
          </button>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Carregando...</p>
        ) : (
          <>
            {/* Conta aberta do lucro liquido — o gestor precisa VER a conta,
                nao confiar num numero seco (pedido Elson/CE 2026-08-04:
                dizimista, precisa saber exatamente o que sobrou pra ele). */}
            {(totalReceitas > 0 || totalDespesas > 0) && (
              <div className="rounded-2xl p-4 border mb-5"
                style={{
                  background:  lucro >= 0 ? '#E1F5EE' : '#FCEBEB',
                  borderColor: lucro >= 0 ? '#9FE1CB' : '#FECACA',
                }}>
                <p className="text-xs mb-2" style={{ color: lucro >= 0 ? '#085041' : '#A32D2D' }}>
                  {lucro >= 0 ? '📈' : '📉'} Como chegamos no seu lucro
                </p>
                <div className="text-[11px] mb-2 flex flex-col gap-0.5"
                  style={{ color: lucro >= 0 ? '#085041' : '#A32D2D' }}>
                  <div className="flex justify-between">
                    <span>Tudo que entrou</span>
                    <span>R$ {totalReceitas.toFixed(2).replace('.', ',')}</span>
                  </div>
                  {totalMaoDeObra > 0 && (
                    <div className="flex justify-between">
                      <span>(-) Motorista e equipe</span>
                      <span>R$ {totalMaoDeObra.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {totalOperacional > 0 && (
                    <div className="flex justify-between">
                      <span>(-) Custos de operação</span>
                      <span>R$ {totalOperacional.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t" style={{ borderColor: lucro >= 0 ? '#9FE1CB' : '#FECACA' }}>
                  <p className="text-[11px]" style={{ color: lucro >= 0 ? '#085041' : '#A32D2D' }}>
                    Sobrou pra você
                  </p>
                  <p className="text-2xl font-bold" style={{ color: lucro >= 0 ? '#0F6E56' : '#A32D2D' }}>
                    {lucro < 0 ? '-' : ''}R$ {Math.abs(lucro).toFixed(2).replace('.', ',')}
                  </p>
                </div>
                {totalMaoDeObra === 0 && (
                  <p className="text-[10px] mt-2 leading-snug" style={{ color: lucro >= 0 ? '#0F6E56' : '#A32D2D' }}>
                    💡 Paga motorista ou cobrador? Lance em <strong>+ Despesa</strong> nas categorias
                    “Repasse / diária motorista” ou “Equipe” — aí esse valor entra na conta.
                  </p>
                )}
              </div>
            )}

            {/* Fretamentos, excursões e reservas do link público */}
            {receitasCorridas.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🚌 Fretamentos e reservas</p>
                  <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>+ R$ {totalReceitasCorridas.toFixed(2).replace('.', ',')}</p>
                </div>
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                  {receitasCorridas.slice(0, 20).map(c => (
                    <Link key={c.id} href={`/empresa/agendamentos/fretamentos?ficha=${c.id}`}
                      className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2 active:opacity-75">
                      <span className="text-xl mr-1">
                        {c.tipo_servico === 'excursao' ? '🗺️' : c.tipo_servico === 'fretamento' ? '🚌' : '🛣️'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.cliente_nome || 'Sem nome'}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {c.data_hora.slice(8, 10)}/{c.data_hora.slice(5, 7)} · {c.origem} → {c.destino}
                        </p>
                      </div>
                      <p className="text-sm font-bold flex-shrink-0" style={{ color: '#0F6E56' }}>
                        R$ {Number(c.valor).toFixed(2).replace('.', ',')}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Viagens realizadas (agendamentos dos motoristas da empresa) */}
            {receitasAgendamentos.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🚗 Viagens realizadas</p>
                  <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>+ R$ {totalReceitasAgendamentos.toFixed(2).replace('.', ',')}</p>
                </div>
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                  {receitasAgendamentos.slice(0, 20).map(a => (
                    <div key={a.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2">
                      <span className="text-xl mr-1">🚗</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.nome_passageiro || 'Passageiro'}</p>
                        {(a.parada_origem || a.parada_destino) && (
                          <p className="text-xs text-gray-400 truncate">{a.parada_origem} → {a.parada_destino}</p>
                        )}
                        <p className="text-xs text-gray-400">{format(new Date(a.data_viagem + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                      </div>
                      <span className="text-sm font-semibold shrink-0" style={{ color: '#0F6E56' }}>
                        + R$ {Number(a.valor).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  ))}
                  {receitasAgendamentos.length > 20 && (
                    <p className="text-center text-xs text-gray-400 py-2">+ {receitasAgendamentos.length - 20} viagens</p>
                  )}
                </div>
              </div>
            )}

            {/* Encomendas pagas dos motoristas da empresa */}
            {receitasEncomendas.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    📦 Encomendas pagas · {encomendasFiltradasRF.length}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>+ R$ {totalEncomendasFiltradasRF.toFixed(2).replace('.', ',')}</p>
                </div>
                {/* Busca por nome — util quando o motorista fez muitas entregas */}
                {receitasEncomendas.length > 5 && (
                  <input value={buscaEncomendaRF} onChange={e => setBuscaEncomendaRF(e.target.value)}
                    placeholder="🔍 Buscar encomenda por nome..."
                    className="w-full px-3 py-2 mb-2 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
                )}
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                  {encomendasFiltradasRF.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-4">Nenhuma encomenda com esse nome</p>
                  ) : encomendasFiltradasRF.slice(0, 20).map(e => {
                    const data = e.data_pago ?? e.criado_em.slice(0, 10)
                    return (
                      <div key={e.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2">
                        <span className="text-xl mr-1">📦</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{e.nome || 'Encomenda'}</p>
                          <p className="text-xs text-gray-400">{format(new Date(data + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                        </div>
                        <span className="text-sm font-semibold shrink-0" style={{ color: '#0F6E56' }}>
                          + R$ {Number(e.valor).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    )
                  })}
                  {encomendasFiltradasRF.length > 20 && (
                    <p className="text-center text-xs text-gray-400 py-2">+ {encomendasFiltradasRF.length - 20} encomendas</p>
                  )}
                </div>
              </div>
            )}

            {/* Receitas lançadas manualmente */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">➕ Lançadas manualmente</p>
                {receitasManuais.length > 0 && (
                  <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>+ R$ {totalReceitasManuais.toFixed(2).replace('.', ',')}</p>
                )}
              </div>
              {receitasManuais.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">Nenhuma receita lançada manualmente</div>
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                  {receitasManuais.map(r => {
                    const cat = categoriasReceitaRF.find(c => c.value === r.categoria)
                    return (
                      <div key={r.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2">
                        <span className="text-xl mr-1">{cat?.emoji || '💵'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{cat?.label || r.categoria}</p>
                          {r.observacao && <p className="text-xs text-gray-400 truncate">{r.observacao}</p>}
                          <p className="text-xs text-gray-400">{format(new Date((r.data ?? r.created_at.slice(0, 10)) + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                        </div>
                        <span className="text-sm font-semibold shrink-0" style={{ color: '#0F6E56' }}>
                          + R$ {Number(r.valor).toFixed(2).replace('.', ',')}
                        </span>
                        <button onClick={() => setEditando(r)}
                          className="p-1.5 rounded-lg shrink-0"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>✏️</button>
                        <button onClick={() => excluir(r.id)}
                          className="p-1.5 rounded-lg shrink-0"
                          style={{ background: '#FDE8E8', color: '#A32D2D' }}>🗑️</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Despesas · {despesasFiltradasRF.length}
                  {temFiltroRF && despesas.length !== despesasFiltradasRF.length && (
                    <span className="normal-case font-normal"> de {despesas.length}</span>
                  )}
                </p>
                {despesasFiltradasRF.length > 0 && (
                  <p className="text-xs font-semibold" style={{ color: '#A32D2D' }}>
                    - R$ {totalDespesasFiltradasRF.toFixed(2).replace('.', ',')}
                  </p>
                )}
              </div>

              {/* Filtros — client-side, dropdowns so listam o que existe */}
              {despesas.length > 0 && (categoriasComDespesaRF.length > 1 || formasComDespesaRF.length > 1) && (
                <div className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-col gap-2 mb-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">🔍 Filtrar</p>
                    {temFiltroRF && (
                      <button onClick={() => { setFiltroCategoriaRF(''); setFiltroFormaRF('') }}
                        className="text-[11px] font-medium underline" style={{ color: '#A32D2D' }}>
                        limpar filtros
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {categoriasComDespesaRF.length > 1 && (
                      <select value={filtroCategoriaRF} onChange={e => setFiltroCategoriaRF(e.target.value)}
                        className="px-2 py-2 rounded-xl border border-gray-200 text-xs outline-none bg-white focus:border-green-600">
                        <option value="">Todas categorias</option>
                        {categoriasComDespesaRF.map(cv => {
                          const c = categoriasDespesaRF.find(x => x.value === cv)
                          return <option key={cv} value={cv}>{c ? `${c.emoji} ${c.label}` : cv}</option>
                        })}
                      </select>
                    )}
                    {formasComDespesaRF.length > 1 && (
                      <select value={filtroFormaRF} onChange={e => setFiltroFormaRF(e.target.value)}
                        className="px-2 py-2 rounded-xl border border-gray-200 text-xs outline-none bg-white focus:border-green-600">
                        <option value="">Todas formas pgto</option>
                        {formasComDespesaRF.map(f => (
                          <option key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f] ?? f}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {/* Total por categoria — visao rapida de onde o dinheiro foi */}
              {despesasFiltradasRF.length > 1 && (() => {
                const porCat = new Map<string, number>()
                despesasFiltradasRF.forEach(d => {
                  porCat.set(d.categoria, (porCat.get(d.categoria) || 0) + Number(d.valor))
                })
                if (porCat.size < 2) return null
                const linhas = Array.from(porCat.entries()).sort((a, b) => b[1] - a[1])
                return (
                  <div className="rounded-2xl p-3 mb-2" style={{ background: '#FCEBEB', border: '1px solid #F5BCBC' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#A32D2D' }}>
                      Total por categoria
                    </p>
                    {linhas.map(([cv, total]) => {
                      const c = categoriasDespesaRF.find(x => x.value === cv)
                      const pct = totalDespesasFiltradasRF > 0 ? (total / totalDespesasFiltradasRF) * 100 : 0
                      return (
                        <div key={cv} className="flex items-center justify-between text-xs py-0.5" style={{ color: '#A32D2D' }}>
                          <span>{c ? `${c.emoji} ${c.label}` : cv}</span>
                          <span className="font-semibold">
                            R$ {total.toFixed(2).replace('.', ',')} <span className="font-normal opacity-60">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {despesasFiltradasRF.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
                  {temFiltroRF ? 'Nenhuma despesa com esse filtro' : 'Nenhuma despesa registrada'}
                </div>
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                  {despesasFiltradasRF.map(d => {
                    const cat = categoriasDespesaRF.find(c => c.value === d.categoria)
                    return (
                      <div key={d.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2">
                        <span className="text-xl mr-1">{cat?.emoji || '📦'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{d.observacao || cat?.label || d.categoria}</p>
                          <p className="text-xs text-gray-400">
                            {format(new Date((d.data ?? d.created_at.slice(0, 10)) + 'T00:00:00'), 'dd/MM/yyyy')}
                            {d.quilometragem != null ? ` · ${d.quilometragem.toLocaleString('pt-BR')} km` : ''}
                            {d.forma_pagamento ? ` · ${FORMA_PAGAMENTO_LABEL[d.forma_pagamento] ?? d.forma_pagamento}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-semibold shrink-0" style={{ color: '#A32D2D' }}>
                          - R$ {Number(d.valor).toFixed(2).replace('.', ',')}
                        </span>
                        <button onClick={() => setEditando(d)}
                          className="p-1.5 rounded-lg shrink-0"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>✏️</button>
                        <button onClick={() => excluir(d.id)}
                          className="p-1.5 rounded-lg shrink-0"
                          style={{ background: '#FDE8E8', color: '#A32D2D' }}>🗑️</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="h-24" />
          </>
        )}
      </div>

      {modal === 'receita' && (
        <FormLancamentoEmpresa tipo="receita" empresaId={empresaId}
          onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />
      )}
      {modal === 'despesa' && (
        <FormLancamentoEmpresa tipo="despesa" empresaId={empresaId}
          onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />
      )}
      {editando && (
        <FormLancamentoEmpresa tipo={editando.tipo} empresaId={empresaId} lancamento={editando}
          onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar() }} />
      )}
    </div>
  )
}

// ─── FORM LANÇAMENTO EMPRESA (RECEITA OU DESPESA) ────────────────────────────

function FormLancamentoEmpresa({
  tipo,
  empresaId,
  lancamento,
  onFechar,
  onSalvo,
}: {
  tipo: 'receita' | 'despesa'
  empresaId: string
  lancamento?: LancamentoEmpresa
  onFechar: () => void
  onSalvo: () => void
}) {
  const categorias = tipo === 'receita' ? categoriasReceitaRF : categoriasDespesaRF
  const CATS_COM_KM = ['combustivel', 'manutencao', 'pneu', 'outros']
  const [form, setForm] = useState({
    categoria:     lancamento?.categoria  ?? categorias[0].value,
    observacao:    lancamento?.observacao ?? '',
    valor:         lancamento?.valor != null ? String(lancamento.valor) : '',
    data:          lancamento?.data ?? format(new Date(), 'yyyy-MM-dd'),
    quilometragem: lancamento?.quilometragem != null ? String(lancamento.quilometragem) : '',
    forma_pagamento: lancamento?.forma_pagamento ?? 'pix',
    cartao_banco: (lancamento as any)?.cartao_banco ?? '',
    cartao_final: (lancamento as any)?.cartao_final ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro]     = useState('')

  async function salvar() {
    if (!form.valor) { setErro('Informe o valor'); return }
    const valor = parseFloat(form.valor)
    if (isNaN(valor) || valor <= 0) { setErro('Valor inválido'); return }
    setSaving(true); setErro('')

    const catLabel = categorias.find(c => c.value === form.categoria)?.label ?? form.categoria
    const payload = {
      empresa_id:    empresaId,
      tipo,
      categoria:     form.categoria,
      observacao:    form.observacao.trim() || null,
      valor,
      data:          form.data,
      cliente_nome:  tipo === 'receita' ? 'Receita' : 'Despesa',
      descricao:     catLabel,
      quilometragem: tipo === 'despesa' && CATS_COM_KM.includes(form.categoria) && form.quilometragem
        ? parseInt(form.quilometragem)
        : null,
      forma_pagamento: tipo === 'despesa' ? form.forma_pagamento : null,
      cartao_banco: (tipo === 'despesa' && form.forma_pagamento === 'cartao') ? (form.cartao_banco.trim() || null) : null,
      cartao_final: (tipo === 'despesa' && form.forma_pagamento === 'cartao') ? (form.cartao_final.trim() || null) : null,
    }

    let error
    if (lancamento) {
      ;({ error } = await supabase.from('cobrancas_empresa').update(payload).eq('id', lancamento.id))
    } else {
      ;({ error } = await supabase.from('cobrancas_empresa').insert(payload))
    }

    setSaving(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
          {lancamento
            ? tipo === 'receita' ? 'Editar receita' : 'Editar despesa'
            : tipo === 'receita' ? 'Lançar receita' : 'Nova despesa'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">
            {tipo === 'receita' ? 'Tipo de receita' : 'Categoria'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {categorias.map(c => (
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
          <input value={form.observacao}
            onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
            type="text" placeholder="Ex: empresa tal, grupo de amigos..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {tipo === 'despesa' && CATS_COM_KM.includes(form.categoria) && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Quilometragem (km) — opcional</p>
            <input value={form.quilometragem}
              onChange={e => setForm(f => ({ ...f, quilometragem: e.target.value }))}
              type="number" min={0} placeholder="Ex: 125000"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        )}

        {tipo === 'despesa' && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Como foi pago</p>
            <select value={form.forma_pagamento}
              onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600">
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          </div>
        )}

        {/* Detalhes do cartão — só quando despesa paga no cartão. */}
        {tipo === 'despesa' && form.forma_pagamento === 'cartao' && (
          <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>💳 Detalhes do cartão <span className="font-normal text-gray-500">— opcional</span></p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-gray-500 mb-1">Banco / cartão</p>
                <input value={form.cartao_banco}
                  onChange={e => setForm(f => ({ ...f, cartao_banco: e.target.value }))}
                  placeholder="Ex: Nubank"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-1">Final (4 dígitos)</p>
                <input value={form.cartao_final}
                  onChange={e => setForm(f => ({ ...f, cartao_final: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  placeholder="1234" inputMode="numeric" maxLength={4}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor (R$)</p>
          <input value={form.valor}
            onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
            type="number" placeholder="0,00"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Data</p>
          <input value={form.data}
            onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
            type="date"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}
      </div>

      <div className="px-4 pb-16 pt-4 bg-white border-t border-gray-100">
        <button onClick={salvar} disabled={saving || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: tipo === 'receita' ? '#1D9E75' : '#A32D2D' }}>
          {saving
            ? 'Salvando...'
            : lancamento
            ? '✓ Salvar alterações'
            : tipo === 'receita' ? '💰 Salvar receita' : '✓ Salvar despesa'}
        </button>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  )
}
