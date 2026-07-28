'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatarTelefoneWhatsApp } from '@/lib/telefone'
import ModalListaPassageirosPDF from '@/components/ModalListaPassageirosPDF'

// Modal do voucher usa @react-pdf/renderer no client — SSR pode explodir por
// causa de font/canvas. Carregar dinamicamente sem SSR resolve.
const ModalGerarVoucher = dynamic(() => import('@/components/ModalGerarVoucher'), { ssr: false })
const ModalGerarRecibo  = dynamic(() => import('@/components/ModalGerarRecibo'),  { ssr: false })
const ModalGerarReciboRepasse = dynamic(() => import('@/components/ModalGerarReciboRepasse'), { ssr: false })

type RotaOpcao = {
  id: string
  nome: string | null
  origem: string | null
  destino: string | null
  preco: number
  motorista_id: string | null
}

type MotoristaOpcao = {
  id: string
  nome: string
  user_id: string | null
  telefone: string | null
  veiculo: string | null
  placa: string | null
  cor: string | null
  percentual_repasse: number | null
  modo_repasse: 'percentual' | 'valor_fixo' | null
  valor_fixo_repasse: number | null
}

type Corrida = {
  id: string
  rota_id: string | null
  origem: string
  destino: string
  data_hora: string
  created_at: string
  cliente_id: string | null
  cliente_nome: string
  cliente_telefone: string | null
  email_solicitante: string | null
  passageiro1_nome: string | null
  passageiro1_telefone: string | null
  valor: number
  status: string
  motorista_id: string | null
  tipo_servico: string | null
  forma_pagamento: string | null
  status_pagamento: string | null
  valor_recebido: number | null
  data_pagamento: string | null
  data_prevista_pagamento: string | null
  valor_repasse_motorista: number | null
  observacoes: string | null
  motoristas_empresa: { nome: string } | null
  numero_voo: string | null
  nome_passageiro2: string | null
  telefone_passageiro2: string | null
  rua: string | null; numero: string | null; bairro: string | null; municipio: string | null; cep: string | null; referencia: string | null
  rua_desembarque: string | null; numero_desembarque: string | null; bairro_desembarque: string | null
  municipio_desembarque: string | null; cep_desembarque: string | null; referencia_desembarque: string | null
  rua_retorno_embarque: string | null; numero_retorno_embarque: string | null; bairro_retorno_embarque: string | null
  municipio_retorno_embarque: string | null; cep_retorno_embarque: string | null; referencia_retorno_embarque: string | null
  rua_retorno_desembarque: string | null; numero_retorno_desembarque: string | null; bairro_retorno_desembarque: string | null
  municipio_retorno_desembarque: string | null; cep_retorno_desembarque: string | null; referencia_retorno_desembarque: string | null
  retorno_data: string | null
  retorno_horario: string | null
  retorno_origem: string | null
  retorno_destino: string | null
  data_hora_termino: string | null
  trajetos: string[] | null
  km_inicial: number | null
  km_final: number | null
  numero_reserva: number | null
  quantidade_bagagem: number | null
  passageiros_adicionais: Array<{
    nome: string; telefone: string
    rua: string | null; numero: string | null; bairro: string | null; municipio: string | null; cep: string | null; referencia: string | null
    rua_desembarque: string | null; numero_desembarque: string | null; bairro_desembarque: string | null
    municipio_desembarque: string | null; cep_desembarque: string | null; referencia_desembarque: string | null
    rua_retorno_embarque?: string | null; numero_retorno_embarque?: string | null; bairro_retorno_embarque?: string | null
    municipio_retorno_embarque?: string | null; cep_retorno_embarque?: string | null; referencia_retorno_embarque?: string | null
    rua_retorno_desembarque?: string | null; numero_retorno_desembarque?: string | null; bairro_retorno_desembarque?: string | null
    municipio_retorno_desembarque?: string | null; cep_retorno_desembarque?: string | null; referencia_retorno_desembarque?: string | null
  }> | null
}

type CorridaAgrupada =
  | { tipo: 'simples'; corrida: Corrida }
  | { tipo: 'par'; ida: Corrida; volta: Corrida }

type AgendamentoRF = {
  id: string
  rota_id: string | null
  motorista_id: string
  nome_passageiro: string
  telefone_passageiro: string | null
  parada_origem: string
  parada_destino: string
  turno: 'ida' | 'volta'
  valor: number
  status: 'agendado' | 'confirmado' | 'cancelado'
  data_viagem: string
  forma_pagamento: string | null
  observacoes: string | null
  rua: string | null
  numero: string | null
  bairro: string | null
  municipio: string | null
  cep: string | null
  referencia: string | null
}

type PassageiroExtraCorrida = {
  nome: string; telefone: string; numero_voo: string
  rua: string; numero: string; bairro: string; municipio: string; cep: string; referencia: string
  rua_desembarque: string; numero_desembarque: string; bairro_desembarque: string
  municipio_desembarque: string; cep_desembarque: string; referencia_desembarque: string
  rua_retorno_embarque: string; numero_retorno_embarque: string; bairro_retorno_embarque: string
  municipio_retorno_embarque: string; cep_retorno_embarque: string; referencia_retorno_embarque: string
  rua_retorno_desembarque: string; numero_retorno_desembarque: string; bairro_retorno_desembarque: string
  municipio_retorno_desembarque: string; cep_retorno_desembarque: string; referencia_retorno_desembarque: string
}
const PASSAGEIRO_EXTRA_CORRIDA_VAZIO: PassageiroExtraCorrida = {
  nome: '', telefone: '', numero_voo: '',
  rua: '', numero: '', bairro: '', municipio: '', cep: '', referencia: '',
  rua_desembarque: '', numero_desembarque: '', bairro_desembarque: '',
  municipio_desembarque: '', cep_desembarque: '', referencia_desembarque: '',
  rua_retorno_embarque: '', numero_retorno_embarque: '', bairro_retorno_embarque: '',
  municipio_retorno_embarque: '', cep_retorno_embarque: '', referencia_retorno_embarque: '',
  rua_retorno_desembarque: '', numero_retorno_desembarque: '', bairro_retorno_desembarque: '',
  municipio_retorno_desembarque: '', cep_retorno_desembarque: '', referencia_retorno_desembarque: '',
}

type FormCorrida = {
  tipo_servico: string
  rota_id: string
  origem: string
  destino: string
  data: string
  horario: string
  ida_volta: boolean
  origem_volta: string
  destino_volta: string
  data_retorno: string
  horario_retorno: string
  preco_volta: string
  observacoes_volta: string
  motorista_id: string
  cliente_id: string
  cliente_nome: string
  cliente_telefone: string
  email_solicitante: string
  passageiro1_nome: string
  passageiro1_telefone: string
  numero_voo: string
  rua: string; numero: string; bairro: string; municipio: string; cep: string; referencia: string
  rua_desembarque: string; numero_desembarque: string; bairro_desembarque: string
  municipio_desembarque: string; cep_desembarque: string; referencia_desembarque: string
  rua_retorno_embarque: string; numero_retorno_embarque: string; bairro_retorno_embarque: string
  municipio_retorno_embarque: string; cep_retorno_embarque: string; referencia_retorno_embarque: string
  rua_retorno_desembarque: string; numero_retorno_desembarque: string; bairro_retorno_desembarque: string
  municipio_retorno_desembarque: string; cep_retorno_desembarque: string; referencia_retorno_desembarque: string
  // Diária / City Tour: término estimado e trajetos percorridos
  data_termino: string
  horario_termino: string
  trajetos: string[]
  km_inicial: string
  km_final: string
  // KM da volta — separados dos da ida quando é par ida-volta. Cada linha
  // em corridas_empresa carrega seu próprio km_inicial/km_final; esses
  // campos alimentam o updateVolta pra que a volta receba seus valores
  // independentes da ida (comum quando ida é dia 10 e volta dia 11).
  km_inicial_volta: string
  km_final_volta: string
  passageiros_adicionais: PassageiroExtraCorrida[]
  forma_pagamento: string
  status_pagamento: string
  valor_recebido: string
  data_pagamento: string
  data_prevista_pagamento: string
  preco: string
  valor_repasse_motorista: string
  observacoes: string
}

const FORM_VAZIO: FormCorrida = {
  tipo_servico: 'transfer',
  rota_id: '',
  origem: '',
  destino: '',
  data: '',
  horario: '',
  ida_volta: false,
  origem_volta: '',
  destino_volta: '',
  data_retorno: '',
  horario_retorno: '',
  preco_volta: '',
  observacoes_volta: '',
  motorista_id: '',
  cliente_id: '',
  cliente_nome: '',
  cliente_telefone: '',
  email_solicitante: '',
  passageiro1_nome: '',
  passageiro1_telefone: '',
  numero_voo: '',
  rua: '', numero: '', bairro: '', municipio: '', cep: '', referencia: '',
  rua_desembarque: '', numero_desembarque: '', bairro_desembarque: '',
  municipio_desembarque: '', cep_desembarque: '', referencia_desembarque: '',
  rua_retorno_embarque: '', numero_retorno_embarque: '', bairro_retorno_embarque: '',
  municipio_retorno_embarque: '', cep_retorno_embarque: '', referencia_retorno_embarque: '',
  rua_retorno_desembarque: '', numero_retorno_desembarque: '', bairro_retorno_desembarque: '',
  municipio_retorno_desembarque: '', cep_retorno_desembarque: '', referencia_retorno_desembarque: '',
  data_termino: '', horario_termino: '', trajetos: [],
  km_inicial: '', km_final: '', km_inicial_volta: '', km_final_volta: '',
  passageiros_adicionais: [],
  forma_pagamento: 'a_definir',
  status_pagamento: 'a_receber',
  valor_recebido: '',
  data_pagamento: '',
  data_prevista_pagamento: '',
  preco: '',
  valor_repasse_motorista: '',
  observacoes: '',
}

type FormAgPassageiro = {
  rota_empresa_id: string
  embarque: string
  desembarque: string
  valor: string
  nome_passageiro: string
  telefone_passageiro: string
  data_viagem: string
  turno: 'ida' | 'volta'
  forma_pagamento: string
  observacoes: string
  motorista_empresa_id: string
  rua: string
  numero: string
  bairro: string
  municipio: string
  cep: string
  referencia: string
}

const FORM_AG_VAZIO: FormAgPassageiro = {
  rota_empresa_id: '',
  embarque: '',
  desembarque: '',
  valor: '',
  nome_passageiro: '',
  telefone_passageiro: '',
  data_viagem: '',
  turno: 'ida',
  forma_pagamento: 'dinheiro',
  observacoes: '',
  motorista_empresa_id: '',
  rua: '',
  numero: '',
  bairro: '',
  municipio: '',
  cep: '',
  referencia: '',
}

const STATUS_COR: Record<string, { bg: string; text: string; label: string }> = {
  pendente:               { bg: '#FEF3C7', text: '#92400E', label: 'Pendente' },
  confirmada:             { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
  em_andamento:           { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
  concluida:              { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
  cancelada:              { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
  recusada:               { bg: '#FCEBEB', text: '#A32D2D', label: 'Recusada' },
  parcialmente_cancelada: { bg: '#FEF3C7', text: '#92400E', label: 'Parc. cancelada' },
}

type TipoMeta = { badge: string; bg: string; text: string; clienteLabel: string }
const TIPO_META: Record<string, TipoMeta> = {
  rota_fixa:  { badge: '🛣️ Rota Fixa',  bg: '#E1F5EE', text: '#085041', clienteLabel: 'Passageiro' },
  fretamento: { badge: '🚌 Fretamento', bg: '#FEF3C7', text: '#92400E', clienteLabel: 'Responsável' },
  excursao:   { badge: '🗺️ Excursão',   bg: '#EDE9FE', text: '#5B21B6', clienteLabel: 'Responsável' },
  transfer:   { badge: '🚗 Transfer',   bg: '#EFF6FF', text: '#1D4ED8', clienteLabel: 'Responsável' },
  city_tour:  { badge: '🏙️ City Tour',  bg: '#F0FDF4', text: '#166534', clienteLabel: 'Cliente'     },
  diaria:     { badge: '📆 Diária',     bg: '#FFEDD5', text: '#9A3412', clienteLabel: 'Cliente'     },
}
function tipoMeta(tipo: string | null): TipoMeta {
  return TIPO_META[tipo ?? ''] ?? { badge: tipo ?? 'Serviço', bg: '#F3F4F6', text: '#6B7280', clienteLabel: 'Cliente' }
}

function podeAbrirFichaTransfer(c: { tipo_servico: string | null; status: string }): boolean {
  // Transfer, diária e city tour usam a mesma ficha (todos abrem).
  // Fretamento e excursão tem outra estrutura.
  const ehTransferOuDispose = c.tipo_servico !== 'fretamento' && c.tipo_servico !== 'excursao'
  if (ehTransferOuDispose) return true
  return c.status === 'pendente' || c.status === 'confirmada' || c.status === 'em_andamento'
}

const STATUS_COR_AG: Record<string, { bg: string; text: string; label: string }> = {
  agendado:   { bg: '#EFF6FF', text: '#1D4ED8', label: 'Agendado' },
  confirmado: { bg: '#E1F5EE', text: '#0F6E56', label: 'Confirmado' },
  cancelado:  { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelado' },
}

const HOJE = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
})()

function statusPar(ida: Corrida, volta: Corrida): string {
  if (ida.status === volta.status) return ida.status
  if (ida.status === 'cancelada' || volta.status === 'cancelada') return 'parcialmente_cancelada'
  return ida.status
}

// Duas corridas formam um par quando têm o mesmo cliente e foram criadas
// com menos de 30 segundos de diferença (ambas geradas pelo mesmo agendamento ida e volta).
// Normaliza cliente_nome pra comparação tolerante (ignora case, espaços
// extras). Nomes como "Nextour  Giulia" e "nextour giulia" batem como
// iguais, evitando que par ida-volta apareça separado por typo.
function normalizeNome(s: string | null | undefined): string {
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

// Janela pra agrupar par ida-volta: aumentada de 30s pra 5 minutos.
// O insert cria os 2 registros na mesma transação, mas latência de rede
// e commit do banco podem espaçar mais que 30s em cenários adversos —
// nesse caso a volta ficava "solta" e sumia do card.
const JANELA_PAR_MS = 5 * 60 * 1000

// Decide se dois registros formam par ida-volta. Regras:
// 1. Mesmo cliente_nome (normalizado — tolerante a case/espaços)
// 2. created_at com diferença dentro da janela
// 3. Se AMBOS tem cliente_telefone preenchido, precisam bater — evita
//    juntar erroneamente dois clientes homônimos cadastrados em sequência
function saoParIdaVolta(a: Corrida, b: Corrida): boolean {
  if (normalizeNome(a.cliente_nome) !== normalizeNome(b.cliente_nome)) return false
  const dt = Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  if (dt >= JANELA_PAR_MS) return false
  const telA = (a.cliente_telefone || '').trim()
  const telB = (b.cliente_telefone || '').trim()
  if (telA && telB && telA !== telB) return false
  return true
}

function agruparPares(corridas: Corrida[]): CorridaAgrupada[] {
  const usados = new Set<string>()
  const resultado: CorridaAgrupada[] = []

  for (let i = 0; i < corridas.length; i++) {
    if (usados.has(corridas[i].id)) continue
    const a = corridas[i]
    let parIdx = -1

    for (let j = i + 1; j < corridas.length; j++) {
      if (usados.has(corridas[j].id)) continue
      const b = corridas[j]
      if (saoParIdaVolta(a, b)) {
        parIdx = j
        break
      }
    }

    if (parIdx !== -1) {
      const b = corridas[parIdx]
      usados.add(a.id)
      usados.add(b.id)
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

export default function AgendamentosPage() {
  const searchParams = useSearchParams()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresaNome, setEmpresaNome] = useState<string>('')
  const [empresaDescricao, setEmpresaDescricao] = useState<string>('')
  const [empresaWhatsApp, setEmpresaWhatsApp] = useState<string>('')
  const [empresaInstagram, setEmpresaInstagram] = useState<string>('')
  const [empresaSlug, setEmpresaSlug] = useState<string>('')
  // Dados fiscais/bancarios completos da empresa (Fase 1) — usados no voucher PDF
  const [empresaFiscal, setEmpresaFiscal] = useState<any>(null)
  // Modal de voucher aberto na ficha da corrida
  const [voucherAberto, setVoucherAberto] = useState<null | { corrida: Corrida; cliente: any }>(null)
  const [reciboAberto, setReciboAberto] = useState<null | { corrida: Corrida; cliente: any; reembolsos: any[] }>(null)
  const [repasseAberto, setRepasseAberto] = useState<Corrida | null>(null)
  const [mensagemConfirmacaoTransfer, setMensagemConfirmacaoTransfer] = useState<string | null>(null)
  const [rotasOpcoes, setRotasOpcoes] = useState<RotaOpcao[]>([])
  const [motoristasOpcoes, setMotoristasOpcoes] = useState<MotoristaOpcao[]>([])
  const [clientesOpcoes, setClientesOpcoes] = useState<Array<{ id: string; tipo: 'pj'|'pf'; label: string; telefone: string | null; email: string | null; raw: any }>>([])
  const [tipoOperacao, setTipoOperacao] = useState<string>('transfer')
  const [corridas, setCorridas] = useState<Corrida[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState<FormCorrida>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [rotaManualParaSalvar, setRotaManualParaSalvar] = useState<{
    origem: string
    destino: string
    preco: number
  } | null>(null)
  const [corridaEditando, setCorridaEditando] = useState<Corrida | null>(null)
  const [voltaIdEditando, setVoltaIdEditando] = useState<string | null>(null)
  const [modalAgAberto, setModalAgAberto] = useState(false)
  const [formAg, setFormAg] = useState<FormAgPassageiro>(FORM_AG_VAZIO)
  const [trechosRF, setTrechosRF] = useState<{ nome: string; preco: number }[]>([])
  const [paradasUnicasRF, setParadasUnicasRF] = useState<string[]>([])
  const [valorTrechoRF, setValorTrechoRF] = useState<number | null>(null)
  const [salvandoAg, setSalvandoAg] = useState(false)
  const [erroAg, setErroAg] = useState('')
  const [agendamentosRF, setAgendamentosRF] = useState<AgendamentoRF[]>([])
  const [agEditando, setAgEditando] = useState<AgendamentoRF | null>(null)
  const [filtroData, setFiltroData] = useState(HOJE)
  const [verTodos, setVerTodos] = useState(false)
  // Filtro por período (range) — presets estilo Google Ads/Meta Ads.
  //   'dia_unico': usa filtroData (comportamento antigo, default)
  //   'ultimos7' | 'este_mes' | 'mes_passado': range calculado automaticamente
  //   'personalizado': gestor escolhe filtroInicio + filtroFim
  type PeriodoPreset = 'dia_unico' | 'ultimos7' | 'este_mes' | 'mes_passado' | 'personalizado'
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('dia_unico')
  const [filtroInicio, setFiltroInicio] = useState(HOJE)
  const [filtroFim, setFiltroFim] = useState(HOJE)
  const [filtroRotaId, setFiltroRotaId] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalFichaAberto, setModalFichaAberto] = useState(false)
  const [corridaFicha, setCorridaFicha] = useState<Corrida | null>(null)
  const [voltaDaFicha, setVoltaDaFicha] = useState<Corrida | null>(null)
  const [modalPDFAberto, setModalPDFAberto] = useState(false)
  const [confirmandoFicha, setConfirmandoFicha] = useState(false)
  // Adicionar trajeto inline direto na ficha aberta (fluxo do Julimar dirigindo:
  // adiciona uma parada, salva na hora, sem entrar em modo de edição do form)
  const [novoTrajetoFicha, setNovoTrajetoFicha] = useState('')
  const [salvandoTrajetoFicha, setSalvandoTrajetoFicha] = useState(false)
  // KM inicial/final inline na ficha — motorista preenche antes de iniciar
  // e antes de finalizar sem entrar no modo de edição do form completo.
  // Separado por ponta (ida/volta) pra permitir ações independentes:
  // motorista pode finalizar só a IDA e a VOLTA continuar em aberto até
  // ser feita (útil quando a volta é em outra data).
  const [kmInicialFicha, setKmInicialFicha] = useState('')
  const [kmFinalFicha, setKmFinalFicha] = useState('')
  const [kmInicialFichaVolta, setKmInicialFichaVolta] = useState('')
  const [kmFinalFichaVolta, setKmFinalFichaVolta] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [motoristaFicha, setMotoristaFicha] = useState('')
  // Motorista da VOLTA — separado do motorista da ida. Corridas podem trocar
  // de motorista entre os dois trechos (dias diferentes, disponibilidade
  // diferente), então cada ponta precisa do próprio seletor.
  const [motoristaFichaVolta, setMotoristaFichaVolta] = useState('')
  const [contactsApi, setContactsApi] = useState(false)
  const fichaAutoAberta = useRef(false)
  useEffect(() => { setContactsApi('contacts' in navigator) }, [])
  useEffect(() => {
    const fichaId = searchParams.get('ficha')
    if (!fichaId || corridas.length === 0 || fichaAutoAberta.current) return
    const corrida = corridas.find(c => c.id === fichaId)
    if (corrida) {
      fichaAutoAberta.current = true
      setCorridaFicha(corrida)
      setModalFichaAberto(true)
    }
  }, [corridas, searchParams])
  async function selecionarContatoAg() {
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false })
      if (!contacts?.length) return
      const c = contacts[0]
      setFormAg(f => ({
        ...f,
        nome_passageiro: c.name?.[0] ?? f.nome_passageiro,
        telefone_passageiro: c.tel?.[0] ?? f.telefone_passageiro,
      }))
    } catch {}
  }

  useEffect(() => { carregarDados() }, [])

  useEffect(() => {
    if (!loading) {
      if (searchParams.get('nova') === '1') abrirNovaCorrida()
      if (searchParams.get('todos') === '1') setVerTodos(true)
      const rotaParam = searchParams.get('rota')
      if (rotaParam) setFiltroRotaId(rotaParam)
    }
  }, [loading, searchParams])

  async function carregarDados() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: gestor } = await supabase
      .from('gestores')
      .select('empresa_id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) return
    setEmpresaId(gestor.empresa_id)

    // MODELO 100% MANUAL (padrão Smart Car — decisão de negócio 2026-07-16).
    // Nenhuma auto-transição: corrida fica em 'confirmada' até alguém clicar
    // ▶️ Iniciar corrida com KM inicial, e em 'em_andamento' até alguém
    // clicar ⏹️ Finalizar com KM final. Motoristas que atrasam mantêm a
    // corrida em 'confirmada' até chegarem — sem surpresa de "meu status
    // mudou sozinho". Márcio e Julimar reportaram confusão com auto-transição.

    // Ordenação das corridas em 3 blocos, do mais urgente pro menos:
    //   1. EM ANDAMENTO (independente da data_hora — o gestor precisa dessas
    //      no topo pra editar, concluir, etc). Diária que começou às 8h e
    //      ainda tá rolando cairia como "passada" pela data_hora, mas
    //      precisa ficar em cima.
    //   2. FUTURAS (data_hora >= agora e status != em_andamento) — asc
    //   3. PASSADAS (data_hora < agora e status != em_andamento) — desc
    const agoraISO = new Date().toISOString()
    const colsCorridas = 'id, rota_id, cliente_id, origem, destino, data_hora, created_at, cliente_nome, cliente_telefone, email_solicitante, passageiro1_nome, passageiro1_telefone, valor, status, motorista_id, tipo_servico, forma_pagamento, status_pagamento, valor_recebido, data_pagamento, data_prevista_pagamento, valor_repasse_motorista, observacoes, motoristas_empresa(nome), numero_voo, nome_passageiro2, telefone_passageiro2, retorno_data, retorno_horario, retorno_origem, retorno_destino, numero_reserva, quantidade_bagagem, passageiros_adicionais, rua, numero, bairro, municipio, cep, referencia, rua_desembarque, numero_desembarque, bairro_desembarque, municipio_desembarque, cep_desembarque, referencia_desembarque, data_hora_termino, trajetos, km_inicial, km_final'

    const [{ data: empresa }, { data: rts }, { data: mots }, { data: clientesData }, { data: emAndamento }, { data: futuras }, { data: passadas }] = await Promise.all([
      supabase
        .from('empresas')
        .select('tipo_operacao, nome, mensagem_confirmacao_transfer, descricao, whatsapp_comercial, instagram, slug, cnpj, inscricao_estadual, logo_url, telefone, email_comercial, site, endereco_rua, endereco_numero, endereco_bairro, endereco_cep, cidade, estado, chave_pix, tipo_chave_pix, banco_nome, banco_agencia, banco_conta, banco_tipo_conta, banco_titular_nome, banco_titular_documento')
        .eq('id', gestor.empresa_id)
        .single(),
      supabase
        .from('rotas_empresa')
        .select('id, nome, origem, destino, preco, motorista_id')
        .eq('empresa_id', gestor.empresa_id)
        .order('created_at'),
      supabase
        .from('motoristas_empresa')
        .select('id, nome, user_id, telefone, veiculo, placa, cor, percentual_repasse, modo_repasse, valor_fixo_repasse')
        .eq('empresa_id', gestor.empresa_id)
        .eq('status', 'ativo')
        .order('nome'),
      supabase
        .from('clientes_empresa')
        .select('id, tipo, razao_social, nome_fantasia, cnpj, nome, cpf, telefone, email, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep')
        .eq('empresa_id', gestor.empresa_id)
        .eq('ativo', true)
        .order('atualizado_em', { ascending: false }),
      supabase
        .from('corridas_empresa')
        .select(colsCorridas)
        .eq('empresa_id', gestor.empresa_id)
        .eq('status', 'em_andamento')
        .order('data_hora', { ascending: true })
        .limit(100),
      supabase
        .from('corridas_empresa')
        .select(colsCorridas)
        .eq('empresa_id', gestor.empresa_id)
        .neq('status', 'em_andamento')
        .gte('data_hora', agoraISO)
        .order('data_hora', { ascending: true })
        .limit(250),
      supabase
        .from('corridas_empresa')
        .select(colsCorridas)
        .eq('empresa_id', gestor.empresa_id)
        .neq('status', 'em_andamento')
        .lt('data_hora', agoraISO)
        .order('data_hora', { ascending: false })
        .limit(150),
    ])
    const corrds = [...(emAndamento || []), ...(futuras || []), ...(passadas || [])]

    if (empresa) {
      setTipoOperacao(empresa.tipo_operacao || 'transfer')
      setEmpresaNome((empresa as any).nome || '')
      setEmpresaDescricao((empresa as any).descricao || '')
      setEmpresaWhatsApp((empresa as any).whatsapp_comercial || '')
      setEmpresaInstagram((empresa as any).instagram || '')
      setEmpresaSlug((empresa as any).slug || '')
      setEmpresaFiscal(empresa)
      setMensagemConfirmacaoTransfer((empresa as any).mensagem_confirmacao_transfer || null)
    }
    if (rts) setRotasOpcoes(rts)
    if (mots) setMotoristasOpcoes(mots)
    if (clientesData) {
      setClientesOpcoes((clientesData as any[]).map(c => ({
        id: c.id,
        tipo: c.tipo,
        label: c.tipo === 'pj' ? (c.nome_fantasia || c.razao_social || 'Sem nome') : (c.nome || 'Sem nome'),
        telefone: c.telefone,
        email: c.email,
        raw: c,
      })))
    }
    if (corrds) setCorridas(corrds as any)

    if (empresa?.tipo_operacao === 'rota_fixa' && mots) {
      const userIds = (mots as any[]).filter(m => m.user_id).map(m => m.user_id as string)
      if (userIds.length > 0) {
        const { data: ags } = await supabase
          .from('agendamentos')
          .select('id, rota_id, motorista_id, nome_passageiro, telefone_passageiro, parada_origem, parada_destino, turno, valor, status, data_viagem, forma_pagamento, observacoes, rua, numero, bairro, municipio, cep, referencia')
          .in('motorista_id', userIds)
          .order('data_viagem', { ascending: false })
          .limit(300)
        if (ags) setAgendamentosRF(ags as AgendamentoRF[])
      }
    }

    setLoading(false)
  }

  function abrirNovaCorrida() {
    setCorridaEditando(null)
    setVoltaIdEditando(null)
    setForm(FORM_VAZIO)
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(c: Corrida, voltaId?: string) {
    const rotaExiste = c.rota_id != null && rotasOpcoes.some(r => r.id === c.rota_id)
    // Duas formas de ida-e-volta existirem:
    // 1. PAR — duas linhas separadas em corridas_empresa (agrupadas por
    //    cliente_nome + created_at proximo). voltaId aponta pra outra linha.
    // 2. LINK PUBLICO — uma unica linha com retorno_data/retorno_horario/
    //    retorno_origem/retorno_destino preenchidos.
    // Em ambos os casos, o gestor precisa poder editar os dados da volta.
    const volta = voltaId ? corridas.find(x => x.id === voltaId) : null
    const temRetornoLinkPublico = !volta && !!c.retorno_data
    setCorridaEditando(c)
    setVoltaIdEditando(voltaId ?? null)
    setForm({
      tipo_servico: c.tipo_servico || 'transfer',
      rota_id: rotaExiste ? c.rota_id! : 'manual',
      origem: c.origem,
      destino: c.destino,
      data: c.data_hora.slice(0, 10),
      horario: c.data_hora.slice(11, 16),
      ida_volta: !!volta || temRetornoLinkPublico,
      origem_volta: volta?.origem || c.retorno_origem || '',
      destino_volta: volta?.destino || c.retorno_destino || '',
      data_retorno: volta?.data_hora.slice(0, 10) || c.retorno_data || '',
      horario_retorno: volta?.data_hora.slice(11, 16) || (c.retorno_horario ? c.retorno_horario.slice(0, 5) : ''),
      preco_volta: volta ? String(volta.valor) : '',
      observacoes_volta: volta?.observacoes || '',
      motorista_id: c.motorista_id || '',
      cliente_id: c.cliente_id || '',
      cliente_nome: c.cliente_nome,
      cliente_telefone: c.cliente_telefone || '',
      email_solicitante: c.email_solicitante || '',
      passageiro1_nome: c.passageiro1_nome || '',
      passageiro1_telefone: c.passageiro1_telefone || '',
      numero_voo: c.numero_voo || '',
      rua: c.rua || '', numero: c.numero || '', bairro: c.bairro || '', municipio: c.municipio || '', cep: c.cep || '', referencia: c.referencia || '',
      rua_desembarque: c.rua_desembarque || '', numero_desembarque: c.numero_desembarque || '', bairro_desembarque: c.bairro_desembarque || '',
      municipio_desembarque: c.municipio_desembarque || '', cep_desembarque: c.cep_desembarque || '', referencia_desembarque: c.referencia_desembarque || '',
      rua_retorno_embarque: c.rua_retorno_embarque || '', numero_retorno_embarque: c.numero_retorno_embarque || '', bairro_retorno_embarque: c.bairro_retorno_embarque || '',
      municipio_retorno_embarque: c.municipio_retorno_embarque || '', cep_retorno_embarque: c.cep_retorno_embarque || '', referencia_retorno_embarque: c.referencia_retorno_embarque || '',
      rua_retorno_desembarque: c.rua_retorno_desembarque || '', numero_retorno_desembarque: c.numero_retorno_desembarque || '', bairro_retorno_desembarque: c.bairro_retorno_desembarque || '',
      municipio_retorno_desembarque: c.municipio_retorno_desembarque || '', cep_retorno_desembarque: c.cep_retorno_desembarque || '', referencia_retorno_desembarque: c.referencia_retorno_desembarque || '',
      data_termino: c.data_hora_termino ? c.data_hora_termino.slice(0, 10) : '',
      horario_termino: c.data_hora_termino ? c.data_hora_termino.slice(11, 16) : '',
      trajetos: Array.isArray(c.trajetos) ? c.trajetos : [],
      km_inicial: c.km_inicial != null ? String(c.km_inicial) : '',
      km_final: c.km_final != null ? String(c.km_final) : '',
      // KM da volta vem da OUTRA linha do par (voltaId). Se link público
      // ida-e-volta (uma só linha), a volta compartilha os KMs da ida —
      // nesse caso mantém em branco pra não confundir.
      km_inicial_volta: volta && volta.km_inicial != null ? String(volta.km_inicial) : '',
      km_final_volta: volta && volta.km_final != null ? String(volta.km_final) : '',
      passageiros_adicionais: (c.passageiros_adicionais || []).map(p => ({
        nome: p.nome || '', telefone: p.telefone || '', numero_voo: '',
        rua: p.rua || '', numero: p.numero || '', bairro: p.bairro || '', municipio: p.municipio || '', cep: p.cep || '', referencia: p.referencia || '',
        rua_desembarque: p.rua_desembarque || '', numero_desembarque: p.numero_desembarque || '', bairro_desembarque: p.bairro_desembarque || '',
        municipio_desembarque: p.municipio_desembarque || '', cep_desembarque: p.cep_desembarque || '', referencia_desembarque: p.referencia_desembarque || '',
        rua_retorno_embarque: p.rua_retorno_embarque || '', numero_retorno_embarque: p.numero_retorno_embarque || '', bairro_retorno_embarque: p.bairro_retorno_embarque || '',
        municipio_retorno_embarque: p.municipio_retorno_embarque || '', cep_retorno_embarque: p.cep_retorno_embarque || '', referencia_retorno_embarque: p.referencia_retorno_embarque || '',
        rua_retorno_desembarque: p.rua_retorno_desembarque || '', numero_retorno_desembarque: p.numero_retorno_desembarque || '', bairro_retorno_desembarque: p.bairro_retorno_desembarque || '',
        municipio_retorno_desembarque: p.municipio_retorno_desembarque || '', cep_retorno_desembarque: p.cep_retorno_desembarque || '', referencia_retorno_desembarque: p.referencia_retorno_desembarque || '',
      })),
      forma_pagamento: c.forma_pagamento || 'a_definir',
      status_pagamento: c.status_pagamento || (c.status === 'concluida' ? 'recebido' : 'a_receber'),
      valor_recebido: c.valor_recebido != null ? String(c.valor_recebido) : '',
      data_pagamento: c.data_pagamento || '',
      data_prevista_pagamento: c.data_prevista_pagamento || '',
      preco: String(c.valor),
      valor_repasse_motorista: c.valor_repasse_motorista != null ? String(c.valor_repasse_motorista) : '',
      observacoes: c.observacoes || '',
    })
    setErro('')
    setModalAberto(true)
  }

  function selecionarRota(rotaId: string) {
    if (rotaId === 'manual') {
      setForm(f => ({ ...f, rota_id: 'manual', origem: '', destino: '', preco: '' }))
      return
    }
    if (rotaId === '') {
      setForm(f => ({ ...f, rota_id: '', origem: '', destino: '', preco: '' }))
      return
    }
    const rota = rotasOpcoes.find(r => r.id === rotaId)
    if (rota) {
      setForm(f => ({
        ...f,
        rota_id: rotaId,
        origem: rota.origem || '',
        destino: rota.destino || '',
        preco: String(rota.preco),
      }))
    }
  }

  async function salvar() {
    if (!form.cliente_nome.trim()) { setErro('Nome do solicitante é obrigatório'); return }
    const ehDispose = form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour'
    if (ehDispose) {
      if (!form.origem.trim()) { setErro('Local de início é obrigatório'); return }
      // Se preencheu um dos campos de término, exige o outro
      if ((form.data_termino && !form.horario_termino) || (!form.data_termino && form.horario_termino)) {
        setErro('Preencha data e hora de término, ou deixe os dois em branco'); return
      }
    } else {
      if (!form.origem.trim() || !form.destino.trim()) { setErro('Origem e destino são obrigatórios'); return }
    }
    if (!form.data) { setErro('Data é obrigatória'); return }
    if (!form.horario) { setErro('Horário de saída é obrigatório'); return }
    const preco = parseFloat(form.preco)
    if (isNaN(preco) || preco < 0) { setErro('Preço inválido'); return }
    if (!corridaEditando && form.ida_volta) {
      if (!form.horario_retorno) { setErro('Horário de retorno é obrigatório'); return }
      if (!(form.origem_volta || form.destino).trim() || !(form.destino_volta || form.origem).trim()) {
        setErro('Origem e destino do retorno são obrigatórios'); return
      }
      const dataRetorno = form.data_retorno || form.data
      if (dataRetorno < form.data) { setErro('A data de retorno não pode ser antes da data de ida'); return }
    }
    if (!empresaId) return

    setSalvando(true)
    setErro('')

    const valorRecebido = form.status_pagamento === 'recebido'
      ? preco
      : form.status_pagamento === 'parcial'
      ? (parseFloat(form.valor_recebido) || 0)
      : 0

    const hojeStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
    const dataPagamento = form.status_pagamento === 'recebido'
      ? (form.data_pagamento || hojeStr)
      : null

    const camposComuns = {
      motorista_id: form.motorista_id || null,
      rota_id: form.rota_id && form.rota_id !== 'manual' ? form.rota_id : null,
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      cliente_nome: form.cliente_nome.trim(),
      cliente_id: form.cliente_id || null,
      cliente_telefone: form.cliente_telefone.trim() || null,
      email_solicitante: form.email_solicitante.trim() || null,
      passageiro1_nome: form.passageiro1_nome.trim() || null,
      passageiro1_telefone: form.passageiro1_telefone.trim() || null,
      numero_voo: form.numero_voo.trim() || null,
      rua: form.rua.trim() || null,
      numero: form.numero.trim() || null,
      bairro: form.bairro.trim() || null,
      municipio: form.municipio.trim() || null,
      cep: form.cep.trim() || null,
      referencia: form.referencia.trim() || null,
      rua_desembarque: form.rua_desembarque.trim() || null,
      numero_desembarque: form.numero_desembarque.trim() || null,
      bairro_desembarque: form.bairro_desembarque.trim() || null,
      municipio_desembarque: form.municipio_desembarque.trim() || null,
      cep_desembarque: form.cep_desembarque.trim() || null,
      referencia_desembarque: form.referencia_desembarque.trim() || null,
      // Volta estruturada do Passageiro 1 — só grava se ida_volta ativo
      rua_retorno_embarque:         form.ida_volta ? (form.rua_retorno_embarque.trim()         || null) : null,
      numero_retorno_embarque:      form.ida_volta ? (form.numero_retorno_embarque.trim()      || null) : null,
      bairro_retorno_embarque:      form.ida_volta ? (form.bairro_retorno_embarque.trim()      || null) : null,
      municipio_retorno_embarque:   form.ida_volta ? (form.municipio_retorno_embarque.trim()   || null) : null,
      cep_retorno_embarque:         form.ida_volta ? (form.cep_retorno_embarque.trim()         || null) : null,
      referencia_retorno_embarque:  form.ida_volta ? (form.referencia_retorno_embarque.trim()  || null) : null,
      rua_retorno_desembarque:         form.ida_volta ? (form.rua_retorno_desembarque.trim()         || null) : null,
      numero_retorno_desembarque:      form.ida_volta ? (form.numero_retorno_desembarque.trim()      || null) : null,
      bairro_retorno_desembarque:      form.ida_volta ? (form.bairro_retorno_desembarque.trim()      || null) : null,
      municipio_retorno_desembarque:   form.ida_volta ? (form.municipio_retorno_desembarque.trim()   || null) : null,
      cep_retorno_desembarque:         form.ida_volta ? (form.cep_retorno_desembarque.trim()         || null) : null,
      referencia_retorno_desembarque:  form.ida_volta ? (form.referencia_retorno_desembarque.trim()  || null) : null,
      passageiros_adicionais: form.passageiros_adicionais.length > 0
        ? form.passageiros_adicionais.map(p => ({
            nome: p.nome.trim(), telefone: p.telefone.trim(), numero_voo: p.numero_voo.trim() || null,
            rua: p.rua.trim() || null, numero: p.numero.trim() || null, bairro: p.bairro.trim() || null,
            municipio: p.municipio.trim() || null, cep: p.cep.trim() || null, referencia: p.referencia.trim() || null,
            rua_desembarque: p.rua_desembarque.trim() || null, numero_desembarque: p.numero_desembarque.trim() || null,
            bairro_desembarque: p.bairro_desembarque.trim() || null, municipio_desembarque: p.municipio_desembarque.trim() || null,
            cep_desembarque: p.cep_desembarque.trim() || null, referencia_desembarque: p.referencia_desembarque.trim() || null,
            rua_retorno_embarque:         form.ida_volta ? (p.rua_retorno_embarque.trim()         || null) : null,
            numero_retorno_embarque:      form.ida_volta ? (p.numero_retorno_embarque.trim()      || null) : null,
            bairro_retorno_embarque:      form.ida_volta ? (p.bairro_retorno_embarque.trim()      || null) : null,
            municipio_retorno_embarque:   form.ida_volta ? (p.municipio_retorno_embarque.trim()   || null) : null,
            cep_retorno_embarque:         form.ida_volta ? (p.cep_retorno_embarque.trim()         || null) : null,
            referencia_retorno_embarque:  form.ida_volta ? (p.referencia_retorno_embarque.trim()  || null) : null,
            rua_retorno_desembarque:         form.ida_volta ? (p.rua_retorno_desembarque.trim()         || null) : null,
            numero_retorno_desembarque:      form.ida_volta ? (p.numero_retorno_desembarque.trim()      || null) : null,
            bairro_retorno_desembarque:      form.ida_volta ? (p.bairro_retorno_desembarque.trim()      || null) : null,
            municipio_retorno_desembarque:   form.ida_volta ? (p.municipio_retorno_desembarque.trim()   || null) : null,
            cep_retorno_desembarque:         form.ida_volta ? (p.cep_retorno_desembarque.trim()         || null) : null,
            referencia_retorno_desembarque:  form.ida_volta ? (p.referencia_retorno_desembarque.trim()  || null) : null,
          }))
        : null,
      valor: preco,
      tipo_servico: form.tipo_servico,
      // Diária/City Tour: término estimado + trajetos. Outros tipos gravam null.
      data_hora_termino: (form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour') && form.data_termino && form.horario_termino
        ? `${form.data_termino}T${form.horario_termino}:00`
        : null,
      trajetos: (form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour') && form.trajetos.some(t => t.trim())
        ? form.trajetos.map(t => t.trim()).filter(Boolean)
        : null,
      // KM inicial/final — só faz sentido pra corridas rodadas pelo motorista
      // da empresa (transfer, diária, city tour). Fretamento e excursão usam
      // outra estrutura de quilometragem em cobrancas_empresa.
      km_inicial: (form.tipo_servico === 'transfer' || form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour') && form.km_inicial.trim() !== ''
        ? parseFloat(form.km_inicial.replace(',', '.'))
        : null,
      km_final: (form.tipo_servico === 'transfer' || form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour') && form.km_final.trim() !== ''
        ? parseFloat(form.km_final.replace(',', '.'))
        : null,
      forma_pagamento: form.forma_pagamento,
      status_pagamento: form.status_pagamento,
      valor_recebido: valorRecebido,
      data_pagamento: dataPagamento,
      data_prevista_pagamento: form.data_prevista_pagamento || null,
      valor_repasse_motorista: form.valor_repasse_motorista.trim()
        ? Math.max(0, parseFloat(form.valor_repasse_motorista.replace(',', '.'))) || null
        : null,
      observacoes: form.observacoes.trim() || null,
    }

    if (corridaEditando) {
      const novoDataHora = `${form.data}T${form.horario}:00`
      const updateFields: Record<string, unknown> = {
        ...camposComuns,
        data_hora: novoDataHora,
      }
      // Se o gestor moveu o horario pra FUTURO e a corrida estava 'em_andamento'
      // sem KM inicial preenchido (ou seja, so entrou em em_andamento pela
      // auto-transicao no /empresa/page.tsx quando dava a hora), volta pra
      // 'confirmada'. Se o motorista ja preencheu KM inicial, ele iniciou de
      // verdade — nao mexemos no status.
      if (corridaEditando.status === 'em_andamento' && corridaEditando.km_inicial == null) {
        const novoTs = new Date(novoDataHora).getTime()
        if (novoTs > Date.now()) {
          updateFields.status = 'confirmada'
        }
      }
      // Se e edicao de corrida do link publico com ida-volta (uma so linha
      // com retorno_*), atualiza os campos retorno_* na mesma corrida.
      // Distinguimos do PAR pelo voltaIdEditando: se e null e ida_volta e true,
      // e link publico.
      if (!voltaIdEditando && form.ida_volta) {
        updateFields.retorno_data = form.data_retorno || null
        updateFields.retorno_horario = form.horario_retorno || null
        updateFields.retorno_origem = form.origem_volta.trim() || null
        updateFields.retorno_destino = form.destino_volta.trim() || null
      }
      // Se motorista mudou vs valor anterior, notifica o novo motorista.
      // Detecta antes do update pra saber se é atribuição inicial ou troca.
      const motoristaMudou = !!camposComuns.motorista_id &&
        camposComuns.motorista_id !== corridaEditando.motorista_id

      const { error } = await supabase
        .from('corridas_empresa')
        .update(updateFields)
        .eq('id', corridaEditando.id)

      if (error) {
        setErro('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }

      if (motoristaMudou && camposComuns.motorista_id) {
        notificarMotoristaAtribuido(
          camposComuns.motorista_id as string,
          corridaEditando.id,
          camposComuns.origem as string,
          camposComuns.destino as string,
          updateFields.data_hora as string,
          camposComuns.tipo_servico as string | null,
        )
      }

      // Se editando um par, atualiza os campos compartilhados na corrida de volta
      // + os campos especificos da volta (origem, destino, data, hora, valor,
      // observacoes) quando o usuario editar eles no formulario.
      if (voltaIdEditando) {
        const precoVoltaNum = parseFloat(form.preco_volta)
        const updateVolta: Record<string, unknown> = {
          motorista_id: camposComuns.motorista_id,
          cliente_nome: camposComuns.cliente_nome,
          cliente_telefone: camposComuns.cliente_telefone,
          forma_pagamento: camposComuns.forma_pagamento,
        }
        // Se o usuario alterou os dados da volta no form, propaga na volta
        if (form.origem_volta.trim()) updateVolta.origem = form.origem_volta.trim()
        if (form.destino_volta.trim()) updateVolta.destino = form.destino_volta.trim()
        if (form.data_retorno && form.horario_retorno) {
          updateVolta.data_hora = `${form.data_retorno}T${form.horario_retorno}:00`
        }
        if (!isNaN(precoVoltaNum) && form.preco_volta.trim() !== '') {
          updateVolta.valor = precoVoltaNum
        }
        updateVolta.observacoes = form.observacoes_volta.trim() || null

        // KM da volta independentes da ida. Só grava se cliente digitou
        // valor válido; se em branco, grava null pra permitir limpar campo.
        const kmIVoltaTrim = form.km_inicial_volta.trim()
        const kmFVoltaTrim = form.km_final_volta.trim()
        const kmIVoltaNum = parseFloat(kmIVoltaTrim.replace(',', '.'))
        const kmFVoltaNum = parseFloat(kmFVoltaTrim.replace(',', '.'))
        updateVolta.km_inicial = kmIVoltaTrim && !isNaN(kmIVoltaNum) ? kmIVoltaNum : null
        updateVolta.km_final   = kmFVoltaTrim && !isNaN(kmFVoltaNum) ? kmFVoltaNum : null

        const { error: erroVolta } = await supabase
          .from('corridas_empresa')
          .update(updateVolta)
          .eq('id', voltaIdEditando)

        if (erroVolta) {
          setErro('Erro ao salvar corrida de volta: ' + erroVolta.message)
          setSalvando(false)
          return
        }
      }
    } else {
      // Nova corrida nasce como 'confirmada'. Não amarra status ao pagamento
      // (o cliente pode pagar antecipado sem que o serviço tenha rolado ainda).
      // O gestor promove pra concluida manualmente no botão "✓ Marcar como
      // Concluído" da ficha quando o serviço acabar.
      const base = { empresa_id: empresaId, status: 'confirmada', ...camposComuns }
      const registros: typeof base[] = [
        { ...base, data_hora: `${form.data}T${form.horario}:00` } as any,
      ]

      if (form.ida_volta && form.horario_retorno) {
        const precoVolta = parseFloat(form.preco_volta)
        registros.push({
          ...base,
          data_hora: `${form.data_retorno || form.data}T${form.horario_retorno}:00`,
          origem: (form.origem_volta || form.destino).trim(),
          destino: (form.destino_volta || form.origem).trim(),
          valor: !isNaN(precoVolta) && form.preco_volta.trim() !== '' ? precoVolta : preco,
          observacoes: form.observacoes_volta.trim() || null,
        } as any)
      }

      const { data: inseridos, error } = await supabase
        .from('corridas_empresa').insert(registros).select('id, motorista_id, origem, destino, data_hora, tipo_servico')

      if (error) {
        setErro('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }

      // Se criou já com motorista atribuído, notifica pra corrida da ida.
      // Volta (segundo registro) não notifica separadamente — evita 2 pushes
      // consecutivos do mesmo motorista.
      const idaInserida = inseridos?.[0]
      if (idaInserida?.motorista_id) {
        notificarMotoristaAtribuido(
          idaInserida.motorista_id as string,
          idaInserida.id as string,
          idaInserida.origem as string,
          idaInserida.destino as string,
          idaInserida.data_hora as string,
          idaInserida.tipo_servico as string | null,
        )
      }

      if (form.rota_id === 'manual') {
        setRotaManualParaSalvar({ origem: form.origem.trim(), destino: form.destino.trim(), preco })
      }
    }

    setSalvando(false)
    setModalAberto(false)
    carregarDados()
  }

  async function salvarRotaManual() {
    if (!rotaManualParaSalvar || !empresaId) return
    await supabase.from('rotas_empresa').insert({
      empresa_id: empresaId,
      origem: rotaManualParaSalvar.origem,
      destino: rotaManualParaSalvar.destino,
      preco: rotaManualParaSalvar.preco,
    })
    setRotaManualParaSalvar(null)
    carregarDados()
  }

  // Dispara push notification pro motorista quando o gestor atribui uma
  // corrida a ele. Fire-and-forget — se falhar não trava o fluxo do salvar.
  function notificarMotoristaAtribuido(motoristasEmpresaId: string, corridaId: string, origem: string, destino: string, dataHora: string, tipoServico: string | null) {
    fetch('/api/notificar-motorista', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        motoristas_empresa_id: motoristasEmpresaId,
        corrida_id: corridaId,
        origem, destino, data_hora: dataHora, tipo_servico: tipoServico,
      }),
    }).catch(e => console.error('notificar-motorista falhou:', e))
  }

  // Atribui/troca motorista na ficha aberta, salvando na hora + notificando
  // o novo motorista via push. Fluxo: gestor abre ficha, muda motorista no
  // seletor inline, clica em Salvar sem precisar entrar em ✏️ Editar nem
  // "Iniciar corrida".
  async function atribuirMotoristaInline(c: Corrida, novoMotoristaId: string) {
    if (novoMotoristaId === (c.motorista_id ?? '')) return
    setConfirmandoFicha(true)
    const motoristaNovo = motoristasOpcoes.find(m => m.id === novoMotoristaId) ?? null
    const motoristaMudou = !!novoMotoristaId && novoMotoristaId !== c.motorista_id
    await supabase.from('corridas_empresa')
      .update({ motorista_id: novoMotoristaId || null })
      .eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? {
      ...x,
      motorista_id: novoMotoristaId || null,
      motoristas_empresa: motoristaNovo ? { nome: motoristaNovo.nome } : null,
    } : x))
    // Atualiza corridaFicha OU voltaDaFicha, dependendo de qual ponta foi
    // acionada — permite motorista diferente na ida e na volta.
    setCorridaFicha(prev => prev && prev.id === c.id ? {
      ...prev,
      motorista_id: novoMotoristaId || null,
      motoristas_empresa: motoristaNovo ? { nome: motoristaNovo.nome } : null,
    } : prev)
    setVoltaDaFicha(prev => prev && prev.id === c.id ? {
      ...prev,
      motorista_id: novoMotoristaId || null,
      motoristas_empresa: motoristaNovo ? { nome: motoristaNovo.nome } : null,
    } : prev)
    if (motoristaMudou) {
      notificarMotoristaAtribuido(
        novoMotoristaId, c.id, c.origem, c.destino, c.data_hora, c.tipo_servico,
      )
    }
    setConfirmandoFicha(false)
  }

  async function cancelarCorrida(ids: string[]) {
    for (const id of ids) {
      await supabase.from('corridas_empresa').update({ status: 'cancelada' }).eq('id', id)
    }
    setCorridas(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: 'cancelada' } : c))
  }

  // Adiciona um trajeto na corrida aberta na ficha, salvando na hora no
  // banco. Fluxo do Julimar dirigindo: uma parada nova a cada momento,
  // sem precisar entrar em modo de edição do form completo.
  async function adicionarTrajetoInline(c: Corrida, texto: string) {
    const trim = texto.trim()
    if (!trim) return
    setSalvandoTrajetoFicha(true)
    const atuais = Array.isArray(c.trajetos) ? c.trajetos : []
    const novos = [...atuais, trim]
    await supabase.from('corridas_empresa').update({ trajetos: novos }).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, trajetos: novos } : x))
    setCorridaFicha(prev => prev && prev.id === c.id ? { ...prev, trajetos: novos } : prev)
    setNovoTrajetoFicha('')
    setSalvandoTrajetoFicha(false)
  }

  async function removerTrajetoInline(c: Corrida, idx: number) {
    const atuais = Array.isArray(c.trajetos) ? c.trajetos : []
    const novos = atuais.filter((_, i) => i !== idx)
    await supabase.from('corridas_empresa').update({ trajetos: novos.length > 0 ? novos : null }).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, trajetos: novos } : x))
    setCorridaFicha(prev => prev && prev.id === c.id ? { ...prev, trajetos: novos } : prev)
  }

  // Reativa uma corrida — volta pro status alvo pra o gestor poder mexer
  // nela de novo. Preserva todos os dados (motorista, valor, endereços, etc).
  //  - Cancelada  → 'pendente' (precisa reprocessar do zero)
  //  - Concluida  → 'em_andamento' (serviço voltou a rolar, ex: bug que
  //    concluiu antes da hora — Julimar reativando a corrida das 11:40)
  async function reativarCorrida(ids: string[], alvo: 'pendente' | 'em_andamento' = 'pendente') {
    for (const id of ids) {
      await supabase.from('corridas_empresa').update({ status: alvo }).eq('id', id)
    }
    setCorridas(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: alvo } : c))
  }

  async function apagarCorrida(ids: string[]) {
    if (!confirm('Tem certeza que deseja apagar este agendamento?')) return
    for (const id of ids) {
      await supabase.from('corridas_empresa').delete().eq('id', id)
    }
    setCorridas(prev => prev.filter(c => !ids.includes(c.id)))
  }

  function abrirFicha(c: Corrida) {
    // Reset dos inputs inline (novo trajeto + KM ida + KM volta) — evita
    // carregar valores de outra ficha
    setNovoTrajetoFicha('')
    setKmInicialFicha('')
    setKmFinalFicha('')
    setKmInicialFichaVolta('')
    setKmFinalFichaVolta('')
    // Detecta se essa corrida faz parte de um par ida-volta (mesmo cliente,
    // created_at com menos de 30s de diferenca — mesma regra do agruparPares).
    // Se sim, guarda a outra ponta em voltaDaFicha pra exibir na ficha.
    const par = corridas.find(other =>
      other.id !== c.id && saoParIdaVolta(c, other)
    ) ?? null

    // A ficha sempre exibe a IDA como principal e a VOLTA embaixo, mesmo se o
    // gestor clicou na volta na lista.
    let idaAtual: Corrida = c
    let voltaAtual: Corrida | null = par
    if (par && par.data_hora < c.data_hora) {
      idaAtual = par
      voltaAtual = c
    }

    setCorridaFicha(idaAtual)
    setVoltaDaFicha(voltaAtual)
    setMotoristaFicha(idaAtual.motorista_id ?? '')
    setMotoristaFichaVolta(voltaAtual?.motorista_id ?? '')
    setModalFichaAberto(true)
  }

  function diaSemana(dataHora: string): string {
    const dias = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
    const d = new Date(dataHora)
    return dias[d.getDay()]
  }

  // `etapa` marca a mensagem como (IDA) ou (VOLTA) quando a corrida faz
  // parte de um par ida-volta (duas linhas separadas em corridas_empresa).
  // Sem isso, reenviar a confirmação da volta ficava idêntico ao da ida e
  // confundia motorista/cliente sobre qual trecho estava sendo confirmado.
  // Assinatura profissional das mensagens WhatsApp — cada empresa assina
  // com seus proprios dados. Nome sempre aparece; descricao/whatsapp/instagram
  // so aparecem se a empresa preencheu em Configuracoes. Empresa que so tem
  // nome continua com assinatura minima (comportamento antigo).
  function montarAssinatura(): string {
    if (!empresaNome) return ''
    const linhas: string[] = [`*${empresaNome}*`]
    if (empresaDescricao?.trim()) linhas.push(empresaDescricao.trim())
    if (empresaWhatsApp?.trim()) linhas.push(`📱 ${empresaWhatsApp.trim()}`)
    if (empresaInstagram?.trim()) {
      const ig = empresaInstagram.trim().replace(/^@/, '')
      linhas.push(`📸 Siga no Instagram: @${ig}`)
    }
    return linhas.join('\n')
  }

  // Resolve motorista pra exibicao: preferimos o lookup em motoristasOpcoes
  // (traz veiculo/placa/telefone), mas fazemos fallback pro JOIN da corrida
  // (c.motoristas_empresa) quando o motorista foi DESATIVADO depois — antes
  // o nome do motorista sumia da mensagem porque motoristasOpcoes só traz
  // status='ativo'.
  function motoristaInfo(c: Corrida, motoristaId: string) {
    const m = motoristasOpcoes.find(x => x.id === motoristaId)
    if (m) return m
    const j = (c as any).motoristas_empresa
    if (!j) return null
    return { id: motoristaId, nome: j.nome ?? '', veiculo: j.veiculo ?? null, placa: j.placa ?? null, cor: j.cor ?? null, telefone: j.telefone ?? null, user_id: null }
  }

  function montarMsgDetalhada(c: Corrida, motoristaId: string, etapa?: 'ida' | 'volta'): string {
    const motorista = motoristaInfo(c, motoristaId)
    const data = `${c.data_hora.slice(8,10)}/${c.data_hora.slice(5,7)}/${c.data_hora.slice(0,4)}`
    const hora = c.data_hora.slice(11,16)
    const dia = diaSemana(c.data_hora)
    const num = c.numero_reserva ?? c.id.slice(-5).toUpperCase()

    // Passageiro 1 (quem viaja) é diferente do responsável quando preenchido.
    // Se não veio (reservas antigas ou responsável = passageiro), cai no
    // cliente_nome/telefone pra manter compatibilidade.
    let passageiros = c.passageiro1_nome || c.cliente_nome
    let telefones = c.passageiro1_telefone || c.cliente_telefone || ''
    if (c.nome_passageiro2) passageiros += `, ${c.nome_passageiro2}`
    if (c.telefone_passageiro2) telefones += telefones ? `, ${c.telefone_passageiro2}` : c.telefone_passageiro2
    for (const p of c.passageiros_adicionais || []) {
      if (p.nome) passageiros += `, ${p.nome}`
      if (p.telefone) telefones += telefones ? `, ${p.telefone}` : p.telefone
    }

    const rotulo = etapa === 'ida' ? ' (IDA)' : etapa === 'volta' ? ' (VOLTA)' : ''
    let msg = `Olá, tudo bem?\n\nSegue a confirmação do Transfer${rotulo}: ${num}`
    msg += `\n📅 *Data/Hora:* ${data} às ${hora} (${dia})`
    msg += `\n\n👤 *Passageiros:* ${passageiros}`
    if (telefones) msg += `\n📞 *Telefones:* ${telefones}`
    msg += `\n\n📍 *Origem:* ${c.origem}`
    msg += `\n📍 *Destino:* ${c.destino}`
    if (c.numero_voo) msg += `\n✈️ *Voo:* ${c.numero_voo}`
    if (motorista) {
      msg += `\n\n🚗 *Motorista:* ${motorista.nome}`
      if (motorista.veiculo) msg += `\n🚙 *Carro:* ${motorista.veiculo}${motorista.cor ? ` - ${motorista.cor}` : ''}`
      if (motorista.placa) msg += `\n🔢 *Placa:* ${motorista.placa}`
      if (motorista.telefone) msg += `\n📞 *Tel motorista:* ${motorista.telefone}`
    }
    if (c.retorno_data) {
      const retData = `${c.retorno_data.slice(8,10)}/${c.retorno_data.slice(5,7)}/${c.retorno_data.slice(0,4)}`
      msg += `\n\n🔄 *Retorno:* ${retData}${c.retorno_horario ? ` às ${c.retorno_horario.slice(0,5)}` : ''}`
      if (c.retorno_origem) msg += `\n📍 ${c.retorno_origem} → ${c.retorno_destino}`
    }
    if (c.observacoes) msg += `\n\n📝 *Obs:* ${c.observacoes}`
    const ass = montarAssinatura()
    if (ass) msg += `\n\n${ass}`
    return msg
  }

  async function enviarEmailConfirmacao(c: Corrida) {
    if (!c.email_solicitante) return
    setEnviandoEmail(true)
    try {
      const res = await fetch('/api/enviar-confirmacao-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: c.email_solicitante,
          cliente_nome: c.cliente_nome,
          origem: c.origem,
          destino: c.destino,
          data_hora: c.data_hora,
          numero_reserva: c.numero_reserva,
          numero_voo: c.numero_voo,
          observacoes: c.observacoes,
          empresa_nome: empresaNome,
        }),
      })
      if (res.ok) {
        alert('Confirmação enviada por e-mail!')
      } else {
        alert('Erro ao enviar e-mail. Tente novamente.')
      }
    } catch {
      alert('Erro ao enviar e-mail. Tente novamente.')
    } finally {
      setEnviandoEmail(false)
    }
  }

  function enviarWhatsAppConfirmacao(c: Corrida) {
    const telFmt = formatarTelefoneWhatsApp(c.cliente_telefone)
    if (!telFmt) return
    const data = `${c.data_hora.slice(8,10)}/${c.data_hora.slice(5,7)}/${c.data_hora.slice(0,4)}`
    const hora = c.data_hora.slice(11,16)
    const dia = diaSemana(c.data_hora)
    const template = mensagemConfirmacaoTransfer
      || 'Olá {nome}, tudo bem!\n\nConfirmamos o seu transfer:\n\n📅 *Data/Hora:* {data} às {hora} ({dia})\n📍 *Origem:* {origem}\n📍 *Destino:* {destino}'
    let msg = template
      .replaceAll('{nome}', c.cliente_nome)
      .replaceAll('{data}', data)
      .replaceAll('{hora}', hora)
      .replaceAll('{dia}', dia)
      .replaceAll('{origem}', c.origem)
      .replaceAll('{destino}', c.destino)
    if (c.numero_voo) msg += `\n✈️ *Voo:* ${c.numero_voo}`
    if (c.retorno_data) {
      const retData = `${c.retorno_data.slice(8,10)}/${c.retorno_data.slice(5,7)}/${c.retorno_data.slice(0,4)}`
      msg += `\n\n🔄 *Retorno:* ${retData}${c.retorno_horario ? ` às ${c.retorno_horario.slice(0,5)}` : ''}`
      if (c.retorno_origem) msg += `\n📍 ${c.retorno_origem} → ${c.retorno_destino}`
    }
    if (c.observacoes) msg += `\n\n📝 *Obs:* ${c.observacoes}`
    msg += `\n\nEm breve informaremos o motorista responsável. Qualquer dúvida estamos à disposição!`
    const ass = montarAssinatura()
    if (ass) msg += `\n\n${ass}`
    window.open(`https://wa.me/${telFmt}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function enviarWhatsAppClienteComMotorista(c: Corrida, motoristaId: string, etapa?: 'ida' | 'volta') {
    const telFmt = formatarTelefoneWhatsApp(c.cliente_telefone)
    if (!telFmt) { alert('Cliente não tem telefone cadastrado.'); return }
    const msg = montarMsgDetalhada(c, motoristaId, etapa)
    window.open(`https://wa.me/${telFmt}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function enviarWhatsAppMotorista(c: Corrida, motoristaId: string, etapa?: 'ida' | 'volta') {
    const motorista = motoristaInfo(c, motoristaId)
    if (!motorista) return
    const telFmt = formatarTelefoneWhatsApp(motorista.telefone)
    if (!telFmt) { alert(`Motorista ${motorista.nome} não tem telefone cadastrado.`); return }
    const msg = montarMsgDetalhada(c, motoristaId, etapa)
    window.open(`https://wa.me/${telFmt}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // Agradecimento pos-conclusao — pra cliente. Reforca relacionamento e
  // aumenta chance de reserva futura (padrao de mercado premium).
  // Nome do CONTRATANTE (c.cliente_nome), nao do passageiro — em transfer
  // executivo o contratante e o passageiro podem ser pessoas diferentes;
  // quem escolheu, pagou e vai contratar de novo e o contratante. Se
  // contratante = passageiro, ainda funciona igual.
  function enviarAgradecimentoCliente(c: Corrida) {
    const telFmt = formatarTelefoneWhatsApp(c.cliente_telefone)
    if (!telFmt) { alert('Cliente não tem telefone cadastrado.'); return }
    const nome = c.cliente_nome || ''
    // Data REAL do servico — usa data_hora_termino se diaria/city_tour terminou
    // depois do inicio, senao a propria data_hora. Formato dd/mm/yyyy. Evita
    // "hoje" errado quando gestor manda a mensagem no dia seguinte.
    const dataRef = (c as any).data_hora_termino || c.data_hora
    const dataFmt = `${dataRef.slice(8,10)}/${dataRef.slice(5,7)}/${dataRef.slice(0,4)}`
    let msg = `Olá ${nome}! 🙏\n\n`
    msg += `Seu atendimento de ${c.origem} para ${c.destino} foi concluído com sucesso em ${dataFmt}.\n\n`
    // Se e diaria ou city tour com trajetos preenchidos, lista os trajetos —
    // reforca com o cliente tudo o que foi rodado no dia.
    const trajetos = (c as any).trajetos as { origem?: string; destino?: string }[] | null | undefined
    if ((c.tipo_servico === 'diaria' || c.tipo_servico === 'city_tour') && Array.isArray(trajetos) && trajetos.length > 0) {
      const listaValida = trajetos.filter(t => t?.origem || t?.destino)
      if (listaValida.length > 0) {
        msg += `*Trajetos realizados:*\n`
        listaValida.forEach(t => { msg += `• ${t.origem || '...'} → ${t.destino || '...'}\n` })
        msg += `\n`
      }
    }
    msg += `Foi um prazer atender você! Ficamos à disposição para as próximas viagens.\n\n`
    msg += `Obrigado pela preferência!`
    const ass = montarAssinatura()
    if (ass) msg += `\n\n${ass}`
    window.open(`https://wa.me/${telFmt}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // Agradecimento pos-conclusao — pra motorista parceiro. Fideliza o parceiro,
  // aumenta prioridade dele nas proximas chamadas.
  function enviarAgradecimentoMotorista(c: Corrida) {
    const motorista = motoristaInfo(c, c.motorista_id ?? '')
    if (!motorista) return
    const telFmt = formatarTelefoneWhatsApp(motorista.telefone)
    if (!telFmt) { alert(`Motorista ${motorista.nome} não tem telefone cadastrado.`); return }
    const data = `${c.data_hora.slice(8,10)}/${c.data_hora.slice(5,7)}/${c.data_hora.slice(0,4)}`
    let msg = `Olá ${motorista.nome}! 🚐\n\n`
    msg += `Passando pra agradecer pela parceria no atendimento de ${data} (${c.origem} → ${c.destino}).\n\n`
    msg += `Serviço concluído com excelência — conto com você nas próximas! 🤝`
    const ass = montarAssinatura()
    if (ass) msg += `\n\n${ass}`
    window.open(`https://wa.me/${telFmt}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function marcarConfirmada(c: Corrida) {
    setConfirmandoFicha(true)
    await supabase.from('corridas_empresa').update({ status: 'confirmada' }).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, status: 'confirmada' } : x))
    setCorridaFicha(prev => prev ? { ...prev, status: 'confirmada' } : prev)
    setConfirmandoFicha(false)
  }

  async function marcarEmAndamento(c: Corrida, motoristaId: string, kmInicial: number | null) {
    setConfirmandoFicha(true)
    const upd: Record<string, unknown> = { status: 'em_andamento' }
    if (motoristaId) upd.motorista_id = motoristaId
    if (kmInicial != null) upd.km_inicial = kmInicial
    const motorista = motoristasOpcoes.find(m => m.id === motoristaId) ?? null
    // Se motorista foi atribuído/alterado aqui pela ficha (não estava antes),
    // dispara push. Se ele já era o motorista, ignora.
    const motoristaFoiAtribuido = !!motoristaId && motoristaId !== c.motorista_id
    await supabase.from('corridas_empresa').update(upd).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, status: 'em_andamento', motorista_id: motoristaId || x.motorista_id, km_inicial: kmInicial ?? x.km_inicial, motoristas_empresa: motorista ? { nome: motorista.nome } : x.motoristas_empresa } : x))
    // Atualiza corridaFicha OU voltaDaFicha dependendo de qual foi acionada.
    // Isso permite iniciar/finalizar ida e volta independentemente.
    setCorridaFicha(prev => prev && prev.id === c.id
      ? { ...prev, status: 'em_andamento', motorista_id: motoristaId || prev.motorista_id, km_inicial: kmInicial ?? prev.km_inicial }
      : prev)
    setVoltaDaFicha(prev => prev && prev.id === c.id
      ? { ...prev, status: 'em_andamento', motorista_id: motoristaId || prev.motorista_id, km_inicial: kmInicial ?? prev.km_inicial }
      : prev)
    if (motoristaFoiAtribuido) {
      notificarMotoristaAtribuido(
        motoristaId, c.id, c.origem, c.destino, c.data_hora, c.tipo_servico,
      )
    }
    setConfirmandoFicha(false)
  }

  async function recusarFicha(c: Corrida) {
    setConfirmandoFicha(true)
    await supabase.from('corridas_empresa').update({ status: 'recusada' }).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, status: 'recusada' } : x))
    setConfirmandoFicha(false)
    setModalFichaAberto(false)
  }

  async function marcarConcluida(c: Corrida, kmFinal: number | null) {
    setConfirmandoFicha(true)
    const upd: Record<string, unknown> = { status: 'concluida' }
    if (kmFinal != null) upd.km_final = kmFinal
    await supabase.from('corridas_empresa').update(upd).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, status: 'concluida', km_final: kmFinal ?? x.km_final } : x))
    // Atualiza corridaFicha OU voltaDaFicha dependendo de qual foi acionada.
    // Só finaliza a ponta específica — a outra ponta continua no status
    // atual até ser finalizada independentemente.
    setCorridaFicha(prev => prev && prev.id === c.id
      ? { ...prev, status: 'concluida', km_final: kmFinal ?? prev.km_final }
      : prev)
    setVoltaDaFicha(prev => prev && prev.id === c.id
      ? { ...prev, status: 'concluida', km_final: kmFinal ?? prev.km_final }
      : prev)
    setConfirmandoFicha(false)
  }

  function abrirAgPassageiro() {
    setAgEditando(null)
    setFormAg(FORM_AG_VAZIO)
    setTrechosRF([])
    setParadasUnicasRF([])
    setValorTrechoRF(null)
    setErroAg('')
    setModalAgAberto(true)
  }

  function editarAgPassageiro(ag: AgendamentoRF) {
    setAgEditando(ag)
    const motorista = motoristasOpcoes.find(m => m.user_id === ag.motorista_id)
    setFormAg({
      rota_empresa_id: '',
      embarque: ag.parada_origem,
      desembarque: ag.parada_destino,
      valor: String(ag.valor),
      nome_passageiro: ag.nome_passageiro,
      telefone_passageiro: ag.telefone_passageiro || '',
      data_viagem: ag.data_viagem,
      turno: ag.turno,
      forma_pagamento: ag.forma_pagamento || 'dinheiro',
      observacoes: ag.observacoes || '',
      motorista_empresa_id: motorista?.id || '',
      rua: ag.rua || '',
      numero: ag.numero || '',
      bairro: ag.bairro || '',
      municipio: ag.municipio || '',
      cep: ag.cep || '',
      referencia: ag.referencia || '',
    })
    setTrechosRF([])
    setParadasUnicasRF([])
    setValorTrechoRF(null)
    setErroAg('')
    setModalAgAberto(true)
  }

  async function selecionarRotaAg(rotaId: string) {
    setFormAg(f => ({ ...f, rota_empresa_id: rotaId, embarque: '', desembarque: '' }))
    setValorTrechoRF(null)
    if (!rotaId) {
      setTrechosRF([])
      setParadasUnicasRF([])
      return
    }
    const { data } = await supabase
      .from('paradas_empresa')
      .select('nome, preco')
      .eq('rota_id', rotaId)
    const trechos = (data || []) as { nome: string; preco: number }[]
    setTrechosRF(trechos)
    const paradas = new Set<string>()
    trechos.forEach(t => {
      const partes = t.nome.split(' → ')
      if (partes.length === 2) {
        paradas.add(partes[0].trim())
        paradas.add(partes[1].trim())
      }
    })
    setParadasUnicasRF(Array.from(paradas))
  }

  async function salvarAgPassageiro() {
    if (!formAg.nome_passageiro.trim()) { setErroAg('Nome do passageiro é obrigatório'); return }
    if (!agEditando && !formAg.rota_empresa_id) { setErroAg('Selecione uma rota'); return }
    if (!formAg.embarque || !formAg.desembarque) { setErroAg('Selecione embarque e desembarque'); return }
    if (!formAg.data_viagem) { setErroAg('Data da viagem é obrigatória'); return }
    const valor = parseFloat(formAg.valor)
    if (isNaN(valor) || valor < 0) { setErroAg('Valor inválido'); return }
    if (!formAg.motorista_empresa_id) { setErroAg('Selecione um motorista'); return }

    const motorista = motoristasOpcoes.find(m => m.id === formAg.motorista_empresa_id)
    if (!motorista?.user_id) { setErroAg('Motorista não tem conta vinculada'); return }

    setSalvandoAg(true)
    setErroAg('')

    let dbError: any = null

    const camposEndereco = {
      rua: formAg.rua.trim() || null,
      numero: formAg.numero.trim() || null,
      bairro: formAg.bairro.trim() || null,
      municipio: formAg.municipio.trim() || null,
      cep: formAg.cep.trim() || null,
      referencia: formAg.referencia.trim() || null,
    }

    if (agEditando) {
      const res = await supabase.from('agendamentos').update({
        motorista_id: motorista.user_id,
        ...(formAg.rota_empresa_id ? { rota_id: formAg.rota_empresa_id } : {}),
        nome_passageiro: formAg.nome_passageiro.trim(),
        telefone_passageiro: formAg.telefone_passageiro.trim() || null,
        parada_origem: formAg.embarque,
        parada_destino: formAg.desembarque,
        turno: formAg.turno,
        valor,
        forma_pagamento: formAg.forma_pagamento,
        data_viagem: formAg.data_viagem,
        observacoes: formAg.observacoes.trim() || null,
        ...camposEndereco,
      }).eq('id', agEditando.id)
      dbError = res.error
    } else {
      const res = await supabase.from('agendamentos').insert({
        motorista_id: motorista.user_id,
        rota_id: formAg.rota_empresa_id || null,
        nome_passageiro: formAg.nome_passageiro.trim(),
        telefone_passageiro: formAg.telefone_passageiro.trim() || null,
        parada_origem: formAg.embarque,
        parada_destino: formAg.desembarque,
        turno: formAg.turno,
        valor,
        forma_pagamento: formAg.forma_pagamento,
        data_viagem: formAg.data_viagem,
        status: 'agendado',
        fiado_pago: false,
        observacoes: formAg.observacoes.trim() || null,
        ...camposEndereco,
      })
      dbError = res.error
    }

    setSalvandoAg(false)
    if (dbError) {
      setErroAg('Erro ao salvar: ' + dbError.message)
      return
    }
    setModalAgAberto(false)
    carregarDados()
  }

  async function cancelarAgendamentoRF(id: string) {
    await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', id)
    setAgendamentosRF(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelado' as const } : a))
  }

  async function apagarAgendamentoRF(id: string) {
    if (!confirm('Tem certeza que deseja apagar este agendamento?')) return
    await supabase.from('agendamentos').delete().eq('id', id)
    setAgendamentosRF(prev => prev.filter(a => a.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
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

  function navegarDia(delta: number) {
    const d = new Date(filtroData + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const nova = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    setFiltroData(nova)
    setVerTodos(false)
  }

  // Aplica filtro de período. Se preset 'dia_unico', usa filtroData.
  // Se qualquer outro preset, usa filtroInicio + filtroFim (inclusive).
  function passaPeriodo(dataISO: string): boolean {
    if (verTodos) return true
    if (periodoPreset === 'dia_unico') return dataISO === filtroData
    return dataISO >= filtroInicio && dataISO <= filtroFim
  }
  const corridasFiltradas = (() => {
    let list = corridas.filter(c => passaPeriodo(c.data_hora.slice(0, 10)))
    if (filtroRotaId) list = list.filter(c => c.rota_id === filtroRotaId)
    if (filtroStatus) list = list.filter(c => c.status === filtroStatus)
    return list
  })()
  const agendamentosFiltrados = (() => {
    let list = agendamentosRF.filter(ag => passaPeriodo(ag.data_viagem))
    // Filtro de rota: quando o gestor escolhe uma rota especifica, so aparecem
    // os passageiros vinculados a ela. "Todas as rotas" (filtroRotaId vazio)
    // mostra tudo.
    if (filtroRotaId) list = list.filter(ag => ag.rota_id === filtroRotaId)
    return list
  })()
  const eAtivo = (s: string) => s !== 'cancelada' && s !== 'concluida'
  // Sort defensivo — garante que ATIVAS aparecem antes de CONCLUÍDAS/CANCELADAS,
  // ordenadas por data_hora asc dentro de cada grupo. Isso protege contra
  // corridas com data_hora salva sem timezone (case Julimar: corrida hoje
  // 17:00 caia entre concluidas porque a query gte/lt classificava errado).
  const corridasOrdenadas = [...corridasFiltradas].sort((a, b) => {
    const aAtivo = eAtivo(a.status)
    const bAtivo = eAtivo(b.status)
    if (aAtivo !== bAtivo) return aAtivo ? -1 : 1
    const ta = new Date(a.data_hora).getTime()
    const tb = new Date(b.data_hora).getTime()
    // Ativas: asc (mais proxima primeiro). Concluidas/canceladas: desc (recente primeiro).
    return aAtivo ? ta - tb : tb - ta
  })
  const corridasAgrupadas = agruparPares(corridasOrdenadas)
  const qtdAtivas = corridasAgrupadas.filter(g =>
    g.tipo === 'simples'
      ? eAtivo(g.corrida.status)
      : eAtivo(g.ida.status) || eAtivo(g.volta.status)
  ).length

  const rotaManual = form.rota_id === 'manual'
  const camposRotaBloqueados = form.rota_id !== '' && form.rota_id !== 'manual'

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">
            {tipoOperacao === 'rota_fixa' ? 'Fretamentos' : 'Agendamentos'}
          </p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">
            {qtdAtivas} ativa{qtdAtivas !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {/* Seletor de rota (rota_fixa) */}
        {tipoOperacao === 'rota_fixa' && rotasOpcoes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 px-3 py-2">
            <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Rota</p>
            <select
              value={filtroRotaId}
              onChange={e => setFiltroRotaId(e.target.value)}
              className="w-full text-sm font-semibold text-gray-800 bg-transparent outline-none"
            >
              <option value="">Todas as rotas</option>
              {rotasOpcoes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.nome || `${r.origem} → ${r.destino}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filtro por período — presets Google Ads / Meta Ads style */}
        {tipoOperacao !== 'rota_fixa' && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {([
                { id: 'dia_unico',      label: 'Dia único' },
                { id: 'ultimos7',       label: 'Últimos 7 dias' },
                { id: 'este_mes',       label: 'Este mês' },
                { id: 'mes_passado',    label: 'Mês passado' },
                { id: 'personalizado',  label: '📅 Personalizado' },
              ] as { id: PeriodoPreset; label: string }[]).map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPeriodoPreset(p.id)
                    setVerTodos(false)
                    const hoje = new Date()
                    const iso = (d: Date) => d.toISOString().slice(0, 10)
                    if (p.id === 'ultimos7') {
                      const ini = new Date(hoje); ini.setDate(ini.getDate() - 6)
                      setFiltroInicio(iso(ini)); setFiltroFim(iso(hoje))
                    } else if (p.id === 'este_mes') {
                      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
                      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
                      setFiltroInicio(iso(ini)); setFiltroFim(iso(fim))
                    } else if (p.id === 'mes_passado') {
                      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
                      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
                      setFiltroInicio(iso(ini)); setFiltroFim(iso(fim))
                    }
                    // 'personalizado' preserva o range atual pra o gestor editar
                    // 'dia_unico' volta a usar filtroData (não mexe em inicio/fim)
                  }}
                  className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={periodoPreset === p.id
                    ? { background: '#0F6E56', color: '#fff' }
                    : { background: '#f3f4f6', color: '#6b7280' }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Range de datas — visível quando preset não é 'dia_unico'. Sempre
                editável no modo personalizado; outros presets mostram readonly
                com os valores calculados. */}
            {periodoPreset !== 'dia_unico' && (
              <div className="bg-white rounded-2xl border border-gray-100 px-3 py-2 flex items-center gap-2">
                <span className="text-[11px] text-gray-500 flex-shrink-0">De:</span>
                <input
                  type="date"
                  value={filtroInicio}
                  onChange={e => { setFiltroInicio(e.target.value); if (periodoPreset !== 'personalizado') setPeriodoPreset('personalizado') }}
                  className="flex-1 text-sm text-gray-700 outline-none border border-gray-200 rounded-lg px-2 py-1" />
                <span className="text-[11px] text-gray-500 flex-shrink-0">Até:</span>
                <input
                  type="date"
                  value={filtroFim}
                  onChange={e => { setFiltroFim(e.target.value); if (periodoPreset !== 'personalizado') setPeriodoPreset('personalizado') }}
                  min={filtroInicio}
                  className="flex-1 text-sm text-gray-700 outline-none border border-gray-200 rounded-lg px-2 py-1" />
              </div>
            )}
          </div>
        )}

        {/* Filtro de data (único) — só quando preset 'dia_unico' */}
        {periodoPreset === 'dia_unico' && (
        <div className="bg-white rounded-2xl border border-gray-100 flex items-center px-2 py-2 gap-1">
          <button
            onClick={() => navegarDia(-1)}
            disabled={verTodos}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-xl font-bold flex-shrink-0 disabled:opacity-25"
            style={{ background: '#f9fafb', color: '#0F6E56' }}>
            ‹
          </button>
          <label className="flex-1 text-center cursor-pointer py-1 block">
            <input
              type="date"
              value={filtroData}
              onChange={e => { if (e.target.value) { setFiltroData(e.target.value); setVerTodos(false) } }}
              className="sr-only"
            />
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {verTodos ? 'Todos os fretamentos' : filtroData === HOJE ? 'Hoje' : formatarDataFiltro(filtroData)}
            </p>
            {!verTodos && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {filtroData === HOJE ? formatarDataFiltro(filtroData) : filtroData.split('-').reverse().join('/')}
              </p>
            )}
          </label>
          <button
            onClick={() => navegarDia(1)}
            disabled={verTodos}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-xl font-bold flex-shrink-0 disabled:opacity-25"
            style={{ background: '#f9fafb', color: '#0F6E56' }}>
            ›
          </button>
          {!verTodos ? (
            <button
              onClick={() => setVerTodos(true)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 flex-shrink-0"
              style={{ color: '#6B7280', background: '#f9fafb' }}>
              Ver todos
            </button>
          ) : (
            <button
              onClick={() => { setFiltroData(HOJE); setVerTodos(false) }}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border flex-shrink-0"
              style={{ color: '#0F6E56', borderColor: '#9FE1CB', background: '#E1F5EE' }}>
              Hoje
            </button>
          )}
        </div>
        )}

        {/* Filtro de status */}
        {tipoOperacao !== 'rota_fixa' && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {[
              { value: '', label: 'Todas' },
              { value: 'pendente', label: 'Pendente' },
              { value: 'confirmada', label: 'Confirmada' },
              { value: 'em_andamento', label: 'Em andamento' },
              { value: 'concluida', label: 'Concluída' },
            ].map(op => (
              <button
                key={op.value}
                onClick={() => setFiltroStatus(op.value)}
                className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all"
                style={filtroStatus === op.value
                  ? { background: '#0F6E56', color: '#fff' }
                  : { background: '#f3f4f6', color: '#6b7280' }}>
                {op.label}
              </button>
            ))}
          </div>
        )}

        {/* Banner salvar rota manual */}
        {rotaManualParaSalvar && (
          <div className="rounded-xl p-4 border" style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#085041' }}>
              Deseja salvar essa rota para usar novamente?
            </p>
            <p className="text-xs mb-3" style={{ color: '#0F6E56' }}>
              {rotaManualParaSalvar.origem} → {rotaManualParaSalvar.destino} · R$ {rotaManualParaSalvar.preco.toFixed(2).replace('.', ',')}
            </p>
            <div className="flex gap-2">
              <button onClick={salvarRotaManual}
                className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{ background: '#0F6E56', color: '#fff' }}>
                Sim, salvar rota
              </button>
              <button onClick={() => setRotaManualParaSalvar(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200"
                style={{ background: '#fff', color: '#6B7280' }}>
                Não obrigado
              </button>
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <button onClick={abrirNovaCorrida}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#1D9E75', color: '#fff' }}>
          + Novo atendimento
        </button>

        {/* Compartilhar disponibilidade — link publico, sem PII/valor, so
            horarios + tipo. Cliente consulta antes de perguntar. */}
        {empresaSlug && (
          <button
            onClick={() => {
              const url = `${window.location.origin}/disponibilidade/${empresaSlug}`
              const msg = `Consulte minha disponibilidade dos próximos 30 dias: ${url}`
              if (navigator.share) {
                navigator.share({ title: 'Disponibilidade', url, text: msg }).catch(() => {})
              } else {
                navigator.clipboard.writeText(url).then(() => alert('Link copiado! Cole no WhatsApp do cliente.'))
              }
            }}
            className="w-full py-2.5 rounded-xl text-xs font-semibold border"
            style={{ background: '#fff', color: '#0F6E56', borderColor: '#9FE1CB' }}>
            🔗 Compartilhar disponibilidade
          </button>
        )}

        {/* Lista de corridas e agendamentos */}
        {corridasFiltradas.length === 0 && agendamentosFiltrados.length === 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-3xl mb-2">📋</p>
            {!verTodos && filtroData === HOJE ? (
              <>
                <p className="text-sm text-gray-500">Nenhum fretamento para hoje.</p>
                <button
                  onClick={() => setVerTodos(true)}
                  className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl border"
                  style={{ color: '#0F6E56', borderColor: '#9FE1CB', background: '#E1F5EE' }}>
                  Ver todos os fretamentos
                </button>
              </>
            ) : !verTodos ? (
              <>
                <p className="text-sm text-gray-500">Nenhum fretamento neste dia.</p>
                <button
                  onClick={() => setVerTodos(true)}
                  className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl border"
                  style={{ color: '#0F6E56', borderColor: '#9FE1CB', background: '#E1F5EE' }}>
                  Ver todos os fretamentos
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">Nenhum agendamento ainda.</p>
                <p className="text-xs text-gray-400 mt-1">
                  {tipoOperacao === 'rota_fixa' ? 'Toque em "+ Agendar passageiro" para começar.' : 'Toque em "+ Novo atendimento" para começar.'}
                </p>
              </>
            )}
          </div>
        )}
        {corridasFiltradas.length > 0 && (
          <div className="flex flex-col gap-2">
            {corridasAgrupadas.map(grupo => {

              /* ── Card simples ── */
              if (grupo.tipo === 'simples') {
                const c = grupo.corrida
                const cor = STATUS_COR[c.status] ?? STATUS_COR.confirmada
                const nomeMotorista = c.motoristas_empresa?.nome ?? null
                const tm = tipoMeta(c.tipo_servico)
                // Detecta ida-e-volta feito pelo LINK PUBLICO — nao gera 2 linhas
                // separadas (que agruparPares detectaria), so preenche retorno_*
                // na propria corrida. Precisamos mostrar os 2 trechos e as 2 datas
                // no card, igual fazemos pro caso do gestor.
                const temVolta = !!c.retorno_data
                const dataIda = `${c.data_hora.slice(8, 10)}/${c.data_hora.slice(5, 7)}/${c.data_hora.slice(0, 4)}`
                const horaIda = c.data_hora.slice(11, 16)
                const dataVolta = c.retorno_data ? `${c.retorno_data.slice(8, 10)}/${c.retorno_data.slice(5, 7)}/${c.retorno_data.slice(0, 4)}` : null
                const horaVolta = c.retorno_horario ? c.retorno_horario.slice(0, 5) : null
                return (
                  <div key={c.id} className="bg-white rounded-2xl p-4 border border-gray-100" onClick={() => podeAbrirFichaTransfer(c) ? abrirFicha(c) : undefined} style={{ cursor: podeAbrirFichaTransfer(c) ? 'pointer' : undefined }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: tm.bg, color: tm.text }}>
                            {tm.badge}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#4B5563' }}>
                            {c.numero_reserva || `#${c.id.slice(-5).toUpperCase()}`}
                          </span>
                          {temVolta && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                              ↔ Ida e volta
                            </span>
                          )}
                        </div>
                        {temVolta ? (
                          <>
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              ↗ {c.origem} → {c.destino}
                            </p>
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              ↙ {c.retorno_origem || c.destino} → {c.retorno_destino || c.origem}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Ida {dataIda} {horaIda}
                              {dataVolta && ` · Volta ${dataVolta}${horaVolta ? ` ${horaVolta}` : ''}`}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {c.origem} → {c.destino}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {dataIda} às {horaIda}
                            </p>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: cor.bg, color: cor.text }}>
                        {cor.label}
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2"
                      style={{ borderTop: '1px solid #f5f5f5', paddingTop: '8px' }}>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400">{tm.clienteLabel}</p>
                        <p className="text-xs font-medium text-gray-700 truncate">{c.cliente_nome}</p>
                        {c.cliente_telefone && (
                          <p className="text-xs text-gray-400 mt-0.5">📞 {c.cliente_telefone}</p>
                        )}
                        {nomeMotorista && (
                          <p className="text-xs text-gray-400 mt-0.5">🚗 {nomeMotorista}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                          R$ {Number(c.valor).toFixed(2).replace('.', ',')}
                        </p>
                        {c.status === 'pendente' && (
                          <button onClick={e => { e.stopPropagation(); abrirFicha(c) }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: '#FEF3C7', color: '#92400E' }}>
                            Ver ficha
                          </button>
                        )}
                        {c.status !== 'pendente' && (
                          <button onClick={e => { e.stopPropagation(); abrirEditar(c) }}
                            title="Editar atendimento"
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                            ✏️
                          </button>
                        )}
                        {c.status === 'confirmada' && (
                          <button onClick={e => { e.stopPropagation(); cancelarCorrida([c.id]) }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                            Cancelar
                          </button>
                        )}
                        {(c.status === 'cancelada' || c.status === 'recusada') && (
                          <button onClick={e => { e.stopPropagation(); apagarCorrida([c.id]) }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }

              /* ── Card par ida e volta ── */
              const { ida, volta } = grupo
              const statusKey = statusPar(ida, volta)
              const cor = STATUS_COR[statusKey] ?? STATUS_COR.confirmada
              const valorTotal = Number(ida.valor) + Number(volta.valor)
              const nomeMotorista = ida.motoristas_empresa?.nome ?? volta.motoristas_empresa?.nome ?? null
              const idsCancelar = [ida, volta].filter(c => c.status === 'confirmada').map(c => c.id)
              const tmPar = tipoMeta(ida.tipo_servico)

              return (
                <div key={`${ida.id}-${volta.id}`} className="bg-white rounded-2xl p-4 border border-gray-100" onClick={() => podeAbrirFichaTransfer(ida) ? abrirFicha(ida) : undefined} style={{ cursor: podeAbrirFichaTransfer(ida) ? 'pointer' : undefined }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: tmPar.bg, color: tmPar.text }}>
                          {tmPar.badge}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#4B5563' }}>
                          {ida.numero_reserva || `#${ida.id.slice(-5).toUpperCase()}`}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                          ↔ Ida e volta
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        ↗ {ida.origem} → {ida.destino}
                      </p>
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        ↙ {volta.origem} → {volta.destino}
                      </p>
                      {(() => {
                        const dataIda = `${ida.data_hora.slice(8, 10)}/${ida.data_hora.slice(5, 7)}/${ida.data_hora.slice(0, 4)}`
                        const dataVolta = `${volta.data_hora.slice(8, 10)}/${volta.data_hora.slice(5, 7)}/${volta.data_hora.slice(0, 4)}`
                        const horaIda = ida.data_hora.slice(11, 16)
                        const horaVolta = volta.data_hora.slice(11, 16)
                        return (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {dataIda === dataVolta
                              ? `Ida ${horaIda} · Volta ${horaVolta} · ${dataIda}`
                              : `Ida ${dataIda} ${horaIda} · Volta ${dataVolta} ${horaVolta}`}
                          </p>
                        )
                      })()}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                      style={{ background: cor.bg, color: cor.text }}>
                      {cor.label}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2"
                    style={{ borderTop: '1px solid #f5f5f5', paddingTop: '8px' }}>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400">{tmPar.clienteLabel}</p>
                      <p className="text-xs font-medium text-gray-700 truncate">{ida.cliente_nome}</p>
                      {ida.cliente_telefone && (
                        <p className="text-xs text-gray-400 mt-0.5">📞 {ida.cliente_telefone}</p>
                      )}
                      {nomeMotorista && (
                        <p className="text-xs text-gray-400 mt-0.5">🚗 {nomeMotorista}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                        R$ {valorTotal.toFixed(2).replace('.', ',')}
                      </p>
                      {ida.status !== 'pendente' && (
                        <button onClick={e => { e.stopPropagation(); abrirEditar(ida, volta.id) }}
                          title="Editar atendimento (ida e volta)"
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                          ✏️
                        </button>
                      )}
                      {idsCancelar.length > 0 && (
                        <button onClick={e => { e.stopPropagation(); cancelarCorrida(idsCancelar) }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                          Cancelar
                        </button>
                      )}
                      {statusKey === 'cancelada' && (
                        <button onClick={e => { e.stopPropagation(); apagarCorrida([ida.id, volta.id]) }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Passageiros agendados (rota_fixa) */}
        {tipoOperacao === 'rota_fixa' && agendamentosFiltrados.length > 0 && (
          <div className="flex flex-col gap-2">
            {corridasFiltradas.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Passageiros agendados</p>
            )}
            {agendamentosFiltrados.map(ag => {
              const cor = STATUS_COR_AG[ag.status] ?? { bg: '#EFF6FF', text: '#1D4ED8', label: ag.status }
              const nomeMotorista = motoristasOpcoes.find(m => m.user_id === ag.motorista_id)?.nome ?? null
              const dp = ag.data_viagem.split('-')
              const dataFmt = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : ag.data_viagem
              return (
                <div key={ag.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {ag.parada_origem} → {ag.parada_destino}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {dataFmt} · {ag.turno === 'ida' ? 'Ida' : 'Volta'}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                      style={{ background: cor.bg, color: cor.text }}>
                      {cor.label}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2"
                    style={{ borderTop: '1px solid #f5f5f5', paddingTop: '8px' }}>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{ag.nome_passageiro}</p>
                      {nomeMotorista && (
                        <p className="text-xs text-gray-400 mt-0.5">🚗 {nomeMotorista}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                        R$ {Number(ag.valor).toFixed(2).replace('.', ',')}
                      </p>
                      <button onClick={() => editarAgPassageiro(ag)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                        ✏️
                      </button>
                      {ag.status === 'agendado' && (
                        <button onClick={() => cancelarAgendamentoRF(ag.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                          Cancelar
                        </button>
                      )}
                      <button onClick={() => apagarAgendamentoRF(ag.id)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {tipoOperacao === 'rota_fixa' && agendamentosFiltrados.length > 0 && (
              <button
                onClick={() => setModalPDFAberto(true)}
                className="w-full py-3 rounded-xl text-sm font-semibold mt-3 flex items-center justify-center gap-2"
                style={{ background: '#E6F1FB', color: '#185FA5' }}>
                📋 Gerar lista de passageiros (PDF)
              </button>
            )}
          </div>
        )}
      </div>

      {modalPDFAberto && (() => {
        const primeiraRota = rotasOpcoes[0]
        const primeiroMot = motoristasOpcoes[0]
        return (
          <ModalListaPassageirosPDF
            diaSelecionado={new Date(filtroData + 'T00:00:00')}
            passageiros={agendamentosFiltrados.map(ag => ({ id: ag.id, nome: ag.nome_passageiro }))}
            nomeMotoristaSugerido={primeiroMot?.nome || ''}
            origemSugerida={primeiraRota?.origem || ''}
            destinoSugerido={primeiraRota?.destino || ''}
            tituloEvento="ROTA FIXA"
            onFechar={() => setModalPDFAberto(false)}
          />
        )
      })()}

      {/* Modal Voucher PDF — pra qualquer atendimento da ficha */}
      {voucherAberto && empresaFiscal && (() => {
        const c = voucherAberto.corrida
        const cli = voucherAberto.cliente
        const enderecoCliente = cli ? [
          [cli.endereco_rua, cli.endereco_numero].filter(Boolean).join(', '),
          cli.endereco_bairro,
          [cli.endereco_cidade, cli.endereco_estado].filter(Boolean).join('-'),
        ].filter(Boolean).join(', ') : null
        // Passageiros: P1 (obrigatorio no transfer) + P2 + adicionais
        const passageiros: string[] = []
        if (c.passageiro1_nome) passageiros.push(c.passageiro1_nome)
        if (c.nome_passageiro2) passageiros.push(c.nome_passageiro2)
        for (const p of (c.passageiros_adicionais || [])) {
          if (p?.nome) passageiros.push(p.nome)
        }
        const motInfo = motoristaInfo(c, c.motorista_id ?? '')
        // Numero exibido: usa numero_reserva se existe (formato "AMES2025-1234")
        const num = c.numero_reserva ? String(c.numero_reserva) : c.id.slice(-5).toUpperCase()
        return (
          <ModalGerarVoucher
            empresa={empresaFiscal}
            cliente={{
              nome: c.cliente_nome,
              telefone: c.cliente_telefone,
              email: c.email_solicitante,
              endereco_linha: enderecoCliente,
            }}
            atendimento={{
              numero: num,
              tipo_servico: c.tipo_servico,
              subtitulo_servico: null,
              origem: c.origem,
              destino: c.destino,
              data_hora: c.data_hora,
              data_hora_termino: c.data_hora_termino,
              numero_voo: c.numero_voo,
              passageiros_nomes: passageiros,
              motorista_nome: motInfo?.nome ?? null,
              motorista_veiculo: motInfo?.veiculo ?? null,
              motorista_placa: motInfo?.placa ?? null,
              observacoes: c.observacoes,
              descricao_servico: null,
              trajetos: (c.trajetos as any) || null,
              valor: Number(c.valor) || 0,
            }}
            emailCliente={c.email_solicitante}
            onFechar={() => setVoucherAberto(null)}
          />
        )
      })()}

      {/* Modal Recibo PDF — so aparece quando gestor clica no botao
          (que so aparece pra atendimentos com status_pagamento='recebido') */}
      {reciboAberto && empresaFiscal && (() => {
        const c = reciboAberto.corrida
        const cli = reciboAberto.cliente
        const enderecoCliente = cli ? [
          [cli.endereco_rua, cli.endereco_numero].filter(Boolean).join(', '),
          cli.endereco_bairro,
          [cli.endereco_cidade, cli.endereco_estado].filter(Boolean).join('-'),
        ].filter(Boolean).join(', ') : null
        const num = c.numero_reserva ? String(c.numero_reserva) : c.id.slice(-5).toUpperCase()
        return (
          <ModalGerarRecibo
            empresa={empresaFiscal}
            cliente={{
              nome: c.cliente_nome,
              telefone: c.cliente_telefone,
              email: c.email_solicitante,
              endereco_linha: enderecoCliente,
            }}
            atendimento={{
              numero: num,
              tipo_servico: c.tipo_servico,
              origem: c.origem,
              destino: c.destino,
              data_hora: c.data_hora,
              valor: Number(c.valor) || 0,
              valor_recebido: c.valor_recebido != null ? Number(c.valor_recebido) : null,
              forma_pagamento: c.forma_pagamento,
              data_pagamento: c.data_pagamento,
            }}
            emailCliente={c.email_solicitante}
            onFechar={() => setReciboAberto(null)}
            reembolsos={(reciboAberto.reembolsos || []).map((r: any) => ({
              data: r.data,
              descricao: r.descricao || '(sem descrição)',
              categoria: r.categoria,
              valor: Number(r.valor) || 0,
            }))}
          />
        )
      })()}

      {/* Modal Recibo de repasse pro motorista — so acessivel via botao
          que so aparece quando ha valor_repasse configurado. */}
      {repasseAberto && empresaFiscal && (() => {
        const c = repasseAberto
        const mot = motoristaInfo(c, c.motorista_id ?? '')
        if (!mot) return null
        const num = c.numero_reserva ? String(c.numero_reserva) : c.id.slice(-5).toUpperCase()
        return (
          <ModalGerarReciboRepasse
            empresa={empresaFiscal}
            motorista={{
              nome: mot.nome,
              documento: null,  // motoristas_empresa nao tem CPF hoje — fica em branco
              telefone: mot.telefone,
              veiculo: mot.veiculo,
              placa: mot.placa,
            }}
            atendimento={{
              numero: num,
              origem: c.origem,
              destino: c.destino,
              data_hora: c.data_hora,
            }}
            valor_repasse={Number(c.valor_repasse_motorista) || 0}
            data_pagamento={c.data_pagamento}
            forma_pagamento={c.forma_pagamento}
            onFechar={() => setRepasseAberto(null)}
          />
        )
      })()}

      {/* Modal ficha de solicitação pendente (transfer) */}
      {modalFichaAberto && corridaFicha && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalFichaAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <div className="flex-1">
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Solicitação de Transfer</p>
            </div>
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full"
              style={{ background: STATUS_COR[corridaFicha.status]?.bg ?? '#FEF3C7', color: STATUS_COR[corridaFicha.status]?.text ?? '#92400E' }}>
              {STATUS_COR[corridaFicha.status]?.label ?? corridaFicha.status}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 flex flex-col gap-3">

            {/* Viagem */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Viagem</p>
                {corridaFicha.tipo_servico !== 'fretamento' && corridaFicha.tipo_servico !== 'excursao' && (() => {
                  const idsAcao = voltaDaFicha ? [corridaFicha.id, voltaDaFicha.id] : [corridaFicha.id]
                  const statusFicha = corridaFicha.status
                  const eCancelada = statusFicha === 'cancelada' || (voltaDaFicha && voltaDaFicha.status === 'cancelada')
                  const eConcluida = statusFicha === 'concluida'
                  return (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          const c = corridaFicha
                          const voltaId = voltaDaFicha?.id
                          setModalFichaAberto(false)
                          abrirEditar(c, voltaId)
                        }}
                        title="Editar"
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                        ✏️
                      </button>
                      {!eCancelada && !eConcluida && (
                        <button
                          onClick={async () => {
                            if (!confirm('Cancelar este agendamento? Os dados ficam salvos e você pode reativar depois.')) return
                            await cancelarCorrida(idsAcao)
                            setCorridaFicha(prev => prev ? { ...prev, status: 'cancelada' } : prev)
                            setVoltaDaFicha(prev => prev ? { ...prev, status: 'cancelada' } : prev)
                          }}
                          title="Cancelar (mantém os dados)"
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                          ❌ Cancelar
                        </button>
                      )}
                      {(eCancelada || eConcluida) && (
                        <button
                          onClick={async () => {
                            const alvo = eConcluida ? 'em_andamento' : 'pendente'
                            await reativarCorrida(idsAcao, alvo)
                            setCorridaFicha(prev => prev ? { ...prev, status: alvo } : prev)
                            setVoltaDaFicha(prev => prev ? { ...prev, status: alvo } : prev)
                          }}
                          title={eConcluida ? 'Voltar para Em andamento' : 'Reativar agendamento'}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                          ↩️ Reativar
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm('Apagar definitivamente este agendamento? Os dados serão perdidos.')) return
                          for (const id of idsAcao) {
                            await supabase.from('corridas_empresa').delete().eq('id', id)
                          }
                          setCorridas(prev => prev.filter(c => !idsAcao.includes(c.id)))
                          setModalFichaAberto(false)
                        }}
                        title="Excluir definitivamente"
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                        🗑️
                      </button>
                    </div>
                  )
                })()}
              </div>
              {(() => {
                const ts = corridaFicha.tipo_servico
                const trajetosArr = Array.isArray(corridaFicha.trajetos) ? corridaFicha.trajetos : []
                // Considera "dispose" (diária/city_tour) quando o tipo bate OU quando
                // já tem dados típicos de dispose (trajetos ou término) — cobre caso
                // do usuário ter salvado com tipo antigo antes das mudanças.
                const ehDispose = ts === 'diaria' || ts === 'city_tour' || !!corridaFicha.data_hora_termino || trajetosArr.length > 0
                return (
                  <>
                    {ehDispose ? (
                      <p className="text-base font-bold text-gray-800">
                        📍 {corridaFicha.origem}
                        {corridaFicha.destino ? ` → ${corridaFicha.destino}` : ''}
                      </p>
                    ) : (
                      <p className="text-base font-bold text-gray-800">{corridaFicha.origem} → {corridaFicha.destino}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      {ehDispose ? '▶️ Início: ' : '📅 '}
                      {corridaFicha.data_hora.slice(8,10)}/{corridaFicha.data_hora.slice(5,7)}/{corridaFicha.data_hora.slice(0,4)} às {corridaFicha.data_hora.slice(11,16)}
                    </p>
                    {corridaFicha.data_hora_termino && (
                      <p className="text-sm text-gray-600">
                        ⏹️ Término: {corridaFicha.data_hora_termino.slice(8,10)}/{corridaFicha.data_hora_termino.slice(5,7)}/{corridaFicha.data_hora_termino.slice(0,4)} às {corridaFicha.data_hora_termino.slice(11,16)}
                      </p>
                    )}
                  </>
                )
              })()}
              {(corridaFicha.tipo_servico === 'diaria' || corridaFicha.tipo_servico === 'city_tour' || !!corridaFicha.data_hora_termino || (Array.isArray(corridaFicha.trajetos) && corridaFicha.trajetos.length > 0)) && (() => {
                const trajetos = Array.isArray(corridaFicha.trajetos) ? corridaFicha.trajetos : []
                return (
                  <div className="rounded-xl p-3 mt-1 flex flex-col gap-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <p className="text-xs font-semibold" style={{ color: '#166534' }}>
                      🗺️ Trajetos{trajetos.length > 0 ? ` (${trajetos.length})` : ''}
                    </p>
                    {trajetos.length === 0 && (
                      <p className="text-xs text-gray-500 italic">Nenhum trajeto ainda. Adicione conforme os locais forem sendo visitados.</p>
                    )}
                    {trajetos.length > 0 && (
                      <ol className="text-sm text-gray-700 flex flex-col gap-1" style={{ paddingLeft: '18px', listStyleType: 'decimal' }}>
                        {trajetos.map((t, i) => (
                          <li key={i} className="flex items-center justify-between gap-2">
                            <span className="flex-1 break-words">{t}</span>
                            <button
                              type="button"
                              onClick={() => removerTrajetoInline(corridaFicha, i)}
                              title="Remover este trajeto"
                              className="text-xs font-semibold text-red-500 px-2 flex-shrink-0">
                              ✕
                            </button>
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="flex gap-2 items-center mt-1">
                      <input
                        value={novoTrajetoFicha}
                        onChange={e => setNovoTrajetoFicha(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && novoTrajetoFicha.trim()) {
                            e.preventDefault()
                            adicionarTrajetoInline(corridaFicha, novoTrajetoFicha)
                          }
                        }}
                        placeholder="Ex: Restaurante Fasano, Shopping..."
                        className="campo-input flex-1"
                        style={{ fontSize: '13px' }}
                      />
                      <button
                        type="button"
                        onClick={() => adicionarTrajetoInline(corridaFicha, novoTrajetoFicha)}
                        disabled={salvandoTrajetoFicha || !novoTrajetoFicha.trim()}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 flex-shrink-0"
                        style={{ background: '#166534' }}>
                        {salvandoTrajetoFicha ? 'Salvando…' : '+ Adicionar'}
                      </button>
                    </div>
                  </div>
                )
              })()}
              {/* Quilometragem — transfer, diária, city tour. Sempre visível
                  nessas modalidades; conteúdo varia por status:
                    - confirmada: só mostra se já preenchido (edição via form)
                    - em_andamento / concluida: mostra valores salvos
                  Os INPUTS inline pra registrar KM ficam nos blocos de
                  ação (Marcar como em andamento / Marcar como concluído). */}
              {(corridaFicha.tipo_servico === 'transfer' || corridaFicha.tipo_servico === 'diaria' || corridaFicha.tipo_servico === 'city_tour') && (corridaFicha.km_inicial != null || corridaFicha.km_final != null) && (() => {
                const kmI = corridaFicha.km_inicial
                const kmF = corridaFicha.km_final
                const total = kmI != null && kmF != null && kmF >= kmI ? kmF - kmI : null
                return (
                  <div className="rounded-xl p-3 mt-1" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#1D4ED8' }}>🛞 Quilometragem</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Inicial: <strong>{kmI != null ? String(kmI).replace('.', ',') : '—'}</strong></span>
                      <span className="text-gray-600">Final: <strong>{kmF != null ? String(kmF).replace('.', ',') : '—'}</strong></span>
                    </div>
                    {total != null && (
                      <p className="text-sm font-bold mt-1" style={{ color: '#1D4ED8' }}>Total: {total.toFixed(1).replace('.', ',')} km</p>
                    )}
                  </div>
                )
              })()}
              {corridaFicha.numero_voo && (
                <p className="text-sm text-gray-600">✈️ Voo: {corridaFicha.numero_voo}</p>
              )}
              {corridaFicha.forma_pagamento && corridaFicha.forma_pagamento !== 'a_definir' && (
                <p className="text-sm text-gray-600">💳 Pagamento: {{
                  cartao: 'Cartão', pix: 'Pix', faturado: 'Faturado',
                  dinheiro: 'Dinheiro'
                }[corridaFicha.forma_pagamento] ?? corridaFicha.forma_pagamento}</p>
              )}
              {Number(corridaFicha.valor) > 0 && (
                <p className="text-sm font-semibold" style={{ color: '#0F6E56' }}>
                  R$ {Number(corridaFicha.valor).toFixed(2).replace('.', ',')}
                </p>
              )}
              {/* Bloco de repasse/lucro — so aparece quando ha repasse a
                  motorista parceiro configurado. Nao mostra pro funcionario. */}
              {Number(corridaFicha.valor_repasse_motorista) > 0 && (
                <div className="mt-1.5 rounded-lg p-2" style={{ background: '#F5F6F8' }}>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: '#6B7280' }}>Repasse motorista</span>
                    <span style={{ color: '#A32D2D' }}>
                      − R$ {Number(corridaFicha.valor_repasse_motorista).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold mt-1 pt-1" style={{ borderTop: '1px dashed #D9DCE3' }}>
                    <span style={{ color: '#0F6E56' }}>Lucro real</span>
                    <span style={{ color: '#0F6E56' }}>
                      R$ {(Number(corridaFicha.valor) - Number(corridaFicha.valor_repasse_motorista)).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              )}
              {corridaFicha.status_pagamento === 'recebido' && corridaFicha.data_pagamento && (
                <p className="text-xs mt-1" style={{ color: '#0F6E56' }}>
                  ✅ Recebido em {corridaFicha.data_pagamento.slice(8,10)}/{corridaFicha.data_pagamento.slice(5,7)}/{corridaFicha.data_pagamento.slice(0,4)}
                </p>
              )}
              {corridaFicha.status_pagamento !== 'recebido' && corridaFicha.data_prevista_pagamento && (
                <p className="text-xs mt-1 text-gray-500">
                  🕐 Previsão de recebimento: {corridaFicha.data_prevista_pagamento.slice(8,10)}/{corridaFicha.data_prevista_pagamento.slice(5,7)}/{corridaFicha.data_prevista_pagamento.slice(0,4)}
                </p>
              )}
            </div>

            {/* Volta (quando o agendamento foi feito como ida-e-volta) */}
            {voltaDaFicha && (
              <div className="rounded-2xl p-4 border" style={{ background: '#EEEDFE', borderColor: '#AFA9EC' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#3C3489' }}>🔁 Volta</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: STATUS_COR[voltaDaFicha.status]?.bg ?? '#FEF3C7', color: STATUS_COR[voltaDaFicha.status]?.text ?? '#92400E' }}>
                    {STATUS_COR[voltaDaFicha.status]?.label ?? voltaDaFicha.status}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-800">{voltaDaFicha.origem} → {voltaDaFicha.destino}</p>
                <p className="text-sm text-gray-600 mt-1">
                  📅 {voltaDaFicha.data_hora.slice(8,10)}/{voltaDaFicha.data_hora.slice(5,7)}/{voltaDaFicha.data_hora.slice(0,4)} às {voltaDaFicha.data_hora.slice(11,16)}
                </p>
                {Number(voltaDaFicha.valor) > 0 && (
                  <p className="text-sm font-semibold mt-1" style={{ color: '#3C3489' }}>
                    R$ {Number(voltaDaFicha.valor).toFixed(2).replace('.', ',')}
                  </p>
                )}
                {voltaDaFicha.observacoes && (
                  <p className="text-xs text-gray-500 mt-2">📝 {voltaDaFicha.observacoes}</p>
                )}
              </div>
            )}

            {/* Responsável pela solicitação */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {tipoMeta(corridaFicha.tipo_servico).clienteLabel === 'Responsável' ? 'Responsável pela solicitação' : tipoMeta(corridaFicha.tipo_servico).clienteLabel}
              </p>
              <p className="text-sm font-semibold text-gray-800">👤 {corridaFicha.cliente_nome}</p>
              {corridaFicha.cliente_telefone && (
                <p className="text-sm text-gray-600">📞 {corridaFicha.cliente_telefone}</p>
              )}
              {corridaFicha.email_solicitante && (
                <p className="text-sm text-gray-600">✉️ {corridaFicha.email_solicitante}</p>
              )}
            </div>

            {/* Passageiro 1 — quem efetivamente viaja (pode ser diferente do responsável) */}
            {(corridaFicha.passageiro1_nome || corridaFicha.rua || corridaFicha.rua_desembarque || corridaFicha.numero_voo) && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🧍 Passageiro 1</p>
                <p className="text-sm font-semibold text-gray-800">👤 {corridaFicha.passageiro1_nome || corridaFicha.cliente_nome}</p>
                {corridaFicha.passageiro1_telefone && (
                  <p className="text-sm text-gray-600">📞 {corridaFicha.passageiro1_telefone}</p>
                )}
                {corridaFicha.numero_voo && (
                  <p className="text-sm text-gray-600">✈️ Voo: {corridaFicha.numero_voo}</p>
                )}
                {(corridaFicha.rua || corridaFicha.numero || corridaFicha.bairro || corridaFicha.municipio || corridaFicha.cep || corridaFicha.referencia) && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">📍 Embarque</p>
                    <p className="text-sm text-gray-700">{[corridaFicha.rua, corridaFicha.numero].filter(Boolean).join(', ')}</p>
                    <p className="text-sm text-gray-700">{[corridaFicha.bairro, corridaFicha.municipio].filter(Boolean).join(' - ')}</p>
                    {corridaFicha.cep && <p className="text-xs text-gray-400">CEP: {corridaFicha.cep}</p>}
                    {corridaFicha.referencia && <p className="text-xs text-gray-500">📌 {corridaFicha.referencia}</p>}
                  </div>
                )}
                {(corridaFicha.rua_desembarque || corridaFicha.numero_desembarque || corridaFicha.bairro_desembarque || corridaFicha.municipio_desembarque || corridaFicha.cep_desembarque || corridaFicha.referencia_desembarque) && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🏁 Desembarque</p>
                    <p className="text-sm text-gray-700">{[corridaFicha.rua_desembarque, corridaFicha.numero_desembarque].filter(Boolean).join(', ')}</p>
                    <p className="text-sm text-gray-700">{[corridaFicha.bairro_desembarque, corridaFicha.municipio_desembarque].filter(Boolean).join(' - ')}</p>
                    {corridaFicha.cep_desembarque && <p className="text-xs text-gray-400">CEP: {corridaFicha.cep_desembarque}</p>}
                    {corridaFicha.referencia_desembarque && <p className="text-xs text-gray-500">📌 {corridaFicha.referencia_desembarque}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Passageiro adicional */}
            {corridaFicha.nome_passageiro2 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Passageiro adicional</p>
                <p className="text-sm font-semibold text-gray-800">👤 {corridaFicha.nome_passageiro2}</p>
                {corridaFicha.telefone_passageiro2 && (
                  <p className="text-sm text-gray-600">📞 {corridaFicha.telefone_passageiro2}</p>
                )}
              </div>
            )}

            {/* Mais passageiros (lista repetível, cada um com sua ficha) */}
            {(corridaFicha.passageiros_adicionais || []).map((p, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Passageiro {idx + (corridaFicha.nome_passageiro2 ? 3 : 2)}</p>
                <p className="text-sm font-semibold text-gray-800">👤 {p.nome}</p>
                {p.telefone && <p className="text-sm text-gray-600">📞 {p.telefone}</p>}
                {(p.rua || p.numero || p.bairro || p.municipio || p.cep || p.referencia) && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">📍 Embarque</p>
                    <p className="text-sm text-gray-700">{[p.rua, p.numero].filter(Boolean).join(', ')}</p>
                    <p className="text-sm text-gray-700">{[p.bairro, p.municipio].filter(Boolean).join(' - ')}</p>
                    {p.cep && <p className="text-xs text-gray-400">CEP: {p.cep}</p>}
                    {p.referencia && <p className="text-xs text-gray-500">📌 {p.referencia}</p>}
                  </div>
                )}
                {(p.rua_desembarque || p.numero_desembarque || p.bairro_desembarque || p.municipio_desembarque || p.cep_desembarque || p.referencia_desembarque) && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🏁 Desembarque</p>
                    <p className="text-sm text-gray-700">{[p.rua_desembarque, p.numero_desembarque].filter(Boolean).join(', ')}</p>
                    <p className="text-sm text-gray-700">{[p.bairro_desembarque, p.municipio_desembarque].filter(Boolean).join(' - ')}</p>
                    {p.cep_desembarque && <p className="text-xs text-gray-400">CEP: {p.cep_desembarque}</p>}
                    {p.referencia_desembarque && <p className="text-xs text-gray-500">📌 {p.referencia_desembarque}</p>}
                  </div>
                )}
              </div>
            ))}

            {!!corridaFicha.quantidade_bagagem && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-sm text-gray-700">🧳 {corridaFicha.quantidade_bagagem} {corridaFicha.quantidade_bagagem === 1 ? 'mala/volume' : 'malas/volumes'}</p>
              </div>
            )}

            {/* Retorno */}
            {corridaFicha.retorno_data && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Retorno solicitado</p>
                <p className="text-sm text-gray-600">
                  📅 {corridaFicha.retorno_data.slice(8,10)}/{corridaFicha.retorno_data.slice(5,7)}/{corridaFicha.retorno_data.slice(0,4)}
                  {corridaFicha.retorno_horario && ` às ${corridaFicha.retorno_horario.slice(0,5)}`}
                </p>
                {(corridaFicha.retorno_origem || corridaFicha.retorno_destino) && (
                  <p className="text-sm text-gray-800 font-medium">
                    {corridaFicha.retorno_origem} → {corridaFicha.retorno_destino}
                  </p>
                )}
              </div>
            )}

            {/* Observações */}
            {corridaFicha.observacoes && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Observações</p>
                <p className="text-sm text-gray-700 leading-relaxed">{corridaFicha.observacoes}</p>
              </div>
            )}

            {/* Motorista — inline em confirmada e em_andamento pra o gestor
                atribuir/trocar sem precisar entrar em Editar. Se muda em
                em_andamento, dispara push pro novo motorista. */}
            {(corridaFicha.status === 'confirmada' || corridaFicha.status === 'em_andamento') && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {corridaFicha.status === 'em_andamento' ? '🚗 Motorista do atendimento' : 'Definir motorista'}
                </p>
                {motoristasOpcoes.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum motorista ativo cadastrado</p>
                ) : (
                  <>
                    <select
                      value={motoristaFicha}
                      onChange={e => setMotoristaFicha(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white outline-none">
                      <option value="">Selecione o motorista...</option>
                      {motoristasOpcoes.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                    {/* Botão "Salvar motorista" aparece só quando o seletor
                        mostra alguém diferente do motorista já salvo. Evita
                        ruído quando o gestor abre a ficha sem intenção de mexer. */}
                    {motoristaFicha !== (corridaFicha.motorista_id ?? '') && (
                      <button
                        onClick={() => atribuirMotoristaInline(corridaFicha, motoristaFicha)}
                        disabled={confirmandoFicha}
                        className="w-full py-2.5 rounded-xl text-xs font-semibold border disabled:opacity-40"
                        style={{ background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }}>
                        {confirmandoFicha
                          ? 'Salvando…'
                          : motoristaFicha
                          ? '💾 Salvar motorista (notifica ele agora)'
                          : '💾 Remover motorista atual'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Ações — Pendente: confirmar com cliente */}
            {corridaFicha.status === 'pendente' && (
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => enviarEmailConfirmacao(corridaFicha)}
                  disabled={!corridaFicha.email_solicitante || enviandoEmail}
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#2563EB' }}>
                  {enviandoEmail ? 'Enviando...' : '✉️ Enviar confirmação por e-mail'}
                </button>
                <button
                  onClick={() => enviarWhatsAppConfirmacao(corridaFicha)}
                  disabled={!corridaFicha.cliente_telefone}
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#25D366' }}>
                  💬 Confirmar com cliente via WhatsApp
                </button>
                <button
                  onClick={() => marcarConfirmada(corridaFicha)}
                  disabled={confirmandoFicha}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold border disabled:opacity-40"
                  style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                  {confirmandoFicha ? 'Salvando...' : '✓ Mover para Confirmada'}
                </button>
                <button
                  onClick={() => recusarFicha(corridaFicha)}
                  disabled={confirmandoFicha}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold border disabled:opacity-40"
                  style={{ background: '#FCEBEB', color: '#A32D2D', borderColor: '#F5BCBC' }}>
                  Recusar solicitação
                </button>
              </div>
            )}

            {/* Aviso pro gestor: horário passou mas corrida ainda em confirmada.
                Modelo 100% manual (decisão 2026-07-16) não muda status sozinho,
                então se o motorista rodou e ninguém clicou Iniciar, o card
                deixa isso claro. */}
            {corridaFicha.status === 'confirmada' && new Date(corridaFicha.data_hora) < new Date() && (
              <div className="rounded-xl px-4 py-3 border" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
                <p className="text-xs" style={{ color: '#9A3412' }}>
                  ⏰ O horário deste atendimento já passou e ele ainda está como <strong>Confirmado</strong>. Se o motorista já saiu, toque em <strong>▶️ Iniciar atendimento</strong> abaixo (com o KM inicial). Se ainda não rolou, edite o horário.
                </p>
              </div>
            )}

            {/* Botao Voucher PDF — sempre disponivel na ficha, independente do
                status. Comprovante de reserva formal pro cliente. */}
            <button
              onClick={() => {
                const cli = clientesOpcoes.find(c => c.id === corridaFicha.cliente_id)?.raw
                setVoucherAberto({ corrida: corridaFicha, cliente: cli || null })
              }}
              className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-2 border"
              style={{ background: '#fff', color: '#0F6E56', borderColor: '#9FE1CB' }}>
              📄 Gerar voucher PDF
            </button>

            {/* Botao Recibo PDF — so aparece quando pagamento foi recebido.
                Antes disso nao faz sentido emitir recibo. */}
            {corridaFicha.status_pagamento === 'recebido' && (
              <button
                onClick={async () => {
                  const cli = clientesOpcoes.find(c => c.id === corridaFicha.cliente_id)?.raw
                  // Busca reembolsos JA PAGOS vinculados a esta corrida — entram
                  // no recibo como composicao do valor total pago pelo cliente.
                  // Reembolsos ainda pendentes ficam de fora (nao foram cobrados).
                  const { data: reembs } = await supabase
                    .from('despesas_empresa')
                    .select('id, data, categoria, descricao, valor, reembolsado_em')
                    .eq('corrida_id', corridaFicha.id)
                    .eq('reembolsavel', true)
                    .not('reembolsado_em', 'is', null)
                    .order('data', { ascending: true })
                  setReciboAberto({ corrida: corridaFicha, cliente: cli || null, reembolsos: reembs || [] })
                }}
                className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border"
                style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                🧾 Gerar recibo de pagamento
              </button>
            )}

            {/* Botao Recibo de repasse — so aparece quando ha valor de repasse
                configurado (motorista parceiro/agregado). */}
            {Number(corridaFicha.valor_repasse_motorista) > 0 && (
              <button
                onClick={() => setRepasseAberto(corridaFicha)}
                className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border"
                style={{ background: '#F0F4FA', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
                🤝 Recibo de repasse ao motorista
              </button>
            )}

            {/* Ações — Confirmada: definir motorista e marcar em andamento */}
            {corridaFicha.status === 'confirmada' && (
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => enviarWhatsAppMotorista(corridaFicha, motoristaFicha, voltaDaFicha ? 'ida' : undefined)}
                  disabled={!motoristaFicha}
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#25D366' }}>
                  💬 Enviar ficha ao motorista{voltaDaFicha ? ' (ida)' : ''}
                </button>
                <button
                  onClick={() => enviarWhatsAppClienteComMotorista(corridaFicha, motoristaFicha, voltaDaFicha ? 'ida' : undefined)}
                  disabled={!motoristaFicha}
                  className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#128C7E' }}>
                  💬 Enviar ficha ao cliente{voltaDaFicha ? ' (ida)' : ''}
                </button>
                {/* KM inicial obrigatório para iniciar corrida (transfer/diária/city_tour) */}
                {(corridaFicha.tipo_servico === 'transfer' || corridaFicha.tipo_servico === 'diaria' || corridaFicha.tipo_servico === 'city_tour') ? (() => {
                  const kmIStr = kmInicialFicha.trim().replace(',', '.')
                  const kmI = parseFloat(kmIStr)
                  const kmValido = !isNaN(kmI) && kmI >= 0
                  return (
                    <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>🛞 KM inicial <span className="font-normal text-gray-500">— obrigatório para iniciar</span></p>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={kmInicialFicha}
                        onChange={e => setKmInicialFicha(e.target.value)}
                        placeholder="Ex: 45230.5"
                        className="campo-input"
                      />
                      <button
                        onClick={() => marcarEmAndamento(corridaFicha, motoristaFicha, kmI)}
                        disabled={confirmandoFicha || !motoristaFicha || !kmValido}
                        className="w-full py-3.5 rounded-xl text-sm font-bold border disabled:opacity-40"
                        style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                        {confirmandoFicha
                          ? 'Salvando...'
                          : !motoristaFicha
                          ? 'Selecione um motorista primeiro'
                          : !kmValido
                          ? 'Informe o KM inicial'
                          : '▶️ Iniciar atendimento'}
                      </button>
                    </div>
                  )
                })() : (
                  <button
                    onClick={() => marcarEmAndamento(corridaFicha, motoristaFicha, null)}
                    disabled={confirmandoFicha || !motoristaFicha}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold border disabled:opacity-40"
                    style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                    {confirmandoFicha ? 'Salvando...' : !motoristaFicha ? 'Selecione um motorista primeiro' : '✓ Marcar como Em andamento'}
                  </button>
                )}
              </div>
            )}

            {/* Ações — Em andamento: reenviar fichas + marcar concluído */}
            {corridaFicha.status === 'em_andamento' && (
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => enviarWhatsAppMotorista(corridaFicha, corridaFicha.motorista_id ?? '', voltaDaFicha ? 'ida' : undefined)}
                  disabled={!corridaFicha.motorista_id}
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#25D366' }}>
                  💬 Reenviar ficha ao motorista{voltaDaFicha ? ' (ida)' : ''}
                </button>
                <button
                  onClick={() => enviarWhatsAppClienteComMotorista(corridaFicha, corridaFicha.motorista_id ?? '', voltaDaFicha ? 'ida' : undefined)}
                  disabled={!corridaFicha.motorista_id}
                  className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#128C7E' }}>
                  💬 Reenviar ficha ao cliente{voltaDaFicha ? ' (ida)' : ''}
                </button>
                {/* KM final obrigatório para finalizar corrida (transfer/diária/city_tour) */}
                {(corridaFicha.tipo_servico === 'transfer' || corridaFicha.tipo_servico === 'diaria' || corridaFicha.tipo_servico === 'city_tour') ? (() => {
                  const kmFStr = kmFinalFicha.trim().replace(',', '.')
                  const kmF = parseFloat(kmFStr)
                  const kmValido = !isNaN(kmF) && kmF >= 0
                  const kmInicialSalvo = corridaFicha.km_inicial
                  const kmMenorQueInicial = kmValido && kmInicialSalvo != null && kmF < kmInicialSalvo
                  return (
                    <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      {kmInicialSalvo != null && (
                        <p className="text-xs text-gray-500">KM inicial: <strong>{String(kmInicialSalvo).replace('.', ',')}</strong></p>
                      )}
                      <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>🛞 KM final <span className="font-normal text-gray-500">— obrigatório para finalizar</span></p>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={kmFinalFicha}
                        onChange={e => setKmFinalFicha(e.target.value)}
                        placeholder="Ex: 45312.8"
                        className="campo-input"
                      />
                      {kmMenorQueInicial && (
                        <p className="text-xs" style={{ color: '#DC2626' }}>⚠️ KM final não pode ser menor que o inicial.</p>
                      )}
                      {kmValido && !kmMenorQueInicial && kmInicialSalvo != null && (
                        <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>Total: {(kmF - kmInicialSalvo).toFixed(1).replace('.', ',')} km</p>
                      )}
                      <button
                        onClick={() => marcarConcluida(corridaFicha, kmF)}
                        disabled={confirmandoFicha || !kmValido || kmMenorQueInicial}
                        className="w-full py-3.5 rounded-xl text-sm font-bold border disabled:opacity-40"
                        style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                        {confirmandoFicha
                          ? 'Salvando...'
                          : !kmValido
                          ? 'Informe o KM final'
                          : kmMenorQueInicial
                          ? 'KM final inválido'
                          : '⏹️ Finalizar atendimento'}
                      </button>
                    </div>
                  )
                })() : (
                  <button
                    onClick={() => marcarConcluida(corridaFicha, null)}
                    disabled={confirmandoFicha}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold border disabled:opacity-40"
                    style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                    {confirmandoFicha ? 'Salvando...' : '✓ Marcar como Concluído'}
                  </button>
                )}
              </div>
            )}

            {/* Ações — Concluída: agradecimento pós-serviço (padrão de mercado
                premium — reforça relacionamento com cliente + fideliza motorista
                parceiro). Só aparece quando corrida está concluída. */}
            {corridaFicha.status === 'concluida' && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">💚 Mensagens de agradecimento</p>
                <button
                  onClick={() => enviarAgradecimentoCliente(corridaFicha)}
                  className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: '#25D366' }}>
                  🙏 Agradecer cliente
                </button>
                <button
                  onClick={() => enviarAgradecimentoMotorista(corridaFicha)}
                  disabled={!corridaFicha.motorista_id}
                  className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#128C7E' }}>
                  🤝 Agradecer motorista
                </button>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                BLOCO DA VOLTA — só aparece quando é PAR ida-volta com duas
                linhas separadas em corridas_empresa (voltaDaFicha).
                Cada ponta tem seus próprios botões Iniciar/Finalizar com
                KMs independentes. Decisão de negócio 2026-07-16: motorista
                pode finalizar só a IDA e a VOLTA continuar aberta até
                acontecer (útil quando a volta é em outro dia).
                ───────────────────────────────────────────────────────── */}
            {voltaDaFicha && (() => {
              const v = voltaDaFicha
              const stMeta = {
                confirmada:   { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
                em_andamento: { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
                concluida:    { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
                pendente:     { bg: '#FEF3C7', text: '#92400E', label: 'Pendente' },
                cancelada:    { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
              }[v.status] ?? { bg: '#F3F4F6', text: '#6B7280', label: v.status }
              return (
                <div className="rounded-2xl p-4 border-2 flex flex-col gap-3 mt-2" style={{ background: '#EEEDFE', borderColor: '#AFA9EC' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#3C3489' }}>🔁 Volta</p>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: stMeta.bg, color: stMeta.text }}>
                      {stMeta.label}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-800">{v.origem} → {v.destino}</p>
                  <p className="text-sm text-gray-600">
                    📅 {v.data_hora.slice(8,10)}/{v.data_hora.slice(5,7)}/{v.data_hora.slice(0,4)} às {v.data_hora.slice(11,16)}
                  </p>
                  {Number(v.valor) > 0 && (
                    <p className="text-sm font-semibold" style={{ color: '#3C3489' }}>
                      💰 R$ {Number(v.valor).toFixed(2).replace('.', ',')}
                    </p>
                  )}

                  {/* Motorista da volta — pode ser diferente do da ida (dias
                      distintos, disponibilidade diferente). Botão "Salvar"
                      só aparece quando o valor muda, igual ao seletor da ida. */}
                  {(v.status === 'confirmada' || v.status === 'em_andamento') && motoristasOpcoes.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold" style={{ color: '#3C3489' }}>
                        {v.status === 'em_andamento' ? '🚗 Motorista da volta' : 'Definir motorista da volta'}
                      </p>
                      <select
                        value={motoristaFichaVolta}
                        onChange={e => setMotoristaFichaVolta(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border text-sm text-gray-700 bg-white outline-none"
                        style={{ borderColor: '#AFA9EC' }}>
                        <option value="">Selecione o motorista...</option>
                        {motoristasOpcoes.map(m => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                      {motoristaFichaVolta !== (v.motorista_id ?? '') && (
                        <button
                          onClick={() => atribuirMotoristaInline(v, motoristaFichaVolta)}
                          disabled={confirmandoFicha}
                          className="w-full py-2.5 rounded-xl text-xs font-semibold border disabled:opacity-40"
                          style={{ background: '#3C3489', color: '#fff', borderColor: '#3C3489' }}>
                          {confirmandoFicha
                            ? 'Salvando…'
                            : motoristaFichaVolta
                            ? '💾 Salvar motorista da volta (notifica ele agora)'
                            : '💾 Remover motorista da volta'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Confirmação por WhatsApp — separada da ida. Reportado pelo
                      Julimar: quando ida e volta são em dias diferentes, o
                      motorista/cliente precisam de uma confirmação específica
                      da volta, não só a mensagem combinada da ida. */}
                  {(v.status === 'confirmada' || v.status === 'em_andamento') && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => enviarWhatsAppMotorista(v, motoristaFichaVolta || (v.motorista_id ?? ''), 'volta')}
                        disabled={!motoristaFichaVolta && !v.motorista_id}
                        className="w-full py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                        style={{ background: '#25D366' }}>
                        💬 {v.status === 'em_andamento' ? 'Reenviar' : 'Enviar'} ficha ao motorista (volta)
                      </button>
                      <button
                        onClick={() => enviarWhatsAppClienteComMotorista(v, motoristaFichaVolta || (v.motorista_id ?? ''), 'volta')}
                        disabled={!motoristaFichaVolta && !v.motorista_id}
                        className="w-full py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                        style={{ background: '#128C7E' }}>
                        💬 {v.status === 'em_andamento' ? 'Reenviar' : 'Enviar'} ficha ao cliente (volta)
                      </button>
                    </div>
                  )}

                  {/* KM da volta se ja preenchido */}
                  {(v.km_inicial != null || v.km_final != null) && (
                    <div className="rounded-xl p-2 border" style={{ background: '#fff', borderColor: '#BFDBFE' }}>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">KM Inicial: <strong>{v.km_inicial != null ? String(v.km_inicial).replace('.', ',') : '—'}</strong></span>
                        <span className="text-gray-600">Final: <strong>{v.km_final != null ? String(v.km_final).replace('.', ',') : '—'}</strong></span>
                      </div>
                      {v.km_inicial != null && v.km_final != null && v.km_final >= v.km_inicial && (
                        <p className="text-xs font-bold mt-1" style={{ color: '#1D4ED8' }}>
                          Total: {(Number(v.km_final) - Number(v.km_inicial)).toFixed(1).replace('.', ',')} km
                        </p>
                      )}
                    </div>
                  )}

                  {/* Iniciar volta */}
                  {v.status === 'confirmada' && (v.tipo_servico === 'transfer' || v.tipo_servico === 'diaria' || v.tipo_servico === 'city_tour') && (() => {
                    const kmI = parseFloat(kmInicialFichaVolta.replace(',', '.'))
                    const kmValido = !isNaN(kmI) && kmI >= 0
                    return (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold" style={{ color: '#3C3489' }}>🛞 KM inicial da volta</p>
                        <input type="number" step="0.1" min={0}
                          value={kmInicialFichaVolta}
                          onChange={e => setKmInicialFichaVolta(e.target.value)}
                          placeholder="Ex: 45312.0"
                          className="campo-input" />
                        <button
                          onClick={() => marcarEmAndamento(v, v.motorista_id ?? '', kmI)}
                          disabled={confirmandoFicha || !kmValido}
                          className="w-full py-3 rounded-xl text-sm font-bold border disabled:opacity-40"
                          style={{ background: '#3C3489', color: '#fff', borderColor: '#3C3489' }}>
                          {confirmandoFicha ? 'Salvando…' : !kmValido ? 'Informe o KM inicial' : '▶️ Iniciar volta'}
                        </button>
                      </div>
                    )
                  })()}

                  {/* Finalizar volta */}
                  {v.status === 'em_andamento' && (v.tipo_servico === 'transfer' || v.tipo_servico === 'diaria' || v.tipo_servico === 'city_tour') && (() => {
                    const kmF = parseFloat(kmFinalFichaVolta.replace(',', '.'))
                    const kmValido = !isNaN(kmF) && kmF >= 0
                    const kmMenor = kmValido && v.km_inicial != null && kmF < v.km_inicial
                    return (
                      <div className="flex flex-col gap-2">
                        {v.km_inicial != null && (
                          <p className="text-xs text-gray-500">KM inicial: <strong>{String(v.km_inicial).replace('.', ',')}</strong></p>
                        )}
                        <p className="text-xs font-semibold" style={{ color: '#3C3489' }}>🛞 KM final da volta</p>
                        <input type="number" step="0.1" min={0}
                          value={kmFinalFichaVolta}
                          onChange={e => setKmFinalFichaVolta(e.target.value)}
                          placeholder="Ex: 45400.5"
                          className="campo-input" />
                        {kmMenor && (
                          <p className="text-xs" style={{ color: '#DC2626' }}>⚠️ KM final não pode ser menor que o inicial.</p>
                        )}
                        {kmValido && !kmMenor && v.km_inicial != null && (
                          <p className="text-xs font-semibold" style={{ color: '#3C3489' }}>
                            Total: {(kmF - Number(v.km_inicial)).toFixed(1).replace('.', ',')} km
                          </p>
                        )}
                        <button
                          onClick={() => marcarConcluida(v, kmF)}
                          disabled={confirmandoFicha || !kmValido || kmMenor}
                          className="w-full py-3 rounded-xl text-sm font-bold border disabled:opacity-40"
                          style={{ background: '#3C3489', color: '#fff', borderColor: '#3C3489' }}>
                          {confirmandoFicha ? 'Salvando…' : !kmValido ? 'Informe o KM final' : kmMenor ? 'KM final inválido' : '⏹️ Finalizar volta'}
                        </button>
                      </div>
                    )
                  })()}

                  {v.status === 'concluida' && (
                    <div className="rounded-lg p-2 border" style={{ background: '#F3F4F6', borderColor: '#E5E7EB' }}>
                      <p className="text-xs text-gray-500">✅ Volta concluída.</p>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Modal formulário nova/editar corrida */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
              {corridaEditando ? 'Editar atendimento' : 'Novo atendimento'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 flex flex-col gap-3">

            <Campo label="Tipo de serviço">
              <select value={form.tipo_servico}
                onChange={e => setForm(f => ({ ...f, tipo_servico: e.target.value }))}
                className="campo-input">
                {tipoOperacao === 'rota_fixa' ? (
                  <>
                    <option value="fretamento">Fretamento</option>
                    <option value="excursao">Excursão</option>
                  </>
                ) : (
                  <>
                    <option value="transfer">Transfer</option>
                    <option value="city_tour">City Tour</option>
                    <option value="diaria">Diária</option>
                  </>
                )}
              </select>
            </Campo>

            {/* Motorista movido pro topo pra ficar visível na edição sem
                precisar rolar. Notificação push é disparada automaticamente
                quando o gestor atribui/troca motorista (funcao
                notificarMotoristaAtribuido). */}
            <Campo label="Motorista atribuído">
              <select value={form.motorista_id}
                onChange={e => {
                  const id = e.target.value
                  const mot = motoristasOpcoes.find(m => m.id === id)
                  const valorNum = parseFloat(form.preco?.replace(',', '.') || '0')
                  // Auto-calcula repasse respeitando o MODO do motorista:
                  //   - percentual: valor da corrida * percentual / 100
                  //   - valor_fixo: valor fixo direto (independe do preco)
                  //   - sem repasse (funcionario): fica em branco
                  // So preenche se campo estiver vazio (nao sobrescreve edicao manual).
                  let repasseAuto = form.valor_repasse_motorista
                  if (!form.valor_repasse_motorista && mot) {
                    // Inferir modo pra motoristas legados que so tem percentual_repasse
                    const modo = mot.modo_repasse ?? (mot.percentual_repasse ? 'percentual' : null)
                    if (modo === 'percentual' && mot.percentual_repasse && valorNum > 0) {
                      repasseAuto = (valorNum * mot.percentual_repasse / 100).toFixed(2)
                    } else if (modo === 'valor_fixo' && mot.valor_fixo_repasse) {
                      repasseAuto = mot.valor_fixo_repasse.toFixed(2)
                    }
                  }
                  setForm(f => ({ ...f, motorista_id: id, valor_repasse_motorista: repasseAuto }))
                }}
                className="campo-input">
                <option value="">A definir</option>
                {motoristasOpcoes.map(m => {
                  const modo = m.modo_repasse ?? (m.percentual_repasse ? 'percentual' : null)
                  const info = modo === 'percentual' && m.percentual_repasse ? ` · ${m.percentual_repasse}% repasse`
                    : modo === 'valor_fixo' && m.valor_fixo_repasse ? ` · R$ ${Number(m.valor_fixo_repasse).toFixed(2).replace('.', ',')} fixo`
                    : ''
                  return <option key={m.id} value={m.id}>{m.nome}{info}</option>
                })}
              </select>
            </Campo>

            {/* Repasse ao motorista parceiro. Aparece so quando tem motorista
                atribuido. Autopreenchido pelo percentual padrao — gestor pode
                editar. Lucro real = valor - repasse (mostrado na ficha). */}
            {form.motorista_id && (
              <Campo label="Valor de repasse ao motorista (R$)">
                <input type="number" min={0} step={0.01}
                  value={form.valor_repasse_motorista}
                  onChange={e => setForm(f => ({ ...f, valor_repasse_motorista: e.target.value }))}
                  placeholder="Ex: 350.00"
                  className="campo-input" />
                <p className="text-[10px] text-gray-400 mt-1">
                  Deixe em branco pra motorista funcionário (sem repasse).
                  Se o motorista tem % configurado, o valor é calculado automaticamente.
                </p>
              </Campo>
            )}

            {tipoOperacao !== 'rota_fixa' && (
              <Campo label="Rota">
                <select value={form.rota_id} onChange={e => selecionarRota(e.target.value)} className="campo-input">
                  <option value="">Selecione uma rota...</option>
                  {rotasOpcoes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.origem} → {r.destino} — R$ {Number(r.preco).toFixed(2).replace('.', ',')}
                    </option>
                  ))}
                  <option value="manual">✏️ Outra rota (digitar manualmente)</option>
                </select>
              </Campo>
            )}

            <div className="rounded-xl px-3 py-3" style={{ background: '#E6F1FB' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#0C447C' }}>
                {form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? '🚗 Serviço' : '🚗 Ida'}
              </p>

              <Campo label={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Local de início *' : 'Origem *'}>
                <input
                  value={form.origem}
                  onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
                  readOnly={camposRotaBloqueados}
                  placeholder={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Ex: Aeroporto, hotel, residência do cliente' : 'Ex: Aeroporto Internacional'}
                  className="campo-input"
                  style={{
                    background: camposRotaBloqueados ? '#f9fafb' : '#fff',
                    color: camposRotaBloqueados ? '#6B7280' : '#222',
                  }}
                />
              </Campo>

              <Campo label={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Destino principal (opcional)' : 'Destino *'}>
                <input
                  value={form.destino}
                  onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                  readOnly={camposRotaBloqueados}
                  placeholder={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Ex: Petrópolis, Campo do Grêmio (deixe vazio se ainda não sabe)' : 'Ex: Hotel Tropical'}
                  className="campo-input"
                  style={{
                    background: camposRotaBloqueados ? '#f9fafb' : '#fff',
                    color: camposRotaBloqueados ? '#6B7280' : '#222',
                  }}
                />
              </Campo>

              <div className="grid grid-cols-2 gap-2">
                <Campo label={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Data de início *' : 'Data *'}>
                  <input type="date" value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="campo-input" />
                </Campo>
                <Campo label={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Hora de início *' : 'Horário de saída *'}>
                  <SelectHorario value={form.horario}
                    onChange={v => setForm(f => ({ ...f, horario: v }))} />
                </Campo>
              </div>
            </div>

            {/* Diária e City Tour: término estimado (editável, opcional) + trajetos */}
            {(form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour') && (
              <>
                <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <p className="text-xs font-semibold" style={{ color: '#9A3412' }}>
                    ⏰ Previsão de término <span className="font-normal text-gray-500">(opcional — pode preencher depois quando o serviço acabar)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo label="Data de término">
                      <input type="date" value={form.data_termino}
                        onChange={e => setForm(f => ({ ...f, data_termino: e.target.value }))}
                        min={form.data}
                        className="campo-input" />
                    </Campo>
                    <Campo label="Hora de término">
                      <SelectHorario value={form.horario_termino}
                        onChange={v => setForm(f => ({ ...f, horario_termino: v }))} />
                    </Campo>
                  </div>
                </div>

                <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: '#166534' }}>
                      🗺️ Trajetos percorridos
                    </p>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, trajetos: [...f.trajetos, ''] }))}
                      className="text-xs font-semibold" style={{ color: '#166534' }}>
                      + Adicionar
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Pode deixar vazio no cadastro. Adicione durante o serviço conforme os locais forem sendo visitados.
                  </p>
                  {form.trajetos.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Nenhum trajeto registrado ainda.</p>
                  )}
                  {form.trajetos.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-6">{idx + 1}.</span>
                      <input value={t}
                        onChange={e => setForm(f => ({ ...f, trajetos: f.trajetos.map((tt, i) => i === idx ? e.target.value : tt) }))}
                        placeholder="Ex: Fórmula 1, Salão do Automóvel, Restaurante Fasano..."
                        className="campo-input flex-1" />
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, trajetos: f.trajetos.filter((_, i) => i !== idx) }))}
                        className="text-xs font-semibold text-red-500 px-2">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!corridaEditando && form.tipo_servico !== 'diaria' && form.tipo_servico !== 'city_tour' && (
              <div className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Ida e volta?</p>
                  <p className="text-xs text-gray-400 mt-0.5">Cria dois agendamentos automaticamente</p>
                </div>
                <button
                  onClick={() => setForm(f => {
                    const ativando = !f.ida_volta
                    return {
                      ...f,
                      ida_volta: ativando,
                      horario_retorno: '',
                      origem_volta: ativando ? f.destino : '',
                      destino_volta: ativando ? f.origem : '',
                      data_retorno: ativando ? f.data : '',
                      preco_volta: ativando ? f.preco : '',
                      // Pré-preenche endereços da volta como inverso da ida
                      // (embarque volta = desembarque ida; desembarque volta = embarque ida)
                      rua_retorno_embarque:         ativando ? (f.rua_retorno_embarque         || f.rua_desembarque)         : '',
                      numero_retorno_embarque:      ativando ? (f.numero_retorno_embarque      || f.numero_desembarque)      : '',
                      bairro_retorno_embarque:      ativando ? (f.bairro_retorno_embarque      || f.bairro_desembarque)      : '',
                      municipio_retorno_embarque:   ativando ? (f.municipio_retorno_embarque   || f.municipio_desembarque)   : '',
                      cep_retorno_embarque:         ativando ? (f.cep_retorno_embarque         || f.cep_desembarque)         : '',
                      referencia_retorno_embarque:  ativando ? (f.referencia_retorno_embarque  || f.referencia_desembarque)  : '',
                      rua_retorno_desembarque:         ativando ? (f.rua_retorno_desembarque         || f.rua)         : '',
                      numero_retorno_desembarque:      ativando ? (f.numero_retorno_desembarque      || f.numero)      : '',
                      bairro_retorno_desembarque:      ativando ? (f.bairro_retorno_desembarque      || f.bairro)      : '',
                      municipio_retorno_desembarque:   ativando ? (f.municipio_retorno_desembarque   || f.municipio)   : '',
                      cep_retorno_desembarque:         ativando ? (f.cep_retorno_desembarque         || f.cep)         : '',
                      referencia_retorno_desembarque:  ativando ? (f.referencia_retorno_desembarque  || f.referencia)  : '',
                      passageiros_adicionais: f.passageiros_adicionais.map(p => ({
                        ...p,
                        rua_retorno_embarque:         ativando ? (p.rua_retorno_embarque         || p.rua_desembarque)         : '',
                        numero_retorno_embarque:      ativando ? (p.numero_retorno_embarque      || p.numero_desembarque)      : '',
                        bairro_retorno_embarque:      ativando ? (p.bairro_retorno_embarque      || p.bairro_desembarque)      : '',
                        municipio_retorno_embarque:   ativando ? (p.municipio_retorno_embarque   || p.municipio_desembarque)   : '',
                        cep_retorno_embarque:         ativando ? (p.cep_retorno_embarque         || p.cep_desembarque)         : '',
                        referencia_retorno_embarque:  ativando ? (p.referencia_retorno_embarque  || p.referencia_desembarque)  : '',
                        rua_retorno_desembarque:         ativando ? (p.rua_retorno_desembarque         || p.rua)         : '',
                        numero_retorno_desembarque:      ativando ? (p.numero_retorno_desembarque      || p.numero)      : '',
                        bairro_retorno_desembarque:      ativando ? (p.bairro_retorno_desembarque      || p.bairro)      : '',
                        municipio_retorno_desembarque:   ativando ? (p.municipio_retorno_desembarque   || p.municipio)   : '',
                        cep_retorno_desembarque:         ativando ? (p.cep_retorno_desembarque         || p.cep)         : '',
                        referencia_retorno_desembarque:  ativando ? (p.referencia_retorno_desembarque  || p.referencia)  : '',
                      })),
                    }
                  })}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ background: form.ida_volta ? '#1D9E75' : '#e5e7eb' }}>
                  <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ left: form.ida_volta ? '22px' : '2px' }} />
                </button>
              </div>
            )}

            {/* Bloco Volta — aparece em 3 casos:
                1. Criando nova corrida com ida-volta marcada
                2. Editando corrida do link publico (retorno_data na mesma linha)
                Nao aparece quando editando um PAR (voltaIdEditando != null), porque
                nesse caso a volta e outra linha completa e ha logica separada de
                atualizacao com origem_volta/destino_volta/etc. */}
            {!voltaIdEditando && form.ida_volta && (
              <div className="rounded-xl px-3 py-3" style={{ background: '#EEEDFE' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: '#3C3489' }}>🔁 Volta</p>
                  <button
                    onClick={() => setForm(f => ({
                      ...f,
                      origem_volta: f.destino,
                      destino_volta: f.origem,
                    }))}
                    type="button"
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ border: '1px solid #AFA9EC', color: '#3C3489' }}>
                    ↺ Inverter ida
                  </button>
                </div>

                <Campo label="Origem do retorno *">
                  <input value={form.origem_volta}
                    onChange={e => setForm(f => ({ ...f, origem_volta: e.target.value }))}
                    placeholder="Ex: Hotel Tropical" className="campo-input" />
                </Campo>

                <Campo label="Destino do retorno *">
                  <input value={form.destino_volta}
                    onChange={e => setForm(f => ({ ...f, destino_volta: e.target.value }))}
                    placeholder="Ex: Aeroporto Internacional" className="campo-input" />
                </Campo>

                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Data de retorno *">
                    <input type="date" value={form.data_retorno}
                      onChange={e => setForm(f => ({ ...f, data_retorno: e.target.value }))}
                      className="campo-input" />
                  </Campo>
                  <Campo label="Horário de retorno *">
                    <SelectHorario value={form.horario_retorno}
                      onChange={v => setForm(f => ({ ...f, horario_retorno: v }))} />
                  </Campo>
                </div>
              </div>
            )}

            {/* Cliente cadastrado (opcional). Se selecionar, autopreencue nome/tel/email
                pra evitar redigitacao. Continua editavel — gestor pode ajustar. */}
            {clientesOpcoes.length > 0 && (
              <Campo label="Cliente cadastrado (opcional)">
                <select value={form.cliente_id}
                  onChange={e => {
                    const id = e.target.value
                    const c = clientesOpcoes.find(x => x.id === id)
                    setForm(f => ({
                      ...f,
                      cliente_id: id,
                      cliente_nome: c ? c.label : f.cliente_nome,
                      cliente_telefone: c?.telefone ? c.telefone : f.cliente_telefone,
                      email_solicitante: c?.email ? c.email : f.email_solicitante,
                    }))
                  }}
                  className="campo-input">
                  <option value="">— Cliente avulso (digitar manualmente) —</option>
                  {clientesOpcoes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.tipo === 'pj' ? '🏢' : '👤'} {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Cadastre novos clientes em <a href="/empresa/clientes" className="underline" style={{ color: '#0F6E56' }}>Clientes</a>.
                </p>
              </Campo>
            )}

            <Campo label="Nome do solicitante *">
              <input value={form.cliente_nome}
                onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
                placeholder="Nome completo" className="campo-input" />
            </Campo>

            <Campo label="Telefone do solicitante">
              <input value={form.cliente_telefone}
                onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))}
                placeholder="(11) 99999-9999 ou +1 555 123 4567" className="campo-input" />
              <p className="text-[10px] text-gray-400 mt-1">Aceita número internacional. Para fora do Brasil, comece com + e o código do país (ex: +1, +351).</p>
            </Campo>

            <Campo label="E-mail do solicitante">
              <input value={form.email_solicitante}
                onChange={e => setForm(f => ({ ...f, email_solicitante: e.target.value }))}
                placeholder="email@exemplo.com" type="email" className="campo-input" />
            </Campo>

            {/* Passageiro 1 (só transfer) — quem efetivamente viaja, ficha própria e obrigatória */}
            {tipoOperacao !== 'rota_fixa' && (
              <div className="rounded-2xl p-4 border-2 flex flex-col gap-3" style={{ borderColor: '#9FE1CB', background: '#fff' }}>
                <p className="text-sm font-semibold text-gray-700">🧍 Dados do Passageiro 1</p>
                <Campo label="Nome completo *">
                  <input value={form.passageiro1_nome}
                    onChange={e => setForm(f => ({ ...f, passageiro1_nome: e.target.value }))}
                    placeholder="Nome completo" className="campo-input" />
                </Campo>
                <Campo label="Telefone">
                  <input value={form.passageiro1_telefone}
                    onChange={e => setForm(f => ({ ...f, passageiro1_telefone: e.target.value }))}
                    placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
                </Campo>
                <Campo label="Número do voo">
                  <input value={form.numero_voo}
                    onChange={e => setForm(f => ({ ...f, numero_voo: e.target.value }))}
                    placeholder="Ex: G3 1234 (opcional)" className="campo-input" />
                </Campo>

                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">📍 Endereço de embarque <span className="normal-case font-normal">(opcional)</span></p>
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
                  <Campo label="CEP">
                    <input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))}
                      placeholder="00000-000" className="campo-input" />
                  </Campo>
                </div>
                <Campo label="Ponto de referência">
                  <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                    placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                </Campo>

                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">🏁 Endereço de desembarque <span className="normal-case font-normal">(opcional)</span></p>
                <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                  <Campo label="Rua / Logradouro">
                    <input value={form.rua_desembarque} onChange={e => setForm(f => ({ ...f, rua_desembarque: e.target.value }))}
                      placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                  </Campo>
                  <Campo label="Número">
                    <input value={form.numero_desembarque} onChange={e => setForm(f => ({ ...f, numero_desembarque: e.target.value }))}
                      placeholder="456" className="campo-input" />
                  </Campo>
                </div>
                <Campo label="Bairro">
                  <input value={form.bairro_desembarque} onChange={e => setForm(f => ({ ...f, bairro_desembarque: e.target.value }))}
                    placeholder="Ex: Vila Nova" className="campo-input" />
                </Campo>
                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Município">
                    <input value={form.municipio_desembarque} onChange={e => setForm(f => ({ ...f, municipio_desembarque: e.target.value }))}
                      placeholder="Ex: São Paulo" className="campo-input" />
                  </Campo>
                  <Campo label="CEP">
                    <input value={form.cep_desembarque} onChange={e => setForm(f => ({ ...f, cep_desembarque: e.target.value }))}
                      placeholder="00000-000" className="campo-input" />
                  </Campo>
                </div>
                <Campo label="Ponto de referência">
                  <input value={form.referencia_desembarque} onChange={e => setForm(f => ({ ...f, referencia_desembarque: e.target.value }))}
                    placeholder="Ex: Em frente à padaria" className="campo-input" />
                </Campo>

                {/* Endereços da volta (só se ida_volta ativo) */}
                {form.ida_volta && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🔁 Endereço de embarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={form.rua_retorno_embarque} onChange={e => setForm(f => ({ ...f, rua_retorno_embarque: e.target.value }))}
                          placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={form.numero_retorno_embarque} onChange={e => setForm(f => ({ ...f, numero_retorno_embarque: e.target.value }))}
                          placeholder="456" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={form.bairro_retorno_embarque} onChange={e => setForm(f => ({ ...f, bairro_retorno_embarque: e.target.value }))}
                        placeholder="Ex: Vila Nova" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={form.municipio_retorno_embarque} onChange={e => setForm(f => ({ ...f, municipio_retorno_embarque: e.target.value }))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={form.cep_retorno_embarque} onChange={e => setForm(f => ({ ...f, cep_retorno_embarque: e.target.value }))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={form.referencia_retorno_embarque} onChange={e => setForm(f => ({ ...f, referencia_retorno_embarque: e.target.value }))}
                        placeholder="Ex: Em frente à padaria" className="campo-input" />
                    </Campo>

                    <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🏁 Endereço de desembarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={form.rua_retorno_desembarque} onChange={e => setForm(f => ({ ...f, rua_retorno_desembarque: e.target.value }))}
                          placeholder="Ex: Rua das Flores" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={form.numero_retorno_desembarque} onChange={e => setForm(f => ({ ...f, numero_retorno_desembarque: e.target.value }))}
                          placeholder="123" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={form.bairro_retorno_desembarque} onChange={e => setForm(f => ({ ...f, bairro_retorno_desembarque: e.target.value }))}
                        placeholder="Ex: Centro" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={form.municipio_retorno_desembarque} onChange={e => setForm(f => ({ ...f, municipio_retorno_desembarque: e.target.value }))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={form.cep_retorno_desembarque} onChange={e => setForm(f => ({ ...f, cep_retorno_desembarque: e.target.value }))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={form.referencia_retorno_desembarque} onChange={e => setForm(f => ({ ...f, referencia_retorno_desembarque: e.target.value }))}
                        placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                    </Campo>
                  </>
                )}
              </div>
            )}

            {/* Mais passageiros (só transfer) — repetível */}
            {tipoOperacao !== 'rota_fixa' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-700">👥 Mais passageiros</span>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, passageiros_adicionais: [...f.passageiros_adicionais, { ...PASSAGEIRO_EXTRA_CORRIDA_VAZIO }] }))}
                    className="text-sm font-semibold" style={{ color: '#0F6E56' }}>
                    + Adicionar passageiro
                  </button>
                </div>
                {form.passageiros_adicionais.map((p, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-100 p-3 flex flex-col gap-2" style={{ background: '#f9f9f7' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Passageiro {idx + 2}</span>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.filter((_, i) => i !== idx) }))}
                        className="text-xs font-semibold text-red-500">
                        − Remover
                      </button>
                    </div>
                    <Campo label="Nome completo">
                      <input value={p.nome}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, nome: e.target.value } : pp) }))}
                        placeholder="Nome completo" className="campo-input" />
                    </Campo>
                    <Campo label="Telefone">
                      <input value={p.telefone}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, telefone: e.target.value } : pp) }))}
                        placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
                    </Campo>
                    <Campo label="Número do voo">
                      <input value={p.numero_voo}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero_voo: e.target.value } : pp) }))}
                        placeholder="Ex: G3 1234 (opcional)" className="campo-input" />
                    </Campo>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">📍 Endereço de embarque</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={p.rua}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, rua: e.target.value } : pp) }))}
                          placeholder="Ex: Rua das Flores" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={p.numero}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero: e.target.value } : pp) }))}
                          placeholder="123" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={p.bairro}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, bairro: e.target.value } : pp) }))}
                        placeholder="Ex: Centro" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={p.municipio}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, municipio: e.target.value } : pp) }))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={p.cep}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, cep: e.target.value } : pp) }))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={p.referencia}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, referencia: e.target.value } : pp) }))}
                        placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                    </Campo>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">🏁 Endereço de desembarque</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={p.rua_desembarque}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, rua_desembarque: e.target.value } : pp) }))}
                          placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={p.numero_desembarque}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero_desembarque: e.target.value } : pp) }))}
                          placeholder="456" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={p.bairro_desembarque}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, bairro_desembarque: e.target.value } : pp) }))}
                        placeholder="Ex: Vila Nova" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={p.municipio_desembarque}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, municipio_desembarque: e.target.value } : pp) }))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={p.cep_desembarque}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, cep_desembarque: e.target.value } : pp) }))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={p.referencia_desembarque}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, referencia_desembarque: e.target.value } : pp) }))}
                        placeholder="Ex: Em frente à padaria" className="campo-input" />
                    </Campo>

                    {/* Endereços da volta deste passageiro (só se ida_volta ativo) */}
                    {form.ida_volta && (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🔁 Embarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                        <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                          <Campo label="Rua / Logradouro">
                            <input value={p.rua_retorno_embarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, rua_retorno_embarque: e.target.value } : pp) }))}
                              placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                          </Campo>
                          <Campo label="Número">
                            <input value={p.numero_retorno_embarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero_retorno_embarque: e.target.value } : pp) }))}
                              placeholder="456" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Bairro">
                          <input value={p.bairro_retorno_embarque}
                            onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, bairro_retorno_embarque: e.target.value } : pp) }))}
                            placeholder="Ex: Vila Nova" className="campo-input" />
                        </Campo>
                        <div className="grid grid-cols-2 gap-2">
                          <Campo label="Município">
                            <input value={p.municipio_retorno_embarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, municipio_retorno_embarque: e.target.value } : pp) }))}
                              placeholder="Ex: São Paulo" className="campo-input" />
                          </Campo>
                          <Campo label="CEP">
                            <input value={p.cep_retorno_embarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, cep_retorno_embarque: e.target.value } : pp) }))}
                              placeholder="00000-000" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Ponto de referência">
                          <input value={p.referencia_retorno_embarque}
                            onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, referencia_retorno_embarque: e.target.value } : pp) }))}
                            placeholder="Ex: Em frente à padaria" className="campo-input" />
                        </Campo>

                        <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🏁 Desembarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                        <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                          <Campo label="Rua / Logradouro">
                            <input value={p.rua_retorno_desembarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, rua_retorno_desembarque: e.target.value } : pp) }))}
                              placeholder="Ex: Rua das Flores" className="campo-input" />
                          </Campo>
                          <Campo label="Número">
                            <input value={p.numero_retorno_desembarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero_retorno_desembarque: e.target.value } : pp) }))}
                              placeholder="123" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Bairro">
                          <input value={p.bairro_retorno_desembarque}
                            onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, bairro_retorno_desembarque: e.target.value } : pp) }))}
                            placeholder="Ex: Centro" className="campo-input" />
                        </Campo>
                        <div className="grid grid-cols-2 gap-2">
                          <Campo label="Município">
                            <input value={p.municipio_retorno_desembarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, municipio_retorno_desembarque: e.target.value } : pp) }))}
                              placeholder="Ex: São Paulo" className="campo-input" />
                          </Campo>
                          <Campo label="CEP">
                            <input value={p.cep_retorno_desembarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, cep_retorno_desembarque: e.target.value } : pp) }))}
                              placeholder="00000-000" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Ponto de referência">
                          <input value={p.referencia_retorno_desembarque}
                            onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, referencia_retorno_desembarque: e.target.value } : pp) }))}
                            placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                        </Campo>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* KM inicial/final — só transfer, diária e city tour.
                Se é par ida-volta (voltaIdEditando setado), divide em DOIS
                blocos: KM da ida (azul) e KM da volta (roxo). Cada ponta
                grava em sua própria linha em corridas_empresa. Julimar
                pediu isso quando ida e volta são em dias distintos. */}
            {(form.tipo_servico === 'transfer' || form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour') && (
              <>
                {(() => {
                  const kmI = parseFloat((form.km_inicial || '').replace(',', '.'))
                  const kmF = parseFloat((form.km_final || '').replace(',', '.'))
                  const total = !isNaN(kmI) && !isNaN(kmF) && kmF >= kmI ? (kmF - kmI) : null
                  const invalido = !isNaN(kmI) && !isNaN(kmF) && kmF < kmI
                  const ehPar = !!voltaIdEditando
                  return (
                    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>
                        🛞 Quilometragem {ehPar ? 'da IDA' : ''} <span className="font-normal text-gray-500">(opcional — motorista preenche antes e depois do serviço)</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Campo label="KM inicial">
                          <input type="number" step="0.1" min={0}
                            value={form.km_inicial}
                            onChange={e => setForm(f => ({ ...f, km_inicial: e.target.value }))}
                            placeholder="Ex: 45230.5"
                            className="campo-input" />
                        </Campo>
                        <Campo label="KM final">
                          <input type="number" step="0.1" min={0}
                            value={form.km_final}
                            onChange={e => setForm(f => ({ ...f, km_final: e.target.value }))}
                            placeholder="Ex: 45312.8"
                            className="campo-input" />
                        </Campo>
                      </div>
                      {total !== null && (
                        <div className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: '#DBEAFE' }}>
                          <span className="text-xs font-medium" style={{ color: '#1E3A8A' }}>Total percorrido {ehPar ? 'na ida' : ''}</span>
                          <span className="text-sm font-bold" style={{ color: '#1D4ED8' }}>{total.toFixed(1).replace('.', ',')} km</span>
                        </div>
                      )}
                      {invalido && (
                        <p className="text-xs" style={{ color: '#DC2626' }}>⚠️ KM final não pode ser menor que KM inicial.</p>
                      )}
                    </div>
                  )
                })()}

                {/* Bloco KM da VOLTA — só aparece quando editando um par
                    ida-volta (2 linhas separadas). Link público ida-volta
                    (uma só linha) NÃO tem voltaIdEditando, então não mostra. */}
                {voltaIdEditando && (() => {
                  const kmI = parseFloat((form.km_inicial_volta || '').replace(',', '.'))
                  const kmF = parseFloat((form.km_final_volta || '').replace(',', '.'))
                  const total = !isNaN(kmI) && !isNaN(kmF) && kmF >= kmI ? (kmF - kmI) : null
                  const invalido = !isNaN(kmI) && !isNaN(kmF) && kmF < kmI
                  return (
                    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#EEEDFE', border: '1px solid #AFA9EC' }}>
                      <p className="text-xs font-semibold" style={{ color: '#3C3489' }}>
                        🔁 Quilometragem da VOLTA <span className="font-normal text-gray-500">(opcional)</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Campo label="KM inicial da volta">
                          <input type="number" step="0.1" min={0}
                            value={form.km_inicial_volta}
                            onChange={e => setForm(f => ({ ...f, km_inicial_volta: e.target.value }))}
                            placeholder="Ex: 45320.0"
                            className="campo-input" />
                        </Campo>
                        <Campo label="KM final da volta">
                          <input type="number" step="0.1" min={0}
                            value={form.km_final_volta}
                            onChange={e => setForm(f => ({ ...f, km_final_volta: e.target.value }))}
                            placeholder="Ex: 45402.5"
                            className="campo-input" />
                        </Campo>
                      </div>
                      {total !== null && (
                        <div className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: '#DDD6FE' }}>
                          <span className="text-xs font-medium" style={{ color: '#3C3489' }}>Total percorrido na volta</span>
                          <span className="text-sm font-bold" style={{ color: '#3C3489' }}>{total.toFixed(1).replace('.', ',')} km</span>
                        </div>
                      )}
                      {invalido && (
                        <p className="text-xs" style={{ color: '#DC2626' }}>⚠️ KM final da volta não pode ser menor que o inicial.</p>
                      )}
                    </div>
                  )
                })()}
              </>
            )}

            <Campo label="Forma de pagamento">
              <select value={form.forma_pagamento}
                onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                className="campo-input">
                <option value="a_definir">A definir</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="faturado">Faturado</option>
              </select>
            </Campo>

            {form.forma_pagamento === 'faturado' && (
              <Campo label="Previsão de recebimento (opcional)">
                <input type="date" value={form.data_prevista_pagamento}
                  onChange={e => setForm(f => ({ ...f, data_prevista_pagamento: e.target.value }))}
                  className="campo-input" />
              </Campo>
            )}

            <Campo label="Status do pagamento">
              <select value={form.status_pagamento}
                onChange={e => setForm(f => ({
                  ...f,
                  status_pagamento: e.target.value,
                  valor_recebido: '',
                  data_pagamento: e.target.value === 'recebido' && !f.data_pagamento
                    ? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
                    : f.data_pagamento,
                }))}
                className="campo-input">
                <option value="a_receber">A receber</option>
                <option value="parcial">Recebido parcialmente</option>
                <option value="recebido">Recebido</option>
              </select>
            </Campo>

            {form.status_pagamento === 'parcial' && (
              <Campo label="Valor recebido (R$)">
                <input type="number" step="0.01" min={0}
                  value={form.valor_recebido}
                  onChange={e => setForm(f => ({ ...f, valor_recebido: e.target.value }))}
                  placeholder="0,00" className="campo-input" />
              </Campo>
            )}

            {form.status_pagamento === 'recebido' && (
              <Campo label="Data do recebimento">
                <input type="date" value={form.data_pagamento}
                  onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))}
                  className="campo-input" />
              </Campo>
            )}

            {/* Se é PAR ida-e-volta (criando OU editando), mostra os dois valores
                separados + total. Antes, na edição só aparecia 'Preço' com o
                valor da ida — o gestor não via a volta e ficava com a
                impressão de que o valor 'subia' após salvar (na verdade o
                card da lista mostra a soma ida+volta). */}
            {form.ida_volta && (!corridaEditando || voltaIdEditando) ? (() => {
              const vI = parseFloat(form.preco)
              const vV = parseFloat(form.preco_volta)
              const total = !isNaN(vI) && !isNaN(vV) ? vI + vV : null
              return (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Campo label="Valor ida (R$) *">
                      <input type="number" step="0.01" min={0} value={form.preco}
                        onChange={e => setForm(f => {
                          const novoPreco = e.target.value
                          // Se preco_volta está vazio OU espelhando o preço atual
                          // (nunca foi editado independentemente pelo gestor),
                          // acompanha o novo valor. Evita bug: gestor digita 160,
                          // ativa ida-volta (volta copia 160), muda ida pra 320,
                          // volta ficaria congelada em 160 e total no card = 480.
                          const espelhando = f.preco_volta === f.preco || f.preco_volta === ''
                          return {
                            ...f,
                            preco: novoPreco,
                            preco_volta: (f.ida_volta && espelhando) ? novoPreco : f.preco_volta,
                          }
                        })}
                        placeholder="0,00" className="campo-input" />
                    </Campo>
                    <Campo label="Valor volta (R$)">
                      <input type="number" step="0.01" min={0} value={form.preco_volta}
                        onChange={e => setForm(f => ({ ...f, preco_volta: e.target.value }))}
                        placeholder="0,00" className="campo-input" />
                    </Campo>
                  </div>
                  {total !== null && (
                    <div className="rounded-xl px-3 py-2 flex items-center justify-between" style={{ background: '#E1F5EE' }}>
                      <span className="text-xs font-medium" style={{ color: '#085041' }}>Total (ida + volta)</span>
                      <span className="text-sm font-bold" style={{ color: '#0F6E56' }}>R$ {total.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                </div>
              )
            })() : (
              <Campo label="Preço (R$) *">
                <input type="number" step="0.01" min={0} value={form.preco}
                  onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                  placeholder="0,00" className="campo-input" />
              </Campo>
            )}

            {/* Observações — label muda quando é par ida-volta pra deixar
                claro que este campo é da IDA especificamente. */}
            <Campo label={(form.ida_volta && (!corridaEditando || voltaIdEditando)) ? 'Observações da IDA' : 'Observações'}>
              <textarea value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Informações adicionais, ponto de encontro, etc."
                className="campo-input"
                rows={3}
                style={{ resize: 'none' }} />
            </Campo>

            {/* Observações da VOLTA — antes só aparecia na criação. Agora
                também aparece na edição de par ida-volta (voltaIdEditando).
                Julimar pediu campo separado por ponta — corridas podem
                ter contextos diferentes (ex: mala extra só no retorno). */}
            {form.ida_volta && (!corridaEditando || voltaIdEditando) && (
              <Campo label="Observações da VOLTA">
                <textarea value={form.observacoes_volta}
                  onChange={e => setForm(f => ({ ...f, observacoes_volta: e.target.value }))}
                  placeholder="Informações adicionais, ponto de encontro, etc."
                  className="campo-input"
                  rows={3}
                  style={{ resize: 'none' }} />
              </Campo>
            )}

            {erro && (
              <div className="rounded-xl px-4 py-3 text-sm border"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                ⚠️ {erro}
              </div>
            )}

            {rotaManual && !corridaEditando && (
              <div className="rounded-xl px-4 py-3 text-xs"
                style={{ background: '#FAEEDA', color: '#854F0B' }}>
                💡 Rota manual: após confirmar, você poderá salvar essa rota para usar novamente.
              </div>
            )}

            <button onClick={salvar} disabled={salvando}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-1 mb-6 disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvando
                ? 'Salvando...'
                : corridaEditando
                  ? 'Salvar alterações'
                  : form.ida_volta
                    ? '✓ Confirmar atendimento (ida + volta)'
                    : '✓ Confirmar atendimento'}
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
      )}

      {/* Modal agendar passageiro (rota fixa) */}
      {modalAgAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAgAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
              {agEditando ? 'Editar passageiro' : 'Agendar passageiro'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 flex flex-col gap-3">

            <Campo label="Rota *">
              <select value={formAg.rota_empresa_id}
                onChange={e => selecionarRotaAg(e.target.value)}
                className="campo-input">
                <option value="">Selecione uma rota...</option>
                {rotasOpcoes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nome || `${r.origem} → ${r.destino}`}
                  </option>
                ))}
              </select>
            </Campo>

            {!formAg.rota_empresa_id && agEditando && (
              <div className="rounded-xl px-4 py-3 border border-gray-100" style={{ background: '#f9fafb' }}>
                <p className="text-xs text-gray-400 mb-1">Trecho atual</p>
                <p className="text-sm font-medium text-gray-800">{formAg.embarque} → {formAg.desembarque}</p>
                <p className="text-xs text-gray-400 mt-1">Selecione uma rota acima para alterar o trecho</p>
              </div>
            )}

            {paradasUnicasRF.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Embarque *">
                  <select value={formAg.embarque}
                    onChange={e => {
                      const emb = e.target.value
                      setFormAg(f => ({ ...f, embarque: emb, desembarque: '' }))
                      setValorTrechoRF(null)
                    }}
                    className="campo-input">
                    <option value="">Selecione...</option>
                    {paradasUnicasRF.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Desembarque *">
                  <select value={formAg.desembarque}
                    onChange={e => {
                      const des = e.target.value
                      const trecho = trechosRF.find(t => t.nome === `${formAg.embarque} → ${des}`)
                      if (trecho) {
                        setValorTrechoRF(Number(trecho.preco))
                        setFormAg(f => ({ ...f, desembarque: des, valor: String(trecho.preco) }))
                      } else {
                        setValorTrechoRF(null)
                        setFormAg(f => ({ ...f, desembarque: des }))
                      }
                    }}
                    className="campo-input">
                    <option value="">Selecione...</option>
                    {paradasUnicasRF.filter(p => p !== formAg.embarque).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Campo>
              </div>
            )}

            {valorTrechoRF !== null && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: '#E1F5EE' }}>
                <span className="text-sm font-medium" style={{ color: '#085041' }}>Valor do trecho</span>
                <span className="text-lg font-bold" style={{ color: '#0F6E56' }}>
                  R$ {valorTrechoRF.toFixed(2).replace('.', ',')}
                </span>
              </div>
            )}

            {formAg.embarque && formAg.desembarque && valorTrechoRF === null && (
              <div className="rounded-xl px-4 py-3 border"
                style={{ background: '#FCEBEB', borderColor: '#F5BCBC' }}>
                <p className="text-xs text-center" style={{ color: '#A32D2D' }}>
                  Trecho não disponível. Insira o valor manualmente.
                </p>
              </div>
            )}

            <Campo label="Valor (R$) *">
              <input type="number" step="0.01" min={0}
                value={formAg.valor}
                onChange={e => {
                  setFormAg(f => ({ ...f, valor: e.target.value }))
                  setValorTrechoRF(null)
                }}
                placeholder="0,00" className="campo-input" />
            </Campo>

            <Campo label="Nome do passageiro *">
              <div className="flex items-center gap-2">
                <input value={formAg.nome_passageiro}
                  onChange={e => setFormAg(f => ({ ...f, nome_passageiro: e.target.value }))}
                  placeholder="Nome completo" className="campo-input flex-1" />
                {contactsApi && (
                  <button type="button" onClick={selecionarContatoAg}
                    className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-green-700 border border-gray-200 bg-white whitespace-nowrap"
                    title="Importar da agenda do celular">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                    </svg>
                    <span>Buscar contato</span>
                  </button>
                )}
              </div>
            </Campo>

            <Campo label="Telefone">
              <input value={formAg.telefone_passageiro}
                onChange={e => setFormAg(f => ({ ...f, telefone_passageiro: e.target.value }))}
                placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
            </Campo>

            <div className="rounded-2xl p-4 border border-gray-100 flex flex-col gap-3" style={{ background: '#f9fafb' }}>
              <p className="text-sm font-semibold text-gray-700">
                📍 Endereço de embarque{' '}
                <span className="text-xs font-normal text-gray-400">(opcional)</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                <Campo label="Rua / Logradouro">
                  <input value={formAg.rua}
                    onChange={e => setFormAg(f => ({ ...f, rua: e.target.value }))}
                    placeholder="Ex: Rua das Flores" className="campo-input" />
                </Campo>
                <Campo label="Número">
                  <input value={formAg.numero}
                    onChange={e => setFormAg(f => ({ ...f, numero: e.target.value }))}
                    placeholder="123" className="campo-input" />
                </Campo>
              </div>
              <Campo label="Bairro">
                <input value={formAg.bairro}
                  onChange={e => setFormAg(f => ({ ...f, bairro: e.target.value }))}
                  placeholder="Ex: Centro" className="campo-input" />
              </Campo>
              <Campo label="Município">
                <input value={formAg.municipio}
                  onChange={e => setFormAg(f => ({ ...f, municipio: e.target.value }))}
                  placeholder="Ex: São Paulo" className="campo-input" />
              </Campo>
              <Campo label="CEP">
                <input value={formAg.cep}
                  onChange={e => setFormAg(f => ({ ...f, cep: e.target.value }))}
                  placeholder="00000-000" className="campo-input" />
              </Campo>
              <Campo label="Ponto de referência">
                <input value={formAg.referencia}
                  onChange={e => setFormAg(f => ({ ...f, referencia: e.target.value }))}
                  placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
              </Campo>
            </div>

            <Campo label="Data da viagem *">
              <input type="date" value={formAg.data_viagem}
                onChange={e => setFormAg(f => ({ ...f, data_viagem: e.target.value }))}
                className="campo-input" />
            </Campo>

            <Campo label="Turno">
              <div className="grid grid-cols-2 gap-2">
                {(['ida', 'volta'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setFormAg(f => ({ ...f, turno: t }))}
                    className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={formAg.turno === t
                      ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                      : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                    {t === 'ida' ? '↑ Ida' : '↓ Volta'}
                  </button>
                ))}
              </div>
            </Campo>

            <Campo label="Forma de pagamento">
              <select value={formAg.forma_pagamento}
                onChange={e => setFormAg(f => ({ ...f, forma_pagamento: e.target.value }))}
                className="campo-input">
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao">Cartão</option>
                <option value="fiado">Fiado</option>
                <option value="pendente">A cobrar na viagem</option>
              </select>
            </Campo>

            <Campo label="Motorista *">
              <select value={formAg.motorista_empresa_id}
                onChange={e => setFormAg(f => ({ ...f, motorista_empresa_id: e.target.value }))}
                className="campo-input">
                <option value="">Selecione um motorista...</option>
                {motoristasOpcoes.filter(m => m.user_id).map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
              {motoristasOpcoes.some(m => !m.user_id) && (
                <p className="text-xs text-gray-400 mt-1">
                  Motoristas sem conta vinculada não aparecem nesta lista.
                </p>
              )}
            </Campo>

            <Campo label="Observações">
              <textarea value={formAg.observacoes}
                onChange={e => setFormAg(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Informações adicionais..."
                className="campo-input"
                rows={3}
                style={{ resize: 'none' }} />
            </Campo>

            {erroAg && (
              <div className="rounded-xl px-4 py-3 text-sm border"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                ⚠️ {erroAg}
              </div>
            )}

            <button onClick={salvarAgPassageiro} disabled={salvandoAg}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-1 mb-6 disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvandoAg ? 'Salvando...' : agEditando ? '✓ Salvar alterações' : '✓ Confirmar agendamento'}
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
      )}
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

// Substitui <input type="time"> pra evitar picker nativo travado em
// certos celulares (cliente reportou "nao seleciona o horario" no mobile).
// Dois dropdowns simples sempre funcionam. Formato interno mantido: "HH:MM".
function SelectHorario({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h = '', m = ''] = (value || '').split(':')
  const horas = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutos = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
  function set(novaH: string, novoM: string) {
    if (novaH && novoM) onChange(`${novaH}:${novoM}`)
    else if (!novaH && !novoM) onChange('')
    else onChange(`${novaH || '00'}:${novoM || '00'}`)
  }
  return (
    <div className="flex items-center gap-1">
      <select value={h} onChange={e => set(e.target.value, m)}
        className="campo-input" style={{ flex: 1 }}>
        <option value="">Hora</option>
        {horas.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="text-gray-400 font-bold">:</span>
      <select value={m} onChange={e => set(h, e.target.value)}
        className="campo-input" style={{ flex: 1 }}>
        <option value="">Min</option>
        {minutos.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
    </div>
  )
}

function formatarDataFiltro(str: string): string {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [, mes, dia] = str.split('-')
  return `${parseInt(dia)} de ${meses[parseInt(mes) - 1]}`
}
